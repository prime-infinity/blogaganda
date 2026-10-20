import fetch from 'node-fetch';
import dotenv from 'dotenv';

dotenv.config();

const NEWS_API_KEY = process.env.NEWS_API_KEY;
const NEWS_API_URL = 'https://newsapi.org/v2';

/**
 * Fetch diverse articles using /everything endpoint
 * Maximizes the 100 requests/day limit
 */
export async function fetchDiverseArticles() {
  const topics = [
    'entertainment OR celebrity OR movies', // Changed to entertainment for better Qloo matches
    'technology OR AI OR software',
    'business OR finance OR startup',
    'health OR wellness OR medicine',
    'science OR research OR space',
    'politics OR government',
    'sports',
    'fashion OR style',
    'travel OR tourism',
    'food OR restaurant'
  ];

  const allArticles = [];
  const articlesPerTopic = 50; // Fetch 50 entertainment articles

  // Just fetch from first topic for testing
  const topic = topics[0];
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
      return [];
    }

    const data = await response.json();
    if (data.articles) {
      allArticles.push(...data.articles);
    }
  } catch (error) {
    console.error(`Error fetching articles for "${topic}":`, error.message);
  }

  return allArticles;
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
