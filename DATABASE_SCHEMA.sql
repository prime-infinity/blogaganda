-- BLOGAGANDA DATABASE SCHEMA (Supabase/PostgreSQL)

-- Users table
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  username TEXT UNIQUE NOT NULL,
  is_admin BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  last_active TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Articles table
CREATE TABLE articles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT,
  content TEXT,
  url TEXT UNIQUE,
  source TEXT,
  author TEXT,
  image_url TEXT,
  published_at TIMESTAMP WITH TIME ZONE,
  fetched_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  entities JSONB DEFAULT '[]'::jsonb, -- Extracted entities with Qloo IDs
  tags TEXT[] DEFAULT '{}'
);

-- Reading history
CREATE TABLE reading_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  article_id UUID REFERENCES articles(id) ON DELETE CASCADE,
  read_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  time_spent_seconds INTEGER DEFAULT 0,
  scroll_depth_percent INTEGER DEFAULT 0,
  UNIQUE(user_id, article_id)
);

-- User taste profiles (cached Qloo insights)
CREATE TABLE user_taste_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE UNIQUE,
  entity_array JSONB DEFAULT '[]'::jsonb, -- Entities from articles they've read
  qloo_affinities JSONB DEFAULT '{}'::jsonb, -- Cross-category affinities from Qloo
  predicted_demographics JSONB DEFAULT '{}'::jsonb, -- Age, gender, location predictions
  taste_tags TEXT[] DEFAULT '{}', -- Qloo taste tags
  affinity_score DECIMAL(4,3), -- Overall profile strength
  articles_read_count INTEGER DEFAULT 0,
  last_updated TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  profile_evolution JSONB DEFAULT '[]'::jsonb -- Snapshot history for timeline view
);

-- Recommended articles queue (auto-generated)
CREATE TABLE article_recommendations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  article_id UUID REFERENCES articles(id) ON DELETE CASCADE,
  affinity_score DECIMAL(4,3) NOT NULL,
  reason TEXT, -- Why this was recommended
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  shown_at TIMESTAMP WITH TIME ZONE,
  clicked BOOLEAN DEFAULT FALSE,
  UNIQUE(user_id, article_id)
);

-- Indexes for performance
CREATE INDEX idx_reading_history_user ON reading_history(user_id);
CREATE INDEX idx_reading_history_article ON reading_history(article_id);
CREATE INDEX idx_recommendations_user ON article_recommendations(user_id, affinity_score DESC);
CREATE INDEX idx_articles_published ON articles(published_at DESC);
CREATE INDEX idx_user_taste_updated ON user_taste_profiles(last_updated DESC);

-- Row Level Security (RLS) Policies
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE reading_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_taste_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE article_recommendations ENABLE ROW LEVEL SECURITY;

-- Users can only see their own data
CREATE POLICY "Users can view own profile" ON users
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can view own reading history" ON reading_history
  FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Users can view own taste profile" ON user_taste_profiles
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can view own recommendations" ON article_recommendations
  FOR SELECT USING (auth.uid() = user_id);

-- Admins can see everything
CREATE POLICY "Admins can view all users" ON users
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND is_admin = TRUE)
  );

CREATE POLICY "Admins can view all reading history" ON reading_history
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND is_admin = TRUE)
  );

CREATE POLICY "Admins can view all taste profiles" ON user_taste_profiles
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND is_admin = TRUE)
  );

-- Articles are public
ALTER TABLE articles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Articles are viewable by everyone" ON articles
  FOR SELECT USING (TRUE);

-- Function to update taste profile timestamp
CREATE OR REPLACE FUNCTION update_taste_profile_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.last_updated = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_taste_profile_timestamp
BEFORE UPDATE ON user_taste_profiles
FOR EACH ROW
EXECUTE FUNCTION update_taste_profile_timestamp();

-- Add audience_segments column for cultural profiling
ALTER TABLE user_taste_profiles 
ADD COLUMN IF NOT EXISTS audience_segments TEXT[] DEFAULT '{}';
