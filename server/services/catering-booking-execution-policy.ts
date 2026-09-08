import type { CateringBookingStatus } from "@shared/catering-bookings";
import { CATERING_WORKSPACE_READ_ONLY_CODE } from "@shared/catering-booking-operations";
import {
  CATERING_ACCESS_SHARED_FIELDS,
  CATERING_EXECUTION_EQUIPMENT_LIMIT,
  CATERING_EXECUTION_NOT_FOUND_CODE,
  CATERING_EXECUTION_NOT_FOUND_MESSAGE,
  CATERING_EXECUTION_READ_ONLY_MESSAGE,
  CATERING_EXECUTION_SET_CHANGED_CODE,
  CATERING_EXECUTION_SET_CHANGED_MESSAGE,
  CATERING_EXECUTION_STAFF_LIMIT,
  CATERING_EXECUTION_TIMELINE_LIMIT,
  CATERING_EXECUTION_VERSION_CONFLICT_CODE,
  CATERING_EXECUTION_VERSION_CONFLICT_MESSAGE,
  cateringEquipmentIsSettled,
  cateringEquipmentIsUnconfirmed,
  cateringExecutionActivityVisibility,
  cateringExecutionVisibleTo,
  deriveCateringReadiness,
  mayMutateCateringExecution,
  type CateringAccessSharedField,
  type CateringEquipmentStatus,
  type CateringExecutionVisibility,
  type CateringReadinessFacts,
} from "@shared/catering-booking-execution";

export { cateringExecutionActivityVisibility, cateringExecutionVisibleTo, deriveCateringReadiness, mayMutateCateringExecution };

/**
 * Why an execution mutation was refused before any transaction is opened.
 *
 * Exactly as Phase 2H does it, and for the same reason: "you may not write here" answers one boolean for two
 * unrelated situations the client must tell apart. A terminal booking means the workspace on screen is stale and
 * needs an authoritative refresh; a customer attempting a provider mutation means the opposite -- the workspace is
 * fine and refetching it would change nothing. Status is decided FIRST, so a terminal booking is reported as
 * read-only whoever asked, and only an otherwise-editable booking can refuse an actor.
 */
export function cateringExecutionGuard(status: CateringBookingStatus, role: "provider" | "customer"): "allowed" | "read_only" | "forbidden" {
  if (status !== "pending_confirmation" && status !== "confirmed") return "read_only";
  return mayMutateCateringExecution(status, role) ? "allowed" : "forbidden";
}

/** How a refused execution write answers: the truthful message, plus the code the client classifies it by. */
export type CateringExecutionRefusal = { message: string; code?: string };
/**
 * The one early terminal-status refusal every execution mutation answers with. It carries the same canonical code
 * the locked read-only race returns and the same code every other workspace section uses, so a booking that was
 * already terminal when the request arrived and one that became terminal under the lock are indistinguishable to
 * the client: both mean refetch.
 */
