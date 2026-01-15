-- Add household_member_id column to family_members table
ALTER TABLE family_members ADD COLUMN IF NOT EXISTS household_member_id varchar REFERENCES users(id);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS family_members_household_member_idx ON family_members(household_member_id);
