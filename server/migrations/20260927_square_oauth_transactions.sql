-- P1-06: server-owned, expiring, browser-bound, single-use Square OAuth
-- account binding. Exactly one transaction row is kept per ChefSire user, so
-- growth is bounded by users rather than by OAuth requests. All timestamps
-- are timezone-aware absolute instants. Existing Square connections and
-- credentials in payment_methods are untouched by this migration.
CREATE TABLE IF NOT EXISTS square_oauth_transactions (
  id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id varchar NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  nonce_hash varchar(64) NOT NULL,
  browser_binding_hash varchar(64) NOT NULL,
  claim_id varchar(64),
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  claimed_at timestamptz,
  consumed_at timestamptz
);

CREATE INDEX IF NOT EXISTS square_oauth_transactions_nonce_idx
  ON square_oauth_transactions (nonce_hash);
CREATE INDEX IF NOT EXISTS square_oauth_transactions_expiry_idx
  ON square_oauth_transactions (expires_at);
