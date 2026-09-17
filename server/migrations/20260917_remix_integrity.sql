-- P2-03: remix attribution, relationship uniqueness and engagement-counter integrity.
--
-- The migration runner (server/scripts/run-migrations.ts) strips whole-line comments and then splits
-- the file on the statement terminator, sending each statement separately. Every statement below is
-- therefore self-contained and contains no nested terminator -- no DO blocks, no function bodies --
-- and each is written to be safe to re-run.
--
-- Three things change:
--
--   1. remix_likes / remix_saves are created. Before this, a "like" existed only as +1 on
--      recipe_remixes.likes_count, written by an endpoint with no authentication at all, so the
--      column counted anonymous REQUESTS and could be driven arbitrarily high. Likes and saves are
--      relationships between an account and a remix, and are now stored as rows whose unique index
--      is what makes a repeated or concurrent request idempotent.
--
--   2. recipe_remixes gains a unique lineage index on (original_recipe_id, remixed_recipe_id,
--      user_id), so a replayed POST /api/remixes cannot create a second identical relationship and
--      re-fire the counter and the notification.
--
--   3. The three counters are rebuilt from the relationships that now back them.
--
-- ADDITIVE except for the two counter rebuilds described below. No column is dropped, no remix row
-- is altered other than in its three counter columns, and the de-duplication in step 2 removes only
-- rows that are byte-identical in their lineage identity to a row that is kept.

CREATE TABLE IF NOT EXISTS remix_likes (
  id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id varchar NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  remix_id varchar NOT NULL REFERENCES recipe_remixes(id) ON DELETE CASCADE,
  created_at timestamp NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS remix_saves (
  id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id varchar NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  remix_id varchar NOT NULL REFERENCES recipe_remixes(id) ON DELETE CASCADE,
  created_at timestamp NOT NULL DEFAULT now()
);

-- The unique indexes are the whole point of the two tables: they are what stops two simultaneous
-- like requests from the same account from becoming two likes. Enforcement lives in the database,
-- not in the route, so it holds across processes.
CREATE UNIQUE INDEX IF NOT EXISTS remix_likes_user_remix_idx ON remix_likes (user_id, remix_id);

CREATE INDEX IF NOT EXISTS remix_likes_remix_idx ON remix_likes (remix_id);

CREATE UNIQUE INDEX IF NOT EXISTS remix_saves_user_remix_idx ON remix_saves (user_id, remix_id);

CREATE INDEX IF NOT EXISTS remix_saves_remix_idx ON remix_saves (remix_id);

-- Existing duplicate lineage rows would make the unique index below fail to build, so they are
-- collapsed first. A "duplicate" here is strictly a second row asserting the SAME
-- (original_recipe_id, remixed_recipe_id, user_id) -- the same author claiming the same output
-- recipe as a remix of the same source. Such a row carries no information the kept row does not:
-- created_at is the only other non-counter column that can differ, and the counters are rebuilt
-- below regardless. The row kept is deterministic and independent of physical row order: oldest
-- created_at wins, ties broken by the smaller id. Nothing with a distinct lineage is touched, so no
-- user loses a remix they actually made.
DELETE FROM recipe_remixes victim
USING recipe_remixes keeper
WHERE victim.original_recipe_id = keeper.original_recipe_id
  AND victim.remixed_recipe_id = keeper.remixed_recipe_id
  AND victim.user_id = keeper.user_id
  AND victim.id <> keeper.id
  AND (
    keeper.created_at < victim.created_at
    OR (keeper.created_at IS NOT DISTINCT FROM victim.created_at AND keeper.id < victim.id)
  );

CREATE UNIQUE INDEX IF NOT EXISTS recipe_remix_lineage_idx
  ON recipe_remixes (original_recipe_id, remixed_recipe_id, user_id);

-- remix_count means "how many times the recipe THIS row produced has itself been remixed". The
-- pre-repair route incremented it with `WHERE original_recipe_id = $1`, which bumped every SIBLING
-- remix of the source recipe and never the row whose output was actually remixed -- so the stored
-- values do not measure the quantity the column names, at any row. They are rebuilt from the
-- relationships, which is the only source that can produce the correct value. A remix whose output
-- recipe has never been remixed correctly lands on 0.
UPDATE recipe_remixes target
SET remix_count = (
  SELECT count(*)
  FROM recipe_remixes child
  WHERE child.original_recipe_id = target.remixed_recipe_id
);

-- likes_count and saves_count are reset to 0 because remix_likes and remix_saves are empty and
-- there is no way to populate them. Every increment those columns ever received came from
-- POST /:id/like and POST /:id/save as they stood before this repair: no requireAuth, no per-user
-- record, no request body -- nothing was persisted that names WHO liked or saved, and the same
-- caller could raise the number without limit. There is no user data here to preserve, only an
-- unattributable, forgeable request tally, and leaving it in place would mean the counter this
-- repair makes exact starts from an inexact number and stays permanently overstated. Zero is the
-- value consistent with the relationship rows that now define these counts.
UPDATE recipe_remixes SET likes_count = 0, saves_count = 0;
