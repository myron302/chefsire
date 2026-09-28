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
DELETE FROM square_oauth_transactions;

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

-- 5. A unique-per-user row plus nonce/binding replacement on every new
--    initiation makes stale-attempt bookkeeping unnecessary; drop it if the
--    earlier unmerged migration created it.
ALTER TABLE square_oauth_transactions
  DROP COLUMN IF EXISTS superseded_at;

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
