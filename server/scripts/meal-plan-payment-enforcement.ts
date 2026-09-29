import type { MigrationClient } from "./migration-runner";

export type MealPlanPaymentEnforcementState = { purchases: boolean };

const PREPARE_SQL = `
ALTER TABLE meal_plan_purchases
  ADD COLUMN IF NOT EXISTS acquisition_type text NOT NULL DEFAULT 'legacy_unverified',
  ADD COLUMN IF NOT EXISTS payment_provider text,
  ADD COLUMN IF NOT EXISTS provider_payment_id text,
  ADD COLUMN IF NOT EXISTS provider_payment_status text,
  ADD COLUMN IF NOT EXISTS payment_verified_at timestamptz;

ALTER TABLE meal_plan_purchases
  ALTER COLUMN payment_status SET DEFAULT 'unverified';

UPDATE meal_plan_purchases
SET payment_status = CASE
      WHEN payment_status IN ('completed', 'verified_paid', 'free_acquired') THEN 'legacy_unverified'
      ELSE payment_status
    END,
    acquisition_type = 'legacy_unverified',
    payment_verified_at = NULL
WHERE NOT (
    payment_status = 'verified_paid'
    AND acquisition_type = 'paid'
    AND price_paid_cents > 0
    AND payment_provider IS NOT NULL AND btrim(payment_provider) <> ''
    AND provider_payment_id IS NOT NULL AND btrim(provider_payment_id) <> ''
    AND provider_payment_status = 'COMPLETED'
    AND payment_verified_at IS NOT NULL
  ) AND NOT (
    payment_status = 'free_acquired'
    AND acquisition_type = 'free'
    AND price_paid_cents = 0
    AND payment_provider IS NULL
    AND provider_payment_id IS NULL
    AND provider_payment_status IS NULL
    AND payment_verified_at IS NULL
    AND transaction_id IS NULL
  );

ALTER TABLE meal_plan_purchases
  DROP CONSTRAINT IF EXISTS meal_plan_purchases_authoritative_evidence_chk;
ALTER TABLE meal_plan_purchases
  ADD CONSTRAINT meal_plan_purchases_authoritative_evidence_chk CHECK (
    (payment_status = 'verified_paid' AND acquisition_type = 'paid'
      AND price_paid_cents > 0
      AND payment_provider IS NOT NULL AND btrim(payment_provider) <> ''
      AND provider_payment_id IS NOT NULL AND btrim(provider_payment_id) <> ''
      AND provider_payment_status = 'COMPLETED' AND payment_verified_at IS NOT NULL)
    OR
    (payment_status = 'free_acquired' AND acquisition_type = 'free'
      AND price_paid_cents = 0 AND payment_provider IS NULL
      AND provider_payment_id IS NULL AND provider_payment_status IS NULL
      AND payment_verified_at IS NULL AND transaction_id IS NULL)
    OR
    (payment_status NOT IN ('completed', 'verified_paid', 'free_acquired')
      AND acquisition_type = 'legacy_unverified' AND payment_verified_at IS NULL)
  );`;

/**
 * Prepare old rows before Drizzle validates its CHECK, and reassert the same
 * database invariant after push. Invalid claimed-authoritative rows are
 * downgraded without deletion; already-valid paid/free rows are untouched.
 */
export async function enforceMealPlanPaymentIntegrity(
  client: MigrationClient,
  allowMissing: boolean,
): Promise<MealPlanPaymentEnforcementState> {
  const relation = await client.query(`SELECT to_regclass('meal_plan_purchases')::text AS purchases`) as {
    rows: Array<{ purchases: string | null }>;
  };
  const purchases = Boolean(relation.rows[0]?.purchases);
  if (!purchases) {
    if (allowMissing) return { purchases: false };
    throw new Error("Meal-plan payment integrity cannot be enforced: meal_plan_purchases does not exist.");
  }

  await client.query("BEGIN");
  try {
    await client.query(PREPARE_SQL);
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  }
  return { purchases: true };
}