export const CATERING_EXECUTION_READ_ONLY_REFUSAL = { status: 409, message: CATERING_EXECUTION_READ_ONLY_MESSAGE, code: CATERING_WORKSPACE_READ_ONLY_CODE } as const;
/** A record the actor may mutate but that no longer exists stays a 404, and never becomes a fabricated conflict. */
export const CATERING_EXECUTION_NOT_FOUND_REFUSAL = { status: 404, message: CATERING_EXECUTION_NOT_FOUND_MESSAGE, code: CATERING_EXECUTION_NOT_FOUND_CODE } as const;
export const CATERING_EXECUTION_CONFLICT_REFUSAL = { status: 409, message: CATERING_EXECUTION_VERSION_CONFLICT_MESSAGE, code: CATERING_EXECUTION_VERSION_CONFLICT_CODE } as const;
export const CATERING_EXECUTION_SET_CHANGED_REFUSAL = { status: 409, message: CATERING_EXECUTION_SET_CHANGED_MESSAGE, code: CATERING_EXECUTION_SET_CHANGED_CODE } as const;
/** Each refused create says what actually happened; a read-only booking is never reported as a full collection. */
export const CATERING_EXECUTION_LIMIT_MESSAGES = {
  timeline: `A booking may have at most ${CATERING_EXECUTION_TIMELINE_LIMIT} run-of-show items`,
  staff: `A booking may have at most ${CATERING_EXECUTION_STAFF_LIMIT} crew assignments`,
  equipment: `A booking may have at most ${CATERING_EXECUTION_EQUIPMENT_LIMIT} equipment records`,
} as const;
export const CATERING_EXECUTION_COLLECTION_LIMITS = {
  timeline: CATERING_EXECUTION_TIMELINE_LIMIT,
  staff: CATERING_EXECUTION_STAFF_LIMIT,
  equipment: CATERING_EXECUTION_EQUIPMENT_LIMIT,
} as const;
export type CateringExecutionCollection = keyof typeof CATERING_EXECUTION_COLLECTION_LIMITS;

/**
 * The optimistic-concurrency comparison every execution mutation uses.
 *
 * It compares the INSTANT rather than its spelling, so a client that round-trips the serialized `updatedAt` through
 * any equivalent ISO form still matches, while a value from an older version does not. A malformed or missing
 * precondition is a mismatch, never a pass: this fails closed.
 */
export function cateringExecutionVersionMatches(current: { updatedAt: Date }, expectedUpdatedAt: string | undefined): boolean {
  if (expectedUpdatedAt === undefined) return false;
  const expected = Date.parse(expectedUpdatedAt);
  return Number.isFinite(expected) && expected === current.updatedAt.getTime();
}

/** The locked collection a create is measured against; absent once the booking is no longer active. */
export type CateringLockedExecutionCounts = { itemCount: number; maxSortOrder: number | null };
export function nextCateringExecutionSortOrder(maxSortOrder: number | null): number {
  return maxSortOrder == null ? 0 : maxSortOrder + 1;
}

/* ------------------------------------------------------------------------------------------------------------- *
 * Run-of-show timeline
 * ------------------------------------------------------------------------------------------------------------- */

/** The timeline activity events, which exist only for records a customer can actually see. */
export type CateringTimelineActivity = { eventType: "execution_timeline_added" | "execution_timeline_updated" | "execution_timeline_completed" | "execution_timeline_removed"; title: string } | null;

/**
 * Resolves a locked timeline create into three distinct outcomes.
 *
 * A booking that went read-only under the lock and a full run-of-show are different refusals with different truthful
 * messages, and only "create" inserts anything. The sort order is derived from the locked collection, never from the
 * request, so a client cannot claim a position -- reordering is its own versioned operation.
 */
export function resolveCateringTimelineCreate(locked: CateringLockedExecutionCounts | null, input: { title: string; visibility: CateringExecutionVisibility }) {
  if (!locked) return { kind: "read_only" } as const;
  if (locked.itemCount >= CATERING_EXECUTION_TIMELINE_LIMIT) return { kind: "limit" } as const;
  const shared = input.visibility === "shared";
  return {
    kind: "create",
    sortOrder: nextCateringExecutionSortOrder(locked.maxSortOrder),
    // A provider-private item writes no activity at all: there is no customer-visible history for a record the
    // customer may not see, and a private event row would be one more thing that must never be mis-filtered.
    activity: (shared ? { eventType: "execution_timeline_added", title: input.title } : null) as CateringTimelineActivity,
    // Only a genuinely shared new item is worth interrupting the customer for.
    notify: shared,
  } as const;
}

