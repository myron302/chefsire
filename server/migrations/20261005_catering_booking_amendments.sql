-- Phase 2O catering post-confirmation booking amendments.
--
-- Requires the Phase 2G booking table (20260827_catering_bookings.sql).
--
-- ADDITIVE ONLY. One new table; catering_bookings, the Phase 2L billing tables, the Phase 2N offer revisions and every
-- other table are untouched. No amendment is fabricated for a booking that predates this table: the first row appears
-- only when a participant actually proposes a change after this migration.
--
-- catering_bookings stays the authoritative CURRENT projection. This table is the history that explains how it changed:
-- one row per proposed change to a CONFIRMED booking, immutable once written except for the single response that
-- closes it. Money is INTEGER CENTS; the booking's numeric(12,2) price is derived from it on acceptance, never the
-- other way round.
CREATE TABLE IF NOT EXISTS catering_booking_amendments (
  id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id varchar NOT NULL REFERENCES catering_bookings(id) ON DELETE RESTRICT,
  amendment_number integer NOT NULL,
  proposed_by_user_id varchar NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  proposed_by_role varchar(16) NOT NULL,
  -- Retry key: one submission, however many times it is sent, is one row. Never shown to anyone.
  client_request_id varchar(36) NOT NULL,
  status varchar(16) NOT NULL DEFAULT 'pending',
  -- Which terms this amendment changes. A field outside this list is NOT changed, whatever its column holds (it holds NULL).
  changed_fields text[] NOT NULL,
  -- The terms this proposal was written against, frozen at proposal time. They are what an acceptance is checked against
  -- and what the OLD side of every displayed change reads; they never follow the booking afterwards.
  base_accepted_amendment_id varchar REFERENCES catering_booking_amendments(id) ON DELETE RESTRICT,
  base_event_date date NOT NULL,
  base_guest_count integer,
  base_price_cents bigint,
  base_currency varchar(3) NOT NULL,
  base_terms_note text,
  -- The proposed values. NULL guest_count / price_cents / terms_note INSIDE changed_fields means "cleared".
  event_date date,
  guest_count integer,
  price_cents bigint,
  currency varchar(3),
  terms_note text,
  -- Optional customer-visible reason, shared by both participants.
  message text,
  responded_by_user_id varchar REFERENCES users(id) ON DELETE RESTRICT,
  responded_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT catering_amendments_number_check CHECK (amendment_number >= 1 AND amendment_number <= 50),
  CONSTRAINT catering_amendments_role_check CHECK (proposed_by_role IN ('provider', 'customer')),
  CONSTRAINT catering_amendments_status_check CHECK (status IN ('pending', 'accepted', 'declined', 'withdrawn', 'superseded')),
  CONSTRAINT catering_amendments_fields_check CHECK (cardinality(changed_fields) >= 1 AND changed_fields <@ ARRAY['event_date', 'guest_count', 'price_cents', 'currency', 'terms_note']::text[]),
  -- A proposed value exists exactly where its field is listed (a listed nullable field may be NULL: that is a clear).
  CONSTRAINT catering_amendments_event_date_check CHECK (('event_date' = ANY(changed_fields) AND event_date IS NOT NULL) OR ('event_date' <> ALL(changed_fields) AND event_date IS NULL)),
  CONSTRAINT catering_amendments_currency_check CHECK (('currency' = ANY(changed_fields) AND currency IS NOT NULL AND currency ~ '^[A-Z]{3}$') OR ('currency' <> ALL(changed_fields) AND currency IS NULL)),
  CONSTRAINT catering_amendments_guest_unlisted_check CHECK ('guest_count' = ANY(changed_fields) OR guest_count IS NULL),
  CONSTRAINT catering_amendments_price_unlisted_check CHECK ('price_cents' = ANY(changed_fields) OR price_cents IS NULL),
  CONSTRAINT catering_amendments_note_unlisted_check CHECK ('terms_note' = ANY(changed_fields) OR terms_note IS NULL),
  CONSTRAINT catering_amendments_guest_check CHECK (guest_count IS NULL OR (guest_count > 0 AND guest_count <= 100000)),
  CONSTRAINT catering_amendments_price_check CHECK (price_cents IS NULL OR (price_cents >= 0 AND price_cents <= 9999999999)),
  CONSTRAINT catering_amendments_base_guest_check CHECK (base_guest_count IS NULL OR base_guest_count > 0),
  CONSTRAINT catering_amendments_base_price_check CHECK (base_price_cents IS NULL OR base_price_cents >= 0),
  CONSTRAINT catering_amendments_base_currency_check CHECK (base_currency ~ '^[A-Z]{3}$'),
  CONSTRAINT catering_amendments_note_length_check CHECK ((terms_note IS NULL OR length(terms_note) <= 2000) AND (message IS NULL OR length(message) <= 1000)),
  -- A response is recorded exactly when the amendment is no longer pending, and only by the right person: the OTHER
  -- participant accepts or declines, the proposer withdraws, and a system closure (the booking ended) names nobody.
  CONSTRAINT catering_amendments_response_check CHECK (
    (status = 'pending' AND responded_by_user_id IS NULL AND responded_at IS NULL)
    OR (status IN ('accepted', 'declined') AND responded_by_user_id IS NOT NULL AND responded_by_user_id <> proposed_by_user_id AND responded_at IS NOT NULL)
    OR (status = 'withdrawn' AND responded_by_user_id = proposed_by_user_id AND responded_at IS NOT NULL)
    OR (status = 'superseded' AND responded_by_user_id IS NULL AND responded_at IS NOT NULL)
  )
);
-- One number per booking, one row per (booking, proposer, retry key).
CREATE UNIQUE INDEX IF NOT EXISTS catering_amendments_booking_number_uidx ON catering_booking_amendments (booking_id, amendment_number);
CREATE UNIQUE INDEX IF NOT EXISTS catering_amendments_request_uidx ON catering_booking_amendments (booking_id, proposed_by_user_id, client_request_id);
-- At most ONE pending amendment per booking, whatever the application does: two competing proposals cannot both be accepted.
CREATE UNIQUE INDEX IF NOT EXISTS catering_amendments_pending_uidx ON catering_booking_amendments (booking_id) WHERE status = 'pending';

