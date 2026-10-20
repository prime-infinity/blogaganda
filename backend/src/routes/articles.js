import express from 'express';
import { supabaseAdmin } from '../config/supabase.js';
import { fetchDiverseArticles } from '../services/newsapi.js';
import { extractEntities } from '../services/nlp.js';
import { enrichEntitiesWithQloo } from '../services/qloo.js';
import { requireAuth } from '../middleware/auth.js';

const router = express.Router();

// Seed 100 articles from NewsAPI
router.post('/seed', requireAuth, async (req, res) => {
  try {
    console.log('Fetching 100 articles from NewsAPI...');
    const articles = await fetchDiverseArticles();
    
    console.log(`Fetched ${articles.length} articles, processing...`);
    let totalAdded = 0;
    let totalSkipped = 0;

    for (const article of articles) {
      if (!article.title || !article.url) {
        totalSkipped++;
        continue;
      }

      // Check if article already exists
      const { data: existing } = await supabaseAdmin
        .from('articles')
        .select('id')
        .eq('url', article.url)
        .single();

      if (existing) {
        totalSkipped++;
        continue;
      }

      // Extract entities from content
      const content = `${article.title}. ${article.description || ''} ${article.content || ''}`;
      const extractedEntities = await extractEntities(content);
      const qlooEntities = await enrichEntitiesWithQloo(extractedEntities);
      
      console.log(`✅ ${article.title.slice(0, 60)}... → ${qlooEntities.length} entities`);

      // Insert article
      const { error } = await supabaseAdmin
        .from('articles')
        .insert({
          title: article.title,
          description: article.description,
          content: article.content,
          url: article.url,
          source: article.source?.name,
          author: article.author,
          image_url: article.urlToImage,
          published_at: article.publishedAt,
          entities: qlooEntities,
          tags: []
        });

      if (!error) {
        totalAdded++;
        console.log(`Added: ${article.title}`);
      }
    }

    res.json({ 
      message: `Seeded ${totalAdded} articles (${totalSkipped} skipped/duplicates)`,
      totalAdded,
      totalSkipped
    });
  } catch (error) {
    console.error('Seed error:', error);
    res.status(500).json({ error: 'Failed to seed articles' });
  }
});

// Get all articles
router.get('/', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 20;
    const offset = parseInt(req.query.offset) || 0;

    const { data: articles, error } = await supabaseAdmin
      .from('articles')
      .select('*')
      .order('published_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) throw error;

    res.json({ articles });
  } catch (error) {
    console.error('Get articles error:', error);
    res.status(500).json({ error: 'Failed to fetch articles' });
  }
});

// Get article by ID
router.get('/:id', async (req, res) => {
  try {
    const { data: article, error } = await supabaseAdmin
      .from('articles')
      .select('*')
      .eq('id', req.params.id)
      .single();

    if (error) throw error;
    if (!article) {
      return res.status(404).json({ error: 'Article not found' });
    }

    res.json({ article });
  } catch (error) {
    console.error('Get article error:', error);
    res.status(500).json({ error: 'Failed to fetch article' });
  }
});

export default router;
