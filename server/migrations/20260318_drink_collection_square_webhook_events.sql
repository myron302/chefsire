CREATE TABLE IF NOT EXISTS drink_collection_square_webhook_events (
  id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id text NOT NULL UNIQUE,
  event_type text NOT NULL,
  object_type text,
  object_id text,
  checkout_session_id varchar REFERENCES drink_collection_checkout_sessions(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'processed',
  received_at timestamp NOT NULL DEFAULT now(),
  created_at timestamp
);

CREATE INDEX IF NOT EXISTS drink_collection_square_webhook_events_object_idx
  ON drink_collection_square_webhook_events(object_type, object_id);

CREATE INDEX IF NOT EXISTS drink_collection_square_webhook_events_checkout_session_idx
  ON drink_collection_square_webhook_events(checkout_session_id);
