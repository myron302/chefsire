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
--   2. Pre-existing duplicate lineage rows are collapsed to one canonical row each, and
--      recipe_remixes gains a unique index on (original_recipe_id, remixed_recipe_id, user_id), so a
--      replayed POST /api/remixes cannot create a second identical relationship and re-fire the
--      counter and the notification.
--
--   3. The three counters are rebuilt from the relationships that now back them.
--
-- ADDITIVE except for the duplicate collapse and the counter rebuilds described below. No column is
-- dropped and no remix row is altered other than in its three counter columns and, for rows in a
-- duplicate group only, is_public.

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

-- ------------------------------------------------------------------------------------------------
-- Collapsing pre-existing duplicate lineage rows
-- ------------------------------------------------------------------------------------------------
--
-- A "duplicate" is a second row asserting the same (original_recipe_id, remixed_recipe_id, user_id).
-- These exist because the pre-repair POST /api/remixes inserted a fresh row on every call, so a
-- retried or double-clicked create produced another row carrying that request's authored metadata.
--
-- WHAT A DUPLICATE ROW CAN DIFFER IN. Lineage identity does not imply identical authored state. The
-- three columns a user can author are remix_type, changes and is_public -- exactly the set
-- PUT /api/remixes/:id may write (shared/planner-remix-mutations.ts, toRemixPatch) -- and a PUT
-- targets ONE row id, so an edit lands on one duplicate and not on its twins. The counters are not
-- authored state and are rebuilt below regardless.
--
-- WHY THE NEWEST ROW IS CANONICAL. recipe_remixes has NO updated_at column, so which duplicate was
-- edited last is not recoverable from the data. The tie-break therefore comes from application
-- behaviour: every created_at-ordered read path in server/routes/remixes.ts -- the public feed,
-- /my-remixes and /user/:userId -- orders desc(createdAt), so the NEWEST duplicate is the row the
-- product already presents as the remix, to its author and to everyone else. (The one remaining read
-- path orders by likes_count, which this migration zeroes, so created_at is the effective ordering
-- everywhere.) Keeping the newest row preserves what users currently see, and it is also the row a
-- later edit would most likely have landed on, since it is the one the UI surfaces.
--
-- The residual ambiguity is real and is stated rather than papered over: if a user edited an OLDER
-- duplicate and a newer one was created afterwards, that edit is not recoverable, because no column
-- records it. What is guaranteed is that the choice is deterministic, that it matches what the
-- product currently displays, and that visibility is never widened -- see the is_public fold below.
--
-- remix_type and changes are taken from the canonical row and are NOT merged across duplicates. Both
-- are replace-state: toRemixPatch assigns each wholesale, and changes is a jsonb document replaced in
-- full. The application provides no basis for combining two versions of either, so none is invented.

-- is_public is folded conservatively BEFORE any row is deleted, because it is a visibility control
-- and the risk is asymmetric: wrongly restoring true would re-expose a remix its author had hidden,
-- while wrongly keeping false only hides one the author can re-publish with a single PUT. So if ANY
-- other row in a lineage group is not TRUE, the row that survives becomes false. IS NOT TRUE covers
-- NULL as well as false, which matches how the read paths already treat it -- they filter on
-- is_public = true, so NULL is not listed either way -- meaning the fold changes no row's observable
-- visibility and only carries a hidden duplicate's choice onto the survivor. The peer.id <> target.id
-- guard keeps this scoped to groups that really have duplicates, so a lone row is never rewritten.
UPDATE recipe_remixes target
SET is_public = false
WHERE EXISTS (
  SELECT 1
  FROM recipe_remixes peer
  WHERE peer.original_recipe_id = target.original_recipe_id
    AND peer.remixed_recipe_id = target.remixed_recipe_id
    AND peer.user_id = target.user_id
    AND peer.id <> target.id
    AND peer.is_public IS NOT TRUE
);

-- Delete every row that is not its group's canonical row.
--
-- created_at is NULLABLE, so a self-join written as keeper.created_at < victim.created_at does not
-- order a NULL against a timestamp: both directions evaluate to NULL, neither row is deleted, the
-- duplicate survives, and the unique index below then fails with SQLSTATE 23505. DISTINCT ON with an
-- explicit NULLS LAST is a TOTAL order rather than a partial one, and it names the survivor directly
-- instead of deriving it from a pairwise comparison:
--
--   created_at DESC NULLS LAST   newest first; a row whose creation time is unknown is never
--                                preferred over one that can actually be dated
--   id                           ascending, breaking every remaining tie
--
-- Every combination is therefore decided: two timestamps (newer wins), equal timestamps (smaller id
-- wins), NULL against a timestamp (the timestamp wins, either way round), and all-NULL (smaller id
-- wins). Exactly one row survives per lineage group, whatever the mixture of NULLs and whatever the
-- physical row order.
DELETE FROM recipe_remixes
WHERE id NOT IN (
  SELECT DISTINCT ON (original_recipe_id, remixed_recipe_id, user_id) id
  FROM recipe_remixes
  ORDER BY original_recipe_id, remixed_recipe_id, user_id, created_at DESC NULLS LAST, id
);

-- remix_count means "how many times the recipe THIS row produced has itself been remixed". The
-- pre-repair route incremented it with WHERE original_recipe_id = $1, which bumped every SIBLING
-- remix of the source recipe and never the row whose output was actually remixed -- so the stored
-- values do not measure the quantity the column names, at any row. They are rebuilt from the
-- relationships, which is the only source that can produce the correct value, and only after the
-- de-duplication above so that collapsed rows are not counted. A remix whose output recipe has never
-- been remixed correctly lands on 0.
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

-- The lineage index is created LAST, deliberately.
--
-- server/scripts/run-migrations.ts wraps its whole statement loop in a single try, and its
-- DUPLICATE_CODES set treats SQLSTATE 23505 as "objects already exist": a 23505 raised anywhere in
-- the file makes the runner record the migration as APPLIED and skip every remaining statement.
-- Building a unique index over rows that still contain duplicates raises exactly 23505. The
-- de-duplication above is what makes that impossible, but ordering this statement last also means
-- that if it ever did fail it would take no other statement down with it. That runner behaviour is
-- pre-existing and is reported in the PR rather than changed here.
CREATE UNIQUE INDEX IF NOT EXISTS recipe_remix_lineage_idx
  ON recipe_remixes (original_recipe_id, remixed_recipe_id, user_id);
