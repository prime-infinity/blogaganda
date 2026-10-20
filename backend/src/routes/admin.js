import express from 'express';
import { supabaseAdmin } from '../config/supabase.js';
import { requireAuth, requireAdmin } from '../middleware/auth.js';

const router = express.Router();

// Get all users with their taste profiles
router.get('/users', requireAuth, requireAdmin, async (req, res) => {
  try {
    const { data: users, error } = await supabaseAdmin
      .from('users')
      .select(`
        id,
        email,
        username,
        created_at,
        last_active,
        user_taste_profiles (
          articles_read_count,
          taste_tags,
          affinity_score,
          qloo_affinities,
          profile_evolution,
          last_updated
        )
      `)
      .eq('is_admin', false)
      .order('last_active', { ascending: false });

    if (error) throw error;

    res.json({ users: users || [] });
  } catch (error) {
    console.error('Get users error:', error);
    res.status(500).json({ error: 'Failed to fetch users' });
  }
});

// Get detailed profile for a specific user
router.get('/users/:userId', requireAuth, requireAdmin, async (req, res) => {
  try {
    const { userId } = req.params;

    // Get user info
    const { data: user, error: userError } = await supabaseAdmin
      .from('users')
      .select('id, email, username, created_at, last_active')
      .eq('id', userId)
      .single();

    if (userError) throw userError;

    // Get taste profile
    const { data: profile, error: profileError } = await supabaseAdmin
      .from('user_taste_profiles')
      .select('*')
      .eq('user_id', userId)
      .single();

    if (profileError && profileError.code !== 'PGRST116') {
      throw profileError;
    }

    // Get reading history
    const { data: history, error: historyError } = await supabaseAdmin
      .from('reading_history')
      .select(`
        read_at,
        articles (
          title,
          tags
        )
      `)
      .eq('user_id', userId)
      .order('read_at', { ascending: false });

    if (historyError) throw historyError;

    // Get recommendations
    const { data: recommendations, error: recError } = await supabaseAdmin
      .from('article_recommendations')
      .select(`
        affinity_score,
        reason,
        articles (
          title
        )
      `)
      .eq('user_id', userId)
      .order('affinity_score', { ascending: false })
      .limit(10);

    if (recError) throw recError;

    res.json({
      user,
      profile: profile || null,
      readingHistory: history || [],
      recommendations: recommendations || []
    });
  } catch (error) {
    console.error('Get user detail error:', error);
    res.status(500).json({ error: 'Failed to fetch user details' });
  }
});

// Get platform statistics
router.get('/stats', requireAuth, requireAdmin, async (req, res) => {
  try {
    // Total users
    const { count: totalUsers } = await supabaseAdmin
      .from('users')
      .select('*', { count: 'exact', head: true })
      .eq('is_admin', false);

    // Total articles
    const { count: totalArticles } = await supabaseAdmin
      .from('articles')
      .select('*', { count: 'exact', head: true });

    // Total reads
    const { count: totalReads } = await supabaseAdmin
      .from('reading_history')
      .select('*', { count: 'exact', head: true });

    // Users with profiles
    const { count: profiledUsers } = await supabaseAdmin
      .from('user_taste_profiles')
      .select('*', { count: 'exact', head: true });

    res.json({
      totalUsers: totalUsers || 0,
      totalArticles: totalArticles || 0,
      totalReads: totalReads || 0,
      profiledUsers: profiledUsers || 0
    });
  } catch (error) {
    console.error('Get stats error:', error);
    res.status(500).json({ error: 'Failed to fetch statistics' });
  }
});

export default router;
