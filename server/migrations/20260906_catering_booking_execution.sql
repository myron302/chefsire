-- Phase 2J catering event execution and service operations.
--
-- Requires the Phase 2G booking table (20260827_catering_bookings.sql) and the Phase 2H operational tables
-- (20260829_catering_booking_operations.sql).
--
-- ADDITIVE ONLY. catering_bookings, catering_booking_details, catering_booking_tasks and every Phase 2I table are
-- left exactly as they are; the single statement below that touches an existing object is the activity event_type
-- CHECK, which is widened by the eight Phase 2J events and loses none of the thirteen it already carried.

-- The booking's run-of-show. Ordering is persisted rather than inferred from a client array, and `updated_at` is the
-- optimistic-concurrency version every mutation states a precondition against.
CREATE TABLE IF NOT EXISTS catering_booking_execution_timeline (
  id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id varchar NOT NULL REFERENCES catering_bookings(id) ON DELETE RESTRICT,
  title varchar(160) NOT NULL,
  description text,
  category varchar(32) NOT NULL DEFAULT 'custom',
  -- Event-local wall clock, exactly as the Phase 2H detail times are stored. Never a device timezone.
  scheduled_time varchar(5),
  end_time varchar(5),
  visibility varchar(20) NOT NULL DEFAULT 'provider_private',
  sort_order integer NOT NULL,
  is_blocker boolean NOT NULL DEFAULT false,
  completed_at timestamptz,
  completed_by varchar REFERENCES users(id) ON DELETE RESTRICT,
  created_by varchar NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  -- Creation retry token. Nullable, so a create that carries none is unconstrained; the partial unique index below
  -- scopes it to (booking, creator), which is what makes a retried create resolve to the item it already made.
  client_request_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT catering_execution_timeline_booking_id_uidx UNIQUE (booking_id, id),
  CONSTRAINT catering_execution_timeline_category_check CHECK (category IN ('arrival', 'load_in', 'setup', 'food_prep', 'guest_arrival', 'service', 'cake_or_special_moment', 'cleanup', 'breakdown', 'load_out', 'custom')),
  CONSTRAINT catering_execution_timeline_visibility_check CHECK (visibility IN ('shared', 'provider_private')),
  CONSTRAINT catering_execution_timeline_sort_order_check CHECK (sort_order >= 0),
  CONSTRAINT catering_execution_timeline_scheduled_time_check CHECK (scheduled_time IS NULL OR scheduled_time ~ '^(?:[01][0-9]|2[0-3]):[0-5][0-9]$'),
  CONSTRAINT catering_execution_timeline_end_time_check CHECK (end_time IS NULL OR end_time ~ '^(?:[01][0-9]|2[0-3]):[0-5][0-9]$'),
  CONSTRAINT catering_execution_timeline_time_range_check CHECK (scheduled_time IS NULL OR end_time IS NULL OR end_time >= scheduled_time),
  -- A completed item always records who completed it; an incomplete one never carries a completer.
  CONSTRAINT catering_execution_timeline_completed_by_check CHECK ((completed_at IS NULL AND completed_by IS NULL) OR (completed_at IS NOT NULL AND completed_by IS NOT NULL))
);
CREATE INDEX IF NOT EXISTS catering_execution_timeline_booking_sort_idx ON catering_booking_execution_timeline(booking_id, sort_order, id);
CREATE UNIQUE INDEX IF NOT EXISTS catering_execution_timeline_request_uidx ON catering_booking_execution_timeline(booking_id, created_by, client_request_id) WHERE client_request_id IS NOT NULL;

-- Booking-scoped crew assignments. Deliberately no visibility column: these rows are never customer-visible under
-- any value, and a column would imply a setting that could disclose them. `worker_name` is a label, not a foreign
-- key to users: nothing here creates a profile or links to a ChefSire account.
CREATE TABLE IF NOT EXISTS catering_booking_staff_assignments (
  id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id varchar NOT NULL REFERENCES catering_bookings(id) ON DELETE RESTRICT,
  worker_name varchar(120) NOT NULL,
  role varchar(24) NOT NULL,
  custom_role varchar(60),
  contact_note varchar(200),
  arrival_time varchar(5),
  departure_time varchar(5),
  responsibility_note text,
  created_by varchar NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  client_request_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT catering_execution_staff_booking_id_uidx UNIQUE (booking_id, id),
  CONSTRAINT catering_execution_staff_role_check CHECK (role IN ('lead', 'chef', 'prep', 'server', 'bartender', 'runner', 'setup', 'breakdown', 'driver', 'coordinator', 'custom')),
  -- A custom role must actually name the role, and a listed role must not carry a conflicting custom label, so the
  -- allowlist cannot be bypassed by writing a free-form label beside a recognised role.
  CONSTRAINT catering_execution_staff_custom_role_check CHECK ((role = 'custom' AND custom_role IS NOT NULL) OR (role <> 'custom' AND custom_role IS NULL)),
  CONSTRAINT catering_execution_staff_arrival_time_check CHECK (arrival_time IS NULL OR arrival_time ~ '^(?:[01][0-9]|2[0-3]):[0-5][0-9]$'),
  CONSTRAINT catering_execution_staff_departure_time_check CHECK (departure_time IS NULL OR departure_time ~ '^(?:[01][0-9]|2[0-3]):[0-5][0-9]$'),
  CONSTRAINT catering_execution_staff_time_range_check CHECK (arrival_time IS NULL OR departure_time IS NULL OR departure_time >= arrival_time)
);
CREATE INDEX IF NOT EXISTS catering_execution_staff_booking_idx ON catering_booking_staff_assignments(booking_id, created_at, id);
CREATE UNIQUE INDEX IF NOT EXISTS catering_execution_staff_request_uidx ON catering_booking_staff_assignments(booking_id, created_by, client_request_id) WHERE client_request_id IS NOT NULL;

