import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

/**
 * The Phase 2L persistence, asserted against the migration and the Drizzle schema together.
 *
 * There is no live database in this suite, so the invariants that live in constraints are checked as text -- which
 * is exactly what catches the two mistakes that matter: a migration and a Drizzle table drifting apart, and a
 * money column that is not an integer.
 */

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const migration = fs.readFileSync(path.join(repoRoot, "server", "migrations", "20260913_catering_booking_billing.sql"), "utf8");
const schema = fs.readFileSync(path.join(repoRoot, "shared", "schema", "domains", "social-content.ts"), "utf8");
const billingSchema = schema.slice(schema.indexOf("export const cateringBookingBilling = pgTable"), schema.indexOf("export const cateringReviews = pgTable"));
/**
 * The migration with its `--` comments removed.
 *
 * The header of that file explains at length why money is never a float, why `overdue` is not persisted and why no
 * payout detail is stored -- so a scan for those words has to look at the DDL, not at the prose defending it.
 */
const ddl = migration.replace(/^\s*--.*$/gm, "");

/* ------------------------------------------------------------------------------------------------------------- *
 * Additive only
 * ------------------------------------------------------------------------------------------------------------- */

test("the migration creates three tables and alters nothing but the activity allowlist", () => {
  assert.deepEqual([...migration.matchAll(/CREATE TABLE IF NOT EXISTS (\w+)/g)].map((match) => match[1]),
    ["catering_booking_billing", "catering_booking_invoices", "catering_booking_payments"]);
  // The only ALTER is the activity CHECK, widened by the four billing events.
  const alters = [...migration.matchAll(/ALTER TABLE (\w+)/g)].map((match) => match[1]);
  assert.deepEqual([...new Set(alters)], ["catering_booking_activity"]);
});

test("no earlier phase's table is touched, and catering_bookings is only referenced", () => {
  for (const forbidden of ["ALTER TABLE catering_bookings", "DROP TABLE", "UPDATE catering_bookings", "ALTER COLUMN", "DROP COLUMN"]) {
    assert.equal(migration.includes(forbidden), false, forbidden);
  }
  assert.ok(migration.includes("REFERENCES catering_bookings(id) ON DELETE RESTRICT"));
});

test("historical migrations are untouched by this phase", () => {
  // Additive only: every earlier catering migration still has its own name and is not rewritten here.
  for (const earlier of ["20260827_catering_bookings.sql", "20260829_catering_booking_operations.sql", "20260911_catering_booking_closeout.sql"]) {
    assert.ok(fs.existsSync(path.join(repoRoot, "server", "migrations", earlier)), earlier);
  }
});

/* ------------------------------------------------------------------------------------------------------------- *
 * Money is an integer
 * ------------------------------------------------------------------------------------------------------------- */

