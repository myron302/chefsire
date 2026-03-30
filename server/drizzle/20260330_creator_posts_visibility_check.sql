UPDATE creator_posts
SET visibility = 'public'
WHERE visibility IS NULL
   OR visibility NOT IN ('public', 'followers', 'members');

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'creator_posts_visibility_check'
      AND conrelid = 'creator_posts'::regclass
  ) THEN
    ALTER TABLE creator_posts
      ADD CONSTRAINT creator_posts_visibility_check
      CHECK (visibility IN ('public', 'followers', 'members')) NOT VALID;
  END IF;
END $$;
