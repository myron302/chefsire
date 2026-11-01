-- Additive payment-specific reconciliation fields. This is the ONLY
-- freshness evidence allowed for Wedding paid access: a subscription status
-- or cancellation readback must never refresh a paid invoice.
-- Existing rows remain UNTRUSTED (NULL) until a verified Square payment,
-- refund and dispute reconciliation explicitly records this state.
ALTER TABLE wedding_square_invoice_evidence
  ADD COLUMN IF NOT EXISTS last_payment_reconciled_at timestamptz,
  ADD COLUMN IF NOT EXISTS payment_revoked_at timestamptz;
