import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  CATERING_ACCESS_SAVE_REFUSALS,
  CATERING_STAFF_PATCH_REFUSALS,
  CATERING_TIMELINE_PATCH_REFUSALS,
  cateringStaffStateIsCoherent,
  cateringStaffTimesAreOrdered,
  mergeCateringAccessWindow,
  nextCateringTimelineState,
  resolveCateringAccessSave,
  resolveCateringMilestoneToggle,
  resolveCateringEquipmentPatch,
  resolveCateringStaffPatch,
  resolveCateringTimelinePatch,
  resolveCateringTimelineReorder,
  type CateringTimelinePersistedState,
} from "./catering-booking-execution-policy";
import {
  CATERING_ACCESS_WINDOW_MESSAGE,
  CATERING_STAFF_TIME_RANGE_MESSAGE,
  CATERING_TIMELINE_TIME_RANGE_MESSAGE,
  cateringTimeRangeIsOrdered,
} from "@shared/catering-booking-execution";

/**
 * The three Codex P2 corrections, and the bug class behind two of them.
 *
 * The intended pipeline for every Phase 2J mutation is:
 *
 *   request validation -> merge with the authoritative persisted state -> validate the MERGED state ->
 *   idempotency/concurrency resolution -> database write -> database CHECK as the final backstop
 *
 * Two of the three findings were the same missing step: a partial PATCH whose own fields are each valid can merge
 * into a state a multi-column CHECK forbids, and the constraint -- not the validator -- was the thing saying no,
 * which surfaces as a 500 rather than a truthful refusal. The third was an ORDERING mistake: an optimistic-
 * concurrency precondition was consulted before it had been established that the request would change anything at
 * all, which turned an ordinary retry into a conflict.
 */

const NOW = new Date("2026-09-08T12:00:00.000Z");
const VERSION = new Date("2026-09-08T11:00:00.000Z");
const version = VERSION.toISOString();
const stale = new Date("2026-09-08T10:00:00.000Z").toISOString();

/* ================================================================================================================ *
 * FINDING 1 -- an already-satisfied milestone retry must not conflict
 * ================================================================================================================ */

test("F1: the retry that motivated this resolves as already satisfied, not as a conflict", () => {
  // 1. the provider taps "service started"
  const first = resolveCateringMilestoneToggle(undefined, { completed: true }, VERSION);
  assert.equal(first.kind, "create");
  assert.equal(first.kind === "create" && first.completedAt?.getTime(), VERSION.getTime());
  // 2. it commits, and the row's version moves on. 3. the response is lost.
  const persisted = { completedAt: VERSION, updatedAt: VERSION };
  // 4. the phone retries with the version it still holds -- which is now stale precisely BECAUSE the first attempt
  //    succeeded. That is not a stale write to protect against; it is a retry of a write that already happened.
  const retry = resolveCateringMilestoneToggle(persisted, { completed: true, expectedUpdatedAt: stale }, NOW);
  assert.deepEqual(retry, { kind: "unchanged" });
});

test("F1: an already-satisfied retry resolves in BOTH directions", () => {
  // incomplete -> complete, retried against a stale version
  assert.deepEqual(resolveCateringMilestoneToggle({ completedAt: VERSION, updatedAt: VERSION }, { completed: true, expectedUpdatedAt: stale }, NOW), { kind: "unchanged" });
  // complete -> incomplete, retried against a stale version
  assert.deepEqual(resolveCateringMilestoneToggle({ completedAt: null, updatedAt: VERSION }, { completed: false, expectedUpdatedAt: stale }, NOW), { kind: "unchanged" });
  // And with no version at all, which is what a client that has never seen the row sends.
  assert.deepEqual(resolveCateringMilestoneToggle({ completedAt: VERSION, updatedAt: VERSION }, { completed: true }, NOW), { kind: "unchanged" });
  assert.deepEqual(resolveCateringMilestoneToggle({ completedAt: null, updatedAt: VERSION }, { completed: false }, NOW), { kind: "unchanged" });
});

test("F1: an identical retry preserves the original completion metadata", () => {
  const retry = resolveCateringMilestoneToggle({ completedAt: VERSION, updatedAt: VERSION }, { completed: true, expectedUpdatedAt: stale }, NOW);
  // "unchanged" carries NO next state at all, so the route has nothing to write: the original `completedAt`, the
  // original `completedBy` and the original `updatedAt` all survive untouched. A resolution that carried a fresh
  // `completedAt` would silently re-stamp the completion instant to the moment of the retry.
  assert.deepEqual(Object.keys(retry), ["kind"]);
  assert.equal("completedAt" in retry, false);
  assert.equal("updatedAt" in retry, false);
});

