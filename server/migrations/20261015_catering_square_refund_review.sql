-- Catering Phase 2Q post-merge hotfix: a durable, additive "refund review" mark on a payment attempt.
--
-- A COMPLETED attempt keeps its ledger link, and the reconciliation CHECK says a reconciliation_required attempt has none, so refund activity
-- discovered AFTER a payment was credited cannot be recorded by changing the attempt's state. This column records it without touching the state, the
-- ledger payment or any evidence. Additive and idempotent; no data is rewritten.
ALTER TABLE catering_booking_payment_attempts ADD COLUMN IF NOT EXISTS refund_review_at timestamptz;
