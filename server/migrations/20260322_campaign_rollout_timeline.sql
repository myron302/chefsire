CREATE TABLE IF NOT EXISTS creator_campaign_rollout_timeline_events (
  id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id varchar NOT NULL REFERENCES creator_campaigns(id) ON DELETE CASCADE,
  actor_user_id varchar REFERENCES users(id) ON DELETE SET NULL,
  event_type text NOT NULL,
  title varchar(160) NOT NULL,
  message text NOT NULL,
  audience_stage text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  occurred_at timestamp NOT NULL DEFAULT now(),
  created_at timestamp NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS creator_campaign_rollout_timeline_events_campaign_idx
  ON creator_campaign_rollout_timeline_events(campaign_id);

CREATE INDEX IF NOT EXISTS creator_campaign_rollout_timeline_events_event_type_idx
  ON creator_campaign_rollout_timeline_events(event_type);

CREATE INDEX IF NOT EXISTS creator_campaign_rollout_timeline_events_campaign_occurred_at_idx
  ON creator_campaign_rollout_timeline_events(campaign_id, occurred_at);

CREATE INDEX IF NOT EXISTS creator_campaign_rollout_timeline_events_actor_idx
  ON creator_campaign_rollout_timeline_events(actor_user_id);
