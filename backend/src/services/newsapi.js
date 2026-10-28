import fetch from 'node-fetch';
import dotenv from 'dotenv';

dotenv.config();

const NEWS_API_KEY = process.env.NEWS_API_KEY;
const NEWS_DATA_API_KEY = process.env.NEWS_DATA_API_KEY;
const NEWS_API_URL = 'https://newsapi.org/v2';
const NEWS_DATA_URL = 'https://newsdata.io/api/1';

// Track which API to use (alternating with 2:1 ratio for NewsData:NewsAPI)
let requestCounter = 0;

// ⚙️ CHANGE THIS BEFORE EACH SEED RUN (1-5)
const DATE_PERIOD = 1;

/**
 * Get date range for specified period (all within last 30 days for free tier)
 * Period 1: Days 0-6 (last week)
 * Period 2: Days 7-13
 * Period 3: Days 14-20
 * Period 4: Days 21-27
 * Period 5: Days 28-30
 */
function getDateRange(period) {
  const now = new Date();
  const dateRanges = {
    1: { from: 6, to: 0 },       // Last 7 days
    2: { from: 13, to: 7 },      // 7-13 days ago
    3: { from: 20, to: 14 },     // 14-20 days ago
    4: { from: 27, to: 21 },     // 21-27 days ago
    5: { from: 30, to: 28 }      // 28-30 days ago
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

/**
 * Search NewsData.io for articles mentioning specific entities
 */
async function searchNewsDataIO(entityName, limit = 5) {
  const url = `${NEWS_DATA_URL}/latest?apikey=${NEWS_DATA_API_KEY}&qInTitle=${encodeURIComponent(entityName)}&language=en&size=${limit}`;

  console.log(`   🔷 Using NewsData.io API`);

  try {
    const response = await fetch(url);
    if (!response.ok) {
      console.error(`   ❌ NewsData.io failed: ${response.status}`);
      return null;
    }

    const data = await response.json();
    if (data.status !== 'success') {
      console.error(`   ❌ NewsData.io error: ${data.status}`);
      return null;
    }

    const articles = data.results || [];
    console.log(`   Found ${articles.length} articles`);
    
    return articles.map(article => ({
      title: article.title,
      description: article.description,
      url: article.link,
      urlToImage: article.image_url,
      publishedAt: article.pubDate,
      source: article.source_id || 'NewsData',
      content: article.description || article.title // Use description as content for free tier
    }));
  } catch (error) {
    console.error(`   ❌ NewsData.io error:`, error.message);
    return null;
  }
}

/**
 * Search NewsAPI for articles (fallback)
 */
async function searchNewsAPI(entityName, limit = 5) {
  const url = `https://newsapi.org/v2/everything?q="${entityName}"&language=en&sortBy=relevancy&pageSize=${limit}&apiKey=${NEWS_API_KEY}`;

  console.log(`   🔶 Using NewsAPI (fallback)`);

  try {
    const response = await fetch(url);
    if (!response.ok) {
      console.error(`   ❌ NewsAPI failed: ${response.status}`);
      return null;
    }

    const data = await response.json();
    const articles = data.articles || [];
    
    console.log(`   Found ${articles.length} articles`);
    
    return articles.map(article => ({
      title: article.title,
      description: article.description,
      url: article.url,
      urlToImage: article.urlToImage,
      publishedAt: article.publishedAt,
      source: article.source?.name || 'NewsAPI',
      content: article.content
    }));
  } catch (error) {
    console.error(`   ❌ NewsAPI error:`, error.message);
    return null;
  }
}

/**
 * Search for articles using multi-source strategy
 * NewsAPI (100/day, has full content) used as primary
 * NewsData.io (200/day, no content on free tier) as fallback
 */
export async function searchArticlesByEntity(entityName, limit = 5) {
  console.log(`🔍 Searching for: "${entityName}"`);
  
  requestCounter++;
  
  // Prioritize NewsAPI (has full content) for most requests
  const useNewsAPI = requestCounter % 4 !== 0; // 3 out of 4 = 75% NewsAPI
  
  let articles;
  
  if (useNewsAPI) {
    articles = await searchNewsAPI(entityName, limit);
    // Fallback to NewsData if NewsAPI fails
    if (!articles || articles.length === 0) {
      console.log(`   ⚠️ NewsAPI returned nothing, trying NewsData.io...`);
      articles = await searchNewsDataIO(entityName, limit);
    }
  } else {
    articles = await searchNewsDataIO(entityName, limit);
    // Fallback to NewsAPI if NewsData fails
    if (!articles || articles.length === 0) {
      console.log(`   ⚠️ NewsData.io returned nothing, trying NewsAPI...`);
      articles = await searchNewsAPI(entityName, limit);
    }
  }

  if (!articles || articles.length === 0) {
    console.log(`   ❌ No articles found from any source`);
    return [];
  }

  return articles;
}