-- Historical amendments are immutable: a row's proposal never changes and it is never deleted. The one permitted update
-- is closing a PENDING row (accepted / declined / withdrawn / superseded) together with its response columns.
CREATE OR REPLACE FUNCTION enforce_catering_booking_amendment_immutable()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'catering booking amendments are never deleted';
  END IF;
  IF NEW.id IS DISTINCT FROM OLD.id
    OR NEW.booking_id IS DISTINCT FROM OLD.booking_id
    OR NEW.amendment_number IS DISTINCT FROM OLD.amendment_number
    OR NEW.proposed_by_user_id IS DISTINCT FROM OLD.proposed_by_user_id
    OR NEW.proposed_by_role IS DISTINCT FROM OLD.proposed_by_role
    OR NEW.client_request_id IS DISTINCT FROM OLD.client_request_id
    OR NEW.changed_fields IS DISTINCT FROM OLD.changed_fields
    OR NEW.base_accepted_amendment_id IS DISTINCT FROM OLD.base_accepted_amendment_id
    OR NEW.base_event_date IS DISTINCT FROM OLD.base_event_date
    OR NEW.base_guest_count IS DISTINCT FROM OLD.base_guest_count
    OR NEW.base_price_cents IS DISTINCT FROM OLD.base_price_cents
    OR NEW.base_currency IS DISTINCT FROM OLD.base_currency
    OR NEW.base_terms_note IS DISTINCT FROM OLD.base_terms_note
    OR NEW.event_date IS DISTINCT FROM OLD.event_date
    OR NEW.guest_count IS DISTINCT FROM OLD.guest_count
    OR NEW.price_cents IS DISTINCT FROM OLD.price_cents
    OR NEW.currency IS DISTINCT FROM OLD.currency
    OR NEW.terms_note IS DISTINCT FROM OLD.terms_note
    OR NEW.message IS DISTINCT FROM OLD.message
    OR NEW.created_at IS DISTINCT FROM OLD.created_at
    OR (OLD.status <> 'pending' AND (NEW.status IS DISTINCT FROM OLD.status OR NEW.responded_by_user_id IS DISTINCT FROM OLD.responded_by_user_id OR NEW.responded_at IS DISTINCT FROM OLD.responded_at))
  THEN
    RAISE EXCEPTION 'catering booking amendments are immutable';
  END IF;
  RETURN NEW;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'catering_booking_amendments_immutable_trigger' AND tgrelid = 'catering_booking_amendments'::regclass) THEN
    CREATE TRIGGER catering_booking_amendments_immutable_trigger
      BEFORE UPDATE OR DELETE ON catering_booking_amendments
      FOR EACH ROW EXECUTE FUNCTION enforce_catering_booking_amendment_immutable();
  END IF;
END $$;
