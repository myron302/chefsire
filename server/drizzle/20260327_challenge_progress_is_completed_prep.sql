-- Minimal, production-safe prep migration for challenge completion canonicalization.
-- Intentionally avoids one-off permanent audit tables.

ALTER TABLE challenge_progress
  ADD COLUMN IF NOT EXISTS is_completed BOOLEAN DEFAULT false;

-- Monotonic backfill: only flips false -> true based on legacy completed flag.
UPDATE challenge_progress
SET is_completed = true
WHERE completed = true
  AND COALESCE(is_completed, false) = false;
