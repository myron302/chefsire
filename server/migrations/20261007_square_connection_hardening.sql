-- Phase 2Q Gate 0: Square provider connection hardening.
--
-- ADDITIVE ONLY. No payment_methods row is deleted, no existing column is altered or dropped, and no historical
-- identifier (provider_id = the Square merchant id, account_details.merchantId/locationId) is ever removed.
--
-- Until now a connected Square account kept its OAuth access and refresh tokens as PLAINTEXT inside the
-- account_details jsonb. This migration adds typed columns for the encrypted credentials and the facts a payment
-- needs to trust a connection (expiry, last refresh, verified merchant, verified location, granted scopes), and
-- adds constraints so a plaintext token can no longer be written back and a dead connection cannot keep secrets.
--
-- Existing plaintext tokens are NOT touched here: encryption needs the server secret, which SQL does not have. They
-- are converted by the idempotent server-side migration (server/scripts/migrate-square-oauth-tokens.ts, and lazily
-- per row when its owner is next checked). Until a row is converted its typed credential columns are NULL, which the
-- readiness service treats as "not payment ready".
--
-- ROLLBACK: every statement is IF NOT EXISTS / guarded, and every new column is nullable, so older application code
-- keeps running against the new schema. To roll back the application, leave the columns in place; to remove them,
-- drop the constraints first, then the columns. Rolling back after rows were converted loses the (encrypted) tokens,
-- so providers would have to reconnect.

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
-- comes with the expiry the server needs to know when to refresh it.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'payment_methods_square_credentials_check' AND conrelid = 'payment_methods'::regclass) THEN
    ALTER TABLE payment_methods ADD CONSTRAINT payment_methods_square_credentials_check CHECK (
      (encrypted_access_token IS NULL AND encrypted_refresh_token IS NULL)
      OR (
        encrypted_access_token LIKE 'sqenc:v1:%' AND encrypted_refresh_token LIKE 'sqenc:v1:%'
        AND token_expires_at IS NOT NULL AND provider = 'square'
      )
    );
  END IF;
END $$;

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

-- A plaintext Square token can no longer be written to account_details by anything. NOT VALID so the legacy rows
-- that still carry one do not fail validation; any UPDATE of such a row must remove the keys (which is exactly what
-- the conversion does), and any INSERT is checked. After the conversion has run everywhere,
--   ALTER TABLE payment_methods VALIDATE CONSTRAINT payment_methods_no_plaintext_oauth_token_check;
-- makes the guarantee unconditional.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'payment_methods_no_plaintext_oauth_token_check' AND conrelid = 'payment_methods'::regclass) THEN
    ALTER TABLE payment_methods ADD CONSTRAINT payment_methods_no_plaintext_oauth_token_check CHECK (
      account_details IS NULL OR NOT (account_details ?| ARRAY['accessToken', 'refreshToken'])
    ) NOT VALID;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS payment_methods_provider_merchant_idx ON payment_methods (provider, provider_id);
