CREATE TABLE IF NOT EXISTS drink_collection_promotions (
  id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  creator_user_id varchar NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  collection_id varchar NOT NULL REFERENCES drink_collections(id) ON DELETE CASCADE,
  code varchar(64) NOT NULL,
  discount_type text NOT NULL,
  discount_value integer NOT NULL,
  starts_at timestamp,
  ends_at timestamp,
  is_active boolean NOT NULL DEFAULT true,
  max_redemptions integer,
  redemption_count integer NOT NULL DEFAULT 0,
  created_at timestamp NOT NULL DEFAULT now(),
  updated_at timestamp NOT NULL DEFAULT now(),
  CONSTRAINT drink_collection_promotions_collection_code_idx UNIQUE (collection_id, code)
);

ALTER TABLE drink_collection_checkout_sessions
  ADD COLUMN IF NOT EXISTS promotion_id varchar,
  ADD COLUMN IF NOT EXISTS promotion_code text,
  ADD COLUMN IF NOT EXISTS original_amount_cents integer,
  ADD COLUMN IF NOT EXISTS discount_amount_cents integer;

ALTER TABLE drink_collection_sales_ledger
  ADD COLUMN IF NOT EXISTS promotion_id varchar,
  ADD COLUMN IF NOT EXISTS promotion_code text,
  ADD COLUMN IF NOT EXISTS original_amount_cents integer,
  ADD COLUMN IF NOT EXISTS discount_amount_cents integer;

CREATE INDEX IF NOT EXISTS drink_collection_promotions_creator_idx
  ON drink_collection_promotions(creator_user_id);

CREATE INDEX IF NOT EXISTS drink_collection_promotions_collection_idx
  ON drink_collection_promotions(collection_id);

CREATE INDEX IF NOT EXISTS drink_collection_promotions_active_idx
  ON drink_collection_promotions(is_active, starts_at, ends_at);
