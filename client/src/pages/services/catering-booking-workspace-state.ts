import { CATERING_TASK_NOT_FOUND_CODE, CATERING_TASK_SET_CHANGED_CODE, CATERING_TASK_VERSION_CONFLICT_CODE, CATERING_WORKSPACE_READ_ONLY_CODE, type CateringBookingActivityView, type CateringBookingDetailsView } from "@shared/catering-booking-operations";
import { formatCateringCalendarDate } from "@shared/catering-availability";

export type OperationalDetailItem = { label: string; value: string };
export type WorkspaceFormState<T> = { identity: string; value: T; dirty: boolean };
export type ProviderDetailsDraft = Pick<CateringBookingDetailsView, "venueName" | "venueAddress" | "venueCity" | "venueState" | "venuePostalCode" | "venueInstructions" | "arrivalTime" | "serviceStartTime" | "serviceEndTime" | "setupNotes" | "accessNotes" | "kitchenAvailable" | "refrigerationAvailable" | "powerAvailable" | "waterAvailable" | "indoorOutdoor" | "providerNotes">;
export type CateringTaskDraft = { title: string; description: string; dueDate: string; dueTime: string; visibility: "provider" | "shared" };
export const EMPTY_CATERING_TASK_DRAFT: CateringTaskDraft = { title: "", description: "", dueDate: "", dueTime: "", visibility: "provider" };

export function providerDraftFrom(details: CateringBookingDetailsView): ProviderDetailsDraft {
  return { venueName: details.venueName, venueAddress: details.venueAddress, venueCity: details.venueCity, venueState: details.venueState, venuePostalCode: details.venuePostalCode, venueInstructions: details.venueInstructions, arrivalTime: details.arrivalTime, serviceStartTime: details.serviceStartTime, serviceEndTime: details.serviceEndTime, setupNotes: details.setupNotes, accessNotes: details.accessNotes, kitchenAvailable: details.kitchenAvailable, refrigerationAvailable: details.refrigerationAvailable, powerAvailable: details.powerAvailable, waterAvailable: details.waterAvailable, indoorOutdoor: details.indoorOutdoor, providerNotes: details.providerNotes ?? null };
}
/**
 * A native <input type="time"> emits "" when the provider clears the control, but the operational contract accepts an
 * event-local HH:mm string or null and never "". Cleared times therefore become null at the draft boundary, with no
 * Date object, no UTC conversion, and no browser-timezone reinterpretation of the value that is kept.
 */
export function normalizeOptionalWallClockInput(value: string): string | null { return value === "" ? null : value; }
export function cateringTaskCreatePayload(draft: CateringTaskDraft) {
  return { title: draft.title, description: draft.description || null, dueDate: draft.dueDate || null, dueTime: draft.dueTime || null, visibility: draft.visibility };
}
/** Every task update carries the version it was based on, so a concurrent save is rejected instead of overwritten. */
export function cateringTaskEditPayload(draft: CateringTaskDraft, expectedUpdatedAt: string) {
  return { ...cateringTaskCreatePayload(draft), expectedUpdatedAt };
}
/** The checkbox toggle races other tabs too, so it sends the version of the task the provider actually clicked. */
export function cateringTaskStatusPayload(task: { status: "pending" | "completed"; updatedAt: string }) {
  return { status: task.status === "completed" ? "pending" as const : "completed" as const, expectedUpdatedAt: task.updatedAt };
}
/** Deleting a task is a write against a version too, so it carries the version the provider confirmed deleting. */
export function cateringTaskDeletePayload(task: { updatedAt: string }) { return { expectedUpdatedAt: task.updatedAt }; }
export function cateringWorkspaceErrorCode(error: unknown): string | null {
  const code = typeof error === "object" && error !== null ? (error as { code?: unknown }).code : undefined;
  return typeof code === "string" ? code : null;
}
export function isCateringTaskVersionConflict(error: unknown): boolean {
  return cateringWorkspaceErrorCode(error) === CATERING_TASK_VERSION_CONFLICT_CODE;
}
export function isCateringTaskNotFound(error: unknown): boolean {
  return cateringWorkspaceErrorCode(error) === CATERING_TASK_NOT_FOUND_CODE;
}
/**
 * Every coded refusal means the workspace on screen is behind the server, so the authoritative view is fetched again.
 * A reorder refused because the task collection itself changed shape is exactly that: retrying the same stale set can
 * only be refused again, so the refetch is what lets the next attempt carry the complete current set and its versions.
 */
