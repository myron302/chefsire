import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  CATERING_EQUIPMENT_SCHEDULE_MESSAGE,
  cateringEquipmentCreateSchema,
  cateringEquipmentScheduleField,
  cateringEquipmentScheduleIsOrdered,
  cateringEquipmentUpdateSchema,
} from "@shared/catering-booking-execution";
import { CATERING_EQUIPMENT_PATCH_REFUSALS, resolveCateringEquipmentPatch } from "./catering-booking-execution-policy";

/**
 * A rental cannot be returned before it is collected.
 *
 * The other three ranges in this phase compare two clocks on one day. A rental does not: it can be collected the
 * day before the event and returned the day after, so each endpoint is a calendar date PLUS an event-local clock.
 * Validating each of those four columns alone -- which is all a field schema can do, and all the database's format
 * CHECKs did -- accepted a pickup on the 10th returning on the 9th, and a same-day pickup at 18:00 returning at
 * 10:00. An impossible, customer-visible rental schedule could be persisted.
 *
 * One rule now answers it everywhere: `cateringEquipmentScheduleIsOrdered`, in the contract, used by the create
 * schema, by the merged-state validation each PATCH runs against the authoritative locked row, by the client form,
 * and mirrored by a database CHECK that is the final backstop. Each layer is exercised below against the same
 * cases, so none of them can drift into a slightly different rule.
 */

const D9 = "2026-09-09";
const D10 = "2026-09-10";
const D12 = "2026-09-12";
const NOW = new Date("2026-09-08T12:00:00.000Z");
const VERSION = new Date("2026-09-08T11:00:00.000Z");
const version = VERSION.toISOString();
const stale = new Date("2026-09-08T10:00:00.000Z").toISOString();

/* ================================================================================================================ *
 * The rule
 * ================================================================================================================ */

test("chronology: a return after its pickup is valid, at either level", () => {
  assert.equal(cateringEquipmentScheduleIsOrdered({ pickupDate: D10, returnDate: D12 }), true);
  assert.equal(cateringEquipmentScheduleIsOrdered({ pickupDate: D10, pickupTime: "18:00", returnDate: D12, returnTime: "10:00" }), true, "a later date wins, whatever the clocks say");
  assert.equal(cateringEquipmentScheduleIsOrdered({ pickupDate: D10, pickupTime: "10:00", returnDate: D10, returnTime: "18:00" }), true);
});

test("chronology: equality is valid, at both levels", () => {
  // The same treatment every other range in this phase gives it. Nothing in the product requires a rental to last a
  // measurable length of time, and a same-instant collection and return is a real, if unusual, correction.
  assert.equal(cateringEquipmentScheduleIsOrdered({ pickupDate: D10, returnDate: D10 }), true, "same day, no clocks");
  assert.equal(cateringEquipmentScheduleIsOrdered({ pickupDate: D10, pickupTime: "18:00", returnDate: D10, returnTime: "18:00" }), true, "same instant");
});

test("chronology: a return that genuinely precedes its pickup is refused", () => {
  assert.equal(cateringEquipmentScheduleIsOrdered({ pickupDate: D10, returnDate: D9 }), false);
  assert.equal(cateringEquipmentScheduleIsOrdered({ pickupDate: D10, pickupTime: "18:00", returnDate: D10, returnTime: "10:00" }), false);
  // The date decides even when the clocks would suggest otherwise.
  assert.equal(cateringEquipmentScheduleIsOrdered({ pickupDate: D10, pickupTime: "01:00", returnDate: D9, returnTime: "23:00" }), false);
});

