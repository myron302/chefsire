import type { CateringBookingStatus } from "@shared/catering-bookings";
import { CATERING_BOOKING_TASK_LIMIT, CATERING_TASK_NOT_FOUND_CODE, CATERING_WORKSPACE_READ_ONLY_CODE, cateringWorkspaceRole, hasValidCateringServiceTimeRange, mayEditCateringWorkspace, mergeCateringServiceTimes } from "@shared/catering-booking-operations";

export { cateringWorkspaceRole, mayEditCateringWorkspace };
export function mayMutateWorkspace(status: CateringBookingStatus, role: "provider" | "customer", resource: "provider-details" | "customer-notes" | "tasks"): boolean {
  if (!mayEditCateringWorkspace(status)) return false;
  return resource === "customer-notes" ? role === "customer" : role === "provider";
}

export function nextCateringTaskSortOrder(maxSortOrder: number | null): number {
  return maxSortOrder == null ? 0 : maxSortOrder + 1;
}

/** Every task column a PATCH may persist. Activity is derived from these and nothing else. */
export const CATERING_TASK_PATCH_FIELDS = ["title", "description", "dueDate", "dueTime", "visibility", "status"] as const;
export type CateringTaskPatchField = typeof CATERING_TASK_PATCH_FIELDS[number];
/** Persisted task state. Optional members let callers compare rows that predate a column without inventing values. */
export type CateringTaskPersistedState = { title: string; visibility: string; status: string; description?: string | null; dueDate?: string | null; dueTime?: string | null };
export type CateringTaskPatchInput = Partial<CateringTaskPersistedState>;

/** Applies a validated patch to the authoritative locked row. Absent request fields keep the persisted value. */
export function nextCateringTaskState(current: CateringTaskPersistedState, input: CateringTaskPatchInput): CateringTaskPersistedState {
  const next = { title: current.title, visibility: current.visibility, status: current.status, description: current.description, dueDate: current.dueDate, dueTime: current.dueTime };
  for (const field of CATERING_TASK_PATCH_FIELDS) if (field in input && input[field] !== undefined) (next as Record<string, unknown>)[field] = input[field];
  return next;
}

/** Field presence in a request is not a change. Only a differing persisted value is. */
export function cateringTaskPersistedChanges(current: CateringTaskPersistedState, next: CateringTaskPersistedState): CateringTaskPatchField[] {
  return CATERING_TASK_PATCH_FIELDS.filter((field) => (next[field] ?? null) !== (current[field] ?? null));
}

/** Resolves a task patch against the locked row: what persists, whether anything changed, and the activity it earns. */
export function cateringTaskUpdateOutcome(current: CateringTaskPersistedState, input: CateringTaskPatchInput) {
  const next = nextCateringTaskState(current, input);
  const changedFields = cateringTaskPersistedChanges(current, next);
  const changed = changedFields.length > 0;
  // A task that ends up provider-private never writes customer-visible history, whatever it used to be.
  const activity = !changed || next.visibility !== "shared" ? null : {
    eventType: next.status === "completed" && current.status !== "completed" ? "shared_requirement_completed" as const : "shared_requirement_updated" as const,
    taskTitle: next.title,
  };
  return { next, changedFields, changed, activity };
}

/** Completion timestamps move only on a real status transition, never on a repeated status. */
export function nextCateringTaskCompletedAt(current: { status: string; completedAt: Date | null }, nextStatus: string, now: Date): Date | null {
  if (nextStatus === current.status) return current.completedAt;
  return nextStatus === "completed" ? now : null;
}

/** The authoritative persisted version of a task row, used only as an optimistic concurrency precondition. */
export type CateringTaskVersionedState = CateringTaskPersistedState & { updatedAt: Date; completedAt: Date | null };
/** Matches the serialized updatedAt contract the workspace hands the client, comparing the instant rather than its spelling. */
export function cateringTaskVersionMatches(current: { updatedAt: Date }, expectedUpdatedAt: string): boolean {
  const expected = Date.parse(expectedUpdatedAt);
  return Number.isFinite(expected) && expected === current.updatedAt.getTime();
}
/**
 * Everything a task PATCH may do, decided against the authoritative row loaded inside the task lock. A stale
 * precondition resolves to a conflict that carries no next state, no timestamps, and no activity, so the route has
 * nothing to write: the row, its updatedAt, its completedAt, and the booking history all stay exactly as they were.
 */
export function resolveCateringTaskPatch(current: CateringTaskVersionedState, input: CateringTaskPatchInput & { expectedUpdatedAt: string }, now: Date) {
  if (!cateringTaskVersionMatches(current, input.expectedUpdatedAt)) return { kind: "conflict" } as const;
  const outcome = cateringTaskUpdateOutcome(current, input);
  if (!outcome.changed) return { kind: "unchanged" } as const;
  return { kind: "update", next: outcome.next, completedAt: nextCateringTaskCompletedAt(current, outcome.next.status, now), updatedAt: now, activity: outcome.activity } as const;
}

/**
 * Resolves a locked task delete. A stale precondition conflicts and carries no activity, so the route deletes nothing
 * and writes no customer-visible history for a task the provider never saw in its current state.
 */