-- Equipment and rentals. `status` is operational and shares no vocabulary with the booking lifecycle: a cancelled
-- rental says nothing about the booking, and a returned chafer says nothing about the event.
CREATE TABLE IF NOT EXISTS catering_booking_equipment (
  id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id varchar NOT NULL REFERENCES catering_bookings(id) ON DELETE RESTRICT,
  name varchar(160) NOT NULL,
  quantity integer NOT NULL DEFAULT 1,
  source_type varchar(24) NOT NULL,
  source_name varchar(160),
  -- A rental can be collected the day before and returned the day after, so a real calendar date accompanies the
  -- event-local clock. The booking's own authoritative event_date is never copied here.
  pickup_date date,
  pickup_time varchar(5),
  return_date date,
  return_time varchar(5),
  status varchar(16) NOT NULL DEFAULT 'planned',
  is_blocker boolean NOT NULL DEFAULT false,
  notes text,
  visibility varchar(20) NOT NULL DEFAULT 'provider_private',
  created_by varchar NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  client_request_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT catering_execution_equipment_booking_id_uidx UNIQUE (booking_id, id),
  CONSTRAINT catering_execution_equipment_status_check CHECK (status IN ('planned', 'confirmed', 'received', 'in_use', 'returned', 'cancelled')),
  CONSTRAINT catering_execution_equipment_source_check CHECK (source_type IN ('provider_owned', 'rental', 'venue_supplied', 'customer_supplied')),
  CONSTRAINT catering_execution_equipment_visibility_check CHECK (visibility IN ('shared', 'provider_private')),
  -- Quantity is bounded by the database, not only by a TypeScript type.
  CONSTRAINT catering_execution_equipment_quantity_check CHECK (quantity >= 1 AND quantity <= 9999),
  CONSTRAINT catering_execution_equipment_pickup_time_check CHECK (pickup_time IS NULL OR pickup_time ~ '^(?:[01][0-9]|2[0-3]):[0-5][0-9]$'),
  CONSTRAINT catering_execution_equipment_return_time_check CHECK (return_time IS NULL OR return_time ~ '^(?:[01][0-9]|2[0-3]):[0-5][0-9]$')
);
CREATE INDEX IF NOT EXISTS catering_execution_equipment_booking_idx ON catering_booking_equipment(booking_id, created_at, id);
CREATE INDEX IF NOT EXISTS catering_execution_equipment_visible_idx ON catering_booking_equipment(booking_id, visibility, created_at, id);
CREATE UNIQUE INDEX IF NOT EXISTS catering_execution_equipment_request_uidx ON catering_booking_equipment(booking_id, created_by, client_request_id) WHERE client_request_id IS NOT NULL;