test("chronology: an incomplete schedule is valid, and nothing is inferred to make it otherwise", () => {
  // Only one endpoint supplied: its own components are still format-checked, but there is nothing to compare to.
  assert.equal(cateringEquipmentScheduleIsOrdered({ pickupDate: D10 }), true);
  assert.equal(cateringEquipmentScheduleIsOrdered({ returnDate: D9 }), true);
  assert.equal(cateringEquipmentScheduleIsOrdered({ pickupDate: D10, pickupTime: "18:00" }), true);
  assert.equal(cateringEquipmentScheduleIsOrdered({ returnDate: D9, returnTime: "01:00" }), true);
  assert.equal(cateringEquipmentScheduleIsOrdered({}), true);
  // Same date with ONE clock missing: a pickup time says nothing about a return that has no time, and vice versa.
  assert.equal(cateringEquipmentScheduleIsOrdered({ pickupDate: D10, pickupTime: "18:00", returnDate: D10 }), true);
  assert.equal(cateringEquipmentScheduleIsOrdered({ pickupDate: D10, returnDate: D10, returnTime: "01:00" }), true);
  // A clock with NO date names no instant, so two clocks alone are never compared -- assuming they share a day
  // would be inventing the fact that is missing.
  assert.equal(cateringEquipmentScheduleIsOrdered({ pickupTime: "18:00", returnTime: "10:00" }), true);
  assert.equal(cateringEquipmentScheduleIsOrdered({ pickupTime: "18:00", returnDate: D9, returnTime: "10:00" }), true);
  // Null and undefined mean the same thing, because a PATCH clears a field with null and omits it as undefined.
  assert.equal(cateringEquipmentScheduleIsOrdered({ pickupDate: null, pickupTime: "18:00", returnDate: D9, returnTime: "10:00" }), true);
  assert.equal(cateringEquipmentScheduleIsOrdered({ pickupDate: D10, returnDate: null }), true);
});

test("chronology: a rejection names the endpoint that is actually wrong", () => {
  assert.equal(cateringEquipmentScheduleField({ pickupDate: D10, returnDate: D9 }), "returnDate");
  assert.equal(cateringEquipmentScheduleField({ pickupDate: D10, pickupTime: "18:00", returnDate: D10, returnTime: "10:00" }), "returnTime");
});

/* ================================================================================================================ *
 * Create
 * ================================================================================================================ */

const create = (over: Record<string, unknown>) => cateringEquipmentCreateSchema.safeParse({ name: "Chafer", sourceType: "rental", ...over });

test("create: valid and incomplete schedules are accepted", () => {
  assert.equal(create({ pickupDate: D10, returnDate: D12 }).success, true);
  assert.equal(create({ pickupDate: D10, pickupTime: "10:00", returnDate: D10, returnTime: "18:00" }).success, true);
  assert.equal(create({ pickupDate: D10, pickupTime: "18:00", returnDate: D10, returnTime: "18:00" }).success, true, "equality");
  assert.equal(create({ pickupDate: D10 }).success, true, "only a pickup");
  assert.equal(create({ returnDate: D9 }).success, true, "only a return");
  assert.equal(create({ pickupDate: D10, pickupTime: "18:00", returnDate: D10 }).success, true, "one clock missing");
  assert.equal(create({}).success, true, "no schedule at all");
});

test("create: an impossible schedule is refused before anything can be persisted", () => {
  for (const [label, payload] of [
    ["return date before pickup date", { pickupDate: D10, returnDate: D9 }],
    ["same date, return time before pickup time", { pickupDate: D10, pickupTime: "18:00", returnDate: D10, returnTime: "10:00" }],
  ] as [string, Record<string, unknown>][]) {
    const parsed = create(payload);
    assert.equal(parsed.success, false, label);
    assert.equal(parsed.error!.issues[0]?.message, CATERING_EQUIPMENT_SCHEDULE_MESSAGE, label);
  }
  // The path names the endpoint at fault, so a form can anchor the error where the mistake is.
  assert.deepEqual(create({ pickupDate: D10, returnDate: D9 }).error!.issues[0]?.path, ["returnDate"]);
  assert.deepEqual(create({ pickupDate: D10, pickupTime: "18:00", returnDate: D10, returnTime: "10:00" }).error!.issues[0]?.path, ["returnTime"]);
});