const WORKSPACE_REFRESHING_CODES: readonly string[] = [CATERING_TASK_VERSION_CONFLICT_CODE, CATERING_WORKSPACE_READ_ONLY_CODE, CATERING_TASK_NOT_FOUND_CODE, CATERING_TASK_SET_CHANGED_CODE];
export function shouldRefetchWorkspaceAfterError(error: unknown): boolean {
  const code = cateringWorkspaceErrorCode(error);
  return code !== null && WORKSPACE_REFRESHING_CODES.includes(code);
}
export function formatCateringTaskDeadline(dueDate: string | null, dueTime: string | null): string | null {
  if (dueDate && dueTime) return `Due ${formatCateringCalendarDate(dueDate)} at ${dueTime}`;
  if (dueDate) return `Due ${formatCateringCalendarDate(dueDate)}`;
  return dueTime ? `Due at ${dueTime}` : null;
}

export function hydrateWorkspaceForm<T>(state: WorkspaceFormState<T>, identity: string, serverValue: T): WorkspaceFormState<T> {
  if (state.identity !== identity) return { identity, value: serverValue, dirty: false };
  return state.dirty ? state : { identity, value: serverValue, dirty: false };
}
export function editWorkspaceForm<T>(state: WorkspaceFormState<T>, value: T): WorkspaceFormState<T> { return { ...state, value, dirty: true }; }
/** Applies one field to whatever the form currently holds, so a keystroke never resurrects a value from an earlier render. */
export function editWorkspaceFormField<T extends object, K extends keyof T>(state: WorkspaceFormState<T | null>, field: K, value: T[K]): WorkspaceFormState<T | null> {
  return state.value == null ? state : editWorkspaceForm(state, { ...state.value, [field]: value });
}
export function saveWorkspaceForm<T>(identity: string, serverValue: T): WorkspaceFormState<T> { return { identity, value: serverValue, dirty: false }; }

function shallowWorkspaceValueEqual<T>(left: T, right: T): boolean {
  if (Object.is(left, right)) return true;
  if (!left || !right || typeof left !== "object" || typeof right !== "object") return false;
  const leftRecord = left as Record<string, unknown>; const rightRecord = right as Record<string, unknown>;
  const keys = Object.keys(leftRecord);
  return keys.length === Object.keys(rightRecord).length && keys.every((key) => Object.is(leftRecord[key], rightRecord[key]));
}

export function reconcileWorkspaceFormAfterSave<T>(current: WorkspaceFormState<T>, submittedIdentity: string, submittedValue: T, serverValue: T): WorkspaceFormState<T> {
  if (current.identity !== submittedIdentity) return current;
  return shallowWorkspaceValueEqual(current.value, submittedValue) ? saveWorkspaceForm(submittedIdentity, serverValue) : { ...current, dirty: true };
}
export function preserveWorkspaceFormAfterSaveFailure<T>(current: WorkspaceFormState<T>): WorkspaceFormState<T> { return current; }

/**
 * `expectedUpdatedAt` is the authoritative task version the draft was opened from; `conflict` marks that version stale.
 * `snapshot` is the task exactly as it was when the editor opened or was reloaded, so "unsaved changes" is decided by
 * comparing the draft against it rather than guessed from any one field. Neither the version nor the conflict flag is
 * part of that comparison: a rejected precondition is not a user edit.
 */
export type OpenTaskEditorState = { identity: string; taskId: string; draft: CateringTaskDraft; snapshot: CateringTaskDraft; expectedUpdatedAt: string; conflict: boolean };
export type TaskEditorState = OpenTaskEditorState | null;
export type SubmittedTaskEdit = { identity: string; taskId: string; draft: CateringTaskDraft; expectedUpdatedAt: string };
const TASK_DRAFT_FIELDS = ["title", "description", "dueDate", "dueTime", "visibility"] as const;
export function cateringTaskDraftsEqual(left: CateringTaskDraft, right: CateringTaskDraft): boolean {
  return TASK_DRAFT_FIELDS.every((field) => Object.is(left[field], right[field]));
}
/** Ignores an editor left over from another actor or booking rather than letting it edit the current workspace. */
export function activeTaskEditor(editor: TaskEditorState, identity: string): TaskEditorState {
  return editor && editor.identity === identity ? editor : null;
}
/**
 * Closes a task editor only when the successful PATCH is still the one on screen: same actor/booking, same task,
 * and an untouched draft. Anything else keeps the provider's current editor exactly as it is.
 */
