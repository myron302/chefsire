-- Add active cleanse programs tracking to user_drink_stats
ALTER TABLE user_drink_stats
  ADD COLUMN IF NOT EXISTS active_cleanse_programs jsonb NOT NULL DEFAULT '[]'::jsonb;
