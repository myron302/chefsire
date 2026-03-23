ALTER TABLE creator_campaigns
  ADD COLUMN IF NOT EXISTS applied_playbook_profile_id varchar REFERENCES creator_campaign_playbook_profiles(id) ON DELETE SET NULL;

ALTER TABLE creator_campaigns
  ADD COLUMN IF NOT EXISTS playbook_applied_at timestamp;

CREATE INDEX IF NOT EXISTS creator_campaigns_applied_playbook_idx
  ON creator_campaigns (creator_user_id, applied_playbook_profile_id, playbook_applied_at);
