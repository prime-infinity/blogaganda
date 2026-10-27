import { supabaseAdmin } from '../config/supabase.js';
import { getInsights, getTasteTags, getDemographics, findAudiences } from './qloo.js';

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

    if (!history || history.length < 2) {
      console.log(`⚠️ User ${userId} needs more articles (has ${history?.length || 0}, needs 2+)`);
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
    const [personInsights, brandInsights, placeInsights, movieInsights, tvInsights, demographics, audiences, tasteTags] = await Promise.all([
      getInsights(uniqueEntities, 'urn:entity:person', { limit: 20 }),     // Celebrities, actors, chefs
      getInsights(uniqueEntities, 'urn:entity:brand', { limit: 20 }),      // Fashion, luxury, restaurants
      getInsights(uniqueEntities, 'urn:entity:place', { limit: 20 }),      // Venues, destinations
      getInsights(uniqueEntities, 'urn:entity:movie', { limit: 15 }),      // Films
      getInsights(uniqueEntities, 'urn:entity:tv_show', { limit: 15 }),    // TV/streaming
      getDemographics(uniqueEntities),                                      // Age/gender predictions
      findAudiences(uniqueEntities, 10),                                    // Cultural segments
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
      
      // Find highest age affinity
      const ageScores = demoData.age || {};
      const topAge = Object.entries(ageScores)
        .sort(([, a], [, b]) => b - a)[0];
      
      const ageGroup = topAge ? topAge[0].replace(/_/g, ' ') : 'Unknown';
      const genderSkew = (demoData.gender?.male || 0) > 0 ? 'Male-skewing' : 
                         (demoData.gender?.female || 0) > 0 ? 'Female-skewing' : 'Balanced';
      
      predictedDemographics = {
        ageGroup,
        genderSkew,
        ageAffinities: ageScores,
        genderAffinities: demoData.gender || {}
      };

      console.log(`📊 Demographics: ${ageGroup}, ${genderSkew}`);
    }

    // Process audience segments
    const audienceSegments = audiences?.results?.audiences || [];
    const topAudiences = audienceSegments.slice(0, 5).map(aud => aud.name);
    if (topAudiences.length > 0) {
      console.log(`👥 Audience Segments: ${topAudiences.join(', ')}`);
    }

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

      if (score > 0.3) {
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
