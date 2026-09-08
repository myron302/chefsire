import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { CATERING_BOOKING_ACTIVITY_EVENT_TYPES } from "@shared/catering-booking-activity-events";
import { resolveCateringMilestoneToggle, resolveCateringTimelineCreate, resolveCateringTimelinePatch } from "../services/catering-booking-execution-policy";

/**
 * Retry safety, activity and notifications for Phase 2J.
 *
 * Three separate promises are asserted here:
 *
 *  - a retried CREATE resolves to the record the first attempt made, rather than adding a second one;
 *  - a retry produces no second activity row and no second notification, because both are written only on the
 *    branch that actually created or changed something;
 *  - private execution data reaches no customer channel at all -- not the activity feed, not a notification.
 *
 * The route half is structural (there is no database harness in this suite, as elsewhere in the catering phases);
 * the decisions those structures act on are exercised behaviourally against the policy functions.
 */
const here = path.dirname(fileURLToPath(import.meta.url));
const route = fs.readFileSync(path.join(here, "catering-booking-execution.ts"), "utf8");
const schema = fs.readFileSync(path.join(here, "..", "..", "shared", "schema", "domains", "social-content.ts"), "utf8");
const migration = fs.readFileSync(path.join(here, "..", "migrations", "20260906_catering_booking_execution.sql"), "utf8");

const CREATES: [string, string, string][] = [
  ["timeline", 'r.post("/bookings/:id/execution/timeline"', "duplicateTimelineItem"],
  ["staff", 'r.post("/bookings/:id/execution/staff"', "duplicateStaffAssignment"],
  ["equipment", 'r.post("/bookings/:id/execution/equipment"', "duplicateEquipment"],
];
function handler(marker: string, until: string): string {
  const start = route.indexOf(marker);
  assert.notEqual(start, -1, marker);
  const end = route.indexOf(until, start + 1);
  return route.slice(start, end === -1 ? route.length : end);
}
const TIMELINE_CREATE = handler('r.post("/bookings/:id/execution/timeline"', 'r.patch("/bookings/:id/execution/timeline/:itemId"');
const STAFF_CREATE = handler('r.post("/bookings/:id/execution/staff"', 'r.patch("/bookings/:id/execution/staff/:staffId"');
const EQUIPMENT_CREATE = handler('r.post("/bookings/:id/execution/equipment"', 'r.patch("/bookings/:id/execution/equipment/:equipmentId"');
const CREATE_SOURCES: Record<string, string> = { timeline: TIMELINE_CREATE, staff: STAFF_CREATE, equipment: EQUIPMENT_CREATE };

/* ------------------------------------------------------------------------------------------------------------- *
 * Idempotency
 * ------------------------------------------------------------------------------------------------------------- */

test("every creating mutation accepts a retry token and resolves it before doing any work", () => {
  for (const [name, , lookup] of CREATES) {
    const source = CREATE_SOURCES[name];
    // Resolved BEFORE the transaction, so an ordinary retry costs one indexed lookup and cannot be refused by a
    // collection that filled up in the meantime.
    assert.equal(source.includes(`const accepted = await ${lookup}(id, userId, input.clientRequestId);`), true, `${name} early lookup`);
    assert.equal(source.indexOf("if (input.clientRequestId)") < source.indexOf("db.transaction"), true, `${name} resolves the token before the transaction`);
  }
});

test("the in-transaction lookup is the backstop for two simultaneous first attempts", () => {
  for (const [name, , lookup] of CREATES) {
    const source = CREATE_SOURCES[name];
    // Under the collection lock, using the transaction's own executor, so a concurrent same-token request that had
    // not committed at the early lookup is caught here.
    assert.equal(source.includes(`${lookup}(id, userId, input.clientRequestId, tx)`), true, `${name} in-transaction lookup`);
    assert.equal(source.includes('{ kind: "duplicate"'), true, `${name} duplicate branch`);
  }
});

