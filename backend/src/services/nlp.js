import OpenAI from 'openai';
import dotenv from 'dotenv';

dotenv.config();

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

/**
 * Extract culturally significant entities from article text using OpenAI
 * Returns: { people: [], brands: [], artists: [], places: [], movies: [], tvShows: [], podcasts: [], books: [] }
 */
export async function extractEntities(text) {
  if (!text || text.length < 50) {
    return { people: [], brands: [], artists: [], places: [], movies: [], tvShows: [], podcasts: [], books: [] };
  }

  // Truncate very long articles to save tokens
  const truncatedText = text.slice(0, 3000);

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
${truncatedText}

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
    return {
      people: (entities.people || []).slice(0, 3),
      brands: (entities.brands || []).slice(0, 3),
      artists: (entities.artists || []).slice(0, 2),
      places: (entities.places || []).slice(0, 2),
      movies: (entities.movies || []).slice(0, 2),
      tvShows: (entities.tvShows || []).slice(0, 2),
      podcasts: (entities.podcasts || []).slice(0, 1),
      books: (entities.books || []).slice(0, 1)
    };
  } catch (error) {
    console.error('❌ OpenAI extraction failed:', error.message);
    return { people: [], brands: [], artists: [], places: [], movies: [], tvShows: [], podcasts: [], books: [] };
  }
}