/** Every timeline column a PATCH may persist. Activity and notifications are derived from these and nothing else. */
export const CATERING_TIMELINE_PATCH_FIELDS = ["title", "description", "category", "scheduledTime", "endTime", "visibility", "isBlocker", "completed"] as const;
export type CateringTimelinePatchField = typeof CATERING_TIMELINE_PATCH_FIELDS[number];
/**
 * The fields whose change MATERIALLY alters the plan a customer is working from.
 *
 * A description tidy-up, a blocker flag or a completion tick during service are all real edits that write history,
 * but none of them is worth a push to the customer's notifications -- and completion in particular would fire once
 * per item during the event itself. Notifying on this narrow set is what keeps "the timeline changed" meaningful.
 */
export const CATERING_TIMELINE_MATERIAL_FIELDS: readonly CateringTimelinePatchField[] = ["title", "category", "scheduledTime", "endTime"];

export type CateringTimelinePersistedState = {
  title: string; description: string | null; category: string;
  scheduledTime: string | null; endTime: string | null;
  visibility: string; isBlocker: boolean; completed: boolean;
};
export type CateringTimelinePatchInput = Partial<CateringTimelinePersistedState>;

/** Applies a validated patch to the authoritative locked row. Absent request fields keep the persisted value. */
export function nextCateringTimelineState(current: CateringTimelinePersistedState, input: CateringTimelinePatchInput): CateringTimelinePersistedState {
  const next = { ...current };
  for (const field of CATERING_TIMELINE_PATCH_FIELDS) if (field in input && input[field] !== undefined) (next as Record<string, unknown>)[field] = input[field];
  return next;
}
/** Field presence in a request is not a change. Only a differing persisted value is. */
export function cateringTimelinePersistedChanges(current: CateringTimelinePersistedState, next: CateringTimelinePersistedState): CateringTimelinePatchField[] {
  return CATERING_TIMELINE_PATCH_FIELDS.filter((field) => (next[field] ?? null) !== (current[field] ?? null));
}

/**
 * The activity a timeline edit earns, decided entirely by what the CUSTOMER can now see.
 *
 *  - private -> shared: the item appears in the customer's plan for the first time, so it reads as ADDED, not
 *    updated. Anything else would refer to a history the customer never had.
 *  - shared -> private: it disappears from their plan, which is a removal from their point of view. The item still
 *    exists for the provider; the event describes the shared plan, not the row.
 *  - shared -> shared: a first completion reads as completed, any other change as updated.
 *  - private -> private: nothing at all. A private edit has no customer-visible history and writes no row, which is
 *    also what keeps private churn out of the activity feed entirely.
 */
export function cateringTimelineActivityFor(current: CateringTimelinePersistedState, next: CateringTimelinePersistedState, changed: readonly CateringTimelinePatchField[]): CateringTimelineActivity {
  if (changed.length === 0) return null;
  const wasShared = current.visibility === "shared";
  const isShared = next.visibility === "shared";
  if (!wasShared && !isShared) return null;
  if (!wasShared && isShared) return { eventType: "execution_timeline_added", title: next.title };
  if (wasShared && !isShared) return { eventType: "execution_timeline_removed", title: current.title };
  if (changed.includes("completed") && next.completed) return { eventType: "execution_timeline_completed", title: next.title };
  return { eventType: "execution_timeline_updated", title: next.title };
}
/**
 * Whether a timeline edit is worth a customer notification.
 *
 * Only a change to the shared plan's SHAPE qualifies: an item entering or leaving it, or one of the material fields
 * moving on an item that is shared both before and after. A provider-private edit can never qualify, because
 * neither side of it is shared.
 */
export function shouldNotifyCateringTimelineChange(current: CateringTimelinePersistedState, next: CateringTimelinePersistedState, changed: readonly CateringTimelinePatchField[]): boolean {
  if (changed.length === 0) return false;
  const wasShared = current.visibility === "shared";
  const isShared = next.visibility === "shared";
  if (!wasShared && !isShared) return false;
  if (wasShared !== isShared) return true;
  return changed.some((field) => CATERING_TIMELINE_MATERIAL_FIELDS.includes(field));
}

