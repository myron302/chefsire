-- Catering Phase 2Q: Square SANDBOX processor-backed customer payments.
--
-- Requires the Phase 2L billing tables (20260913_catering_booking_billing.sql) and the Square Gate 0 connection hardening.
--
-- ADDITIVE. Two new tables, one widened CHECK on catering_booking_activity (one new event), one widened CHECK on
-- catering_booking_payments.payment_method (one new method) and two new CHECKs on the same table that make a processor payment
-- unforgeable as a provider-recorded one and the reverse.
--
-- FUNDS FLOW. The customer pays on Square's hosted checkout, which is created UNDER THE PROVIDER'S OWN connected Square account
-- (their OAuth credential, their verified merchant, their verified location). The money settles to that provider. ChefSire never
-- receives, holds or routes it, and no platform Square account, platform fee, payout or refund is involved. A ledger row is only
-- ever written from fresh, authenticated Square evidence read back with the provider's own credential.
--
-- SANDBOX ONLY. processor_environment is CHECKed to 'sandbox', so no row describing a production charge can exist until a later
-- launch phase deliberately relaxes the constraint.
--
-- Money is INTEGER CENTS. No credential, token or ciphertext is stored in either table.

CREATE TABLE IF NOT EXISTS catering_booking_payment_attempts (
  id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id varchar NOT NULL REFERENCES catering_bookings(id) ON DELETE RESTRICT,
  invoice_id varchar NOT NULL REFERENCES catering_booking_invoices(id) ON DELETE RESTRICT,
  customer_id varchar NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  provider_id varchar NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  processor varchar(24) NOT NULL DEFAULT 'square',
  processor_environment varchar(12) NOT NULL DEFAULT 'sandbox',
  -- The provider's verified Square merchant and card-capable location AT THE TIME OF THE ATTEMPT. Every later verification is
  -- judged against these, not against whatever the provider's connection says today.
  merchant_id text NOT NULL,
  location_id text NOT NULL,
  currency varchar(3) NOT NULL,
  -- The amount the SERVER derived (current effective payable) when the attempt was created. Never client supplied.
  amount_cents bigint NOT NULL,
  -- Persisted BEFORE the Square call, and sent as Square's idempotency key, so a retry after an uncertain result resumes the same
  -- checkout instead of creating another one.
  idempotency_key varchar(64) NOT NULL,
  state varchar(32) NOT NULL DEFAULT 'creating',
  square_payment_link_id text,
  square_order_id text,
  checkout_url text,
  -- Authoritative processor evidence. Present only once fresh Square state showed a COMPLETED payment for this attempt's order.
  square_payment_id text,
  processor_amount_cents bigint,
  processor_currency varchar(3),
  -- The ledger row this attempt credited. NULL for every state except 'completed'.
  payment_id varchar REFERENCES catering_booking_payments(id) ON DELETE RESTRICT,
  reconciliation_reason varchar(40),
  failure_code varchar(40),
  last_checked_at timestamptz,
  verified_at timestamptz,
  completed_at timestamptz,
  closed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT catering_attempt_processor_check CHECK (processor = 'square'),
  CONSTRAINT catering_attempt_environment_check CHECK (processor_environment = 'sandbox'),
  CONSTRAINT catering_attempt_currency_check CHECK (currency = 'USD'),
  CONSTRAINT catering_attempt_amount_check CHECK (amount_cents > 0 AND amount_cents <= 9999999999),
  CONSTRAINT catering_attempt_state_check CHECK (state IN ('creating', 'pending', 'completed', 'failed', 'expired', 'cancelled', 'superseded', 'reconciliation_required')),
  CONSTRAINT catering_attempt_processor_amount_check CHECK (processor_amount_cents IS NULL OR (processor_amount_cents > 0 AND processor_amount_cents <= 9999999999)),
  CONSTRAINT catering_attempt_processor_currency_check CHECK (processor_currency IS NULL OR processor_currency ~ '^[A-Z]{3}$'),
  -- A pending attempt always has a checkout the customer can open and the order that reconciles it.
  CONSTRAINT catering_attempt_pending_check CHECK (state <> 'pending' OR (square_order_id IS NOT NULL AND square_payment_link_id IS NOT NULL AND checkout_url IS NOT NULL)),
  -- A completed attempt always names the ledger row it credited and the Square payment that justified it.
  CONSTRAINT catering_attempt_completed_check CHECK (state <> 'completed' OR (payment_id IS NOT NULL AND square_payment_id IS NOT NULL AND processor_amount_cents IS NOT NULL AND processor_currency IS NOT NULL AND completed_at IS NOT NULL)),
  -- A ledger link exists only on a completed attempt.
  CONSTRAINT catering_attempt_ledger_link_check CHECK (payment_id IS NULL OR state = 'completed'),
  -- Money that moved but could not be credited keeps its evidence and never carries a ledger link.
  CONSTRAINT catering_attempt_reconciliation_check CHECK (state <> 'reconciliation_required' OR (payment_id IS NULL AND square_payment_id IS NOT NULL AND processor_amount_cents IS NOT NULL AND processor_currency IS NOT NULL AND reconciliation_reason IS NOT NULL)),
  CONSTRAINT catering_attempt_reconciliation_reason_check CHECK (reconciliation_reason IS NULL OR state = 'reconciliation_required'),
  -- A Square payment id is only ever recorded on the two states that represent money that moved.
  CONSTRAINT catering_attempt_payment_evidence_check CHECK (square_payment_id IS NULL OR state IN ('completed', 'reconciliation_required'))
);

