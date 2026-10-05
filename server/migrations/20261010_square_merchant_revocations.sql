-- Phase 2Q Gate 0 repair: merchant-level revocation history, keyed by the Square merchant identity.
--
-- ADDITIVE ONLY: one new table; nothing existing is altered, deleted or rewritten.
--
-- Square revokes EVERY token the application holds for a merchant when one is revoked. When a disconnect revokes a merchant's
-- grant, the fact is recorded HERE, keyed by merchant_id, under the merchant-scoped advisory lock the disconnect already
-- holds. It must not live on a payment_methods row: that row's provider_id changes when its owner reconnects to a different
-- merchant, which would make the history of the merchant they left disappear while an authorization for that merchant is
-- still in flight. This table has no foreign key to users or payment_methods, so it survives user and row reuse, disconnects
-- and every account status change.
--
--   revoked_at        when the most recent merchant-wide revocation committed (never moves backwards).
--   revocation_epoch  a monotonic counter, advanced by exactly one per revocation. An authorization reads the epoch before it
--                     is stored; persistence under the merchant lock refuses it if the epoch has advanced since.
--
-- History is append-only in effect: rows are never deleted, and an update may only advance the epoch and the time.
--
-- payment_methods.merchant_revoked_at (added by 20261009) is superseded by this table. It is no longer written or read; any
-- value it holds is copied here below. The column is left in place so older application versions keep working.
CREATE TABLE IF NOT EXISTS square_merchant_revocations (
  merchant_id text PRIMARY KEY,
  revoked_at timestamptz NOT NULL,
  revocation_epoch bigint NOT NULL DEFAULT 1,
  source varchar(24) NOT NULL DEFAULT 'disconnect',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT square_merchant_revocations_epoch_check CHECK (revocation_epoch >= 1),
  CONSTRAINT square_merchant_revocations_source_check CHECK (source IN ('disconnect')),
  CONSTRAINT square_merchant_revocations_merchant_check CHECK (length(btrim(merchant_id)) > 0)
);

-- Carry over anything the superseded column recorded.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = current_schema() AND table_name = 'payment_methods' AND column_name = 'merchant_revoked_at') THEN
    INSERT INTO square_merchant_revocations (merchant_id, revoked_at, revocation_epoch)
    SELECT provider_id, max(merchant_revoked_at), 1
    FROM payment_methods
    WHERE provider = 'square' AND merchant_revoked_at IS NOT NULL
    GROUP BY provider_id
    ON CONFLICT (merchant_id) DO NOTHING;
  END IF;
END $$;

CREATE OR REPLACE FUNCTION enforce_square_merchant_revocation_history()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'square merchant revocation history is never deleted';
  END IF;
  IF NEW.merchant_id IS DISTINCT FROM OLD.merchant_id
    OR NEW.created_at IS DISTINCT FROM OLD.created_at
    OR NEW.revocation_epoch <= OLD.revocation_epoch
    OR NEW.revoked_at < OLD.revoked_at
  THEN
    RAISE EXCEPTION 'square merchant revocation history only moves forward';
  END IF;
  RETURN NEW;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'square_merchant_revocations_history_trigger' AND tgrelid = 'square_merchant_revocations'::regclass) THEN
    CREATE TRIGGER square_merchant_revocations_history_trigger
      BEFORE UPDATE OR DELETE ON square_merchant_revocations
      FOR EACH ROW EXECUTE FUNCTION enforce_square_merchant_revocation_history();
  END IF;
END $$;