test("create: the refusal happens during parsing, so no transaction, token, row, activity or notification exists", () => {
  const route = fs.readFileSync(path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "routes", "catering-booking-execution.ts"), "utf8");
  const handler = route.slice(route.indexOf('r.post("/bookings/:id/execution/equipment"'), route.indexOf('r.patch("/bookings/:id/execution/equipment/:equipmentId"'));
  // Parsing throws before the transaction opens, so every side effect is downstream of a check that already failed.
  const parseAt = handler.indexOf("cateringEquipmentCreateSchema.parse(req.body ?? {})");
  assert.notEqual(parseAt, -1);
  for (const effect of ["db.transaction", "tx.insert(cateringBookingEquipment)", "consumeCreateRequest", "cateringBookingActivity"]) {
    const at = handler.indexOf(effect);
    if (at === -1) continue;
    assert.equal(parseAt < at, true, `${effect} is only reachable after the payload validates`);
  }
  // A ZodError becomes a 400 with the issue's own message, never a 500 from a constraint violation.
  assert.equal(route.includes('if (error instanceof z.ZodError) return res.status(400).json({ message: error.issues[0]?.message });'), true);
  // Equipment creates never notify in any branch, so there is no notification to suppress here either.
  assert.equal(handler.includes("notifyCounterpart"), false);
});

test("create: a rejected create leaves its retry token unspent, so the corrected payload creates once", () => {
  // Nothing consumed the token, because nothing succeeded for it to be a retry OF. The same token, with a corrected
  // schedule, is an ordinary first create -- and a SECOND send of that corrected payload is then the retry.
  const token = "11111111-1111-4111-8111-111111111111";
  assert.equal(create({ clientRequestId: token, pickupDate: D10, returnDate: D9 }).success, false);
  const corrected = create({ clientRequestId: token, pickupDate: D10, returnDate: D12 });
  assert.equal(corrected.success, true);
  assert.equal(corrected.data!.clientRequestId, token, "the same token travels, because it was never spent");
  // The ledger is what decides that, and it is only ever written alongside a committed insert -- asserted in
  // catering-booking-execution-idempotency.test.ts and modelled in catering-booking-execution-create-ledger.test.ts.
  const route = fs.readFileSync(path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "routes", "catering-booking-execution.ts"), "utf8");
  assert.equal(/(?<!async function )consumeCreateRequest\((?!tx,)/.test(route), false);
});

/* ================================================================================================================ *
 * PATCH -- judged on the MERGED state, never on the body alone
 * ================================================================================================================ */

/** A persisted rental, and the patch helper that judges a request against it exactly as the route does. */
const persisted = (over: Partial<Record<string, unknown>> = {}) => ({
  name: "Chafer", quantity: 6, sourceType: "rental", sourceName: "Ace Rentals",
  pickupDate: D10, pickupTime: null as string | null, returnDate: D12, returnTime: null as string | null,
  status: "confirmed", isBlocker: false, notes: null, visibility: "shared", updatedAt: VERSION, ...over,
});
const patch = (row: ReturnType<typeof persisted>, input: Record<string, unknown>) =>
  resolveCateringEquipmentPatch(row as never, { expectedUpdatedAt: version, ...input } as never, NOW);

test("PATCH: moving the RETURN back past the persisted pickup is refused", () => {
  // The body's own field is a perfectly valid date. Only the merged row is impossible.
  assert.equal(patch(persisted(), { returnDate: D9 }).kind, "invalid_schedule");
  const sameDay = persisted({ pickupDate: D10, pickupTime: "18:00", returnDate: D10, returnTime: "20:00" });
  assert.equal(patch(sameDay, { returnTime: "10:00" }).kind, "invalid_schedule");
});

test("PATCH: moving the PICKUP forward past the persisted return is refused", () => {
  assert.equal(patch(persisted(), { pickupDate: "2026-09-13" }).kind, "invalid_schedule");
  const sameDay = persisted({ pickupDate: D10, pickupTime: "18:00", returnDate: D10, returnTime: "20:00" });
  assert.equal(patch(sameDay, { pickupTime: "21:00" }).kind, "invalid_schedule");
});

