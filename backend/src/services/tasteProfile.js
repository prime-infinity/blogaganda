import { supabaseAdmin } from '../config/supabase.js';
import { getInsights, getTasteTags, getDemographics, enrichEntitiesWithQloo } from './qloo.js';
import { searchArticlesByEntity } from './newsapi.js';
import { extractEntities } from './nlp.js';

/**
 * Build or update user's taste profile based on reading history
 */
export async function updateUserTasteProfile(userId) {
  try {
    // Get user's reading history with articles and extracted entities
    const { data: history, error: historyError } = await supabaseAdmin
      .from('reading_history')
      .select(`
        article_id,
        articles (
          entities
        )
      `)
      .eq('user_id', userId);

    if (historyError) throw historyError;

    if (!history || history.length < 1) {
      console.log(`⚠️ User ${userId} needs more articles (has ${history?.length || 0}, needs 1+)`);
      return null;
    }

    // Aggregate all Qloo entity IDs from read articles
    const entityArray = [];
    history.forEach(item => {
      if (item.articles?.entities) {
        const entities = JSON.parse(JSON.stringify(item.articles.entities));
        entities.forEach(entity => {
          if (entity.qlooId) {
            entityArray.push(entity.qlooId);
          }
        });
      }
    });

    if (entityArray.length === 0) {
      console.log(`🚫 User ${userId} has 0 Qloo entities (articles have no recognized entities)`);
      return null;
    }

    // Deduplicate entities
    const uniqueEntities = [...new Set(entityArray)];
    console.log(`📊 Building profile from ${uniqueEntities.length} unique entities`);

    // Get cross-category insights from Qloo (entertainment/lifestyle focus)
    const [personInsights, brandInsights, placeInsights, movieInsights, tvInsights, demographics, tasteTags] = await Promise.all([
      getInsights(uniqueEntities, 'urn:entity:person', { limit: 3 }),     // Celebrities, actors, chefs
      getInsights(uniqueEntities, 'urn:entity:brand', { limit: 3 }),      // Fashion, luxury, restaurants
      getInsights(uniqueEntities, 'urn:entity:place', { limit: 3 }),      // Venues, destinations
      getInsights(uniqueEntities, 'urn:entity:movie', { limit: 3 }),      // Films
      getInsights(uniqueEntities, 'urn:entity:tv_show', { limit: 3 }),    // TV/streaming
      getDemographics(uniqueEntities),                                     // Age/gender predictions
      getTasteTags(uniqueEntities)
    ]);

    // Build affinity profile (entertainment/lifestyle)
    const affinities = {
      people: personInsights?.results?.entities || [],      // Actors, chefs, celebrities
      brands: brandInsights?.results?.entities || [],       // Fashion, luxury, restaurants
      places: placeInsights?.results?.entities || [],       // Venues, destinations
      movies: movieInsights?.results?.entities || [],       // Films
      tvShows: tvInsights?.results?.entities || [],         // TV shows
      updatedAt: new Date().toISOString()
    };

    // Extract taste tags
    const tags = tasteTags.map(tag => tag.name).filter(Boolean);

    // Process demographics - find highest affinity age group
    let predictedDemographics = null;
    if (demographics?.results?.demographics?.[0]) {
      const demoData = demographics.results.demographics[0].query;
      
      console.log(`📊 Raw Qloo demographics response:`, JSON.stringify(demoData, null, 2));
      
      // Find highest age affinity
      const ageScores = demoData.age || {};
      const topAge = Object.entries(ageScores)
        .sort(([, a], [, b]) => b - a)[0];
      
      const ageGroup = topAge ? topAge[0].replace(/_/g, ' ') : 'Unknown';
      const genderScores = demoData.gender || {};
      const maleScore = genderScores.male || 0;
      const femaleScore = genderScores.female || 0;
      
      const genderSkew = maleScore > femaleScore ? `Male-skewing (${maleScore.toFixed(3)} vs ${femaleScore.toFixed(3)})` : 
                         femaleScore > maleScore ? `Female-skewing (${femaleScore.toFixed(3)} vs ${maleScore.toFixed(3)})` : 
                         'Balanced';
      
      predictedDemographics = {
        ageGroup,
        genderSkew,
        ageAffinities: ageScores,
        genderAffinities: genderScores
      };

      console.log(`📊 Computed: ${ageGroup}, ${genderSkew}`);
    }

    // Audience segments feature disabled (deprecated Qloo endpoint)
    const topAudiences = [];

    // Calculate overall affinity score (average of top results across categories)
    const allScores = [
      ...(personInsights?.results?.entities || []).slice(0, 5),
      ...(brandInsights?.results?.entities || []).slice(0, 5),
      ...(placeInsights?.results?.entities || []).slice(0, 5)
    ].map(e => e.query?.affinity || 0);

    const affinityScore = allScores.length > 0
      ? allScores.reduce((a, b) => a + b, 0) / allScores.length
      : 0;

    // Get current profile to append evolution snapshot
    const { data: currentProfile } = await supabaseAdmin
      .from('user_taste_profiles')
      .select('profile_evolution')
      .eq('user_id', userId)
      .single();

    const evolution = currentProfile?.profile_evolution || [];
    evolution.push({
      timestamp: new Date().toISOString(),
      articlesRead: history.length,
      topBrands: affinities.brands.slice(0, 3).map(b => b.name),
      topTags: tags.slice(0, 5),
      affinityScore: affinityScore.toFixed(3)
    });

    // Upsert taste profile
    const { data: profile, error: profileError } = await supabaseAdmin
      .from('user_taste_profiles')
      .upsert({
        user_id: userId,
        entity_array: uniqueEntities,
        qloo_affinities: affinities,
        taste_tags: tags,
        affinity_score: affinityScore,
        articles_read_count: history.length,
        predicted_demographics: predictedDemographics,
        audience_segments: topAudiences,
        profile_evolution: evolution,
        last_updated: new Date().toISOString()
      }, {
        onConflict: 'user_id'
      })
      .select()
      .single();

    if (profileError) throw profileError;

    console.log(`✅ Profile updated: ${affinities.people.length} people, ${affinities.brands.length} brands, ${affinities.places.length} places, score ${affinityScore.toFixed(2)}`);

    return profile;
  } catch (error) {
    console.error('Failed to update taste profile:', error);
    throw error;
  }
}

