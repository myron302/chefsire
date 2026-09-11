import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { CATERING_CLOSEOUT_ITEM_KEYS, CATERING_CLOSEOUT_ITEM_STATES } from "./catering-booking-closeout";
import { CATERING_BOOKING_ACTIVITY_EVENT_TYPES } from "./catering-booking-activity-events";

/**
 * The Phase 2K database layer, checked against the contract it must enforce.
 *
 * TypeScript types are not an integrity layer. Every controlled vocabulary and every pairing invariant in this
 * phase is also a database CHECK, and the Drizzle schema and the SQL migration have to agree with each other and
 * with the shared contract. There is no live migration harness in this suite, as elsewhere in the catering phases,
 * so the comparison is textual -- which is exactly what caught the Phase 2I activity drift.
 */
const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const migration = fs.readFileSync(path.join(repoRoot, "server", "migrations", "20260911_catering_booking_closeout.sql"), "utf8");
const schema = fs.readFileSync(path.join(repoRoot, "shared", "schema", "domains", "social-content.ts"), "utf8");

const TABLES = ["catering_booking_closeout", "catering_booking_closeout_items"];

/** The values inside the first `IN ( ... )` clause after `from`. */
function valuesInClause(source: string, from: number): string[] {
  const open = source.indexOf("IN (", from);
  assert.notEqual(open, -1, "an IN clause follows");
  const close = source.indexOf(")", open);
  return source.slice(open + 4, close).split(",").map((value) => value.trim().replace(/^'|'$/g, "")).filter(Boolean);
}
function checkValues(source: string, constraint: string): string[] {
  const at = source.indexOf(constraint);
  assert.notEqual(at, -1, `${constraint} is declared`);
  return valuesInClause(source, at);
}

test("both Phase 2K tables exist in the migration and in the Drizzle schema", () => {
  for (const table of TABLES) {
    assert.ok(migration.includes(`CREATE TABLE IF NOT EXISTS ${table}`), `${table} is created`);
    assert.ok(schema.includes(`pgTable("${table}"`), `${table} is declared in Drizzle`);
  }
});

test("both tables are foreign-keyed to the booking, and neither cascades a booking away", () => {
  for (const table of TABLES) {
    const at = migration.indexOf(`CREATE TABLE IF NOT EXISTS ${table}`);
    const body = migration.slice(at, migration.indexOf(");", at));
    assert.ok(/REFERENCES catering_bookings\(id\) ON DELETE RESTRICT/.test(body), `${table} restricts on the booking`);
  }
});

test("the migration is additive: it creates no table that already existed and alters only the activity CHECK", () => {
  const altered = Array.from(migration.matchAll(/ALTER TABLE (\w+)/g)).map((match) => match[1]);
  assert.deepEqual(Array.from(new Set(altered)), ["catering_booking_activity"]);
  // No DROP of anything but the one constraint being widened, and no data-destroying statement anywhere.
  assert.deepEqual(Array.from(migration.matchAll(/DROP (\w+)/g)).map((match) => match[1]), ["CONSTRAINT"]);
  for (const forbidden of ["DROP TABLE", "DROP COLUMN", "TRUNCATE", "DELETE FROM", "UPDATE catering_"]) {
    assert.equal(migration.includes(forbidden), false, `${forbidden} must not appear`);
  }
});

test("the item key allowlist matches the contract in both the migration and the Drizzle CHECK", () => {
  assert.deepEqual(checkValues(migration, "catering_closeout_item_key_check"), [...CATERING_CLOSEOUT_ITEM_KEYS]);
  assert.deepEqual(checkValues(schema, "catering_closeout_item_key_check"), [...CATERING_CLOSEOUT_ITEM_KEYS]);
});

test("the item state allowlist matches the contract in both the migration and the Drizzle CHECK", () => {
  assert.deepEqual(checkValues(migration, "catering_closeout_item_state_check"), [...CATERING_CLOSEOUT_ITEM_STATES]);
  assert.deepEqual(checkValues(schema, "catering_closeout_item_state_check"), [...CATERING_CLOSEOUT_ITEM_STATES]);
});

test("the activity allowlist in the migration is exactly the shared contract, widened and never narrowed", () => {
  const at = migration.lastIndexOf("catering_booking_activity_event_type_check");
  assert.deepEqual(valuesInClause(migration, at), [...CATERING_BOOKING_ACTIVITY_EVENT_TYPES]);
  // Phase 2K adds exactly two events and removes none of the twenty-one it inherited.
  assert.ok(CATERING_BOOKING_ACTIVITY_EVENT_TYPES.includes("booking_closed_out"));
  assert.ok(CATERING_BOOKING_ACTIVITY_EVENT_TYPES.includes("booking_closeout_reopened"));
  for (const inherited of ["booking_completed", "shared_file_uploaded", "provider_execution_milestone_completed"]) {
    assert.ok(CATERING_BOOKING_ACTIVITY_EVENT_TYPES.includes(inherited as never), `${inherited} survives`);
  }
});

test("the resolution pairing invariant is enforced by both the migration and the Drizzle schema", () => {
  // A resolved item always records when and by whom; a pending one never carries either. The serializer's
  // `resolvedAt` depends on exactly this, so no write path may leave a row it would misreport.
  for (const source of [migration, schema]) {
    assert.ok(source.includes("catering_closeout_item_resolved_check"), "the pairing CHECK is declared");
  }
});

test("the closeout record's completion and reopen audits are both enforced by CHECK", () => {
  for (const source of [migration, schema]) {
    assert.ok(source.includes("catering_closeout_closed_by_check"), "a closed record always names its closer");
    assert.ok(source.includes("catering_closeout_reopen_count_check"), "the reopen count cannot go negative");
    assert.ok(source.includes("catering_closeout_reopen_audit_check"), "a reopened record always carries its audit");
  }
});

test("the checklist table has no visibility column, in either the migration or the schema", () => {
  const at = migration.indexOf("CREATE TABLE IF NOT EXISTS catering_booking_closeout_items");
  const body = migration.slice(at, migration.indexOf(");", at));
  // These rows are never customer-visible under any value, so a column would imply a setting that could disclose
  // them. Phase 2J made the same call about crew assignments.
  assert.equal(/\bvisibility\b/.test(body), false);
  const schemaAt = schema.indexOf('pgTable("catering_booking_closeout_items"');
  assert.equal(/visibility:/.test(schema.slice(schemaAt, schemaAt + 2500)), false);
});

test("neither Phase 2K table carries a money, invoice, deposit or refund column", () => {
  // ChefSire has no catering payment system for closeout to read a fact from, so it fabricates none. Asserted
  // against the STATEMENTS rather than the whole file, because the file's own prose says exactly this in words.
  const statements = migration.split("\n").filter((line) => !line.trim().startsWith("--")).join("\n");
  for (const forbidden of ["amount", "invoice", "deposit", "refund", "balance", "currency", "price", "charge", "paid", "fee"]) {
    assert.equal(new RegExp(`\\b${forbidden}`, "i").test(statements), false, `${forbidden} must not appear as a column`);
  }
});

test("the checklist is indexed on the way it is actually read: one whole collection per booking", () => {
  assert.ok(migration.includes("catering_closeout_items_booking_idx"));
  assert.ok(migration.includes("ON catering_booking_closeout_items(booking_id, item_key)"));
});
