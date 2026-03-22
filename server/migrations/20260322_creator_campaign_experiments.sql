CREATE TABLE IF NOT EXISTS creator_campaign_experiments (
  id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id varchar NOT NULL REFERENCES creator_campaigns(id) ON DELETE CASCADE,
  experiment_type text NOT NULL,
  label varchar(160),
  hypothesis text,
  started_at timestamp,
  ended_at timestamp,
  status text NOT NULL DEFAULT 'active',
  created_at timestamp NOT NULL DEFAULT now(),
  updated_at timestamp NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS creator_campaign_experiments_campaign_idx
  ON creator_campaign_experiments(campaign_id);

CREATE INDEX IF NOT EXISTS creator_campaign_experiments_status_idx
  ON creator_campaign_experiments(status);

CREATE INDEX IF NOT EXISTS creator_campaign_experiments_campaign_status_updated_at_idx
  ON creator_campaign_experiments(campaign_id, status, updated_at);

CREATE INDEX IF NOT EXISTS creator_campaign_experiments_campaign_started_at_idx
  ON creator_campaign_experiments(campaign_id, started_at);
