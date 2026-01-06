-- Household Pantry Feature Migration
-- Enable shared pantry management for families and roommates

-- Create households table
CREATE TABLE IF NOT EXISTS households (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  invite_code VARCHAR(8) NOT NULL UNIQUE,
  owner_id VARCHAR NOT NULL REFERENCES users(id),
  created_at TIMESTAMP DEFAULT NOW()
);

-- Create household_members table
CREATE TABLE IF NOT EXISTS household_members (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id VARCHAR NOT NULL REFERENCES households(id) ON DELETE CASCADE,
  user_id VARCHAR NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'member',
  joined_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(household_id, user_id)
);

-- Add household_id to pantry_items table
ALTER TABLE pantry_items
ADD COLUMN IF NOT EXISTS household_id VARCHAR REFERENCES households(id) ON DELETE SET NULL;

-- Create indexes
CREATE INDEX IF NOT EXISTS household_members_user_idx ON household_members(user_id);
CREATE INDEX IF NOT EXISTS household_members_household_idx ON household_members(household_id);
CREATE INDEX IF NOT EXISTS pantry_household_idx ON pantry_items(household_id);

-- Comments for documentation
COMMENT ON TABLE households IS 'Shared household groups for family pantry management';
COMMENT ON TABLE household_members IS 'Members of each household with their roles (owner/admin/member)';
COMMENT ON COLUMN pantry_items.household_id IS 'If set, this pantry item is shared with all household members';
COMMENT ON COLUMN households.invite_code IS '8-character code for inviting new members to the household';
