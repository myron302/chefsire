ALTER TABLE creator_campaigns
  ADD COLUMN IF NOT EXISTS rollout_mode text NOT NULL DEFAULT 'public_first',
  ADD COLUMN IF NOT EXISTS starts_with_audience text,
  ADD COLUMN IF NOT EXISTS unlock_followers_at timestamp,
  ADD COLUMN IF NOT EXISTS unlock_public_at timestamp,
  ADD COLUMN IF NOT EXISTS rollout_notes text,
  ADD COLUMN IF NOT EXISTS is_rollout_active boolean NOT NULL DEFAULT false;
