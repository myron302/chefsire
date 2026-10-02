-- P2-1: record WHERE users.email_verified_at came from, so a bare timestamp is never mistaken for proof.
--
-- Additive and idempotent. Nothing is deleted and no password, provider id or timestamp is altered;
-- `email_verified_via` only classifies history:
--   'google'     legacy Google-created / Google-linked row with no other provider identity
--   'email_link' legacy local row (no provider identity) -- login required the emailed link
--   NULL         everything else that carries a timestamp: rows touched by Facebook / TikTok / Instagram,
--                whose emails those providers never vouched for. They keep working for login but hold no
--                authority (admin) and are re-provable through resend-verification, which replaces the
--                password and discards the unproven provider identities.
--
-- DEPLOY ORDER (fail closed): run this migration BEFORE deploying the application build that selects the
-- column. Until a row is classified, the application treats it as NOT authoritatively verified.
ALTER TABLE users ADD COLUMN IF NOT EXISTS email_verified_via TEXT NULL;

UPDATE users
SET email_verified_via = CASE
  WHEN google_id IS NOT NULL AND provider = 'google'
       AND facebook_id IS NULL AND tiktok_id IS NULL AND instagram_id IS NULL THEN 'google'
  WHEN google_id IS NULL AND facebook_id IS NULL AND tiktok_id IS NULL AND instagram_id IS NULL
       AND COALESCE(provider, 'local') NOT IN ('google', 'facebook', 'tiktok', 'instagram') THEN 'email_link'
  ELSE NULL
END
WHERE email_verified_at IS NOT NULL
  AND email_verified_via IS NULL;
