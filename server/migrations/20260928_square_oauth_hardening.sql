-- P1-06 follow-up hardening for a database that already applied the earlier,
-- unmerged version of 20260927_square_oauth_transactions.sql (one row per
-- OAuth request, no browser-binding proof, naive `timestamp` columns).
--
-- This migration only touches short-lived square_oauth_transactions rows. It
-- never alters or deletes payment_methods / stored connected seller
-- credentials -- existing legitimate Square seller connections are preserved.
-- A fresh install applies 20260927_square_oauth_transactions.sql directly and
-- does not need this file.

-- 1. Add browser-binding storage if it is missing (nullable until backfilled
--    and enforced below, so this step is safe to run against live data).
ALTER TABLE square_oauth_transactions
  ADD COLUMN IF NOT EXISTS browser_binding_hash varchar(64);

-- 2. Every existing short-lived OAuth transaction attempt predates
--    browser-binding proof and can never satisfy it, so it can no longer be
--    claimed or consumed. Discard those unusable attempts; callers simply
--    start a new OAuth connection. This never touches payment_methods.
--
--    The WHERE clause is not a narrowing of intent -- it is the intent stated
--    exactly. Step 1 adds browser_binding_hash as NULL, so on any database that
--    predates this file EVERY existing row matches and the effect is identical
--    to an unqualified DELETE. On a database where this file has already run,
--    the column is NOT NULL and nothing matches, which is what makes a re-run a
--    true no-op rather than one that merely looks harmless.
--
--    An unqualified DELETE is also refused by the routine migration validator
--    (server/scripts/migration-safety.ts), and rightly: it cannot prove that a
--    bare DELETE is bounded. A real predicate is something it can check.
DELETE FROM square_oauth_transactions WHERE browser_binding_hash IS NULL;

-- 3. Browser binding is mandatory for every transaction going forward.
ALTER TABLE square_oauth_transactions
  ALTER COLUMN browser_binding_hash SET NOT NULL;

-- 4. Convert timestamps to timezone-aware absolute instants so the ~10 minute
--    TTL cannot be shortened or lengthened by a Node/PostgreSQL timezone
--    mismatch. The table is empty at this point (step 2), so this is a plain
--    type change with no reinterpretation of existing values.
ALTER TABLE square_oauth_transactions
  ALTER COLUMN created_at TYPE timestamptz USING created_at AT TIME ZONE 'UTC',
  ALTER COLUMN expires_at TYPE timestamptz USING expires_at AT TIME ZONE 'UTC',
  ALTER COLUMN claimed_at TYPE timestamptz USING claimed_at AT TIME ZONE 'UTC',
  ALTER COLUMN consumed_at TYPE timestamptz USING consumed_at AT TIME ZONE 'UTC';

-- 5. superseded_at is NOT dropped here. A unique-per-user row plus
--    nonce/binding replacement on every new initiation makes stale-attempt
--    bookkeeping unnecessary, so the column is unwanted -- but no migration
--    that ever shipped creates it. It exists only where someone applied an
--    unmerged migration, which is a developer machine, never production
--    (verified against the live database: the column is absent there).
--
--    Dropping a column is irreversible, and this project's rule is that routine
--    migrations are non-destructive, so the drop lives in
--    server/migration-quarantine/20260928_drop_superseded_at.sql and runs only
--    through run-destructive-migration.ts. Carrying it here would make every
--    db:migrate run fail the validator for the sake of a column that is not
--    there.

-- 6. Replace per-request nonce uniqueness with one-row-per-user enforcement,
--    which is what actually bounds table growth. Drop-then-add makes this
--    idempotent whether or not the constraint already exists: on a fresh
--    install, 20260927_square_oauth_transactions.sql already declares
--    user_id UNIQUE, which Postgres names square_oauth_transactions_user_id_key
--    by its default convention, so an unconditional ADD CONSTRAINT here would
--    fail with "constraint already exists" when this file runs immediately
--    after it. The table is unconditionally emptied in step 2 above, so no
--    duplicate user_id row can ever make the ADD CONSTRAINT fail.
ALTER TABLE square_oauth_transactions
  DROP CONSTRAINT IF EXISTS square_oauth_transactions_nonce_hash_key;
DROP INDEX IF EXISTS square_oauth_transactions_user_idx;
ALTER TABLE square_oauth_transactions
  DROP CONSTRAINT IF EXISTS square_oauth_transactions_user_id_key;
ALTER TABLE square_oauth_transactions
  ADD CONSTRAINT square_oauth_transactions_user_id_key UNIQUE (user_id);

CREATE INDEX IF NOT EXISTS square_oauth_transactions_nonce_idx
  ON square_oauth_transactions (nonce_hash);
