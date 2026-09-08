import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  CATERING_EQUIPMENT_SOURCES,
  CATERING_EQUIPMENT_STATUSES,
  CATERING_EXECUTION_MILESTONE_KEYS,
  CATERING_EXECUTION_VISIBILITIES,
  CATERING_STAFF_ROLES,
  CATERING_TIMELINE_CATEGORIES,
} from "./catering-booking-execution";

/**
 * The Phase 2J database layer, checked against the contract it must enforce.
 *
 * TypeScript types are not an integrity layer. Every controlled vocabulary, every bound and every pairing invariant
 * in this phase is also a database CHECK, and the Drizzle schema and the SQL migration have to agree with each other
 * and with the shared contract. There is no live migration harness in this suite, as elsewhere in the catering
 * phases, so the comparison is textual -- which is exactly what would have caught the Phase 2I drift the activity
 * allowlist test exists for.
 */
const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const migration = fs.readFileSync(path.join(repoRoot, "server", "migrations", "20260906_catering_booking_execution.sql"), "utf8");
const schema = fs.readFileSync(path.join(repoRoot, "shared", "schema", "domains", "social-content.ts"), "utf8");

const TABLES = [
  "catering_booking_execution_timeline",
  "catering_booking_staff_assignments",
  "catering_booking_equipment",
  "catering_booking_access_details",
  "catering_booking_execution_milestones",
];

/** The values inside the first `IN ( ... )` clause after `from`. */
function valuesInClause(source: string, from: number): string[] {
  const open = source.indexOf("(", from);
  const close = source.indexOf(")", open);
  return source.slice(open + 1, close).split(",").map((value) => value.trim().replace(/^'|'$/g, "")).filter((value) => value !== "");
}

test("Phase 2J creates exactly the five execution tables, in both layers", () => {
  for (const table of TABLES) {
    assert.equal(migration.includes(`CREATE TABLE IF NOT EXISTS ${table} (`), true, `migration: ${table}`);
    assert.equal(schema.includes(`pgTable("${table}"`), true, `schema: ${table}`);
  }
  assert.equal((migration.match(/CREATE TABLE IF NOT EXISTS/g) ?? []).length, TABLES.length);
});

test("the migration is additive: it drops nothing and redefines no earlier table", () => {
  assert.equal(/DROP TABLE/i.test(migration), false);
  assert.equal(/DROP COLUMN/i.test(migration), false);
  assert.equal(/TRUNCATE|DELETE FROM|UPDATE .* SET/i.test(migration), false);
  // The ONLY statement touching an existing object is the activity event_type CHECK, which is widened.
  const alters = migration.match(/ALTER TABLE (\w+)/g) ?? [];
  assert.deepEqual([...new Set(alters)], ["ALTER TABLE catering_booking_activity"]);
  const drops = migration.match(/DROP CONSTRAINT IF EXISTS (\w+)/g) ?? [];
  assert.deepEqual(drops, ["DROP CONSTRAINT IF EXISTS catering_booking_activity_event_type_check"]);
  // Nothing redefines the Phase 2G/2H/2I tables themselves.
  for (const table of ["catering_bookings", "catering_booking_details", "catering_booking_tasks", "catering_booking_files", "catering_booking_conversations"]) {
    assert.equal(new RegExp(`(ALTER|CREATE) TABLE[^\\n]*\\b${table}\\b`).test(migration), false, table);
  }
});

test("every execution table is a foreign key to the booking, with the same restrict semantics as its siblings", () => {
  const references = migration.match(/REFERENCES catering_bookings\(id\) ON DELETE RESTRICT/g) ?? [];
  assert.equal(references.length, TABLES.length, "one booking reference per table");
  for (const table of TABLES) {
    const block = migration.slice(migration.indexOf(`CREATE TABLE IF NOT EXISTS ${table} (`));
    assert.equal(block.slice(0, block.indexOf(");")).includes("REFERENCES catering_bookings(id)"), true, table);
  }
});

test("each controlled vocabulary is a database CHECK carrying exactly the contract's values", () => {
  const expectations: [string, readonly string[]][] = [
    ["catering_execution_timeline_category_check", CATERING_TIMELINE_CATEGORIES],
    ["catering_execution_timeline_visibility_check", CATERING_EXECUTION_VISIBILITIES],
    ["catering_execution_staff_role_check", CATERING_STAFF_ROLES],
    ["catering_execution_equipment_status_check", CATERING_EQUIPMENT_STATUSES],
    ["catering_execution_equipment_source_check", CATERING_EQUIPMENT_SOURCES],
    ["catering_execution_equipment_visibility_check", CATERING_EXECUTION_VISIBILITIES],
    ["catering_execution_milestone_key_check", CATERING_EXECUTION_MILESTONE_KEYS],
  ];
  for (const [constraint, expected] of expectations) {
    for (const [layer, source] of [["migration", migration], ["schema", schema]] as const) {
      const at = source.indexOf(constraint);
      assert.notEqual(at, -1, `${layer}: ${constraint}`);
      const inAt = source.indexOf(" IN ", at);
      assert.notEqual(inAt, -1, `${layer}: ${constraint} has no IN clause`);
      // Visibility appears in the same order the contract declares it, and so does every other vocabulary, so a
      // value silently added to one layer and not the other fails here.
      assert.deepEqual(valuesInClause(source, inAt).sort(), [...expected].sort(), `${layer}: ${constraint}`);
    }
  }
});

