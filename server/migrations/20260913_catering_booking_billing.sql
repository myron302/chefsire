-- Phase 2L catering billing, deposits and final payments.
--
-- Requires the Phase 2G booking table (20260827_catering_bookings.sql) and the Phase 2H operational tables
-- (20260829_catering_booking_operations.sql) for the shared activity feed this phase writes into.
--
-- ADDITIVE ONLY. catering_bookings is not altered: agreed_price and currency are READ and never written, no
-- booking status is touched, and no Phase 2H, 2I, 2J or 2K table is modified. The single statement below that
-- changes an existing object is the activity event_type CHECK, widened by the four Phase 2L events and losing none
-- of the twenty-three it already carried.
--
-- NO MONEY MOVES THROUGH THESE TABLES. ChefSire's only working payment processor path (Square, via
-- server/lib/square.ts) charges into the platform's own single location, which is right for products ChefSire
-- sells and wrong for a marketplace where the caterer is the seller: server/routes/payouts.ts, the only route that
-- would pay a seller out, is written against a `square.Client` export that does not exist in the installed SDK, no
-- provider Square identity is persisted anywhere, and no client code calls it. So a payment row here is a caterer's
-- RECORD of money they received directly, attributed and auditable, and every customer-facing string says so. The
-- processor and processor_payment_id columns are the seam for a later phase and are null in every row this one
-- writes; the unique index on them is what will stop a verified webhook from ever crediting the same charge twice.
--
-- Money is INTEGER CENTS throughout. catering_bookings.agreed_price is decimal(12,2), parsed to cents exactly once
-- by a string parser with no floating point anywhere in it.

