import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { CATERING_BOOKING_ACTIVITY_EVENT_SQL_LIST, CATERING_BOOKING_ACTIVITY_EVENT_TYPES } from "./catering-booking-activity-events";
import { CATERING_BOOKING_ACTIVITY_EVENT_TYPES as CONTRACT_EVENTS } from "./catering-booking-operations";

/**
 * The activity allowlist has to hold in three places: the shared contract, the Drizzle table's CHECK constraint, and
 * the SQL migration. Phase 2I previously updated only the first two, leaving the Drizzle CHECK ending at
 * `shared_requirement_deleted` -- so a database built or reconciled from the schema would have restored the old
 * constraint and rejected every booking file activity insert.
 *
 * The contract and the Drizzle constraint now both derive from one array, so those cannot diverge. The migration is
 * plain SQL and cannot import it, so it is compared here textually. There is no live migration harness in this
 * suite, which is why that comparison is against the migration's text rather than against a real database.
 */
const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const migration = fs.readFileSync(path.join(repoRoot, "server", "migrations", "20260902_catering_booking_communication_files.sql"), "utf8");
const schema = fs.readFileSync(path.join(repoRoot, "shared", "schema", "domains", "social-content.ts"), "utf8");

/** The event values inside a `... IN ('a', 'b') ...` clause, in order. */
function eventsInClause(source: string, from: number): string[] {
  const open = source.indexOf("(", from);
  const close = source.indexOf(")", open);
  return source.slice(open + 1, close).split(",").map((value) => value.trim().replace(/^'|'$/g, "")).filter((value) => value !== "");
}

test("the canonical allowlist is exactly the thirteen Phase 2I events, in order and with no extras", () => {
  assert.deepEqual([...CATERING_BOOKING_ACTIVITY_EVENT_TYPES], [
    "booking_offered", "customer_confirmed", "booking_cancelled", "booking_completed", "details_updated",
    "shared_requirement_added", "shared_requirement_updated", "shared_requirement_completed", "shared_requirement_deleted",
    "shared_file_uploaded", "shared_file_removed", "provider_file_uploaded", "provider_file_removed",
  ]);
  assert.equal(new Set(CATERING_BOOKING_ACTIVITY_EVENT_TYPES).size, CATERING_BOOKING_ACTIVITY_EVENT_TYPES.length);
});

test("the shared contract exposes the same allowlist rather than its own copy", () => {
  assert.deepEqual([...CONTRACT_EVENTS], [...CATERING_BOOKING_ACTIVITY_EVENT_TYPES]);
});

test("the Drizzle CHECK constraint is generated from the allowlist, not restated", () => {
  // Structural, because the constraint is only rendered into SQL at migration-generation time.
  assert.equal(schema.includes("sql.raw(CATERING_BOOKING_ACTIVITY_EVENT_SQL_LIST)"), true);
  assert.equal(schema.includes('check("catering_booking_activity_event_type_check"'), true);
  // The old hard-coded list is gone, so the schema cannot fall behind the contract again.
  assert.equal(schema.includes("'shared_requirement_deleted')`)"), false, "the Drizzle CHECK must not restate the allowlist");
  assert.deepEqual(eventsInClause(`IN (${CATERING_BOOKING_ACTIVITY_EVENT_SQL_LIST})`, 0), [...CATERING_BOOKING_ACTIVITY_EVENT_TYPES]);
});

test("the migration constraint carries exactly the same events as the allowlist", () => {
  const at = migration.indexOf("ADD CONSTRAINT catering_booking_activity_event_type_check");
  assert.notEqual(at, -1);
  const events = eventsInClause(migration, migration.indexOf("event_type IN", at));
  assert.deepEqual(events, [...CATERING_BOOKING_ACTIVITY_EVENT_TYPES]);
});

test("each Phase 2I file event is accepted by every layer", () => {
  for (const event of ["shared_file_uploaded", "shared_file_removed", "provider_file_uploaded", "provider_file_removed"] as const) {
    assert.equal((CATERING_BOOKING_ACTIVITY_EVENT_TYPES as readonly string[]).includes(event), true, `contract: ${event}`);
    assert.equal(CATERING_BOOKING_ACTIVITY_EVENT_SQL_LIST.includes(`'${event}'`), true, `schema: ${event}`);
    assert.equal(migration.includes(`'${event}'`), true, `migration: ${event}`);
  }
});

test("unknown activity types remain rejected by every layer", () => {
  for (const event of ["message_sent", "booking_message", "file_downloaded", "review_verified", "shared_file_updated", ""]) {
    assert.equal((CATERING_BOOKING_ACTIVITY_EVENT_TYPES as readonly string[]).includes(event), false, `contract: ${event}`);
    assert.equal(CATERING_BOOKING_ACTIVITY_EVENT_SQL_LIST.includes(`'${event}'`), false, `schema: ${event}`);
  }
});

test("messages write no activity, so no message event exists in any layer", () => {
  for (const layer of [CATERING_BOOKING_ACTIVITY_EVENT_SQL_LIST, migration, schema]) {
    assert.equal(/'[a-z_]*message[a-z_]*'/.test(layer.replace(/dm_messages/g, "")), false);
  }
});

test("the SQL value list is built only from the allowlist's own constants", () => {
  // Nothing runtime or user-supplied reaches the generated CHECK clause.
  assert.equal(CATERING_BOOKING_ACTIVITY_EVENT_SQL_LIST, CATERING_BOOKING_ACTIVITY_EVENT_TYPES.map((event) => `'${event}'`).join(", "));
  assert.equal(/^'[a-z_]+'(, '[a-z_]+')*$/.test(CATERING_BOOKING_ACTIVITY_EVENT_SQL_LIST), true);
});
