-- Make password column nullable for OAuth users
-- OAuth users don't have passwords, they authenticate through their OAuth provider

ALTER TABLE users ALTER COLUMN password DROP NOT NULL;

-- Add a comment to explain the nullable password
COMMENT ON COLUMN users.password IS 'Hashed password for local auth users. NULL for OAuth-only users (Google, Facebook, TikTok, etc.)';
