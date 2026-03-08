CREATE EXTENSION IF NOT EXISTS pgcrypto;

ALTER TABLE meal_plan_entries ADD COLUMN IF NOT EXISTS source VARCHAR(50);

CREATE TABLE IF NOT EXISTS meal_streaks (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id VARCHAR NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  current_streak INTEGER NOT NULL DEFAULT 0,
  longest_streak INTEGER NOT NULL DEFAULT 0,
  last_logged_date DATE,
  updated_at TIMESTAMP DEFAULT NOW()
);
CREATE UNIQUE INDEX IF NOT EXISTS meal_streaks_user_uidx ON meal_streaks(user_id);

CREATE TABLE IF NOT EXISTS body_metrics (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id VARCHAR NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  weight_lbs DECIMAL(8, 2) NOT NULL,
  body_fat_pct DECIMAL(5, 2),
  waist_in DECIMAL(6, 2),
  hip_in DECIMAL(6, 2),
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS meal_favorites (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id VARCHAR NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  meal_name TEXT NOT NULL,
  calories INTEGER,
  protein INTEGER,
  carbs INTEGER,
  fat INTEGER,
  fiber INTEGER,
  is_favorite BOOLEAN DEFAULT false,
  times_logged INTEGER DEFAULT 0,
  last_used TIMESTAMP
);

CREATE TABLE IF NOT EXISTS water_logs (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id VARCHAR NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  glasses_logged INTEGER NOT NULL DEFAULT 0,
  daily_target INTEGER NOT NULL DEFAULT 8,
  updated_at TIMESTAMP DEFAULT NOW()
);
CREATE UNIQUE INDEX IF NOT EXISTS water_logs_user_date_uidx ON water_logs(user_id, date);
