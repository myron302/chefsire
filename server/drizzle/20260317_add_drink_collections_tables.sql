CREATE TABLE IF NOT EXISTS drink_collections (
  id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id varchar NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name varchar(160) NOT NULL,
  description text,
  is_public boolean NOT NULL DEFAULT false,
  created_at timestamp NOT NULL DEFAULT now(),
  updated_at timestamp NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS drink_collections_user_idx ON drink_collections(user_id);
CREATE INDEX IF NOT EXISTS drink_collections_public_idx ON drink_collections(is_public);
CREATE INDEX IF NOT EXISTS drink_collections_user_updated_at_idx ON drink_collections(user_id, updated_at);
CREATE INDEX IF NOT EXISTS drink_collections_public_updated_at_idx ON drink_collections(is_public, updated_at);

CREATE TABLE IF NOT EXISTS drink_collection_items (
  collection_id varchar NOT NULL REFERENCES drink_collections(id) ON DELETE CASCADE,
  drink_slug varchar(200) NOT NULL,
  added_at timestamp NOT NULL DEFAULT now(),
  CONSTRAINT drink_collection_items_collection_drink_idx UNIQUE (collection_id, drink_slug)
);

CREATE INDEX IF NOT EXISTS drink_collection_items_slug_idx ON drink_collection_items(drink_slug);