test("F1: an identical retry produces no second activity row and no notification", () => {
  const retry = resolveCateringMilestoneToggle({ completedAt: VERSION, updatedAt: VERSION }, { completed: true, expectedUpdatedAt: stale }, NOW);
  assert.equal("activity" in retry, false, "nothing to write means no activity row");
  // Milestones never notify in any branch, so there is no notification to duplicate either -- asserted at the route
  // level in catering-booking-execution-idempotency.test.ts.
  assert.equal("notify" in retry, false);
});

test("F1: stale-conflict protection is fully intact where the request WOULD change the state", () => {
  // Another device completed it; this stale request asks to reopen it. That genuinely changes the authoritative
  // state from a base that is no longer current, so it still refuses.
  assert.deepEqual(resolveCateringMilestoneToggle({ completedAt: VERSION, updatedAt: VERSION }, { completed: false, expectedUpdatedAt: stale }, NOW), { kind: "conflict" });
  // And the mirror: another device reopened it, this stale request asks to complete it.
  assert.deepEqual(resolveCateringMilestoneToggle({ completedAt: null, updatedAt: VERSION }, { completed: true, expectedUpdatedAt: stale }, NOW), { kind: "conflict" });
  // A genuine change with no version at all is likewise a conflict: it claims the row does not exist.
  assert.deepEqual(resolveCateringMilestoneToggle({ completedAt: null, updatedAt: VERSION }, { completed: true }, NOW), { kind: "conflict" });
  // A genuine change on the CURRENT version proceeds normally, so this is a precondition, not a blanket refusal.
  const update = resolveCateringMilestoneToggle({ completedAt: null, updatedAt: VERSION }, { completed: true, expectedUpdatedAt: version }, NOW);
  assert.equal(update.kind, "update");
  assert.equal(update.kind === "update" && update.completedAt?.getTime(), NOW.getTime());
  assert.equal(update.kind === "update" && update.activity, true);
});

test("F1: with no row at all, a version precondition still cannot be satisfied", () => {
  // There is no persisted state for the request to have already satisfied, so this stays a conflict rather than
  // being waved through as "already not completed".
  assert.deepEqual(resolveCateringMilestoneToggle(undefined, { completed: false, expectedUpdatedAt: version }, NOW), { kind: "conflict" });
  assert.deepEqual(resolveCateringMilestoneToggle(undefined, { completed: true, expectedUpdatedAt: version }, NOW), { kind: "conflict" });
  // A first touch with no version creates the row in either direction.
  assert.equal(resolveCateringMilestoneToggle(undefined, { completed: false }, NOW).kind, "create");
  assert.equal(resolveCateringMilestoneToggle(undefined, { completed: true }, NOW).kind, "create");
});

test("F1: repeated retries stay idempotent no matter how many arrive", () => {
  const persisted = { completedAt: VERSION, updatedAt: VERSION };
  for (const attempt of [stale, version, NOW.toISOString(), undefined]) {
    assert.deepEqual(resolveCateringMilestoneToggle(persisted, { completed: true, expectedUpdatedAt: attempt }, NOW), { kind: "unchanged" }, String(attempt));
  }
});

/* ================================================================================================================ *
 * FINDING 2 -- a timeline PATCH must validate the MERGED time range
 * ================================================================================================================ */

const item = (over: Partial<CateringTimelinePersistedState> = {}): CateringTimelinePersistedState & { updatedAt: Date; completedAt: Date | null } => ({
  title: "Setup", description: null, category: "setup",
  scheduledTime: "09:00", endTime: "10:00",
  visibility: "provider_private", isBlocker: false, completed: false,
  updatedAt: VERSION, completedAt: null, ...over,
});
const patch = (fields: Partial<CateringTimelinePersistedState>) => resolveCateringTimelinePatch(item(), { ...fields, expectedUpdatedAt: version }, NOW);

test("F2: the exact reported case -- moving 09:00-10:00's start to 11:00 -- is a validation refusal", () => {
  // The request's own field is perfectly valid; only the MERGED state is not. Before the fix this reached SQL and
  // the CHECK produced a 500.
  const outcome = patch({ scheduledTime: "11:00" });
  assert.deepEqual(outcome, { kind: "invalid_time_range" });
  assert.equal("next" in outcome, false, "nothing to write");
  assert.equal("activity" in outcome, false);
  assert.equal("notify" in outcome, false);
});

test("F2: a valid start-only change succeeds", () => {
  const outcome = patch({ scheduledTime: "09:30" });
  assert.equal(outcome.kind, "update");
  assert.equal(outcome.kind === "update" && outcome.next.scheduledTime, "09:30");
  assert.equal(outcome.kind === "update" && outcome.next.endTime, "10:00", "the omitted end inherits the persisted value");
});

test("F2: a valid end-only change succeeds, and an invalid one is refused", () => {
  assert.equal(patch({ endTime: "11:00" }).kind, "update");
  assert.equal(patch({ endTime: "10:00" }).kind, "unchanged", "the same value is not a change");
  assert.deepEqual(patch({ endTime: "08:00" }), { kind: "invalid_time_range" });
});

