CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS drink_bundles (
  id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id varchar NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  slug varchar(200) NOT NULL UNIQUE,
  name varchar(160) NOT NULL,
  description text,
  is_public boolean NOT NULL DEFAULT false,
  is_premium boolean NOT NULL DEFAULT true,
  price_cents integer NOT NULL DEFAULT 0,
  created_at timestamp NOT NULL DEFAULT now(),
  updated_at timestamp NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS drink_bundle_items (
  bundle_id varchar NOT NULL REFERENCES drink_bundles(id) ON DELETE CASCADE,
  collection_id varchar NOT NULL REFERENCES drink_collections(id) ON DELETE CASCADE,
  added_at timestamp NOT NULL DEFAULT now(),
  sort_order integer NOT NULL DEFAULT 0,
  CONSTRAINT drink_bundle_items_bundle_collection_idx UNIQUE (bundle_id, collection_id)
);

CREATE TABLE IF NOT EXISTS drink_bundle_purchases (
  id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id varchar NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  bundle_id varchar NOT NULL REFERENCES drink_bundles(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'completed',
  status_reason text,
  access_revoked_at timestamp,
  created_at timestamp NOT NULL DEFAULT now(),
  updated_at timestamp NOT NULL DEFAULT now(),
  CONSTRAINT drink_bundle_purchases_user_bundle_idx UNIQUE (user_id, bundle_id)
);

CREATE TABLE IF NOT EXISTS drink_bundle_checkout_sessions (
  id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id varchar NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  bundle_id varchar NOT NULL REFERENCES drink_bundles(id) ON DELETE CASCADE,
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
  refunded_at timestamp,
  access_revoked_at timestamp,
  failure_reason text,
  expires_at timestamp,
  created_at timestamp NOT NULL DEFAULT now(),
  updated_at timestamp NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS drink_bundle_square_webhook_events (
  id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id text NOT NULL UNIQUE,
  event_type text NOT NULL,
  object_type text,
  object_id text,
  checkout_session_id varchar REFERENCES drink_bundle_checkout_sessions(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'processed',
  received_at timestamp NOT NULL DEFAULT now(),
  created_at timestamp
);

CREATE INDEX IF NOT EXISTS drink_bundles_user_idx ON drink_bundles(user_id);
CREATE INDEX IF NOT EXISTS drink_bundles_public_idx ON drink_bundles(is_public);
CREATE INDEX IF NOT EXISTS drink_bundles_user_updated_at_idx ON drink_bundles(user_id, updated_at);
CREATE INDEX IF NOT EXISTS drink_bundle_items_collection_idx ON drink_bundle_items(collection_id);
CREATE INDEX IF NOT EXISTS drink_bundle_items_bundle_sort_order_idx ON drink_bundle_items(bundle_id, sort_order);
CREATE INDEX IF NOT EXISTS drink_bundle_purchases_user_idx ON drink_bundle_purchases(user_id);
CREATE INDEX IF NOT EXISTS drink_bundle_purchases_bundle_idx ON drink_bundle_purchases(bundle_id);
CREATE INDEX IF NOT EXISTS drink_bundle_checkout_sessions_user_idx ON drink_bundle_checkout_sessions(user_id);
CREATE INDEX IF NOT EXISTS drink_bundle_checkout_sessions_bundle_idx ON drink_bundle_checkout_sessions(bundle_id);
CREATE INDEX IF NOT EXISTS drink_bundle_checkout_sessions_status_idx ON drink_bundle_checkout_sessions(status);
CREATE UNIQUE INDEX IF NOT EXISTS drink_bundle_checkout_sessions_payment_link_idx ON drink_bundle_checkout_sessions(square_payment_link_id) WHERE square_payment_link_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS drink_bundle_checkout_sessions_order_idx ON drink_bundle_checkout_sessions(square_order_id) WHERE square_order_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS drink_bundle_square_webhook_events_object_idx ON drink_bundle_square_webhook_events(object_type, object_id);
CREATE INDEX IF NOT EXISTS drink_bundle_square_webhook_events_checkout_session_idx ON drink_bundle_square_webhook_events(checkout_session_id);