test("PATCH: the refusal is a client validation failure with the contract's own wording", () => {
  assert.equal(CATERING_EQUIPMENT_PATCH_REFUSALS.invalid_schedule, CATERING_EQUIPMENT_SCHEDULE_MESSAGE);
  const route = fs.readFileSync(path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "routes", "catering-booking-execution.ts"), "utf8");
  assert.equal(route.includes('if (result.kind === "invalid_schedule") return res.status(400).json({ message: CATERING_EQUIPMENT_PATCH_REFUSALS.invalid_schedule });'), true);
  // Refused before the UPDATE, so the impossible state never reaches SQL and the CHECK is never the one saying no.
  const handler = route.slice(route.indexOf('r.patch("/bookings/:id/execution/equipment/:equipmentId"'), route.indexOf('r.delete("/bookings/:id/execution/equipment/:equipmentId"'));
  assert.equal(handler.indexOf('outcome.kind === "invalid_schedule"') < handler.indexOf("tx.update(cateringBookingEquipment)"), true);
  // And it is judged against the authoritative LOCKED row, not against anything read before the transaction.
  assert.equal(handler.indexOf("lockCollection(tx,") < handler.indexOf("tx.select().from(cateringBookingEquipment)"), true);
  assert.equal(handler.indexOf("tx.select().from(cateringBookingEquipment)") < handler.indexOf("resolveCateringEquipmentPatch("), true);
});

test("PATCH: valid edits, including ones that repair an impossible candidate, still go through", () => {
  // An unrelated field on a row with a valid schedule.
  assert.equal(patch(persisted(), { status: "received" }).kind, "update");
  assert.equal(patch(persisted(), { name: "Chafing dish" }).kind, "update");
  // Moving the return LATER.
  assert.equal(patch(persisted(), { returnDate: "2026-09-14" }).kind, "update");
  // Repairing a row into a valid state in one request: both endpoints move together, and the merged result is fine.
  assert.equal(patch(persisted(), { pickupDate: D9, returnDate: D10 }).kind, "update");
  // Same-day equality.
  assert.equal(patch(persisted({ pickupDate: D10, pickupTime: "18:00", returnDate: D10, returnTime: "20:00" }), { returnTime: "18:00" }).kind, "update");
  // CLEARING a side is a real edit, not a refusal: with no return date there is nothing to compare.
  assert.equal(patch(persisted(), { returnDate: null }).kind, "update");
  assert.equal(patch(persisted(), { pickupDate: null }).kind, "update");
  // And clearing one clock on a same-day rental leaves the pair incomparable rather than invalid.
  assert.equal(patch(persisted({ pickupDate: D10, pickupTime: "18:00", returnDate: D10, returnTime: "20:00" }), { returnTime: null }).kind, "update");
});

test("PATCH: the body alone is not what is judged -- the same body is fine against a different row", () => {
  // `returnDate: D9` is refused against a pickup on the 10th and accepted against a pickup on the 8th. Identical
  // request, opposite outcome, decided entirely by the authoritative row it merges into.
  assert.equal(patch(persisted(), { returnDate: D9 }).kind, "invalid_schedule");
  assert.equal(patch(persisted({ pickupDate: "2026-09-08" }), { returnDate: D9 }).kind, "update");
});

test("PATCH: a body carrying BOTH endpoints is also caught by the schema, as a shortcut", () => {
  const parsed = cateringEquipmentUpdateSchema.safeParse({ pickupDate: D10, returnDate: D9, expectedUpdatedAt: version });
  assert.equal(parsed.success, false);
  assert.equal(parsed.error!.issues[0]?.message, CATERING_EQUIPMENT_SCHEDULE_MESSAGE);
  // But a body naming ONE endpoint is individually valid and must still be caught after merging -- which is the
  // whole point, and why the schema refinement is a shortcut rather than the guarantee.
  assert.equal(cateringEquipmentUpdateSchema.safeParse({ returnDate: D9, expectedUpdatedAt: version }).success, true);
  assert.equal(patch(persisted(), { returnDate: D9 }).kind, "invalid_schedule");
});

