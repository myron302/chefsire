-- Fix clubs schema mismatches

-- Add missing columns to challenges table
ALTER TABLE challenges ADD COLUMN IF NOT EXISTS requirements JSONB DEFAULT '[]'::jsonb;
ALTER TABLE challenges ADD COLUMN IF NOT EXISTS rewards JSONB DEFAULT '[]'::jsonb;
ALTER TABLE challenges ADD COLUMN IF NOT EXISTS tier TEXT DEFAULT 'bronze';

-- Add missing columns to challenge_progress table
ALTER TABLE challenge_progress ADD COLUMN IF NOT EXISTS current_progress INTEGER DEFAULT 0;
ALTER TABLE challenge_progress ADD COLUMN IF NOT EXISTS current_streak INTEGER DEFAULT 0;
ALTER TABLE challenge_progress ADD COLUMN IF NOT EXISTS completed_steps JSONB DEFAULT '[]'::jsonb;
ALTER TABLE challenge_progress ADD COLUMN IF NOT EXISTS is_completed BOOLEAN DEFAULT false;
ALTER TABLE challenge_progress ADD COLUMN IF NOT EXISTS started_at TIMESTAMPTZ DEFAULT NOW();

-- Migrate data from old columns to new columns if they exist
UPDATE challenge_progress SET current_progress = progress WHERE current_progress = 0 AND progress > 0;
UPDATE challenge_progress SET is_completed = completed WHERE is_completed = false AND completed = true;
UPDATE challenge_progress SET started_at = created_at WHERE started_at IS NULL;

-- Add missing column to club_posts table
ALTER TABLE club_posts ADD COLUMN IF NOT EXISTS recipe_id VARCHAR REFERENCES recipes(id) ON DELETE SET NULL;

-- Add missing column to badges table
ALTER TABLE badges ADD COLUMN IF NOT EXISTS tier TEXT DEFAULT 'bronze';
