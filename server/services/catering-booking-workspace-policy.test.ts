import assert from "node:assert/strict";
import test from "node:test";
import { CATERING_BOOKING_TASK_LIMIT, CATERING_TASK_SET_CHANGED_CODE } from "@shared/catering-booking-operations";
import { CATERING_DETAILS_SAVE_REFUSALS, CATERING_TASK_CREATE_MESSAGES, CATERING_TASK_NOT_FOUND_REFUSAL, CATERING_TASK_PATCH_FIELDS, CATERING_TASK_REORDER_REFUSALS, CATERING_WORKSPACE_READ_ONLY_REFUSAL, cateringWorkspaceGuard, cateringDetailsActivityVisibility, cateringTaskPersistedChanges, cateringTaskUpdateOutcome, cateringTaskVersionMatches, mayMutateWorkspace, nextCateringTaskCompletedAt, nextCateringTaskSortOrder, nextCateringTaskState, resolveCateringDetailsSave, resolveCateringTaskCreate, resolveCateringTaskDelete, resolveCateringTaskPatch, resolveCateringTaskReorder, sharedTaskUpdateActivity, type CateringLockedTaskVersion, type CateringTaskVersionedState } from "./catering-booking-workspace-policy";

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

/** Mirrors exactly what the DELETE route writes: nothing at all unless the resolution is a delete. */
const applyDeleteResolution = (rows: CateringTaskVersionedState[], resolution: ReturnType<typeof resolveCateringTaskDelete>) => ({
  rows: resolution.kind === "delete" ? [] : rows,
  activity: resolution.kind === "delete" && resolution.activity ? [resolution.activity] : [],
});

test("a matching version deletes the task and records truthful shared history", () => {
  const shared = lockedTask({ visibility: "shared" });
  const resolution = resolveCateringTaskDelete(shared, T1.toISOString());
  assert.equal(resolution.kind, "delete");
  const applied = applyDeleteResolution([shared], resolution);
  assert.deepEqual(applied.rows, []);
  assert.deepEqual(applied.activity, [{ eventType: "shared_requirement_deleted", taskTitle: "Confirm rentals" }]);
});
test("deleting a private task removes it without writing customer-visible history", () => {
  const applied = applyDeleteResolution([lockedTask({ visibility: "provider" })], resolveCateringTaskDelete(lockedTask({ visibility: "provider" }), T1.toISOString()));
  assert.deepEqual(applied.rows, []);
  assert.deepEqual(applied.activity, []);
});
test("a stale version conflicts instead of deleting, and writes nothing", () => {
  const current = lockedTask({ updatedAt: T2, visibility: "shared" });
  const resolution = resolveCateringTaskDelete(current, T1.toISOString());
  assert.deepEqual(resolution, { kind: "conflict" });
  assert.equal("activity" in resolution, false);
  const applied = applyDeleteResolution([current], resolution);
  assert.deepEqual(applied.rows, [current]);
  assert.deepEqual(applied.activity, []);
  for (const invalid of ["", "not-a-timestamp"]) assert.deepEqual(resolveCateringTaskDelete(current, invalid), { kind: "conflict" });
});
test("a stale delete preserves every field of the task the other tab actually saved", () => {
  const edited = lockedTask({ updatedAt: T2, title: "Newer title", description: "Newer description", dueDate: "2026-10-01", dueTime: "08:15", visibility: "shared", status: "completed", completedAt: T2 });
  const applied = applyDeleteResolution([edited], resolveCateringTaskDelete(edited, T1.toISOString()));
  assert.equal(applied.rows.length, 1);
  for (const field of [...CATERING_TASK_PATCH_FIELDS, "updatedAt", "completedAt"] as const) assert.deepEqual(applied.rows[0][field], edited[field]);
});
test("two tabs on one task: a stale delete is rejected and the newer task survives", () => {
  const openedByBoth = lockedTask({ visibility: "shared" });
  const tabBSaved = applyResolution(openedByBoth, resolveCateringTaskPatch(openedByBoth, { description: "Tab B description", expectedUpdatedAt: T1.toISOString() }, T2));
  const tabADelete = resolveCateringTaskDelete(tabBSaved, T1.toISOString());
  assert.deepEqual(tabADelete, { kind: "conflict" });
  const afterTabA = applyDeleteResolution([tabBSaved], tabADelete);
  assert.deepEqual(afterTabA.rows, [tabBSaved]);
  assert.deepEqual(afterTabA.activity, []);
  assert.equal(afterTabA.rows[0].description, "Tab B description");
  assert.deepEqual(applyDeleteResolution([tabBSaved], resolveCateringTaskDelete(tabBSaved, T2.toISOString())).rows, []);
});