test("PATCH: optimistic concurrency is intact, and the established ordering is preserved", () => {
  // A stale request that WOULD genuinely change a valid row still conflicts.
  assert.equal(resolveCateringEquipmentPatch(persisted() as never, { status: "received", expectedUpdatedAt: stale } as never, NOW).kind, "conflict");
  // An exact retry that changes nothing is unchanged, whatever version it names -- unchanged from before this work.
  assert.equal(resolveCateringEquipmentPatch(persisted() as never, { status: "confirmed", expectedUpdatedAt: stale } as never, NOW).kind, "unchanged");
  // And an impossible merged schedule is answered as invalid even on a stale base, exactly as the run-of-show
  // answers one: reloading can never make it possible, so telling the participant to reload would be a lie.
  assert.equal(resolveCateringEquipmentPatch(persisted() as never, { returnDate: D9, expectedUpdatedAt: stale } as never, NOW).kind, "invalid_schedule");
  // The ordering that produces those three answers, stated once: merge, validate, unchanged, version, write.
  const policy = fs.readFileSync(path.resolve(path.dirname(fileURLToPath(import.meta.url)), "catering-booking-execution-policy.ts"), "utf8");
  const body = policy.slice(policy.indexOf("export function resolveCateringEquipmentPatch"), policy.indexOf("export function resolveCateringEquipmentDelete"));
  const order = ["nextCateringEquipmentState(", "cateringEquipmentScheduleIsOrdered(next)", "changed.length === 0", "cateringExecutionVersionMatches("];
  const positions = order.map((marker) => body.indexOf(marker));
  assert.deepEqual(positions, [...positions].sort((left, right) => left - right), "merge, validate, unchanged, version");
  assert.equal(positions.includes(-1), false);
});

/* ================================================================================================================ *
 * The database backstop
 * ================================================================================================================ */

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const migration = fs.readFileSync(path.join(repoRoot, "server", "migrations", "20260906_catering_booking_execution.sql"), "utf8");
const drizzle = fs.readFileSync(path.join(repoRoot, "shared", "schema", "domains", "social-content.ts"), "utf8");

