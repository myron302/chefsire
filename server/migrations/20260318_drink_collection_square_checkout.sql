CREATE TABLE IF NOT EXISTS drink_collection_checkout_sessions (
  id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id varchar NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  collection_id varchar NOT NULL REFERENCES drink_collections(id) ON DELETE CASCADE,
  provider text NOT NULL DEFAULT 'square',
  status text NOT NULL DEFAULT 'pending',
  amount_cents integer NOT NULL,
  currency_code text NOT NULL DEFAULT 'USD',
  square_payment_link_id text,
  square_order_id text,
  square_payment_id text,
  provider_reference_id text NOT NULL UNIQUE,
  checkout_url text,
  last_verified_at timestamp,
  verified_at timestamp,
  failure_reason text,
  expires_at timestamp,
  created_at timestamp NOT NULL DEFAULT now(),
  updated_at timestamp NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS drink_collection_checkout_sessions_user_idx
  ON drink_collection_checkout_sessions(user_id);
CREATE INDEX IF NOT EXISTS drink_collection_checkout_sessions_collection_idx
  ON drink_collection_checkout_sessions(collection_id);
CREATE INDEX IF NOT EXISTS drink_collection_checkout_sessions_status_idx
  ON drink_collection_checkout_sessions(status);
CREATE UNIQUE INDEX IF NOT EXISTS drink_collection_checkout_sessions_payment_link_idx
  ON drink_collection_checkout_sessions(square_payment_link_id)
  WHERE square_payment_link_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS drink_collection_checkout_sessions_order_idx
  ON drink_collection_checkout_sessions(square_order_id)
  WHERE square_order_id IS NOT NULL;
