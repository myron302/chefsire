CREATE TABLE IF NOT EXISTS creator_campaign_follows (
  id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id varchar NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  campaign_id varchar NOT NULL REFERENCES creator_campaigns(id) ON DELETE CASCADE,
  created_at timestamp NOT NULL DEFAULT now(),
  CONSTRAINT creator_campaign_follows_user_campaign_idx UNIQUE (user_id, campaign_id)
);

CREATE INDEX IF NOT EXISTS creator_campaign_follows_user_idx ON creator_campaign_follows (user_id);
CREATE INDEX IF NOT EXISTS creator_campaign_follows_campaign_idx ON creator_campaign_follows (campaign_id);
CREATE INDEX IF NOT EXISTS creator_campaign_follows_campaign_created_at_idx ON creator_campaign_follows (campaign_id, created_at);
