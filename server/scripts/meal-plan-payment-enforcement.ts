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
  );`;

const REASSERT_SQL = `
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

const LOCK_SQL = `LOCK TABLE meal_plan_purchases IN SHARE ROW EXCLUSIVE MODE`;

// Trusted rows are those the partial entitlement index covers. This runs after
// normalization, so malformed claims already became legacy_unverified.
const ENTITLEMENT_CONFLICT_SQL = `
SELECT user_id, blueprint_id, array_agg(id::text ORDER BY id::text) AS purchase_ids
FROM meal_plan_purchases
WHERE payment_status IN ('free_acquired', 'verified_paid')
GROUP BY user_id, blueprint_id
HAVING COUNT(*) > 1
ORDER BY user_id, blueprint_id
LIMIT 20`;

// Mirrors the (payment_provider, provider_payment_id) unique index: NULLs are
// distinct in PostgreSQL, so only fully non-null identities can collide.
const PROVIDER_CONFLICT_SQL = `
SELECT payment_provider, provider_payment_id, array_agg(id::text ORDER BY id::text) AS purchase_ids
FROM meal_plan_purchases
WHERE provider_payment_id IS NOT NULL AND payment_provider IS NOT NULL
GROUP BY payment_provider, provider_payment_id
HAVING COUNT(*) > 1
ORDER BY payment_provider, provider_payment_id
LIMIT 20`;

// Dropped and recreated (same transaction) so a drifted definition is
// replaced rather than left behind by IF NOT EXISTS.
const INDEX_SQL = `
DROP INDEX IF EXISTS meal_plan_purchases_entitlement_identity_uidx;
CREATE UNIQUE INDEX meal_plan_purchases_entitlement_identity_uidx
  ON meal_plan_purchases(user_id, blueprint_id)
  WHERE payment_status IN ('free_acquired', 'verified_paid');
DROP INDEX IF EXISTS meal_plan_purchases_provider_payment_uidx;
CREATE UNIQUE INDEX meal_plan_purchases_provider_payment_uidx
  ON meal_plan_purchases(payment_provider, provider_payment_id)
  WHERE provider_payment_id IS NOT NULL;`;

export class MealPlanPaymentIntegrityConflictError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "MealPlanPaymentIntegrityConflictError";
  }
}

type ConflictRows = { rows: Array<Record<string, unknown>> };

const ids = (row: Record<string, unknown>) =>
  (Array.isArray(row.purchase_ids) ? row.purchase_ids : []).map(String).join(",");

async function assertNoConflicts(client: MigrationClient) {
  const entitlement = await client.query(ENTITLEMENT_CONFLICT_SQL) as ConflictRows;
  if (entitlement.rows.length > 0) {
    const detail = entitlement.rows
      .map((r) => `user_id=${String(r.user_id)} blueprint_id=${String(r.blueprint_id)} purchase_ids=[${ids(r)}]`)
      .join("; ");
    throw new MealPlanPaymentIntegrityConflictError(
      `Meal-plan entitlement conflict: multiple authoritative purchases for one user/blueprint (${detail}). ` +
        "Manual reconciliation is required; no rows were changed.",
    );
  }
  const provider = await client.query(PROVIDER_CONFLICT_SQL) as ConflictRows;
  if (provider.rows.length > 0) {
    const detail = provider.rows
      .map((r) => `payment_provider=${String(r.payment_provider)} provider_payment_id=${String(r.provider_payment_id)} purchase_ids=[${ids(r)}]`)
      .join("; ");
    throw new MealPlanPaymentIntegrityConflictError(
      `Meal-plan provider-payment conflict: a provider payment is attached to multiple purchases (${detail}). ` +
        "Manual reconciliation is required; no rows were changed.",
    );
  }
}

/**
 * One transaction: normalize malformed authoritative claims (never deleting),
 * fail closed on collective duplicates that would violate the unique indexes,
 * then reassert the indexes and evidence CHECK. Any error rolls everything back.
 * Already-valid paid/free rows are untouched.
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
    await client.query(LOCK_SQL);
    await client.query(PREPARE_SQL);
    await assertNoConflicts(client);
    await client.query(INDEX_SQL);
    await client.query(REASSERT_SQL);
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  }
  return { purchases: true };
}
