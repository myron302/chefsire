-- Add new user profile fields
-- These fields were added to support enhanced user profiles with privacy controls

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS first_name TEXT NULL,
  ADD COLUMN IF NOT EXISTS last_name TEXT NULL,
  ADD COLUMN IF NOT EXISTS royal_title TEXT NULL,
  ADD COLUMN IF NOT EXISTS show_full_name BOOLEAN DEFAULT FALSE;

-- Add comment for documentation
COMMENT ON COLUMN users.first_name IS 'User first name (optional)';
COMMENT ON COLUMN users.last_name IS 'User last name (optional)';
COMMENT ON COLUMN users.royal_title IS 'Royal title selected during signup (e.g., King, Queen, Knight)';
COMMENT ON COLUMN users.show_full_name IS 'Whether to display full name on public profile';
