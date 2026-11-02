-- Square Wedding sandbox card-setup intent. NO token, PAN, CVV or buyer
-- verification token is stored; only the SHA-256 fingerprint of an ephemeral
-- Square SDK nonce is recorded. All provider writes remain independently OFF.
CREATE TABLE IF NOT EXISTS wedding_square_card_setup_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id varchar NOT NULL REFERENCES users(id),
  square_environment text NOT NULL DEFAULT 'sandbox'
    CONSTRAINT wedding_sq_setup_sandbox_ck CHECK (square_environment='sandbox'),
  square_merchant_id text NOT NULL,
  square_location_id text NOT NULL,
  tier text NOT NULL
    CONSTRAINT wedding_sq_setup_tier_ck CHECK (tier IN ('premium','elite')),
  consent_terms_version text NOT NULL,
  consented_at timestamptz NOT NULL,
  consented_amount_cents integer NOT NULL,
  consented_currency text NOT NULL
    CONSTRAINT wedding_sq_setup_currency_ck CHECK (consented_currency='USD'),
  trial_expires_at timestamptz,
  requested_start_date date,
  requested_timezone text NOT NULL DEFAULT 'UTC'
    CONSTRAINT wedding_sq_setup_timezone_ck CHECK (requested_timezone='UTC'),
  source_digest text NOT NULL
    CONSTRAINT wedding_sq_setup_source_ck CHECK (source_digest ~ '^[0-9a-f]{64}$'),
  customer_idempotency_key text NOT NULL
    CONSTRAINT wedding_sq_setup_customer_key_uq UNIQUE
    CONSTRAINT wedding_sq_setup_customer_key_ck CHECK (length(customer_idempotency_key) BETWEEN 1 AND 45),
  card_idempotency_key text NOT NULL
    CONSTRAINT wedding_sq_setup_card_key_uq UNIQUE
    CONSTRAINT wedding_sq_setup_card_key_ck CHECK (length(card_idempotency_key) BETWEEN 1 AND 45),
  square_customer_id text,
  square_card_id text,
  status text NOT NULL DEFAULT 'reserved'
    CONSTRAINT wedding_sq_setup_status_ck CHECK (status IN (
      'reserved','customer_submitting','customer_confirmed','card_submitting',
      'needs_reconciliation','confirmed','aborted'
    )),
  customer_post_attempted_at timestamptz,
  card_post_attempted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT wedding_sq_setup_amount_ck CHECK (
    (tier='premium' AND consented_amount_cents=2499)
    OR (tier='elite' AND consented_amount_cents=4999)
  ),
  CONSTRAINT wedding_sq_setup_trial_date_ck CHECK (
    trial_expires_at IS NULL OR
    (requested_start_date IS NOT NULL AND
     (requested_start_date::timestamp AT TIME ZONE 'UTC') >= trial_expires_at)
  ),
  CONSTRAINT wedding_sq_setup_customer_progress_ck CHECK (
    status NOT IN ('customer_confirmed','card_submitting','confirmed')
    OR square_customer_id IS NOT NULL
  ),
  CONSTRAINT wedding_sq_setup_card_confirmed_ck CHECK (
    status <> 'confirmed' OR square_card_id IS NOT NULL
  )
);
CREATE UNIQUE INDEX IF NOT EXISTS wedding_square_card_setup_one_unresolved_user_idx
 ON wedding_square_card_setup_attempts(user_id)
 WHERE status IN ('reserved','customer_submitting','customer_confirmed',
                  'card_submitting','needs_reconciliation');
CREATE UNIQUE INDEX IF NOT EXISTS wedding_square_card_setup_provider_card_idx
 ON wedding_square_card_setup_attempts(square_environment,square_merchant_id,square_card_id)
 WHERE square_card_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS wedding_square_card_setup_source_digest_idx
 ON wedding_square_card_setup_attempts(square_environment,source_digest);
CREATE INDEX IF NOT EXISTS wedding_square_card_setup_user_history_idx
 ON wedding_square_card_setup_attempts(user_id,created_at DESC);