-- Operational access instructions for the event location Phase 2H already records. No address, city, state, postal
-- code or event date column exists here on purpose: those stay authoritative on catering_bookings and
-- catering_booking_details, so there is no second source of truth to drift.
CREATE TABLE IF NOT EXISTS catering_booking_access_details (
  booking_id varchar PRIMARY KEY REFERENCES catering_bookings(id) ON DELETE RESTRICT,
  load_in_entrance varchar(240),
  loading_dock_notes text,
  elevator_notes text,
  kitchen_access_notes text,
  parking_instructions text,
  security_check_in_notes text,
  access_window_start varchar(5),
  access_window_end varchar(5),
  venue_contact_name varchar(120),
  venue_contact_phone varchar(40),
  -- Provenance of the venue contact, so customer-supplied details are never re-attributed to the provider.
  venue_contact_source varchar(16),
  power_water_notes text,
  trash_removal_notes text,
  special_restrictions text,
  -- The single provider-private column on an otherwise shared record. The customer serializer never emits it.
  provider_private_notes text,
  access_confirmed boolean NOT NULL DEFAULT false,
  updated_by varchar REFERENCES users(id) ON DELETE RESTRICT,
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT catering_execution_access_contact_source_check CHECK (venue_contact_source IS NULL OR venue_contact_source IN ('provider', 'customer')),
  CONSTRAINT catering_execution_access_window_start_check CHECK (access_window_start IS NULL OR access_window_start ~ '^(?:[01][0-9]|2[0-3]):[0-5][0-9]$'),
  CONSTRAINT catering_execution_access_window_end_check CHECK (access_window_end IS NULL OR access_window_end ~ '^(?:[01][0-9]|2[0-3]):[0-5][0-9]$'),
  CONSTRAINT catering_execution_access_window_range_check CHECK (access_window_start IS NULL OR access_window_end IS NULL OR access_window_end >= access_window_start)
);

-- Event-day milestones, provider-only. The primary key is (booking, key), so a milestone is STATE rather than an
-- event stream: asking to complete the same key twice leaves one row in one state, which is what makes a retry from
-- a phone harmless with no idempotency token at all. Completing every one of them still does not complete the
-- BOOKING -- the Phase 2G provider completion action remains the only mechanism for that.
CREATE TABLE IF NOT EXISTS catering_booking_execution_milestones (
  booking_id varchar NOT NULL REFERENCES catering_bookings(id) ON DELETE RESTRICT,
  milestone_key varchar(32) NOT NULL,
  completed_at timestamptz,
  completed_by varchar REFERENCES users(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT catering_booking_execution_milestones_pkey PRIMARY KEY (booking_id, milestone_key),
  CONSTRAINT catering_execution_milestone_key_check CHECK (milestone_key IN ('crew_confirmed', 'equipment_loaded', 'departed_for_venue', 'arrived', 'load_in_complete', 'setup_complete', 'food_ready', 'service_started', 'service_complete', 'cleanup_complete', 'load_out_complete')),
  CONSTRAINT catering_execution_milestone_completed_by_check CHECK ((completed_at IS NULL AND completed_by IS NULL) OR (completed_at IS NOT NULL AND completed_by IS NOT NULL))
);

-- The durable record that one create retry token has already been spent.
--
-- The created ROW cannot be the idempotency record, because these rows are deletable: create an item with token T,
-- lose the response, watch it arrive by polling, delete it deliberately, then let the original request retry -- a
-- lookup over the live rows finds nothing, T looks unused, and the deleted item is resurrected with a second
-- activity row and a second notification behind it. Consumption is recorded here instead, in a table nothing
-- deletes. resource_id names what the accepted attempt created and is deliberately NOT a foreign key: an FK would
-- either cascade this tombstone away with the row or refuse the delete, and both defeat the purpose.
--
-- The primary key IS the scope -- one booking, one creator, one resource type, one token -- so the three
-- collections are namespaced and a token reused across them cannot collide.
CREATE TABLE IF NOT EXISTS catering_booking_execution_create_requests (
  booking_id varchar NOT NULL REFERENCES catering_bookings(id) ON DELETE RESTRICT,
  created_by varchar NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  resource_type varchar(16) NOT NULL,
  client_request_id uuid NOT NULL,
  resource_id varchar NOT NULL,
  consumed_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT catering_booking_execution_create_requests_pkey PRIMARY KEY (booking_id, created_by, resource_type, client_request_id),
  CONSTRAINT catering_execution_create_request_type_check CHECK (resource_type IN ('timeline', 'staff', 'equipment'))
);

-- Phase 2J extends the Phase 2H/2I activity allowlist by exactly eight events and removes none. Seven describe a
-- SHARED execution change and are written with 'shared' visibility; the milestone one is written with 'provider'
-- visibility, so a customer's activity feed never contains it.
ALTER TABLE catering_booking_activity DROP CONSTRAINT IF EXISTS catering_booking_activity_event_type_check;
ALTER TABLE catering_booking_activity ADD CONSTRAINT catering_booking_activity_event_type_check
  CHECK (event_type IN ('booking_offered', 'customer_confirmed', 'booking_cancelled', 'booking_completed', 'details_updated', 'shared_requirement_added', 'shared_requirement_updated', 'shared_requirement_completed', 'shared_requirement_deleted', 'shared_file_uploaded', 'shared_file_removed', 'provider_file_uploaded', 'provider_file_removed', 'execution_timeline_added', 'execution_timeline_updated', 'execution_timeline_completed', 'execution_timeline_removed', 'shared_equipment_added', 'shared_equipment_status_changed', 'execution_access_updated', 'provider_execution_milestone_completed'));