export function closeTaskEditorAfterSave(current: TaskEditorState, submitted: SubmittedTaskEdit): TaskEditorState {
  if (!current) return current;
  if (current.identity !== submitted.identity) return current;
  if (current.taskId !== submitted.taskId) return current;
  if (current.expectedUpdatedAt !== submitted.expectedUpdatedAt) return current;
  return cateringTaskDraftsEqual(current.draft, submitted.draft) ? null : current;
}
/** Opens the one workspace editor on a persisted task, so both visibility sections address the same editor state. */
export function openTaskEditor(identity: string, task: { id: string; title: string; description: string | null; dueDate: string | null; dueTime: string | null; visibility: "provider" | "shared"; updatedAt: string }): TaskEditorState {
  const snapshot: CateringTaskDraft = { title: task.title, description: task.description ?? "", dueDate: task.dueDate ?? "", dueTime: task.dueTime ?? "", visibility: task.visibility };
  return { identity, taskId: task.id, draft: { ...snapshot }, snapshot, expectedUpdatedAt: task.updatedAt, conflict: false };
}
/** Unsaved changes: every editable draft field compared against the snapshot the editor was opened or reloaded from. */
export function isTaskEditorDirty(editor: TaskEditorState): boolean {
  return editor !== null && !cateringTaskDraftsEqual(editor.draft, editor.snapshot);
}
/**
 * Whether an editor may be opened on one task right now. The workspace owns a single editor, so opening one on another
 * task replaces whatever is there: an editor holding unsaved changes, or one whose version was rejected, may not be
 * discarded that way. Reopening the same task is always allowed — that is how "Reload latest task" rebases a stale
 * draft — and a clean editor is replaced freely, so the UI is never locked harder than the draft actually needs.
 */
export function mayOpenTaskEditor(editor: TaskEditorState, identity: string, taskId: string): boolean {
  const active = activeTaskEditor(editor, identity);
  if (!active || active.taskId === taskId) return true;
  return !isTaskEditorDirty(active) && !active.conflict;
}
/** Opening is refused rather than destructive, so a draft survives even a control that should have been disabled. */
export function openTaskEditorIfAllowed(current: TaskEditorState, identity: string, task: { id: string; title: string; description: string | null; dueDate: string | null; dueTime: string | null; visibility: "provider" | "shared"; updatedAt: string }): TaskEditorState {
  return mayOpenTaskEditor(current, identity, task.id) ? openTaskEditor(identity, task) : current;
}
/**
 * The authoritative task a conflicted editor may reload from, or null while there is nothing newer to reload.
 *
 * A rejected precondition starts a workspace refetch, but the refetch is asynchronous and the workspace on screen
 * still holds the very version the server just refused. Reloading from that would clear the conflict, replace the
 * preserved draft with the same stale version, and lose the next save to the same conflict again. So the reload is
 * resolved from the current authoritative collection by task id, and offered only once that collection actually
 * carries a version other than the one that lost: a task whose `updatedAt` still equals the rejected
 * `expectedUpdatedAt` is by definition the pre-refetch snapshot. Deriving this from the data rather than from a
 * query's fetching flag is what keeps an unrelated background refetch from either enabling or disabling the control,
 * and a task the refresh no longer lists is never reloadable, so a deleted task is never reopened.
 */
export function reloadableTaskForEditor<T extends { id: string; updatedAt: string }>(editor: TaskEditorState, identity: string, tasks: readonly T[]): T | null {
  const active = activeTaskEditor(editor, identity);
  if (!active || !active.conflict) return null;
  const authoritative = tasks.find((task) => task.id === active.taskId);
  if (!authoritative || authoritative.updatedAt === active.expectedUpdatedAt) return null;
  return authoritative;
}
/** Whether "Reload latest task" may be offered for one rendered task: only the conflicted one, only once refreshed. */
export function mayReloadConflictedTask<T extends { id: string; updatedAt: string }>(editor: TaskEditorState, identity: string, tasks: readonly T[], taskId: string): boolean {
  const reloadable = reloadableTaskForEditor(editor, identity, tasks);
  return reloadable !== null && reloadable.id === taskId;
}
/**
 * A rejected concurrency precondition marks the editor's version stale without touching the draft. The provider keeps
 * every entered field and an explicit reload, which reopens from the refetched task, is the only way back to saving.
 */