/** The authoritative persisted version of a timeline row, used only as an optimistic-concurrency precondition. */
export type CateringTimelineVersionedState = CateringTimelinePersistedState & { updatedAt: Date; completedAt: Date | null };
/**
 * Everything a timeline PATCH may do, decided against the authoritative row loaded inside the collection lock.
 *
 * A stale precondition resolves to a conflict that carries no next state, no timestamps, no activity and no
 * notification, so the route has nothing to write: the row, its `updatedAt`, its `completedAt` and the booking
 * history all stay exactly as they were. An edit whose fields are all already persisted resolves to "unchanged" and
 * likewise writes nothing -- so a retried PATCH neither bumps a version nor produces a second activity row.
 */
export function resolveCateringTimelinePatch(current: CateringTimelineVersionedState, input: CateringTimelinePatchInput & { expectedUpdatedAt: string }, now: Date) {
  if (!cateringExecutionVersionMatches(current, input.expectedUpdatedAt)) return { kind: "conflict" } as const;
  const next = nextCateringTimelineState(current, input);
  const changed = cateringTimelinePersistedChanges(current, next);
  if (changed.length === 0) return { kind: "unchanged" } as const;
  return {
    kind: "update",
    next,
    // Completion timestamps move only on a real transition, never on a repeated state.
    completedAt: next.completed === current.completed ? current.completedAt : next.completed ? now : null,
    updatedAt: now,
    activity: cateringTimelineActivityFor(current, next, changed),
    notify: shouldNotifyCateringTimelineChange(current, next, changed),
  } as const;
}
/**
 * Resolves a locked timeline delete. A stale precondition conflicts and carries no activity, so the route removes
 * nothing and writes no customer-visible history for an item the provider never saw in its current state.
 */
export function resolveCateringTimelineDelete(current: { updatedAt: Date; title: string; visibility: string }, expectedUpdatedAt: string) {
  if (!cateringExecutionVersionMatches(current, expectedUpdatedAt)) return { kind: "conflict" } as const;
  const shared = current.visibility === "shared";
  return {
    kind: "delete",
    activity: (shared ? { eventType: "execution_timeline_removed", title: current.title } : null) as CateringTimelineActivity,
    notify: shared,
  } as const;
}

export type CateringTimelineReorderEntry = { id: string; expectedUpdatedAt: string };
export type CateringLockedTimelineVersion = { id: string; updatedAt: Date };
/**
 * Resolves a locked reorder into four distinct outcomes, in the order the route must decide them: a booking that
 * went read-only under the lock, a submission that is not the complete current set, a stale version on any item, and
 * only then the reorder itself.
 *
 * The advisory lock alone serializes two reorders but cannot tell that the second was composed against an order the
 * first already replaced, so every item carries a version precondition and ONE stale entry refuses the whole
 * request. A refusal carries no updates, no timestamps and no activity: every sortOrder and every updatedAt stays
 * exactly as it was, which is what stops a stale drag from silently undoing somebody else's newer edits.
 *
 * The submitted collection is the provider's OWN complete set. There is no customer reorder, so this never has to
 * reason about a partial view of the timeline.
 */
export function resolveCateringTimelineReorder(locked: readonly CateringLockedTimelineVersion[] | null, submitted: readonly CateringTimelineReorderEntry[]) {
  if (!locked) return { kind: "read_only" } as const;
  const submittedIds = new Set(submitted.map((entry) => entry.id));
  // Exact membership in both directions, so neither a duplicate nor an item missing from the request slips through.
  if (submittedIds.size !== submitted.length || submitted.length !== locked.length || locked.some((item) => !submittedIds.has(item.id))) return { kind: "membership" } as const;
  const versions = new Map(locked.map((item) => [item.id, item.updatedAt]));
  if (submitted.some((entry) => !cateringExecutionVersionMatches({ updatedAt: versions.get(entry.id)! }, entry.expectedUpdatedAt))) return { kind: "conflict" } as const;
  // The submitted POSITION is the sort order. A client-supplied sortOrder is never read, only the array index.
  return { kind: "reorder", updates: submitted.map((entry, sortOrder) => ({ id: entry.id, sortOrder })) } as const;
}

