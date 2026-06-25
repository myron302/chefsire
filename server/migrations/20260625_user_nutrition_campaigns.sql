CREATE TABLE IF NOT EXISTS user_nutrition_campaigns (
  id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id varchar NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  campaign_id text NOT NULL,
  status text NOT NULL CHECK (status IN ('saved', 'active', 'completed')),
  created_at timestamp NOT NULL DEFAULT NOW(),
  updated_at timestamp NOT NULL DEFAULT NOW(),
  started_at timestamp
);

CREATE UNIQUE INDEX IF NOT EXISTS user_nutrition_campaigns_user_campaign_status_idx
  ON user_nutrition_campaigns(user_id, campaign_id, status);

CREATE INDEX IF NOT EXISTS user_nutrition_campaigns_user_status_updated_idx
  ON user_nutrition_campaigns(user_id, status, updated_at DESC);

CREATE INDEX IF NOT EXISTS user_nutrition_campaigns_user_started_idx
  ON user_nutrition_campaigns(user_id, started_at DESC)
  WHERE status = 'active';
