-- Nutrition Premium cardless introductory trial (mirrors wedding_intro_trials). New table only; no existing data touched.
-- One row per account ever (primary key); dates set by the database; expiry fixed at exactly 30 days after activation.
CREATE TABLE IF NOT EXISTS nutrition_intro_trials (
  user_id varchar PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  activated_at timestamptz NOT NULL DEFAULT statement_timestamp(),
  expires_at timestamptz NOT NULL DEFAULT (statement_timestamp() + interval '720 hours'),
  revoked_at timestamptz,
  CONSTRAINT nutrition_intro_trials_check CHECK (expires_at = activated_at + interval '720 hours')
);
