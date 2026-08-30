import assert from "node:assert/strict";
import test from "node:test";
import { CATERING_TASK_PATCH_FIELDS, cateringDetailsActivityVisibility, cateringTaskPersistedChanges, cateringTaskUpdateOutcome, cateringTaskVersionMatches, mayMutateWorkspace, nextCateringTaskCompletedAt, nextCateringTaskSortOrder, nextCateringTaskState, resolveCateringTaskPatch, sharedTaskUpdateActivity, type CateringTaskVersionedState } from "./catering-booking-workspace-policy";

test("provider can prepare pending and confirmed operational state", () => { for (const status of ["pending_confirmation", "confirmed"] as const) { assert.equal(mayMutateWorkspace(status, "provider", "provider-details"), true); assert.equal(mayMutateWorkspace(status, "provider", "tasks"), true); } });
test("customer can edit only explicitly customer-owned notes", () => { assert.equal(mayMutateWorkspace("confirmed", "customer", "customer-notes"), true); assert.equal(mayMutateWorkspace("confirmed", "customer", "provider-details"), false); assert.equal(mayMutateWorkspace("confirmed", "customer", "tasks"), false); });
test("every cancelled workspace mutation is rejected", () => { for (const role of ["provider", "customer"] as const) for (const resource of ["provider-details", "customer-notes", "tasks"] as const) assert.equal(mayMutateWorkspace("cancelled", role, resource), false); });
test("every completed workspace mutation is rejected", () => { for (const role of ["provider", "customer"] as const) for (const resource of ["provider-details", "customer-notes", "tasks"] as const) assert.equal(mayMutateWorkspace("completed", role, resource), false); });
test("task append order starts at zero and advances past the maximum after gaps", () => {
  assert.equal(nextCateringTaskSortOrder(null), 0);
  assert.equal(nextCateringTaskSortOrder(0), 1);
  assert.equal(nextCateringTaskSortOrder(2), 3);
  const afterFirstDeleted = [1, 2]; const appended = nextCateringTaskSortOrder(Math.max(...afterFirstDeleted));
  assert.equal(appended, 3); assert.equal(new Set([...afterFirstDeleted, appended]).size, 3);
  const afterMiddleDeleted = [0, 2, 3]; const next = nextCateringTaskSortOrder(Math.max(...afterMiddleDeleted));
  assert.equal(next, 4); assert.deepEqual([...afterMiddleDeleted, next].sort((a, b) => a - b), [0, 2, 3, 4]);
});
test("shared task activity derives from current locked state", () => {
  assert.deepEqual(sharedTaskUpdateActivity({ title: "Current", visibility: "shared", status: "pending" }, { title: "Updated" }), { eventType: "shared_requirement_updated", taskTitle: "Updated" });
  assert.deepEqual(sharedTaskUpdateActivity({ title: "Current", visibility: "shared", status: "pending" }, { status: "completed" }), { eventType: "shared_requirement_completed", taskTitle: "Current" });
});
test("shared to private task updates produce no shared activity", () => assert.equal(sharedTaskUpdateActivity({ title: "Private title", visibility: "shared", status: "pending" }, { visibility: "provider" }), null));
test("full provider draft with only changed private notes creates provider activity", () => { const existing = { venueName: "Hall", kitchenAvailable: false, providerNotes: "Old" }; const input = { venueName: "Hall", kitchenAvailable: false, providerNotes: "New secret" }; assert.equal(cateringDetailsActivityVisibility(existing, input, "provider"), "provider"); });
test("actual shared changes take precedence without exposing private values", () => { assert.equal(cateringDetailsActivityVisibility({ venueName: "Old", providerNotes: "Old secret" }, { venueName: "New", providerNotes: "New secret" }, "provider"), "shared"); });
test("identical provider and customer detail saves create no activity", () => { assert.equal(cateringDetailsActivityVisibility({ venueName: "Hall", providerNotes: "Secret" }, { venueName: "Hall", providerNotes: "Secret" }, "provider"), null); assert.equal(cateringDetailsActivityVisibility({ customerNotes: "Note" }, { customerNotes: "Note" }, "customer"), null); });
test("boolean and null shared transitions are detected exactly", () => { assert.equal(cateringDetailsActivityVisibility({ powerAvailable: false }, { powerAvailable: true }, "provider"), "shared"); assert.equal(cateringDetailsActivityVisibility({ powerAvailable: true }, { powerAvailable: false }, "provider"), "shared"); assert.equal(cateringDetailsActivityVisibility({ venueName: null }, { venueName: "Hall" }, "provider"), "shared"); assert.equal(cateringDetailsActivityVisibility({ venueName: "Hall" }, { venueName: null }, "provider"), "shared"); });

