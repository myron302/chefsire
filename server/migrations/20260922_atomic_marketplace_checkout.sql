-- P1-05: new marketplace checkouts reserve stock and carry immutable,
-- server-authored accounting snapshots. Historical inventory effects cannot be
-- reconstructed safely, so every pre-migration order remains fail-closed.
ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS checkout_idempotency_key varchar(64),
  ADD COLUMN IF NOT EXISTS seller_tier_snapshot text,
  ADD COLUMN IF NOT EXISTS commission_rate_snapshot numeric(5,2),
  ADD COLUMN IF NOT EXISTS inventory_status text;

-- Preserve P1-03's already-durable attempts and authoritative captures without
-- pretending older unverified rows are trustworthy. The order already holds
-- immutable monetary amounts; the historical rate is derived from its stored
-- commission/seller split, never from current client input or mutable tier.
UPDATE orders
SET
  inventory_status = CASE
    WHEN payment_status = 'capture_pending'
      AND capture_idempotency_key IS NOT NULL
      AND capture_idempotency_key !~ '^[[:space:]]*$'
      AND seller_revenue_status = 'uncredited'
      AND (platform_fee + seller_amount) > 0
      THEN 'reserved'
    WHEN payment_status = 'capture_reconciliation'
      AND payment_provider = 'square'
      AND square_payment_id IS NOT NULL
      AND square_payment_id !~ '^[[:space:]]*$'
      AND capture_idempotency_key IS NOT NULL
      AND capture_idempotency_key !~ '^[[:space:]]*$'
      AND provider_payment_status = 'COMPLETED'
      AND payment_captured_at IS NOT NULL
      AND seller_revenue_status = 'uncredited'
      AND (platform_fee + seller_amount) > 0
      THEN 'reserved'
    WHEN payment_status IN ('captured', 'refund_pending', 'refund_reconciliation', 'refunded')
      AND payment_provider = 'square'
      AND square_payment_id IS NOT NULL
      AND square_payment_id !~ '^[[:space:]]*$'
      AND capture_idempotency_key IS NOT NULL
      AND capture_idempotency_key !~ '^[[:space:]]*$'
      AND payment_captured_at IS NOT NULL
      AND seller_revenue_status IN ('credited', 'reversed')
      AND (platform_fee + seller_amount) > 0
      THEN 'sold'
    ELSE 'legacy_unverified'
  END,
  checkout_idempotency_key = CASE
    WHEN payment_status IN ('capture_pending', 'capture_reconciliation', 'captured', 'refund_pending', 'refund_reconciliation', 'refunded')
      AND capture_idempotency_key IS NOT NULL
      AND capture_idempotency_key !~ '^[[:space:]]*$'
      AND (platform_fee + seller_amount) > 0
      THEN 'p1-03:' || id
    ELSE checkout_idempotency_key
  END,
  seller_tier_snapshot = CASE
    WHEN payment_status IN ('capture_pending', 'capture_reconciliation', 'captured', 'refund_pending', 'refund_reconciliation', 'refunded')
      AND capture_idempotency_key IS NOT NULL
      AND capture_idempotency_key !~ '^[[:space:]]*$'
      AND (platform_fee + seller_amount) > 0
      THEN 'legacy_p1_03'
    ELSE seller_tier_snapshot
  END,
  commission_rate_snapshot = CASE
    WHEN payment_status IN ('capture_pending', 'capture_reconciliation', 'captured', 'refund_pending', 'refund_reconciliation', 'refunded')
      AND capture_idempotency_key IS NOT NULL
      AND capture_idempotency_key !~ '^[[:space:]]*$'
      AND (platform_fee + seller_amount) > 0
      THEN round((platform_fee / (platform_fee + seller_amount)) * 100, 2)
    ELSE commission_rate_snapshot
  END
-- Match both a column that has never been backfilled (IS NULL) and one a
-- schema push already defaulted to 'legacy_unverified' before this backfill
-- ran. The CASE above only ever promotes a row when its own immutable
-- payment/capture columns already prove reserved or sold; a row with no such
-- evidence re-evaluates to 'legacy_unverified' and is left exactly as is, so
-- this is safe to (re)run on every push, not a blind reclassification.
WHERE inventory_status IS NULL OR inventory_status = 'legacy_unverified';

ALTER TABLE orders ALTER COLUMN inventory_status SET DEFAULT 'legacy_unverified';
ALTER TABLE orders ALTER COLUMN inventory_status SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS orders_buyer_checkout_idempotency_uidx
  ON orders (buyer_id, checkout_idempotency_key)
  WHERE checkout_idempotency_key IS NOT NULL;