test("F2: a two-field change is judged as a whole, valid or not", () => {
  const valid = patch({ scheduledTime: "14:00", endTime: "16:00" });
  assert.equal(valid.kind, "update");
  assert.equal(valid.kind === "update" && valid.next.scheduledTime, "14:00");
  assert.equal(valid.kind === "update" && valid.next.endTime, "16:00");
  assert.deepEqual(patch({ scheduledTime: "16:00", endTime: "14:00" }), { kind: "invalid_time_range" });
  // Equal ends are a zero-length window, not an inverted one.
  assert.equal(patch({ scheduledTime: "12:00", endTime: "12:00" }).kind, "update");
});

test("F2: clearing either side is still permitted, and cannot be invalid", () => {
  // Clearing one end of a range is a real edit, so it must not be caught by the new validation.
  const clearedStart = patch({ scheduledTime: null });
  assert.equal(clearedStart.kind, "update");
  assert.equal(clearedStart.kind === "update" && clearedStart.next.scheduledTime, null);
  assert.equal(clearedStart.kind === "update" && clearedStart.next.endTime, "10:00");
  const clearedEnd = patch({ endTime: null });
  assert.equal(clearedEnd.kind, "update");
  assert.equal(clearedEnd.kind === "update" && clearedEnd.next.endTime, null);
  // Clearing one side and moving the other past where it used to be is fine, because the range no longer exists.
  assert.equal(patch({ scheduledTime: "23:00", endTime: null }).kind, "update");
  assert.equal(patch({ endTime: "01:00", scheduledTime: null }).kind, "update");
  // And an item with no times at all accepts either side alone.
  const open = resolveCateringTimelinePatch(item({ scheduledTime: null, endTime: null }), { scheduledTime: "23:00", expectedUpdatedAt: version }, NOW);
  assert.equal(open.kind, "update");
});

test("F2: an invalid merged state never reaches the write path", () => {
  // The resolution carries no `next`, no `completedAt` and no `updatedAt`, so the route has nothing to UPDATE with.
  for (const fields of [{ scheduledTime: "11:00" }, { endTime: "08:00" }, { scheduledTime: "16:00", endTime: "14:00" }]) {
    assert.deepEqual(patch(fields), { kind: "invalid_time_range" }, JSON.stringify(fields));
  }
  // The merge itself is what produces the invalid state, which is why it must be computed before validating.
  assert.equal(nextCateringTimelineState(item(), { scheduledTime: "11:00" }).endTime, "10:00");
  assert.equal(cateringTimeRangeIsOrdered("11:00", "10:00"), false);
});

test("F2: an invalid merged range is reported as such, whatever version the request holds", () => {
  // The merged state is validated before the version precondition is consulted, so a request that could never be
  // written is told what is actually wrong with it rather than being sent to reload first. The range it merges into
  // is computed from the authoritative row either way.
  assert.deepEqual(resolveCateringTimelinePatch(item(), { scheduledTime: "11:00", expectedUpdatedAt: stale }, NOW), { kind: "invalid_time_range" });
  // A stale request whose merged range is FINE and which would genuinely change the row is still a conflict -- see
  // the F5 suite below, which owns that ordering.
  assert.deepEqual(resolveCateringTimelinePatch(item(), { title: "Renamed", expectedUpdatedAt: stale }, NOW), { kind: "conflict" });
});

/* ================================================================================================================ *
 * FINDING 5 -- an already-satisfied timeline PATCH retry must not conflict either
 * ================================================================================================================ */

test("F5: the retry that motivated this -- successful PATCH, lost response, exact resend", () => {
  // The provider renames an item. The server commits it and bumps the version.
  const before = item({ title: "Setup" });
  const applied = resolveCateringTimelinePatch(before, { title: "Setup crew", expectedUpdatedAt: version }, NOW);
  assert.equal(applied.kind, "update");
  // The response is lost. The row now holds the new title at a new version; the phone still holds the old one.
  const persisted = item({ title: "Setup crew" });
  const retry = resolveCateringTimelinePatch({ ...persisted, updatedAt: NOW }, { title: "Setup crew", expectedUpdatedAt: version }, NOW);
  // Every requested value is already what the row holds, so there is nothing to write and nothing to protect.
  assert.deepEqual(retry, { kind: "unchanged" });
});

test("F5: the required invariant, both halves", () => {
  const current = item({ title: "Setup", scheduledTime: "09:00", endTime: "10:00" });
  // Stale version + requested state already equals authoritative state -> unchanged.
  assert.deepEqual(resolveCateringTimelinePatch(current, { title: "Setup", expectedUpdatedAt: stale }, NOW), { kind: "unchanged" });
  assert.deepEqual(resolveCateringTimelinePatch(current, { scheduledTime: "09:00", endTime: "10:00", expectedUpdatedAt: stale }, NOW), { kind: "unchanged" });
  assert.deepEqual(resolveCateringTimelinePatch(current, { completed: false, isBlocker: false, expectedUpdatedAt: stale }, NOW), { kind: "unchanged" });
  // Stale version + requested state DIFFERS from authoritative state -> conflict.
  assert.deepEqual(resolveCateringTimelinePatch(current, { title: "Something else", expectedUpdatedAt: stale }, NOW), { kind: "conflict" });
  assert.deepEqual(resolveCateringTimelinePatch(current, { completed: true, expectedUpdatedAt: stale }, NOW), { kind: "conflict" });
  assert.deepEqual(resolveCateringTimelinePatch(current, { visibility: "shared", expectedUpdatedAt: stale }, NOW), { kind: "conflict" });
});

