-- Add is_running_low column to pantry_items table
ALTER TABLE pantry_items ADD COLUMN IF NOT EXISTS is_running_low BOOLEAN DEFAULT false;
