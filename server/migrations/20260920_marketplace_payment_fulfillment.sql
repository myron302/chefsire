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
  ADD COLUMN IF NOT EXISTS payment_provider text,
  ADD COLUMN IF NOT EXISTS provider_payment_status text,
  ADD COLUMN IF NOT EXISTS payment_captured_at timestamp,
  ADD COLUMN IF NOT EXISTS updated_at timestamp DEFAULT now();

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
