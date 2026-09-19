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
--   2. Historically forged lineage rows -- ones whose user_id does not author the output recipe --
--      are archived into recipe_remixes_invalid_lineage and removed from the live table, so the
--      ownership rule the route now enforces also holds for the data already stored.
--
--   3. Pre-existing duplicate lineage rows are collapsed to one canonical row each, and
--      recipe_remixes gains a unique index on (original_recipe_id, remixed_recipe_id, user_id), so a
--      replayed POST /api/remixes cannot create a second identical relationship and re-fire the
--      counter and the notification.
--
--   4. All three counters are rebuilt from the valid relationships that now back them.
--
-- ADDITIVE except for the forged-lineage removal, the duplicate collapse and the counter rebuilds
-- described below. No column is dropped, every removed row is archived first, and no surviving remix
-- row is altered other than in its three counter columns and, for rows in a duplicate group only,
-- is_public.

CREATE TABLE IF NOT EXISTS remix_likes (
  id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  -- NO ACTION on user_id, deliberately, and matching every analogous table in this schema
  -- (posts `likes`, `drink_likes`, `drink_saves`, `recipe_saves` all reference users(id) plainly).
  -- ON DELETE CASCADE here would let an account deletion silently remove like/save rows WITHOUT
  -- decrementing the counters they back, leaving likes_count permanently above the number of
  -- relationships -- exactly the drift this migration exists to remove. Nothing in the codebase
  -- decrements a counter on account deletion, so the constraint is what has to hold the line.
  user_id varchar NOT NULL REFERENCES users(id),
  -- CASCADE on remix_id IS correct: the counter lives on the remix row, so when that row goes its
  -- engagement rows go with it and there is no counter left to drift.
  remix_id varchar NOT NULL REFERENCES recipe_remixes(id) ON DELETE CASCADE,
  created_at timestamp NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS remix_saves (
  id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  -- NO ACTION on user_id, deliberately, and matching every analogous table in this schema
  -- (posts `likes`, `drink_likes`, `drink_saves`, `recipe_saves` all reference users(id) plainly).
  -- ON DELETE CASCADE here would let an account deletion silently remove like/save rows WITHOUT
  -- decrementing the counters they back, leaving likes_count permanently above the number of
  -- relationships -- exactly the drift this migration exists to remove. Nothing in the codebase
  -- decrements a counter on account deletion, so the constraint is what has to hold the line.
  user_id varchar NOT NULL REFERENCES users(id),
  -- CASCADE on remix_id IS correct: the counter lives on the remix row, so when that row goes its
  -- engagement rows go with it and there is no counter left to drift.
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

-- ------------------------------------------------------------------------------------------------
-- Remediating historically forged lineage
-- ------------------------------------------------------------------------------------------------
--
-- The repaired POST /api/remixes refuses a claim unless the caller authors the OUTPUT recipe. The
-- old endpoint checked only that both ids resolved to some recipe, so knowing two ids was enough to
-- publish a row claiming any recipe on the platform as your own remix output. Those rows are still
-- in the table. A migration that establishes lineage integrity cannot leave them there: they stay
-- visible in every public feed, they are attributed to an account that did not author the recipe,
-- and -- before this change -- they were counted into the rebuilt remix_count, so the migration was
-- actively blessing forged lineage with a freshly computed counter.
--
-- THE INVARIANT, AS PERSISTED DATA. `recipes` has NO user/author/owner/creator column, and there is
-- no collaborator or shared-ownership table anywhere in the schema. A recipe's author is the author
-- of the post it was published as, and nothing else:
--
--     recipes.post_id -> posts.id -> posts.user_id
--
-- So a lineage row is legitimate exactly when all three hold, which is precisely what the route now
-- enforces (server/routes/remixes.ts, loadRecipeWithOwner and the two refusals after it):
--
--   1. original_recipe_id <> remixed_recipe_id   -- a recipe is not a remix of itself
--   2. original_recipe_id resolves to a recipe   -- already guaranteed by the foreign key
--   3. the row's user_id IS the author of remixed_recipe_id, derived through the post
--
-- Condition 3 also covers the "no provable owner" case for free: a recipe whose post_id is NULL
-- (club recipes are inserted that way) joins to nothing, so no user_id can satisfy it -- matching
-- the route, which refuses such a claim rather than assuming it.
--
-- WHY THESE ROWS ARE REMOVED RATHER THAN RE-ATTRIBUTED. Rewriting user_id to the output recipe's
-- real author would not correct a claim, it would FABRICATE one: it would assert that the author
-- created a remix they never created, and hand them authored metadata (remix_type, changes) written
-- by the forger. That manufactures data rather than repairing it. Re-attribution would also collide
-- with the victim's own genuine row whenever they really had remixed that recipe, turning two rows
-- into one lineage key. Removal has neither problem, and it is ordered BEFORE the de-duplication
-- below so that no collision can arise at all -- nothing is rewritten, so nothing can collapse onto
-- an existing key.
--
-- NOTHING IS DESTROYED. Every removed row is copied first, in full, into
-- recipe_remixes_invalid_lineage together with the reason it failed. The live table regains its
-- invariant while the rows remain auditable and restorable; a forged claim simply stops being served
-- as a legitimate remix relationship.
CREATE TABLE IF NOT EXISTS recipe_remixes_invalid_lineage (
  id varchar PRIMARY KEY,
  original_recipe_id varchar NOT NULL,
  remixed_recipe_id varchar NOT NULL,
  user_id varchar NOT NULL,
  remix_type text,
  changes jsonb,
  likes_count integer,
  saves_count integer,
  remix_count integer,
  is_public boolean,
  created_at timestamp,
  -- Why the row failed the invariant, so an operator can tell a forged claim from an unownable one.
  invalid_reason text NOT NULL,
  quarantined_at timestamptz NOT NULL DEFAULT now()
);

-- Deliberately no foreign keys on the archive: a quarantined row must survive the later deletion of
-- the account or recipe it referred to, which is the whole point of keeping it.
INSERT INTO recipe_remixes_invalid_lineage (
  id, original_recipe_id, remixed_recipe_id, user_id, remix_type, changes,
  likes_count, saves_count, remix_count, is_public, created_at, invalid_reason
)
SELECT rr.id, rr.original_recipe_id, rr.remixed_recipe_id, rr.user_id, rr.remix_type, rr.changes,
       rr.likes_count, rr.saves_count, rr.remix_count, rr.is_public, rr.created_at,
       CASE
         WHEN rr.original_recipe_id = rr.remixed_recipe_id THEN 'self_lineage'
         WHEN NOT EXISTS (
           SELECT 1 FROM recipes r
           WHERE r.id = rr.remixed_recipe_id AND r.post_id IS NOT NULL
         ) THEN 'output_recipe_has_no_resolvable_owner'
         ELSE 'user_is_not_the_author_of_the_output_recipe'
       END
FROM recipe_remixes rr
WHERE rr.original_recipe_id = rr.remixed_recipe_id
   OR NOT EXISTS (
        SELECT 1
        FROM recipes r
        JOIN posts p ON p.id = r.post_id
        WHERE r.id = rr.remixed_recipe_id
          AND p.user_id = rr.user_id
      )
ON CONFLICT (id) DO NOTHING;

-- The same predicate, so the live table keeps exactly the rows the archive did not take.
DELETE FROM recipe_remixes rr
WHERE rr.original_recipe_id = rr.remixed_recipe_id
   OR NOT EXISTS (
        SELECT 1
        FROM recipes r
        JOIN posts p ON p.id = r.post_id
        WHERE r.id = rr.remixed_recipe_id
          AND p.user_id = rr.user_id
      );

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
-- relationships, which is the only source that can produce the correct value, and only after BOTH
-- the forged-lineage removal and the de-duplication above -- so a quarantined or collapsed row can
-- no longer contribute to anyone's count. Every row still in the table satisfies the ownership
-- invariant by then, which is what makes count(*) here a count of VALID lineage rather than of rows.
-- A remix whose output recipe has never been remixed correctly lands on 0.
UPDATE recipe_remixes target
SET remix_count = (
  SELECT count(*)
  FROM recipe_remixes child
  WHERE child.original_recipe_id = target.remixed_recipe_id
);

-- likes_count and saves_count are RECONSTRUCTED from the relationship tables, which are now their
-- only source of truth. They are not zeroed.
--
-- Zeroing was wrong in a way that only a re-run exposes. On the first pass remix_likes and
-- remix_saves are empty, so zero happens to be the right answer -- every increment those columns
-- ever received came from POST /:id/like and /:id/save as they stood before this repair (no
-- requireAuth, no per-user record, nothing naming WHO acted), so there was no relationship to count
-- and nothing attributable to preserve. But this migration is meant to be safe to run again, and by
-- the second run real likes and saves exist. Zeroing then discards live, correctly attributed
-- counts while leaving the relationship rows in place -- and because the runtime like and save are
-- idempotent (insert ... on conflict do nothing, counter moved only when a row is actually
-- created), those users re-liking would change nothing and the counters could never catch up.
--
-- count(DISTINCT user_id) is the semantic identity of "one like per user per remix", which is what
-- the product means and what remix_likes_user_remix_idx / remix_saves_user_remix_idx enforce a few
-- statements above. With those unique indexes in place count(*) would give the same answer, so
-- DISTINCT costs nothing and cannot inflate a counter from duplicate relationship rows even if an
-- index were ever missing.
--
-- This runs after the forged-lineage removal and the de-duplication, so any engagement rows attached
-- to a removed remix have already gone with it through ON DELETE CASCADE, and a remix with no
-- relationships correctly lands on 0.
UPDATE recipe_remixes target
SET likes_count = (
      SELECT count(DISTINCT l.user_id) FROM remix_likes l WHERE l.remix_id = target.id
    ),
    saves_count = (
      SELECT count(DISTINCT sv.user_id) FROM remix_saves sv WHERE sv.remix_id = target.id
    );

-- The lineage index is created LAST, deliberately.
--
-- Building a unique index over rows that still contain duplicates raises SQLSTATE 23505. The
-- de-duplication above is what makes that impossible. The migration runner deliberately does not
-- treat that data-integrity failure as schema idempotency: it rolls the migration back and leaves its
-- ledger entry absent so the data can be repaired and the migration retried.
CREATE UNIQUE INDEX IF NOT EXISTS recipe_remix_lineage_idx
  ON recipe_remixes (original_recipe_id, remixed_recipe_id, user_id);
