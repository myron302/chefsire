-- Durable one-shot replacement of an existing subscription's payment method.
-- No raw card data, nonce or verification token is ever persisted.
CREATE TABLE IF NOT EXISTS wedding_square_card_updates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  wedding_subscription_id uuid NOT NULL REFERENCES wedding_square_subscriptions(id),
  user_id varchar NOT NULL REFERENCES users(id),
  square_environment text NOT NULL CHECK(square_environment='sandbox'),
  square_merchant_id text NOT NULL,
  square_subscription_id text NOT NULL,
  previous_card_id text NOT NULL,
  replacement_card_id text,
  source_digest text NOT NULL CHECK(source_digest ~ '^[a-f0-9]{64}$'),
  card_idempotency_key text NOT NULL,
  expected_provider_version integer NOT NULL CHECK(expected_provider_version>=0),
  status text NOT NULL DEFAULT 'reserved' CHECK(status IN
    ('reserved','card_submitting','card_confirmed','subscription_submitting','confirmed','needs_reconciliation')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT wedding_sq_card_update_confirmed_ck CHECK(status<>'confirmed' OR replacement_card_id IS NOT NULL),
  CONSTRAINT wedding_sq_card_update_source_uq UNIQUE(square_environment,source_digest),
  CONSTRAINT wedding_sq_card_update_key_uq UNIQUE(card_idempotency_key)
);
CREATE UNIQUE INDEX IF NOT EXISTS wedding_square_card_updates_pending_owner_idx
  ON wedding_square_card_updates(user_id) WHERE status<>'confirmed';
