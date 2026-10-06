-- Phase 2Q Gate 0 repair: Square merchant and location identifiers are stored at full width.
--
-- payment_methods.provider_id is text, so a Square merchant id of any length can be persisted on a connection row. The merchant
-- revocation history (20261010) first keyed itself by varchar(64): a longer id would make the confirmed-disconnect INSERT fail
-- AFTER Square had already revoked the grant. The key is now text, matching provider_id exactly. location_id (20261007) had the
-- same narrow width and is widened for the same reason (a verification write must never fail on a valid provider identifier).
--
-- Idempotent, additive in effect (no value changes; varchar -> text only removes a length limit), and it takes effect on
-- databases that applied the earlier narrow revisions. A fresh database already creates the revocation key as text.
ALTER TABLE square_merchant_revocations ALTER COLUMN merchant_id TYPE text;
ALTER TABLE payment_methods ALTER COLUMN location_id TYPE text;
