UPDATE creator_drops
SET visibility = 'public'
WHERE visibility IS NULL
   OR visibility NOT IN ('public', 'followers', 'members');

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'creator_drops_visibility_check'
      AND conrelid = 'creator_drops'::regclass
  ) THEN
    ALTER TABLE creator_drops
      ADD CONSTRAINT creator_drops_visibility_check
      CHECK (visibility IN ('public', 'followers', 'members')) NOT VALID;
  END IF;
END $$;
