-- Explicit optimistic revision for payment-specific reconciliation.
-- Every success or invalidation increments this value, including NULL-to-NULL
-- failures. An earlier clean provider check may never overwrite a newer
-- failed/refunded/disputed provider check.
-- Additive, defaults safely to zero for all existing evidence.
ALTER TABLE wedding_square_invoice_evidence
  ADD COLUMN IF NOT EXISTS reconciliation_revision integer NOT NULL DEFAULT 0;