test("F5: an unchanged retry writes no activity and no notification", () => {
  // A shared item is the case that would duplicate customer-visible history if this were mishandled.
  const shared = item({ visibility: "shared", title: "Guests arrive" });
  const retry = resolveCateringTimelinePatch(shared, { title: "Guests arrive", visibility: "shared", expectedUpdatedAt: stale }, NOW);
  assert.deepEqual(retry, { kind: "unchanged" });
  assert.equal("activity" in retry, false);
  assert.equal("notify" in retry, false);
  assert.equal("next" in retry, false, "and no next state, so no version bump and no completedAt re-stamp");
});

test("F5: a completion retry does not re-stamp the original completion instant", () => {
  const completedAt = new Date("2026-09-08T11:30:00.000Z");
  const done = { ...item({ visibility: "shared" }), completed: true, completedAt, updatedAt: VERSION };
  // The completion committed, the response was lost, the phone resends the same tick with its old version.
  const retry = resolveCateringTimelinePatch(done, { completed: true, expectedUpdatedAt: stale }, NOW);
  assert.deepEqual(retry, { kind: "unchanged" }, "so the route writes nothing and the original instant survives");
});

test("F5: merged time-range validation is preserved and still runs before all of this", () => {
  // An invalid merged range is refused whether or not the request would otherwise have been a no-op.
  assert.deepEqual(resolveCateringTimelinePatch(item(), { scheduledTime: "11:00", expectedUpdatedAt: version }, NOW), { kind: "invalid_time_range" });
  assert.deepEqual(resolveCateringTimelinePatch(item(), { scheduledTime: "11:00", expectedUpdatedAt: stale }, NOW), { kind: "invalid_time_range" });
  // And a valid change on the current version still proceeds normally.
  assert.equal(resolveCateringTimelinePatch(item(), { scheduledTime: "09:30", expectedUpdatedAt: version }, NOW).kind, "update");
});

test("F5: a genuine change on the CURRENT version is unaffected, so this is not a blanket pass", () => {
  const outcome = resolveCateringTimelinePatch(item(), { title: "Renamed", expectedUpdatedAt: version }, NOW);
  assert.equal(outcome.kind, "update");
  assert.equal(outcome.kind === "update" && outcome.updatedAt.getTime(), NOW.getTime());
  // A missing or malformed precondition on a genuinely-changing request still fails closed.
  assert.equal(resolveCateringTimelinePatch(item(), { title: "Renamed", expectedUpdatedAt: "not a date" }, NOW).kind, "conflict");
});

test("F5: the timeline and milestone resolvers now share the same ordering rule", () => {
  // Both answer "already satisfied" before consulting a version, and both keep the precondition for real writes.
  assert.deepEqual(resolveCateringMilestoneToggle({ completedAt: VERSION, updatedAt: VERSION }, { completed: true, expectedUpdatedAt: stale }, NOW), { kind: "unchanged" });
  assert.deepEqual(resolveCateringTimelinePatch(item(), { title: "Setup", expectedUpdatedAt: stale }, NOW), { kind: "unchanged" });
  assert.deepEqual(resolveCateringMilestoneToggle({ completedAt: null, updatedAt: VERSION }, { completed: true, expectedUpdatedAt: stale }, NOW), { kind: "conflict" });
  assert.deepEqual(resolveCateringTimelinePatch(item(), { title: "Other", expectedUpdatedAt: stale }, NOW), { kind: "conflict" });
});

test("F2: an unrelated field change on an item with a valid range is unaffected", () => {
  const outcome = patch({ title: "Renamed" });
  assert.equal(outcome.kind, "update");
  assert.equal(outcome.kind === "update" && outcome.next.title, "Renamed");
  // Completion, blocker and visibility edits likewise still work.
  assert.equal(patch({ completed: true }).kind, "update");
  assert.equal(patch({ isBlocker: true }).kind, "update");
  assert.equal(patch({ visibility: "shared" }).kind, "update");
});

test("F2: the refusal is worded exactly as the create schema words its own", () => {
  assert.equal(CATERING_TIMELINE_PATCH_REFUSALS.invalid_time_range, CATERING_TIMELINE_TIME_RANGE_MESSAGE);
});

/* ================================================================================================================ *
 * FINDING 3 -- an access save must validate the MERGED window
 * ================================================================================================================ */

