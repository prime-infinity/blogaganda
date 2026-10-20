import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { getArticles, getRecommendations, trackRead, getUserProfile } from '../api/client';
import './Feed.css';

export default function Feed() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [articles, setArticles] = useState([]);
  const [recommendations, setRecommendations] = useState([]);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState('all'); // 'all' | 'recommended'

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [articlesRes, recsRes, profileRes] = await Promise.all([
        getArticles(50),
        getRecommendations(),
        getUserProfile()
      ]);
      setArticles(articlesRes.data.articles);
      setRecommendations(recsRes.data.recommendations);
      setProfile(profileRes.data.profile);
    } catch (error) {
      console.error('Failed to load data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleReadArticle = async (articleId) => {
    try {
      await trackRead(articleId, 30, 80);
      await loadData(); // Reload to get updated profile/recommendations
    } catch (error) {
      console.error('Failed to track read:', error);
    }
  };

  const displayArticles = view === 'recommended' 
    ? recommendations.map(r => ({ ...r.articles, reason: r.reason, affinity_score: r.affinity_score }))
    : articles;

  if (loading) {
    return <div className="loading">Loading your personalized feed...</div>;
  }

  return (
    <div className="feed-container">
      <header className="feed-header">
        <h1>Blogaganda</h1>
        <div className="header-actions">
          <span className="username">@{user?.username}</span>
          {profile && (
            <span className="affinity-badge">
              Affinity: {(profile.affinity_score || 0).toFixed(2)}
            </span>
          )}
          <button onClick={() => navigate('/profile')}>My Taste</button>
          {user?.isAdmin && (
            <button onClick={() => navigate('/admin')} className="admin-btn">Admin</button>
          )}
          <button onClick={logout} className="logout-btn">Logout</button>
        </div>
      </header>

      <div className="feed-tabs">
        <button 
          className={view === 'all' ? 'active' : ''} 
          onClick={() => setView('all')}
        >
          All News
        </button>
        <button 
          className={view === 'recommended' ? 'active' : ''} 
          onClick={() => setView('recommended')}
        >
          Recommended for You {recommendations.length > 0 && `(${recommendations.length})`}
        </button>
      </div>

      {profile && profile.articles_read_count < 2 && (
        <div className="onboarding-banner">
          📊 Read {2 - profile.articles_read_count} more article{2 - profile.articles_read_count > 1 ? 's' : ''} to unlock your cultural profile!
        </div>
      )}

      <div className="articles-grid">
        {displayArticles.length === 0 ? (
          <div className="empty-state">
            {view === 'recommended' 
              ? 'Read a few articles to get personalized recommendations!'
              : 'No articles available'}
          </div>
        ) : (
          displayArticles.map((article) => (
            <article key={article.id} className="article-card">
              {article.image_url && (
                <img src={article.image_url} alt={article.title} className="article-image" />
              )}
              <div className="article-content">
                <h3>{article.title}</h3>
                <p className="article-description">{article.description}</p>
                {article.reason && (
                  <div className="recommendation-reason">
                    🎯 {article.reason} • Affinity: {article.affinity_score.toFixed(2)}
                  </div>
                )}
                <div className="article-meta">
                  <span className="source">{article.source}</span>
                  <button 
                    onClick={() => handleReadArticle(article.id)}
                    className="read-btn"
                  >
                    Mark as Read
                  </button>
                </div>
              </div>
            </article>
          ))
        )}
      </div>
    </div>
  );
}
