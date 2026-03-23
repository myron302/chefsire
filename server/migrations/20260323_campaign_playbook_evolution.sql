ALTER TABLE creator_campaign_playbook_profiles
  ADD COLUMN IF NOT EXISTS parent_playbook_profile_id varchar REFERENCES creator_campaign_playbook_profiles(id) ON DELETE SET NULL;

ALTER TABLE creator_campaign_playbook_profiles
  ADD COLUMN IF NOT EXISTS source_campaign_id varchar REFERENCES creator_campaigns(id) ON DELETE SET NULL;

ALTER TABLE creator_campaign_playbook_profiles
  ADD COLUMN IF NOT EXISTS derived_from_type text;

ALTER TABLE creator_campaign_playbook_profiles
  ADD COLUMN IF NOT EXISTS version_label varchar(80);

CREATE INDEX IF NOT EXISTS creator_campaign_playbook_profiles_parent_idx
  ON creator_campaign_playbook_profiles(parent_playbook_profile_id);

CREATE INDEX IF NOT EXISTS creator_campaign_playbook_profiles_source_campaign_idx
  ON creator_campaign_playbook_profiles(source_campaign_id);
