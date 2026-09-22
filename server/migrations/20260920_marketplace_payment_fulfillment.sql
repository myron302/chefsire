-- P1-03: fulfillment is not evidence of provider-captured customer payment.
-- Existing rows remain unverified; no historical financial state is rewritten.
ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS payment_status text NOT NULL DEFAULT 'unverified',
  ADD COLUMN IF NOT EXISTS square_refund_id text,
  ADD COLUMN IF NOT EXISTS capture_idempotency_key text,
  ADD COLUMN IF NOT EXISTS capture_attempted_at timestamp,
  ADD COLUMN IF NOT EXISTS refund_idempotency_key text,
  ADD COLUMN IF NOT EXISTS refund_attempt_payment_id text,
  ADD COLUMN IF NOT EXISTS refund_attempt_amount_cents integer,
  ADD COLUMN IF NOT EXISTS refund_attempt_currency text,
  ADD COLUMN IF NOT EXISTS refund_attempt_reason text,
  ADD COLUMN IF NOT EXISTS last_payment_failure_code text,
  ADD COLUMN IF NOT EXISTS last_failed_refund_id text,
  ADD COLUMN IF NOT EXISTS last_refund_failure_status text,
  ADD COLUMN IF NOT EXISTS seller_revenue_status text,
  ADD COLUMN IF NOT EXISTS payment_provider text,
  ADD COLUMN IF NOT EXISTS provider_payment_status text,
  ADD COLUMN IF NOT EXISTS payment_captured_at timestamp,
  ADD COLUMN IF NOT EXISTS updated_at timestamp DEFAULT now();

-- Existing P1-03 captures have deterministic transaction state. All older
-- unverified rows remain explicitly ambiguous because legacy order creation
-- was not atomic with its monthly_revenue update.
UPDATE orders SET seller_revenue_status = CASE
  WHEN payment_status IN ('captured', 'refund_pending') THEN 'credited'
  WHEN payment_status = 'refunded' THEN 'reversed'
  WHEN payment_status = 'capture_reconciliation' THEN 'uncredited'
  ELSE 'legacy_unverified'
END WHERE seller_revenue_status IS NULL;
ALTER TABLE orders ALTER COLUMN seller_revenue_status SET DEFAULT 'uncredited';
ALTER TABLE orders ALTER COLUMN seller_revenue_status SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'orders_seller_revenue_status_check'
      AND conrelid = 'orders'::regclass
  ) THEN
    ALTER TABLE orders ADD CONSTRAINT orders_seller_revenue_status_check CHECK (
      seller_revenue_status IN ('uncredited', 'credited', 'reversed', 'legacy_unverified')
    ) NOT VALID;
  END IF;
END $$;
ALTER TABLE orders VALIDATE CONSTRAINT orders_seller_revenue_status_check;

CREATE INDEX IF NOT EXISTS orders_payment_status_idx ON orders(payment_status);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'orders_captured_payment_evidence_check'
      AND conrelid = 'orders'::regclass
  ) THEN
    ALTER TABLE orders ADD CONSTRAINT orders_captured_payment_evidence_check CHECK (
      payment_status <> 'captured' OR (
        payment_provider = 'square'
        AND square_payment_id IS NOT NULL
        AND square_payment_id !~ '^[[:space:]]*$'
        AND capture_idempotency_key IS NOT NULL
        AND capture_idempotency_key !~ '^[[:space:]]*$'
        AND provider_payment_status = 'COMPLETED'
        AND payment_captured_at IS NOT NULL
      )
    ) NOT VALID;
  END IF;
END $$;

-- All legacy rows received `unverified`, so validation preserves their contents.
ALTER TABLE orders VALIDATE CONSTRAINT orders_captured_payment_evidence_check;
