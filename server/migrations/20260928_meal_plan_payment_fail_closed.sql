-- P2-01: make the payment/acquisition distinction durable before any new
-- application behavior depends on it. PostgreSQL executes this migration in a
-- transaction; ALTER TABLE takes a lock, and the validated CHECK is present at
-- commit, so a rolling/stale writer cannot insert its old explicit `completed`.
ALTER TABLE meal_plan_purchases
  ADD COLUMN IF NOT EXISTS acquisition_type text NOT NULL DEFAULT 'legacy_unverified',
  ADD COLUMN IF NOT EXISTS payment_provider text,
  ADD COLUMN IF NOT EXISTS provider_payment_id text,
  ADD COLUMN IF NOT EXISTS provider_payment_status text,
  ADD COLUMN IF NOT EXISTS payment_verified_at timestamptz;

ALTER TABLE meal_plan_purchases
  ALTER COLUMN payment_status SET DEFAULT 'unverified';

-- The removed handler never persisted provider evidence. Preserve those rows,
-- but explicitly classify them as history rather than entitlement/payment.
UPDATE meal_plan_purchases
SET payment_status = 'legacy_unverified',
    acquisition_type = 'legacy_unverified',
    payment_provider = NULL,
    provider_payment_id = NULL,
    provider_payment_status = NULL,
    payment_verified_at = NULL
WHERE payment_status = 'completed';

-- Deterministically rebuild paid sales. Free acquisitions are entitlements,
-- not sales, and therefore deliberately do not contribute here.
UPDATE meal_plan_blueprints b
SET sales_count = authoritative.paid_sales
FROM (
  SELECT b2.id,
    COUNT(p.id) FILTER (
      WHERE p.payment_status = 'verified_paid'
        AND p.acquisition_type = 'paid'
        AND p.payment_provider IS NOT NULL
        AND btrim(p.payment_provider) <> ''
        AND p.provider_payment_id IS NOT NULL
        AND btrim(p.provider_payment_id) <> ''
        AND p.provider_payment_status = 'COMPLETED'
        AND p.payment_verified_at IS NOT NULL
    )::int AS paid_sales
  FROM meal_plan_blueprints b2
  LEFT JOIN meal_plan_purchases p ON p.blueprint_id = b2.id
  GROUP BY b2.id
) authoritative
WHERE authoritative.id = b.id;

-- creator_analytics was written only by this legacy meal-plan purchase path.
-- Rebuild every existing daily bucket from authoritative paid rows, including
-- zeroing dates whose previous values came only from simulated purchases.
UPDATE creator_analytics ca
SET total_sales = authoritative.paid_sales,
    total_revenue_cents = authoritative.paid_revenue,
    updated_at = NOW()
FROM (
  SELECT ca2.id,
    COUNT(p.id) FILTER (
      WHERE p.payment_status = 'verified_paid'
        AND p.acquisition_type = 'paid'
        AND p.payment_provider IS NOT NULL
        AND btrim(p.payment_provider) <> ''
        AND p.provider_payment_id IS NOT NULL
        AND btrim(p.provider_payment_id) <> ''
        AND p.provider_payment_status = 'COMPLETED'
        AND p.payment_verified_at IS NOT NULL
    )::int AS paid_sales,
    COALESCE(SUM(p.price_paid_cents) FILTER (
      WHERE p.payment_status = 'verified_paid'
        AND p.acquisition_type = 'paid'
        AND p.payment_provider IS NOT NULL
        AND btrim(p.payment_provider) <> ''
        AND p.provider_payment_id IS NOT NULL
        AND btrim(p.provider_payment_id) <> ''
        AND p.provider_payment_status = 'COMPLETED'
        AND p.payment_verified_at IS NOT NULL
    ), 0)::int AS paid_revenue
  FROM creator_analytics ca2
  LEFT JOIN meal_plan_blueprints b ON b.creator_id = ca2.creator_id
  LEFT JOIN meal_plan_purchases p
    ON p.blueprint_id = b.id AND p.created_at::date::text = ca2.date
  GROUP BY ca2.id
) authoritative
WHERE authoritative.id = ca.id;

-- One live entitlement per user/plan and one provider payment per purchase.
CREATE UNIQUE INDEX IF NOT EXISTS meal_plan_purchases_entitlement_identity_uidx
  ON meal_plan_purchases(user_id, blueprint_id)
  WHERE payment_status IN ('free_acquired', 'verified_paid');
CREATE UNIQUE INDEX IF NOT EXISTS meal_plan_purchases_provider_payment_uidx
  ON meal_plan_purchases(payment_provider, provider_payment_id)
  WHERE provider_payment_id IS NOT NULL;

-- This guard covers INSERT and UPDATE. `completed` is never authoritative.
-- Paid entitlement requires the entire provider evidence tuple; free
-- entitlement requires authoritative zero price and an empty provider tuple.
ALTER TABLE meal_plan_purchases
  DROP CONSTRAINT IF EXISTS meal_plan_purchases_authoritative_evidence_chk;
ALTER TABLE meal_plan_purchases
  ADD CONSTRAINT meal_plan_purchases_authoritative_evidence_chk CHECK (
    (
      payment_status = 'verified_paid'
      AND acquisition_type = 'paid'
      AND price_paid_cents > 0
      AND payment_provider IS NOT NULL AND btrim(payment_provider) <> ''
      AND provider_payment_id IS NOT NULL AND btrim(provider_payment_id) <> ''
      AND provider_payment_status = 'COMPLETED'
      AND payment_verified_at IS NOT NULL
    ) OR (
      payment_status = 'free_acquired'
      AND acquisition_type = 'free'
      AND price_paid_cents = 0
      AND payment_provider IS NULL
      AND provider_payment_id IS NULL
      AND provider_payment_status IS NULL
      AND payment_verified_at IS NULL
      AND transaction_id IS NULL
    ) OR (
      payment_status NOT IN ('completed', 'verified_paid', 'free_acquired')
      AND acquisition_type = 'legacy_unverified'
      AND payment_verified_at IS NULL
    )
  );
