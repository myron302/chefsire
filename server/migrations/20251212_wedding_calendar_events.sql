-- Migration: Create wedding planning calendar events table

CREATE TABLE IF NOT EXISTS wedding_calendar_events (
  id BIGSERIAL PRIMARY KEY,
  user_id VARCHAR NOT NULL REFERENCES users(id),
  event_date DATE NOT NULL,
  title TEXT NOT NULL,
  type VARCHAR(32) NOT NULL,
  notes TEXT,
  reminder BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS wedding_calendar_events_user_idx
  ON wedding_calendar_events(user_id);

CREATE INDEX IF NOT EXISTS wedding_calendar_events_date_idx
  ON wedding_calendar_events(event_date);
