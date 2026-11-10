-- ChefSire back office, part 1: group-based staff permissions and an append-only audit log.
-- New tables only; no existing data touched. Applied to production before the code that reads them.
--
-- Model (Active Directory style): permissions are granted to groups; staff accounts are members of groups.
-- The Owners are the accounts in the INTERNAL_ADMIN_EMAILS allowlist (verified email); they implicitly hold every
-- permission and cannot be removed from the panel, so the business can never lock itself out.
BEGIN;

CREATE TABLE IF NOT EXISTS staff_groups (
  id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  built_in boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT staff_groups_name_check CHECK (length(btrim(name)) BETWEEN 2 AND 60)
);
CREATE UNIQUE INDEX IF NOT EXISTS staff_groups_name_unique ON staff_groups (lower(name));

CREATE TABLE IF NOT EXISTS staff_group_permissions (
  group_id varchar NOT NULL REFERENCES staff_groups(id) ON DELETE CASCADE,
  permission text NOT NULL,
  PRIMARY KEY (group_id, permission)
);

CREATE TABLE IF NOT EXISTS staff_group_members (
  group_id varchar NOT NULL REFERENCES staff_groups(id) ON DELETE CASCADE,
  user_id varchar NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  added_by varchar,
  added_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (group_id, user_id)
);
CREATE INDEX IF NOT EXISTS staff_group_members_user_idx ON staff_group_members (user_id);

-- Append-only. No foreign keys on purpose: entries must outlive the accounts and records they describe.
CREATE TABLE IF NOT EXISTS admin_audit_log (
  id bigserial PRIMARY KEY,
  actor_id varchar,
  actor_label text,
  action text NOT NULL,
  target_type text,
  target_id text,
  reason text,
  details jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS admin_audit_log_created_idx ON admin_audit_log (created_at DESC);
CREATE INDEX IF NOT EXISTS admin_audit_log_target_idx ON admin_audit_log (target_type, target_id, created_at DESC);
CREATE INDEX IF NOT EXISTS admin_audit_log_actor_idx ON admin_audit_log (actor_id, created_at DESC);

-- Built-in groups (editable permissions; cannot be deleted). Fixed ids so the seed is idempotent.
INSERT INTO staff_groups (id, name, description, built_in) VALUES
  ('grp-administrators', 'Administrators', 'Everything except managing staff groups.', true),
  ('grp-support', 'Support', 'Help members: view accounts and orders, restrict or suspend accounts, cancel unpaid orders.', true),
  ('grp-marketing', 'Marketing', 'View members, orders and reports. No account or money actions.', true)
ON CONFLICT (id) DO NOTHING;

INSERT INTO staff_group_permissions (group_id, permission) VALUES
  ('grp-administrators', 'members.view'), ('grp-administrators', 'members.restrict'), ('grp-administrators', 'members.suspend'),
  ('grp-administrators', 'members.close'), ('grp-administrators', 'orders.view'), ('grp-administrators', 'orders.cancel'),
  ('grp-administrators', 'orders.refund'), ('grp-administrators', 'reports.view'), ('grp-administrators', 'audit.view'),
  ('grp-support', 'members.view'), ('grp-support', 'members.restrict'), ('grp-support', 'members.suspend'),
  ('grp-support', 'orders.view'), ('grp-support', 'orders.cancel'),
  ('grp-marketing', 'members.view'), ('grp-marketing', 'orders.view'), ('grp-marketing', 'reports.view')
ON CONFLICT DO NOTHING;

COMMIT;
