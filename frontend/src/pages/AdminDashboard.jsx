import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { getAdminUsers, getAdminStats, getAdminUserDetail } from '../api/client';
import './AdminDashboard.css';

export default function AdminDashboard() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [users, setUsers] = useState([]);
  const [stats, setStats] = useState(null);
  const [selectedUser, setSelectedUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user?.isAdmin) {
      navigate('/feed');
      return;
    }
    loadData();
  }, [user, navigate]);

  const loadData = async () => {
    try {
      const [usersRes, statsRes] = await Promise.all([
        getAdminUsers(),
        getAdminStats()
      ]);
      setUsers(usersRes.data.users);
      setStats(statsRes.data);
    } catch (error) {
      console.error('Failed to load admin data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleUserClick = async (userId) => {
    try {
      const res = await getAdminUserDetail(userId);
      setSelectedUser(res.data);
    } catch (error) {
      console.error('Failed to load user detail:', error);
    }
  };

  if (loading) {
    return <div className="loading">Loading admin dashboard...</div>;
  }

  return (
    <div className="admin-container">
      <header className="admin-header">
        <h1>🎯 Blogaganda Control Center</h1>
        <div>
          <button onClick={() => navigate('/feed')}>User View</button>
          <button onClick={logout} className="logout-btn">Logout</button>
        </div>
      </header>

      {stats && (
        <div className="stats-grid">
          <div className="stat-card">
            <div className="stat-value">{stats.totalUsers}</div>
            <div className="stat-label">Total Users</div>
          </div>
          <div className="stat-card">
            <div className="stat-value">{stats.profiledUsers}</div>
            <div className="stat-label">Profiled Users</div>
          </div>
          <div className="stat-card">
            <div className="stat-value">{stats.totalArticles}</div>
            <div className="stat-label">Articles</div>
          </div>
          <div className="stat-card">
            <div className="stat-value">{stats.totalReads}</div>
            <div className="stat-label">Total Reads</div>
          </div>
        </div>
      )}

      <div className="admin-content">
        <div className="users-panel">
          <h2>User Profiles</h2>
          <div className="users-list">
            {users.map((u) => (
              <div 
                key={u.id} 
                className={`user-item ${selectedUser?.user.id === u.id ? 'active' : ''}`}
                onClick={() => handleUserClick(u.id)}
              >
                <div className="user-item-header">
                  <strong>{u.username}</strong>
                  {u.user_taste_profiles && (
                    <span className="profile-badge">
                      {u.user_taste_profiles.articles_read_count} reads
                    </span>
                  )}
                </div>
                {u.user_taste_profiles && (
                  <div className="user-item-preview">
                    Affinity: {(u.user_taste_profiles.affinity_score || 0).toFixed(3)}
                    {u.user_taste_profiles.taste_tags?.length > 0 && (
                      <div className="tags-preview">
                        {u.user_taste_profiles.taste_tags.slice(0, 3).join(', ')}
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        <div className="detail-panel">
          {selectedUser ? (
            <>
              <h2>Cultural Profile: {selectedUser.user.username}</h2>
              
              <div className="profile-section">
                <h3>📊 Overview</h3>
                <div className="info-grid">
                  <div>Email: {selectedUser.user.email}</div>
                  <div>Articles Read: {selectedUser.profile?.articles_read_count || 0}</div>
                  <div>Affinity Score: {(selectedUser.profile?.affinity_score || 0).toFixed(3)}</div>
                  {selectedUser.profile?.predicted_demographics && (
                    <>
                      <div>Age Group: {selectedUser.profile.predicted_demographics.ageGroup}</div>
                      <div>Gender: {selectedUser.profile.predicted_demographics.genderSkew}</div>
                    </>
                  )}
                  <div>Last Updated: {selectedUser.profile?.last_updated ? new Date(selectedUser.profile.last_updated).toLocaleDateString() : 'N/A'}</div>
                </div>
              </div>

              {selectedUser.profile?.audience_segments?.length > 0 && (
                <div className="profile-section">
                  <h3>👥 Audience Segments</h3>
                  <div className="tags-display">
                    {selectedUser.profile.audience_segments.map(segment => (
                      <span key={segment} className="tag">{segment}</span>
                    ))}
                  </div>
                </div>
              )}

              {selectedUser.profile && (
                <>
                  <div className="profile-section">
                    <h3>📈 Profile Evolution - Affinity Drift Tracking</h3>
                    {selectedUser.profile.profile_evolution?.length > 0 ? (
                      <div className="evolution-container">
                        <div className="evolution-chart">
                          {selectedUser.profile.profile_evolution.map((snapshot, idx) => {
                            const isLatest = idx === selectedUser.profile.profile_evolution.length - 1;
                            return (
                              <div key={idx} className={`evolution-snapshot ${isLatest ? 'latest' : ''}`}>
                                <div className="snapshot-header">
                                  <span className="snapshot-number">Read #{snapshot.articlesRead}</span>
                                  <span className="snapshot-time">{new Date(snapshot.timestamp).toLocaleString()}</span>
                                </div>
                                <div className="snapshot-affinity">
                                  Affinity: <strong>{snapshot.affinityScore}</strong>
                                  {idx > 0 && (
                                    <span className={`drift ${parseFloat(snapshot.affinityScore) > parseFloat(selectedUser.profile.profile_evolution[idx-1].affinityScore) ? 'up' : 'down'}`}>
                                      {parseFloat(snapshot.affinityScore) > parseFloat(selectedUser.profile.profile_evolution[idx-1].affinityScore) ? '↑' : '↓'}
                                      {Math.abs((parseFloat(snapshot.affinityScore) - parseFloat(selectedUser.profile.profile_evolution[idx-1].affinityScore)) * 100).toFixed(1)}%
                                    </span>
                                  )}
                                </div>
                                <div className="snapshot-brands">
                                  Top Brands: {snapshot.topBrands.join(', ')}
                                </div>
                                {snapshot.topTags?.length > 0 && (
                                  <div className="snapshot-tags">
                                    Tags: {snapshot.topTags.join(', ')}
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                        <div className="evolution-summary">
                          <div className="summary-metric">
                            <span className="metric-label">Total Drift:</span>
                            <span className="metric-value">
                              {((parseFloat(selectedUser.profile.profile_evolution[selectedUser.profile.profile_evolution.length - 1].affinityScore) - 
                                 parseFloat(selectedUser.profile.profile_evolution[0].affinityScore)) * 100).toFixed(1)}%
                            </span>
                          </div>
                          <div className="summary-metric">
                            <span className="metric-label">Engagement Velocity:</span>
                            <span className="metric-value">
                              {selectedUser.profile.profile_evolution.length} updates
                            </span>
                          </div>
                          <div className="summary-metric">
                            <span className="metric-label">Brand Shifts:</span>
                            <span className="metric-value">
                              {new Set(selectedUser.profile.profile_evolution.flatMap(s => s.topBrands)).size} unique brands
                            </span>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="empty">Not enough reading history yet</div>
                    )}
                  </div>

                  <div className="profile-section">
                    <h3>🏷️ Taste Tags</h3>
                    <div className="tags-display">
                      {selectedUser.profile.taste_tags?.length > 0 ? (
                        selectedUser.profile.taste_tags.map(tag => (
                          <span key={tag} className="tag">{tag}</span>
                        ))
                      ) : (
                        <div className="empty">Not enough data yet</div>
                      )}
                    </div>
                  </div>

                  <div className="profile-section">
                    <h3>🎯 Cross-Category Affinities</h3>
                    
                    {selectedUser.profile.qloo_affinities?.brands?.length > 0 && (
                      <div className="affinity-category">
                        <h4>Brands</h4>
                        <div className="entity-list">
                          {selectedUser.profile.qloo_affinities.brands.slice(0, 5).map(brand => (
                            <div key={brand.entity_id} className="entity-item">
                              <span>{brand.name}</span>
                              <span className="affinity-score">{brand.affinity?.toFixed(2)}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {selectedUser.profile.qloo_affinities?.artists?.length > 0 && (
                      <div className="affinity-category">
                        <h4>Artists</h4>
                        <div className="entity-list">
                          {selectedUser.profile.qloo_affinities.artists.slice(0, 5).map(artist => (
                            <div key={artist.entity_id} className="entity-item">
                              <span>{artist.name}</span>
                              <span className="affinity-score">{artist.affinity?.toFixed(2)}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {selectedUser.profile.qloo_affinities?.places?.length > 0 && (
                      <div className="affinity-category">
                        <h4>Places</h4>
                        <div className="entity-list">
                          {selectedUser.profile.qloo_affinities.places.slice(0, 5).map(place => (
                            <div key={place.entity_id} className="entity-item">
                              <span>{place.name}</span>
                              <span className="affinity-score">{place.affinity?.toFixed(2)}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="profile-section">
                    <h3>📈 Targeting Intelligence</h3>
                    <div className="targeting-box">
                      <p><strong>Engagement Strategy:</strong></p>
                      <ul>
                        <li>User shows affinity for {selectedUser.profile.qloo_affinities?.brands?.length || 0} brand categories</li>
                        <li>Cross-cultural interests span {Object.keys(selectedUser.profile.qloo_affinities || {}).length} entity types</li>
                        <li>Profile confidence: {(selectedUser.profile.affinity_score * 100).toFixed(0)}%</li>
                        {selectedUser.profile.taste_tags?.length > 5 && (
                          <li>Highly defined taste profile with {selectedUser.profile.taste_tags.length} tags</li>
                        )}
                      </ul>
                    </div>
                  </div>

                  <div className="profile-section b2b-section">
                    <h3>💰 B2B Revenue Intelligence</h3>
                    
                    <div className="b2b-grid">
                      <div className="b2b-card">
                        <h4>📝 Content Strategy</h4>
                        <p className="b2b-label">Top entities to cover:</p>
                        <ul className="b2b-list">
                          {selectedUser.profile.qloo_affinities?.brands?.slice(0, 3).map(brand => (
                            <li key={brand.entity_id}>
                              <strong>{brand.name}</strong>
                              <span className="virality-score">Affinity: {(brand.query?.affinity * 100).toFixed(0)}%</span>
                            </li>
                          ))}
                        </ul>
                        <p className="b2b-insight">
                          💡 Articles about these brands have {(selectedUser.profile.affinity_score * 100).toFixed(0)}% engagement probability
                        </p>
                      </div>

                      <div className="b2b-card">
                        <h4>🎯 Cultural Targeting</h4>
                        <div className="targeting-profile">
                          <div className="target-row">
                            <span>Demographic:</span>
                            <strong>{selectedUser.profile.predicted_demographics?.ageGroup || 'Unknown'}</strong>
                          </div>
                          <div className="target-row">
                            <span>Gender Skew:</span>
                            <strong>{selectedUser.profile.predicted_demographics?.genderSkew?.split('-')[0] || 'Unknown'}</strong>
                          </div>
                          <div className="target-row">
                            <span>Taste Tags:</span>
                            <strong>{selectedUser.profile.taste_tags?.slice(0, 2).join(', ') || 'Building...'}</strong>
                          </div>
                        </div>
                        <p className="b2b-insight">
                          💡 Target similar users: {selectedUser.profile.predicted_demographics?.ageGroup}, {selectedUser.profile.predicted_demographics?.genderSkew?.split('-')[0]}
                        </p>
                      </div>

                      <div className="b2b-card">
                        <h4>🔮 Virality Prediction</h4>
                        <p className="b2b-label">High-engagement entity clusters:</p>
                        <div className="virality-matrix">
                          {['brands', 'people', 'places'].map(category => {
                            const entities = selectedUser.profile.qloo_affinities?.[category] || [];
                            if (entities.length === 0) return null;
                            const avgAffinity = entities.slice(0, 3).reduce((sum, e) => sum + (e.query?.affinity || 0), 0) / Math.min(3, entities.length);
                            return (
                              <div key={category} className="virality-row">
                                <span className="category-name">{category}:</span>
                                <div className="virality-bar">
                                  <div 
                                    className="virality-fill" 
                                    style={{ width: `${avgAffinity * 100}%` }}
                                  />
                                </div>
                                <span className="virality-pct">{(avgAffinity * 100).toFixed(0)}%</span>
                              </div>
                            );
                          })}
                        </div>
                        <p className="b2b-insight">
                          💡 Cross-category articles combining these entities = higher virality
                        </p>
                      </div>

                      <div className="b2b-card">
                        <h4>💵 Ad Targeting Value</h4>
                        <div className="ad-metrics">
                          <div className="ad-metric">
                            <span className="ad-value">${(selectedUser.profile.affinity_score * 10).toFixed(2)}</span>
                            <span className="ad-label">CPM Value</span>
                          </div>
                          <div className="ad-metric">
                            <span className="ad-value">{selectedUser.profile.qloo_affinities?.brands?.length || 0}</span>
                            <span className="ad-label">Brand Affinities</span>
                          </div>
                          <div className="ad-metric">
                            <span className="ad-value">{selectedUser.profile.articles_read_count || 0}</span>
                            <span className="ad-label">Engagement Rate</span>
                          </div>
                        </div>
                        <p className="b2b-insight">
                          💡 Premium targeting: User matches {selectedUser.profile.qloo_affinities?.brands?.length || 0}+ luxury/lifestyle brands
                        </p>
                      </div>
                    </div>
                  </div>
                </>
              )}

              {selectedUser.recommendations?.length > 0 && (
                <div className="profile-section">
                  <h3>🎁 Next Recommendations</h3>
                  <div className="recs-list">
                    {selectedUser.recommendations.slice(0, 5).map((rec, idx) => (
                      <div key={idx} className="rec-item">
                        <div>{rec.articles.title}</div>
                        <span className="affinity-score">{rec.affinity_score.toFixed(2)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          ) : (
            <div className="empty-detail">
              Select a user to view their cultural profile and targeting intelligence
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