const existingAccess = { updatedAt: VERSION, accessWindowStart: "08:00", accessWindowEnd: "09:00", parkingInstructions: "Rear lot" };
const save = (input: Record<string, unknown>) => resolveCateringAccessSave({ existing: existingAccess as never }, { ...input, expectedUpdatedAt: version } as never);

test("F3: existing 08:00-09:00 with start=08:30 succeeds", () => {
  assert.equal(save({ accessWindowStart: "08:30" }).kind, "save");
});

test("F3: existing 08:00-09:00 with start=10:00 is a validation refusal", () => {
  // The exact reported case: the omitted end stays 09:00, so the merged window is 10:00-09:00.
  const outcome = save({ accessWindowStart: "10:00" });
  assert.deepEqual(outcome, { kind: "invalid_time_range" });
  assert.equal("activity" in outcome, false, "nothing is written, so nothing is recorded");
  assert.equal("notify" in outcome, false);
});

test("F3: existing 08:00-09:00 with end=08:30 succeeds, and end=07:00 is refused", () => {
  assert.equal(save({ accessWindowEnd: "08:30" }).kind, "save");
  assert.deepEqual(save({ accessWindowEnd: "07:00" }), { kind: "invalid_time_range" });
});

test("F3: changing both ends is judged as a whole", () => {
  assert.equal(save({ accessWindowStart: "06:00", accessWindowEnd: "23:00" }).kind, "save");
  assert.deepEqual(save({ accessWindowStart: "23:00", accessWindowEnd: "06:00" }), { kind: "invalid_time_range" });
  assert.equal(save({ accessWindowStart: "12:00", accessWindowEnd: "12:00" }).kind, "save");
});

test("F3: an omitted field inherits the persisted value, and an explicit null clears it", () => {
  // Presence, not truthiness, is what decides -- which is the difference between "leave the end alone" and "there
  // is no end any more".
  assert.deepEqual(mergeCateringAccessWindow(existingAccess, { accessWindowStart: "10:00" }), { accessWindowStart: "10:00", accessWindowEnd: "09:00" });
  assert.deepEqual(mergeCateringAccessWindow(existingAccess, { accessWindowEnd: null }), { accessWindowStart: "08:00", accessWindowEnd: null });
  assert.deepEqual(mergeCateringAccessWindow(existingAccess, {}), { accessWindowStart: "08:00", accessWindowEnd: "09:00" });
  assert.deepEqual(mergeCateringAccessWindow(undefined, { accessWindowStart: "08:00" }), { accessWindowStart: "08:00", accessWindowEnd: undefined });
  // So clearing the end makes an otherwise-invalid start valid.
  assert.equal(save({ accessWindowStart: "10:00", accessWindowEnd: null }).kind, "save");
  assert.equal(save({ accessWindowStart: null }).kind, "save");
});

test("F3: a save that touches no window field at all is unaffected", () => {
  const outcome = save({ parkingInstructions: "Three bays" });
  assert.equal(outcome.kind, "save");
  assert.equal(outcome.kind === "save" && outcome.notify, true, "and still notifies for a shared instruction change");
});

test("F3: a CREATE validates its complete prospective state the same way", () => {
  // No persisted side, so the merge is just the request -- and it is validated identically.
  assert.equal(resolveCateringAccessSave({ existing: undefined }, { accessWindowStart: "08:00", accessWindowEnd: "09:00" }).kind, "save");
  assert.deepEqual(resolveCateringAccessSave({ existing: undefined }, { accessWindowStart: "10:00", accessWindowEnd: "09:00" }), { kind: "invalid_time_range" });
  assert.equal(resolveCateringAccessSave({ existing: undefined }, { accessWindowStart: "10:00" }).kind, "save", "one side alone is never a range");
});

test("F3: create/no-record concurrency behaviour is unchanged", () => {
  // A version naming a record that does not exist.
  assert.deepEqual(resolveCateringAccessSave({ existing: undefined }, { parkingInstructions: "x", expectedUpdatedAt: version }), { kind: "conflict" });
  // A record that exists, with no version: two tabs both tried to create it.
  assert.deepEqual(resolveCateringAccessSave({ existing: existingAccess as never }, { parkingInstructions: "x" } as never), { kind: "conflict" });
  // A record that exists, with a stale version.
  assert.deepEqual(resolveCateringAccessSave({ existing: existingAccess as never }, { parkingInstructions: "x", expectedUpdatedAt: stale } as never), { kind: "conflict" });
  // A terminal booking, which the locked read reports as absent.
  assert.deepEqual(resolveCateringAccessSave(null, { accessWindowStart: "10:00" }), { kind: "read_only" });
});

test("F3: the concurrency precondition is still decided before the merged validation", () => {
  // A stale save that is ALSO invalid is reported as a conflict: the client's view is out of date, which is the
  // problem it has to fix first.
  assert.deepEqual(resolveCateringAccessSave({ existing: existingAccess as never }, { accessWindowStart: "10:00", expectedUpdatedAt: stale } as never), { kind: "conflict" });
});

