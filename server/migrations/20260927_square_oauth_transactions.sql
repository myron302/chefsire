-- P1-06: server-owned, expiring, one-time Square OAuth account binding.
-- Existing Square connections and credentials are intentionally untouched.
CREATE TABLE IF NOT EXISTS square_oauth_transactions (
  id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  nonce_hash varchar(64) NOT NULL UNIQUE,
  user_id varchar NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  claim_id varchar(64),
  created_at timestamp NOT NULL DEFAULT now(),
  expires_at timestamp NOT NULL,
  claimed_at timestamp,
  consumed_at timestamp,
  superseded_at timestamp
);

CREATE INDEX IF NOT EXISTS square_oauth_transactions_user_idx
  ON square_oauth_transactions (user_id);
CREATE INDEX IF NOT EXISTS square_oauth_transactions_expiry_idx
  ON square_oauth_transactions (expires_at);

