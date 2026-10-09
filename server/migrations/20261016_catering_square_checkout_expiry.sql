-- Catering Phase 2Q post-merge hotfix: a durable, additive "verified after the link was closed" mark on a payment attempt.
--
-- Set ONLY when fresh Square evidence was read successfully (an authoritative answer: order open or closed with no completed payment, never a
-- request, an attempted poll, an unavailable Square or a payment still processing) AFTER the attempt's Square payment link was confirmed removed.
-- It is what permits (a) a replacement checkout for an expired attempt and (b) a provider credential to be discarded without reading that
-- attempt again. Polling timestamps are NOT evidence and are never consulted. Nothing is rewritten; additive and idempotent.
ALTER TABLE catering_booking_payment_attempts ADD COLUMN IF NOT EXISTS closure_verified_at timestamptz;