export function markTaskEditorConflict(current: TaskEditorState, submitted: SubmittedTaskEdit): TaskEditorState {
  if (!current || current.identity !== submitted.identity || current.taskId !== submitted.taskId) return current;
  if (current.expectedUpdatedAt !== submitted.expectedUpdatedAt || current.conflict) return current;
  return { ...current, conflict: true };
}
/**
 * An editor whose task is gone from the authoritative task set closes: another tab deleted it, so there is no
 * persisted task left for the draft to save against. Anything the refetch still lists keeps its editor and draft.
 */
export function reconcileTaskEditorWithTasks(current: TaskEditorState, identity: string, taskIds: readonly string[]): TaskEditorState {
  if (!current || current.identity !== identity) return current;
  return taskIds.includes(current.taskId) ? current : null;
}
/**
 * The authoritative workspace decides whether an open editor may stay open. A booking that became cancelled or
 * completed answers `editable: false`, and every task write against it is refused, so the retained editor closes
 * instead of rendering a form that cannot save. An editable workspace keeps the task-set reconciliation above.
 */
export function reconcileTaskEditorWithWorkspace(current: TaskEditorState, identity: string, editable: boolean, taskIds: readonly string[]): TaskEditorState {
  if (!current || current.identity !== identity) return current;
  return editable ? reconcileTaskEditorWithTasks(current, identity, taskIds) : null;
}
/**
 * A stale draft may never be resubmitted against the version it already lost to, and neither may any draft on a
 * workspace the server no longer accepts writes for: a booking that became cancelled or completed is history.
 */
export function maySubmitTaskEditor(editor: TaskEditorState, editable: boolean): boolean { return editable && editor !== null && !editor.conflict; }
/** Applies one field to whatever the editor currently holds, so a keystroke never resurrects a draft from an earlier render. */
export function editTaskEditorField<K extends keyof CateringTaskDraft>(current: TaskEditorState, identity: string, taskId: string, field: K, value: CateringTaskDraft[K]): TaskEditorState {
  if (!current || current.identity !== identity || current.taskId !== taskId) return current;
  return { ...current, draft: { ...current.draft, [field]: value } };
}
/**
 * Resolves the editor for one rendered task. The workspace owns a single editor, so whichever visibility section holds
 * the task renders it: a persisted visibility change moves the task between sections without stranding the draft. A
 * workspace that is not editable renders no editor at all, so a retained draft can never make history look writable.
 */
export function taskEditorForTask(editor: TaskEditorState, identity: string, taskId: string, editable: boolean): TaskEditorState {
  if (!editable) return null;
  const active = activeTaskEditor(editor, identity);
  return active && active.taskId === taskId ? active : null;
}
/** The visibility split the workspace renders: private provider checklist and shared customer requirements. */
export function splitCateringWorkspaceTasks<T extends { visibility: "provider" | "shared" }>(tasks: T[]): { privateTasks: T[]; requirements: T[] } {
  return { privateTasks: tasks.filter((task) => task.visibility === "provider"), requirements: tasks.filter((task) => task.visibility === "shared") };
}

export type CateringTaskMoveDirection = "up" | "down";
/** The authoritative fields a reorder needs from one task: which section it sits in, and the version to submit for it. */
export type ReorderableCateringTask = { id: string; visibility: "provider" | "shared"; updatedAt: string };
/**
 * The nearest task in `direction` that shares the moved task's visibility section, or -1 when it is already the first
 * or last task of its own section. The workspace renders the two sections separately, so a move is only ever meaningful
 * against the section the task is actually displayed in.
 */
function adjacentSectionIndex(tasks: readonly { visibility: "provider" | "shared" }[], index: number, direction: CateringTaskMoveDirection): number {
  const step = direction === "up" ? -1 : 1;
  for (let cursor = index + step; cursor >= 0 && cursor < tasks.length; cursor += step) if (tasks[cursor].visibility === tasks[index].visibility) return cursor;
  return -1;
}
/**
 * Moves one task within its own visibility section and returns the COMPLETE task collection in the new global order,
 * which is what the reorder endpoint requires. The move swaps the two tasks' global positions, so every task in the
 * other section keeps the exact global position it already had: its relative order cannot change, none of its members
 * can be dropped, and no task's visibility is touched. A task already at the edge of its section returns null, so the
 * control that offers the move is disabled rather than submitting a reorder that would change nothing.
 */
