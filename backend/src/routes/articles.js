import express from 'express';
import { supabaseAdmin } from '../config/supabase.js';
import { fetchDiverseArticles } from '../services/newsapi.js';
import { extractEntities } from '../services/nlp.js';
import { enrichEntitiesWithQloo } from '../services/qloo.js';
import { requireAuth } from '../middleware/auth.js';

const router = express.Router();

// Seed articles from NewsAPI
router.post('/seed', requireAuth, async (req, res) => {
  try {
    console.log('\n🌱 SEEDING ARTICLES FROM NEWSAPI...');
    console.log('📰 Fetching 50 articles...');
    const articles = await fetchDiverseArticles(50);
    
    console.log(`\n📦 Fetched ${articles.length} articles, processing...\n`);
    let totalAdded = 0;
    let totalSkipped = 0;
    let noEntitiesSkipped = 0;

    for (const article of articles) {
      if (!article.title || !article.url) {
        console.log(`⏭️  Skipping article (missing title/url)`);
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
        console.log(`⏭️  Skipping "${article.title.slice(0, 50)}..." (duplicate)`);
        totalSkipped++;
        continue;
      }

      // Extract entities with title and description
      const extractedEntities = await extractEntities(
        article.content || '',
        article.title,
        article.description || ''
      );
      
      const qlooEntities = await enrichEntitiesWithQloo(extractedEntities);
      
      // ONLY save articles with entities
      if (qlooEntities.length === 0) {
        console.log(`🚫 Skipping "${article.title.slice(0, 50)}..." (no entities found)\n`);
        noEntitiesSkipped++;
        continue;
      }
      
      console.log(`💾 Saving "${article.title.slice(0, 50)}..." with ${qlooEntities.length} entities`);

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
        console.log(`✅ Added successfully\n`);
      } else {
        console.error(`❌ Failed to save:`, error.message, '\n');
      }
    }

    console.log(`\n✨ SEEDING COMPLETE!`);
    console.log(`   📊 Added: ${totalAdded} articles`);
    console.log(`   ⏭️  Skipped duplicates: ${totalSkipped}`);
    console.log(`   🚫 Skipped no entities: ${noEntitiesSkipped}\n`);

    res.json({ 
      message: `Seeded ${totalAdded} articles with entities`,
      totalAdded,
      totalSkipped,
      noEntitiesSkipped
    });
  } catch (error) {
    console.error('❌ Seed error:', error);
    res.status(500).json({ error: 'Failed to seed articles' });
  }
});

// Get all articles
router.get('/', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 100;
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
