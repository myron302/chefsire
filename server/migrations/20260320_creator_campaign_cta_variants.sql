CREATE TABLE IF NOT EXISTS creator_campaign_cta_variants (
  id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id varchar NOT NULL REFERENCES creator_campaigns(id) ON DELETE CASCADE,
  label varchar(120) NOT NULL,
  headline varchar(160),
  subheadline text,
  cta_text varchar(120) NOT NULL,
  cta_target_type text NOT NULL DEFAULT 'follow',
  is_active boolean NOT NULL DEFAULT false,
  created_at timestamp NOT NULL DEFAULT now(),
  updated_at timestamp NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS creator_campaign_cta_variants_campaign_idx ON creator_campaign_cta_variants (campaign_id);
CREATE INDEX IF NOT EXISTS creator_campaign_cta_variants_campaign_active_idx ON creator_campaign_cta_variants (campaign_id, is_active, updated_at);

CREATE TABLE IF NOT EXISTS creator_campaign_variant_events (
  id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id varchar NOT NULL REFERENCES creator_campaigns(id) ON DELETE CASCADE,
  variant_id varchar NOT NULL REFERENCES creator_campaign_cta_variants(id) ON DELETE CASCADE,
  event_type text NOT NULL,
  user_id varchar REFERENCES users(id) ON DELETE SET NULL,
  session_key varchar(160),
  metadata jsonb,
  created_at timestamp NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS creator_campaign_variant_events_campaign_idx ON creator_campaign_variant_events (campaign_id);
CREATE INDEX IF NOT EXISTS creator_campaign_variant_events_variant_idx ON creator_campaign_variant_events (variant_id);
CREATE INDEX IF NOT EXISTS creator_campaign_variant_events_event_type_idx ON creator_campaign_variant_events (event_type);
CREATE INDEX IF NOT EXISTS creator_campaign_variant_events_variant_event_created_at_idx ON creator_campaign_variant_events (variant_id, event_type, created_at);
CREATE INDEX IF NOT EXISTS creator_campaign_variant_events_user_idx ON creator_campaign_variant_events (user_id);
CREATE INDEX IF NOT EXISTS creator_campaign_variant_events_session_idx ON creator_campaign_variant_events (session_key);
