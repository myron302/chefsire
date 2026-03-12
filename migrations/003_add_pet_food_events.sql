CREATE TABLE IF NOT EXISTS pet_food_events (
  id BIGSERIAL PRIMARY KEY,
  slug TEXT NOT NULL,
  event_type TEXT NOT NULL,
  user_id VARCHAR REFERENCES users(id),
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS pet_food_events_slug_idx ON pet_food_events (slug);
CREATE INDEX IF NOT EXISTS pet_food_events_created_at_idx ON pet_food_events (created_at);
CREATE INDEX IF NOT EXISTS pet_food_events_event_type_idx ON pet_food_events (event_type);