/* ------------------------------------------------------------------------------------------------------------- *
 * Crew assignments
 * ------------------------------------------------------------------------------------------------------------- */

/**
 * Crew mutations produce NO activity and NO notification in any branch, by construction rather than by filtering.
 * Staffing is provider-private in every channel, so there is no customer-visible history it could write and no
 * customer event it could fire -- an internal crew failure cannot reach the customer because nothing on this path
 * ever writes anywhere the customer reads.
 */
export function resolveCateringStaffCreate(locked: CateringLockedExecutionCounts | null) {
  if (!locked) return { kind: "read_only" } as const;
  if (locked.itemCount >= CATERING_EXECUTION_STAFF_LIMIT) return { kind: "limit" } as const;
  return { kind: "create" } as const;
}
export const CATERING_STAFF_PATCH_FIELDS = ["workerName", "role", "customRole", "contactNote", "arrivalTime", "departureTime", "responsibilityNote"] as const;
export type CateringStaffPatchField = typeof CATERING_STAFF_PATCH_FIELDS[number];
export type CateringStaffPersistedState = { workerName: string; role: string; customRole: string | null; contactNote: string | null; arrivalTime: string | null; departureTime: string | null; responsibilityNote: string | null };
export function nextCateringStaffState(current: CateringStaffPersistedState, input: Partial<CateringStaffPersistedState>): CateringStaffPersistedState {
  const next = { ...current };
  for (const field of CATERING_STAFF_PATCH_FIELDS) if (field in input && input[field] !== undefined) (next as Record<string, unknown>)[field] = input[field];
  return next;
}
export function cateringStaffPersistedChanges(current: CateringStaffPersistedState, next: CateringStaffPersistedState): CateringStaffPatchField[] {
  return CATERING_STAFF_PATCH_FIELDS.filter((field) => (next[field] ?? null) !== (current[field] ?? null));
}
/**
 * A crew role must remain coherent AFTER the merge, not merely in the request.
 *
 * Patching `role` to `custom` without a label, or patching a `custom` assignment's role to `chef` while leaving the
 * old custom label behind, both produce a row the database CHECK would reject. Deciding it here means the refusal
 * is a truthful 400 rather than a constraint violation surfacing as a 500.
 */
export function cateringStaffStateIsCoherent(next: CateringStaffPersistedState): boolean {
  return next.role === "custom" ? Boolean(next.customRole && next.customRole.trim()) : !next.customRole;
}
/** And the merged times must still run forwards, for exactly the same reason. */
export function cateringStaffTimesAreOrdered(next: CateringStaffPersistedState): boolean {
  return next.arrivalTime == null || next.departureTime == null || next.arrivalTime <= next.departureTime;
}
export function resolveCateringStaffPatch(current: CateringStaffPersistedState & { updatedAt: Date }, input: Partial<CateringStaffPersistedState> & { expectedUpdatedAt: string }, now: Date) {
  if (!cateringExecutionVersionMatches(current, input.expectedUpdatedAt)) return { kind: "conflict" } as const;
  const next = nextCateringStaffState(current, input);
  if (!cateringStaffStateIsCoherent(next)) return { kind: "invalid_role" } as const;
  if (!cateringStaffTimesAreOrdered(next)) return { kind: "invalid_time_range" } as const;
  if (cateringStaffPersistedChanges(current, next).length === 0) return { kind: "unchanged" } as const;
  return { kind: "update", next, updatedAt: now } as const;
}
export function resolveCateringStaffDelete(current: { updatedAt: Date }, expectedUpdatedAt: string) {
  if (!cateringExecutionVersionMatches(current, expectedUpdatedAt)) return { kind: "conflict" } as const;
  return { kind: "delete" } as const;
}
export const CATERING_STAFF_PATCH_REFUSALS: Record<"invalid_role" | "invalid_time_range", string> = {
  invalid_role: "A custom crew role must be named, and a listed role must not carry one",
  invalid_time_range: "Crew departure time must not precede arrival time",
};