/** Mirrors exactly what the POST route writes: only a create outcome inserts a task or its activity. */
const applyCreateOutcome = (outcome: ReturnType<typeof resolveCateringTaskCreate>) => ({
  tasks: outcome.kind === "create" ? [{ sortOrder: outcome.sortOrder }] : [],
  activity: outcome.kind === "create" && outcome.activity ? [outcome.activity] : [],
});
const newTask = { title: "Confirm rentals", visibility: "provider" as const };

test("an active booking below the task limit creates the task", () => {
  for (const taskCount of [0, 1, 99]) {
    const outcome = resolveCateringTaskCreate({ taskCount, maxSortOrder: taskCount === 0 ? null : taskCount - 1 }, newTask);
    assert.equal(outcome.kind, "create");
    assert.equal(applyCreateOutcome(outcome).tasks.length, 1);
  }
  for (const [maxSortOrder, sortOrder] of [[null, 0], [0, 1], [5, 6]] as const) {
    const outcome = resolveCateringTaskCreate({ taskCount: 3, maxSortOrder }, newTask);
    assert.equal(outcome.kind === "create" && outcome.sortOrder, sortOrder);
  }
});
test("a shared create earns truthful added activity and a private one earns none", () => {
  assert.deepEqual(applyCreateOutcome(resolveCateringTaskCreate({ taskCount: 0, maxSortOrder: null }, { ...newTask, visibility: "shared" })).activity, [{ eventType: "shared_requirement_added", taskTitle: "Confirm rentals" }]);
  assert.deepEqual(applyCreateOutcome(resolveCateringTaskCreate({ taskCount: 0, maxSortOrder: null }, newTask)).activity, []);
});
test("a full task collection is a limit outcome that inserts nothing", () => {
  for (const taskCount of [100, 101]) {
    const outcome = resolveCateringTaskCreate({ taskCount, maxSortOrder: taskCount - 1 }, { ...newTask, visibility: "shared" });
    assert.deepEqual(outcome, { kind: "limit" });
    assert.deepEqual(applyCreateOutcome(outcome), { tasks: [], activity: [] });
  }
});
test("a booking that went read-only under the lock is its own outcome that inserts nothing", () => {
  const outcome = resolveCateringTaskCreate(null, { ...newTask, visibility: "shared" });
  assert.deepEqual(outcome, { kind: "read_only" });
  assert.equal("sortOrder" in outcome, false);
  assert.equal("activity" in outcome, false);
  assert.deepEqual(applyCreateOutcome(outcome), { tasks: [], activity: [] });
});
test("a read-only create is never reported as a full task list", () => {
  assert.notEqual(CATERING_TASK_CREATE_MESSAGES.read_only, CATERING_TASK_CREATE_MESSAGES.limit);
  assert.match(CATERING_TASK_CREATE_MESSAGES.read_only, /read-only/);
  assert.equal(/at most/.test(CATERING_TASK_CREATE_MESSAGES.read_only), false);
  assert.match(CATERING_TASK_CREATE_MESSAGES.limit, /at most 100 tasks/);
});

/** Mirrors exactly what the PUT /details route writes: nothing at all unless the resolution is a save. */
const applyDetailsOutcome = (outcome: ReturnType<typeof resolveCateringDetailsSave>) => ({
  updates: outcome.kind === "save" ? 1 : 0,
  activity: outcome.kind === "save" && outcome.activityVisibility ? [outcome.activityVisibility] : [],
});
const persistedDetails = { venueCity: "Austin", serviceStartTime: "17:30", serviceEndTime: "21:00", providerNotes: null, customerNotes: null };

