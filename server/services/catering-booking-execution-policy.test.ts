import assert from "node:assert/strict";
import test from "node:test";
import {
  CATERING_EXECUTION_CONFLICT_REFUSAL,
  CATERING_EXECUTION_LIMIT_MESSAGES,
  CATERING_EXECUTION_NOT_FOUND_REFUSAL,
  CATERING_EXECUTION_READ_ONLY_REFUSAL,
  CATERING_EXECUTION_SET_CHANGED_REFUSAL,
  CATERING_STAFF_PATCH_REFUSALS,
  CATERING_TIMELINE_MATERIAL_FIELDS,
  cateringAccessSharedChanges,
  cateringEquipmentActivityFor,
  cateringExecutionGuard,
  cateringExecutionVersionMatches,
  cateringReadinessFacts,
  cateringTimelineActivityFor,
  cateringTimelinePersistedChanges,
  deriveCateringReadiness,
  nextCateringExecutionSortOrder,
  nextCateringTimelineState,
  resolveCateringAccessSave,
  resolveCateringEquipmentCreate,
  resolveCateringEquipmentDelete,
  resolveCateringEquipmentPatch,
  resolveCateringMilestoneToggle,
  resolveCateringStaffCreate,
  resolveCateringStaffDelete,
  resolveCateringStaffPatch,
  resolveCateringTimelineCreate,
  resolveCateringTimelineDelete,
  resolveCateringTimelinePatch,
  resolveCateringTimelineReorder,
  shouldNotifyCateringTimelineChange,
  type CateringTimelinePersistedState,
} from "./catering-booking-execution-policy";
import { CATERING_ACCESS_INSTRUCTION_FIELDS, CATERING_ACCESS_SHARED_FIELDS, CATERING_EXECUTION_EQUIPMENT_LIMIT, CATERING_EXECUTION_STAFF_LIMIT, CATERING_EXECUTION_TIMELINE_LIMIT, CATERING_WORKSPACE_READ_ONLY_CODE, cateringStaffCreateSchema, cateringTimelineCreateSchema } from "@shared/catering-booking-execution";

/**
 * The Phase 2J resolution layer.
 *
 * Every route decision -- what persists, what history is written, who is notified, and which of several refusals is
 * the truthful one -- is decided by these pure functions against the AUTHORITATIVE locked row. There is no database
 * harness in this suite, as elsewhere in the catering phases, so the route's use of them is asserted structurally in
 * the route test files and the semantics are exercised here.
 */

const NOW = new Date("2026-09-08T12:00:00.000Z");
const VERSION = new Date("2026-09-08T11:00:00.000Z");
const version = VERSION.toISOString();
const BASE: CateringTimelinePersistedState & { updatedAt: Date; completedAt: Date | null } = {
  title: "Load in", description: null, category: "load_in", scheduledTime: "07:30", endTime: "08:30",
  visibility: "provider_private", isBlocker: false, completed: false, updatedAt: VERSION, completedAt: null,
};
const SHARED = { ...BASE, visibility: "shared" };

/* ------------------------------------------------------------------------------------------------------------- *
 * The early guard
 * ------------------------------------------------------------------------------------------------------------- */

test("a terminal booking is reported read-only whoever asked, and only an active one refuses an actor", () => {
  // Status is decided FIRST, so a customer on a cancelled booking is told the booking closed -- which is the answer
  // a refetch resolves -- rather than being told they lack permission, which a refetch would not change.
  for (const status of ["cancelled", "completed"] as const) {
    assert.equal(cateringExecutionGuard(status, "provider"), "read_only", status);
    assert.equal(cateringExecutionGuard(status, "customer"), "read_only", status);
  }
  for (const status of ["pending_confirmation", "confirmed"] as const) {
    assert.equal(cateringExecutionGuard(status, "provider"), "allowed", status);
    assert.equal(cateringExecutionGuard(status, "customer"), "forbidden", status);
  }
});

test("the read-only refusal carries the workspace's own canonical code", () => {
  assert.equal(CATERING_EXECUTION_READ_ONLY_REFUSAL.code, CATERING_WORKSPACE_READ_ONLY_CODE);
  assert.equal(CATERING_EXECUTION_READ_ONLY_REFUSAL.status, 409);
  assert.equal(CATERING_EXECUTION_NOT_FOUND_REFUSAL.status, 404);
  assert.equal(CATERING_EXECUTION_CONFLICT_REFUSAL.status, 409);
  assert.equal(CATERING_EXECUTION_SET_CHANGED_REFUSAL.status, 409);
  // Every refusal is distinguishable: a closed booking, a missing record, a stale version and a changed collection
  // are four different things the client reacts to differently.
  const codes = [CATERING_EXECUTION_READ_ONLY_REFUSAL.code, CATERING_EXECUTION_NOT_FOUND_REFUSAL.code, CATERING_EXECUTION_CONFLICT_REFUSAL.code, CATERING_EXECUTION_SET_CHANGED_REFUSAL.code];
  assert.equal(new Set(codes).size, 4);
});

/* ------------------------------------------------------------------------------------------------------------- *
 * Version preconditions
 * ------------------------------------------------------------------------------------------------------------- */

