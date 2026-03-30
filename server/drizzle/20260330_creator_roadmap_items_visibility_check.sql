UPDATE creator_roadmap_items
SET visibility = 'public'
WHERE visibility IS NULL
   OR visibility NOT IN ('public', 'followers', 'members');

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'creator_roadmap_items_visibility_check'
      AND conrelid = 'creator_roadmap_items'::regclass
  ) THEN
    ALTER TABLE creator_roadmap_items
      ADD CONSTRAINT creator_roadmap_items_visibility_check
      CHECK (visibility IN ('public', 'followers', 'members')) NOT VALID;
  END IF;
END $$;
