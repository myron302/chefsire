CREATE TABLE IF NOT EXISTS creator_campaign_goals (
  id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id varchar NOT NULL REFERENCES creator_campaigns(id) ON DELETE CASCADE,
  goal_type text NOT NULL,
  target_value integer NOT NULL,
  label varchar(160),
  created_at timestamp NOT NULL DEFAULT now(),
  updated_at timestamp NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS creator_campaign_goals_campaign_idx ON creator_campaign_goals (campaign_id);
CREATE INDEX IF NOT EXISTS creator_campaign_goals_campaign_type_idx ON creator_campaign_goals (campaign_id, goal_type);
CREATE INDEX IF NOT EXISTS creator_campaign_goals_campaign_updated_at_idx ON creator_campaign_goals (campaign_id, updated_at);
