-- Wedding Square reviewed additive schema migration; does not activate Square charges or entitlements.
-- Operator approval is REQUIRED before any promotion or application to Neon.
-- Outside every path scanned by ChefSire's normal db:migrate runner.
-- Requires 20261101_01_wedding_square_enrollment_attempts.sql.
-- Neither a subscription row nor a webhook receipt is evidence of paid access.

CREATE TABLE IF NOT EXISTS wedding_square_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id varchar NOT NULL REFERENCES users(id),
  tier text NOT NULL CONSTRAINT wedding_sq_sub_tier_ck CHECK (tier IN ('premium','elite')),
  square_environment text NOT NULL CONSTRAINT wedding_sq_sub_environment_ck CHECK (square_environment IN ('sandbox','production')),
  square_merchant_id text NOT NULL,
  square_location_id text NOT NULL,
  square_customer_id text NOT NULL,
  square_plan_variation_id text NOT NULL,
  square_subscription_id text NOT NULL,
  square_card_id text,
  billing_consent_at timestamptz NOT NULL,
  billing_consent_terms_version text NOT NULL,
  agreed_monthly_amount_cents integer NOT NULL CONSTRAINT wedding_sq_sub_amount_ck CHECK (agreed_monthly_amount_cents > 0),
  agreed_currency text NOT NULL CONSTRAINT wedding_sq_sub_currency_ck CHECK (agreed_currency = 'USD'),
  requested_start_date date NOT NULL,
  provider_status text NOT NULL DEFAULT 'PENDING',
  verified_paid_through timestamptz,
  cancellation_requested_at timestamptz,
  provider_cancelled_at timestamptz,
  last_reconciled_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT wedding_sq_sub_provider_uq UNIQUE(square_environment, square_merchant_id, square_subscription_id)
);

CREATE INDEX IF NOT EXISTS wedding_square_subscriptions_user_idx
  ON wedding_square_subscriptions(user_id);

CREATE UNIQUE INDEX IF NOT EXISTS wedding_square_subscriptions_one_live_user_idx
  ON wedding_square_subscriptions(user_id)
  WHERE provider_status IN ('PENDING','ACTIVE','PAUSED');

-- These deliveries trigger independent Square retrieval; they are NOT proof.
CREATE TABLE IF NOT EXISTS wedding_square_webhook_events (
  event_id text NOT NULL,
  square_environment text NOT NULL CONSTRAINT wedding_sq_webhook_environment_ck CHECK (square_environment IN ('sandbox','production')),
  square_merchant_id text NOT NULL,
  event_type text NOT NULL,
  received_at timestamptz NOT NULL DEFAULT now(),
  processing_status text NOT NULL DEFAULT 'pending'
    CONSTRAINT wedding_sq_webhook_status_ck CHECK (processing_status IN ('pending','processing','processed','failed')),
  processed_at timestamptz,
  CONSTRAINT wedding_sq_webhook_pk PRIMARY KEY(square_environment, square_merchant_id, event_id)
);

CREATE TABLE IF NOT EXISTS wedding_square_invoice_evidence (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  wedding_subscription_id uuid NOT NULL REFERENCES wedding_square_subscriptions(id),
  square_environment text NOT NULL CONSTRAINT wedding_sq_evidence_environment_ck CHECK (square_environment IN ('sandbox','production')),
  square_merchant_id text NOT NULL,
  square_invoice_id text NOT NULL,
  square_payment_id text NOT NULL,
  square_subscription_id text NOT NULL,
  verified_amount_cents integer NOT NULL CONSTRAINT wedding_sq_evidence_amount_ck CHECK (verified_amount_cents > 0),
  verified_currency text NOT NULL CONSTRAINT wedding_sq_evidence_currency_ck CHECK (verified_currency = 'USD'),
  provider_paid_at timestamptz NOT NULL,
  period_starts_at timestamptz NOT NULL,
  period_ends_at timestamptz NOT NULL,
  verified_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT wedding_sq_evidence_period_ck CHECK (period_ends_at > period_starts_at),
  CONSTRAINT wedding_sq_invoice_identity_uq UNIQUE(square_environment, square_merchant_id, square_invoice_id),
  CONSTRAINT wedding_sq_payment_identity_uq UNIQUE(square_environment, square_merchant_id, square_payment_id)
);
