-- Catering Phase 2Q post-merge hotfix: a durable, additive mark that an EXPIRED Square checkout was verified safe to replace.
--
-- A checkout whose Square payment link is past its lifetime is only ever retired after fresh Square evidence shows no payment, its link is
-- confirmed removed, and fresh evidence is read AGAIN afterwards. This timestamp records that the second read happened, so a concurrent
-- request cannot create a replacement checkout while another is still verifying. Nothing is rewritten; additive and idempotent.
ALTER TABLE catering_booking_payment_attempts ADD COLUMN IF NOT EXISTS expiry_verified_at timestamptz;
