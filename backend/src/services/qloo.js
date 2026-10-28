import fetch from 'node-fetch';
import dotenv from 'dotenv';

dotenv.config();

const QLOO_API_KEY = process.env.QLOO_API_KEY;
const QLOO_BASE_URL = process.env.QLOO_BASE_URL;

/**
 * Search for Qloo entity IDs by name
 */
export async function searchQlooEntities(entityName, types = []) {
  // Skip obviously invalid entities
  if (!entityName || entityName.length < 3 || /[—:]/.test(entityName)) {
    return [];
  }

  const params = new URLSearchParams({
    query: entityName,
    limit: '3'
  });

  // Qloo expects full URN format for types
  if (types.length > 0) {
    const urnTypes = types.map(t => t.startsWith('urn:') ? t : `urn:entity:${t}`);
    params.append('types', urnTypes.join(','));
  }

  try {
    const response = await fetch(`${QLOO_BASE_URL}/search?${params}`, {
      headers: { 'X-Api-Key': QLOO_API_KEY }
    });

    if (!response.ok) {
      // Silently skip 400 errors (invalid entity format)
      if (response.status === 400) return [];
      console.error(`Qloo search failed for "${entityName}":`, response.status);
      return [];
    }

    const data = await response.json();
    return data.results || [];
  } catch (error) {
    // Silently skip network errors
    return [];
  }
}

/**
 * Get demographic predictions for an entity array
 */
export async function getDemographics(entityIds) {
  const params = new URLSearchParams({
    'filter.type': 'urn:demographics'
  });

  // Add entity signals
  if (entityIds && entityIds.length > 0) {
    entityIds.forEach(id => {
      params.append('signal.interests.entities', id);
    });
  }

  const response = await fetch(`${QLOO_BASE_URL}/v2/insights?${params}`, {
    headers: { 'X-Api-Key': QLOO_API_KEY }
  });

  if (!response.ok) {
    console.error('Qloo demographics failed:', response.status);
    return null;
  }

  return await response.json();
}

/**
 * Find audience segments that match entity array
 * Note: /v2/audiences endpoint is deprecated. This function is disabled.
 * Demographics API provides sufficient age/gender data for MVP.
 */
export async function findAudiences(entityIds, limit = 10) {
  // Deprecated endpoint - returning empty result
  return null;
}

/**
 * Get cross-category insights for an entity array
 */
export async function getInsights(entityIds, filterType = 'urn:entity:brand', options = {}) {
  const limit = options.limit || 20;
  
  const params = new URLSearchParams({
    'filter.type': filterType,
    'take': String(limit)  // Qloo uses 'take' parameter, not 'limit'
  });

  // Add entity signals
  if (entityIds && entityIds.length > 0) {
    console.log(`[DEBUG] Qloo ${filterType} with ${entityIds.length} entities: ${entityIds[0]}`);
    entityIds.forEach(id => {
      params.append('signal.interests.entities', id);
    });
  }

  // Add demographic filters if provided
  if (options.demographics) {
    Object.keys(options.demographics).forEach(key => {
      params.append(`signal.demographics.${key}`, options.demographics[key]);
    });
  }

  const response = await fetch(`${QLOO_BASE_URL}/v2/insights?${params}`, {
    headers: { 'X-Api-Key': QLOO_API_KEY }
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error(`Qloo insights failed (${filterType}): ${response.status}`);
    console.error(`   Error: ${errorText.slice(0, 300)}`);
    console.error(`   Entity IDs: ${entityIds.join(', ')}`);
    return null;
  }

  return await response.json();
}

/**
 * Get taste tags for an entity array
 */
export async function getTasteTags(entityIds) {
  const params = new URLSearchParams({
    'filter.type': 'urn:tag',
    'limit': '30'
  });

  entityIds.forEach(id => {
    params.append('signal.interests.entities', id);
  });

  const response = await fetch(`${QLOO_BASE_URL}/v2/insights?${params}`, {
    headers: { 'X-Api-Key': QLOO_API_KEY }
  });

  if (!response.ok) {
    console.error('Qloo taste tags failed:', response.status);
    return [];
  }

  const data = await response.json();
  return data.results?.entities || [];
}

/**
 * Match extracted entities to Qloo IDs
 * Returns array of { name, qlooId, type, category }
 */
export async function enrichEntitiesWithQloo(entities) {
  const enriched = [];

  console.log(`🔎 Enriching with Qloo...`);

  // Map entity categories to Qloo types for entertainment/lifestyle
  const typeMap = {
    people: ['urn:entity:person'],        // Actors, directors, chefs, celebrities
    brands: ['urn:entity:brand'],         // Fashion, luxury, restaurant brands
    places: ['urn:entity:place'],         // Restaurants, hotels, destinations
    movies: ['urn:entity:movie'],         // Films
    tvShows: ['urn:entity:tv_show']       // TV shows, streaming content
  };

  for (const [category, names] of Object.entries(entities)) {
    if (!names || names.length === 0) continue;
    const qlooTypes = typeMap[category] || [];
    
    for (const name of names) {
      if (!name || name.length < 2) continue;
      
      const results = await searchQlooEntities(name, qlooTypes);
      
      if (results.length > 0) {
        enriched.push({
          name: results[0].name || name,
          qlooId: results[0].entity_id,
          type: results[0].subtype || results[0].type,
          category: category
        });
        console.log(`   ✓ ${name} → ${results[0].entity_id}`);
      } else {
        console.log(`   ✗ ${name} (not found in Qloo)`);
      }
      
      // Small delay to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  }

  console.log(`🎯 Enriched ${enriched.length} entities with Qloo IDs\n`);
  return enriched;
}