const sharedTask = { title: "Send allergy list", description: "Include every guest", dueDate: "2026-09-15", dueTime: "17:30", visibility: "shared", status: "pending", completedAt: null } as const;
const privateTask = { ...sharedTask, visibility: "provider" } as const;
const fullPatch = { title: sharedTask.title, description: sharedTask.description, dueDate: sharedTask.dueDate, dueTime: sharedTask.dueTime, visibility: sharedTask.visibility };

test("an identical full shared task patch persists nothing and records no activity", () => {
  const outcome = cateringTaskUpdateOutcome(sharedTask, fullPatch);
  assert.deepEqual(outcome.changedFields, []);
  assert.equal(outcome.changed, false);
  assert.equal(outcome.activity, null);
});
test("each individually identical shared task field is not a change", () => {
  for (const patch of [{ title: sharedTask.title }, { description: sharedTask.description }, { dueDate: sharedTask.dueDate }, { dueTime: sharedTask.dueTime }, { visibility: "shared" as const }, { status: "pending" as const }]) {
    const outcome = cateringTaskUpdateOutcome(sharedTask, patch);
    assert.deepEqual(outcome.changedFields, []);
    assert.equal(outcome.activity, null);
  }
});
test("an identical null description is not a change and an added description is", () => {
  const withoutDescription = { ...sharedTask, description: null };
  assert.equal(cateringTaskUpdateOutcome(withoutDescription, { description: null }).changed, false);
  assert.equal(cateringTaskUpdateOutcome(withoutDescription, { description: "New detail" }).changed, true);
  assert.equal(cateringTaskUpdateOutcome(sharedTask, { description: null }).changed, true);
});
test("identical null deadlines are not a change", () => {
  const undated = { ...sharedTask, dueDate: null, dueTime: null };
  assert.equal(cateringTaskUpdateOutcome(undated, { dueDate: null, dueTime: null }).changed, false);
  assert.equal(cateringTaskUpdateOutcome(undated, { dueDate: "2026-09-15" }).changed, true);
});
test("real shared task changes record a shared requirement update", () => {
  for (const patch of [{ title: "Send updated allergy list" }, { description: "Include dietary notes" }, { dueDate: "2026-09-20" }, { dueTime: "18:00" }]) {
    const outcome = cateringTaskUpdateOutcome(sharedTask, { ...fullPatch, ...patch });
    assert.equal(outcome.changed, true);
    assert.equal(outcome.activity?.eventType, "shared_requirement_updated");
  }
  assert.equal(cateringTaskUpdateOutcome(sharedTask, { title: "Renamed" }).activity?.taskTitle, "Renamed");
});
test("a real shared pending to completed transition records completion once", () => {
  assert.equal(cateringTaskUpdateOutcome(sharedTask, { status: "completed" }).activity?.eventType, "shared_requirement_completed");
  const alreadyCompleted = { ...sharedTask, status: "completed" } as const;
  assert.equal(cateringTaskUpdateOutcome(alreadyCompleted, { status: "completed" }).activity, null);
  assert.equal(cateringTaskUpdateOutcome(alreadyCompleted, { status: "pending" }).activity?.eventType, "shared_requirement_updated");
});
test("provider-private task patches never write customer-visible history", () => {
  assert.equal(cateringTaskUpdateOutcome(privateTask, { ...fullPatch, visibility: "provider" }).changed, false);
  assert.equal(cateringTaskUpdateOutcome(privateTask, { title: "Renamed privately" }).activity, null);
  assert.equal(cateringTaskUpdateOutcome(privateTask, { status: "completed" }).activity, null);
});
test("hiding a shared task keeps its content out of customer-visible history", () => {
  const hidden = cateringTaskUpdateOutcome(sharedTask, { visibility: "provider", title: "Private staffing note" });
  assert.equal(hidden.changed, true);
  assert.equal(hidden.activity, null);
});
test("sharing a private task keeps the existing shared update semantics", () => {
  const shared = cateringTaskUpdateOutcome(privateTask, { visibility: "shared" });
  assert.equal(shared.changed, true);
  assert.deepEqual(shared.activity, { eventType: "shared_requirement_updated", taskTitle: privateTask.title });
});
test("the persisted patch state keeps unsupplied fields and applies supplied ones", () => {
  const next = nextCateringTaskState(sharedTask, { title: "Renamed", dueTime: null });
  assert.deepEqual(next, { title: "Renamed", visibility: "shared", status: "pending", description: "Include every guest", dueDate: "2026-09-15", dueTime: null });
  assert.deepEqual(cateringTaskPersistedChanges(sharedTask, next).sort(), ["dueTime", "title"]);
  assert.deepEqual(CATERING_TASK_PATCH_FIELDS.slice().sort(), ["description", "dueDate", "dueTime", "status", "title", "visibility"]);
});
test("completion timestamps move only on a real status transition", () => {
  const now = new Date("2026-09-15T18:00:00Z"); const earlier = new Date("2026-09-01T10:00:00Z");
  assert.equal(nextCateringTaskCompletedAt({ status: "completed", completedAt: earlier }, "completed", now), earlier);
  assert.equal(nextCateringTaskCompletedAt({ status: "pending", completedAt: null }, "pending", now), null);
  assert.equal(nextCateringTaskCompletedAt({ status: "pending", completedAt: null }, "completed", now), now);
  assert.equal(nextCateringTaskCompletedAt({ status: "completed", completedAt: earlier }, "pending", now), null);
});

