import OpenAI from 'openai';
import dotenv from 'dotenv';

dotenv.config();

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

/**
 * Strip HTML tags from text
 */
function stripHtml(html) {
  return html
    .replace(/<[^>]*>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Extract culturally significant entities from article text using OpenAI
 * Returns: { people: [], brands: [], artists: [], places: [], movies: [], tvShows: [], podcasts: [], books: [] }
 */
export async function extractEntities(text, title = '', description = '') {
  if (!text || text.length < 50) {
    console.log('⚠️ Text too short for extraction');
    return { people: [], brands: [], artists: [], places: [], movies: [], tvShows: [], podcasts: [], books: [] };
  }

  // Strip HTML and combine title + description + content
  const cleanTitle = stripHtml(title);
  const cleanDescription = stripHtml(description);
  const cleanContent = stripHtml(text);
  
  // Build extraction text with priority on title/description
  const extractionText = `Title: ${cleanTitle}\n\nDescription: ${cleanDescription}\n\nContent: ${cleanContent}`.slice(0, 5000);
  
  console.log(`🔍 Extracting entities from: "${cleanTitle.slice(0, 60)}..."`);
  console.log(`📝 Text length: ${extractionText.length} chars`);

  const prompt = `Extract culturally significant entities from this article. Only include widely known, specific entities that match these categories:

1. **Brands**: Companies, products (e.g., "Tesla", "Nike", "iPhone")
2. **Artists**: Musicians, bands (e.g., "Taylor Swift", "The Beatles")
3. **Celebrities/People**: Well-known public figures, actors, athletes (e.g., "Elon Musk", "LeBron James")
4. **Movies**: Film titles (e.g., "Inception", "The Godfather")
5. **TV Shows**: Series names (e.g., "Succession", "Breaking Bad")
6. **Places**: Specific restaurants, hotels, venues, landmarks - NOT just city names (e.g., "Shake Shack", "Eiffel Tower")
7. **Podcasts**: Podcast names (e.g., "The Joe Rogan Experience")
8. **Books**: Book titles (e.g., "1984", "Harry Potter")

Rules:
- Use full, proper names (e.g., "Bill Gates" not "Bill")
- Skip generic mentions, partial names, or context-specific references
- Skip city/country names unless they're specific landmarks or venues
- Only include entities that are culturally recognizable

Article:
${extractionText}

Return a JSON object with arrays for each category. Use these exact keys: brands, artists, people, movies, tvShows, places, podcasts, books`;

  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: 'You are an entity extraction expert. Extract only widely known, culturally significant entities. Return valid JSON only.'
        },
        {
          role: 'user',
          content: prompt
        }
      ],
      response_format: { type: 'json_object' },
      temperature: 0.1,
      max_tokens: 500
    });

    const content = response.choices[0].message.content;
    const entities = JSON.parse(content);

    // Normalize structure and limit results
    const extracted = {
      people: (entities.people || []).slice(0, 3),
      brands: (entities.brands || []).slice(0, 3),
      artists: (entities.artists || []).slice(0, 2),
      places: (entities.places || []).slice(0, 2),
      movies: (entities.movies || []).slice(0, 2),
      tvShows: (entities.tvShows || []).slice(0, 2),
      podcasts: (entities.podcasts || []).slice(0, 1),
      books: (entities.books || []).slice(0, 1)
    };

    const totalCount = Object.values(extracted).reduce((sum, arr) => sum + arr.length, 0);
    console.log(`✅ Extracted ${totalCount} entities:`, 
      Object.entries(extracted)
        .filter(([_, arr]) => arr.length > 0)
        .map(([key, arr]) => `${key}(${arr.length})`)
        .join(', ')
    );

    return extracted;
  } catch (error) {
    console.error('❌ OpenAI extraction failed:', error.message);
    return { people: [], brands: [], artists: [], places: [], movies: [], tvShows: [], podcasts: [], books: [] };
  }
}
