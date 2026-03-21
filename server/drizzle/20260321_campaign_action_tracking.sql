CREATE TABLE IF NOT EXISTS creator_campaign_action_states (
  id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id varchar NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  campaign_id varchar NOT NULL REFERENCES creator_campaigns(id) ON DELETE CASCADE,
  action_type text NOT NULL,
  action_key varchar(240) NOT NULL,
  source_key text,
  source_signature text,
  state text NOT NULL DEFAULT 'open',
  snoozed_until timestamp,
  created_at timestamp NOT NULL DEFAULT now(),
  updated_at timestamp NOT NULL DEFAULT now(),
  CONSTRAINT creator_campaign_action_states_user_action_idx UNIQUE (user_id, action_key)
);

CREATE INDEX IF NOT EXISTS creator_campaign_action_states_user_idx
  ON creator_campaign_action_states (user_id);

CREATE INDEX IF NOT EXISTS creator_campaign_action_states_campaign_idx
  ON creator_campaign_action_states (campaign_id);

CREATE INDEX IF NOT EXISTS creator_campaign_action_states_state_idx
  ON creator_campaign_action_states (user_id, state, updated_at DESC);

CREATE INDEX IF NOT EXISTS creator_campaign_action_states_snoozed_idx
  ON creator_campaign_action_states (user_id, snoozed_until);
