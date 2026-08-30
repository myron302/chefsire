import type { CateringBookingStatus } from "@shared/catering-bookings";
import { cateringWorkspaceRole, mayEditCateringWorkspace } from "@shared/catering-booking-operations";

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

export function sharedTaskUpdateActivity(current: CateringTaskPersistedState, input: CateringTaskPatchInput) {
  return cateringTaskUpdateOutcome(current, input).activity;
}

export const CATERING_SHARED_DETAIL_FIELDS = ["venueName", "venueAddress", "venueCity", "venueState", "venuePostalCode", "venueInstructions", "arrivalTime", "serviceStartTime", "serviceEndTime", "setupNotes", "accessNotes", "kitchenAvailable", "refrigerationAvailable", "powerAvailable", "waterAvailable", "indoorOutdoor"] as const;
type CateringDetailComparison = Partial<Record<typeof CATERING_SHARED_DETAIL_FIELDS[number] | "providerNotes" | "customerNotes", unknown>>;

export function cateringDetailsActivityVisibility(existing: CateringDetailComparison | undefined, input: CateringDetailComparison, role: "provider" | "customer"): "shared" | "provider" | null {
  const previous = existing ?? {};
  if (role === "customer") return "customerNotes" in input && input.customerNotes !== (previous.customerNotes ?? null) ? "shared" : null;
  const sharedChanged = CATERING_SHARED_DETAIL_FIELDS.some((field) => field in input && input[field] !== (previous[field] ?? null));
  if (sharedChanged) return "shared";
  return "providerNotes" in input && input.providerNotes !== (previous.providerNotes ?? null) ? "provider" : null;
}
