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
                  <div>Last Updated: {selectedUser.profile?.last_updated ? new Date(selectedUser.profile.last_updated).toLocaleDateString() : 'N/A'}</div>
                </div>
              </div>

              {selectedUser.profile && (
                <>
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
