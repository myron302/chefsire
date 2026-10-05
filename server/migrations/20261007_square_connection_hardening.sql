-- Phase 2Q Gate 0: Square provider connection hardening.
--
-- ADDITIVE ONLY (the DROP CONSTRAINT IF EXISTS statements below remove only this file's own earlier-revision constraints).
-- No payment_methods row is deleted, no existing column is altered or dropped, and no historical
-- identifier (provider_id = the Square merchant id, account_details.merchantId/locationId) is ever removed.
--
-- Until now a connected Square account kept its OAuth access and refresh tokens as PLAINTEXT inside the
-- account_details jsonb. This migration adds typed columns for the encrypted credentials and the facts a payment
-- needs to trust a connection (expiry, last refresh, verified merchant, verified location, granted scopes), and
-- adds constraints so a plaintext token can no longer be written back and a dead connection cannot keep secrets.
--
-- ROLLING-DEPLOY SAFE. Nothing in this file rejects what the PREVIOUS application version writes: an old server that is
-- still running during the deploy keeps writing plaintext tokens into account_details (status 'active'), and every statement
-- below accepts that. The constraint that forbids plaintext tokens is deliberately NOT installed here; it is a separate,
-- explicit finalization step to be run only after every old server has been drained (see
-- docs/square-provider-connection-gate0.md and server/scripts/finalize-square-plaintext-enforcement.ts).
--
-- Existing plaintext tokens are NOT touched here: encryption needs the server secret, which SQL does not have. They
-- are converted by the idempotent server-side migration (server/scripts/migrate-square-oauth-tokens.ts, and lazily
-- per row when its owner is next checked). Until a row is converted its typed credential columns are NULL, which the
-- readiness service treats as "not payment ready".
--
-- ROLLBACK / MIXED VERSIONS: every statement is guarded and every new column is nullable, so older application code keeps
-- running against the new schema, and an old server may keep writing plaintext tokens into account_details (this file does not
-- reject that). Two limits are real: (1) a connection the NEW application has already converted no longer carries plaintext,
-- so the OLD code cannot use or display it and the provider reconnects on the old code; (2) a plaintext write by an old server
-- AFTER a row was converted is picked up by the new application the next time it checks that row (see convertLegacyRow). To
-- remove this change entirely, drop the new constraints, then the new columns.

ALTER TABLE payment_methods ADD COLUMN IF NOT EXISTS encrypted_access_token text;
ALTER TABLE payment_methods ADD COLUMN IF NOT EXISTS encrypted_refresh_token text;
ALTER TABLE payment_methods ADD COLUMN IF NOT EXISTS token_expires_at timestamptz;
ALTER TABLE payment_methods ADD COLUMN IF NOT EXISTS last_refreshed_at timestamptz;
-- The Square location a later checkout would use, chosen by the server from Square's own location list.
ALTER TABLE payment_methods ADD COLUMN IF NOT EXISTS location_id varchar(64);
ALTER TABLE payment_methods ADD COLUMN IF NOT EXISTS location_name text;
ALTER TABLE payment_methods ADD COLUMN IF NOT EXISTS location_currency varchar(3);
ALTER TABLE payment_methods ADD COLUMN IF NOT EXISTS merchant_name text;
-- The scopes Square reports for the stored token. NULL means "not yet verified", which is not payment ready.
ALTER TABLE payment_methods ADD COLUMN IF NOT EXISTS granted_scopes text[];
ALTER TABLE payment_methods ADD COLUMN IF NOT EXISTS status_changed_at timestamptz;
ALTER TABLE payment_methods ADD COLUMN IF NOT EXISTS disconnected_at timestamptz;

-- Connection state reuses account_status. 'active' keeps its meaning; two values are added. 'pending', 'disabled'
-- and 'rejected' stay allowed for rows written before this phase. NOT VALID: it is enforced for every new write and
-- never fails because of a historical row.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'payment_methods_account_status_check' AND conrelid = 'payment_methods'::regclass) THEN
    ALTER TABLE payment_methods ADD CONSTRAINT payment_methods_account_status_check
      CHECK (account_status IS NULL OR account_status IN ('pending', 'active', 'disabled', 'rejected', 'needs_reauthorization', 'disconnected')) NOT VALID;
  END IF;
END $$;

-- A credential is stored as a pair, sealed in the versioned format written by server/lib/secret-box.ts, and always
-- comes with the expiry the server needs to know when to refresh it. Exactly two states are valid:
--   A. neither token is stored; or
--   B. BOTH are stored, both in the sealed format, with an expiry, on a square row.
-- Every comparison that could be NULL is guarded by an explicit IS [NOT] NULL, because a CHECK passes when its expression is
-- TRUE *or NULL*: `access IS NULL, refresh IS NOT NULL` must be rejected, not slip through three-valued logic. (An earlier
-- revision of this constraint relied on LIKE alone and accepted a one-token row; it is replaced here and, for databases that
-- already applied that revision, again by 20261011_square_credential_pair_repair.sql.)
ALTER TABLE payment_methods DROP CONSTRAINT IF EXISTS payment_methods_square_credentials_check;
ALTER TABLE payment_methods ADD CONSTRAINT payment_methods_square_credentials_check CHECK (
  (encrypted_access_token IS NULL AND encrypted_refresh_token IS NULL)
  OR (
    encrypted_access_token IS NOT NULL AND encrypted_refresh_token IS NOT NULL
    AND encrypted_access_token LIKE 'sqenc:v1:%' AND encrypted_refresh_token LIKE 'sqenc:v1:%'
    AND token_expires_at IS NOT NULL
    AND provider IS NOT NULL AND provider = 'square'
  )
);

-- A connection Square has revoked, or that its owner disconnected, holds no usable secret of any kind. The merchant
-- id (provider_id), location and names stay as historical evidence.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'payment_methods_square_dead_holds_no_secret_check' AND conrelid = 'payment_methods'::regclass) THEN
    ALTER TABLE payment_methods ADD CONSTRAINT payment_methods_square_dead_holds_no_secret_check CHECK (
      account_status IS NULL OR account_status NOT IN ('needs_reauthorization', 'disconnected')
      OR (
        encrypted_access_token IS NULL AND encrypted_refresh_token IS NULL
        AND (account_details IS NULL OR NOT (account_details ?| ARRAY['accessToken', 'refreshToken']))
      )
    );
  END IF;
END $$;

-- NOT INSTALLED HERE: the constraint forbidding plaintext tokens in account_details. Even as NOT VALID it is enforced on
-- every new INSERT/UPDATE, so an old application server still writing plaintext during a rolling deploy (or after a rollback)
-- would be rejected. It is installed by the explicit finalization step once old servers are drained and no plaintext remains.
-- If an earlier revision of this migration already installed it, remove it so the old application can keep writing:
ALTER TABLE payment_methods DROP CONSTRAINT IF EXISTS payment_methods_no_plaintext_oauth_token_check;

CREATE INDEX IF NOT EXISTS payment_methods_provider_merchant_idx ON payment_methods (provider, provider_id);
