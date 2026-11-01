-- STAGED/NOT ACTIVE. Versioned Wedding Square enrollment reservation migration.
-- Intentionally outside server/drizzle/, server/migrations/, and /migrations.
-- Operator approval is REQUIRED before any promotion or application to Neon.
-- This file must be applied BEFORE 20261101_02_wedding_square_billing_foundation.sql.
-- No Square API calls, paid entitlements, or user-visible billing are enabled.

CREATE TABLE IF NOT EXISTS wedding_square_enrollment_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id varchar NOT NULL REFERENCES users(id),
  square_environment text NOT NULL DEFAULT 'sandbox'
    CONSTRAINT wedding_sq_attempt_sandbox_ck CHECK (square_environment = 'sandbox'),
  tier text NOT NULL CONSTRAINT wedding_sq_attempt_tier_ck CHECK (tier IN ('premium', 'elite')),
  consent_terms_version text NOT NULL,
  consented_at timestamptz NOT NULL,
  consented_amount_cents integer NOT NULL CONSTRAINT wedding_sq_attempt_amount_ck CHECK (consented_amount_cents IN (2499,4999)),
  consented_currency text NOT NULL CONSTRAINT wedding_sq_attempt_currency_ck CHECK (consented_currency = 'USD'),
  trial_expires_at timestamptz,
  requested_start_date date,
  requested_timezone text NOT NULL DEFAULT 'UTC' CONSTRAINT wedding_sq_attempt_timezone_ck CHECK (requested_timezone = 'UTC'),
  square_location_id text NOT NULL,
  square_plan_variation_id text NOT NULL,
  square_customer_id text NOT NULL,
  square_card_id text NOT NULL,
  idempotency_key text NOT NULL CONSTRAINT wedding_sq_attempt_idempotency_uq UNIQUE CONSTRAINT wedding_sq_attempt_idempotency_len_ck CHECK (length(idempotency_key) BETWEEN 1 AND 45),
  request_fingerprint text NOT NULL,
  provider_subscription_id text,
  status text NOT NULL DEFAULT 'reserved'
    CONSTRAINT wedding_sq_attempt_status_ck CHECK (status IN ('reserved','submitting','needs_reconciliation','confirmed','aborted')),
  last_error_code text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT wedding_sq_attempt_tier_amount_ck CHECK (
    (tier = 'premium' AND consented_amount_cents = 2499)
    OR (tier = 'elite' AND consented_amount_cents = 4999)
  ),
  CONSTRAINT wedding_sq_attempt_trial_date_ck CHECK (trial_expires_at IS NULL OR
    (requested_start_date IS NOT NULL AND
     (requested_start_date::timestamp AT TIME ZONE 'UTC') >= trial_expires_at)),
  CONSTRAINT wedding_sq_attempt_provider_status_ck CHECK (provider_subscription_id IS NULL OR status IN ('needs_reconciliation','confirmed')),
  CONSTRAINT wedding_sq_attempt_confirmed_ck CHECK (status <> 'confirmed' OR (provider_subscription_id IS NOT NULL AND length(trim(provider_subscription_id)) > 0))
);

CREATE INDEX IF NOT EXISTS wedding_square_enrollment_attempts_user_idx
  ON wedding_square_enrollment_attempts(user_id, created_at DESC);

CREATE UNIQUE INDEX IF NOT EXISTS wedding_square_enrollment_attempts_provider_idx
  ON wedding_square_enrollment_attempts(square_environment, provider_subscription_id)
  WHERE provider_subscription_id IS NOT NULL;

-- One unresolved attempt per user. Unknown Square outcomes remain blocked.
CREATE UNIQUE INDEX IF NOT EXISTS wedding_square_enrollment_attempts_unresolved_user_idx
  ON wedding_square_enrollment_attempts(user_id)
  WHERE status IN ('reserved','submitting','needs_reconciliation','confirmed');