/**
 * Generate article recommendations for user based on their taste profile
 */
export async function generateRecommendations(userId) {
  try {
    // Get user's taste profile
    const { data: profile, error: profileError } = await supabaseAdmin
      .from('user_taste_profiles')
      .select('qloo_affinities, entity_array')
      .eq('user_id', userId)
      .single();

    if (profileError || !profile) {
      console.log(`⚠️ No taste profile found for user ${userId}`);
      return [];
    }

    console.log(`🎯 Generating recommendations for user ${userId}...`);

    // Get articles user has already read
    const { data: readArticles } = await supabaseAdmin
      .from('reading_history')
      .select('article_id')
      .eq('user_id', userId);

    const readIds = readArticles?.map(r => r.article_id) || [];

    // Get all articles the user hasn't read yet
    const { data: allArticles, error: articlesError } = await supabaseAdmin
      .from('articles')
      .select('id, title, entities')
      .order('published_at', { ascending: false })
      .limit(100);

    if (articlesError) throw articlesError;

    // Filter out read articles
    const unreadArticles = allArticles.filter(article => !readIds.includes(article.id));

    // Score articles based on entity overlap with user's affinity profile
    const recommendations = [];
    const userEntities = new Set(profile.entity_array);
    
    // Build affinity map from user's Qloo results
    const affinityMap = new Map();
    const predictedByCategory = {
      people: [],
      brands: [],
      places: [],
      movies: [],
      tvShows: []
    };
    
    ['people', 'brands', 'places', 'movies', 'tvShows'].forEach(category => {
      profile.qloo_affinities[category]?.forEach(entity => {
        if (entity.entity_id && entity.query?.affinity) {
          affinityMap.set(entity.entity_id, entity.query.affinity);
          predictedByCategory[category].push({
            name: entity.name,
            id: entity.entity_id,
            affinity: entity.query.affinity.toFixed(3)
          });
        }
      });
    });

    console.log(`🔍 Qloo predicted ${affinityMap.size} entities across categories:\n`);
    ['people', 'brands', 'places', 'movies', 'tvShows'].forEach(category => {
      const top5 = predictedByCategory[category].slice(0, 5);
      if (top5.length > 0) {
        console.log(`   ${category.toUpperCase()}:`);
        top5.forEach(e => {
          console.log(`      ${e.name} (${e.id.slice(0, 8)}..., affinity: ${e.affinity})`);
        });
      }
    });
    console.log('');

    // Log article entity IDs for debugging
    const allArticleEntityIds = new Set();
    unreadArticles.forEach(article => {
      if (article.entities) {
        article.entities.forEach(entity => {
          if (entity.qlooId) allArticleEntityIds.add(entity.qlooId);
        });
      }
    });
    console.log(`📚 Articles contain ${allArticleEntityIds.size} unique entities`);
    
    // Find overlap between predicted and article entities
    const overlap = Array.from(affinityMap.keys()).filter(id => allArticleEntityIds.has(id));
    console.log(`🎯 Overlap: ${overlap.length} entities (${overlap.slice(0, 3).join(', ')}${overlap.length > 3 ? '...' : ''})`);

    for (const article of unreadArticles) {
      if (!article.entities || article.entities.length === 0) continue;

      let score = 0;
      let matchedEntities = [];

      article.entities.forEach(entity => {
        // Direct match with entities user has engaged with
        if (entity.qlooId && userEntities.has(entity.qlooId)) {
          score += 0.5;
          matchedEntities.push(entity.name);
        }
        // Match with Qloo-predicted affinities
        if (entity.qlooId && affinityMap.has(entity.qlooId)) {
          score += affinityMap.get(entity.qlooId);
          matchedEntities.push(entity.name);
        }
      });

      if (score >= 0.93) {
        recommendations.push({
          article_id: article.id,
          title: article.title,
          affinity_score: score,
          matched_entities: matchedEntities,
          reason: `Matches your interest in: ${matchedEntities.slice(0, 3).join(', ')}`
        });
      }
    }

    // Sort by score and take top 10
    recommendations.sort((a, b) => b.affinity_score - a.affinity_score);
    const topRecs = recommendations.slice(0, 10);

    console.log(`📋 Found ${recommendations.length} potential recommendations, keeping top ${topRecs.length}`);

    // 🔥 DYNAMIC ARTICLE FETCHING: If < 3 recommendations, fetch fresh articles
    if (topRecs.length < 3) {
      console.log(`\n🚀 DYNAMIC FETCH TRIGGERED (only ${topRecs.length} matches found)`);
      const dynamicRecs = await fetchDynamicArticles(userId, profile, affinityMap, userEntities);
      topRecs.push(...dynamicRecs);
      console.log(`✅ Total recommendations after dynamic fetch: ${topRecs.length}\n`);
    }

    // Upsert recommendations
    if (topRecs.length > 0) {
      const { error: recError } = await supabaseAdmin
        .from('article_recommendations')
        .upsert(
          topRecs.map(rec => ({
            user_id: userId,
            article_id: rec.article_id,
            affinity_score: rec.affinity_score,
            reason: rec.reason
          })),
          { onConflict: 'user_id,article_id' }
        );

      if (recError) console.error('Failed to save recommendations:', recError);
      else console.log(`✅ Saved ${topRecs.length} recommendations to database`);
    } else {
      console.log(`⚠️ No recommendations generated (no matching articles found)`);
    }

    return topRecs;
  } catch (error) {
    console.error('Failed to generate recommendations:', error);
    return [];
  }
}


