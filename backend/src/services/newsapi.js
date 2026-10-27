import fetch from 'node-fetch';
import dotenv from 'dotenv';

dotenv.config();

const NEWS_API_KEY = process.env.NEWS_API_KEY;
const NEWS_API_URL = 'https://newsapi.org/v2';

// ⚙️ CHANGE THIS BEFORE EACH SEED RUN (1-5)
const DATE_PERIOD = 1;

/**
 * Get date range for specified period
 * Period 1: Last 30 days
 * Period 2: 31-60 days ago
 * Period 3: 61-90 days ago
 * Period 4: 91-120 days ago
 * Period 5: 121-150 days ago
 */
function getDateRange(period) {
  const now = new Date();
  const dateRanges = {
    1: { from: 30, to: 0 },      // Last 30 days
    2: { from: 60, to: 31 },     // 31-60 days ago
    3: { from: 90, to: 61 },     // 61-90 days ago
    4: { from: 120, to: 91 },    // 91-120 days ago
    5: { from: 150, to: 121 }    // 121-150 days ago
  };

  const range = dateRanges[period] || dateRanges[1];
  
  const from = new Date(now);
  from.setDate(from.getDate() - range.from);
  
  const to = new Date(now);
  to.setDate(to.getDate() - range.to);

  return {
    from: from.toISOString().split('T')[0],
    to: to.toISOString().split('T')[0]
  };
}

/**
 * Fetch diverse articles from multiple topics
 */
export async function fetchDiverseArticles(count = 100) {
  const dateRange = getDateRange(DATE_PERIOD);
  console.log(`📅 Fetching articles from ${dateRange.from} to ${dateRange.to} (Period ${DATE_PERIOD})`);
  
  const topics = [
    'movies OR television OR celebrities OR Hollywood OR entertainment OR streaming',
    'restaurants OR dining OR travel OR luxury OR fashion OR lifestyle OR hotels'
  ];

  const allArticles = [];
  const articlesPerTopic = 100; // Request 100 per topic, total 200, then slice to count

  for (const topic of topics) {
    try {
      const params = new URLSearchParams({
        apiKey: NEWS_API_KEY,
        q: topic,
        language: 'en',
        sortBy: 'publishedAt',
        pageSize: articlesPerTopic.toString(),
        from: dateRange.from,
        to: dateRange.to
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
