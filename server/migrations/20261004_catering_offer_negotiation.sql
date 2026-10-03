-- Phase 2N catering quote / offer negotiation.
--
-- Requires the Phase 2G booking table (20260827_catering_bookings.sql).
--
-- ADDITIVE ONLY. One new table; catering_bookings, catering_inquiries and every other table are untouched. Offers
-- that already exist (a pending_confirmation booking with no row here) keep rendering their own persisted terms and
-- get NO fabricated revision: the first row appears only when a provider or customer actually acts after this
-- migration. Terms are never inferred from free text.
--
-- An offer is still a catering_bookings row in pending_confirmation. This table is the negotiation history around it:
-- provider offer revisions ('offer') and customer change requests ('change_request'), one shared revision_number
-- sequence per booking. Money is INTEGER CENTS; the booking's numeric(12,2) price is derived from it, never the
-- other way round.
CREATE TABLE IF NOT EXISTS catering_offer_revisions (
  id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id varchar NOT NULL REFERENCES catering_bookings(id) ON DELETE RESTRICT,
  revision_number integer NOT NULL,
  kind varchar(16) NOT NULL,
  proposed_by_user_id varchar NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  proposed_by_role varchar(16) NOT NULL,
  -- Retry key: one submission, however many times it is sent, is one row. Never shown to anyone.
  client_request_id varchar(36) NOT NULL,
  -- For a change request, the offer revision it answers. NULL when it answered a legacy offer that has no revision.
  responds_to_revision_id varchar REFERENCES catering_offer_revisions(id) ON DELETE RESTRICT,
  price_cents bigint,
  currency varchar(3) NOT NULL DEFAULT 'USD',
  guest_count integer,
  note text,
  -- The customer's acceptance of THIS revision. The only column that may change after insert.
  accepted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT catering_offer_revisions_number_check CHECK (revision_number >= 1 AND revision_number <= 50),
  CONSTRAINT catering_offer_revisions_kind_check CHECK (kind IN ('offer', 'change_request')),
  CONSTRAINT catering_offer_revisions_role_check CHECK ((kind = 'offer' AND proposed_by_role = 'provider') OR (kind = 'change_request' AND proposed_by_role = 'customer')),
  CONSTRAINT catering_offer_revisions_price_check CHECK (price_cents IS NULL OR (price_cents >= 0 AND price_cents <= 9999999999)),
  CONSTRAINT catering_offer_revisions_guest_check CHECK (guest_count IS NULL OR (guest_count > 0 AND guest_count <= 100000)),
  CONSTRAINT catering_offer_revisions_currency_check CHECK (currency ~ '^[A-Z]{3}$'),
  CONSTRAINT catering_offer_revisions_change_request_check CHECK (kind <> 'change_request' OR (price_cents IS NULL AND guest_count IS NULL AND note IS NOT NULL AND length(btrim(note)) > 0 AND accepted_at IS NULL)),
  CONSTRAINT catering_offer_revisions_responds_to_check CHECK (kind = 'change_request' OR responds_to_revision_id IS NULL)
);
-- One revision number per booking, and one row per (booking, proposer, retry key).
CREATE UNIQUE INDEX IF NOT EXISTS catering_offer_revisions_booking_number_uidx ON catering_offer_revisions (booking_id, revision_number);
CREATE UNIQUE INDEX IF NOT EXISTS catering_offer_revisions_request_uidx ON catering_offer_revisions (booking_id, proposed_by_user_id, client_request_id);
-- At most one accepted revision per booking, whatever the application does.
CREATE UNIQUE INDEX IF NOT EXISTS catering_offer_revisions_accepted_uidx ON catering_offer_revisions (booking_id) WHERE accepted_at IS NOT NULL;

-- Historical revisions are immutable: once written, a row's terms never change and the row is never deleted. The one
-- permitted update is stamping accepted_at on an offer revision that has not been accepted yet.
CREATE OR REPLACE FUNCTION enforce_catering_offer_revision_immutable()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'catering offer revisions are never deleted';
  END IF;
  IF NEW.id IS DISTINCT FROM OLD.id
    OR NEW.booking_id IS DISTINCT FROM OLD.booking_id
    OR NEW.revision_number IS DISTINCT FROM OLD.revision_number
    OR NEW.kind IS DISTINCT FROM OLD.kind
    OR NEW.proposed_by_user_id IS DISTINCT FROM OLD.proposed_by_user_id
    OR NEW.proposed_by_role IS DISTINCT FROM OLD.proposed_by_role
    OR NEW.client_request_id IS DISTINCT FROM OLD.client_request_id
    OR NEW.responds_to_revision_id IS DISTINCT FROM OLD.responds_to_revision_id
    OR NEW.price_cents IS DISTINCT FROM OLD.price_cents
    OR NEW.currency IS DISTINCT FROM OLD.currency
    OR NEW.guest_count IS DISTINCT FROM OLD.guest_count
    OR NEW.note IS DISTINCT FROM OLD.note
    OR NEW.created_at IS DISTINCT FROM OLD.created_at
    OR (OLD.accepted_at IS NOT NULL AND NEW.accepted_at IS DISTINCT FROM OLD.accepted_at)
  THEN
    RAISE EXCEPTION 'catering offer revisions are immutable';
  END IF;
  RETURN NEW;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'catering_offer_revisions_immutable_trigger' AND tgrelid = 'catering_offer_revisions'::regclass) THEN
    CREATE TRIGGER catering_offer_revisions_immutable_trigger
      BEFORE UPDATE OR DELETE ON catering_offer_revisions
      FOR EACH ROW EXECUTE FUNCTION enforce_catering_offer_revision_immutable();
  END IF;
END $$;