const T1 = new Date("2026-08-29T00:00:00.000Z");
const T2 = new Date("2026-08-30T09:15:00.000Z");
const NOW = new Date("2026-08-30T18:00:00.000Z");
const lockedTask = (overrides: Partial<CateringTaskVersionedState> = {}): CateringTaskVersionedState => ({ title: "Confirm rentals", description: "Call supplier", dueDate: "2026-09-15", dueTime: "17:30", visibility: "shared", status: "pending", completedAt: null, updatedAt: T1, ...overrides });
/** Mirrors exactly what the PATCH route writes: nothing at all unless the resolution is an update. */
const applyResolution = (row: CateringTaskVersionedState, resolution: ReturnType<typeof resolveCateringTaskPatch>): CateringTaskVersionedState => resolution.kind === "update" ? { ...row, ...resolution.next, completedAt: resolution.completedAt, updatedAt: resolution.updatedAt } : row;

test("the task version precondition compares the instant, not its spelling", () => {
  assert.equal(cateringTaskVersionMatches({ updatedAt: T1 }, "2026-08-29T00:00:00.000Z"), true);
  assert.equal(cateringTaskVersionMatches({ updatedAt: T1 }, "2026-08-29T00:00:00Z"), true);
  assert.equal(cateringTaskVersionMatches({ updatedAt: T1 }, T2.toISOString()), false);
  assert.equal(cateringTaskVersionMatches({ updatedAt: T1 }, "2026-08-29T00:00:00.001Z"), false);
  for (const invalid of ["", "not-a-timestamp"]) assert.equal(cateringTaskVersionMatches({ updatedAt: T1 }, invalid), false);
});
test("a matching precondition lets a real task change persist", () => {
  const resolution = resolveCateringTaskPatch(lockedTask(), { title: "Confirm rentals and staffing", expectedUpdatedAt: T1.toISOString() }, NOW);
  assert.equal(resolution.kind, "update");
  const applied = applyResolution(lockedTask(), resolution);
  assert.equal(applied.title, "Confirm rentals and staffing");
  assert.equal(applied.updatedAt, NOW);
  assert.deepEqual(resolution.kind === "update" ? resolution.activity : null, { eventType: "shared_requirement_updated", taskTitle: "Confirm rentals and staffing" });
});
test("a stale precondition conflicts and writes nothing at all", () => {
  const current = lockedTask({ updatedAt: T2, status: "completed", completedAt: T2 });
  const stale = { title: "Stale title", description: "Stale description", dueDate: "2026-01-01", dueTime: "08:15", visibility: "provider" as const, status: "pending" as const, expectedUpdatedAt: T1.toISOString() };
  const resolution = resolveCateringTaskPatch(current, stale, NOW);
  assert.deepEqual(resolution, { kind: "conflict" });
  assert.equal("next" in resolution, false);
  assert.equal("updatedAt" in resolution, false);
  assert.equal("completedAt" in resolution, false);
  assert.equal("activity" in resolution, false);
  assert.deepEqual(applyResolution(current, resolution), current);
});
test("a stale precondition leaves every persisted task field exactly as it was", () => {
  const current = lockedTask({ updatedAt: T2, status: "completed", completedAt: T2 });
  const applied = applyResolution(current, resolveCateringTaskPatch(current, { title: "Stale", description: null, dueDate: null, dueTime: null, visibility: "provider", status: "pending", expectedUpdatedAt: T1.toISOString() }, NOW));
  for (const field of [...CATERING_TASK_PATCH_FIELDS, "updatedAt", "completedAt"] as const) assert.deepEqual(applied[field], current[field]);
});
test("a stale shared task update records no activity and the update path never notifies", () => {
  const current = lockedTask({ updatedAt: T2, visibility: "shared" });
  const resolution = resolveCateringTaskPatch(current, { status: "completed", expectedUpdatedAt: T1.toISOString() }, NOW);
  assert.equal(resolution.kind, "conflict");
  assert.equal("activity" in resolution, false);
  const completing = resolveCateringTaskPatch(current, { status: "completed", expectedUpdatedAt: T2.toISOString() }, NOW);
  assert.deepEqual(completing.kind === "update" ? completing.activity : null, { eventType: "shared_requirement_completed", taskTitle: "Confirm rentals" });
});
test("two tabs editing one task: the stale full draft loses and the newer fields stay authoritative", () => {
  const openedByBoth = lockedTask();
  const tabBSaved = applyResolution(openedByBoth, resolveCateringTaskPatch(openedByBoth, { description: "Tab B description", expectedUpdatedAt: T1.toISOString() }, T2));
  assert.equal(tabBSaved.description, "Tab B description");
  assert.equal(tabBSaved.updatedAt, T2);
  const tabAStaleFullDraft = { title: "Tab A title", description: "Call supplier", dueDate: "2026-09-15", dueTime: "17:30", visibility: "shared" as const, status: "pending" as const, expectedUpdatedAt: T1.toISOString() };
  const tabAResolution = resolveCateringTaskPatch(tabBSaved, tabAStaleFullDraft, NOW);
  assert.deepEqual(tabAResolution, { kind: "conflict" });
  const afterTabA = applyResolution(tabBSaved, tabAResolution);
  assert.equal(afterTabA.description, "Tab B description");
  assert.equal(afterTabA.title, "Confirm rentals");
  assert.equal(afterTabA.updatedAt, T2);
  const tabARetriesFromFresh = applyResolution(afterTabA, resolveCateringTaskPatch(afterTabA, { ...tabAStaleFullDraft, description: afterTabA.description, expectedUpdatedAt: T2.toISOString() }, NOW));
  assert.equal(tabARetriesFromFresh.title, "Tab A title");
  assert.equal(tabARetriesFromFresh.description, "Tab B description");
});
test("a status-only mutation is version-protected in both directions", () => {
  const pending = lockedTask({ visibility: "provider" });
  assert.deepEqual(resolveCateringTaskPatch(pending, { status: "completed", expectedUpdatedAt: T2.toISOString() }, NOW), { kind: "conflict" });
  const completed = applyResolution(pending, resolveCateringTaskPatch(pending, { status: "completed", expectedUpdatedAt: T1.toISOString() }, NOW));
  assert.equal(completed.status, "completed");
  assert.equal(completed.completedAt, NOW);
  assert.deepEqual(resolveCateringTaskPatch(completed, { status: "pending", expectedUpdatedAt: T1.toISOString() }, T2), { kind: "conflict" });
  const reopened = applyResolution(completed, resolveCateringTaskPatch(completed, { status: "pending", expectedUpdatedAt: NOW.toISOString() }, T2));
  assert.equal(reopened.status, "pending");
  assert.equal(reopened.completedAt, null);
});
test("a version-matching no-op still writes nothing and bumps no timestamp", () => {
  const current = lockedTask({ status: "completed", completedAt: T1 });
  const resolution = resolveCateringTaskPatch(current, { title: "Confirm rentals", description: "Call supplier", dueDate: "2026-09-15", dueTime: "17:30", visibility: "shared", status: "completed", expectedUpdatedAt: T1.toISOString() }, NOW);
  assert.deepEqual(resolution, { kind: "unchanged" });
  assert.deepEqual(applyResolution(current, resolution), current);
});
test("a version-matching visibility move persists and stays privacy-safe", () => {
  const shared = lockedTask({ visibility: "shared" });
  const toPrivate = resolveCateringTaskPatch(shared, { visibility: "provider", expectedUpdatedAt: T1.toISOString() }, NOW);
  assert.equal(toPrivate.kind === "update" && toPrivate.next.visibility, "provider");
  assert.equal(toPrivate.kind === "update" ? toPrivate.activity : "missing", null);
  const privateTask = lockedTask({ visibility: "provider" });
  const toShared = resolveCateringTaskPatch(privateTask, { visibility: "shared", expectedUpdatedAt: T1.toISOString() }, NOW);
  assert.deepEqual(toShared.kind === "update" ? toShared.activity : null, { eventType: "shared_requirement_updated", taskTitle: "Confirm rentals" });
});
