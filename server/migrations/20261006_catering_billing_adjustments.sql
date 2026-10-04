-- Phase 2P catering billing adjustments, credits and external refund records.
--
-- Requires the Phase 2L billing tables (20260913_catering_booking_billing.sql) and the Phase 2O amendment table
-- (20261005_catering_booking_amendments.sql).
--
-- ADDITIVE, with ONE widening. One new ledger table; catering_bookings, every invoice row, every payment row and every
-- amendment row are untouched, and no adjustment is fabricated for a booking that predates this table: a legacy
-- invoice or payment needs no ledger entry to be correct. The one change to an existing object is the invoice kind
-- CHECK, widened by 'adjustment' (a request for payment of what was ADDED after the balance was issued), and the live
-- kind unique index, which now leaves that one kind out so a later addition can be requested after an earlier one.
--
-- NO MONEY MOVES THROUGH THIS TABLE. A charge is an obligation, a credit reduces one, and a refund row is the provider's
-- RECORD that money was returned outside ChefSire. There is no processor column, no transaction id and nothing here that
-- implies ChefSire verified or sent anything. Money is INTEGER CENTS.
CREATE TABLE IF NOT EXISTS catering_booking_adjustments (
  id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id varchar NOT NULL REFERENCES catering_bookings(id) ON DELETE RESTRICT,
  entry_kind varchar(16) NOT NULL,
  -- 'provider_recorded' is typed by the provider. 'amendment' is written in the SAME transaction that accepts a price
  -- amendment after billing began, and explains a movement the agreed price already contains.
  source varchar(24) NOT NULL DEFAULT 'provider_recorded',
  status varchar(16) NOT NULL DEFAULT 'posted',
  amount_cents bigint NOT NULL,
  currency varchar(3) NOT NULL,
  -- Customer-visible by definition: the form says so before anything is written.
  reason varchar(500) NOT NULL,
  -- Refunds only. PROVIDER ONLY, never serialized to a customer, and NOT verified by ChefSire.
  reference varchar(64),
  -- Refunds only: the recorded payment the money was returned from, when the provider names one.
  payment_id varchar REFERENCES catering_booking_payments(id) ON DELETE RESTRICT,
  amendment_id varchar REFERENCES catering_booking_amendments(id) ON DELETE RESTRICT,
  -- The client's key for ONE attempt, unique per booking. An amendment-generated row has none: the amendment is its key.
  idempotency_key varchar(64),
  recorded_by varchar NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  reversed_at timestamptz,
  reversed_by varchar REFERENCES users(id) ON DELETE RESTRICT,
  reversal_reason varchar(500),
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT catering_adjustment_kind_check CHECK (entry_kind IN ('charge', 'credit', 'refund')),
  CONSTRAINT catering_adjustment_source_check CHECK (source IN ('provider_recorded', 'amendment')),
  CONSTRAINT catering_adjustment_status_check CHECK (status IN ('posted', 'reversed')),
  CONSTRAINT catering_adjustment_amount_check CHECK (amount_cents > 0 AND amount_cents <= 9999999999),
  CONSTRAINT catering_adjustment_currency_check CHECK (currency ~ '^[A-Z]{3}$'),
  CONSTRAINT catering_adjustment_reason_check CHECK (length(btrim(reason)) > 0),
  -- A provider entry carries its attempt key and no amendment; an amendment entry carries its amendment, is a charge or a
  -- credit, names no payment and carries no key. Neither can be forged into the other's shape.
  CONSTRAINT catering_adjustment_provenance_check CHECK (
    (source = 'provider_recorded' AND amendment_id IS NULL AND idempotency_key IS NOT NULL)
    OR (source = 'amendment' AND amendment_id IS NOT NULL AND idempotency_key IS NULL AND entry_kind IN ('charge', 'credit') AND payment_id IS NULL AND reference IS NULL)
  ),
  -- Only a refund names a payment or carries a reference.
  CONSTRAINT catering_adjustment_refund_columns_check CHECK ((payment_id IS NULL AND reference IS NULL) OR entry_kind = 'refund'),
  -- A reversal always says when, by whom and why, and an amendment-generated entry is never reversed here.
  CONSTRAINT catering_adjustment_reversal_check CHECK (
    (status = 'posted' AND reversed_at IS NULL AND reversed_by IS NULL AND reversal_reason IS NULL)
    OR (status = 'reversed' AND source = 'provider_recorded' AND reversed_at IS NOT NULL AND reversed_by IS NOT NULL AND reversal_reason IS NOT NULL AND length(btrim(reversal_reason)) > 0)
  )
);
-- One row per (booking, attempt key): a replay resolves to the entry the first attempt created.
CREATE UNIQUE INDEX IF NOT EXISTS catering_adjustments_idempotency_uidx ON catering_booking_adjustments (booking_id, idempotency_key) WHERE idempotency_key IS NOT NULL;
-- One amendment produces at most ONE ledger entry, however many times its acceptance is retried or raced.
CREATE UNIQUE INDEX IF NOT EXISTS catering_adjustments_amendment_uidx ON catering_booking_adjustments (amendment_id) WHERE amendment_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS catering_adjustments_booking_idx ON catering_booking_adjustments (booking_id, created_at, id);
CREATE INDEX IF NOT EXISTS catering_adjustments_payment_idx ON catering_booking_adjustments (payment_id) WHERE payment_id IS NOT NULL;