test("an active provider details save persists and records shared history", () => {
  const outcome = resolveCateringDetailsSave({ existing: persistedDetails }, { venueCity: "Dallas" }, "provider");
  assert.equal(outcome.kind, "save");
  assert.deepEqual(applyDetailsOutcome(outcome), { updates: 1, activity: ["shared"] });
  const privateOnly = resolveCateringDetailsSave({ existing: persistedDetails }, { providerNotes: "Private staffing plan" }, "provider");
  assert.deepEqual(applyDetailsOutcome(privateOnly), { updates: 1, activity: ["provider"] });
});
test("an active customer notes save persists and records shared history", () => {
  const outcome = resolveCateringDetailsSave({ existing: persistedDetails }, { customerNotes: "Please arrive early" }, "customer");
  assert.equal(outcome.kind, "save");
  assert.deepEqual(applyDetailsOutcome(outcome), { updates: 1, activity: ["shared"] });
  assert.deepEqual(applyDetailsOutcome(resolveCateringDetailsSave({ existing: persistedDetails }, { customerNotes: null }, "customer")), { updates: 1, activity: [] });
});
test("a booking that went read-only under the lock refuses both provider and customer saves", () => {
  for (const [role, input] of [["provider", { venueCity: "Dallas" }], ["customer", { customerNotes: "Late" }]] as const) {
    const outcome = resolveCateringDetailsSave(null, input, role);
    assert.deepEqual(outcome, { kind: "read_only" });
    assert.equal("activityVisibility" in outcome, false);
    assert.deepEqual(applyDetailsOutcome(outcome), { updates: 0, activity: [] });
  }
});
test("a service range that would not survive the merge is its own refusal", () => {
  const outcome = resolveCateringDetailsSave({ existing: persistedDetails }, { serviceEndTime: "16:00" }, "provider");
  assert.deepEqual(outcome, { kind: "invalid_time_range" });
  assert.deepEqual(applyDetailsOutcome(outcome), { updates: 0, activity: [] });
  assert.equal(resolveCateringDetailsSave({ existing: persistedDetails }, { serviceStartTime: null }, "provider").kind, "save");
  assert.equal(resolveCateringDetailsSave({ existing: undefined }, { serviceEndTime: "16:00" }, "provider").kind, "save");
  assert.equal(resolveCateringDetailsSave({ existing: persistedDetails }, { customerNotes: "Late" }, "customer").kind, "save");
});
test("a read-only details refusal carries the canonical code and an invalid range never does", () => {
  assert.equal(CATERING_DETAILS_SAVE_REFUSALS.read_only.code, "workspace_read_only");
  assert.equal(CATERING_DETAILS_SAVE_REFUSALS.invalid_time_range.code, undefined);
  assert.notEqual(CATERING_DETAILS_SAVE_REFUSALS.read_only.message, CATERING_DETAILS_SAVE_REFUSALS.invalid_time_range.message);
  assert.match(CATERING_DETAILS_SAVE_REFUSALS.read_only.message, /read-only/);
  assert.equal(/service time range/.test(CATERING_DETAILS_SAVE_REFUSALS.read_only.message), false);
  assert.match(CATERING_DETAILS_SAVE_REFUSALS.invalid_time_range.message, /service end time must not precede service start time/);
  assert.equal(/read-only/.test(CATERING_DETAILS_SAVE_REFUSALS.invalid_time_range.message), false);
});
test("a task that no longer exists stays a truthful 404 and never becomes a version conflict", () => {
  assert.equal(CATERING_TASK_NOT_FOUND_REFUSAL.status, 404);
  assert.equal(CATERING_TASK_NOT_FOUND_REFUSAL.message, "Task not found");
  assert.equal(CATERING_TASK_NOT_FOUND_REFUSAL.code, "catering_task_not_found");
  assert.notEqual(CATERING_TASK_NOT_FOUND_REFUSAL.code, "task_version_conflict");
  assert.notEqual(CATERING_TASK_NOT_FOUND_REFUSAL.code, CATERING_DETAILS_SAVE_REFUSALS.read_only.code);
});
test("a missing-task refusal carries nothing to write", () => {
  const refusal: Record<string, unknown> = { ...CATERING_TASK_NOT_FOUND_REFUSAL };
  for (const written of ["task", "next", "activity", "updatedAt", "completedAt", "sortOrder"]) assert.equal(written in refusal, false);
});

const TASK_A = "11111111-1111-4111-8111-111111111111";
const TASK_B = "22222222-2222-4222-8222-222222222222";
const TASK_C = "33333333-3333-4333-8333-333333333333";
/** One authoritative locked task collection: the ids, their versions, and the sortOrder currently persisted. */
type ReorderRow = CateringLockedTaskVersion & { sortOrder: number };
const lockedRows = (versions: Record<string, Date> = {}): ReorderRow[] =>
  [TASK_A, TASK_B, TASK_C].map((id, sortOrder) => ({ id, sortOrder, updatedAt: versions[id] ?? T1 }));