test("a version precondition compares the instant, and fails closed on anything else", () => {
  assert.equal(cateringExecutionVersionMatches({ updatedAt: VERSION }, version), true);
  // The same instant written differently still matches -- it is the instant that is the version, not its spelling.
  assert.equal(cateringExecutionVersionMatches({ updatedAt: VERSION }, "2026-09-08T11:00:00Z"), true);
  assert.equal(cateringExecutionVersionMatches({ updatedAt: VERSION }, NOW.toISOString()), false);
  for (const value of [undefined, "", "not a date", "0"]) {
    assert.equal(cateringExecutionVersionMatches({ updatedAt: VERSION }, value as string | undefined), false, String(value));
  }
});

/* ------------------------------------------------------------------------------------------------------------- *
 * Timeline
 * ------------------------------------------------------------------------------------------------------------- */

test("a create refuses a closed booking and a full run-of-show as two different things", () => {
  assert.equal(resolveCateringTimelineCreate(null, { title: "x", visibility: "shared" }).kind, "read_only");
  assert.equal(resolveCateringTimelineCreate({ itemCount: CATERING_EXECUTION_TIMELINE_LIMIT, maxSortOrder: 4 }, { title: "x", visibility: "shared" }).kind, "limit");
  assert.notEqual(CATERING_EXECUTION_LIMIT_MESSAGES.timeline, CATERING_EXECUTION_READ_ONLY_REFUSAL.message);
});

test("sort order is appended by the server from the locked collection, never claimed by a client", () => {
  assert.equal(nextCateringExecutionSortOrder(null), 0);
  assert.equal(nextCateringExecutionSortOrder(0), 1);
  assert.equal(nextCateringExecutionSortOrder(41), 42);
  const created = resolveCateringTimelineCreate({ itemCount: 2, maxSortOrder: 7 }, { title: "x", visibility: "shared" });
  assert.equal(created.kind === "create" && created.sortOrder, 8);
});

test("only a shared create writes history and notifies; a private one does neither", () => {
  const shared = resolveCateringTimelineCreate({ itemCount: 0, maxSortOrder: null }, { title: "Guests arrive", visibility: "shared" });
  assert.equal(shared.kind === "create" && shared.activity?.eventType, "execution_timeline_added");
  assert.equal(shared.kind === "create" && shared.notify, true);
  const priv = resolveCateringTimelineCreate({ itemCount: 0, maxSortOrder: null }, { title: "Secret prep", visibility: "provider_private" });
  assert.equal(priv.kind === "create" && priv.activity, null);
  assert.equal(priv.kind === "create" && priv.notify, false);
});

test("a stale timeline patch conflicts and produces nothing to write", () => {
  const outcome = resolveCateringTimelinePatch(BASE, { title: "Renamed", expectedUpdatedAt: NOW.toISOString() }, NOW);
  assert.deepEqual(outcome, { kind: "conflict" });
  // Which is the point: the row, its version, its completion and the booking history all stay exactly as they were.
  assert.equal("next" in outcome, false);
  assert.equal("activity" in outcome, false);
  assert.equal("notify" in outcome, false);
});

test("field presence is not a change, so a repeated patch writes nothing and bumps no version", () => {
  const outcome = resolveCateringTimelinePatch(BASE, { title: BASE.title, category: BASE.category, expectedUpdatedAt: version }, NOW);
  assert.equal(outcome.kind, "unchanged");
  assert.deepEqual(cateringTimelinePersistedChanges(BASE, nextCateringTimelineState(BASE, { title: BASE.title })), []);
});

test("completion timestamps move only on a real transition", () => {
  const completing = resolveCateringTimelinePatch(SHARED, { completed: true, expectedUpdatedAt: version }, NOW);
  assert.equal(completing.kind === "update" && completing.completedAt?.getTime(), NOW.getTime());
  assert.equal(completing.kind === "update" && completing.activity?.eventType, "execution_timeline_completed");
  const completed = { ...SHARED, completed: true, completedAt: VERSION };
  // Re-asserting a completion is not a transition: it resolves to unchanged, so the original instant survives.
  assert.equal(resolveCateringTimelinePatch(completed, { completed: true, expectedUpdatedAt: version }, NOW).kind, "unchanged");
  const reopening = resolveCateringTimelinePatch(completed, { completed: false, expectedUpdatedAt: version }, NOW);
  assert.equal(reopening.kind === "update" && reopening.completedAt, null);
});

test("timeline activity is decided by what the CUSTOMER can see, in all four visibility transitions", () => {
  const toShared = { ...BASE, visibility: "shared" };
  assert.equal(cateringTimelineActivityFor(BASE, toShared, ["visibility"])?.eventType, "execution_timeline_added");
  assert.equal(cateringTimelineActivityFor(SHARED, { ...SHARED, visibility: "provider_private" }, ["visibility"])?.eventType, "execution_timeline_removed");
  assert.equal(cateringTimelineActivityFor(SHARED, { ...SHARED, title: "Renamed" }, ["title"])?.eventType, "execution_timeline_updated");
  // Private to private writes nothing at all: there is no customer-visible history for a record they cannot see,
  // which is also what keeps provider churn out of the feed entirely.
  assert.equal(cateringTimelineActivityFor(BASE, { ...BASE, title: "Renamed" }, ["title"]), null);
  assert.equal(cateringTimelineActivityFor(BASE, BASE, []), null);
});