-- Per-booking deposit terms. One row, keyed by the booking, created lazily when a provider first configures terms.
CREATE TABLE IF NOT EXISTS catering_booking_billing (
  booking_id varchar PRIMARY KEY REFERENCES catering_bookings(id) ON DELETE RESTRICT,
  deposit_mode varchar(16) NOT NULL DEFAULT 'none',
  -- Exactly one of these carries a value, decided by deposit_mode; see the pairing CHECK below.
  deposit_amount_cents bigint,
  deposit_percent_bp integer,
  -- Date-only, in the booking's own calendar, exactly as catering_bookings.event_date is. A due date is a day, not
  -- an instant: a customer in another timezone must not see a deposit as overdue while it is still the 13th where
  -- the event is.
  deposit_due_on date,
  -- Persisted for audit and never serialized to either actor, exactly as Phase 2K keeps closed_out_by internal.
  terms_updated_by varchar REFERENCES users(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  -- The optimistic-concurrency version a terms write states its precondition against.
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT catering_billing_mode_check CHECK (deposit_mode IN ('none', 'fixed', 'percentage')),
  -- A mode and its figure travel together: a fixed deposit always has an amount and never a percentage, a
  -- percentage deposit always has basis points and never an amount, and 'none' has neither. There is no
  -- combination of columns that can express a contradictory deposit.
  CONSTRAINT catering_billing_terms_pairing_check CHECK (
    (deposit_mode = 'none' AND deposit_amount_cents IS NULL AND deposit_percent_bp IS NULL)
    OR (deposit_mode = 'fixed' AND deposit_amount_cents IS NOT NULL AND deposit_percent_bp IS NULL)
    OR (deposit_mode = 'percentage' AND deposit_percent_bp IS NOT NULL AND deposit_amount_cents IS NULL)
  ),
  CONSTRAINT catering_billing_amount_check CHECK (deposit_amount_cents IS NULL OR (deposit_amount_cents >= 0 AND deposit_amount_cents <= 9999999999)),
  -- Basis points, so half a percent is exact. Strictly above zero -- a deposit of nothing is 'none' -- and never
  -- above the whole job.
  CONSTRAINT catering_billing_percent_check CHECK (deposit_percent_bp IS NULL OR (deposit_percent_bp > 0 AND deposit_percent_bp <= 10000))
);

-- What the customer has actually been asked for. Amounts are derived server-side from the booking's agreed price;
-- no request in this phase carries an invoice amount at all.
CREATE TABLE IF NOT EXISTS catering_booking_invoices (
  id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id varchar NOT NULL REFERENCES catering_bookings(id) ON DELETE RESTRICT,
  -- A per-booking sequence, allocated under the booking's advisory lock, that gives each invoice a stable display
  -- reference and a deterministic order for "what is owed next".
  invoice_number integer NOT NULL,
  invoice_kind varchar(16) NOT NULL,
  amount_cents bigint NOT NULL,
  currency varchar(3) NOT NULL,
  -- PERSISTED status only. 'paid', 'partially_paid' and 'overdue' are deliberately absent: each is a function of
  -- the payment ledger and the current date, and a stored copy could disagree with the payments themselves.
  status varchar(16) NOT NULL DEFAULT 'draft',
  due_on date,
  issued_at timestamptz,
  voided_at timestamptz,
  void_reason varchar(200),
  created_by varchar REFERENCES users(id) ON DELETE RESTRICT,
  voided_by varchar REFERENCES users(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT catering_invoice_kind_check CHECK (invoice_kind IN ('deposit', 'balance')),
  CONSTRAINT catering_invoice_status_check CHECK (status IN ('draft', 'issued', 'void')),
  CONSTRAINT catering_invoice_amount_check CHECK (amount_cents > 0 AND amount_cents <= 9999999999),
  CONSTRAINT catering_invoice_currency_check CHECK (currency ~ '^[A-Z]{3}$'),
  CONSTRAINT catering_invoice_number_check CHECK (invoice_number > 0),
  -- An issued invoice always records when, and a voided one always records when. Neither timestamp can exist
  -- without the status that explains it, so no row can misreport its own history.
  CONSTRAINT catering_invoice_issued_check CHECK ((status = 'draft' AND issued_at IS NULL) OR (status <> 'draft' AND issued_at IS NOT NULL)),
  CONSTRAINT catering_invoice_void_check CHECK ((status = 'void' AND voided_at IS NOT NULL AND voided_by IS NOT NULL) OR (status <> 'void' AND voided_at IS NULL AND voided_by IS NULL))
);
CREATE UNIQUE INDEX IF NOT EXISTS catering_invoices_number_uidx ON catering_booking_invoices(booking_id, invoice_number);
-- At most ONE live invoice of each kind per booking. This is what makes a double-issue impossible under a
-- double-click, a retry or two tabs: the second insert violates the index inside the transaction rather than
-- creating a second ask for the same money. A voided invoice leaves the slot free again.
CREATE UNIQUE INDEX IF NOT EXISTS catering_invoices_live_kind_uidx ON catering_booking_invoices(booking_id, invoice_kind) WHERE status <> 'void';
CREATE INDEX IF NOT EXISTS catering_invoices_due_idx ON catering_booking_invoices(booking_id, status, due_on);

-- The payment ledger. Every credit against every invoice, including the ones that were taken back.
CREATE TABLE IF NOT EXISTS catering_booking_payments (
  id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id varchar NOT NULL REFERENCES catering_bookings(id) ON DELETE RESTRICT,
  invoice_id varchar NOT NULL REFERENCES catering_booking_invoices(id) ON DELETE RESTRICT,
  amount_cents bigint NOT NULL,
  currency varchar(3) NOT NULL,
  payment_method varchar(24) NOT NULL,
  -- 'provider_recorded' is the only value this phase writes. 'processor' is allowed by the constraint so that the
  -- column, the CHECK and the client's exhaustive handling are already correct when a verified webhook writes one.
  payment_source varchar(24) NOT NULL DEFAULT 'provider_recorded',
  status varchar(16) NOT NULL DEFAULT 'recorded',
  -- Date-only: the day the caterer says the money arrived.
  received_on date NOT NULL,
  -- The caterer's own bookkeeping note. PROVIDER ONLY -- never serialized to a customer.
  reference varchar(64),
  recorded_by varchar REFERENCES users(id) ON DELETE RESTRICT,
  voided_at timestamptz,
  voided_by varchar REFERENCES users(id) ON DELETE RESTRICT,
  void_reason varchar(200),
  -- The client's key for one attempt. Unique per booking, so a double-click, a browser retry or a replayed request
  -- resolves to the payment the first attempt created instead of crediting the money a second time.
  idempotency_key varchar(64),
  -- The processor seam. Null in every row this phase writes.
  processor varchar(24),
  processor_payment_id varchar(128),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT catering_payment_method_check CHECK (payment_method IN ('cash', 'bank_transfer', 'card_in_person', 'cheque', 'other')),
  CONSTRAINT catering_payment_source_check CHECK (payment_source IN ('provider_recorded', 'processor')),
  CONSTRAINT catering_payment_status_check CHECK (status IN ('recorded', 'voided')),
  CONSTRAINT catering_payment_amount_check CHECK (amount_cents > 0 AND amount_cents <= 9999999999),
  CONSTRAINT catering_payment_currency_check CHECK (currency ~ '^[A-Z]{3}$'),
  CONSTRAINT catering_payment_void_check CHECK ((status = 'voided' AND voided_at IS NOT NULL AND voided_by IS NOT NULL) OR (status <> 'voided' AND voided_at IS NULL AND voided_by IS NULL)),
  -- A provider-recorded payment always names the person who recorded it and carries no processor identity; a
  -- processor payment is the exact opposite. Neither can be forged into the other's shape.
  CONSTRAINT catering_payment_provenance_check CHECK (
    (payment_source = 'provider_recorded' AND recorded_by IS NOT NULL AND processor IS NULL AND processor_payment_id IS NULL)
    OR (payment_source = 'processor' AND processor IS NOT NULL AND processor_payment_id IS NOT NULL)
  )
);
CREATE UNIQUE INDEX IF NOT EXISTS catering_payments_idempotency_uidx ON catering_booking_payments(booking_id, idempotency_key) WHERE idempotency_key IS NOT NULL;
-- One processor charge can be credited exactly once, however many times its webhook is delivered.
CREATE UNIQUE INDEX IF NOT EXISTS catering_payments_processor_uidx ON catering_booking_payments(processor, processor_payment_id) WHERE processor_payment_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS catering_payments_invoice_idx ON catering_booking_payments(invoice_id, status);
CREATE INDEX IF NOT EXISTS catering_payments_booking_idx ON catering_booking_payments(booking_id, received_on, id);

-- Phase 2L extends the Phase 2H/2I/2J/2K activity allowlist by exactly four events and removes none. All four are
-- written with 'shared' visibility because all four are things the customer is entitled to know: what they were
-- asked for, what was taken back, what was credited to them, and what was un-credited. Configuring deposit terms
-- writes nothing -- unissued terms are the provider's planning, not an ask.
ALTER TABLE catering_booking_activity DROP CONSTRAINT IF EXISTS catering_booking_activity_event_type_check;
ALTER TABLE catering_booking_activity ADD CONSTRAINT catering_booking_activity_event_type_check
  CHECK (event_type IN ('booking_offered', 'customer_confirmed', 'booking_cancelled', 'booking_completed', 'details_updated', 'shared_requirement_added', 'shared_requirement_updated', 'shared_requirement_completed', 'shared_requirement_deleted', 'shared_file_uploaded', 'shared_file_removed', 'provider_file_uploaded', 'provider_file_removed', 'execution_timeline_added', 'execution_timeline_updated', 'execution_timeline_completed', 'execution_timeline_removed', 'shared_equipment_added', 'shared_equipment_status_changed', 'execution_access_updated', 'provider_execution_milestone_completed', 'booking_closed_out', 'booking_closeout_reopened', 'billing_invoice_issued', 'billing_invoice_voided', 'billing_payment_recorded', 'billing_payment_voided'));
