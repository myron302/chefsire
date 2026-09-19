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
