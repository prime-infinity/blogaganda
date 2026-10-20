import express from 'express';
import { supabaseAdmin } from '../config/supabase.js';
import { requireAuth } from '../middleware/auth.js';
import { updateUserTasteProfile, generateRecommendations } from '../services/tasteProfile.js';

const router = express.Router();

// Track article read
router.post('/read', requireAuth, async (req, res) => {
  try {
    const { articleId, timeSpent, scrollDepth } = req.body;
    const userId = req.user.userId;

    // Record reading
    const { error } = await supabaseAdmin
      .from('reading_history')
      .insert({
        user_id: userId,
        article_id: articleId,
        time_spent_seconds: timeSpent || 0,
        scroll_depth_percent: scrollDepth || 0
      });

    if (error && error.code !== '23505') { // Ignore duplicate key errors
      throw error;
    }

    // Update taste profile
    const profile = await updateUserTasteProfile(userId);

    // Generate new recommendations
    if (profile) {
      await generateRecommendations(userId);
    }

    res.json({ success: true, profile });
  } catch (error) {
    console.error('Track read error:', error);
    res.status(500).json({ error: 'Failed to track reading' });
  }
});

// Get user's taste profile
router.get('/profile', requireAuth, async (req, res) => {
  try {
    const userId = req.user.userId;

    const { data: profile, error } = await supabaseAdmin
      .from('user_taste_profiles')
      .select('*')
      .eq('user_id', userId)
      .single();

    if (error && error.code !== 'PGRST116') { // Not found is ok
      throw error;
    }

    res.json({ profile: profile || null });
  } catch (error) {
    console.error('Get profile error:', error);
    res.status(500).json({ error: 'Failed to fetch profile' });
  }
});

// Get user's reading history
router.get('/history', requireAuth, async (req, res) => {
  try {
    const userId = req.user.userId;

    const { data: history, error } = await supabaseAdmin
      .from('reading_history')
      .select(`
        *,
        articles (
          id,
          title,
          description,
          image_url,
          published_at
        )
      `)
      .eq('user_id', userId)
      .order('read_at', { ascending: false });

    if (error) throw error;

    res.json({ history });
  } catch (error) {
    console.error('Get history error:', error);
    res.status(500).json({ error: 'Failed to fetch history' });
  }
});

// Get recommendations for user
router.get('/recommendations', requireAuth, async (req, res) => {
  try {
    const userId = req.user.userId;

    const { data: recommendations, error } = await supabaseAdmin
      .from('article_recommendations')
      .select(`
        *,
        articles (
          id,
          title,
          description,
          image_url,
          published_at,
          source
        )
      `)
      .eq('user_id', userId)
      .order('affinity_score', { ascending: false })
      .limit(10);

    if (error) throw error;

    res.json({ recommendations: recommendations || [] });
  } catch (error) {
    console.error('Get recommendations error:', error);
    res.status(500).json({ error: 'Failed to fetch recommendations' });
  }
});

export default router;