test("quantity is bounded by the database, not only by a TypeScript type", () => {
  assert.equal(migration.includes("CONSTRAINT catering_execution_equipment_quantity_check CHECK (quantity >= 1 AND quantity <= 9999)"), true);
  assert.equal(schema.includes("catering_execution_equipment_quantity_check"), true);
  assert.equal(/quantity[^\n]*>= 1 AND[^\n]*<= 9999/.test(schema), true);
});

test("ordering and completion invariants are database constraints too", () => {
  assert.equal(migration.includes("CONSTRAINT catering_execution_timeline_sort_order_check CHECK (sort_order >= 0)"), true);
  // A completed item always records who completed it, and an incomplete one never carries a stale completer.
  for (const constraint of ["catering_execution_timeline_completed_by_check", "catering_execution_milestone_completed_by_check"]) {
    assert.equal(migration.includes(constraint), true, `migration: ${constraint}`);
    assert.equal(schema.includes(constraint), true, `schema: ${constraint}`);
  }
  // A custom crew role must be named, and a listed role must not carry one -- enforced below the application.
  assert.equal(migration.includes("CONSTRAINT catering_execution_staff_custom_role_check"), true);
  assert.equal(migration.includes("(role = 'custom' AND custom_role IS NOT NULL) OR (role <> 'custom' AND custom_role IS NULL)"), true);
});

test("every wall clock is validated by the database, and every range must run forwards", () => {
  const clocks = migration.match(/~ '\^\(\?:\[01\]\[0-9\]\|2\[0-3\]\):\[0-5\]\[0-9\]\$'/g) ?? [];
  assert.equal(clocks.length >= 7, true, `expected a regex CHECK on every wall clock, found ${clocks.length}`);
  for (const constraint of [
    "catering_execution_timeline_time_range_check",
    "catering_execution_staff_time_range_check",
    "catering_execution_access_window_range_check",
  ]) {
    assert.equal(migration.includes(constraint), true, `migration: ${constraint}`);
    assert.equal(schema.includes(constraint), true, `schema: ${constraint}`);
  }
});

test("the access table holds instructions, and no second copy of the authoritative location or date", () => {
  const block = migration.slice(migration.indexOf("CREATE TABLE IF NOT EXISTS catering_booking_access_details ("));
  const columns = block.slice(0, block.indexOf(");"));
  for (const column of ["venue_address", "venue_city", "venue_state", "venue_postal_code", "event_date", "guest_count", "agreed_price"]) {
    assert.equal(columns.includes(column), false, `the access table must not restate ${column}`);
  }
  // It is keyed by the booking, so there is exactly one access record per booking and no way to fork it.
  assert.equal(columns.includes("booking_id varchar PRIMARY KEY REFERENCES catering_bookings(id)"), true);
  assert.equal(columns.includes("provider_private_notes text"), true);
  assert.equal(columns.includes("venue_contact_source varchar(16)"), true);
});

test("crew assignments have no visibility column, because they are never customer-visible under any value", () => {
  const block = migration.slice(migration.indexOf("CREATE TABLE IF NOT EXISTS catering_booking_staff_assignments ("));
  const columns = block.slice(0, block.indexOf(");"));
  assert.equal(columns.includes("visibility"), false);
  // And `worker_name` is a label, not a foreign key: nothing here links a crew member to a ChefSire account.
  assert.equal(columns.includes("worker_name varchar(120) NOT NULL"), true);
  assert.equal(/worker_name[^\n]*REFERENCES/.test(columns), false);
});

test("milestones are keyed by (booking, key), which is what makes a retry harmless", () => {
  assert.equal(migration.includes("CONSTRAINT catering_booking_execution_milestones_pkey PRIMARY KEY (booking_id, milestone_key)"), true);
  assert.equal(schema.includes('primaryKey({ name: "catering_booking_execution_milestones_pkey", columns: [t.bookingId, t.milestoneKey] })'), true);
});

test("indexes exist for the access paths the routes actually use", () => {
  for (const index of [
    // Ordered reads of the run-of-show.
    "catering_execution_timeline_booking_sort_idx",
    // Booking-scoped listing of crew and equipment.
    "catering_execution_staff_booking_idx",
    "catering_execution_equipment_booking_idx",
    // A customer's visibility-filtered equipment read.
    "catering_execution_equipment_visible_idx",
    // The idempotency lookups.
    "catering_execution_timeline_request_uidx",
    "catering_execution_staff_request_uidx",
    "catering_execution_equipment_request_uidx",
  ]) {
    assert.equal(migration.includes(index), true, `migration: ${index}`);
    assert.equal(schema.includes(index), true, `schema: ${index}`);
  }
  // And the (booking, id) uniqueness every booking-scoped record lookup relies on.
  for (const constraint of ["catering_execution_timeline_booking_id_uidx", "catering_execution_staff_booking_id_uidx", "catering_execution_equipment_booking_id_uidx"]) {
    assert.equal(migration.includes(constraint), true, `migration: ${constraint}`);
  }
});

test("no execution table carries a booking lifecycle column", () => {
  for (const table of TABLES) {
    const block = migration.slice(migration.indexOf(`CREATE TABLE IF NOT EXISTS ${table} (`));
    const columns = block.slice(0, block.indexOf(");"));
    assert.equal(/\bbooking_status\b/.test(columns), false, table);
    assert.equal(/\bcancelled_at\b|\bcompleted_by_booking\b|\bconfirmed_at\b/.test(columns), false, table);
  }
  // The only `status` column in this phase is the equipment one, and it is the operational vocabulary.
  const statusColumns = migration.match(/^\s+status varchar\(\d+\)/gm) ?? [];
  assert.equal(statusColumns.length, 1);
});