/** The one predicate both layers must carry, written out once so neither can paraphrase the other. */
const SCHEDULE_PREDICATE = "pickup_date IS NULL OR return_date IS NULL OR return_date > pickup_date OR (return_date = pickup_date AND (pickup_time IS NULL OR return_time IS NULL OR return_time >= pickup_time))";
/** One constraint's line, with Drizzle's `${t.camelCase}` interpolation spelled the way SQL spells it. */
function scheduleLine(source: string, drizzleLayer: boolean): string {
  const from = source.indexOf("catering_execution_equipment_schedule_check");
  assert.notEqual(from, -1, "the constraint exists in this layer");
  const line = source.slice(from, source.indexOf("\n", from));
  return drizzleLayer ? line.replace(/\$\{t\.(\w+)\}/g, (_, column: string) => column.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`)) : line;
}

test("database: the CHECK expresses the same rule, and the two layers agree exactly", () => {
  // The migration states it as a table constraint...
  assert.equal(scheduleLine(migration, false).includes(`CHECK (${SCHEDULE_PREDICATE})`), true, "migration");
  // ...and the Drizzle definition states the identical predicate, column for column.
  assert.equal(scheduleLine(drizzle, true).includes(SCHEDULE_PREDICATE), true, "drizzle schema");
  // Neither layer carries a second, different schedule constraint that could disagree with it.
  assert.equal((migration.match(/catering_execution_equipment_schedule_check/g) ?? []).length, 1);
  assert.equal((drizzle.match(/catering_execution_equipment_schedule_check/g) ?? []).length, 1);
});

test("database: the CHECK accepts and rejects exactly what the contract helper does", () => {
  // The SQL is evaluated here as the three-valued expression Postgres would evaluate, so the backstop and the
  // application rule are compared on the same cases rather than trusted to have been written the same way.
  const check = (s: { pickupDate: string | null; pickupTime: string | null; returnDate: string | null; returnTime: string | null }) =>
    s.pickupDate === null || s.returnDate === null
    || s.returnDate > s.pickupDate
    || (s.returnDate === s.pickupDate && (s.pickupTime === null || s.returnTime === null || s.returnTime >= s.pickupTime));
  const dates = [null, D9, D10, D12];
  const times = [null, "10:00", "18:00"];
  let compared = 0;
  for (const pickupDate of dates) for (const pickupTime of times) for (const returnDate of dates) for (const returnTime of times) {
    const schedule = { pickupDate, pickupTime, returnDate, returnTime };
    assert.equal(check(schedule), cateringEquipmentScheduleIsOrdered(schedule), JSON.stringify(schedule));
    compared += 1;
  }
  assert.equal(compared, dates.length * dates.length * times.length * times.length);
  // The named cases, spelled out: rejected, rejected, accepted, accepted, accepted.
  assert.equal(check({ pickupDate: D10, pickupTime: null, returnDate: D9, returnTime: null }), false);
  assert.equal(check({ pickupDate: D10, pickupTime: "18:00", returnDate: D10, returnTime: "10:00" }), false);
  assert.equal(check({ pickupDate: D10, pickupTime: "18:00", returnDate: D10, returnTime: "18:00" }), true);
  assert.equal(check({ pickupDate: D10, pickupTime: "18:00", returnDate: D10, returnTime: null }), true);
  assert.equal(check({ pickupDate: null, pickupTime: "18:00", returnDate: D9, returnTime: "10:00" }), true);
});

/* ================================================================================================================ *
 * Same-class audit
 * ================================================================================================================ */

test("AUDIT: every paired range in this phase is validated on the merged state, by one shared rule each", () => {
  const contract = fs.readFileSync(path.join(repoRoot, "shared", "catering-booking-execution.ts"), "utf8");
  const policy = fs.readFileSync(path.join(repoRoot, "server", "services", "catering-booking-execution-policy.ts"), "utf8");
  // Four paired ranges exist in Phase 2J. Three compare two clocks on one day and share `cateringTimeRangeIsOrdered`;
  // the rental spans a date and a clock on each side and has its own rule. Each has exactly one definition.
  assert.equal((contract.match(/export function cateringTimeRangeIsOrdered/g) ?? []).length, 1);
  assert.equal((contract.match(/export function cateringEquipmentScheduleIsOrdered/g) ?? []).length, 1);
  // Each is checked against the MERGED state in its resolver, not against the request body.
  for (const [resolver, rule] of [
    ["resolveCateringTimelinePatch", "cateringTimeRangeIsOrdered(next.scheduledTime, next.endTime)"],
    ["resolveCateringEquipmentPatch", "cateringEquipmentScheduleIsOrdered(next)"],
  ] as [string, string][]) {
    const body = policy.slice(policy.indexOf(`export function ${resolver}`));
    assert.equal(body.slice(0, body.indexOf("\n}")).includes(rule), true, resolver);
  }
  // Crew times and the access window were already merged-state validated, and still are.
  assert.equal(policy.includes("cateringStaffTimesAreOrdered(next)") || policy.includes("cateringStaffStateIsCoherent(next)"), true);
  assert.equal(policy.includes("mergeCateringAccessWindow("), true);
  // No layer restates a comparison of its own: every `<=` / `>=` between two schedule fields lives in the contract.
  assert.equal(/next\.(returnDate|returnTime|endTime|departureTime)\s*[<>]/.test(policy), false, "no resolver compares endpoints itself");
});
