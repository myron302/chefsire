CREATE TABLE IF NOT EXISTS creator_campaigns (
  id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  creator_user_id varchar NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  slug varchar(200) NOT NULL,
  name varchar(160) NOT NULL,
  description text,
  visibility text NOT NULL DEFAULT 'public',
  starts_at timestamp,
  ends_at timestamp,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamp NOT NULL DEFAULT now(),
  updated_at timestamp NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS creator_campaigns_slug_idx ON creator_campaigns (slug);
CREATE UNIQUE INDEX IF NOT EXISTS creator_campaigns_creator_slug_idx ON creator_campaigns (creator_user_id, slug);
CREATE INDEX IF NOT EXISTS creator_campaigns_creator_idx ON creator_campaigns (creator_user_id);
CREATE INDEX IF NOT EXISTS creator_campaigns_visibility_idx ON creator_campaigns (visibility);
CREATE INDEX IF NOT EXISTS creator_campaigns_active_idx ON creator_campaigns (is_active, starts_at, ends_at);
CREATE INDEX IF NOT EXISTS creator_campaigns_creator_updated_at_idx ON creator_campaigns (creator_user_id, updated_at);

CREATE TABLE IF NOT EXISTS creator_campaign_links (
  id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id varchar NOT NULL REFERENCES creator_campaigns(id) ON DELETE CASCADE,
  target_type text NOT NULL,
  target_id varchar(200) NOT NULL,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamp NOT NULL DEFAULT now(),
  CONSTRAINT creator_campaign_links_campaign_target_idx UNIQUE (campaign_id, target_type, target_id)
);

CREATE INDEX IF NOT EXISTS creator_campaign_links_campaign_idx ON creator_campaign_links (campaign_id);
CREATE INDEX IF NOT EXISTS creator_campaign_links_target_idx ON creator_campaign_links (target_type, target_id);
CREATE INDEX IF NOT EXISTS creator_campaign_links_campaign_sort_idx ON creator_campaign_links (campaign_id, sort_order, created_at);

CREATE TABLE IF NOT EXISTS creator_drop_events (
  id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  drop_id varchar NOT NULL REFERENCES creator_drops(id) ON DELETE CASCADE,
  event_type text NOT NULL,
  user_id varchar REFERENCES users(id) ON DELETE SET NULL,
  target_type text,
  target_id varchar(200),
  created_at timestamp NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS creator_drop_events_drop_idx ON creator_drop_events (drop_id);
CREATE INDEX IF NOT EXISTS creator_drop_events_event_type_idx ON creator_drop_events (event_type);
CREATE INDEX IF NOT EXISTS creator_drop_events_drop_event_created_at_idx ON creator_drop_events (drop_id, event_type, created_at);
CREATE INDEX IF NOT EXISTS creator_drop_events_user_idx ON creator_drop_events (user_id);
