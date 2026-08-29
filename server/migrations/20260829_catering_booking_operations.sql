-- Phase 2H operational state. Requires the Phase 2G catering_bookings table.
CREATE TABLE IF NOT EXISTS catering_booking_details (
  booking_id varchar PRIMARY KEY REFERENCES catering_bookings(id) ON DELETE RESTRICT,
  venue_name varchar(160), venue_address varchar(240), venue_city varchar(120),
  venue_state varchar(80), venue_postal_code varchar(24), venue_instructions text,
  arrival_time varchar(5), service_start_time varchar(5), service_end_time varchar(5),
  setup_notes text, access_notes text, kitchen_available boolean,
  refrigeration_available boolean, power_available boolean, water_available boolean,
  indoor_outdoor varchar(16), customer_notes text, provider_notes text,
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT catering_booking_details_indoor_outdoor_check CHECK (indoor_outdoor IS NULL OR indoor_outdoor IN ('indoor', 'outdoor', 'both')),
  CONSTRAINT catering_booking_details_arrival_time_check CHECK (arrival_time IS NULL OR arrival_time ~ '^(?:[01][0-9]|2[0-3]):[0-5][0-9]$'),
  CONSTRAINT catering_booking_details_service_start_time_check CHECK (service_start_time IS NULL OR service_start_time ~ '^(?:[01][0-9]|2[0-3]):[0-5][0-9]$'),
  CONSTRAINT catering_booking_details_service_end_time_check CHECK (service_end_time IS NULL OR service_end_time ~ '^(?:[01][0-9]|2[0-3]):[0-5][0-9]$')
);

CREATE TABLE IF NOT EXISTS catering_booking_tasks (
  id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id varchar NOT NULL REFERENCES catering_bookings(id) ON DELETE RESTRICT,
  title varchar(160) NOT NULL, description text,
  status varchar(16) NOT NULL DEFAULT 'pending',
  visibility varchar(16) NOT NULL DEFAULT 'provider',
  due_date date, due_time varchar(5), sort_order integer NOT NULL,
  created_by varchar NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(), completed_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT catering_booking_tasks_booking_id_uidx UNIQUE (booking_id, id),
  CONSTRAINT catering_booking_tasks_status_check CHECK (status IN ('pending', 'completed')),
  CONSTRAINT catering_booking_tasks_visibility_check CHECK (visibility IN ('provider', 'shared')),
  CONSTRAINT catering_booking_tasks_sort_order_check CHECK (sort_order >= 0),
  CONSTRAINT catering_booking_tasks_due_time_check CHECK (due_time IS NULL OR due_time ~ '^(?:[01][0-9]|2[0-3]):[0-5][0-9]$')
);
CREATE INDEX IF NOT EXISTS catering_booking_tasks_booking_sort_idx ON catering_booking_tasks(booking_id, sort_order, id);

CREATE TABLE IF NOT EXISTS catering_booking_activity (
  id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id varchar NOT NULL REFERENCES catering_bookings(id) ON DELETE RESTRICT,
  actor_user_id varchar NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  event_type varchar(40) NOT NULL, visibility varchar(16) NOT NULL DEFAULT 'shared',
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb, created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT catering_booking_activity_event_type_check CHECK (event_type IN ('booking_offered', 'customer_confirmed', 'booking_cancelled', 'booking_completed', 'details_updated', 'shared_requirement_added', 'shared_requirement_updated', 'shared_requirement_completed', 'shared_requirement_deleted')),
  CONSTRAINT catering_booking_activity_visibility_check CHECK (visibility IN ('provider', 'shared')),
  CONSTRAINT catering_booking_activity_metadata_check CHECK (jsonb_typeof(metadata) = 'object')
);
CREATE INDEX IF NOT EXISTS catering_booking_activity_booking_page_idx ON catering_booking_activity(booking_id, created_at DESC, id DESC);