const submitOrder = (ids: readonly string[], versions: Record<string, string> = {}) => ids.map((id) => ({ id, expectedUpdatedAt: versions[id] ?? T1.toISOString() }));
/** Mirrors exactly what the reorder route writes: nothing at all unless the resolution is a reorder. */
const applyReorder = (rows: ReorderRow[], outcome: ReturnType<typeof resolveCateringTaskReorder>, now: Date): ReorderRow[] => {
  if (outcome.kind !== "reorder") return rows;
  const positions = new Map(outcome.updates.map(({ id, sortOrder }) => [id, sortOrder]));
  return rows.map((row) => positions.has(row.id) ? { ...row, sortOrder: positions.get(row.id)!, updatedAt: now } : row);
};
const orderOf = (rows: ReorderRow[]) => [...rows].sort((left, right) => left.sortOrder - right.sortOrder || left.id.localeCompare(right.id)).map(({ id }) => id);
const freshVersions = (rows: ReorderRow[]) => Object.fromEntries(rows.map((row) => [row.id, row.updatedAt.toISOString()]));
/** Mirrors how the route answers a refused reorder from the refusal record; a conflict and a success answer elsewhere. */
const reorderRefusalFor = (outcome: ReturnType<typeof resolveCateringTaskReorder>) => outcome.kind === "read_only" || outcome.kind === "membership" ? CATERING_TASK_REORDER_REFUSALS[outcome.kind] : null;

