CREATE TABLE IF NOT EXISTS creator_membership_plans (
  id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  creator_user_id varchar NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  slug varchar(160) NOT NULL,
  name varchar(160) NOT NULL,
  description text,
  price_cents integer NOT NULL,
  billing_interval text NOT NULL DEFAULT 'monthly',
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamp NOT NULL DEFAULT now(),
  updated_at timestamp NOT NULL DEFAULT now(),
  CONSTRAINT creator_membership_plans_creator_idx UNIQUE (creator_user_id),
  CONSTRAINT creator_membership_plans_slug_idx UNIQUE (slug)
);

CREATE INDEX IF NOT EXISTS creator_membership_plans_active_idx
  ON creator_membership_plans(is_active);

CREATE TABLE IF NOT EXISTS creator_memberships (
  id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id varchar NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  creator_user_id varchar NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  plan_id varchar NOT NULL REFERENCES creator_membership_plans(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'active',
  started_at timestamp NOT NULL DEFAULT now(),
  ends_at timestamp,
  canceled_at timestamp,
  square_subscription_id text,
  payment_reference text,
  created_at timestamp NOT NULL DEFAULT now(),
  updated_at timestamp NOT NULL DEFAULT now(),
  CONSTRAINT creator_memberships_user_creator_idx UNIQUE (user_id, creator_user_id)
);

CREATE INDEX IF NOT EXISTS creator_memberships_user_idx
  ON creator_memberships(user_id);
CREATE INDEX IF NOT EXISTS creator_memberships_creator_idx
  ON creator_memberships(creator_user_id);
CREATE INDEX IF NOT EXISTS creator_memberships_status_idx
  ON creator_memberships(status);

CREATE TABLE IF NOT EXISTS creator_membership_checkout_sessions (
  id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id varchar NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  creator_user_id varchar NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  plan_id varchar NOT NULL REFERENCES creator_membership_plans(id) ON DELETE CASCADE,
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

CREATE INDEX IF NOT EXISTS creator_membership_checkout_sessions_user_idx
  ON creator_membership_checkout_sessions(user_id);
CREATE INDEX IF NOT EXISTS creator_membership_checkout_sessions_creator_idx
  ON creator_membership_checkout_sessions(creator_user_id);
CREATE INDEX IF NOT EXISTS creator_membership_checkout_sessions_plan_idx
  ON creator_membership_checkout_sessions(plan_id);
CREATE INDEX IF NOT EXISTS creator_membership_checkout_sessions_status_idx
  ON creator_membership_checkout_sessions(status);
CREATE UNIQUE INDEX IF NOT EXISTS creator_membership_checkout_sessions_payment_link_idx
  ON creator_membership_checkout_sessions(square_payment_link_id);
CREATE UNIQUE INDEX IF NOT EXISTS creator_membership_checkout_sessions_order_idx
  ON creator_membership_checkout_sessions(square_order_id);

CREATE TABLE IF NOT EXISTS creator_membership_sales_ledger (
  id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id varchar NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  creator_user_id varchar NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  membership_id varchar REFERENCES creator_memberships(id) ON DELETE SET NULL,
  checkout_session_id varchar REFERENCES creator_membership_checkout_sessions(id) ON DELETE SET NULL,
  plan_id varchar REFERENCES creator_membership_plans(id) ON DELETE SET NULL,
  gross_amount_cents integer NOT NULL,
  currency_code text NOT NULL DEFAULT 'USD',
  status text NOT NULL DEFAULT 'completed',
  status_reason text,
  created_at timestamp NOT NULL DEFAULT now(),
  updated_at timestamp NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS creator_membership_sales_ledger_user_idx
  ON creator_membership_sales_ledger(user_id);
CREATE INDEX IF NOT EXISTS creator_membership_sales_ledger_creator_idx
  ON creator_membership_sales_ledger(creator_user_id);
CREATE UNIQUE INDEX IF NOT EXISTS creator_membership_sales_ledger_membership_idx
  ON creator_membership_sales_ledger(membership_id);
CREATE UNIQUE INDEX IF NOT EXISTS creator_membership_sales_ledger_checkout_idx
  ON creator_membership_sales_ledger(checkout_session_id);
CREATE INDEX IF NOT EXISTS creator_membership_sales_ledger_status_idx
  ON creator_membership_sales_ledger(status);