test("the retry token is scoped to (booking, creator, token) in the lookup, the schema and the migration", () => {
  const lookups = route.slice(route.indexOf("async function duplicateTimelineItem"), route.indexOf("async function resolveExecutionRequest"));
  for (const [table, column] of [
    ["cateringBookingExecutionTimeline", "cateringBookingExecutionTimeline"],
    ["cateringBookingStaffAssignments", "cateringBookingStaffAssignments"],
    ["cateringBookingEquipment", "cateringBookingEquipment"],
  ]) {
    assert.equal(lookups.includes(`eq(${column}.bookingId, bookingId), eq(${column}.createdBy, createdBy), eq(${column}.clientRequestId, clientRequestId)`), true, table);
  }
  // A partial unique index is the last line of defence, in both the Drizzle schema and the SQL migration.
  for (const index of ["catering_execution_timeline_request_uidx", "catering_execution_staff_request_uidx", "catering_execution_equipment_request_uidx"]) {
    assert.equal(schema.includes(index), true, `schema: ${index}`);
    assert.equal(migration.includes(index), true, `migration: ${index}`);
  }
  for (const line of migration.split("\n").filter((value) => value.includes("_request_uidx"))) {
    assert.equal(line.includes("(booking_id, created_by, client_request_id)"), true, line);
    assert.equal(line.includes("WHERE client_request_id IS NOT NULL"), true, line);
  }
});

