-- ChefSire back office, part 2: member account status, and a database-enforced append-only audit log.
-- New table + trigger only; no existing data touched. Applied to production before the code that reads them.
BEGIN;

-- No row = active. One current status per account; every change is also written to admin_audit_log.
CREATE TABLE IF NOT EXISTS account_status (
  user_id varchar PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  status text NOT NULL,
  reason text,
  changed_by varchar,
  changed_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT account_status_status_check CHECK (status IN ('restricted', 'suspended')),
  CONSTRAINT account_status_reason_check CHECK (reason IS NULL OR length(reason) <= 500)
);
CREATE INDEX IF NOT EXISTS account_status_status_idx ON account_status (status);

-- The audit log can be added to but never edited or deleted (review follow-up on #1479).
CREATE OR REPLACE FUNCTION admin_audit_log_append_only() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'admin_audit_log is append-only';
END;
$$;
DROP TRIGGER IF EXISTS admin_audit_log_no_update_delete ON admin_audit_log;
CREATE TRIGGER admin_audit_log_no_update_delete BEFORE UPDATE OR DELETE ON admin_audit_log
  FOR EACH ROW EXECUTE FUNCTION admin_audit_log_append_only();

COMMIT;
