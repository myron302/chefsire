-- Add OAuth columns for Facebook, Instagram, and TikTok
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS facebook_id TEXT NULL,
  ADD COLUMN IF NOT EXISTS instagram_id TEXT NULL,
  ADD COLUMN IF NOT EXISTS tiktok_id TEXT NULL;

-- Add indexes for OAuth ID lookups
CREATE INDEX IF NOT EXISTS facebook_id_idx ON users (facebook_id);
CREATE INDEX IF NOT EXISTS instagram_id_idx ON users (instagram_id);
CREATE INDEX IF NOT EXISTS tiktok_id_idx ON users (tiktok_id);

-- Update provider column comment to include new providers
COMMENT ON COLUMN users.provider IS 'OAuth provider: local, google, facebook, instagram, tiktok';