/* ------------------------------------------------------------------------------------------------------------- *
 * Equipment
 * ------------------------------------------------------------------------------------------------------------- */

export type CateringEquipmentActivity = { eventType: "shared_equipment_added" | "shared_equipment_status_changed"; name: string } | null;
export function resolveCateringEquipmentCreate(locked: CateringLockedExecutionCounts | null, input: { name: string; visibility: CateringExecutionVisibility }) {
  if (!locked) return { kind: "read_only" } as const;
  if (locked.itemCount >= CATERING_EXECUTION_EQUIPMENT_LIMIT) return { kind: "limit" } as const;
  return {
    kind: "create",
    activity: (input.visibility === "shared" ? { eventType: "shared_equipment_added", name: input.name } : null) as CateringEquipmentActivity,
  } as const;
}
export const CATERING_EQUIPMENT_PATCH_FIELDS = ["name", "quantity", "sourceType", "sourceName", "pickupDate", "pickupTime", "returnDate", "returnTime", "status", "isBlocker", "notes", "visibility"] as const;
export type CateringEquipmentPatchField = typeof CATERING_EQUIPMENT_PATCH_FIELDS[number];
export type CateringEquipmentPersistedState = {
  name: string; quantity: number; sourceType: string; sourceName: string | null;
  pickupDate: string | null; pickupTime: string | null; returnDate: string | null; returnTime: string | null;
  status: string; isBlocker: boolean; notes: string | null; visibility: string;
};
export function nextCateringEquipmentState(current: CateringEquipmentPersistedState, input: Partial<CateringEquipmentPersistedState>): CateringEquipmentPersistedState {
  const next = { ...current };
  for (const field of CATERING_EQUIPMENT_PATCH_FIELDS) if (field in input && input[field] !== undefined) (next as Record<string, unknown>)[field] = input[field];
  return next;
}
export function cateringEquipmentPersistedChanges(current: CateringEquipmentPersistedState, next: CateringEquipmentPersistedState): CateringEquipmentPatchField[] {
  return CATERING_EQUIPMENT_PATCH_FIELDS.filter((field) => (next[field] ?? null) !== (current[field] ?? null));
}
/**
 * The activity an equipment edit earns. Exactly two events exist, and both describe a SHARED record:
 *
 *  - an item entering the customer's view for the first time reads as added, whether it was created shared or was
 *    made shared later;
 *  - a status move on an item that is shared both before and after reads as a status change.
 *
 * Everything else -- a private item's status moving, a shared item leaving the customer's view, a rename, a
 * quantity correction -- writes nothing. That is deliberate: this feed is the customer's operational history, and
 * flooding it with provider bookkeeping would make the events that matter unfindable.
 */
export function cateringEquipmentActivityFor(current: CateringEquipmentPersistedState, next: CateringEquipmentPersistedState, changed: readonly CateringEquipmentPatchField[]): CateringEquipmentActivity {
  if (changed.length === 0) return null;
  const wasShared = current.visibility === "shared";
  const isShared = next.visibility === "shared";
  if (!isShared) return null;
  if (!wasShared) return { eventType: "shared_equipment_added", name: next.name };
  return changed.includes("status") ? { eventType: "shared_equipment_status_changed", name: next.name } : null;
}
export function resolveCateringEquipmentPatch(current: CateringEquipmentPersistedState & { updatedAt: Date }, input: Partial<CateringEquipmentPersistedState> & { expectedUpdatedAt: string }, now: Date) {
  if (!cateringExecutionVersionMatches(current, input.expectedUpdatedAt)) return { kind: "conflict" } as const;
  const next = nextCateringEquipmentState(current, input);
  const changed = cateringEquipmentPersistedChanges(current, next);
  if (changed.length === 0) return { kind: "unchanged" } as const;
  return { kind: "update", next, updatedAt: now, activity: cateringEquipmentActivityFor(current, next, changed) } as const;
}
export function resolveCateringEquipmentDelete(current: { updatedAt: Date }, expectedUpdatedAt: string) {
  if (!cateringExecutionVersionMatches(current, expectedUpdatedAt)) return { kind: "conflict" } as const;
  return { kind: "delete" } as const;
}

