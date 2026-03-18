ALTER TABLE drink_collection_purchases
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'completed',
  ADD COLUMN IF NOT EXISTS status_reason text,
  ADD COLUMN IF NOT EXISTS access_revoked_at timestamp,
  ADD COLUMN IF NOT EXISTS updated_at timestamp NOT NULL DEFAULT now();

ALTER TABLE drink_collection_checkout_sessions
  ADD COLUMN IF NOT EXISTS refunded_at timestamp,
  ADD COLUMN IF NOT EXISTS access_revoked_at timestamp;

ALTER TABLE drink_collection_sales_ledger
  ADD COLUMN IF NOT EXISTS status_reason text,
  ADD COLUMN IF NOT EXISTS refunded_at timestamp;