export function moveCateringTaskInGlobalOrder<T extends ReorderableCateringTask>(tasks: readonly T[], taskId: string, direction: CateringTaskMoveDirection): T[] | null {
  const index = tasks.findIndex((task) => task.id === taskId);
  if (index === -1) return null;
  const neighbor = adjacentSectionIndex(tasks, index, direction);
  if (neighbor === -1) return null;
  const next = [...tasks];
  next[index] = tasks[neighbor]; next[neighbor] = tasks[index];
  return next;
}
export function mayMoveCateringTask<T extends ReorderableCateringTask>(tasks: readonly T[], taskId: string, direction: CateringTaskMoveDirection): boolean {
  return moveCateringTaskInGlobalOrder(tasks, taskId, direction) !== null;
}
/** Every task carries the version the provider observed, in the requested global order. The server reads position only. */
export function cateringTaskReorderPayload(tasks: readonly ReorderableCateringTask[]) {
  return { tasks: tasks.map((task) => ({ id: task.id, expectedUpdatedAt: task.updatedAt })) };
}
/** Whether each direction is usable for one rendered task; null when the workspace offers no reorder controls at all. */
export type CateringTaskReorderControls = { up: boolean; down: boolean } | null;
/**
 * Resolves the reorder controls for one rendered task. Only a provider on an editable workspace gets them at all, so a
 * customer and a cancelled or completed workspace render none. An open task editor or an in-flight request disables
 * both directions rather than hiding them: the provider keeps seeing where the task can go, and cannot reorder
 * underneath a draft or submit the same move twice.
 */
export function cateringTaskReorderControls<T extends ReorderableCateringTask>(tasks: readonly T[], taskId: string, context: { role: "provider" | "customer"; editable: boolean; editorOpen: boolean; pending: boolean }): CateringTaskReorderControls {
  if (context.role !== "provider" || !context.editable) return null;
  const usable = !context.editorOpen && !context.pending;
  return { up: usable && mayMoveCateringTask(tasks, taskId, "up"), down: usable && mayMoveCateringTask(tasks, taskId, "down") };
}
/** A failed PATCH leaves every entered field in place so the provider can correct and retry. */
export function preserveTaskEditorAfterSaveFailure(current: TaskEditorState): TaskEditorState { return current; }
export function historicalOperationalDetails(details: CateringBookingDetailsView, role: "provider" | "customer"): OperationalDetailItem[] {
  const items: Array<OperationalDetailItem | null> = [
    details.venueName ? { label: "Venue", value: details.venueName } : null,
    details.venueAddress ? { label: "Address", value: details.venueAddress } : null,
    details.venueCity ? { label: "City", value: details.venueCity } : null,
    details.venueState ? { label: "State / region", value: details.venueState } : null,
    details.venuePostalCode ? { label: "Postal code", value: details.venuePostalCode } : null,
    details.venueInstructions ? { label: "Venue instructions", value: details.venueInstructions } : null,
    details.arrivalTime ? { label: "Arrival time", value: details.arrivalTime } : null,
    details.serviceStartTime ? { label: "Service start", value: details.serviceStartTime } : null,
    details.serviceEndTime ? { label: "Service end", value: details.serviceEndTime } : null,
    details.setupNotes ? { label: "Setup notes", value: details.setupNotes } : null,
    details.accessNotes ? { label: "Access notes", value: details.accessNotes } : null,
    details.kitchenAvailable == null ? null : { label: "Kitchen available", value: details.kitchenAvailable ? "Yes" : "No" },
    details.refrigerationAvailable == null ? null : { label: "Refrigeration available", value: details.refrigerationAvailable ? "Yes" : "No" },
    details.powerAvailable == null ? null : { label: "Power available", value: details.powerAvailable ? "Yes" : "No" },
    details.waterAvailable == null ? null : { label: "Water available", value: details.waterAvailable ? "Yes" : "No" },
    details.indoorOutdoor ? { label: "Setting", value: details.indoorOutdoor === "both" ? "Indoor and outdoor" : details.indoorOutdoor[0].toUpperCase() + details.indoorOutdoor.slice(1) } : null,
    role === "provider" && details.providerNotes ? { label: "Private provider notes", value: details.providerNotes } : null,
  ];
  return items.filter((item): item is OperationalDetailItem => item !== null);
}

