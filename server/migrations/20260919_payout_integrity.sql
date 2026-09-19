-- P1-04: one marketplace order may belong to at most one active/successful payout claim.
-- Abort rather than rewrite or delete financial history if legacy duplicates exist.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
      FROM commissions
     WHERE payout_id IS NOT NULL
       AND status IN ('pending', 'processing', 'paid')
     GROUP BY order_id
    HAVING count(*) > 1
  ) THEN
    RAISE EXCEPTION
      'Cannot enforce payout claim uniqueness: duplicate active commission claims require financial audit';
  END IF;
END $$;

-- Drizzle Kit cannot represent CHECK ... NOT VALID and may temporarily remove
-- the CHECK as database-only drift. This trigger preserves the identical rule
-- for every new/updated row throughout schema synchronization. Drizzle does not
-- manage PostgreSQL functions/triggers; the CHECK is restored after the push.
CREATE OR REPLACE FUNCTION enforce_payout_completed_transfer()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.status = 'completed' AND NOT (
    NEW.provider_payout_id IS NOT NULL
    AND NEW.provider_payout_id !~ '^[[:space:]]*$'
    AND left(regexp_replace(NEW.provider_payout_id, '^[[:space:]]+|[[:space:]]+$', '', 'g'), 10) <> 'sq_payout_'
    AND left(regexp_replace(NEW.provider_payout_id, '^[[:space:]]+|[[:space:]]+$', '', 'g'), 11) <> 'payout_sim_'
    AND NEW.processed_at IS NOT NULL
    AND NEW.completed_at IS NOT NULL
  ) THEN
    RAISE EXCEPTION 'completed payout requires verified provider transfer evidence'
      USING ERRCODE = 'check_violation', CONSTRAINT = 'payouts_completed_transfer_check';
  END IF;
  RETURN NEW;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
      FROM pg_trigger
     WHERE tgname = 'payouts_completed_transfer_trigger'
       AND tgrelid = 'payouts'::regclass
       AND NOT tgisinternal
  ) THEN
    CREATE TRIGGER payouts_completed_transfer_trigger
      BEFORE INSERT OR UPDATE OF status, provider_payout_id, processed_at, completed_at
      ON payouts
      FOR EACH ROW EXECUTE FUNCTION enforce_payout_completed_transfer();
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS commissions_active_payout_order_uidx
  ON commissions (order_id)
  WHERE payout_id IS NOT NULL AND status IN ('pending', 'processing', 'paid');

-- Preserve legacy rows for audit while making invalid completion states impossible
-- for every new or updated row. Existing rows can be validated after financial review.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
      FROM pg_constraint
     WHERE conname = 'payouts_completed_transfer_check'
       AND conrelid = 'payouts'::regclass
  ) THEN
    ALTER TABLE payouts
      ADD CONSTRAINT payouts_completed_transfer_check CHECK (
        status <> 'completed' OR (
          provider_payout_id IS NOT NULL
          AND provider_payout_id !~ '^[[:space:]]*$'
          -- Exact formats emitted by the removed placeholder implementation.
          AND left(regexp_replace(provider_payout_id, '^[[:space:]]+|[[:space:]]+$', '', 'g'), 10) <> 'sq_payout_'
          AND left(regexp_replace(provider_payout_id, '^[[:space:]]+|[[:space:]]+$', '', 'g'), 11) <> 'payout_sim_'
          AND processed_at IS NOT NULL
          AND completed_at IS NOT NULL
        )
      ) NOT VALID;
  END IF;
END $$;
