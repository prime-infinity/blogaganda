import { useNavigate } from 'react-router-dom';
import './Instructions.css';

export default function Instructions() {
  const navigate = useNavigate();

  return (
    <div className="instructions-container">
      <div className="instructions-card">
        <h1>🎯 Blogaganda Demo Guide</h1>
        
        <section className="instructions-section">
          <h2>Quick Start</h2>
          <div className="step">
            <strong>1. Login or Create Account</strong>
            <p>Use existing test accounts or create your own:</p>
            <ul>
              <li>Test users: blogger1@blogaganda.com to blogger5@blogaganda.com</li>
              <li>Password: <code>123456</code></li>
              <li>Or create a new account with any email</li>
            </ul>
          </div>

          <div className="step">
            <strong>2. Read Articles (2-3 minimum)</strong>
            <p>Click on articles from the feed. System extracts cultural entities and builds your taste profile in real-time.</p>
          </div>

          <div className="step">
            <strong>3. View Recommendations</strong>
            <p>Personalized recommendations appear based on Qloo's cross-category predictions (scores 0.93+).</p>
          </div>

          <div className="step">
            <strong>4. Admin Dashboard (The Magic)</strong>
            <p>Login as admin to see the full cultural intelligence:</p>
            <ul>
              <li>Email: <code>admin@blogaganda.com</code></li>
              <li>Password: <code>123456</code></li>
            </ul>
          </div>
        </section>

        <section className="instructions-section">
          <h2>What to Look For</h2>
          
          <div className="feature">
            <h3>👤 User Side</h3>
            <ul>
              <li>Read Victoria's Secret article → Get Chanel/Calvin Klein recommendations</li>
              <li>Each read refines your profile (minimum 1 article)</li>
              <li>Dynamic fetching pulls fresh content when needed</li>
            </ul>
          </div>

          <div className="feature">
            <h3>🎯 Admin Dashboard</h3>
            <ul>
              <li><strong>Deep Cultural Profiling:</strong> Demographics, geo-cultural fit</li>
              <li><strong>Profile Evolution:</strong> Watch taste drift over time</li>
              <li><strong>Cross-Category Predictions:</strong> Brands, people, places, movies, TV</li>
              <li><strong>B2B Intelligence:</strong> Content strategy, virality prediction, CPM value</li>
              <li><strong>Geo-Cultural Fit:</strong> Regional affinities (NYC, Paris, London, etc.)</li>
            </ul>
          </div>
        </section>

        <section className="instructions-section highlight">
          <h2>🎯 The Qloo Difference</h2>
          <p><strong>Without Qloo:</strong> "User read fashion article → recommend similar fashion"</p>
          <p><strong>With Qloo:</strong> "User read Victoria's Secret → Qloo predicts 0.96 affinity with Chanel → System fetches Chanel articles → Scores based on predicted engagement"</p>
          <p className="tagline">This is cultural grounding in action.</p>
        </section>

        <button onClick={() => navigate('/login')} className="cta-button">
          Get Started
        </button>
      </div>
    </div>
  );
}