test("a reorder matching every current version persists the submitted positions", () => {
  const rows = lockedRows();
  const outcome = resolveCateringTaskReorder(rows, submitOrder([TASK_C, TASK_A, TASK_B]));
  assert.equal(outcome.kind, "reorder");
  assert.deepEqual(outcome.kind === "reorder" ? outcome.updates : null, [{ id: TASK_C, sortOrder: 0 }, { id: TASK_A, sortOrder: 1 }, { id: TASK_B, sortOrder: 2 }]);
  const applied = applyReorder(rows, outcome, T2);
  assert.deepEqual(orderOf(applied), [TASK_C, TASK_A, TASK_B]);
  for (const row of applied) assert.equal(row.updatedAt, T2);
});
test("the reorder position is the submitted array index, never a client-supplied sortOrder", () => {
  const outcome = resolveCateringTaskReorder(lockedRows(), submitOrder([TASK_B, TASK_C, TASK_A]).map((entry) => ({ ...entry, sortOrder: 99 })));
  assert.deepEqual(outcome.kind === "reorder" ? outcome.updates.map(({ sortOrder }) => sortOrder) : null, [0, 1, 2]);
  assert.deepEqual(outcome.kind === "reorder" ? outcome.updates.map(({ id }) => id) : null, [TASK_B, TASK_C, TASK_A]);
});
test("a stale version on a single task conflicts and writes nothing at all", () => {
  const rows = lockedRows({ [TASK_B]: T2 });
  const outcome = resolveCateringTaskReorder(rows, submitOrder([TASK_C, TASK_B, TASK_A]));
  assert.deepEqual(outcome, { kind: "conflict" });
  assert.equal("updates" in outcome, false);
  assert.equal("activity" in outcome, false);
  assert.equal("updatedAt" in outcome, false);
  assert.equal("sortOrder" in outcome, false);
  const applied = applyReorder(rows, outcome, NOW);
  assert.deepEqual(applied, rows);
  assert.deepEqual(orderOf(applied), [TASK_A, TASK_B, TASK_C]);
  for (const row of applied) assert.equal(row.sortOrder, rows.find((current) => current.id === row.id)!.sortOrder);
  for (const row of applied) assert.deepEqual(row.updatedAt, rows.find((current) => current.id === row.id)!.updatedAt);
});
test("a stale reorder never notifies, because a reorder carries nothing to notify about at all", () => {
  const refused: Record<string, unknown> = { ...resolveCateringTaskReorder(lockedRows({ [TASK_A]: T2 }), submitOrder([TASK_B, TASK_A, TASK_C])) };
  const accepted: Record<string, unknown> = { ...resolveCateringTaskReorder(lockedRows(), submitOrder([TASK_B, TASK_A, TASK_C])) };
  for (const written of ["activity", "notify", "notification", "task", "next", "completedAt", "updatedAt"]) {
    assert.equal(written in refused, false);
    assert.equal(written in accepted, false);
  }
});
test("two clients reordering one collection: the stale second submission loses and the first stays authoritative", () => {
  const readByBoth = lockedRows();
  const bothSaw = freshVersions(readByBoth);
  const afterA = applyReorder(readByBoth, resolveCateringTaskReorder(readByBoth, submitOrder([TASK_C, TASK_B, TASK_A], bothSaw)), T2);
  assert.deepEqual(orderOf(afterA), [TASK_C, TASK_B, TASK_A]);
  const bResolution = resolveCateringTaskReorder(afterA, submitOrder([TASK_B, TASK_A, TASK_C], bothSaw));
  assert.deepEqual(bResolution, { kind: "conflict" });
  const afterB = applyReorder(afterA, bResolution, NOW);
  assert.deepEqual(orderOf(afterB), [TASK_C, TASK_B, TASK_A]);
  for (const row of afterB) assert.equal(row.updatedAt, T2);
  const bRetriesFromFresh = applyReorder(afterB, resolveCateringTaskReorder(afterB, submitOrder([TASK_B, TASK_A, TASK_C], freshVersions(afterB))), NOW);
  assert.deepEqual(orderOf(bRetriesFromFresh), [TASK_B, TASK_A, TASK_C]);
});
test("a successful reorder leaves fresh authoritative versions the next reorder must quote", () => {
  const rows = lockedRows();
  const observed = freshVersions(rows);
  const afterFirst = applyReorder(rows, resolveCateringTaskReorder(rows, submitOrder([TASK_B, TASK_C, TASK_A], observed)), T2);
  for (const row of afterFirst) assert.notDeepEqual(row.updatedAt.toISOString(), observed[row.id]);
  assert.deepEqual(resolveCateringTaskReorder(afterFirst, submitOrder([TASK_A, TASK_B, TASK_C], observed)), { kind: "conflict" });
  assert.equal(resolveCateringTaskReorder(afterFirst, submitOrder([TASK_A, TASK_B, TASK_C], freshVersions(afterFirst))).kind, "reorder");
});
test("a reorder that is not the complete current task set is refused as membership, never as a conflict", () => {
  const rows = lockedRows();
  for (const submitted of [[TASK_A, TASK_B], [TASK_A, TASK_B, TASK_C, "44444444-4444-4444-8444-444444444444"], [TASK_A, TASK_A, TASK_B]]) {
    assert.deepEqual(resolveCateringTaskReorder(rows, submitOrder(submitted)), { kind: "membership" });
  }
  // A membership refusal is decided before any version is read, so a stale version cannot mask a wrong task set.
  assert.deepEqual(resolveCateringTaskReorder(lockedRows({ [TASK_A]: T2 }), submitOrder([TASK_A, TASK_B])), { kind: "membership" });
  assert.deepEqual(applyReorder(rows, resolveCateringTaskReorder(rows, submitOrder([TASK_A, TASK_B])), NOW), rows);
});
test("a booking that went read-only under the lock refuses the reorder before membership or versions", () => {
  assert.deepEqual(resolveCateringTaskReorder(null, submitOrder([TASK_A, TASK_B, TASK_C])), { kind: "read_only" });
  assert.deepEqual(resolveCateringTaskReorder(null, submitOrder([TASK_A])), { kind: "read_only" });
  assert.deepEqual(resolveCateringTaskReorder(null, submitOrder([TASK_A, TASK_B, TASK_C], { [TASK_A]: T2.toISOString() })), { kind: "read_only" });
});
test("the three reorder refusals stay distinct and carry the canonical codes", () => {
  assert.equal(CATERING_TASK_REORDER_REFUSALS.read_only.code, "workspace_read_only");
  assert.equal(CATERING_TASK_REORDER_REFUSALS.membership.code, CATERING_TASK_SET_CHANGED_CODE);
  assert.equal(CATERING_TASK_REORDER_REFUSALS.membership.message, "Reorder must contain the complete current task set");
  assert.match(CATERING_TASK_REORDER_REFUSALS.read_only.message, /read-only/);
  assert.equal(/read-only/.test(CATERING_TASK_REORDER_REFUSALS.membership.message), false);
  assert.notEqual(CATERING_TASK_REORDER_REFUSALS.read_only.code, "task_version_conflict");
  assert.notEqual(CATERING_TASK_REORDER_REFUSALS.membership.message, CATERING_TASK_REORDER_REFUSALS.read_only.message);
});
test("reorder, patch, and delete share one instant comparison, and patch and delete are unchanged by it", () => {
  const rows = lockedRows();
  assert.equal(resolveCateringTaskReorder(rows, submitOrder([TASK_A, TASK_B, TASK_C], Object.fromEntries([TASK_A, TASK_B, TASK_C].map((id) => [id, "2026-08-29T00:00:00Z"])))).kind, "reorder");
  for (const spelling of ["2026-08-29T00:00:00.001Z", "not-a-timestamp", ""]) {
    assert.deepEqual(resolveCateringTaskReorder(rows, submitOrder([TASK_A, TASK_B, TASK_C], { [TASK_C]: spelling })), { kind: "conflict" });
    assert.equal(cateringTaskVersionMatches({ updatedAt: T1 }, spelling), false);
  }
  assert.equal(resolveCateringTaskPatch(lockedTask(), { title: "Still works", expectedUpdatedAt: T1.toISOString() }, NOW).kind, "update");
  assert.deepEqual(resolveCateringTaskPatch(lockedTask(), { title: "Stale", expectedUpdatedAt: T2.toISOString() }, NOW), { kind: "conflict" });
  assert.equal(resolveCateringTaskDelete({ updatedAt: T1, title: "Confirm rentals", visibility: "shared" }, T1.toISOString()).kind, "delete");
  assert.deepEqual(resolveCateringTaskDelete({ updatedAt: T1, title: "Confirm rentals", visibility: "shared" }, T2.toISOString()), { kind: "conflict" });
});