export function resolveCateringTaskDelete(current: { updatedAt: Date; title: string; visibility: string }, expectedUpdatedAt: string) {
  if (!cateringTaskVersionMatches(current, expectedUpdatedAt)) return { kind: "conflict" } as const;
  return { kind: "delete", activity: current.visibility === "shared" ? { eventType: "shared_requirement_deleted" as const, taskTitle: current.title } : null } as const;
}

/** The locked task collection a create is measured against; absent once the booking is no longer active. */
export type CateringLockedTaskCounts = { taskCount: number; maxSortOrder: number | null };
/**
 * Resolves a locked task create into one of three distinct outcomes. A booking that went read-only and a full task
 * collection are different refusals with different truthful messages, and only "create" inserts anything at all.
 */
export function resolveCateringTaskCreate(locked: CateringLockedTaskCounts | null, input: { title: string; visibility: string }) {
  if (!locked) return { kind: "read_only" } as const;
  if (locked.taskCount >= CATERING_BOOKING_TASK_LIMIT) return { kind: "limit" } as const;
  return { kind: "create", sortOrder: nextCateringTaskSortOrder(locked.maxSortOrder), activity: input.visibility === "shared" ? { eventType: "shared_requirement_added" as const, taskTitle: input.title } : null } as const;
}
/** Each refused create says what actually happened; a read-only booking is never reported as a full task list. */
export const CATERING_TASK_CREATE_MESSAGES = {
  read_only: "Booking became read-only before the task could be created",
  limit: `A booking may have at most ${CATERING_BOOKING_TASK_LIMIT} tasks`,
} as const;

export function sharedTaskUpdateActivity(current: CateringTaskPersistedState, input: CateringTaskPatchInput) {
  return cateringTaskUpdateOutcome(current, input).activity;
}

/** How a refused workspace write answers: the truthful message, plus the code the client classifies it by. */
export type CateringWorkspaceRefusal = { message: string; code?: string };
/** A task the actor may mutate but that no longer exists stays a 404, and never becomes a fabricated version conflict. */
export const CATERING_TASK_NOT_FOUND_REFUSAL = { status: 404, message: "Task not found", code: CATERING_TASK_NOT_FOUND_CODE } as const;

export const CATERING_SHARED_DETAIL_FIELDS = ["venueName", "venueAddress", "venueCity", "venueState", "venuePostalCode", "venueInstructions", "arrivalTime", "serviceStartTime", "serviceEndTime", "setupNotes", "accessNotes", "kitchenAvailable", "refrigerationAvailable", "powerAvailable", "waterAvailable", "indoorOutdoor"] as const;
type CateringDetailComparison = Partial<Record<typeof CATERING_SHARED_DETAIL_FIELDS[number] | "providerNotes" | "customerNotes", unknown>>;

export function cateringDetailsActivityVisibility(existing: CateringDetailComparison | undefined, input: CateringDetailComparison, role: "provider" | "customer"): "shared" | "provider" | null {
  const previous = existing ?? {};
  if (role === "customer") return "customerNotes" in input && input.customerNotes !== (previous.customerNotes ?? null) ? "shared" : null;
  const sharedChanged = CATERING_SHARED_DETAIL_FIELDS.some((field) => field in input && input[field] !== (previous[field] ?? null));
  if (sharedChanged) return "shared";
  return "providerNotes" in input && input.providerNotes !== (previous.providerNotes ?? null) ? "provider" : null;
}

/** The persisted or submitted operational details a save is resolved against. */
export type CateringDetailsState = CateringDetailComparison & { serviceStartTime?: string | null; serviceEndTime?: string | null };
/** Only a provider may change service times, so only a provider save can produce an invalid range. */
function cateringSubmittedServiceTimes(input: CateringDetailsState, role: "provider" | "customer") {
  if (role !== "provider") return {};
  return { ...("serviceStartTime" in input ? { serviceStartTime: input.serviceStartTime } : {}), ...("serviceEndTime" in input ? { serviceEndTime: input.serviceEndTime } : {}) };
}
/**
 * Resolves a locked details save into three distinct outcomes. A booking that went read-only under the lock and a
 * service-time range that would not survive the merge are different refusals; only "save" writes a row or activity.
 */
export function resolveCateringDetailsSave(locked: { existing: CateringDetailsState | undefined } | null, input: CateringDetailsState, role: "provider" | "customer") {
  if (!locked) return { kind: "read_only" } as const;
  if (role === "provider" && !hasValidCateringServiceTimeRange(mergeCateringServiceTimes(locked.existing, cateringSubmittedServiceTimes(input, role)))) return { kind: "invalid_time_range" } as const;
  return { kind: "save", activityVisibility: cateringDetailsActivityVisibility(locked.existing, input, role) } as const;
}
/** A read-only booking is never reported as a validation problem, and a validation problem never forces a read-only view. */
export const CATERING_DETAILS_SAVE_REFUSALS: Record<"read_only" | "invalid_time_range", CateringWorkspaceRefusal> = {
  read_only: { message: "Booking became read-only before the event details could be saved", code: CATERING_WORKSPACE_READ_ONLY_CODE },
  invalid_time_range: { message: "The resulting service time range is invalid: service end time must not precede service start time" },
};