test("a removal from the shared plan reads as removed and keeps the title the customer knew", () => {
  const activity = cateringTimelineActivityFor(SHARED, { ...SHARED, visibility: "provider_private", title: "Internal name" }, ["visibility", "title"]);
  assert.equal(activity?.eventType, "execution_timeline_removed");
  assert.equal(activity?.title, "Load in", "the customer is told about the item they actually saw");
});

test("only a material change to the shared plan notifies the customer", () => {
  assert.deepEqual([...CATERING_TIMELINE_MATERIAL_FIELDS], ["title", "category", "scheduledTime", "endTime"]);
  for (const field of CATERING_TIMELINE_MATERIAL_FIELDS) {
    assert.equal(shouldNotifyCateringTimelineChange(SHARED, { ...SHARED, title: "n" }, [field]), true, field);
  }
  // A completion tick during service, a blocker flag and a note tidy-up all write history and notify nobody.
  for (const field of ["completed", "isBlocker", "description"] as const) {
    assert.equal(shouldNotifyCateringTimelineChange(SHARED, SHARED, [field]), false, field);
  }
  // Entering or leaving the shared plan always notifies.
  assert.equal(shouldNotifyCateringTimelineChange(BASE, { ...BASE, visibility: "shared" }, ["visibility"]), true);
  assert.equal(shouldNotifyCateringTimelineChange(SHARED, { ...SHARED, visibility: "provider_private" }, ["visibility"]), true);
  // A provider-private edit can never notify, whatever changed.
  assert.equal(shouldNotifyCateringTimelineChange(BASE, { ...BASE, title: "n", scheduledTime: "09:00" }, ["title", "scheduledTime"]), false);
  assert.equal(shouldNotifyCateringTimelineChange(SHARED, SHARED, []), false);
});

test("a stale delete conflicts, removes nothing and writes no history", () => {
  assert.deepEqual(resolveCateringTimelineDelete(SHARED, NOW.toISOString()), { kind: "conflict" });
  const shared = resolveCateringTimelineDelete(SHARED, version);
  assert.equal(shared.kind === "delete" && shared.activity?.eventType, "execution_timeline_removed");
  assert.equal(shared.kind === "delete" && shared.notify, true);
  const priv = resolveCateringTimelineDelete(BASE, version);
  assert.equal(priv.kind === "delete" && priv.activity, null);
  assert.equal(priv.kind === "delete" && priv.notify, false);
});

/* ------------------------------------------------------------------------------------------------------------- *
 * Reordering
 * ------------------------------------------------------------------------------------------------------------- */

const locked = [
  { id: "a", updatedAt: VERSION },
  { id: "b", updatedAt: VERSION },
  { id: "c", updatedAt: VERSION },
];
const entry = (id: string, at: Date = VERSION) => ({ id, expectedUpdatedAt: at.toISOString() });

test("a reorder persists the submitted POSITION, and never a client-supplied sort order", () => {
  const outcome = resolveCateringTimelineReorder(locked, [entry("c"), entry("a"), entry("b")]);
  assert.deepEqual(outcome.kind === "reorder" && outcome.updates, [{ id: "c", sortOrder: 0 }, { id: "a", sortOrder: 1 }, { id: "b", sortOrder: 2 }]);
});

test("a reorder must be the complete current set, in both directions", () => {
  assert.equal(resolveCateringTimelineReorder(locked, [entry("a"), entry("b")]).kind, "membership", "an item missing from the request");
  assert.equal(resolveCateringTimelineReorder(locked, [entry("a"), entry("b"), entry("c"), entry("d")]).kind, "membership", "an item the collection does not have");
  assert.equal(resolveCateringTimelineReorder(locked, [entry("a"), entry("a"), entry("b")]).kind, "membership", "a duplicate");
  assert.equal(resolveCateringTimelineReorder(null, [entry("a")]).kind, "read_only");
});

test("one stale version refuses the WHOLE reorder, so nothing is half-applied", () => {
  const outcome = resolveCateringTimelineReorder(locked, [entry("c"), entry("a"), entry("b", NOW)]);
  assert.deepEqual(outcome, { kind: "conflict" });
  assert.equal("updates" in outcome, false);
});

test("a stale reorder cannot silently reinstate an order a newer edit already replaced", () => {
  // Two tabs. The first reorder commits and bumps every version; the second was composed against the old ones.
  const afterFirst = locked.map((item) => ({ ...item, updatedAt: NOW }));
  const stale = resolveCateringTimelineReorder(afterFirst, [entry("b"), entry("c"), entry("a")]);
  assert.equal(stale.kind, "conflict");
  // And the same submission against the versions it was actually composed from is accepted, so this is a
  // precondition rather than a blanket refusal.
  assert.equal(resolveCateringTimelineReorder(locked, [entry("b"), entry("c"), entry("a")]).kind, "reorder");
});

/* ------------------------------------------------------------------------------------------------------------- *
 * Crew
 * ------------------------------------------------------------------------------------------------------------- */

