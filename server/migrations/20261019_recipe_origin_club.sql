-- Phase 3C: explicit provenance for club-only recipes.
--
-- Until now the only link between a recipe and a club was "some club post references it", which cannot tell a recipe that was
-- CREATED for a private club (must stay private) from a public recipe merely SHARED into one (must stay public). origin_club_id
-- records the club a recipe was created for; it is written once at creation and never by sharing.
ALTER TABLE recipes
  ADD COLUMN IF NOT EXISTS origin_club_id varchar REFERENCES clubs(id);

CREATE INDEX IF NOT EXISTS recipes_origin_club_idx ON recipes (origin_club_id) WHERE origin_club_id IS NOT NULL;

-- Legacy backfill. Only rows that look club-created are touched: no post (post_id IS NULL) and no external source. ChefSire's
-- club route was the only writer of such rows that club posts reference, and it inserted the recipe immediately before its post,
-- so the club of the EARLIEST referencing post is the creating club. Where that cannot be established (tied or missing
-- timestamps) the recipe is assigned to a PRIVATE club that references it if there is one, so ambiguity resolves toward private,
-- never toward public. Recipes no club post references carry no club evidence and are left as they are (ordinary).
WITH refs AS (
  SELECT cp.recipe_id,
         cp.club_id,
         cp.created_at,
         COALESCE(c.is_public, false) AS is_public,
         ROW_NUMBER() OVER (PARTITION BY cp.recipe_id ORDER BY cp.created_at ASC NULLS LAST, cp.id) AS rn,
         COUNT(*) OVER (PARTITION BY cp.recipe_id, cp.created_at) AS same_instant
  FROM club_posts cp
  JOIN clubs c ON c.id = cp.club_id
  WHERE cp.recipe_id IS NOT NULL
),
decided AS (
  SELECT r.recipe_id,
         COALESCE(
           (SELECT e.club_id FROM refs e WHERE e.recipe_id = r.recipe_id AND e.rn = 1 AND e.created_at IS NOT NULL AND e.same_instant = 1),
           (SELECT MIN(p.club_id) FROM refs p WHERE p.recipe_id = r.recipe_id AND NOT p.is_public),
           (SELECT MIN(a.club_id) FROM refs a WHERE a.recipe_id = r.recipe_id)
         ) AS club_id
  FROM (SELECT DISTINCT recipe_id FROM refs) r
)
UPDATE recipes
SET origin_club_id = decided.club_id
FROM decided
WHERE recipes.id = decided.recipe_id
  AND recipes.origin_club_id IS NULL
  AND recipes.post_id IS NULL
  AND recipes.external_source IS NULL
  AND decided.club_id IS NOT NULL;
