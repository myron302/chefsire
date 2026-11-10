-- Member self-service deactivation (back office part 3a). Widens the allowed account_status values; no row changes.
-- deactivated: the member chose to deactivate. Hidden like a suspended account and signed out everywhere, but
-- signing in again (any method) reactivates it with everything exactly as it was. Nothing is deleted.
BEGIN;
ALTER TABLE account_status DROP CONSTRAINT IF EXISTS account_status_status_check;
ALTER TABLE account_status ADD CONSTRAINT account_status_status_check CHECK (status IN ('restricted', 'suspended', 'deactivated'));
COMMIT;