test("F3: the refusal is worded exactly as the save schema words its own", () => {
  assert.equal(CATERING_ACCESS_SAVE_REFUSALS.invalid_time_range, CATERING_ACCESS_WINDOW_MESSAGE);
});

/* ================================================================================================================ *
 * The bug class -- one range rule, and a durable audit of every multi-column invariant
 * ================================================================================================================ */

test("all three ranges are decided by the same shared rule", () => {
  for (const [start, end, expected] of [
    ["09:00", "10:00", true], ["10:00", "09:00", false], ["09:00", "09:00", true],
    [null, "09:00", true], ["09:00", null, true], [null, null, true],
    [undefined, undefined, true],
  ] as [string | null | undefined, string | null | undefined, boolean][]) {
    assert.equal(cateringTimeRangeIsOrdered(start, end), expected, `${start}-${end}`);
  }
  // The staff rule, already correct before this change, now delegates to the same helper rather than restating it.
  assert.equal(cateringStaffTimesAreOrdered({ workerName: "A", role: "chef", customRole: null, contactNote: null, arrivalTime: "10:00", departureTime: "09:00", responsibilityNote: null }), false);
  assert.equal(CATERING_STAFF_PATCH_REFUSALS.invalid_time_range, CATERING_STAFF_TIME_RANGE_MESSAGE);
});

test("the crew merged-state validation that was already correct still is", () => {
  const crew = { workerName: "Ada", role: "chef", customRole: null, contactNote: null, arrivalTime: "07:00", departureTime: "15:00", responsibilityNote: null, updatedAt: VERSION };
  // Arrival pushed past the persisted departure -- the same bug class, and it was already caught here.
  assert.equal(resolveCateringStaffPatch(crew, { arrivalTime: "16:00", expectedUpdatedAt: version }, NOW).kind, "invalid_time_range");
  assert.equal(resolveCateringStaffPatch(crew, { departureTime: "06:00", expectedUpdatedAt: version }, NOW).kind, "invalid_time_range");
  // And the role/label pairing, likewise judged on the merged row.
  assert.equal(resolveCateringStaffPatch(crew, { role: "custom", expectedUpdatedAt: version }, NOW).kind, "invalid_role");
  assert.equal(cateringStaffStateIsCoherent({ workerName: "A", role: "custom", customRole: null, contactNote: null, arrivalTime: null, departureTime: null, responsibilityNote: null }), false);
});

/**
 * Every multi-column CHECK in the Phase 2J migration, and how a partial update is stopped from violating it.
 *
 * This is the durable form of the sibling audit. A CHECK that spans two columns is exactly the shape a partial
 * PATCH can invalidate, so each one has to be accounted for -- and a NEW one added later fails this test until it
 * is, rather than silently reintroducing the same 500.
 */
const MULTI_COLUMN_INVARIANTS: Record<string, string> = {
  // Finding 2: validated on the merged state by resolveCateringTimelinePatch.
  catering_execution_timeline_time_range_check: "merged-state validation",
  // Finding 3: validated on the merged state by resolveCateringAccessSave.
  catering_execution_access_window_range_check: "merged-state validation",
  // Already validated on the merged state before this change, by resolveCateringStaffPatch.
  catering_execution_staff_time_range_check: "merged-state validation",
  catering_execution_staff_custom_role_check: "merged-state validation",
  // Not reachable by a partial update: both columns are derived together from one resolved outcome, and no client
  // field addresses either of them directly -- a request only ever asserts `completed`.
  catering_execution_timeline_completed_by_check: "written atomically from one resolution",
  catering_execution_milestone_completed_by_check: "written atomically from one resolution",
};

test("every multi-column CHECK in this phase is accounted for by the audit", () => {
  const migration = fs.readFileSync(path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "migrations", "20260906_catering_booking_execution.sql"), "utf8");
  const found: string[] = [];
  for (const block of migration.split("CREATE TABLE IF NOT EXISTS ").slice(1)) {
    const body = block.slice(0, block.indexOf("\n);"));
    // The columns this table declares, so an identifier in a CHECK can be told from a SQL keyword.
    const columns = Array.from(body.matchAll(/^ {2}([a-z_]+) (?:varchar|text|integer|boolean|timestamptz|date|uuid|bigint)/gm)).map((match) => match[1]);
    // The terminator is a lookahead including end-of-input, because the LAST constraint in a table carries no
    // trailing comma -- and four of the six multi-column invariants are exactly that, so a parser that missed them
    // would have reported an audit that was clean only because it could not see them.
    for (const check of body.matchAll(/CONSTRAINT ([a-z_]+) CHECK \(([\s\S]*?)\)(?=,|\n|$)/g)) {
      const [, name, clause] = check;
      const referenced = new Set(columns.filter((column) => new RegExp(`\\b${column}\\b`).test(clause)));
      if (referenced.size >= 2) found.push(name);
    }
  }
  assert.equal(found.length > 0, true, "the parser really did find constraints");
  // Exactly the audited set: nothing unaccounted for, and nothing listed here that no longer exists.
  assert.deepEqual(found.sort(), Object.keys(MULTI_COLUMN_INVARIANTS).sort());
});

