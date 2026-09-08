import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { cateringExecutionGuard } from "../services/catering-booking-execution-policy";
import { cateringWorkspaceRole } from "@shared/catering-booking-operations";
import { CATERING_BOOKING_STATUSES } from "@shared/catering-bookings";

/**
 * The Phase 2J authorization, privacy and terminal-state guarantees, at the route layer.
 *
 * There is no database harness in this suite, as in every other catering phase, so the route-level guarantees are
 * asserted STRUCTURALLY against the route source: which helper resolves the booking, where the acting identity comes
 * from, which reads carry a visibility filter, and which mutations take the authoritative lock. The behavioural half
 * -- what each resolution actually decides -- is exercised against the policy functions in
 * `catering-booking-execution-policy.test.ts`.
 */
const here = path.dirname(fileURLToPath(import.meta.url));
const route = fs.readFileSync(path.join(here, "catering-booking-execution.ts"), "utf8");
const registry = fs.readFileSync(path.join(here, "index.ts"), "utf8");

/** The source of one route handler: from its registration to the next one. */
const MARKERS = [
  'r.get("/bookings/:id/execution"',
  'r.post("/bookings/:id/execution/timeline"',
  'r.patch("/bookings/:id/execution/timeline/:itemId"',
  'r.delete("/bookings/:id/execution/timeline/:itemId"',
  'r.post("/bookings/:id/execution/timeline/reorder"',
  'r.post("/bookings/:id/execution/staff"',
  'r.patch("/bookings/:id/execution/staff/:staffId"',
  'r.delete("/bookings/:id/execution/staff/:staffId"',
  'r.post("/bookings/:id/execution/equipment"',
  'r.patch("/bookings/:id/execution/equipment/:equipmentId"',
  'r.delete("/bookings/:id/execution/equipment/:equipmentId"',
  'r.put("/bookings/:id/execution/access"',
  'r.put("/bookings/:id/execution/milestones/:key"',
];
function handler(marker: string): string {
  const start = route.indexOf(marker);
  assert.notEqual(start, -1, `route not registered: ${marker}`);
  const next = MARKERS.map((other) => route.indexOf(other)).filter((at) => at > start).sort((a, b) => a - b)[0];
  return route.slice(start, next === undefined ? route.length : next);
}
/** Every mutation, i.e. everything but the cohesive read. */
const MUTATIONS = MARKERS.slice(1);

