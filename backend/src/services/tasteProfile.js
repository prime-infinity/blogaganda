import { supabaseAdmin } from '../config/supabase.js';
import { getInsights, getTasteTags } from './qloo.js';

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

    // Get cross-category insights from Qloo
    const [brandInsights, placeInsights, artistInsights, movieInsights, tasteTags] = await Promise.all([
      getInsights(uniqueEntities, 'urn:entity:brand', { limit: 15 }),
      getInsights(uniqueEntities, 'urn:entity:place', { limit: 15 }),
      getInsights(uniqueEntities, 'urn:entity:artist', { limit: 15 }),
      getInsights(uniqueEntities, 'urn:entity:movie', { limit: 10 }),
      getTasteTags(uniqueEntities)
    ]);

    // Build affinity profile
    const affinities = {
      brands: brandInsights?.results?.entities || [],
      places: placeInsights?.results?.entities || [],
      artists: artistInsights?.results?.entities || [],
      movies: movieInsights?.results?.entities || [],
      updatedAt: new Date().toISOString()
    };

    // Extract taste tags
    const tags = tasteTags.map(tag => tag.name).filter(Boolean);

    // Calculate overall affinity score (average of top results)
    const allScores = [
      ...(brandInsights?.results?.entities || []).slice(0, 5),
      ...(placeInsights?.results?.entities || []).slice(0, 5),
      ...(artistInsights?.results?.entities || []).slice(0, 5)
    ].map(e => e.affinity || 0);

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
        profile_evolution: evolution,
        last_updated: new Date().toISOString()
      }, {
        onConflict: 'user_id'
      })
      .select()
      .single();

    if (profileError) throw profileError;

    console.log(`✅ Profile updated: ${affinities.brands.length} brands, ${affinities.places.length} places, score ${affinityScore.toFixed(2)}`);

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
    ['brands', 'places', 'artists', 'movies'].forEach(category => {
      profile.qloo_affinities[category]?.forEach(entity => {
        if (entity.entity_id && entity.affinity) {
          affinityMap.set(entity.entity_id, entity.affinity);
        }
      });
    });

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
