CREATE TABLE IF NOT EXISTS drink_collection_wishlists (
  id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id varchar NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  collection_id varchar NOT NULL REFERENCES drink_collections(id) ON DELETE CASCADE,
  created_at timestamp NOT NULL DEFAULT now(),
  CONSTRAINT drink_collection_wishlists_user_collection_idx UNIQUE (user_id, collection_id)
);

CREATE INDEX IF NOT EXISTS drink_collection_wishlists_user_idx ON drink_collection_wishlists(user_id);
CREATE INDEX IF NOT EXISTS drink_collection_wishlists_collection_idx ON drink_collection_wishlists(collection_id);
CREATE INDEX IF NOT EXISTS drink_collection_wishlists_user_created_at_idx ON drink_collection_wishlists(user_id, created_at);