test("every money column is bigint cents -- there is no decimal, real, float or numeric anywhere", () => {
  const amounts = [...ddl.matchAll(/^\s+(\w*amount\w*|\w*cents\w*) (\w+)/gim)].map((match) => [match[1], match[2]]);
  assert.ok(amounts.length >= 3, JSON.stringify(amounts));
  for (const [column, type] of amounts) {
    assert.equal(type, "bigint", `${column} is ${type}`);
  }
  for (const forbidden of [" decimal(", " numeric(", " real", " double precision", " float"]) {
    assert.equal(ddl.toLowerCase().includes(forbidden), false, forbidden);
  }
  assert.equal(billingSchema.includes("decimal("), false, "and the Drizzle tables carry no decimal money either");
  assert.equal((billingSchema.match(/bigint\("(?:deposit_amount_cents|amount_cents)"/g) ?? []).length, 3);
});

test("every money column is read as a number rather than a string", () => {
  // `{ mode: "number" }` is what keeps a cents value an integer in JavaScript instead of a decimal string that
  // someone would eventually be tempted to `parseFloat`.
  for (const match of billingSchema.matchAll(/bigint\("(\w+)", \{ mode: "(\w+)" \}\)/g)) {
    assert.equal(match[2], "number", match[1]);
  }
});

test("percentages are basis points, so half a percent is exact and no fraction is persisted", () => {
  assert.ok(migration.includes("deposit_percent_bp integer"));
  assert.ok(migration.includes("CHECK (deposit_percent_bp IS NULL OR (deposit_percent_bp > 0 AND deposit_percent_bp <= 10000))"));
  assert.ok(billingSchema.includes('integer("deposit_percent_bp")'));
});

/* ------------------------------------------------------------------------------------------------------------- *
 * Constraints that make bad states unrepresentable
 * ------------------------------------------------------------------------------------------------------------- */

const constraints = [
  ["catering_billing_mode_check", "the deposit mode allowlist"],
  ["catering_billing_terms_pairing_check", "a mode and its figure travel together"],
  ["catering_billing_amount_check", "a deposit amount is non-negative and bounded"],
  ["catering_billing_percent_check", "a percentage is in (0, 100]"],
  ["catering_invoice_kind_check", "two invoice kinds and no third"],
  ["catering_invoice_status_check", "three persisted statuses"],
  ["catering_invoice_amount_check", "an invoice is for more than nothing"],
  ["catering_invoice_currency_check", "a three-letter currency"],
  ["catering_invoice_number_check", "a positive sequence"],
  ["catering_invoice_issued_check", "an issued invoice records when"],
  ["catering_invoice_void_check", "a voided one records when and by whom"],
  ["catering_payment_method_check", "the payment method allowlist"],
  ["catering_payment_source_check", "the payment source allowlist"],
  ["catering_payment_status_check", "recorded or voided"],
  ["catering_payment_amount_check", "a payment is for more than nothing"],
  ["catering_payment_currency_check", "a three-letter currency"],
  ["catering_payment_void_check", "a voided payment records when and by whom"],
  ["catering_payment_provenance_check", "provider-recorded and processor rows cannot be forged into each other"],
] as const;

test("every constraint exists in BOTH the migration and the Drizzle table", () => {
  for (const [name, why] of constraints) {
    assert.ok(migration.includes(name), `migration: ${name} (${why})`);
    assert.ok(billingSchema.includes(`"${name}"`), `schema: ${name} (${why})`);
  }
});

test("the two invoice kinds are the only ones any layer accepts", () => {
  assert.ok(migration.includes("CHECK (invoice_kind IN ('deposit', 'balance'))"));
  for (const forbidden of ["'adjustment'", "'additional'", "'credit'"]) {
    assert.equal(migration.includes(forbidden), false, forbidden);
  }
});

test("paid, partially_paid and overdue are NOT persisted anywhere", () => {
  // Each is a function of the payment ledger and the current date; a stored copy could disagree with the payments.
  assert.ok(migration.includes("CHECK (status IN ('draft', 'issued', 'void'))"));
  for (const forbidden of ["paid_at", "is_paid", "paid_cents", "overdue", "balance_cents", "outstanding_cents", "total_paid"]) {
    assert.equal(ddl.includes(forbidden), false, forbidden);
  }
});

test("no card data, secret or payout detail has a column", () => {
  for (const forbidden of ["card_number", "cvv", "last4", "fingerprint", "secret", "access_token", "payout", "bank_account", "routing", "iban"]) {
    assert.equal(ddl.toLowerCase().includes(forbidden), false, forbidden);
  }
});

test("the processor seam exists, is nullable, and is uniquely constrained", () => {
  assert.ok(migration.includes("processor varchar(24)"));
  assert.ok(migration.includes("processor_payment_id varchar(128)"));
  assert.ok(migration.includes("catering_payments_processor_uidx"));
  // A provider-recorded row can never carry one, so nothing written today can masquerade as processor-backed.
  assert.ok(migration.includes("payment_source = 'provider_recorded' AND recorded_by IS NOT NULL AND processor IS NULL AND processor_payment_id IS NULL"));
});

test("dates that are days are date columns, and instants are timestamptz", () => {
  // A due date is a day, so a customer in another timezone does not see it as overdue a day early.
  for (const column of ["deposit_due_on date", "due_on date", "received_on date NOT NULL"]) {
    assert.ok(migration.includes(column), column);
  }
  for (const column of ["issued_at timestamptz", "voided_at timestamptz", "created_at timestamptz NOT NULL DEFAULT now()", "updated_at timestamptz NOT NULL DEFAULT now()"]) {
    assert.ok(migration.includes(column), column);
  }
});

test("the indexes a booking's billing is actually read by exist", () => {
  for (const index of ["catering_invoices_number_uidx", "catering_invoices_live_kind_uidx", "catering_invoices_due_idx",
    "catering_payments_idempotency_uidx", "catering_payments_processor_uidx", "catering_payments_invoice_idx", "catering_payments_booking_idx"]) {
    assert.ok(migration.includes(index), `migration: ${index}`);
    assert.ok(billingSchema.includes(index), `schema: ${index}`);
  }
});