test("a membership refusal carries a stable code of its own, distinct from every other refusal", () => {
  assert.equal(CATERING_TASK_REORDER_REFUSALS.membership.code, "catering_task_set_changed");
  assert.equal(CATERING_TASK_REORDER_REFUSALS.membership.code, CATERING_TASK_SET_CHANGED_CODE);
  assert.equal(CATERING_TASK_REORDER_REFUSALS.membership.message, "Reorder must contain the complete current task set");
  for (const other of ["task_version_conflict", "workspace_read_only", "catering_task_not_found"]) assert.notEqual(CATERING_TASK_REORDER_REFUSALS.membership.code, other);
  assert.notEqual(CATERING_TASK_REORDER_REFUSALS.membership.code, CATERING_TASK_REORDER_REFUSALS.read_only.code);
  assert.notEqual(CATERING_TASK_REORDER_REFUSALS.membership.code, CATERING_TASK_NOT_FOUND_REFUSAL.code);
  assert.notEqual(CATERING_TASK_REORDER_REFUSALS.membership.code, CATERING_DETAILS_SAVE_REFUSALS.read_only.code);
  // The message is unchanged, and the read-only refusal keeps its own separate code and wording.
  assert.equal(CATERING_TASK_REORDER_REFUSALS.read_only.code, "workspace_read_only");
  assert.equal(/complete current task set/.test(CATERING_TASK_REORDER_REFUSALS.read_only.message), false);
});
test("another client creating a task makes the loaded reorder a membership refusal, not a version conflict", () => {
  const loadedByA = lockedRows().slice(0, 2);
  const submittedByA = submitOrder([TASK_B, TASK_A], freshVersions(loadedByA));
  // Client B created TASK_C after A loaded, so the authoritative locked collection now holds three tasks.
  const outcome = resolveCateringTaskReorder(lockedRows(), submittedByA);
  assert.deepEqual(outcome, { kind: "membership" });
  assert.notEqual(outcome.kind, "conflict");
  assert.equal(reorderRefusalFor(outcome)?.code, CATERING_TASK_SET_CHANGED_CODE);
  assert.equal(reorderRefusalFor(outcome)?.message, "Reorder must contain the complete current task set");
  // After refetching, A submits the complete current set with its fresh versions and is accepted.
  const refetched = lockedRows();
  assert.equal(resolveCateringTaskReorder(refetched, submitOrder([TASK_B, TASK_A, TASK_C], freshVersions(refetched))).kind, "reorder");
});
test("another client deleting a task makes the loaded reorder a membership refusal, not a version conflict", () => {
  const loadedByA = lockedRows();
  const submittedByA = submitOrder([TASK_C, TASK_B, TASK_A], freshVersions(loadedByA));
  // Client B deleted TASK_C after A loaded, so the authoritative locked collection now holds two tasks.
  const remaining = lockedRows().slice(0, 2);
  const outcome = resolveCateringTaskReorder(remaining, submittedByA);
  assert.deepEqual(outcome, { kind: "membership" });
  assert.notEqual(outcome.kind, "conflict");
  assert.equal(reorderRefusalFor(outcome)?.code, CATERING_TASK_SET_CHANGED_CODE);
  assert.equal(reorderRefusalFor(outcome)?.message, "Reorder must contain the complete current task set");
  assert.deepEqual(applyReorder(remaining, outcome, NOW), remaining);
  assert.equal(resolveCateringTaskReorder(remaining, submitOrder([TASK_B, TASK_A], freshVersions(remaining))).kind, "reorder");
});
test("a membership refusal writes nothing: no order, no version, no activity, no notification", () => {
  const remaining = lockedRows().slice(0, 2);
  const outcome = resolveCateringTaskReorder(remaining, submitOrder([TASK_C, TASK_B, TASK_A]));
  assert.deepEqual(outcome, { kind: "membership" });
  const refused: Record<string, unknown> = { ...outcome };
  for (const written of ["updates", "activity", "notify", "notification", "task", "sortOrder", "updatedAt", "completedAt"]) assert.equal(written in refused, false);
  const applied = applyReorder(remaining, outcome, NOW);
  assert.deepEqual(applied, remaining);
  for (const row of applied) {
    assert.equal(row.sortOrder, remaining.find((current) => current.id === row.id)!.sortOrder);
    assert.deepEqual(row.updatedAt, remaining.find((current) => current.id === row.id)!.updatedAt);
  }
  assert.deepEqual(orderOf(applied), [TASK_A, TASK_B]);
  // The refusal shape itself is what the route writes from, and it is the same one regardless of the request's order.
  assert.deepEqual(resolveCateringTaskReorder(remaining, submitOrder([TASK_A, TASK_B, TASK_C])), { kind: "membership" });
  assert.equal(CATERING_BOOKING_TASK_LIMIT, 100);
});

