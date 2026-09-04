-- Phase 2I catering booking communication and files.
-- Requires the Phase 2H operational tables (20260829_catering_booking_operations.sql) and the generic DM tables.
-- Additive only: catering_bookings, the Phase 2H detail/task tables and the dm_* tables are never redefined here.

-- One dedicated conversation per booking. The generic provider/customer DM thread is never reused: booking A,
-- booking B and an ordinary DM between the same two people stay three distinct histories.
CREATE TABLE IF NOT EXISTS catering_booking_conversations (
  booking_id varchar PRIMARY KEY REFERENCES catering_bookings(id) ON DELETE RESTRICT,
  thread_id varchar NOT NULL UNIQUE REFERENCES dm_threads(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now()
);
-- Closing the generic-DM bypass is a lookup by thread on every generic DM request, so it is indexed. The UNIQUE
-- constraint above already provides it; this index name is kept for explicit intent in query plans.
CREATE INDEX IF NOT EXISTS catering_booking_conversations_thread_idx ON catering_booking_conversations(thread_id);

-- Idempotency ledger for booking message sends. Uniqueness is scoped to (booking, sender, client request), so one
-- actor's retry can never collapse onto another actor's message and a token replayed on a different booking is a
-- different request. Kept out of dm_messages deliberately: generic DMs gain no column and no constraint from it.
CREATE TABLE IF NOT EXISTS catering_booking_message_requests (
  booking_id varchar NOT NULL REFERENCES catering_bookings(id) ON DELETE RESTRICT,
  sender_id varchar NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  client_request_id uuid NOT NULL,
  message_id varchar NOT NULL REFERENCES dm_messages(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT catering_booking_message_requests_pkey PRIMARY KEY (booking_id, sender_id, client_request_id)
);
CREATE INDEX IF NOT EXISTS catering_booking_message_requests_message_idx ON catering_booking_message_requests(message_id);

-- Authoritative booking file metadata. The bytes live in private storage under storage_key; this row is the only
-- identity the client ever sees, and storage_key is never serialized to any actor.
CREATE TABLE IF NOT EXISTS catering_booking_files (
  id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id varchar NOT NULL REFERENCES catering_bookings(id) ON DELETE RESTRICT,
  uploaded_by varchar NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  visibility varchar(16) NOT NULL,
  storage_provider varchar(16) NOT NULL,
  storage_key text NOT NULL,
  original_filename varchar(255) NOT NULL,
  content_type varchar(128) NOT NULL,
  byte_size bigint NOT NULL,
  sha256 varchar(64) NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz,
  deleted_by varchar REFERENCES users(id) ON DELETE RESTRICT,
  object_deleted_at timestamptz,
  cleanup_attempts integer NOT NULL DEFAULT 0,
  cleanup_error text,
  -- Upload retry token. Nullable, so an upload that carries none is unconstrained; the partial unique index below
  -- scopes it to (booking, uploader), which is what makes a retried upload resolve to the file it already created.
  client_request_id uuid,
  CONSTRAINT catering_booking_files_storage_key_uidx UNIQUE (storage_key),
  CONSTRAINT catering_booking_files_booking_id_uidx UNIQUE (booking_id, id),
  CONSTRAINT catering_booking_files_visibility_check CHECK (visibility IN ('provider', 'shared')),
  CONSTRAINT catering_booking_files_storage_provider_check CHECK (storage_provider IN ('r2', 'local')),
  CONSTRAINT catering_booking_files_byte_size_check CHECK (byte_size > 0 AND byte_size <= 15728640),
  CONSTRAINT catering_booking_files_sha256_check CHECK (sha256 ~ '^[0-9a-f]{64}$'),
  CONSTRAINT catering_booking_files_cleanup_attempts_check CHECK (cleanup_attempts >= 0),
  -- A tombstone always records who removed the file; an undeleted row never carries a deleter.
  CONSTRAINT catering_booking_files_deleted_by_check CHECK ((deleted_at IS NULL AND deleted_by IS NULL) OR (deleted_at IS NOT NULL AND deleted_by IS NOT NULL)),
  -- Storage cleanup only ever happens after the metadata tombstone, never before it.
  CONSTRAINT catering_booking_files_object_deleted_check CHECK (object_deleted_at IS NULL OR deleted_at IS NOT NULL)
);
CREATE INDEX IF NOT EXISTS catering_booking_files_booking_page_idx ON catering_booking_files(booking_id, created_at DESC, id DESC);
CREATE INDEX IF NOT EXISTS catering_booking_files_active_idx ON catering_booking_files(booking_id, visibility, created_at DESC, id DESC) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS catering_booking_files_cleanup_pending_idx ON catering_booking_files(deleted_at) WHERE deleted_at IS NOT NULL AND object_deleted_at IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS catering_booking_files_request_uidx ON catering_booking_files(booking_id, uploaded_by, client_request_id) WHERE client_request_id IS NOT NULL;

-- Objects that reached storage but whose metadata never persisted, and whose compensating delete also failed. A row
-- here is the truthful record that bytes exist with no owning file row, so they can be reconciled rather than
-- silently accumulating. The upload itself still answers the client with a failure.
CREATE TABLE IF NOT EXISTS catering_booking_storage_orphans (
  id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id varchar NOT NULL REFERENCES catering_bookings(id) ON DELETE RESTRICT,
  storage_provider varchar(16) NOT NULL,
  storage_key text NOT NULL,
  reason varchar(40) NOT NULL,
  cleanup_attempts integer NOT NULL DEFAULT 1,
  cleanup_error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  resolved_at timestamptz,
  CONSTRAINT catering_booking_storage_orphans_provider_check CHECK (storage_provider IN ('r2', 'local')),
  CONSTRAINT catering_booking_storage_orphans_attempts_check CHECK (cleanup_attempts >= 0)
);
CREATE INDEX IF NOT EXISTS catering_booking_storage_orphans_pending_idx ON catering_booking_storage_orphans(created_at) WHERE resolved_at IS NULL;
-- The id the upload generated for the object, so reconciliation can ask whether that metadata row committed after
-- all rather than deleting bytes a committed file may own. Deliberately not a foreign key: an orphan is precisely
-- an object whose metadata row may not exist. Additive and idempotent, so re-running this migration is safe.
ALTER TABLE catering_booking_storage_orphans ADD COLUMN IF NOT EXISTS file_id varchar;
-- No new index is needed for the owner lookup: catering_booking_files.storage_key is already UNIQUE, so a storage
-- key identifies at most one file row exactly.

-- Phase 2I extends the Phase 2H activity allowlist by exactly the four file events. Messages write no activity.
ALTER TABLE catering_booking_activity DROP CONSTRAINT IF EXISTS catering_booking_activity_event_type_check;
ALTER TABLE catering_booking_activity ADD CONSTRAINT catering_booking_activity_event_type_check
  CHECK (event_type IN ('booking_offered', 'customer_confirmed', 'booking_cancelled', 'booking_completed', 'details_updated', 'shared_requirement_added', 'shared_requirement_updated', 'shared_requirement_completed', 'shared_requirement_deleted', 'shared_file_uploaded', 'shared_file_removed', 'provider_file_uploaded', 'provider_file_removed'));