test("a retry is answered with the already-created record and a 200, never a second 201", () => {
  for (const [name] of CREATES) {
    const source = CREATE_SOURCES[name];
    assert.equal((source.match(/res\.status\(200\)\.json\(\{[^}]*duplicate: true/g) ?? []).length, 2, `${name}: both resolution points answer identically`);
    assert.equal((source.match(/res\.status\(201\)/g) ?? []).length, 1, `${name}: exactly one branch creates`);
  }
});

test("a retry answered from the token produces no notification", () => {
  // The timeline is the only create that notifies at all, and its notification sits after the duplicate branches
  // has already returned -- so a retry cannot re-fire it.
  const notifyAt = TIMELINE_CREATE.indexOf("if (result.notify) await notifyCounterpart");
  const duplicateAt = TIMELINE_CREATE.lastIndexOf('if (result.kind === "duplicate") return res.status(200)');
  assert.notEqual(notifyAt, -1);
  assert.notEqual(duplicateAt, -1);
  assert.equal(duplicateAt < notifyAt, true, "the duplicate branch returns before any notification");
  // And equipment and crew creates never notify in any branch.
  assert.equal(EQUIPMENT_CREATE.includes("notifyCounterpart"), false);
  assert.equal(STAFF_CREATE.includes("notifyCounterpart"), false);
});

test("a milestone needs no token: it asserts a state, so repeating it changes nothing", () => {
  const source = handler('r.put("/bookings/:id/execution/milestones/:key"', "export default r;");
  assert.equal(source.includes("clientRequestId"), false, "no token is needed or accepted");
  assert.equal(source.includes('if (outcome.kind === "unchanged")'), true);
  // Behaviourally: three identical completions produce one row, one instant and one activity row.
  const now = new Date("2026-09-08T12:00:00.000Z");
  const first = resolveCateringMilestoneToggle(undefined, { completed: true }, now);
  assert.equal(first.kind === "create" && first.activity, true);
  const persisted = { completedAt: now, updatedAt: now };
  for (const later of ["2026-09-08T12:00:01.000Z", "2026-09-08T13:00:00.000Z"]) {
    const retry = resolveCateringMilestoneToggle(persisted, { completed: true, expectedUpdatedAt: now.toISOString() }, new Date(later));
    assert.deepEqual(retry, { kind: "unchanged" }, later);
  }
});

test("a repeated PATCH is a no-op, so retrying an edit writes no second history row", () => {
  const now = new Date("2026-09-08T12:00:00.000Z");
  const version = new Date("2026-09-08T11:00:00.000Z");
  const current = { title: "Service", description: null, category: "service", scheduledTime: "18:00", endTime: null, visibility: "shared", isBlocker: false, completed: false, updatedAt: version, completedAt: null };
  const first = resolveCateringTimelinePatch(current, { title: "Service begins", expectedUpdatedAt: version.toISOString() }, now);
  assert.equal(first.kind === "update" && first.activity?.eventType, "execution_timeline_updated");
  // The retry carries the SAME (now stale) version, so it conflicts rather than writing a second row -- and even
  // against the new version, the identical field is not a change.
  assert.equal(resolveCateringTimelinePatch(current, { title: "Service begins", expectedUpdatedAt: now.toISOString() }, now).kind, "conflict");
  const applied = { ...current, title: "Service begins", updatedAt: now };
  assert.equal(resolveCateringTimelinePatch(applied, { title: "Service begins", expectedUpdatedAt: now.toISOString() }, now).kind, "unchanged");
});

/* ------------------------------------------------------------------------------------------------------------- *
 * Activity
 * ------------------------------------------------------------------------------------------------------------- */

test("every activity event this route writes is on the canonical allowlist", () => {
  const written = Array.from(route.matchAll(/eventType: "([a-z_]+)"/g)).map((match) => match[1]);
  assert.equal(written.length > 0, true);
  for (const event of written) assert.equal((CATERING_BOOKING_ACTIVITY_EVENT_TYPES as readonly string[]).includes(event), true, event);
  // Plus the ones passed through from a resolved outcome, which come from the policy module's own literal unions.
  assert.equal(route.includes("eventType: outcome.activity.eventType"), true);
});

test("execution activity is written into the existing booking activity table, not a second feed", () => {
  assert.equal(route.includes("tx.insert(cateringBookingActivity).values({"), true);
  // No new activity table exists anywhere in this phase.
  assert.equal(/execution_activity|executionActivity/.test(route), false);
  assert.equal(/execution_activity/.test(schema), false);
  assert.equal(/execution_activity/.test(migration), false);
});

test("the milestone event is the only PRIVATE activity, and it is written with provider visibility", () => {
  const source = handler('r.put("/bookings/:id/execution/milestones/:key"', "export default r;");
  assert.equal(source.includes('eventType: "provider_execution_milestone_completed", visibility: "provider"'), true);
  // Every other execution activity write is shared, either literally or through the visibility translation.
  const inserts = Array.from(route.matchAll(/tx\.insert\(cateringBookingActivity\)\.values\(\{[\s\S]{0,400}?\}\)/g)).map((match) => match[0]);
  assert.equal(inserts.length, 7, "one activity write per event-producing branch");
  for (const insert of inserts) {
    assert.equal(/visibility: "shared"|visibility: "provider"|cateringExecutionActivityVisibility\(/.test(insert), true, insert.slice(0, 80));
  }
  assert.equal(inserts.filter((insert) => insert.includes('visibility: "provider"')).length, 1, "exactly one private activity write");
});

test("a private create or edit writes no activity at all, so private churn cannot flood the feed", () => {
  const now = new Date("2026-09-08T12:00:00.000Z");
  const created = resolveCateringTimelineCreate({ itemCount: 0, maxSortOrder: null }, { title: "Internal", visibility: "provider_private" });
  assert.equal(created.kind === "create" && created.activity, null);
  const version = new Date("2026-09-08T11:00:00.000Z");
  const priv = { title: "Internal", description: null, category: "setup", scheduledTime: null, endTime: null, visibility: "provider_private", isBlocker: false, completed: false, updatedAt: version, completedAt: null };
  for (const patch of [{ title: "Renamed" }, { isBlocker: true }, { completed: true }, { description: "note" }]) {
    const outcome = resolveCateringTimelinePatch(priv, { ...patch, expectedUpdatedAt: version.toISOString() }, now);
    assert.equal(outcome.kind === "update" && outcome.activity, null, JSON.stringify(patch));
  }
});

test("reordering writes no activity and no notification: a drag is not news", () => {
  const source = handler('r.post("/bookings/:id/execution/timeline/reorder"', 'r.post("/bookings/:id/execution/staff"');
  assert.equal(source.includes("cateringBookingActivity"), false);
  assert.equal(source.includes("notifyCounterpart"), false);
});

/* ------------------------------------------------------------------------------------------------------------- *
 * Notifications
 * ------------------------------------------------------------------------------------------------------------- */

test("only the shared timeline and shared access instructions ever notify the customer", () => {
  const notifications = Array.from(route.matchAll(/notifyCounterpart\(booking, userId, id, ([A-Z_]+)\)/g)).map((match) => match[1]);
  assert.equal(new Set(notifications).size, 2);
  assert.deepEqual([...new Set(notifications)].sort(), ["CATERING_EXECUTION_ACCESS_NOTIFICATION", "CATERING_EXECUTION_TIMELINE_NOTIFICATION"]);
  // Crew, milestones and equipment never notify, in any branch.
  for (const marker of [
    ['r.post("/bookings/:id/execution/staff"', 'r.patch("/bookings/:id/execution/staff/:staffId"'],
    ['r.patch("/bookings/:id/execution/staff/:staffId"', 'r.delete("/bookings/:id/execution/staff/:staffId"'],
    ['r.delete("/bookings/:id/execution/staff/:staffId"', 'r.post("/bookings/:id/execution/equipment"'],
    ['r.post("/bookings/:id/execution/equipment"', 'r.patch("/bookings/:id/execution/equipment/:equipmentId"'],
    ['r.patch("/bookings/:id/execution/equipment/:equipmentId"', 'r.delete("/bookings/:id/execution/equipment/:equipmentId"'],
    ['r.put("/bookings/:id/execution/milestones/:key"', "export default r;"],
  ] as [string, string][]) {
    assert.equal(handler(marker[0], marker[1]).includes("notifyCounterpart"), false, marker[0]);
  }
});

test("every notification is gated on the resolved decision, never on the request", () => {
  for (const gate of route.match(/if \(result\.notify\) await notifyCounterpart/g) ?? []) assert.equal(gate.includes("result.notify"), true);
  assert.equal((route.match(/notifyCounterpart\(/g) ?? []).length - 1, (route.match(/if \(result\.notify\) await notifyCounterpart/g) ?? []).length, "every call site is gated (the remaining occurrence is the helper's own definition)");
  // And the recipient is derived from the persisted booking, never named by the client.
  assert.equal(route.includes("const counterpartId = cateringCounterpart(booking, actorId);"), true);
  assert.equal(/userId: (req|input|fields)\./.test(route), false);
});

test("notification copy carries no title, note, name or instruction text", () => {
  const contract = fs.readFileSync(path.join(here, "..", "..", "shared", "catering-booking-execution.ts"), "utf8");
  const block = contract.slice(contract.indexOf("CATERING_EXECUTION_TIMELINE_NOTIFICATION"), contract.indexOf("CATERING_TIMELINE_CATEGORY_LABELS"));
  // Fixed strings only: nothing interpolated, so no persisted value can travel in a notification.
  assert.equal(block.includes("${"), false);
  // The route hands the notification helper one of those two fixed constants and nothing else: the helper's own
  // insert reads only `notification.*`, so no persisted title, note, crew name or instruction can reach it. (Shared
  // ACTIVITY metadata does carry an item title, exactly as Phase 2H records a task title -- that is customer-visible
  // history of a record the customer can already see, and it is not a notification.)
  const helper = route.slice(route.indexOf("async function notifyCounterpart"), route.indexOf("async function duplicateTimelineItem"));
  assert.equal(helper.includes("title: notification.title, message: notification.message"), true);
  assert.equal(/title: (?!notification\.)[A-Za-z]+\./.test(helper), false, "the notification insert reads no persisted value");
  assert.equal(/(input|row|item|draft|outcome)\./.test(helper), false, "and no record is even in scope there");
});

test("the notification link is the customer's own workspace section", () => {
  assert.equal(route.includes('linkUrl: cateringExecutionSectionPath("customer", bookingId)'), true);
});

test("a notification failure is best effort and never fails the mutation that already committed", () => {
  const helper = route.slice(route.indexOf("async function notifyCounterpart"), route.indexOf("async function duplicateTimelineItem"));
  assert.equal(helper.includes(".catch(() => undefined)"), true);
});