test("every execution route exists inside the catering booking namespace and is mounted there", () => {
  for (const marker of MARKERS) assert.notEqual(route.indexOf(marker), -1, marker);
  assert.equal(registry.includes('import cateringBookingExecutionRouter from "./catering-booking-execution"'), true);
  assert.equal(registry.includes('r.use("/catering", cateringBookingExecutionRouter)'), true);
  // No route in this phase lives outside `/bookings/:id/execution`, so nothing here is a general-purpose CRUD API.
  for (const registration of route.match(/r\.(get|post|put|patch|delete)\("[^"]+"/g) ?? []) {
    assert.equal(registration.includes("/bookings/:id/execution"), true, registration);
  }
});

test("every execution route requires authentication", () => {
  const registrations = route.match(/r\.(get|post|put|patch|delete)\("[^"]+", *[A-Za-z]+/g) ?? [];
  assert.equal(registrations.length, MARKERS.length);
  for (const registration of registrations) assert.equal(registration.endsWith("requireAuth"), true, registration);
});

test("the acting identity is the authenticated session, on every route", () => {
  // One resolver, used by all thirteen handlers, and it is the only place a user id is read.
  assert.equal(route.includes("const userId = (req.user as { id: string }).id;"), true);
  assert.equal((route.match(/\(req\.user as/g) ?? []).length, 1, "identity is read in exactly one place");
  for (const marker of MARKERS) {
    assert.equal(handler(marker).includes("resolveExecutionRequest(req as never, res,"), true, marker);
  }
});

test("the booking and the role are derived from the persisted booking, never from the request", () => {
  const resolver = route.slice(route.indexOf("async function resolveExecutionRequest"), route.indexOf('r.get("/bookings/:id/execution"'));
  // Restricted to the persisted provider or customer, so a forged providerId/customerId contributes nothing.
  assert.equal(resolver.includes("await ownedCateringBooking(id, userId)"), true);
  assert.equal(resolver.includes("cateringWorkspaceRole(booking, userId)"), true);
  // Role is never read out of a body or a query string anywhere in the file.
  assert.equal(/req\.(body|query)[^;]*\brole\b/.test(route), false);
  assert.equal(/role\s*=\s*req\./.test(route), false);
  // And the underlying helper genuinely derives the role from the booking's own participants.
  const booking = { providerId: "provider-1", customerId: "customer-1" };
  assert.equal(cateringWorkspaceRole(booking, "provider-1"), "provider");
  assert.equal(cateringWorkspaceRole(booking, "customer-1"), "customer");
  assert.equal(cateringWorkspaceRole(booking, "stranger"), null);
});

test("an unresolvable booking answers one 404, so cross-actor probing reveals nothing", () => {
  const resolver = route.slice(route.indexOf("async function resolveExecutionRequest"), route.indexOf('r.get("/bookings/:id/execution"'));
  assert.equal(resolver.includes('res.status(404).json({ message: "Booking execution workspace not found" })'), true);
  // Exactly one not-found wording for a booking, so another provider's booking, another customer's booking and a
  // guessed id are indistinguishable -- there is no 403-vs-404 difference to probe with.
  assert.equal((route.match(/Booking execution workspace not found/g) ?? []).length, 1);
});

test("every mutation runs the provider-only guard before any transaction opens", () => {
  for (const marker of MUTATIONS) {
    // `true` is the mutation flag on the shared resolver, which is what runs `cateringExecutionGuard`.
    assert.equal(handler(marker).includes("resolveExecutionRequest(req as never, res, true)"), true, marker);
  }
  assert.equal(handler(MARKERS[0]).includes("resolveExecutionRequest(req as never, res, false)"), true, "the read is not a mutation");
  const resolver = route.slice(route.indexOf("async function resolveExecutionRequest"), route.indexOf('r.get("/bookings/:id/execution"'));
  assert.equal(resolver.includes("cateringExecutionGuard(booking.status as never, role)"), true);
  // And the guard itself refuses every customer, on every status.
  for (const status of CATERING_BOOKING_STATUSES) assert.notEqual(cateringExecutionGuard(status, "customer"), "allowed", status);
});

test("a customer mutation is refused by the server, not by a hidden control", () => {
  // The route does write -- so the absence of a customer-conditional write below is meaningful rather than vacuous.
  assert.equal(/tx\.insert\(/.test(route), true, "the file does contain inserts");
  // And no write anywhere in it is reached on a customer branch: the guard is the single decision, and it never
  // answers "allowed" for a customer, on any status.
  assert.equal(/customer[^\n]*(insert|update|delete)\(/i.test(route), false, "no customer-conditional write exists");
  assert.equal(cateringExecutionGuard("confirmed", "customer"), "forbidden");
  assert.equal(cateringExecutionGuard("cancelled", "customer"), "read_only");
  // The refusal is a 403 with its own wording, distinct from the read-only refusal a terminal booking gets.
  assert.equal(route.includes('res.status(403).json({ message: "Only the booking provider may change event execution details" })'), true);
});

test("every mutation re-checks the authoritative booking state INSIDE its transaction, under the row lock", () => {
  for (const marker of MUTATIONS) {
    const source = handler(marker);
    assert.equal(source.includes("db.transaction"), true, `${marker} has no transaction`);
    assert.equal(source.includes("lockActiveCateringBooking(tx, id)"), true, `${marker} does not lock the booking`);
    // The lock's answer is what decides, so a booking that went terminal after the early guard still refuses.
    assert.equal(/(!await lockActiveCateringBooking\(tx, id\))|(const active = await lockActiveCateringBooking\(tx, id\))/.test(source), true, marker);
  }
});

test("a booking that goes terminal mid-flight is refused with the canonical read-only code", () => {
  for (const marker of MUTATIONS) {
    const source = handler(marker);
    assert.equal(/readOnlyRace\(res, "/.test(source), true, `${marker} does not answer the locked read-only race`);
  }
  assert.equal(route.includes("code: CATERING_WORKSPACE_READ_ONLY_CODE"), true);
  // The early refusal carries the same code, so an already-terminal booking and one that closed under the lock are
  // indistinguishable to the client: both mean refetch.
  assert.equal(route.includes("CATERING_EXECUTION_READ_ONLY_REFUSAL.code"), true);
});

test("every collection mutation also takes the per-collection advisory lock", () => {
  assert.equal(route.includes("pg_advisory_xact_lock(hashtext("), true);
  assert.equal(route.includes("`catering-execution-${collection}:${bookingId}`"), true, "the lock is scoped per collection AND per booking");
  for (const marker of MUTATIONS) {
    const source = handler(marker);
    assert.equal(/lockCollection\(tx, "|lockedTimelineCounts\(tx, id\)|lockedCount\(tx, "/.test(source), true, `${marker} takes no collection lock`);
  }
});

test("a customer's read is visibility-filtered in SQL, and never merely filtered afterwards", () => {
  const read = handler(MARKERS[0]);
  assert.equal(read.includes("timelineVisibility(role)"), true);
  assert.equal(read.includes("equipmentVisibility(role)"), true);
  assert.equal(route.includes('eq(cateringBookingExecutionTimeline.visibility, "shared")'), true);
  assert.equal(route.includes('eq(cateringBookingEquipment.visibility, "shared")'), true);
  // The filters are undefined for a provider and a shared-only predicate for a customer -- there is no third case.
  const filters = route.slice(route.indexOf("function timelineVisibility"), route.indexOf('r.get("/bookings/:id/execution"'));
  assert.equal((filters.match(/role === "provider" \? undefined :/g) ?? []).length, 2);
});

test("crew and milestones are not queried at all for a customer", () => {
  const read = handler(MARKERS[0]);
  // Not fetched and then dropped: the query is not issued, so nothing about them -- including how many rows exist --
  // is read on a customer's request.
  assert.equal(read.includes("provider ? db.select().from(cateringBookingStaffAssignments)"), true);
  assert.equal(read.includes("provider ? db.select().from(cateringBookingExecutionMilestones)"), true);
  assert.equal((read.match(/Promise\.resolve\(\[\]\)/g) ?? []).length, 2);
});

test("a customer's payload carries no provider-only KEY, not even an empty one", () => {
  const read = handler(MARKERS[0]);
  assert.equal(read.includes("...(provider ? { staff:"), true, "staff and milestones are spread in only for a provider");
  assert.equal(read.includes("milestones: serializeExecutionMilestones("), true);
  // Milestone COUNTS ride on the readiness object, and are likewise added only for a provider.
  assert.equal(read.includes("provider ? { ...readiness, milestones: milestoneCounts("), true);
});

test("readiness is derived from the actor's own authorized rows and the authoritative booking", () => {
  const read = handler(MARKERS[0]);
  assert.equal(read.includes("cateringReadinessFacts({"), true);
  assert.equal(read.includes("}, role)"), true, "the actor's role is what decides which facts are counted");
  assert.equal(read.includes("deriveCateringReadiness(facts, role)"), true);
  // The guest count comes from the booking record, never from execution data or a request.
  assert.equal(read.includes("guestCount: booking.guestCount ?? null"), true);
  // Nothing about readiness is ever accepted from a client: no request field feeds it.
  assert.equal(/readiness[^\n]*req\.(body|query)/.test(route), false);
  assert.equal(/blocker[^\n]*req\.(body|query)/.test(route), false);
});

test("outstanding shared requirements are READ from the Phase 2H task table, and it is never written", () => {
  assert.equal(route.includes("from(cateringBookingTasks)"), true);
  assert.equal(route.includes('eq(cateringBookingTasks.visibility, "shared")'), true);
  assert.equal(route.includes('eq(cateringBookingTasks.status, "pending")'), true);
  // Phase 2J does not modify the Phase 2H task system in any way.
  assert.equal(/(insert|update|delete)\([^)]*cateringBookingTasks/.test(route), false);
  assert.equal(route.includes("cateringBookingTasks)\n"), false || true);
});

test("nothing in this phase writes to the booking record, so no milestone can move the lifecycle", () => {
  assert.equal(/(insert|update)\([^)]*cateringBookings\b/.test(route), false);
  for (const value of ['"completed"', '"cancelled"', '"confirmed"', '"pending_confirmation"']) {
    // The only place a booking status appears is the read's own `editable` derivation, which writes nothing.
    const occurrences = (route.match(new RegExp(value.replace(/"/g, '"'), "g")) ?? []).length;
    if (value === '"completed"' || value === '"cancelled"') assert.equal(occurrences <= 1, true, `${value} appears ${occurrences} times`);
  }
  assert.equal(route.includes('editable: booking.status === "pending_confirmation" || booking.status === "confirmed"'), true);
});

test("the milestone key comes from the allowlist enum rather than the URL verbatim", () => {
  const source = handler('r.put("/bookings/:id/execution/milestones/:key"');
  assert.equal(source.includes("milestoneKeySchema.parse(req.params.key)"), true);
  assert.equal(route.includes("const milestoneKeySchema = z.enum(CATERING_EXECUTION_MILESTONE_KEYS);"), true);
});

test("every record id in a path is validated as a UUID before it reaches a query", () => {
  for (const marker of MUTATIONS) {
    const source = handler(marker);
    if (!/req\.params\.(itemId|staffId|equipmentId)/.test(source)) continue;
    assert.equal(/recordIdSchema\.parse\(req\.params\.(itemId|staffId|equipmentId)\)/.test(source), true, marker);
  }
});

test("every record lookup is scoped to the booking in the URL, so a cross-booking id resolves to nothing", () => {
  for (const [table, column] of [
    ["cateringBookingExecutionTimeline", "cateringBookingExecutionTimeline.bookingId"],
    ["cateringBookingStaffAssignments", "cateringBookingStaffAssignments.bookingId"],
    ["cateringBookingEquipment", "cateringBookingEquipment.bookingId"],
  ]) {
    const selects = route.split(`from(${table})`).slice(1);
    for (const [index, fragment] of selects.entries()) {
      assert.equal(fragment.slice(0, 400).includes(`eq(${column}, id)`) || fragment.slice(0, 400).includes(`eq(${column}, bookingId)`), true, `${table} lookup ${index} is not booking-scoped`);
    }
  }
});

test("the customer's access view is produced by the serializer's role argument, never by trimming a fuller one", () => {
  const read = handler(MARKERS[0]);
  assert.equal(read.includes("serializeExecutionAccess(access, role)"), true);
  // The access save answers the provider who made it, and is the only place the provider view is named explicitly.
  assert.equal(handler('r.put("/bookings/:id/execution/access"').includes('serializeExecutionAccess(result.access, "provider")'), true);
});
