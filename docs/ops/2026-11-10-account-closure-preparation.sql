-- Part 3b preparatory migration ONLY: no rows are closed and no personal data is changed.
-- Do NOT apply to production without Myron's explicit approval and a verified backup.
-- Permanent-closure execution remains disabled until legal retention review, ledger inventory,
-- closure/financial-write concurrency tests and audited media cleanup are finished.
BEGIN;
ALTER TABLE account_status DROP CONSTRAINT IF EXISTS account_status_status_check;
ALTER TABLE account_status ADD CONSTRAINT account_status_status_check
  CHECK (status IN ('restricted', 'suspended', 'deactivated', 'closed'));
COMMIT;