-- Posted entries are history: never edited and never deleted. The one permitted update is reversing a POSTED provider
-- entry, which sets exactly the three reversal columns and the status.
CREATE OR REPLACE FUNCTION enforce_catering_booking_adjustment_immutable()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'catering booking adjustments are never deleted';
  END IF;
  IF NEW.id IS DISTINCT FROM OLD.id
    OR NEW.booking_id IS DISTINCT FROM OLD.booking_id
    OR NEW.entry_kind IS DISTINCT FROM OLD.entry_kind
    OR NEW.source IS DISTINCT FROM OLD.source
    OR NEW.amount_cents IS DISTINCT FROM OLD.amount_cents
    OR NEW.currency IS DISTINCT FROM OLD.currency
    OR NEW.reason IS DISTINCT FROM OLD.reason
    OR NEW.reference IS DISTINCT FROM OLD.reference
    OR NEW.payment_id IS DISTINCT FROM OLD.payment_id
    OR NEW.amendment_id IS DISTINCT FROM OLD.amendment_id
    OR NEW.idempotency_key IS DISTINCT FROM OLD.idempotency_key
    OR NEW.recorded_by IS DISTINCT FROM OLD.recorded_by
    OR NEW.created_at IS DISTINCT FROM OLD.created_at
    OR (OLD.status <> 'posted' AND (NEW.status IS DISTINCT FROM OLD.status OR NEW.reversed_at IS DISTINCT FROM OLD.reversed_at OR NEW.reversed_by IS DISTINCT FROM OLD.reversed_by OR NEW.reversal_reason IS DISTINCT FROM OLD.reversal_reason))
  THEN
    RAISE EXCEPTION 'catering booking adjustments are immutable';
  END IF;
  RETURN NEW;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'catering_booking_adjustments_immutable_trigger' AND tgrelid = 'catering_booking_adjustments'::regclass) THEN
    CREATE TRIGGER catering_booking_adjustments_immutable_trigger
      BEFORE UPDATE OR DELETE ON catering_booking_adjustments
      FOR EACH ROW EXECUTE FUNCTION enforce_catering_booking_adjustment_immutable();
  END IF;
END $$;

-- An 'adjustment' request for payment: what the obligation has grown by since the balance was issued. The server derives
-- its amount from the ledger under the booking's lock; no request carries one.
ALTER TABLE catering_booking_invoices DROP CONSTRAINT IF EXISTS catering_invoice_kind_check;
ALTER TABLE catering_booking_invoices ADD CONSTRAINT catering_invoice_kind_check CHECK (invoice_kind IN ('deposit', 'balance', 'adjustment'));
-- At most one live deposit and one live balance, exactly as before. Several adjustment requests may be live together,
-- each bounded by the headroom the obligation has over the live invoices at the moment it is issued.
DROP INDEX IF EXISTS catering_invoices_live_kind_uidx;
CREATE UNIQUE INDEX IF NOT EXISTS catering_invoices_live_kind_uidx ON catering_booking_invoices(booking_id, invoice_kind) WHERE status <> 'void' AND invoice_kind <> 'adjustment';
