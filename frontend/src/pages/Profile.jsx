import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { getUserProfile, getReadingHistory } from '../api/client';
import './Profile.css';

export default function Profile() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [profile, setProfile] = useState(null);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [profileRes, historyRes] = await Promise.all([
        getUserProfile(),
        getReadingHistory()
      ]);
      setProfile(profileRes.data.profile);
      setHistory(historyRes.data.history);
    } catch (error) {
      console.error('Failed to load profile:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <div className="loading">Loading your profile...</div>;
  }

  if (!profile) {
    return (
      <div className="profile-container">
        <button onClick={() => navigate('/feed')} className="back-btn">← Back to Feed</button>
        <div className="empty-profile">
          <h2>Building Your Profile...</h2>
          <p>Read more articles to unlock your cultural intelligence profile!</p>
        </div>
      </div>
    );
  }

  return (
    <div className="profile-container">
      <button onClick={() => navigate('/feed')} className="back-btn">← Back to Feed</button>
      
      <div className="profile-header">
        <h1>Your Cultural Profile</h1>
        <div className="profile-stats">
          <div className="stat">
            <span className="stat-value">{profile.articles_read_count}</span>
            <span className="stat-label">Articles Read</span>
          </div>
          <div className="stat">
            <span className="stat-value">{(profile.affinity_score || 0).toFixed(2)}</span>
            <span className="stat-label">Affinity Score</span>
          </div>
          {profile.predicted_demographics && (
            <div className="stat">
              <span className="stat-value">{profile.predicted_demographics.ageGroup}</span>
              <span className="stat-label">Predicted Age</span>
            </div>
          )}
        </div>
      </div>

      {profile.audience_segments && profile.audience_segments.length > 0 && (
        <section className="profile-section">
          <h2>👥 Your Audience Segments</h2>
          <div className="tags-grid">
            {profile.audience_segments.map(segment => (
              <span key={segment} className="taste-tag">{segment}</span>
            ))}
          </div>
        </section>
      )}

      {profile.taste_tags && profile.taste_tags.length > 0 && (
        <section className="profile-section">
          <h2>🏷️ Your Taste Tags</h2>
          <div className="tags-grid">
            {profile.taste_tags.map(tag => (
              <span key={tag} className="taste-tag">{tag}</span>
            ))}
          </div>
        </section>
      )}

      {profile.qloo_affinities?.brands?.length > 0 && (
        <section className="profile-section">
          <h2>🏢 Brand Affinities</h2>
          <div className="affinity-grid">
            {profile.qloo_affinities.brands.slice(0, 10).map(brand => (
              <div key={brand.entity_id} className="affinity-card">
                <span className="affinity-name">{brand.name}</span>
                <span className="affinity-value">{brand.affinity?.toFixed(2)}</span>
              </div>
            ))}
          </div>
        </section>
      )}

      {profile.qloo_affinities?.artists?.length > 0 && (
        <section className="profile-section">
          <h2>🎵 Artist Affinities</h2>
          <div className="affinity-grid">
            {profile.qloo_affinities.artists.slice(0, 10).map(artist => (
              <div key={artist.entity_id} className="affinity-card">
                <span className="affinity-name">{artist.name}</span>
                <span className="affinity-value">{artist.affinity?.toFixed(2)}</span>
              </div>
            ))}
          </div>
        </section>
      )}

      <section className="profile-section">
        <h2>📚 Reading History</h2>
        <div className="history-list">
          {history.map(item => (
            <div key={item.id} className="history-item">
              <div>{item.articles.title}</div>
              <div className="history-date">{new Date(item.read_at).toLocaleDateString()}</div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