/* ------------------------------------------------------------------------------------------------------------- *
 * Venue access instructions
 * ------------------------------------------------------------------------------------------------------------- */

export type CateringAccessState = Partial<Record<CateringAccessSharedField | "providerPrivateNotes" | "accessConfirmed", unknown>>;
/**
 * Which access changes are customer-visible, and which of those are worth interrupting the customer for.
 *
 * `accessConfirmed` is customer-visible -- it is what clears their venue-access blocker -- so it writes history. It
 * is deliberately NOT in the notification set: a provider ticking their own confirmation is good news the customer
 * will see next time they look, not something to push. `providerPrivateNotes` is in neither set, so editing it
 * writes no activity row, fires no notification, and is invisible to the customer in every channel.
 */
export function cateringAccessSharedChanges(existing: CateringAccessState | undefined, input: CateringAccessState): CateringAccessSharedField[] {
  const previous = existing ?? {};
  return CATERING_ACCESS_SHARED_FIELDS.filter((field) => field in input && input[field] !== (previous[field] ?? null));
}
export function cateringAccessConfirmationChanged(existing: CateringAccessState | undefined, input: CateringAccessState): boolean {
  const previous = existing ?? {};
  return "accessConfirmed" in input && input.accessConfirmed !== (previous.accessConfirmed ?? false);
}

/**
 * Resolves a locked access save.
 *
 * The version precondition covers BOTH shapes of this write. An absent `expectedUpdatedAt` asserts "no access record
 * exists yet"; a present one asserts "the record is still at this version". Either assertion being wrong is a
 * conflict, so two tabs creating the record at once, and a save composed against a version another tab has already
 * replaced, both refuse rather than silently clobbering the other's instructions.
 */
export function resolveCateringAccessSave(locked: { existing: (CateringAccessState & { updatedAt: Date }) | undefined } | null, input: CateringAccessState & { expectedUpdatedAt?: string }) {
  if (!locked) return { kind: "read_only" } as const;
  const existing = locked.existing;
  if (!existing) {
    // A precondition naming a version cannot be satisfied by a record that does not exist.
    if (input.expectedUpdatedAt !== undefined) return { kind: "conflict" } as const;
  } else if (input.expectedUpdatedAt === undefined || !cateringExecutionVersionMatches(existing, input.expectedUpdatedAt)) {
    return { kind: "conflict" } as const;
  }
  const sharedChanges = cateringAccessSharedChanges(existing, input);
  const confirmationChanged = cateringAccessConfirmationChanged(existing, input);
  return {
    kind: "save",
    // History for anything the customer can see; silence for a purely private edit.
    activity: sharedChanges.length > 0 || confirmationChanged,
    // A push only for the instructions themselves.
    notify: sharedChanges.length > 0,
  } as const;
}

/* ------------------------------------------------------------------------------------------------------------- *
 * Milestones
 * ------------------------------------------------------------------------------------------------------------- */

/**
 * Resolves one milestone toggle against its authoritative row, or against its absence.
 *
 * This is the one execution mutation with no idempotency token, and it needs none: the request asserts a STATE, the
 * row is keyed by (booking, milestone), and asking for a state the row already holds resolves to "unchanged" --
 * which writes no row, no timestamp and no activity. A phone that sends the same completion three times therefore
 * produces exactly one milestone, one completion instant and one activity row.
 *
 * The version precondition still applies, so an undo composed against a state another device has already changed
 * refuses rather than silently reverting it.
 */
