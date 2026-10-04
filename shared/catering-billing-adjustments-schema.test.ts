import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const migration = fs.readFileSync(path.join(repoRoot, "server", "migrations", "20261006_catering_billing_adjustments.sql"), "utf8");
const schema = fs.readFileSync(path.join(repoRoot, "shared", "schema", "domains", "social-content.ts"), "utf8");
const table = schema.slice(schema.indexOf('export const cateringBookingAdjustments = pgTable'), schema.indexOf('export const cateringReviews = pgTable'));
const sql = migration.replace(/^\s*--.*$/gm, "");

test("the migration is additive: it never drops, truncates or rewrites existing rows, and never alters the booking", () => {
  assert.equal(/DROP TABLE|TRUNCATE|DELETE FROM|UPDATE catering_/i.test(sql), false);
  assert.equal(/ALTER TABLE catering_bookings\b/i.test(sql), false);
  assert.equal(/INSERT INTO/i.test(sql), false, "no adjustment is fabricated for a booking that predates it");
  assert.deepEqual([...sql.matchAll(/ALTER TABLE (\w+)/g)].map((match) => match[1]), ["catering_booking_invoices", "catering_booking_invoices"], "the one widening: the invoice kind check");
  assert.ok(sql.includes("CHECK (invoice_kind IN ('deposit', 'balance', 'adjustment'))"));
  assert.ok(sql.includes("WHERE status <> 'void' AND invoice_kind <> 'adjustment'"));
});

test("the ledger table is append-only in the database itself: no delete, one permitted update, and no processor column", () => {
  assert.ok(sql.includes("BEFORE UPDATE OR DELETE ON catering_booking_adjustments"));
  assert.ok(sql.includes("catering booking adjustments are never deleted"));
  assert.equal(/processor|transaction_id|external_id/i.test(sql.slice(sql.indexOf("CREATE TABLE IF NOT EXISTS catering_booking_adjustments"), sql.indexOf("CREATE UNIQUE INDEX"))), false);
  assert.match(sql, /amount_cents bigint NOT NULL/);
  for (const forbidden of [" decimal(", " numeric(", " real", " double precision", " float"]) assert.equal(sql.toLowerCase().includes(forbidden), false, forbidden);
});

test("one amendment can produce at most one entry, and one attempt key at most one row, by unique index", () => {
  assert.ok(sql.includes("catering_adjustments_amendment_uidx ON catering_booking_adjustments (amendment_id) WHERE amendment_id IS NOT NULL"));
  assert.ok(sql.includes("catering_adjustments_idempotency_uidx ON catering_booking_adjustments (booking_id, idempotency_key) WHERE idempotency_key IS NOT NULL"));
});

test("the Drizzle table declares exactly the constraints and indexes the migration creates", () => {
  const migrationNames = [...sql.matchAll(/CONSTRAINT (catering_adjustment_\w+)/g)].map((match) => match[1]).sort();
  const schemaNames = [...table.matchAll(/check\("(catering_adjustment_\w+)"/g)].map((match) => match[1]).sort();
  assert.deepEqual(schemaNames, migrationNames);
  for (const index of ["catering_adjustments_idempotency_uidx", "catering_adjustments_amendment_uidx", "catering_adjustments_booking_idx", "catering_adjustments_payment_idx"]) {
    assert.ok(sql.includes(index), `migration: ${index}`);
    assert.ok(table.includes(`"${index}"`), `schema: ${index}`);
  }
  assert.ok(schema.includes(`liveKindUnique: uniqueIndex("catering_invoices_live_kind_uidx").on(t.bookingId, t.invoiceKind).where(sql\`\${t.status} <> 'void' AND \${t.invoiceKind} <> 'adjustment'\`)`));
  assert.ok(schema.includes(`IN ('deposit', 'balance', 'adjustment')`));
});

test("the Drizzle money column is bigint cents and the ledger references its booking, payment and amendment without cascade", () => {
  assert.match(table, /amountCents: bigint\("amount_cents", \{ mode: "number" \}\)/);
  assert.equal(table.includes("decimal("), false);
  assert.equal((table.match(/onDelete: "restrict"/g) ?? []).length, 5, "booking, payment, amendment and the two actors");
  assert.equal(table.includes("cascade"), false);
});

test("the one ceiling in code is the ceiling the SQL enforces on invoices, payments and adjustments", async () => {
  const { CATERING_INVOICE_MAXIMUM_CENTS } = await import("./catering-billing-adjustments");
  const billingSql = fs.readFileSync(path.join(repoRoot, "server", "migrations", "20260913_catering_booking_billing.sql"), "utf8");
  for (const [name, source] of [["invoice", billingSql], ["payment", billingSql], ["adjustment", migration]] as const) {
    assert.ok(source.includes(`catering_${name}_amount_check CHECK (amount_cents > 0 AND amount_cents <= ${CATERING_INVOICE_MAXIMUM_CENTS})`), name);
  }
  assert.equal(CATERING_INVOICE_MAXIMUM_CENTS, 9999999999);
  const code = fs.readFileSync(path.join(repoRoot, "shared", "catering-billing-adjustments.ts"), "utf8").replace(/\/\*[\s\S]*?\*\//g, "");
  assert.equal((code.match(/9_999_999_999|9999999999|99_999_999_99/g) ?? []).length, 1, "the number is written once in the adjustment contract");
  const billingCode = fs.readFileSync(path.join(repoRoot, "shared", "catering-booking-billing.ts"), "utf8");
  assert.ok(billingCode.includes("CATERING_BILLING_MAXIMUM_CENTS = CATERING_INVOICE_MAXIMUM_CENTS"), "billing re-uses it rather than restating it");
});
