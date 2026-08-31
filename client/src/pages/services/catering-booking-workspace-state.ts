import { CATERING_TASK_NOT_FOUND_CODE, CATERING_TASK_VERSION_CONFLICT_CODE, CATERING_WORKSPACE_READ_ONLY_CODE, type CateringBookingActivityView, type CateringBookingDetailsView } from "@shared/catering-booking-operations";
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
/** Every coded refusal means the workspace on screen is behind the server, so the authoritative view is fetched again. */
const WORKSPACE_REFRESHING_CODES: readonly string[] = [CATERING_TASK_VERSION_CONFLICT_CODE, CATERING_WORKSPACE_READ_ONLY_CODE, CATERING_TASK_NOT_FOUND_CODE];
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

/** `expectedUpdatedAt` is the authoritative task version the draft was opened from; `conflict` marks that version stale. */
export type OpenTaskEditorState = { identity: string; taskId: string; draft: CateringTaskDraft; expectedUpdatedAt: string; conflict: boolean };
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
  return { identity, taskId: task.id, draft: { title: task.title, description: task.description ?? "", dueDate: task.dueDate ?? "", dueTime: task.dueTime ?? "", visibility: task.visibility }, expectedUpdatedAt: task.updatedAt, conflict: false };
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
/** A stale draft may never be resubmitted against the version it already lost to. */
export function maySubmitTaskEditor(editor: TaskEditorState): boolean { return editor !== null && !editor.conflict; }
/** Applies one field to whatever the editor currently holds, so a keystroke never resurrects a draft from an earlier render. */
export function editTaskEditorField<K extends keyof CateringTaskDraft>(current: TaskEditorState, identity: string, taskId: string, field: K, value: CateringTaskDraft[K]): TaskEditorState {
  if (!current || current.identity !== identity || current.taskId !== taskId) return current;
  return { ...current, draft: { ...current.draft, [field]: value } };
}
/**
 * Resolves the editor for one rendered task. The workspace owns a single editor, so whichever visibility section holds
 * the task renders it: a persisted visibility change moves the task between sections without stranding the draft.
 */
export function taskEditorForTask(editor: TaskEditorState, identity: string, taskId: string): TaskEditorState {
  const active = activeTaskEditor(editor, identity);
  return active && active.taskId === taskId ? active : null;
}
/** The visibility split the workspace renders: private provider checklist and shared customer requirements. */
export function splitCateringWorkspaceTasks<T extends { visibility: "provider" | "shared" }>(tasks: T[]): { privateTasks: T[]; requirements: T[] } {
  return { privateTasks: tasks.filter((task) => task.visibility === "provider"), requirements: tasks.filter((task) => task.visibility === "shared") };
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
