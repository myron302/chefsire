-- Cleanup script for Phase 2 migration
-- This drops all Phase 2 tables so we can run the migration fresh
-- Run this BEFORE running the 0002_phase2_social_explosion.sql migration

-- Drop tables in reverse order to avoid foreign key constraint errors
DROP TABLE IF EXISTS "competition_judges" CASCADE;
DROP TABLE IF EXISTS "competition_votes" CASCADE;
DROP TABLE IF EXISTS "competition_entries" CASCADE;
DROP TABLE IF EXISTS "competitions" CASCADE;
DROP TABLE IF EXISTS "event_leaderboard" CASCADE;
DROP TABLE IF EXISTS "event_participants" CASCADE;
DROP TABLE IF EXISTS "seasonal_events" CASCADE;
DROP TABLE IF EXISTS "cook_together_participants" CASCADE;
DROP TABLE IF EXISTS "cook_together_sessions" CASCADE;
DROP TABLE IF EXISTS "recipe_duets" CASCADE;

-- Confirm cleanup
SELECT 'Phase 2 tables cleaned up successfully' AS status;
