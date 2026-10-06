-- Phase 2Q Gate 0 repair: a credential generation for Square connections.
--
-- ADDITIVE ONLY. One new column on payment_methods; no row is deleted or rewritten beyond the column default, and the
-- column holds no secret.
--
-- credential_generation identifies WHICH credential snapshot a connection currently represents. It is advanced, in the
-- same statement as the change, by everything that replaces, rotates, installs or removes the credentials of a row:
-- an OAuth (re)connect, a token refresh, a legacy plaintext conversion, a transition to needs_reauthorization and a
-- disconnect. A verification that began against generation N may only write while the row is STILL generation N, so a
-- stale attempt can neither overwrite a newer connection's facts nor clear its credentials. Facts-only writes (merchant
-- name, scopes, location, verification time) do not advance it.
--
-- It is a counter updated under the row's lock (UPDATE ... SET credential_generation = credential_generation + 1), so
-- two changes can never produce the same value; timestamps are not used because two changes can share one.
--
-- Existing rows start at 1 (fast default). Rollback: the previous application ignores the column; drop the constraint,
-- then the column, to remove it.
ALTER TABLE payment_methods ADD COLUMN IF NOT EXISTS credential_generation bigint NOT NULL DEFAULT 1;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'payment_methods_credential_generation_check' AND conrelid = 'payment_methods'::regclass) THEN
    ALTER TABLE payment_methods ADD CONSTRAINT payment_methods_credential_generation_check CHECK (credential_generation >= 1);
  END IF;
END $$;
