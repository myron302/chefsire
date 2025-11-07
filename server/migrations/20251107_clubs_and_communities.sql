-- Create clubs and communities tables
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Clubs table
CREATE TABLE IF NOT EXISTS clubs (
  id            VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  creator_id    VARCHAR NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name          TEXT NOT NULL,
  description   TEXT NULL,
  category      TEXT DEFAULT 'general',
  rules         TEXT NULL,
  cover_image   TEXT NULL,
  is_public     BOOLEAN DEFAULT true,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Club memberships table
CREATE TABLE IF NOT EXISTS club_memberships (
  id         VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id    VARCHAR NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,
  user_id    VARCHAR NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role       TEXT DEFAULT 'member',
  joined_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Club posts table
CREATE TABLE IF NOT EXISTS club_posts (
  id             VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id        VARCHAR NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,
  user_id        VARCHAR NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  content        TEXT NOT NULL,
  image_url      TEXT NULL,
  likes_count    INTEGER DEFAULT 0,
  comments_count INTEGER DEFAULT 0,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Challenges table
CREATE TABLE IF NOT EXISTS challenges (
  id          VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id     VARCHAR NULL REFERENCES clubs(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  description TEXT NULL,
  goal        TEXT NOT NULL,
  start_date  TIMESTAMPTZ NOT NULL,
  end_date    TIMESTAMPTZ NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Challenge progress table
CREATE TABLE IF NOT EXISTS challenge_progress (
  id            VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  challenge_id  VARCHAR NOT NULL REFERENCES challenges(id) ON DELETE CASCADE,
  user_id       VARCHAR NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  progress      INTEGER DEFAULT 0,
  completed     BOOLEAN DEFAULT false,
  completed_at  TIMESTAMPTZ NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Badges table
CREATE TABLE IF NOT EXISTS badges (
  id          VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT NOT NULL UNIQUE,
  description TEXT NULL,
  icon        TEXT NULL,
  rarity      TEXT DEFAULT 'common',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- User badges table
CREATE TABLE IF NOT EXISTS user_badges (
  id        VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id   VARCHAR NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  badge_id  VARCHAR NOT NULL REFERENCES badges(id) ON DELETE CASCADE,
  earned_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS clubs_creator_idx ON clubs (creator_id);
CREATE INDEX IF NOT EXISTS clubs_category_idx ON clubs (category);
CREATE INDEX IF NOT EXISTS club_memberships_club_user_idx ON club_memberships (club_id, user_id);
CREATE INDEX IF NOT EXISTS club_posts_club_idx ON club_posts (club_id);
CREATE INDEX IF NOT EXISTS club_posts_user_idx ON club_posts (user_id);
CREATE INDEX IF NOT EXISTS challenges_club_idx ON challenges (club_id);
CREATE INDEX IF NOT EXISTS challenge_progress_challenge_user_idx ON challenge_progress (challenge_id, user_id);
CREATE INDEX IF NOT EXISTS user_badges_user_badge_idx ON user_badges (user_id, badge_id);