export function combineCateringActivityPages(pages: Array<{ activity: CateringBookingActivityView[] }>): CateringBookingActivityView[] {
  const seen = new Set<string>();
  const combined: CateringBookingActivityView[] = [];
  for (const page of pages) for (const activity of page.activity) {
    if (seen.has(activity.id)) continue;
    seen.add(activity.id);
    combined.push(activity);
  }
  return combined;
}

export function nextCateringActivityPage(pagination: { page: number; totalPages: number }): number | undefined {
  return pagination.page < pagination.totalPages ? pagination.page + 1 : undefined;
}

/**
 * The task-specific activity events, the only ones that ever carry a task title. Every one of them is recorded with
 * shared visibility — a provider-private task records no activity at all — so the server's own visibility filter is
 * what decides whether an actor receives the row, and rendering its stored title exposes nothing new.
 */
const CATERING_TASK_ACTIVITY_EVENT_TYPES: readonly string[] = ["shared_requirement_added", "shared_requirement_updated", "shared_requirement_completed", "shared_requirement_deleted"];
/**
 * The task title stored on one activity row at the time it happened, or null. It is read only from the metadata the
 * actor was already served, never looked up from a current task, so a deleted task's history stays truthful and a
 * renamed task keeps the name it had. Metadata is persisted JSON, so anything that is not a non-blank string — a
 * missing key, an object, an array, a number, null — yields no title and the generic label stands alone.
 */
export function cateringActivityTaskTitle(activity: { eventType: string; metadata?: unknown }): string | null {
  if (!CATERING_TASK_ACTIVITY_EVENT_TYPES.includes(activity.eventType)) return null;
  const metadata = activity.metadata;
  if (typeof metadata !== "object" || metadata === null || Array.isArray(metadata)) return null;
  const title = (metadata as Record<string, unknown>).taskTitle;
  return typeof title === "string" && title.trim() !== "" ? title : null;
}


/**
 * Deep-linked workspace sections.
 *
 * A booking notification links to `.../bookings/<id>#communication` or `#files`. On a COLD load that fragment is
 * resolved by the browser while the workspace is still showing its loading state, so the target element does not
 * exist yet -- and nothing resolves it a second time once the data lands. The participant is told they have a new
 * message and dropped at the top of the page instead.
 *
 * The fix is a second resolution after the workspace mounts, which needs two pure pieces: which section a fragment
 * names, and whether that section has already been landed on. The landing record is what stops an ordinary rerender
 * from re-scrolling or re-stealing focus, and it is why this is a value rather than a bare boolean.
 */
export const CATERING_WORKSPACE_SECTION_IDS = ["communication", "files", "activity"] as const;

/** The section a location fragment names, or null for an absent, empty or unrecognised one. */
export function cateringWorkspaceSectionFromHash(hash: string): string | null {
  const id = hash.startsWith("#") ? hash.slice(1) : hash;
  if (id === "") return null;
  // An allowlist rather than a `getElementById` on whatever the fragment says: a hostile or stale link must not be
  // able to name an arbitrary element for the workspace to scroll to and focus.
  return (CATERING_WORKSPACE_SECTION_IDS as readonly string[]).includes(id) ? id : null;
}

/** Which fragment has already been landed on. Held in a ref by the component, so recording one causes no render. */
export type CateringSectionLanding = { landedOn: string | null };
export const EMPTY_CATERING_SECTION_LANDING: CateringSectionLanding = { landedOn: null };

/**
 * Whether to scroll and focus. A null section (no fragment, or one naming nothing) never lands, and a section
 * already landed on never lands again -- so a refetch, a rerender, or the effect re-running does nothing at all.
 */
export function shouldLandOnCateringSection(state: CateringSectionLanding, section: string | null): boolean {
  return section !== null && state.landedOn !== section;
}
/**
 * Records the landing. Navigating away and back re-lands, because the fragment in between differs: this remembers
 * the last fragment acted on, not every fragment ever seen, which is what keeps back/forward working.
 */
export function recordCateringSectionLanding(state: CateringSectionLanding, section: string | null): CateringSectionLanding {
  return state.landedOn === section ? state : { landedOn: section };
}
