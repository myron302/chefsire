-- Wedding Square billing foundation. NOT an entitlement migration and NOT a checkout enablement.
-- Run only after review and before any future billing service depends on these tables.
-- Existing wedding_intro_trials and wedding content are untouched.
CREATE TABLE IF NOT EXISTS wedding_square_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id varchar NOT NULL REFERENCES users(id),
  tier text NOT NULL CHECK (tier IN ('premium','elite')),
  square_environment text NOT NULL CHECK (square_environment IN ('sandbox','production')),
  square_merchant_id text NOT NULL,
  square_location_id text NOT NULL,
  square_customer_id text NOT NULL,
  square_plan_variation_id text NOT NULL,
  square_subscription_id text NOT NULL,
  square_card_id text,
  billing_consent_at timestamptz NOT NULL,
  billing_consent_terms_version text NOT NULL,
  agreed_monthly_amount_cents integer NOT NULL CHECK (agreed_monthly_amount_cents > 0),
  agreed_currency text NOT NULL CHECK (agreed_currency = 'USD'),
  requested_start_date date NOT NULL,
  provider_status text NOT NULL DEFAULT 'PENDING',
  verified_paid_through timestamptz,
  cancellation_requested_at timestamptz,
  provider_cancelled_at timestamptz,
  last_reconciled_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(square_environment, square_merchant_id, square_subscription_id)
);
CREATE INDEX IF NOT EXISTS wedding_square_subscriptions_user_idx
  ON wedding_square_subscriptions(user_id);
CREATE UNIQUE INDEX IF NOT EXISTS wedding_square_subscriptions_one_live_user_idx
  ON wedding_square_subscriptions(user_id)
  WHERE provider_status IN ('PENDING','ACTIVE','PAUSED');

-- Square webhook notifications are triggers for authoritative provider lookups,
-- not themselves trusted proof of payment, and must be replay-safe.
CREATE TABLE IF NOT EXISTS wedding_square_webhook_events (
  event_id text NOT NULL,
  square_environment text NOT NULL CHECK (square_environment IN ('sandbox','production')),
  square_merchant_id text NOT NULL,
  event_type text NOT NULL,
  received_at timestamptz NOT NULL DEFAULT now(),
  processing_status text NOT NULL DEFAULT 'pending'
    CHECK (processing_status IN ('pending','processing','processed','failed')),
  processed_at timestamptz,
  PRIMARY KEY(square_environment, square_merchant_id, event_id)
);
-- Immutable, unique invoice/payment evidence will be required by the billing
-- implementation before verified_paid_through can authorize any paid access.
CREATE TABLE IF NOT EXISTS wedding_square_invoice_evidence (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  wedding_subscription_id uuid NOT NULL REFERENCES wedding_square_subscriptions(id),
  square_environment text NOT NULL CHECK (square_environment IN ('sandbox','production')),
  square_merchant_id text NOT NULL,
  square_invoice_id text NOT NULL,
  square_payment_id text NOT NULL,
  square_subscription_id text NOT NULL,
  verified_amount_cents integer NOT NULL CHECK (verified_amount_cents > 0),
  verified_currency text NOT NULL CHECK (verified_currency = 'USD'),
  provider_paid_at timestamptz NOT NULL,
  period_starts_at timestamptz NOT NULL,
  period_ends_at timestamptz NOT NULL,
  verified_at timestamptz NOT NULL DEFAULT now(),
  CHECK (period_ends_at > period_starts_at),
  UNIQUE(square_environment, square_merchant_id, square_invoice_id),
  UNIQUE(square_environment, square_merchant_id, square_payment_id)
);
