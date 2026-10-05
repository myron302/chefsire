-- Phase 2Q Gate 0 repair for databases that applied an EARLIER revision of 20261007_square_connection_hardening.sql.
--
-- Two corrections, both idempotent and both safe to run on a database that never had the earlier revision:
--
-- 1. The sealed-credential pair CHECK is made explicit. The earlier revision compared with LIKE alone; a CHECK passes when its
--    expression is TRUE or NULL, so `encrypted_access_token IS NULL AND encrypted_refresh_token IS NOT NULL` (with an expiry on a
--    square row) evaluated to NULL and was accepted. Exactly two states are valid: neither token stored, or BOTH stored in the
--    sealed format with an expiry on a square row.
--
-- 2. The constraint that forbids plaintext tokens in account_details is REMOVED from the automatic migration path. Even NOT VALID
--    it is enforced on every new write, so an old application server still running during a rolling deploy (or after a rollback)
--    would be rejected. It is installed by the explicit finalization step once old servers are drained.
--
-- If a partial-credential row already exists the repaired CHECK is added NOT VALID (still enforced for every new write) and is
-- validated by the same finalization step; no row is changed here.
ALTER TABLE payment_methods DROP CONSTRAINT IF EXISTS payment_methods_no_plaintext_oauth_token_check;
ALTER TABLE payment_methods DROP CONSTRAINT IF EXISTS payment_methods_square_credentials_check;
ALTER TABLE payment_methods ADD CONSTRAINT payment_methods_square_credentials_check CHECK (
  (encrypted_access_token IS NULL AND encrypted_refresh_token IS NULL)
  OR (
    encrypted_access_token IS NOT NULL AND encrypted_refresh_token IS NOT NULL
    AND encrypted_access_token LIKE 'sqenc:v1:%' AND encrypted_refresh_token LIKE 'sqenc:v1:%'
    AND token_expires_at IS NOT NULL
    AND provider IS NOT NULL AND provider = 'square'
  )
) NOT VALID;
DO $$
BEGIN
  -- Validate when no violating row exists; otherwise leave it NOT VALID (enforced for new writes) for the operator to repair.
  IF NOT EXISTS (
    SELECT 1 FROM payment_methods
    WHERE NOT (
      (encrypted_access_token IS NULL AND encrypted_refresh_token IS NULL)
      OR (
        encrypted_access_token IS NOT NULL AND encrypted_refresh_token IS NOT NULL
        AND encrypted_access_token LIKE 'sqenc:v1:%' AND encrypted_refresh_token LIKE 'sqenc:v1:%'
        AND token_expires_at IS NOT NULL
        AND provider IS NOT NULL AND provider = 'square'
      )
    )
  ) THEN
    ALTER TABLE payment_methods VALIDATE CONSTRAINT payment_methods_square_credentials_check;
  END IF;
END $$;
