CREATE INDEX IF NOT EXISTS drink_events_event_type_created_at_idx
  ON drink_events (event_type, created_at);

CREATE INDEX IF NOT EXISTS drink_events_slug_created_at_idx
  ON drink_events (slug, created_at);

CREATE INDEX IF NOT EXISTS drink_events_slug_event_type_created_at_idx
  ON drink_events (slug, event_type, created_at);

CREATE INDEX IF NOT EXISTS drink_recipes_user_created_at_idx
  ON drink_recipes (user_id, created_at);

CREATE INDEX IF NOT EXISTS drink_recipes_remixed_from_slug_created_at_idx
  ON drink_recipes (remixed_from_slug, created_at);

CREATE INDEX IF NOT EXISTS drink_collections_user_updated_at_idx
  ON drink_collections (user_id, updated_at);

CREATE INDEX IF NOT EXISTS drink_collections_public_updated_at_idx
  ON drink_collections (is_public, updated_at);

CREATE INDEX IF NOT EXISTS follows_follower_id_idx
  ON follows (follower_id);

CREATE INDEX IF NOT EXISTS follows_following_id_idx
  ON follows (following_id);

CREATE INDEX IF NOT EXISTS follows_follower_created_at_idx
  ON follows (follower_id, created_at);

CREATE INDEX IF NOT EXISTS follows_following_created_at_idx
  ON follows (following_id, created_at);