/**
 * Fetch and process articles dynamically based on predicted entities
 */
async function fetchDynamicArticles(userId, profile, affinityMap, userEntities) {
  console.log(`📡 Fetching dynamic articles for top predicted entities...`);
  
  // Get top 5 entities across all categories (highest affinity)
  const allPredictions = [];
  ['people', 'brands', 'places', 'movies', 'tvShows'].forEach(category => {
    profile.qloo_affinities[category]?.forEach(entity => {
      if (entity.entity_id && entity.query?.affinity) {
        allPredictions.push({
          name: entity.name,
          id: entity.entity_id,
          affinity: entity.query.affinity,
          category
        });
      }
    });
  });

  // Sort by affinity and take top 3
  allPredictions.sort((a, b) => b.affinity - a.affinity);
  const topEntities = allPredictions.slice(0, 3);

  console.log(`🎯 Top 3 entities to search:`);
  topEntities.forEach(e => console.log(`   - ${e.name} (${e.category}, affinity: ${e.affinity.toFixed(3)})`));

  const dynamicRecommendations = [];

  for (const entity of topEntities) {
    console.log(`\n🔍 Searching for articles about: "${entity.name}"`);
    
    // Search NewsAPI (reduced from 3 to 1)
    const articles = await searchArticlesByEntity(entity.name, 1);
    
    if (articles.length === 0) {
      console.log(`   ⚠️ No articles found for "${entity.name}"`);
      continue;
    }

    // Process all articles in parallel
    const articleResults = await Promise.all(
      articles.map(async (article) => {
        console.log(`   📰 Processing: "${article.title.slice(0, 60)}..."`);
        
        // Extract entities from article
        const extractedEntities = await extractEntities(
          article.content || article.description || '',
          article.title,
          article.description
        );

        if (Object.values(extractedEntities).flat().length === 0) {
          console.log(`      ✗ No entities extracted, skipping`);
          return null;
        }

        // Enrich with Qloo
        const enrichedEntities = await enrichEntitiesWithQloo(extractedEntities);
        
        if (enrichedEntities.length === 0) {
          console.log(`      ✗ No Qloo enrichment, skipping`);
          return null;
        }

        console.log(`      ✓ Extracted ${enrichedEntities.length} entities`);
        
        return { article, enrichedEntities };
      })
    );

    // Process results
    for (const result of articleResults) {
      if (!result) continue;
      
      const { article, enrichedEntities } = result;

      // Check if article already exists (by URL)
      const { data: existing } = await supabaseAdmin
        .from('articles')
        .select('id')
        .eq('url', article.url)
        .single();

      let articleId;

      if (existing) {
        console.log(`      → Article already exists in database`);
        articleId = existing.id;
      } else {
        // Save to database
        const { data: newArticle, error } = await supabaseAdmin
          .from('articles')
          .insert({
            title: article.title,
            description: article.description,
            url: article.url,
            image_url: article.urlToImage,
            published_at: article.publishedAt,
            source: article.source,
            entities: enrichedEntities,
            tags: [] // No tags for dynamic articles
          })
          .select()
          .single();

        if (error) {
          console.error(`      ✗ Failed to save article:`, error.message);
          continue;
        }

        articleId = newArticle.id;
        console.log(`      ✓ Saved to database (ID: ${articleId.slice(0, 8)}...)`);
      }

      // Calculate recommendation score
      let score = 0;
      let matchedEntities = [];

      // PRIMARY: Score based on the entity we searched for (WHY we fetched this article)
      const searchedEntityAffinity = entity.affinity;
      score += searchedEntityAffinity;
      matchedEntities.push(entity.name);
      console.log(`      💡 Base score from searched entity "${entity.name}": ${searchedEntityAffinity.toFixed(3)}`);

      // SECONDARY: Bonus points if article entities also match user profile
      let bonusScore = 0;
      enrichedEntities.forEach(ent => {
        // Match with user's read entities
        if (ent.qlooId && userEntities.has(ent.qlooId)) {
          bonusScore += 0.3;
          matchedEntities.push(`${ent.name} (read)`);
          console.log(`      + Bonus 0.3 for user-read entity: ${ent.name}`);
        }
        // Match with other Qloo-predicted affinities
        if (ent.qlooId && affinityMap.has(ent.qlooId)) {
          const affinity = affinityMap.get(ent.qlooId);
          bonusScore += affinity * 0.5; // Half credit for secondary matches
          matchedEntities.push(`${ent.name} (${affinity.toFixed(2)})`);
          console.log(`      + Bonus ${(affinity * 0.5).toFixed(3)} for predicted entity: ${ent.name}`);
        }
      });

      score += bonusScore;
      console.log(`      📊 Total score: ${score.toFixed(3)} (base: ${searchedEntityAffinity.toFixed(3)} + bonus: ${bonusScore.toFixed(3)})`);

      if (score >= 0.93) {
        dynamicRecommendations.push({
          article_id: articleId,
          title: article.title,
          affinity_score: score,
          matched_entities: matchedEntities,
          reason: `Dynamic: Matches your interest in ${entity.name}`
        });
        console.log(`      ✓ Added to recommendations (score: ${score.toFixed(2)})`);
      } else {
        console.log(`      ✗ Score too low (${score.toFixed(2)}), skipping`);
      }
    }
  }

  console.log(`\n📊 Dynamic fetch complete: ${dynamicRecommendations.length} new recommendations`);
  return dynamicRecommendations.slice(0, 10);
}