export function resolveCateringMilestoneToggle(current: { completedAt: Date | null; updatedAt: Date } | undefined, input: { completed: boolean; expectedUpdatedAt?: string }, now: Date) {
  if (!current) {
    if (input.expectedUpdatedAt !== undefined) return { kind: "conflict" } as const;
    // A first touch that asks for "not completed" still creates the row, so the key has a version to edit from.
    return { kind: "create", completedAt: input.completed ? now : null, activity: input.completed } as const;
  }
  if (!cateringExecutionVersionMatches(current, input.expectedUpdatedAt)) return { kind: "conflict" } as const;
  const wasCompleted = current.completedAt !== null;
  if (wasCompleted === input.completed) return { kind: "unchanged" } as const;
  return {
    kind: "update",
    completedAt: input.completed ? now : null,
    updatedAt: now,
    // Only a completion is history. An undo is a correction, and recording corrections would make the provider's
    // own feed noisier without telling anyone anything. Nothing here is ever customer-visible either way.
    activity: input.completed,
  } as const;
}

/* ------------------------------------------------------------------------------------------------------------- *
 * Readiness facts
 * ------------------------------------------------------------------------------------------------------------- */

/** The already-visibility-filtered rows a readiness summary is reduced from. Nothing here comes from a request. */
export type CateringReadinessSourceRows = {
  timeline: readonly { visibility: string; isBlocker: boolean; completedAt: Date | null }[];
  equipment: readonly { visibility: string; isBlocker: boolean; status: string }[];
  staffCount: number;
  access: { accessConfirmed: boolean } & Partial<Record<CateringAccessSharedField, unknown>> | undefined;
  outstandingSharedRequirementCount: number;
  guestCount: number | null;
};

/**
 * Reduces one actor's authorized rows to readiness facts.
 *
 * The `role` decides what is counted, and it is applied here rather than trusted from the caller's rows: even if a
 * caller passed the full collections, a customer's facts would still count only shared records, contain a zero crew
 * count, and read only the shared access instructions. That is the second of the two independent barriers between
 * provider-private execution data and a customer's readiness summary -- the first being the SQL filter that means
 * those rows were never selected in the first place.
 */
export function cateringReadinessFacts(rows: CateringReadinessSourceRows, role: "provider" | "customer"): CateringReadinessFacts {
  const timeline = rows.timeline.filter((item) => cateringExecutionVisibleTo(item.visibility as CateringExecutionVisibility, role));
  const equipment = rows.equipment.filter((item) => cateringExecutionVisibleTo(item.visibility as CateringExecutionVisibility, role));
  return {
    timelineItemCount: timeline.length,
    staffAssignmentCount: role === "provider" ? rows.staffCount : 0,
    venueAccessConfirmed: rows.access?.accessConfirmed === true,
    // "Present" means a shared instruction has actually been written down. A provider-private note is never one of
    // them, so it can neither satisfy this for a customer nor hint at its own existence through the signal.
    hasSharedAccessInstructions: Boolean(rows.access) && CATERING_ACCESS_SHARED_FIELDS.some((field) => {
      const value = (rows.access as Record<string, unknown> | undefined)?.[field];
      return typeof value === "string" ? value.trim() !== "" : value != null;
    }),
    unconfirmedEquipmentCount: equipment.filter((item) => cateringEquipmentIsUnconfirmed(item.status as CateringEquipmentStatus)).length,
    blockingEquipmentCount: equipment.filter((item) => item.isBlocker && !cateringEquipmentIsSettled(item.status as CateringEquipmentStatus)).length,
    openBlockingTimelineCount: timeline.filter((item) => item.isBlocker && item.completedAt === null).length,
    outstandingSharedRequirementCount: rows.outstandingSharedRequirementCount,
    guestCountRecorded: typeof rows.guestCount === "number" && rows.guestCount > 0,
  };
}
