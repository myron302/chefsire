-- Repair production users schemas that predate the catering marketplace fields.
-- All changes are additive and preserve existing user records and values.
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS catering_enabled BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS catering_location TEXT,
  ADD COLUMN IF NOT EXISTS catering_latitude NUMERIC(10,7),
  ADD COLUMN IF NOT EXISTS catering_longitude NUMERIC(10,7),
  ADD COLUMN IF NOT EXISTS catering_radius INTEGER DEFAULT 25,
  ADD COLUMN IF NOT EXISTS catering_bio TEXT,
  ADD COLUMN IF NOT EXISTS catering_available BOOLEAN DEFAULT TRUE;

CREATE INDEX IF NOT EXISTS catering_location_idx ON users (catering_location);