const STAFF = { workerName: "Ada", role: "chef", customRole: null, contactNote: null, arrivalTime: "07:00", departureTime: "15:00", responsibilityNote: null, updatedAt: VERSION };

test("crew mutations never produce activity or a notification, in any branch", () => {
  const created = resolveCateringStaffCreate({ itemCount: 0, maxSortOrder: null });
  assert.deepEqual(created, { kind: "create" });
  assert.equal("activity" in created, false);
  assert.equal("notify" in created, false);
  const patched = resolveCateringStaffPatch(STAFF, { workerName: "Grace", expectedUpdatedAt: version }, NOW);
  assert.equal(patched.kind, "update");
  assert.equal("activity" in patched, false);
  assert.equal("notify" in patched, false);
  const deleted = resolveCateringStaffDelete(STAFF, version);
  assert.deepEqual(deleted, { kind: "delete" });
});

test("crew creation refuses a closed booking and a full crew separately", () => {
  assert.equal(resolveCateringStaffCreate(null).kind, "read_only");
  assert.equal(resolveCateringStaffCreate({ itemCount: CATERING_EXECUTION_STAFF_LIMIT, maxSortOrder: null }).kind, "limit");
});

test("a crew patch is judged on the MERGED row, so a partial edit cannot produce an incoherent one", () => {
  // Switching to the custom role without naming it would violate the database CHECK; it is a truthful 400 instead.
  assert.equal(resolveCateringStaffPatch(STAFF, { role: "custom", expectedUpdatedAt: version }, NOW).kind, "invalid_role");
  // And leaving a stale custom label behind when moving off the custom role is the mirror case.
  const custom = { ...STAFF, role: "custom", customRole: "Pastry lead" };
  assert.equal(resolveCateringStaffPatch(custom, { role: "chef", expectedUpdatedAt: version }, NOW).kind, "invalid_role");
  assert.equal(resolveCateringStaffPatch(custom, { role: "chef", customRole: null, expectedUpdatedAt: version }, NOW).kind, "update");
  // Times are merged and re-checked too: a new arrival after the persisted departure is refused.
  assert.equal(resolveCateringStaffPatch(STAFF, { arrivalTime: "16:00", expectedUpdatedAt: version }, NOW).kind, "invalid_time_range");
  assert.equal(new Set(Object.values(CATERING_STAFF_PATCH_REFUSALS)).size, 2);
});

test("a stale crew edit or delete conflicts and changes nothing", () => {
  assert.equal(resolveCateringStaffPatch(STAFF, { workerName: "Grace", expectedUpdatedAt: NOW.toISOString() }, NOW).kind, "conflict");
  assert.equal(resolveCateringStaffDelete(STAFF, NOW.toISOString()).kind, "conflict");
  assert.equal(resolveCateringStaffPatch(STAFF, { workerName: STAFF.workerName, expectedUpdatedAt: version }, NOW).kind, "unchanged");
});

/* ------------------------------------------------------------------------------------------------------------- *
 * Equipment
 * ------------------------------------------------------------------------------------------------------------- */

const EQUIPMENT = {
  name: "Chafer", quantity: 6, sourceType: "rental", sourceName: "Ace Rentals",
  pickupDate: null, pickupTime: null, returnDate: null, returnTime: null,
  status: "planned", isBlocker: false, notes: null, visibility: "provider_private", updatedAt: VERSION,
};

test("equipment creation refuses a closed booking and a full collection separately, and only shares history when shared", () => {
  assert.equal(resolveCateringEquipmentCreate(null, { name: "x", visibility: "shared" }).kind, "read_only");
  assert.equal(resolveCateringEquipmentCreate({ itemCount: CATERING_EXECUTION_EQUIPMENT_LIMIT, maxSortOrder: null }, { name: "x", visibility: "shared" }).kind, "limit");
  const shared = resolveCateringEquipmentCreate({ itemCount: 0, maxSortOrder: null }, { name: "Chafer", visibility: "shared" });
  assert.equal(shared.kind === "create" && shared.activity?.eventType, "shared_equipment_added");
  const priv = resolveCateringEquipmentCreate({ itemCount: 0, maxSortOrder: null }, { name: "Chafer", visibility: "provider_private" });
  assert.equal(priv.kind === "create" && priv.activity, null);
});

test("exactly two equipment events exist, and neither describes a private record", () => {
  const shared = { ...EQUIPMENT, visibility: "shared" };
  assert.equal(cateringEquipmentActivityFor(shared, { ...shared, status: "received" }, ["status"])?.eventType, "shared_equipment_status_changed");
  assert.equal(cateringEquipmentActivityFor(EQUIPMENT, { ...EQUIPMENT, visibility: "shared" }, ["visibility"])?.eventType, "shared_equipment_added");
  // A private item's status moving is invisible history, and so is a shared item leaving the customer's view.
  assert.equal(cateringEquipmentActivityFor(EQUIPMENT, { ...EQUIPMENT, status: "received" }, ["status"]), null);
  assert.equal(cateringEquipmentActivityFor(shared, { ...shared, visibility: "provider_private" }, ["visibility"]), null);
  // A rename or quantity correction on a shared record is bookkeeping, not operational news.
  assert.equal(cateringEquipmentActivityFor(shared, { ...shared, quantity: 8 }, ["quantity"]), null);
  assert.equal(cateringEquipmentActivityFor(shared, shared, []), null);
});