const TERMINAL_STATUSES = ["cancelled", "completed"] as const;
const ACTIVE_STATUSES = ["pending_confirmation", "confirmed"] as const;
/** Every workspace mutation's early guard, as the routes call it: the resource each endpoint names. */
const WORKSPACE_MUTATIONS = [
  { endpoint: "provider details save", role: "provider" as const, resource: "provider-details" as const },
  { endpoint: "customer notes save", role: "customer" as const, resource: "customer-notes" as const },
  { endpoint: "task create", role: "provider" as const, resource: "tasks" as const },
  { endpoint: "task PATCH", role: "provider" as const, resource: "tasks" as const },
  { endpoint: "task DELETE", role: "provider" as const, resource: "tasks" as const },
  { endpoint: "task reorder", role: "provider" as const, resource: "tasks" as const },
];
/** Mirrors what each route answers for a refused early guard, terminal booking coded and wrong actor not. */
const earlyRefusal = (guard: "allowed" | "read_only" | "forbidden", forbidden: string) => guard === "allowed" ? null
  : guard === "read_only" ? { status: CATERING_WORKSPACE_READ_ONLY_REFUSAL.status, message: CATERING_WORKSPACE_READ_ONLY_REFUSAL.message, code: CATERING_WORKSPACE_READ_ONLY_REFUSAL.code }
  : { status: 409, message: forbidden, code: undefined };

