CREATE TABLE IF NOT EXISTS meal_plan_likes (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id VARCHAR NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  blueprint_id VARCHAR NOT NULL REFERENCES meal_plan_blueprints(id) ON DELETE CASCADE,
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(user_id, blueprint_id)
);
CREATE INDEX IF NOT EXISTS idx_meal_plan_likes_blueprint ON meal_plan_likes(blueprint_id);
CREATE INDEX IF NOT EXISTS idx_meal_plan_likes_user ON meal_plan_likes(user_id);

CREATE TABLE IF NOT EXISTS meal_plan_saves (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id VARCHAR NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  blueprint_id VARCHAR NOT NULL REFERENCES meal_plan_blueprints(id) ON DELETE CASCADE,
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(user_id, blueprint_id)
);
CREATE INDEX IF NOT EXISTS idx_meal_plan_saves_blueprint ON meal_plan_saves(blueprint_id);
CREATE INDEX IF NOT EXISTS idx_meal_plan_saves_user ON meal_plan_saves(user_id);

CREATE TABLE IF NOT EXISTS meal_plan_comments (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id VARCHAR NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  blueprint_id VARCHAR NOT NULL REFERENCES meal_plan_blueprints(id) ON DELETE CASCADE,
  comment TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  deleted_at TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_meal_plan_comments_blueprint_created ON meal_plan_comments(blueprint_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_meal_plan_comments_user ON meal_plan_comments(user_id);

CREATE TABLE IF NOT EXISTS shared_week_likes (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id VARCHAR NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  public_share_token VARCHAR(80) NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(user_id, public_share_token)
);
CREATE INDEX IF NOT EXISTS idx_shared_week_likes_token ON shared_week_likes(public_share_token);
CREATE INDEX IF NOT EXISTS idx_shared_week_likes_user ON shared_week_likes(user_id);

CREATE TABLE IF NOT EXISTS shared_week_saves (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id VARCHAR NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  public_share_token VARCHAR(80) NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(user_id, public_share_token)
);
CREATE INDEX IF NOT EXISTS idx_shared_week_saves_token ON shared_week_saves(public_share_token);
CREATE INDEX IF NOT EXISTS idx_shared_week_saves_user ON shared_week_saves(user_id);

CREATE TABLE IF NOT EXISTS shared_week_comments (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id VARCHAR NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  public_share_token VARCHAR(80) NOT NULL,
  comment TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  deleted_at TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_shared_week_comments_token_created ON shared_week_comments(public_share_token, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_shared_week_comments_user ON shared_week_comments(user_id);

CREATE TABLE IF NOT EXISTS meal_plan_creator_profiles (
  user_id VARCHAR PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  display_title TEXT,
  bio TEXT,
  specialty TEXT,
  avatar_url TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