test("every equipment status transition is accepted and recorded once, and a repeat writes nothing", () => {
  const shared = { ...EQUIPMENT, visibility: "shared" };
  for (const status of ["confirmed", "received", "in_use", "returned", "cancelled"]) {
    const outcome = resolveCateringEquipmentPatch(shared, { status, expectedUpdatedAt: version }, NOW);
    assert.equal(outcome.kind, "update", status);
    assert.equal(outcome.kind === "update" && outcome.activity?.eventType, "shared_equipment_status_changed", status);
  }
  // Re-sending the status it already has is not a transition, so no second activity row is produced.
  assert.equal(resolveCateringEquipmentPatch(shared, { status: shared.status, expectedUpdatedAt: version }, NOW).kind, "unchanged");
});

test("a stale equipment edit or delete conflicts and changes nothing", () => {
  assert.equal(resolveCateringEquipmentPatch(EQUIPMENT, { status: "received", expectedUpdatedAt: NOW.toISOString() }, NOW).kind, "conflict");
  assert.equal(resolveCateringEquipmentDelete(EQUIPMENT, NOW.toISOString()).kind, "conflict");
  assert.equal(resolveCateringEquipmentDelete(EQUIPMENT, version).kind, "delete");
});

/* ------------------------------------------------------------------------------------------------------------- *
 * Access instructions
 * ------------------------------------------------------------------------------------------------------------- */

test("an access save's precondition covers both creating and updating the record", () => {
  // No record and no version: this is the create, and it is allowed.
  assert.equal(resolveCateringAccessSave({ existing: undefined }, { parkingInstructions: "Rear lot" }).kind, "save");
  // No record but a version: the client believes in a record that does not exist.
  assert.equal(resolveCateringAccessSave({ existing: undefined }, { parkingInstructions: "x", expectedUpdatedAt: version }).kind, "conflict");
  // A record but no version: two tabs both tried to create it, and the second must not clobber the first.
  assert.equal(resolveCateringAccessSave({ existing: { updatedAt: VERSION } }, { parkingInstructions: "x" }).kind, "conflict");
  // A record and a stale version.
  assert.equal(resolveCateringAccessSave({ existing: { updatedAt: VERSION } }, { parkingInstructions: "x", expectedUpdatedAt: NOW.toISOString() }).kind, "conflict");
  assert.equal(resolveCateringAccessSave({ existing: { updatedAt: VERSION } }, { parkingInstructions: "x", expectedUpdatedAt: version }).kind, "save");
  assert.equal(resolveCateringAccessSave(null, { parkingInstructions: "x" }).kind, "read_only");
});

test("a purely provider-private access edit writes no history and notifies nobody", () => {
  const outcome = resolveCateringAccessSave({ existing: { updatedAt: VERSION, parkingInstructions: "Rear lot", providerPrivateNotes: "old" } }, { providerPrivateNotes: "The site manager is unreliable", expectedUpdatedAt: version });
  assert.equal(outcome.kind === "save" && outcome.activity, false);
  assert.equal(outcome.kind === "save" && outcome.notify, false);
  assert.deepEqual(cateringAccessSharedChanges({ providerPrivateNotes: "old" }, { providerPrivateNotes: "new" }), []);
});

test("a shared instruction change writes history and notifies; a confirmation writes history alone", () => {
  const instruction = resolveCateringAccessSave({ existing: { updatedAt: VERSION, parkingInstructions: "Front" } }, { parkingInstructions: "Rear lot", expectedUpdatedAt: version });
  assert.equal(instruction.kind === "save" && instruction.activity, true);
  assert.equal(instruction.kind === "save" && instruction.notify, true);
  // Confirming access is what clears the customer's blocker, so it is customer-visible history -- but a provider
  // ticking their own confirmation is not something to push at the customer.
  const confirmation = resolveCateringAccessSave({ existing: { updatedAt: VERSION, accessConfirmed: false } }, { accessConfirmed: true, expectedUpdatedAt: version });
  assert.equal(confirmation.kind === "save" && confirmation.activity, true);
  assert.equal(confirmation.kind === "save" && confirmation.notify, false);
  // Re-saving identical values is not a change, so it writes nothing and notifies nobody -- which is what makes a
  // retried access save harmless.
  const unchanged = resolveCateringAccessSave({ existing: { updatedAt: VERSION, parkingInstructions: "Rear lot", accessConfirmed: true } }, { parkingInstructions: "Rear lot", accessConfirmed: true, expectedUpdatedAt: version });
  assert.equal(unchanged.kind === "save" && unchanged.activity, false);
  assert.equal(unchanged.kind === "save" && unchanged.notify, false);
});

/* ------------------------------------------------------------------------------------------------------------- *
 * Milestones
 * ------------------------------------------------------------------------------------------------------------- */

