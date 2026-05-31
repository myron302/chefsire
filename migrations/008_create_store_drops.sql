-- Migration: 008_create_store_drops
-- Created: 2026-05-31
-- Purpose: Add store_drops table for merchant follower drop notifications with click-through tracking

CREATE TABLE IF NOT EXISTS store_drops (
  id          varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id    varchar NOT NULL REFERENCES stores(id),
  owner_id    varchar NOT NULL REFERENCES users(id),
  product_id  varchar REFERENCES products(id),
  message     text,
  recipient_count integer NOT NULL DEFAULT 0,
  click_count      integer NOT NULL DEFAULT 0,
  created_at  timestamp NOT NULL DEFAULT now()
);

COMMENT ON COLUMN store_drops.recipient_count IS 'Snapshot of follower count at drop creation time';
COMMENT ON COLUMN store_drops.click_count IS 'Incremented each time a follower taps through the notification link';
COMMENT ON COLUMN store_drops.product_id IS 'Nullable to allow future free-form announcement drops';

-- Fast lookup for merchant history page and rate-limit checks
CREATE INDEX IF NOT EXISTS store_drops_owner_created_at_idx ON store_drops (owner_id, created_at DESC);

-- Allow filtering drops by store
CREATE INDEX IF NOT EXISTS store_drops_store_id_idx ON store_drops (store_id);
