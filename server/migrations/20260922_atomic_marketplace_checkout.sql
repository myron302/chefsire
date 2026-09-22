-- P1-05: new marketplace checkouts reserve stock and carry immutable,
-- server-authored accounting snapshots. Historical inventory effects cannot be
-- reconstructed safely, so every pre-migration order remains fail-closed.
ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS checkout_idempotency_key varchar(64),
  ADD COLUMN IF NOT EXISTS seller_tier_snapshot text,
  ADD COLUMN IF NOT EXISTS commission_rate_snapshot numeric(5,2),
  ADD COLUMN IF NOT EXISTS inventory_reservation_expires_at timestamp,
  ADD COLUMN IF NOT EXISTS inventory_status text;

UPDATE orders
SET inventory_status = 'legacy_unverified'
WHERE inventory_status IS NULL;

ALTER TABLE orders ALTER COLUMN inventory_status SET DEFAULT 'legacy_unverified';
ALTER TABLE orders ALTER COLUMN inventory_status SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS orders_buyer_checkout_idempotency_uidx
  ON orders (buyer_id, checkout_idempotency_key)
  WHERE checkout_idempotency_key IS NOT NULL;

CREATE INDEX IF NOT EXISTS orders_inventory_reservation_expiry_idx
  ON orders (inventory_status, payment_status, inventory_reservation_expires_at);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'orders_inventory_status_check'
      AND conrelid = 'orders'::regclass
  ) THEN
    ALTER TABLE orders ADD CONSTRAINT orders_inventory_status_check CHECK (
      inventory_status IN ('reserved', 'sold', 'released', 'legacy_unverified')
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
        AND (inventory_status <> 'reserved' OR inventory_reservation_expires_at IS NOT NULL)
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
ALTER TABLE products VALIDATE CONSTRAINT products_inventory_nonnegative_check;
ALTER TABLE orders VALIDATE CONSTRAINT orders_sold_inventory_payment_evidence_check;
