import fetch from 'node-fetch';
import dotenv from 'dotenv';

dotenv.config();

const NEWS_API_KEY = process.env.NEWS_API_KEY;
const NEWS_API_URL = 'https://newsapi.org/v2';

/**
 * Fetch diverse articles from multiple topics
 */
export async function fetchDiverseArticles(count = 100) {
  const topics = [
    'health OR wellness OR fitness',
    'science OR space OR research',
    'business OR startup OR entrepreneur'
  ];

  const allArticles = [];
  const articlesPerTopic = Math.ceil(count / topics.length);

  for (const topic of topics) {
    try {
      const params = new URLSearchParams({
        apiKey: NEWS_API_KEY,
        q: topic,
        language: 'en',
        sortBy: 'publishedAt',
        pageSize: articlesPerTopic.toString()
      });

      const response = await fetch(`${NEWS_API_URL}/everything?${params}`);
      
      if (!response.ok) {
        console.error(`NewsAPI fetch failed for "${topic}":`, response.status);
        continue;
      }

      const data = await response.json();
      if (data.articles) {
        console.log(`📰 Fetched ${data.articles.length} articles for: ${topic}`);
        allArticles.push(...data.articles);
      }
    } catch (error) {
      console.error(`Error fetching articles for "${topic}":`, error.message);
    }
  }

  return allArticles.slice(0, count);
}

/**
 * Fetch top headlines (alternative lighter approach)
 */
export async function fetchTopHeadlines(country = 'us', pageSize = 100) {
  const params = new URLSearchParams({
    apiKey: NEWS_API_KEY,
    country,
    pageSize: pageSize.toString()
  });

  const response = await fetch(`${NEWS_API_URL}/top-headlines?${params}`);
  
  if (!response.ok) {
    console.error('NewsAPI top headlines failed:', response.status);
    return [];
  }

  const data = await response.json();
  return data.articles || [];
}