test("a milestone is state, so completing it twice produces one row, one instant and one activity row", () => {
  const first = resolveCateringMilestoneToggle(undefined, { completed: true }, NOW);
  assert.equal(first.kind, "create");
  assert.equal(first.kind === "create" && first.completedAt?.getTime(), NOW.getTime());
  assert.equal(first.kind === "create" && first.activity, true);
  // The retry -- with the version the first attempt produced -- asserts a state the row already holds.
  const retry = resolveCateringMilestoneToggle({ completedAt: NOW, updatedAt: NOW }, { completed: true, expectedUpdatedAt: NOW.toISOString() }, new Date("2026-09-08T13:00:00.000Z"));
  assert.deepEqual(retry, { kind: "unchanged" });
  assert.equal("completedAt" in retry, false, "nothing to write, so the original instant survives");
  assert.equal("activity" in retry, false, "and no second activity row");
});

test("a first touch that asks for 'not completed' still creates the row, with no activity", () => {
  const outcome = resolveCateringMilestoneToggle(undefined, { completed: false }, NOW);
  assert.equal(outcome.kind, "create");
  assert.equal(outcome.kind === "create" && outcome.completedAt, null);
  assert.equal(outcome.kind === "create" && outcome.activity, false);
});

test("an undo is applied but not recorded, and a stale undo is refused outright", () => {
  const undo = resolveCateringMilestoneToggle({ completedAt: VERSION, updatedAt: VERSION }, { completed: false, expectedUpdatedAt: version }, NOW);
  assert.equal(undo.kind, "update");
  assert.equal(undo.kind === "update" && undo.completedAt, null);
  assert.equal(undo.kind === "update" && undo.activity, false);
  // Another device already moved this milestone on, so an undo composed against the older state refuses.
  assert.equal(resolveCateringMilestoneToggle({ completedAt: VERSION, updatedAt: VERSION }, { completed: false, expectedUpdatedAt: NOW.toISOString() }, NOW).kind, "conflict");
  // And a "create" against a row that already exists is a conflict, not a silent overwrite.
  assert.equal(resolveCateringMilestoneToggle({ completedAt: null, updatedAt: VERSION }, { completed: true }, NOW).kind, "conflict");
});

/* ------------------------------------------------------------------------------------------------------------- *
 * Readiness facts
 * ------------------------------------------------------------------------------------------------------------- */

const timelineRow = (visibility: string, isBlocker = false, completedAt: Date | null = null) => ({ visibility, isBlocker, completedAt });
const equipmentRow = (visibility: string, status: string, isBlocker = false) => ({ visibility, isBlocker, status });

const ROWS = {
  timeline: [timelineRow("shared"), timelineRow("provider_private", true), timelineRow("shared", true, NOW)],
  equipment: [equipmentRow("shared", "confirmed"), equipmentRow("provider_private", "planned", true)],
  staffCount: 3,
  access: { accessConfirmed: true, parkingInstructions: "Rear lot", providerPrivateNotes: "Site manager is unreliable" },
  outstandingSharedRequirementCount: 0,
  guestCount: 80,
};

test("a customer's facts are reduced from shared records alone", () => {
  const customer = cateringReadinessFacts(ROWS, "customer");
  assert.equal(customer.timelineItemCount, 2, "the provider-private item is not counted");
  assert.equal(customer.staffAssignmentCount, 0, "crew is never part of a customer's facts");
  assert.equal(customer.unconfirmedEquipmentCount, 0, "the private planned rental is not counted");
  assert.equal(customer.blockingEquipmentCount, 0, "and neither is the private blocking one");
  assert.equal(customer.openBlockingTimelineCount, 0, "the private blocker is invisible, and the shared one is complete");
  const provider = cateringReadinessFacts(ROWS, "provider");
  assert.equal(provider.timelineItemCount, 3);
  assert.equal(provider.staffAssignmentCount, 3);
  assert.equal(provider.blockingEquipmentCount, 1);
  assert.equal(provider.openBlockingTimelineCount, 1);
});

test("a provider-private blocker cannot move a single number a customer receives", () => {
  const withoutPrivate = { ...ROWS, timeline: [timelineRow("shared")], equipment: [equipmentRow("shared", "confirmed")] };
  const withPrivate = {
    ...withoutPrivate,
    timeline: [...withoutPrivate.timeline, timelineRow("provider_private", true)],
    equipment: [...withoutPrivate.equipment, equipmentRow("provider_private", "planned", true)],
    staffCount: 0,
  };
  assert.deepEqual(cateringReadinessFacts(withPrivate, "customer"), cateringReadinessFacts(withoutPrivate, "customer"));
  // And therefore the whole derived summary is identical, state and blockers included.
  assert.deepEqual(
    deriveCateringReadiness(cateringReadinessFacts(withPrivate, "customer"), "customer"),
    deriveCateringReadiness(cateringReadinessFacts(withoutPrivate, "customer"), "customer"),
  );
  // While the provider's own summary does see it, which is the whole point of recording it.
  assert.equal(deriveCateringReadiness(cateringReadinessFacts(withPrivate, "provider"), "provider").state, "blocked");
});

