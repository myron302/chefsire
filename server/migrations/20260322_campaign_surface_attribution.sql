CREATE TABLE IF NOT EXISTS creator_campaign_surface_events (
  id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id varchar NOT NULL REFERENCES creator_campaigns(id) ON DELETE CASCADE,
  event_type text NOT NULL,
  surface text NOT NULL,
  user_id varchar REFERENCES users(id) ON DELETE SET NULL,
  session_key varchar(160),
  metadata jsonb,
  created_at timestamp NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS creator_campaign_surface_events_campaign_idx
  ON creator_campaign_surface_events(campaign_id);

CREATE INDEX IF NOT EXISTS creator_campaign_surface_events_event_type_idx
  ON creator_campaign_surface_events(event_type);

CREATE INDEX IF NOT EXISTS creator_campaign_surface_events_surface_idx
  ON creator_campaign_surface_events(surface);

CREATE INDEX IF NOT EXISTS creator_campaign_surface_events_campaign_surface_event_created_at_idx
  ON creator_campaign_surface_events(campaign_id, surface, event_type, created_at);

CREATE INDEX IF NOT EXISTS creator_campaign_surface_events_user_idx
  ON creator_campaign_surface_events(user_id);

CREATE INDEX IF NOT EXISTS creator_campaign_surface_events_session_idx
  ON creator_campaign_surface_events(session_key);
