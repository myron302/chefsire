-- P2-1: verification provenance, session versioning, and fail-closed handling of legacy credentials.
--
-- WHY LEGACY PASSWORDS ARE INVALIDATED
-- Before this change `POST /auth/signup` stored the caller's password on an unverified account, and email
-- verification / OAuth linking then marked that account verified WITHOUT touching the password. A
-- pre-hijacked account (attacker password + victim verification) and a legitimate signup produce
-- byte-for-byte the same row, so for any account that already has BOTH a verified timestamp AND a
-- password, nothing in the database can show the password was chosen by the verified owner. Security
-- fails closed: those passwords are NULLed. Affected users (the list is kept in
-- legacy_credential_invalidations) regain password login by using "resend verification": the emailed
-- link lets the real owner choose a new password, which replaces nothing they did not just type.
-- OAuth-only accounts (no password) are unaffected and keep signing in through their provider.
--
-- Additive and idempotent. No account is deleted, no timestamp or provider id is altered here.
--
-- DEPLOY ORDER (fail closed): run migrations BEFORE the application build that selects these columns.
-- Every access token issued before this change lacks the `av` claim and is rejected: all users sign
-- in once more (unavoidable, because a pre-hijack JWT cannot be told apart from a legitimate one).
ALTER TABLE users ADD COLUMN IF NOT EXISTS email_verified_via TEXT NULL;
ALTER TABLE users ADD COLUMN IF NOT EXISTS auth_version INTEGER NOT NULL DEFAULT 1;

CREATE TABLE IF NOT EXISTS legacy_credential_invalidations (
  user_id        VARCHAR PRIMARY KEY,
  email          TEXT NOT NULL,
  reason         TEXT NOT NULL,
  invalidated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO legacy_credential_invalidations (user_id, email, reason)
SELECT id, email, 'legacy password cannot be shown to postdate proof of email ownership'
FROM users
WHERE email_verified_at IS NOT NULL
  AND email_verified_via IS NULL
  AND password IS NOT NULL
ON CONFLICT (user_id) DO NOTHING;

UPDATE users
SET password = NULL
WHERE email_verified_at IS NOT NULL
  AND email_verified_via IS NULL
  AND password IS NOT NULL;

-- Provenance only for rows that never carried a legacy password: Google-only OAuth accounts. Everything
-- else with a historical timestamp (Facebook / TikTok / Instagram, or an invalidated password) stays NULL:
-- it keeps working for login where it can, holds no admin authority, and is re-provable by email link.
UPDATE users
SET email_verified_via = 'google'
WHERE email_verified_at IS NOT NULL
  AND email_verified_via IS NULL
  AND password IS NULL
  AND google_id IS NOT NULL
  AND provider = 'google'
  AND facebook_id IS NULL AND tiktok_id IS NULL AND instagram_id IS NULL
  AND id NOT IN (SELECT user_id FROM legacy_credential_invalidations);
