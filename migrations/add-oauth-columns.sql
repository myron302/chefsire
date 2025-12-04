-- Add OAuth columns to users table
ALTER TABLE users ADD COLUMN IF NOT EXISTS google_id TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS facebook_id TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS instagram_id TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS tiktok_id TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS provider TEXT;

-- Add indexes for OAuth lookups
CREATE INDEX IF NOT EXISTS google_id_idx ON users(google_id);
CREATE INDEX IF NOT EXISTS facebook_id_idx ON users(facebook_id);
CREATE INDEX IF NOT EXISTS instagram_id_idx ON users(instagram_id);
CREATE INDEX IF NOT EXISTS tiktok_id_idx ON users(tiktok_id);

-- Verify the columns were added
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'users'
AND column_name IN ('google_id', 'facebook_id', 'instagram_id', 'tiktok_id', 'provider');