test("only a SHARED access instruction satisfies the instructions-present signal", () => {
  const privateOnly = { ...ROWS, access: { accessConfirmed: true, providerPrivateNotes: "Only a private note" } };
  assert.equal(cateringReadinessFacts(privateOnly, "customer").hasSharedAccessInstructions, false);
  assert.equal(cateringReadinessFacts(privateOnly, "provider").hasSharedAccessInstructions, false, "a private note is never an instruction, even for the provider's own signal");
  assert.equal(cateringReadinessFacts(ROWS, "customer").hasSharedAccessInstructions, true);
  // Whitespace is not an instruction either.
  assert.equal(cateringReadinessFacts({ ...ROWS, access: { accessConfirmed: true, parkingInstructions: "   " } }, "customer").hasSharedAccessInstructions, false);
});

test("access confirmation is an explicit assertion, never inferred from the notes being non-empty", () => {
  const unconfirmed = { ...ROWS, access: { accessConfirmed: false, parkingInstructions: "Rear lot" } };
  assert.equal(cateringReadinessFacts(unconfirmed, "customer").venueAccessConfirmed, false);
  assert.equal(deriveCateringReadiness(cateringReadinessFacts(unconfirmed, "customer"), "customer").state, "blocked");
  // And a booking with no access record at all is blocked rather than quietly ready.
  assert.equal(cateringReadinessFacts({ ...ROWS, access: undefined }, "customer").venueAccessConfirmed, false);
});

test("the guest count comes from the booking, and a missing one blocks both actors", () => {
  for (const guestCount of [null, 0]) {
    const facts = cateringReadinessFacts({ ...ROWS, guestCount }, "customer");
    assert.equal(facts.guestCountRecorded, false, String(guestCount));
    assert.equal(deriveCateringReadiness(facts, "customer").blockers.some((entry) => entry.signal === "guest_count"), true);
  }
  assert.equal(cateringReadinessFacts(ROWS, "customer").guestCountRecorded, true);
});

test("outstanding shared Phase 2H requirements reach both actors' readiness identically", () => {
  const rows = { ...ROWS, outstandingSharedRequirementCount: 2 };
  for (const role of ["provider", "customer"] as const) {
    const readiness = deriveCateringReadiness(cateringReadinessFacts(rows, role), role);
    assert.equal(readiness.signals.find((signal) => signal.signal === "shared_requirements")?.state, "needs_attention", role);
  }
});


/* ================================================================================================================ *
 * P2 -- provenance is not an instruction
 * ================================================================================================================ */

/**
 * `venueContactSource` says WHOSE a contact detail is. It is not a contact detail, and it is not an instruction.
 *
 * Readiness used to read every customer-visible access field, which is a different question -- "what may a customer
 * see" rather than "what actually tells somebody how to get in". Because provenance is customer-visible, a provider
 * who only picked "supplied by the customer" in the dropdown and ticked confirmed produced `venue_access: ready`
 * with no entrance, no window, no parking, no notes and nobody to call. The presence check now runs off a dedicated
 * instruction list.
 */
const accessOnly = (access: Record<string, unknown> | undefined) => ({ ...ROWS, access: access as never });
const venueAccessState = (access: Record<string, unknown> | undefined, role: "provider" | "customer" = "customer") =>
  deriveCateringReadiness(cateringReadinessFacts(accessOnly(access), role), role).signals.find((signal) => signal.signal === "venue_access")!.state;

test("P2: confirmed with ONLY a contact source is not ready", () => {
  const sourceOnly = { accessConfirmed: true, venueContactSource: "customer" };
  assert.equal(cateringReadinessFacts(accessOnly(sourceOnly), "customer").hasSharedAccessInstructions, false);
  assert.equal(cateringReadinessFacts(accessOnly(sourceOnly), "provider").hasSharedAccessInstructions, false);
  // Confirmed, so not blocked -- but there is nothing written down, so it needs attention rather than being ready.
  assert.equal(venueAccessState(sourceOnly), "needs_attention");
  assert.equal(venueAccessState(sourceOnly, "provider"), "needs_attention");
  // The provider's own choice is the counterfactual: it USED to be enough on its own.
  assert.equal((CATERING_ACCESS_SHARED_FIELDS as readonly string[]).includes("venueContactSource"), true, "still customer-visible");
  assert.equal((CATERING_ACCESS_INSTRUCTION_FIELDS as readonly string[]).includes("venueContactSource"), false, "but no longer evidence");
});

test("P2: a source paired with a real contact name is present", () => {
  const named = { accessConfirmed: true, venueContactSource: "customer", venueContactName: "Sam" };
  assert.equal(cateringReadinessFacts(accessOnly(named), "customer").hasSharedAccessInstructions, true);
  assert.equal(venueAccessState(named), "ready");
  // It is the NAME that satisfies it, not the pairing: the same record without a source is equally present.
  assert.equal(cateringReadinessFacts(accessOnly({ accessConfirmed: true, venueContactName: "Sam" }), "customer").hasSharedAccessInstructions, true);
});

test("P2: a source paired with a real contact phone is present", () => {
  const phoned = { accessConfirmed: true, venueContactSource: "provider", venueContactPhone: "555-0100" };
  assert.equal(cateringReadinessFacts(accessOnly(phoned), "customer").hasSharedAccessInstructions, true);
  assert.equal(venueAccessState(phoned), "ready");
  assert.equal(cateringReadinessFacts(accessOnly({ accessConfirmed: true, venueContactPhone: "555-0100" }), "customer").hasSharedAccessInstructions, true);
});