test("equipment has no cross-field invariant, so its partial updates cannot violate one", () => {
  const migration = fs.readFileSync(path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "migrations", "20260906_catering_booking_execution.sql"), "utf8");
  const block = migration.slice(migration.indexOf("CREATE TABLE IF NOT EXISTS catering_booking_equipment ("));
  const body = block.slice(0, block.indexOf("\n);"));
  // The pickup and return columns are each format-checked ALONE; there is deliberately no ordering rule between
  // them, because a rental collected the day before and returned the day after is a real shape and this phase does
  // not invent a policy about it. So an equipment PATCH has no merged invariant to validate -- and if one is ever
  // added, the audit test above fails until the merge validation is added with it.
  assert.equal(/pickup_(date|time)[^\n]*return_|return_[^\n]*pickup_/.test(body), false);
  assert.equal(body.includes("catering_execution_equipment_pickup_time_check"), true);
  assert.equal(body.includes("catering_execution_equipment_return_time_check"), true);
});

/* ================================================================================================================ *
 * Route wiring -- the refusals reach the client as validation failures, not constraint violations
 * ================================================================================================================ */

const route = fs.readFileSync(path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "routes", "catering-booking-execution.ts"), "utf8");

test("both merged-state refusals answer 400 from inside the handler, before any write", () => {
  assert.equal(route.includes('if (result.kind === "invalid_time_range") return res.status(400).json({ message: CATERING_TIMELINE_PATCH_REFUSALS.invalid_time_range });'), true);
  assert.equal(route.includes('if (result.kind === "invalid_time_range") return res.status(400).json({ message: CATERING_ACCESS_SAVE_REFUSALS.invalid_time_range });'), true);
  // The transaction returns the refusal instead of proceeding, so no UPDATE or upsert is issued.
  assert.equal(route.includes('if (outcome.kind === "invalid_time_range") return { kind: "invalid_time_range" } as const;'), true);
  assert.equal(route.includes('if (outcome.kind !== "save") return outcome;'), true);
});

test("the database CHECKs remain in place as the final backstop", () => {
  const migration = fs.readFileSync(path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "migrations", "20260906_catering_booking_execution.sql"), "utf8");
  for (const constraint of Object.keys(MULTI_COLUMN_INVARIANTS)) {
    assert.equal(migration.includes(constraint), true, `${constraint} must not be removed`);
  }
  // Nothing in this correction drops a constraint.
  assert.equal(/DROP CONSTRAINT IF EXISTS catering_execution/.test(migration), false);
});

test("the access save still resolves against the row loaded inside the transaction", () => {
  const handler = route.slice(route.indexOf('r.put("/bookings/:id/execution/access"'), route.indexOf('r.put("/bookings/:id/execution/milestones/:key"'));
  assert.equal(handler.includes("lockActiveCateringBooking(tx, id)"), true, "terminal bookings still cannot mutate");
  assert.equal(handler.includes('lockCollection(tx, "access", id)'), true);
  assert.equal(handler.indexOf("tx.select().from(cateringBookingAccessDetails)") < handler.indexOf("resolveCateringAccessSave("), true);
  assert.equal(handler.indexOf("resolveCateringAccessSave(") < handler.indexOf("tx.insert(cateringBookingAccessDetails)"), true);
  // And it is still provider-only: the shared resolver runs the guard before the transaction opens.
  assert.equal(handler.includes("resolveExecutionRequest(req as never, res, true)"), true);
});


/* ================================================================================================================ *
 * NARROW AUDIT -- the same ordering rule, applied everywhere it belongs
 * ================================================================================================================ */

test("AUDIT: a crew PATCH retry is already-satisfied, not a conflict", () => {
  const crew = { workerName: "Ada", role: "chef", customRole: null, contactNote: null, arrivalTime: "07:00", departureTime: "15:00", responsibilityNote: null, updatedAt: VERSION };
  // The rename committed, the response was lost, the phone resends the same body with its pre-commit version.
  assert.deepEqual(resolveCateringStaffPatch(crew, { workerName: "Ada", expectedUpdatedAt: stale }, NOW), { kind: "unchanged" });
  // A request that would genuinely change the row still refuses on a stale version.
  assert.deepEqual(resolveCateringStaffPatch(crew, { workerName: "Grace", expectedUpdatedAt: stale }, NOW), { kind: "conflict" });
  // And validation still runs on the merged state before any of it.
  assert.equal(resolveCateringStaffPatch(crew, { arrivalTime: "16:00", expectedUpdatedAt: stale }, NOW).kind, "invalid_time_range");
});

