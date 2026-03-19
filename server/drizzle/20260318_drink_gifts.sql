ALTER TABLE IF EXISTS drink_collection_checkout_sessions
  ADD COLUMN IF NOT EXISTS purchase_type text NOT NULL DEFAULT 'self';

ALTER TABLE IF EXISTS drink_bundle_checkout_sessions
  ADD COLUMN IF NOT EXISTS purchase_type text NOT NULL DEFAULT 'self';

CREATE TABLE IF NOT EXISTS drink_gifts (
  id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  purchaser_user_id varchar NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  recipient_user_id varchar REFERENCES users(id) ON DELETE SET NULL,
  recipient_identifier text,
  target_type text NOT NULL,
  target_id varchar(200) NOT NULL,
  checkout_session_id varchar(200) NOT NULL,
  provider text NOT NULL DEFAULT 'square',
  status text NOT NULL DEFAULT 'pending',
  gift_code varchar(120) NOT NULL UNIQUE,
  claimed_at timestamp,
  completed_at timestamp,
  revoked_at timestamp,
  created_at timestamp NOT NULL DEFAULT now(),
  updated_at timestamp NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS drink_gifts_purchaser_user_idx ON drink_gifts(purchaser_user_id);
CREATE INDEX IF NOT EXISTS drink_gifts_recipient_user_idx ON drink_gifts(recipient_user_id);
CREATE INDEX IF NOT EXISTS drink_gifts_target_idx ON drink_gifts(target_type, target_id);
CREATE UNIQUE INDEX IF NOT EXISTS drink_gifts_checkout_session_idx ON drink_gifts(checkout_session_id);
CREATE INDEX IF NOT EXISTS drink_gifts_status_idx ON drink_gifts(status);
