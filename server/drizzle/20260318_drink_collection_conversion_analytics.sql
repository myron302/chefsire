CREATE TABLE IF NOT EXISTS drink_collection_events (
  id bigserial PRIMARY KEY,
  collection_id varchar NOT NULL REFERENCES drink_collections(id) ON DELETE CASCADE,
  event_type text NOT NULL,
  user_id varchar REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamp NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS drink_collection_events_collection_idx
  ON drink_collection_events(collection_id);

CREATE INDEX IF NOT EXISTS drink_collection_events_event_type_idx
  ON drink_collection_events(event_type);

CREATE INDEX IF NOT EXISTS drink_collection_events_created_at_idx
  ON drink_collection_events(created_at);

CREATE INDEX IF NOT EXISTS drink_collection_events_collection_event_type_created_at_idx
  ON drink_collection_events(collection_id, event_type, created_at);
