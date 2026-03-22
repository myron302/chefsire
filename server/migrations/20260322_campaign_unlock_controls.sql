ALTER TABLE creator_campaigns
  ADD COLUMN IF NOT EXISTS is_rollout_paused boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS rollout_paused_at timestamp;
