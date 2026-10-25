-- One introductory Wedding trial per account, across both tiers.
-- Separate from subscription history and all unverified legacy paid columns.
CREATE TABLE IF NOT EXISTS wedding_intro_trials (
  user_id varchar PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  tier text NOT NULL CHECK (tier IN ('premium', 'elite')),
  activated_at timestamptz NOT NULL DEFAULT statement_timestamp(),
  expires_at timestamptz NOT NULL DEFAULT (statement_timestamp() + interval '336 hours'),
  revoked_at timestamptz,
  CHECK (expires_at = activated_at + interval '336 hours')
);
-- Expiration is evaluated on reads/authorization; no cleanup job or content deletion.