-- P1-03 already applies commission in the capture transaction. Make its
-- exactly-once property survive application bugs and multiple server instances.
-- Existing duplicate financial history is never deleted or rewritten: a dirty
-- database fails this migration and requires explicit reconciliation.
CREATE UNIQUE INDEX IF NOT EXISTS commissions_order_uidx ON commissions (order_id);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'orders_inventory_status_check'
      AND conrelid = 'orders'::regclass
  ) THEN
    ALTER TABLE orders ADD CONSTRAINT orders_inventory_status_check CHECK (
      inventory_status IN ('unreserved', 'reserved', 'sold', 'released', 'legacy_unverified')
    ) NOT VALID;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'orders_inventory_payment_lifecycle_check'
      AND conrelid = 'orders'::regclass
  ) THEN
    ALTER TABLE orders ADD CONSTRAINT orders_inventory_payment_lifecycle_check CHECK (
      inventory_status = 'legacy_unverified'
      OR (inventory_status = 'unreserved' AND payment_status = 'unverified')
      OR (inventory_status = 'reserved' AND payment_status IN ('capture_pending', 'capture_reconciliation'))
      OR (inventory_status = 'released' AND payment_status = 'unverified')
      OR (inventory_status = 'sold' AND payment_status IN ('captured', 'refund_pending', 'refund_reconciliation', 'refunded'))
    ) NOT VALID;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'orders_trusted_checkout_snapshot_check'
      AND conrelid = 'orders'::regclass
  ) THEN
    ALTER TABLE orders ADD CONSTRAINT orders_trusted_checkout_snapshot_check CHECK (
      inventory_status = 'legacy_unverified' OR (
        checkout_idempotency_key IS NOT NULL
        AND seller_tier_snapshot IS NOT NULL
        AND commission_rate_snapshot IS NOT NULL
      )
    ) NOT VALID;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'products_inventory_nonnegative_check'
      AND conrelid = 'products'::regclass
  ) THEN
    ALTER TABLE products ADD CONSTRAINT products_inventory_nonnegative_check
      CHECK (inventory IS NULL OR inventory >= 0) NOT VALID;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'orders_sold_inventory_payment_evidence_check'
      AND conrelid = 'orders'::regclass
  ) THEN
    ALTER TABLE orders ADD CONSTRAINT orders_sold_inventory_payment_evidence_check CHECK (
      inventory_status <> 'sold' OR (
        payment_status IN ('captured', 'refund_pending', 'refund_reconciliation', 'refunded')
        AND payment_provider = 'square'
        AND square_payment_id IS NOT NULL
        AND provider_payment_status IS NOT NULL
        AND payment_captured_at IS NOT NULL
      )
    ) NOT VALID;
  END IF;
END $$;

ALTER TABLE orders VALIDATE CONSTRAINT orders_inventory_status_check;
ALTER TABLE orders VALIDATE CONSTRAINT orders_trusted_checkout_snapshot_check;
ALTER TABLE orders VALIDATE CONSTRAINT orders_inventory_payment_lifecycle_check;
ALTER TABLE products VALIDATE CONSTRAINT products_inventory_nonnegative_check;
ALTER TABLE orders VALIDATE CONSTRAINT orders_sold_inventory_payment_evidence_check;

-- Crash-window reservation reconciliation: distinguish "a capture attempt was
-- dispatched to Square" from "a reservation exists but nothing was ever
-- sent", so an abandoned capture_pending reservation from a crash before the
-- provider call can be released without ever inventing provider evidence.
--
-- This column is intentionally nullable with no default: after it is added,
-- application code sets it only in a dedicated claim step, strictly after a
-- fresh reservation commits and strictly before the provider is called, so a
-- brand-new in-flight reservation is legitimately (and only briefly) NULL.
-- That means this backfill must run exactly once, the moment the column is
-- introduced, and never again -- a `WHERE ... IS NULL` guard would be unsafe
-- to rerun, since it would just as happily "backfill" (and thereby poison)
-- every live reservation currently between those two steps on every later
-- db:push. The one-time IF NOT EXISTS gate below is what makes it safe to
-- run on every push: after the first successful run the column always
-- exists, so this entire block becomes a permanent no-op.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = current_schema() AND table_name = 'orders' AND column_name = 'capture_request_submitted_at'
  ) THEN
    ALTER TABLE orders ADD COLUMN capture_request_submitted_at timestamp;
    -- Every row already at capture_pending/capture_reconciliation at this
    -- exact moment predates the concept entirely; it may already have had a
    -- request dispatched to Square and there is no way to prove otherwise,
    -- so it is conservatively marked "submitted" and must still be
    -- reconciled from Square's own evidence, exactly like today.
    UPDATE orders
    SET capture_request_submitted_at = COALESCE(capture_attempted_at, now())
    WHERE payment_status IN ('capture_pending', 'capture_reconciliation');
  END IF;
END $$;