test("P2: any genuine shared instruction is present, and every instruction field counts", () => {
  assert.equal(venueAccessState({ accessConfirmed: true, loadInEntrance: "Rear dock" }), "ready");
  // Every field on the list satisfies it on its own, so none of them is silently inert.
  for (const field of CATERING_ACCESS_INSTRUCTION_FIELDS) {
    const only = { accessConfirmed: true, [field]: field.startsWith("accessWindow") ? "08:00" : "Something the crew needs" };
    assert.equal(cateringReadinessFacts(accessOnly(only), "customer").hasSharedAccessInstructions, true, field);
    assert.equal(venueAccessState(only), "ready", field);
  }
});

test("P2: a private note alone still cannot make shared access ready, for either actor", () => {
  const privateOnly = { accessConfirmed: true, providerPrivateNotes: "The site manager is unreliable" };
  assert.equal(cateringReadinessFacts(accessOnly(privateOnly), "customer").hasSharedAccessInstructions, false);
  assert.equal(cateringReadinessFacts(accessOnly(privateOnly), "provider").hasSharedAccessInstructions, false);
  assert.equal(venueAccessState(privateOnly), "needs_attention");
  assert.equal(venueAccessState(privateOnly, "provider"), "needs_attention");
  // Nor combined with provenance, which is the two non-instructions added together.
  assert.equal(venueAccessState({ ...privateOnly, venueContactSource: "provider" }), "needs_attention");
});

test("P2: unconfirmed keeps its blocked semantics however much is written down", () => {
  assert.equal(venueAccessState({ accessConfirmed: false, loadInEntrance: "Rear dock", venueContactName: "Sam" }), "blocked");
  assert.equal(venueAccessState({ accessConfirmed: false, venueContactSource: "customer" }), "blocked");
  assert.equal(venueAccessState(undefined), "blocked", "and no record at all is blocked, not quietly ready");
});

test("P2: confirmed with no meaningful shared content needs attention", () => {
  assert.equal(venueAccessState({ accessConfirmed: true }), "needs_attention");
  // Whitespace is not content, in any of the fields.
  assert.equal(venueAccessState({ accessConfirmed: true, parkingInstructions: "   ", loadInEntrance: "" }), "needs_attention");
  // Nor is a non-string that somehow reached one of these columns.
  assert.equal(venueAccessState({ accessConfirmed: true, loadInEntrance: 7 }), "needs_attention");
});

test("P2 audit: no other readiness fact treats metadata or a private field as content", () => {
  // The instruction list is the shared list minus provenance, and nothing else -- so no customer-visible field of
  // substance was dropped along with it.
  assert.deepEqual(
    [...CATERING_ACCESS_INSTRUCTION_FIELDS].sort(),
    (CATERING_ACCESS_SHARED_FIELDS as readonly string[]).filter((field) => field !== "venueContactSource").sort(),
  );
  // And it names no provenance, status, flag or private field of any kind.
  for (const field of CATERING_ACCESS_INSTRUCTION_FIELDS) {
    assert.equal(/source|confirmed|private|status|type|visibility|count|order/i.test(field), false, field);
  }

  // The remaining facts, each checked for the same mistake -- something that is not the required information
  // making a section look complete.
  //
  //  - `timelineItemCount` and `staffAssignmentCount` count ROWS, and a row cannot exist without its substance: the
  //    schema requires a non-empty title and a non-empty worker name respectively. There is no empty record to
  //    count. Asserted here so a relaxed schema would break this test rather than readiness.
  assert.throws(() => cateringTimelineCreateSchema.parse({ title: "   ", category: "load_in", visibility: "shared", isBlocker: false }));
  assert.throws(() => cateringStaffCreateSchema.parse({ workerName: "   ", role: "chef" }));
  //  - `venueAccessConfirmed` IS a boolean flag, and it is deliberately never sufficient: it gates the signal and
  //    the instruction check has to pass as well. Proven directly above.
  assert.equal(venueAccessState({ accessConfirmed: true }), "needs_attention");
  //  - the equipment counts read `status` and `isBlocker`, which are the substance of an equipment row rather than
  //    metadata about it, and they only ever make a signal WORSE. An empty collection is ready because there is
  //    genuinely nothing to confirm, which is a stated rule rather than an accident.
  assert.equal(cateringReadinessFacts({ ...ROWS, equipment: [] }, "customer").unconfirmedEquipmentCount, 0);
  assert.equal(cateringReadinessFacts({ ...ROWS, equipment: [] }, "customer").blockingEquipmentCount, 0);
  //  - `guestCountRecorded` already refuses a null and a zero rather than accepting "a number is present".
  for (const guestCount of [null, 0]) assert.equal(cateringReadinessFacts({ ...ROWS, guestCount }, "customer").guestCountRecorded, false);
  //  - `outstandingSharedRequirementCount` is a count of Phase 2H rows supplied by the caller and is not derived
  //    from any execution field, so there is no metadata here to mistake for content.
  assert.equal(cateringReadinessFacts({ ...ROWS, outstandingSharedRequirementCount: 2 }, "customer").outstandingSharedRequirementCount, 2);
});