test("AUDIT: an equipment status retry is already-satisfied, not a conflict", () => {
  const equipment = {
    name: "Chafer", quantity: 6, sourceType: "rental", sourceName: null,
    pickupDate: null, pickupTime: null, returnDate: null, returnTime: null,
    status: "received", isBlocker: false, notes: null, visibility: "shared", updatedAt: VERSION,
  };
  // Tapping "received" twice on a bad connection must not produce a conflict or a second activity row.
  const retry = resolveCateringEquipmentPatch(equipment, { status: "received", expectedUpdatedAt: stale }, NOW);
  assert.deepEqual(retry, { kind: "unchanged" });
  assert.equal("activity" in retry, false);
  // A real transition on a stale version still refuses.
  assert.deepEqual(resolveCateringEquipmentPatch(equipment, { status: "returned", expectedUpdatedAt: stale }, NOW), { kind: "conflict" });
});

test("AUDIT: a reorder that is already applied is a no-op retry, not a conflict", () => {
  const ordered = [
    { id: "a", updatedAt: NOW, sortOrder: 0 },
    { id: "b", updatedAt: NOW, sortOrder: 1 },
    { id: "c", updatedAt: NOW, sortOrder: 2 },
  ];
  const entry = (id: string) => ({ id, expectedUpdatedAt: stale });
  // The drag committed and bumped every version; the retry necessarily carries the old ones. The collection is
  // already in exactly the requested order, so the request would move nothing.
  assert.deepEqual(resolveCateringTimelineReorder(ordered, [entry("a"), entry("b"), entry("c")]), { kind: "unchanged" });
  // A genuinely different order on stale versions is still a conflict.
  assert.deepEqual(resolveCateringTimelineReorder(ordered, [entry("c"), entry("b"), entry("a")]), { kind: "conflict" });
  // Membership is still decided before any of this.
  assert.equal(resolveCateringTimelineReorder(ordered, [entry("a"), entry("b")]).kind, "membership");
});

test("AUDIT: an access save that changes nothing writes nothing", () => {
  const persisted = { updatedAt: VERSION, parkingInstructions: "Rear lot", accessConfirmed: true, providerPrivateNotes: "private" };
  // Every field is already what the record holds -- the retry after a lost response, and also an ordinary re-save.
  assert.deepEqual(resolveCateringAccessSave({ existing: persisted as never }, { parkingInstructions: "Rear lot", accessConfirmed: true, providerPrivateNotes: "private", expectedUpdatedAt: stale } as never), { kind: "unchanged" });
  // A private-only change is still a change, so it is not swallowed by the shared-field comparison.
  assert.equal(resolveCateringAccessSave({ existing: persisted as never }, { providerPrivateNotes: "different", expectedUpdatedAt: version } as never).kind, "save");
  assert.deepEqual(resolveCateringAccessSave({ existing: persisted as never }, { providerPrivateNotes: "different", expectedUpdatedAt: stale } as never), { kind: "conflict" });
  // A create is unaffected: there is no persisted state for it to have already satisfied.
  assert.equal(resolveCateringAccessSave({ existing: undefined }, { parkingInstructions: "Rear lot" }).kind, "save");
});

test("AUDIT: every resolver now answers an exact retry the same way", () => {
  // One rule, six places: milestone, timeline PATCH, crew PATCH, equipment PATCH, reorder, access save.
  const crew = { workerName: "Ada", role: "chef", customRole: null, contactNote: null, arrivalTime: null, departureTime: null, responsibilityNote: null, updatedAt: VERSION };
  const equipment = { name: "Chafer", quantity: 1, sourceType: "rental", sourceName: null, pickupDate: null, pickupTime: null, returnDate: null, returnTime: null, status: "planned", isBlocker: false, notes: null, visibility: "shared", updatedAt: VERSION };
  const ordered = [{ id: "a", updatedAt: NOW, sortOrder: 0 }];
  assert.equal(resolveCateringMilestoneToggle({ completedAt: VERSION, updatedAt: VERSION }, { completed: true, expectedUpdatedAt: stale }, NOW).kind, "unchanged");
  assert.equal(resolveCateringTimelinePatch(item(), { title: "Setup", expectedUpdatedAt: stale }, NOW).kind, "unchanged");
  assert.equal(resolveCateringStaffPatch(crew, { workerName: "Ada", expectedUpdatedAt: stale }, NOW).kind, "unchanged");
  assert.equal(resolveCateringEquipmentPatch(equipment, { status: "planned", expectedUpdatedAt: stale }, NOW).kind, "unchanged");
  assert.equal(resolveCateringTimelineReorder(ordered, [{ id: "a", expectedUpdatedAt: stale }]).kind, "unchanged");
  assert.equal(resolveCateringAccessSave({ existing: { updatedAt: VERSION, accessConfirmed: false } as never }, { accessConfirmed: false, expectedUpdatedAt: stale } as never).kind, "unchanged");
});
