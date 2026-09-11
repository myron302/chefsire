-- Phase 2K catering post-event closeout and follow-up.
--
-- Requires the Phase 2G booking table (20260827_catering_bookings.sql), the Phase 2H operational tables
-- (20260829_catering_booking_operations.sql), the Phase 2I communication and file tables
-- (20260902_catering_booking_communication_files.sql) and the Phase 2J execution tables
-- (20260906_catering_booking_execution.sql).
--
-- ADDITIVE ONLY. catering_bookings, catering_booking_details, catering_booking_tasks, catering_booking_files,
-- catering_booking_conversations, catering_reviews and every Phase 2J table are left exactly as they are. Phase 2K
-- READS the Phase 2J equipment rows, the Phase 2H shared tasks, the Phase 2I shared files and the Phase 2E reviews,
-- and writes to none of them. The single statement below that touches an existing object is the activity
-- event_type CHECK, which is widened by the two Phase 2K events and loses none of the twenty-one it already carried.
--
-- Nothing here is a booking status. `closed_out_at` records that the provider finished the operational wrap-up
-- AFTER the Phase 2G completion action; the booking stays `completed` and no column on catering_bookings is
-- touched. There is also nothing financial: ChefSire has no catering invoice, deposit, final-payment or refund
-- system, so this migration creates no amount, balance, charge or receipt column.

-- The per-booking closeout record. One row, keyed by the booking itself.
CREATE TABLE IF NOT EXISTS catering_booking_closeout (
  booking_id varchar PRIMARY KEY REFERENCES catering_bookings(id) ON DELETE RESTRICT,
  -- The provider's private post-event notes. Deliberately NOT an overload of the Phase 2J access record's
  -- provider_private_notes: that column is about getting into a venue before an event, this one is about what
  -- happened at an event that is over, and sharing one column would give two unrelated pieces of writing one
  -- concurrency version and one audit trail.
  provider_notes text,
  closed_out_at timestamptz,
  -- Persisted for audit and never serialized to any actor: internal attribution stays internal.
  closed_out_by varchar REFERENCES users(id) ON DELETE RESTRICT,
  reopen_count integer NOT NULL DEFAULT 0,
  last_reopened_at timestamptz,
  last_reopened_by varchar REFERENCES users(id) ON DELETE RESTRICT,
  updated_by varchar REFERENCES users(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  -- The optimistic-concurrency version every Phase 2K write states a precondition against.
  updated_at timestamptz NOT NULL DEFAULT now(),
  -- A closed-out booking always records who closed it; an open one never carries a closer.
  CONSTRAINT catering_closeout_closed_by_check CHECK ((closed_out_at IS NULL AND closed_out_by IS NULL) OR (closed_out_at IS NOT NULL AND closed_out_by IS NOT NULL)),
  CONSTRAINT catering_closeout_reopen_count_check CHECK (reopen_count >= 0),
  -- Reopening is audited rather than merely toggled: a non-zero count must carry when and by whom, and a zero
  -- count must carry neither, so the record cannot claim a reopening it has no evidence for.
  CONSTRAINT catering_closeout_reopen_audit_check CHECK ((reopen_count = 0 AND last_reopened_at IS NULL AND last_reopened_by IS NULL) OR (reopen_count > 0 AND last_reopened_at IS NOT NULL AND last_reopened_by IS NOT NULL))
);

-- The closeout checklist, provider-private in its entirety.
--
-- The primary key is (booking, item key), so an item is STATE rather than an event stream: asking for the same
-- state twice leaves one row in one state, which is what makes a retry from a phone on a bad connection harmless
-- with no idempotency token at all -- exactly as the Phase 2J milestone table works.
--
-- There is deliberately NO visibility column. These rows are never customer-visible under any value, so a column
-- would imply a setting that could disclose them; a customer's closeout payload carries no checklist key at all.
CREATE TABLE IF NOT EXISTS catering_booking_closeout_items (
  booking_id varchar NOT NULL REFERENCES catering_bookings(id) ON DELETE RESTRICT,
  item_key varchar(40) NOT NULL,
  state varchar(16) NOT NULL DEFAULT 'pending',
  provider_note text,
  resolved_at timestamptz,
  resolved_by varchar REFERENCES users(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT catering_booking_closeout_items_pkey PRIMARY KEY (booking_id, item_key),
  CONSTRAINT catering_closeout_item_key_check CHECK (item_key IN ('equipment_return_confirmed', 'final_documents_delivered', 'customer_follow_up_completed', 'internal_event_notes_completed', 'review_request_handled', 'incident_follow_up_resolved', 'final_admin_review_completed')),
  CONSTRAINT catering_closeout_item_state_check CHECK (state IN ('pending', 'completed', 'not_applicable')),
  -- A resolved item always records when and by whom; a pending one never carries either. This is the invariant the
  -- serializer's resolvedAt depends on, so no write path can leave a row it would misreport.
  CONSTRAINT catering_closeout_item_resolved_check CHECK ((state = 'pending' AND resolved_at IS NULL AND resolved_by IS NULL) OR (state <> 'pending' AND resolved_at IS NOT NULL AND resolved_by IS NOT NULL))
);
-- The checklist is always read as one whole collection for one booking, which is exactly this index.
CREATE INDEX IF NOT EXISTS catering_closeout_items_booking_idx ON catering_booking_closeout_items(booking_id, item_key);

-- Phase 2K extends the Phase 2H/2I/2J activity allowlist by exactly two events and removes none. Both describe a
-- customer-visible closeout change and are written with 'shared' visibility; no provider-private closeout change
-- writes activity at all.
ALTER TABLE catering_booking_activity DROP CONSTRAINT IF EXISTS catering_booking_activity_event_type_check;
ALTER TABLE catering_booking_activity ADD CONSTRAINT catering_booking_activity_event_type_check
  CHECK (event_type IN ('booking_offered', 'customer_confirmed', 'booking_cancelled', 'booking_completed', 'details_updated', 'shared_requirement_added', 'shared_requirement_updated', 'shared_requirement_completed', 'shared_requirement_deleted', 'shared_file_uploaded', 'shared_file_removed', 'provider_file_uploaded', 'provider_file_removed', 'execution_timeline_added', 'execution_timeline_updated', 'execution_timeline_completed', 'execution_timeline_removed', 'shared_equipment_added', 'shared_equipment_status_changed', 'execution_access_updated', 'provider_execution_milestone_completed', 'booking_closed_out', 'booking_closeout_reopened'));
