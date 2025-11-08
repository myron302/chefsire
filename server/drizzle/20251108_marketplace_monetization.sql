-- Migration: Marketplace Monetization System
-- Creates tables for payment methods, commissions, payouts, and payout schedules

-- Enable pgcrypto extension for UUID generation
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Payment Methods Table
-- Stores seller's connected payment accounts (Square, Stripe, PayPal)
CREATE TABLE IF NOT EXISTS payment_methods (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id VARCHAR NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  provider TEXT NOT NULL, -- square, stripe, paypal
  provider_id TEXT NOT NULL, -- external account ID from provider
  account_status TEXT DEFAULT 'pending', -- pending, active, disabled, rejected
  account_type TEXT, -- individual, business
  account_email TEXT,
  account_details JSONB DEFAULT '{}'::jsonb,
  is_default BOOLEAN DEFAULT false,
  verified_at TIMESTAMPTZ,
  last_verified_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS payment_methods_user_idx ON payment_methods(user_id);
CREATE INDEX IF NOT EXISTS payment_methods_provider_idx ON payment_methods(provider);
CREATE INDEX IF NOT EXISTS payment_methods_status_idx ON payment_methods(account_status);

-- Payouts Table (must be created before commissions due to foreign key)
-- Tracks payout batches to sellers
CREATE TABLE IF NOT EXISTS payouts (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  seller_id VARCHAR NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  payment_method_id VARCHAR REFERENCES payment_methods(id),
  amount DECIMAL(10, 2) NOT NULL,
  currency TEXT DEFAULT 'USD',
  provider TEXT NOT NULL, -- square, stripe, paypal
  provider_payout_id TEXT, -- external payout ID from provider
  status TEXT DEFAULT 'pending', -- pending, processing, completed, failed, cancelled
  failure_reason TEXT,
  scheduled_for TIMESTAMPTZ,
  processed_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS payouts_seller_idx ON payouts(seller_id);
CREATE INDEX IF NOT EXISTS payouts_status_idx ON payouts(status);
CREATE INDEX IF NOT EXISTS payouts_scheduled_idx ON payouts(scheduled_for);
CREATE INDEX IF NOT EXISTS payouts_provider_payout_idx ON payouts(provider_payout_id);

-- Commissions Table
-- Audit trail for all commission calculations
CREATE TABLE IF NOT EXISTS commissions (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id VARCHAR NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  seller_id VARCHAR NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  subscription_tier TEXT NOT NULL,
  commission_rate DECIMAL(5, 2) NOT NULL, -- percentage
  order_total DECIMAL(10, 2) NOT NULL,
  commission_amount DECIMAL(10, 2) NOT NULL,
  seller_amount DECIMAL(10, 2) NOT NULL,
  payout_id VARCHAR REFERENCES payouts(id),
  status TEXT DEFAULT 'pending', -- pending, paid, refunded
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  paid_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS commissions_order_idx ON commissions(order_id);
CREATE INDEX IF NOT EXISTS commissions_seller_idx ON commissions(seller_id);
CREATE INDEX IF NOT EXISTS commissions_payout_idx ON commissions(payout_id);
CREATE INDEX IF NOT EXISTS commissions_status_idx ON commissions(status);

-- Payout Schedules Table
-- Configure automatic payout schedules for sellers
CREATE TABLE IF NOT EXISTS payout_schedules (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  seller_id VARCHAR NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  frequency TEXT DEFAULT 'weekly', -- daily, weekly, biweekly, monthly
  day_of_week INTEGER, -- 0-6 for weekly (Sunday = 0)
  day_of_month INTEGER, -- 1-31 for monthly
  minimum_amount DECIMAL(10, 2) DEFAULT 25.00, -- minimum payout threshold
  is_active BOOLEAN DEFAULT true,
  last_payout_at TIMESTAMPTZ,
  next_payout_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS payout_schedules_seller_idx ON payout_schedules(seller_id);
CREATE INDEX IF NOT EXISTS payout_schedules_active_idx ON payout_schedules(is_active);
CREATE INDEX IF NOT EXISTS payout_schedules_next_payout_idx ON payout_schedules(next_payout_at);