test("every workspace mutation refuses an already-cancelled or already-completed booking with the same coded 409", () => {
  for (const status of TERMINAL_STATUSES) for (const { endpoint, role, resource } of WORKSPACE_MUTATIONS) {
    const guard = cateringWorkspaceGuard(status, role, resource);
    assert.equal(guard, "read_only", endpoint);
    const refusal = earlyRefusal(guard, "unused")!;
    assert.equal(refusal.status, 409, endpoint);
    assert.equal(refusal.code, "workspace_read_only", endpoint);
    assert.equal(refusal.message, "Cancelled and completed workspaces are read-only", endpoint);
  }
});
test("the early terminal refusal carries the identical code the locked read-only race returns", () => {
  assert.equal(CATERING_WORKSPACE_READ_ONLY_REFUSAL.code, CATERING_DETAILS_SAVE_REFUSALS.read_only.code);
  assert.equal(CATERING_WORKSPACE_READ_ONLY_REFUSAL.code, CATERING_TASK_REORDER_REFUSALS.read_only.code);
  assert.equal(CATERING_WORKSPACE_READ_ONLY_REFUSAL.status, 409);
  // The messages stay timing-specific on purpose; only the code has to match.
  assert.notEqual(CATERING_WORKSPACE_READ_ONLY_REFUSAL.message, CATERING_DETAILS_SAVE_REFUSALS.read_only.message);
  assert.match(CATERING_WORKSPACE_READ_ONLY_REFUSAL.message, /read-only/);
});
test("a terminal booking is read-only whoever asks, and an active booking still refuses the wrong actor uncoded", () => {
  for (const status of TERMINAL_STATUSES) for (const role of ["provider", "customer"] as const) {
    assert.equal(cateringWorkspaceGuard(status, role, "tasks"), "read_only");
  }
  for (const status of ACTIVE_STATUSES) {
    assert.equal(cateringWorkspaceGuard(status, "customer", "tasks"), "forbidden");
    assert.equal(cateringWorkspaceGuard(status, "provider", "customer-notes"), "forbidden");
    const refusal = earlyRefusal(cateringWorkspaceGuard(status, "customer", "tasks"), "Only the provider may edit tasks on an active workspace")!;
    assert.equal(refusal.code, undefined);
    assert.equal(refusal.status, 409);
    assert.equal(refusal.message, "Only the provider may edit tasks on an active workspace");
  }
});
test("an active booking still lets each participant through its own early guard", () => {
  for (const status of ACTIVE_STATUSES) {
    for (const resource of ["provider-details", "tasks"] as const) assert.equal(cateringWorkspaceGuard(status, "provider", resource), "allowed");
    assert.equal(cateringWorkspaceGuard(status, "customer", "customer-notes"), "allowed");
    for (const { role, resource } of WORKSPACE_MUTATIONS) assert.equal(cateringWorkspaceGuard(status, role, resource), "allowed");
  }
});
test("the early terminal refusal carries nothing to write, so no row, activity, or notification follows it", () => {
  const refusal: Record<string, unknown> = { ...CATERING_WORKSPACE_READ_ONLY_REFUSAL };
  for (const written of ["details", "task", "tasks", "next", "updates", "activity", "notify", "notification", "sortOrder", "updatedAt", "completedAt"]) assert.equal(written in refusal, false);
  assert.deepEqual(Object.keys(refusal).sort(), ["code", "message", "status"]);
  // The guard itself is a classification and returns before any locked resolution is even reached.
  for (const status of TERMINAL_STATUSES) assert.equal(typeof cateringWorkspaceGuard(status, "provider", "tasks"), "string");
});
test("no other workspace refusal is relabelled read-only by this change", () => {
  assert.equal(CATERING_DETAILS_SAVE_REFUSALS.invalid_time_range.code, undefined);
  assert.equal(CATERING_TASK_NOT_FOUND_REFUSAL.code, "catering_task_not_found");
  assert.equal(CATERING_TASK_REORDER_REFUSALS.membership.code, CATERING_TASK_SET_CHANGED_CODE);
  for (const code of [CATERING_DETAILS_SAVE_REFUSALS.invalid_time_range.code, CATERING_TASK_NOT_FOUND_REFUSAL.code, CATERING_TASK_REORDER_REFUSALS.membership.code]) {
    assert.notEqual(code, CATERING_WORKSPACE_READ_ONLY_REFUSAL.code);
  }
  // The task limit and the version conflict keep their own distinct answers too.
  assert.notEqual(CATERING_TASK_CREATE_MESSAGES.limit, CATERING_TASK_CREATE_MESSAGES.read_only);
  assert.equal(/read-only/.test(CATERING_TASK_CREATE_MESSAGES.limit), false);
  assert.equal(resolveCateringTaskPatch(lockedTask(), { title: "Stale", expectedUpdatedAt: T2.toISOString() }, NOW).kind, "conflict");
  assert.equal(resolveCateringTaskDelete({ updatedAt: T1, title: "Confirm rentals", visibility: "shared" }, T2.toISOString()).kind, "conflict");
});
