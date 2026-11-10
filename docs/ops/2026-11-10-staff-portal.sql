-- ChefSire staff portal (ops.chefsire.com): employee identities that are separate from member accounts.
-- New tables plus one added column with a default; no existing row is modified. Applied to production before the
-- code that reads them.
--
-- Staff are not ChefSire members. They sign in on ops.chefsire.com with their own login, password and mandatory
-- authenticator-app code (TOTP). Permissions still come from staff_groups / staff_group_permissions (part 1); staff
-- are placed in groups through staff_user_groups. staff_group_members (member accounts in groups) is no longer read.
-- Owners are staff accounts with is_owner = true (they hold every permission, including managing staff).
-- Later, an identity provider (Microsoft Entra ID over OIDC) can sign staff in: external_issuer/external_subject
-- identify the person and staff_groups.external_group_id maps a directory security group to a ChefSire group.
BEGIN;

CREATE TABLE IF NOT EXISTS staff_users (
  id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  login text NOT NULL,
  display_name text NOT NULL,
  email text,
  password_hash text,
  totp_secret_enc text,
  totp_pending_enc text,
  totp_last_step bigint,
  mfa_enabled_at timestamptz,
  is_owner boolean NOT NULL DEFAULT false,
  status text NOT NULL DEFAULT 'active',
  failed_attempts integer NOT NULL DEFAULT 0,
  locked_until timestamptz,
  external_issuer text,
  external_subject text,
  created_by varchar,
  created_at timestamptz NOT NULL DEFAULT now(),
  last_login_at timestamptz,
  CONSTRAINT staff_users_login_check CHECK (login ~ '^[a-z0-9][a-z0-9._-]{1,39}$'),
  CONSTRAINT staff_users_status_check CHECK (status IN ('active', 'disabled')),
  CONSTRAINT staff_users_name_check CHECK (length(btrim(display_name)) BETWEEN 1 AND 80)
);
CREATE UNIQUE INDEX IF NOT EXISTS staff_users_login_unique ON staff_users (login);
CREATE UNIQUE INDEX IF NOT EXISTS staff_users_external_unique ON staff_users (external_issuer, external_subject)
  WHERE external_subject IS NOT NULL;

-- Sessions are server-side; the browser only holds a random id whose SHA-256 is stored here.
-- stage: 'mfa' = password accepted, code still required; 'enroll' = must set up the authenticator; 'full' = signed in.
CREATE TABLE IF NOT EXISTS staff_sessions (
  id_hash text PRIMARY KEY,
  staff_user_id varchar NOT NULL REFERENCES staff_users(id) ON DELETE CASCADE,
  stage text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  revoked_at timestamptz,
  ip text,
  user_agent text,
  CONSTRAINT staff_sessions_stage_check CHECK (stage IN ('mfa', 'enroll', 'full'))
);
CREATE INDEX IF NOT EXISTS staff_sessions_user_idx ON staff_sessions (staff_user_id);

-- One-time recovery codes (hashes only), issued when the authenticator is set up.
CREATE TABLE IF NOT EXISTS staff_recovery_codes (
  staff_user_id varchar NOT NULL REFERENCES staff_users(id) ON DELETE CASCADE,
  code_hash text NOT NULL,
  used_at timestamptz,
  PRIMARY KEY (staff_user_id, code_hash)
);

-- Invite-only: a single-use, expiring link (hash stored) creates the staff account. The same kind of link, with
-- staff_user_id set, lets an existing staff member set a new password and authenticator after an Owner resets them.
CREATE TABLE IF NOT EXISTS staff_invites (
  token_hash text PRIMARY KEY,
  staff_user_id varchar REFERENCES staff_users(id) ON DELETE CASCADE,
  login text NOT NULL,
  display_name text NOT NULL,
  email text,
  is_owner boolean NOT NULL DEFAULT false,
  group_ids text[] NOT NULL DEFAULT '{}',
  created_by varchar,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  used_at timestamptz,
  revoked_at timestamptz
);

CREATE TABLE IF NOT EXISTS staff_user_groups (
  staff_user_id varchar NOT NULL REFERENCES staff_users(id) ON DELETE CASCADE,
  group_id varchar NOT NULL REFERENCES staff_groups(id) ON DELETE CASCADE,
  added_by varchar,
  added_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (staff_user_id, group_id)
);
CREATE INDEX IF NOT EXISTS staff_user_groups_group_idx ON staff_user_groups (group_id);

-- Directory mapping for the future identity provider (e.g. an Entra ID security group's object id).
ALTER TABLE staff_groups ADD COLUMN IF NOT EXISTS external_group_id text;
CREATE UNIQUE INDEX IF NOT EXISTS staff_groups_external_unique ON staff_groups (external_group_id) WHERE external_group_id IS NOT NULL;

-- Who acted: existing entries were written by member accounts ('member'); the portal writes 'staff'.
-- A constant default is a catalog-only change: no existing row is rewritten (the append-only trigger is not fired).
ALTER TABLE admin_audit_log ADD COLUMN IF NOT EXISTS actor_type text NOT NULL DEFAULT 'member';

COMMIT;
