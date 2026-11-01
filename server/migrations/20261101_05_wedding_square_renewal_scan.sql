-- Reviewed additive poll cursor for Square subscription invoice renewals.
-- Never a payment, approval, trial, or paid entitlement timestamp.
-- NULL means eligible for first provider readback. A claimed scan persists
-- before network reads so ambiguous Square failures cannot starve other owners.
ALTER TABLE wedding_square_subscriptions
  ADD COLUMN IF NOT EXISTS last_renewal_scan_at timestamptz;

CREATE INDEX IF NOT EXISTS wedding_square_subscriptions_renewal_scan_idx
  ON wedding_square_subscriptions (last_renewal_scan_at ASC NULLS FIRST, id)
  WHERE square_environment = 'sandbox' AND provider_status IN ('PENDING','ACTIVE');