-- One attempt per idempotency key, per Square order, per payment link, per Square payment and per ledger row.
CREATE UNIQUE INDEX IF NOT EXISTS catering_attempts_idempotency_uidx ON catering_booking_payment_attempts (idempotency_key);
CREATE UNIQUE INDEX IF NOT EXISTS catering_attempts_order_uidx ON catering_booking_payment_attempts (square_order_id) WHERE square_order_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS catering_attempts_link_uidx ON catering_booking_payment_attempts (square_payment_link_id) WHERE square_payment_link_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS catering_attempts_square_payment_uidx ON catering_booking_payment_attempts (square_payment_id) WHERE square_payment_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS catering_attempts_ledger_uidx ON catering_booking_payment_attempts (payment_id) WHERE payment_id IS NOT NULL;
-- At most ONE open (creating or pending) attempt per invoice: two tabs, a double click or a retry cannot open two checkouts.
CREATE UNIQUE INDEX IF NOT EXISTS catering_attempts_open_invoice_uidx ON catering_booking_payment_attempts (invoice_id) WHERE state IN ('creating', 'pending');
CREATE INDEX IF NOT EXISTS catering_attempts_booking_idx ON catering_booking_payment_attempts (booking_id, created_at, id);
CREATE INDEX IF NOT EXISTS catering_attempts_invoice_idx ON catering_booking_payment_attempts (invoice_id, state);

-- Square webhook deliveries, for replay protection and retry. A row is a TRIGGER record, never evidence: only the identifiers
-- needed to find the attempt are kept, never the payload. event_id is Square's own and is unique, so a redelivery cannot be
-- processed as a second event.
CREATE TABLE IF NOT EXISTS catering_square_webhook_events (
  id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id text NOT NULL,
  event_type varchar(64) NOT NULL,
  merchant_id text,
  square_order_id text,
  square_payment_id text,
  attempt_id varchar REFERENCES catering_booking_payment_attempts(id) ON DELETE RESTRICT,
  state varchar(16) NOT NULL DEFAULT 'received',
  attempt_count integer NOT NULL DEFAULT 0,
  outcome varchar(40),
  received_at timestamptz NOT NULL DEFAULT now(),
  processed_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT catering_square_webhook_state_check CHECK (state IN ('received', 'processing', 'processed', 'ignored', 'failed')),
  CONSTRAINT catering_square_webhook_attempt_count_check CHECK (attempt_count >= 0)
);
CREATE UNIQUE INDEX IF NOT EXISTS catering_square_webhook_event_uidx ON catering_square_webhook_events (event_id);
CREATE INDEX IF NOT EXISTS catering_square_webhook_attempt_idx ON catering_square_webhook_events (attempt_id) WHERE attempt_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS catering_square_webhook_retry_idx ON catering_square_webhook_events (state, updated_at) WHERE state IN ('received', 'processing', 'failed');

-- A processor-confirmed payment gets its own method, which a provider can never record: the pair of CHECKs below makes
-- 'card_online' and source 'processor' imply each other, and a processor id can only be Square's.
ALTER TABLE catering_booking_payments DROP CONSTRAINT IF EXISTS catering_payment_method_check;
ALTER TABLE catering_booking_payments ADD CONSTRAINT catering_payment_method_check CHECK (payment_method IN ('cash', 'bank_transfer', 'card_in_person', 'cheque', 'other', 'card_online'));
ALTER TABLE catering_booking_payments DROP CONSTRAINT IF EXISTS catering_payment_online_method_check;
ALTER TABLE catering_booking_payments ADD CONSTRAINT catering_payment_online_method_check CHECK ((payment_method = 'card_online') = (payment_source = 'processor'));
ALTER TABLE catering_booking_payments DROP CONSTRAINT IF EXISTS catering_payment_processor_check;
ALTER TABLE catering_booking_payments ADD CONSTRAINT catering_payment_processor_check CHECK (processor IS NULL OR processor = 'square');

-- The activity allowlist gains exactly one event, losing none.
ALTER TABLE catering_booking_activity DROP CONSTRAINT IF EXISTS catering_booking_activity_event_type_check;
ALTER TABLE catering_booking_activity ADD CONSTRAINT catering_booking_activity_event_type_check CHECK (event_type IN (
  'booking_offered', 'customer_confirmed', 'booking_cancelled', 'booking_completed', 'details_updated',
  'shared_requirement_added', 'shared_requirement_updated', 'shared_requirement_completed', 'shared_requirement_deleted',
  'shared_file_uploaded', 'shared_file_removed', 'provider_file_uploaded', 'provider_file_removed',
  'execution_timeline_added', 'execution_timeline_updated', 'execution_timeline_completed', 'execution_timeline_removed',
  'shared_equipment_added', 'shared_equipment_status_changed', 'execution_access_updated', 'provider_execution_milestone_completed',
  'booking_closed_out', 'booking_closeout_reopened',
  'billing_invoice_issued', 'billing_invoice_voided', 'billing_payment_recorded', 'billing_payment_voided',
  'billing_processor_payment_confirmed'
));
