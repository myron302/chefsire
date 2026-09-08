import {
  CATERING_EXECUTION_NOT_FOUND_CODE,
  CATERING_EXECUTION_SET_CHANGED_CODE,
  CATERING_EXECUTION_VERSION_CONFLICT_CODE,
  CATERING_WORKSPACE_READ_ONLY_CODE,
  type CateringEquipmentSource,
  type CateringEquipmentStatus,
  type CateringExecutionAccessView,
  type CateringExecutionEquipmentView,
  type CateringExecutionStaffView,
  type CateringExecutionTimelineItemView,
  type CateringExecutionVisibility,
  type CateringReadinessState,
  type CateringStaffRole,
  type CateringTimelineCategory,
} from "@shared/catering-booking-execution";

/**
 * Presentation and draft state for the Phase 2J execution section.
 *
 * Everything here is a pure function over plain values, kept out of the component so it can be exercised directly.
 * The component owns React state and the network; this module owns the RULES -- what a payload contains, when a
 * control may be used, what happens to an unsaved edit when a save fails, and how a refusal is classified.
 */

/* ------------------------------------------------------------------------------------------------------------- *
 * Refusal classification
 * ------------------------------------------------------------------------------------------------------------- */

/** A refusal carrying a code the client understands, plus the offline flag the fetch wrapper sets. */
export type CateringExecutionError = { message: string; code?: string; offline?: boolean };

/** The two refusals that mean "your view of this record is behind"; both are resolved by reloading, not retrying. */
export function isCateringExecutionConflict(error: CateringExecutionError | null | undefined): boolean {
  return error?.code === CATERING_EXECUTION_VERSION_CONFLICT_CODE || error?.code === CATERING_EXECUTION_SET_CHANGED_CODE;
}
/**
 * Whether a failed mutation should refetch the execution payload.
 *
 * A conflict, a changed collection, a record that is gone, and a booking that went terminal all mean the rendering
 * on screen is stale in a way only the server can settle. A validation refusal does not: refetching would change
 * nothing and would only throw away the participant's work.
 *
 * A CONNECTIVITY failure explicitly does not refetch either. The request may never have reached the server, so
 * there is nothing new to read, and a refetch that also fails would just replace one error with another.
 */
export function shouldRefetchExecutionAfterError(error: CateringExecutionError | null | undefined): boolean {
  if (!error || error.offline) return false;
  return isCateringExecutionConflict(error)
    || error.code === CATERING_EXECUTION_NOT_FOUND_CODE
    || error.code === CATERING_WORKSPACE_READ_ONLY_CODE;
}

/**
 * What to tell the participant about a failed save, and what happens to their edit.
 *
 * The application has NO offline architecture, and this does not pretend otherwise: a change that did not reach the
 * server is reported as not saved, in those words. What it does guarantee is that the edit itself is still in the
 * form, and that retrying reuses the SAME idempotency token -- so a request that actually did arrive before the
 * connection dropped resolves to the record it already created instead of making a second one.
 */
export function cateringExecutionFailureNotice(error: CateringExecutionError): { message: string; retryable: boolean; keepsEdit: boolean } {
  if (error.offline) return { message: "This change was not saved — you appear to be offline. Your edit is kept here; try again when you are back online.", retryable: true, keepsEdit: true };
  if (isCateringExecutionConflict(error)) return { message: error.message, retryable: false, keepsEdit: true };
  if (error.code === CATERING_WORKSPACE_READ_ONLY_CODE) return { message: error.message, retryable: false, keepsEdit: false };
  return { message: error.message, retryable: true, keepsEdit: true };
}

/* ------------------------------------------------------------------------------------------------------------- *
 * Drafts
 * ------------------------------------------------------------------------------------------------------------- */

/**
 * A draft carries the idempotency token for the attempt it will make.
 *
 * The token is minted once, when the participant starts filling the form, and SURVIVES a failed submit. That is the
 * whole point: a mobile browser that times out may already have created the record, and retrying under the same
 * token resolves to it rather than adding a duplicate. It is replaced only after a submit the server accepted, at
 * which point it is spent and reusing it would resolve to the record just created.
 */
export type CateringTimelineDraft = {
  title: string; description: string; category: CateringTimelineCategory;
  scheduledTime: string; endTime: string; visibility: CateringExecutionVisibility; isBlocker: boolean;
  requestId: string | null;
};
export const EMPTY_CATERING_TIMELINE_DRAFT: CateringTimelineDraft = {
  title: "", description: "", category: "setup", scheduledTime: "", endTime: "", visibility: "provider_private", isBlocker: false, requestId: null,
};
export type CateringStaffDraft = {
  workerName: string; role: CateringStaffRole; customRole: string; contactNote: string;
  arrivalTime: string; departureTime: string; responsibilityNote: string; requestId: string | null;
};
export const EMPTY_CATERING_STAFF_DRAFT: CateringStaffDraft = {
  workerName: "", role: "server", customRole: "", contactNote: "", arrivalTime: "", departureTime: "", responsibilityNote: "", requestId: null,
};
export type CateringEquipmentDraft = {
  name: string; quantity: string; sourceType: CateringEquipmentSource; sourceName: string;
  pickupDate: string; pickupTime: string; returnDate: string; returnTime: string;
  status: CateringEquipmentStatus; isBlocker: boolean; notes: string; visibility: CateringExecutionVisibility;
  requestId: string | null;
};
export const EMPTY_CATERING_EQUIPMENT_DRAFT: CateringEquipmentDraft = {
  name: "", quantity: "1", sourceType: "provider_owned", sourceName: "", pickupDate: "", pickupTime: "",
  returnDate: "", returnTime: "", status: "planned", isBlocker: false, notes: "", visibility: "provider_private", requestId: null,
};

/** An empty text input means "not set", which the API spells `null`. An empty string would be a value. */
export function optionalText(value: string): string | null {
  const trimmed = value.trim();
  return trimmed === "" ? null : trimmed;
}
/**
 * Ensures a draft carries a token before it is submitted, minting one only if it has none.
 *
 * Minting on submit rather than on every keystroke keeps the token stable across edits, and re-minting is exactly
 * what must NOT happen on a retry.
 */
export function withCateringRequestId<T extends { requestId: string | null }>(draft: T, mint: () => string): T {
  return draft.requestId ? draft : { ...draft, requestId: mint() };
}
/** After an accepted submit the token is spent, so the reset draft gets a fresh one only when it is next needed. */
export function resetCateringDraft<T extends { requestId: string | null }>(empty: T): T {
  return { ...empty, requestId: null };
}

export function cateringTimelineCreatePayload(draft: CateringTimelineDraft) {
  return {
    title: draft.title.trim(),
    description: optionalText(draft.description),
    category: draft.category,
    scheduledTime: optionalText(draft.scheduledTime),
    endTime: optionalText(draft.endTime),
    visibility: draft.visibility,
    isBlocker: draft.isBlocker,
    ...(draft.requestId ? { clientRequestId: draft.requestId } : {}),
  };
}
export function cateringStaffCreatePayload(draft: CateringStaffDraft) {
  return {
    workerName: draft.workerName.trim(),
    role: draft.role,
    // A custom label belongs to the custom role alone: sending one beside a listed role is refused by the schema and
    // by a database CHECK, so it is dropped here rather than submitted and bounced.
    customRole: draft.role === "custom" ? optionalText(draft.customRole) : null,
    contactNote: optionalText(draft.contactNote),
    arrivalTime: optionalText(draft.arrivalTime),
    departureTime: optionalText(draft.departureTime),
    responsibilityNote: optionalText(draft.responsibilityNote),
    ...(draft.requestId ? { clientRequestId: draft.requestId } : {}),
  };
}
export function cateringEquipmentCreatePayload(draft: CateringEquipmentDraft) {
  return {
    name: draft.name.trim(),
    quantity: Number(draft.quantity),
    sourceType: draft.sourceType,
    sourceName: optionalText(draft.sourceName),
    pickupDate: optionalText(draft.pickupDate),
    pickupTime: optionalText(draft.pickupTime),
    returnDate: optionalText(draft.returnDate),
    returnTime: optionalText(draft.returnTime),
    status: draft.status,
    isBlocker: draft.isBlocker,
    notes: optionalText(draft.notes),
    visibility: draft.visibility,
    ...(draft.requestId ? { clientRequestId: draft.requestId } : {}),
  };
}

/** A title is the one thing a run-of-show item cannot be created without, so the control obeys the same rule. */
export function maySubmitCateringTimelineDraft(draft: CateringTimelineDraft, editable: boolean, pending: boolean): boolean {
  return editable && !pending && draft.title.trim().length > 0;
}
export function maySubmitCateringStaffDraft(draft: CateringStaffDraft, editable: boolean, pending: boolean): boolean {
  if (!editable || pending || draft.workerName.trim().length === 0) return false;
  return draft.role !== "custom" || draft.customRole.trim().length > 0;
}
/**
 * Quantity is validated here as well as by the schema and the database, so an obviously impossible value is refused
 * before a round trip rather than after one.
 */
export function cateringEquipmentQuantityIsValid(quantity: string): boolean {
  const parsed = Number(quantity);
  return Number.isInteger(parsed) && parsed >= 1 && parsed <= 9999;
}
export function maySubmitCateringEquipmentDraft(draft: CateringEquipmentDraft, editable: boolean, pending: boolean): boolean {
  return editable && !pending && draft.name.trim().length > 0 && cateringEquipmentQuantityIsValid(draft.quantity);
}

/* ------------------------------------------------------------------------------------------------------------- *
 * The timeline item editor
 * ------------------------------------------------------------------------------------------------------------- */

/**
 * One open item editor, carrying the version the draft was opened from.
 *
 * `conflict` is set when the server refused the save because the item moved on. The draft is deliberately KEPT in
 * that state -- the participant's words are not thrown away -- but saving is disabled until they reload the latest
 * version, because saving would overwrite the newer one with an older base.
 */
export type OpenCateringTimelineEditor = {
  identity: string; itemId: string; expectedUpdatedAt: string; conflict: boolean;
  draft: Omit<CateringTimelineDraft, "requestId">;
};
export type CateringTimelineEditorState = OpenCateringTimelineEditor | null;

export function cateringTimelineEditorFor(item: CateringExecutionTimelineItemView, identity: string): OpenCateringTimelineEditor {
  return {
    identity, itemId: item.id, expectedUpdatedAt: item.updatedAt, conflict: false,
    draft: {
      title: item.title, description: item.description ?? "", category: item.category,
      scheduledTime: item.scheduledTime ?? "", endTime: item.endTime ?? "",
      visibility: item.visibility, isBlocker: item.isBlocker,
    },
  };
}
export function editCateringTimelineEditorField<K extends keyof OpenCateringTimelineEditor["draft"]>(
  editor: CateringTimelineEditorState, identity: string, itemId: string, field: K, value: OpenCateringTimelineEditor["draft"][K],
): CateringTimelineEditorState {
  if (!editor || editor.identity !== identity || editor.itemId !== itemId) return editor;
  return { ...editor, draft: { ...editor.draft, [field]: value } };
}
/** An editor open on this booking's item, and only while the section is actually editable. */
export function activeCateringTimelineEditor(editor: CateringTimelineEditorState, identity: string, itemId: string, editable: boolean): OpenCateringTimelineEditor | null {
  if (!editable || !editor || editor.identity !== identity || editor.itemId !== itemId) return null;
  return editor;
}
export function maySubmitCateringTimelineEditor(editor: OpenCateringTimelineEditor, editable: boolean, pending: boolean): boolean {
  return editable && !pending && !editor.conflict && editor.draft.title.trim().length > 0;
}
export function cateringTimelineEditPayload(editor: OpenCateringTimelineEditor) {
  return {
    title: editor.draft.title.trim(),
    description: optionalText(editor.draft.description),
    category: editor.draft.category,
    scheduledTime: optionalText(editor.draft.scheduledTime),
    endTime: optionalText(editor.draft.endTime),
    visibility: editor.draft.visibility,
    isBlocker: editor.draft.isBlocker,
    // The version this edit is based on. The server compares it against the authoritative locked row and never
    // persists it, so a client cannot claim a version it did not read.
    expectedUpdatedAt: editor.expectedUpdatedAt,
  };
}
/** Completing or reopening an item is a narrow field-level write, and still carries the version precondition. */
export function cateringTimelineCompletionPayload(item: CateringExecutionTimelineItemView) {
  return { completed: !item.completed, expectedUpdatedAt: item.updatedAt };
}
export function cateringTimelineDeletePayload(item: CateringExecutionTimelineItemView) {
  return { expectedUpdatedAt: item.updatedAt };
}
export function cateringExecutionDeletePayload(record: { updatedAt: string }) {
  return { expectedUpdatedAt: record.updatedAt };
}

/** A refused save marks the open editor rather than closing it, so nothing the participant typed is discarded. */
export function markCateringTimelineEditorConflict(editor: CateringTimelineEditorState, itemId: string): CateringTimelineEditorState {
  if (!editor || editor.itemId !== itemId) return editor;
  return { ...editor, conflict: true };
}
/**
 * Conflict recovery reloads from the AUTHORITATIVE collection, and only once the refetch has actually landed a
 * version other than the one that was refused. Reloading from the same version would reopen the editor on the very
 * state the server just rejected.
 */
export function mayReloadCateringTimelineEditor(editor: CateringTimelineEditorState, identity: string, items: readonly CateringExecutionTimelineItemView[]): boolean {
  if (!editor || editor.identity !== identity || !editor.conflict) return false;
  const fresh = items.find((item) => item.id === editor.itemId);
  return Boolean(fresh && fresh.updatedAt !== editor.expectedUpdatedAt);
}
/**
 * An editor left open on an item another tab deleted, or on a booking that became terminal, closes once the
 * authoritative payload says so: a read-only section refuses every write, so no draft may stay open against it.
 */
export function reconcileCateringTimelineEditor(editor: CateringTimelineEditorState, identity: string, editable: boolean, itemIds: readonly string[]): CateringTimelineEditorState {
  if (!editor) return null;
  if (editor.identity !== identity || !editable) return null;
  return itemIds.includes(editor.itemId) ? editor : null;
}

/* ------------------------------------------------------------------------------------------------------------- *
 * Reordering
 * ------------------------------------------------------------------------------------------------------------- */

export type CateringTimelineMoveDirection = "up" | "down";
/**
 * The requested new order, computed against the WHOLE authoritative collection.
 *
 * The array order becomes the persisted sort order, and every entry carries the version the client observed, so a
 * drag composed against a stale collection is refused rather than silently reinstating an order somebody else
 * already replaced. Returns null when the move is not possible, so no request is sent for a no-op.
 */
export function moveCateringTimelineItem(items: readonly CateringExecutionTimelineItemView[], itemId: string, direction: CateringTimelineMoveDirection): CateringExecutionTimelineItemView[] | null {
  const index = items.findIndex((item) => item.id === itemId);
  if (index === -1) return null;
  const target = direction === "up" ? index - 1 : index + 1;
  if (target < 0 || target >= items.length) return null;
  const next = [...items];
  [next[index], next[target]] = [next[target], next[index]];
  return next;
}
export function cateringTimelineReorderPayload(items: readonly CateringExecutionTimelineItemView[]) {
  return { items: items.map((item) => ({ id: item.id, expectedUpdatedAt: item.updatedAt })) };
}
export type CateringTimelineReorderControls = { up: boolean; down: boolean } | null;
/**
 * Whether the move controls are offered for one item, and in which directions.
 *
 * Offered only to a provider, on an editable section, with no request in flight and no editor open -- an editor
 * holds an `expectedUpdatedAt` that a reorder would immediately invalidate, so moving while editing would guarantee
 * the participant a conflict on save.
 */
export function cateringTimelineReorderControls(
  items: readonly CateringExecutionTimelineItemView[], itemId: string,
  state: { role: "provider" | "customer"; editable: boolean; editorOpen: boolean; pending: boolean },
): CateringTimelineReorderControls {
  if (state.role !== "provider" || !state.editable || state.editorOpen || items.length < 2) return null;
  const index = items.findIndex((item) => item.id === itemId);
  if (index === -1) return null;
  return { up: !state.pending && index > 0, down: !state.pending && index < items.length - 1 };
}

/* ------------------------------------------------------------------------------------------------------------- *
 * Access instructions form
 * ------------------------------------------------------------------------------------------------------------- */

export const CATERING_ACCESS_TEXT_FIELDS = [
  "loadInEntrance", "loadingDockNotes", "elevatorNotes", "kitchenAccessNotes", "parkingInstructions",
  "securityCheckInNotes", "accessWindowStart", "accessWindowEnd", "venueContactName", "venueContactPhone",
  "powerWaterNotes", "trashRemovalNotes", "specialRestrictions", "providerPrivateNotes",
] as const;
export type CateringAccessTextField = typeof CATERING_ACCESS_TEXT_FIELDS[number];
export type CateringAccessDraft = Record<CateringAccessTextField, string> & {
  venueContactSource: "" | "provider" | "customer";
  accessConfirmed: boolean;
  /** The version this form was hydrated from. Absent means "no access record existed when I loaded". */
  expectedUpdatedAt: string | null;
};

export function cateringAccessDraftFrom(access: CateringExecutionAccessView): CateringAccessDraft {
  const draft = {} as Record<CateringAccessTextField, string>;
  for (const field of CATERING_ACCESS_TEXT_FIELDS) {
    const value = field === "providerPrivateNotes" ? access.providerPrivateNotes : (access as Record<string, unknown>)[field];
    draft[field] = typeof value === "string" ? value : "";
  }
  return { ...draft, venueContactSource: access.venueContactSource ?? "", accessConfirmed: access.accessConfirmed, expectedUpdatedAt: access.updatedAt };
}
export function cateringAccessSavePayload(draft: CateringAccessDraft) {
  const body: Record<string, unknown> = {};
  for (const field of CATERING_ACCESS_TEXT_FIELDS) body[field] = optionalText(draft[field]);
  body.venueContactSource = draft.venueContactSource === "" ? null : draft.venueContactSource;
  body.accessConfirmed = draft.accessConfirmed;
  // Omitted entirely when the record does not exist yet, which is the precondition "expect no record". Sending null
  // would be a different assertion the schema does not accept.
  if (draft.expectedUpdatedAt !== null) body.expectedUpdatedAt = draft.expectedUpdatedAt;
  return body;
}
/**
 * Hydration keeps a dirty form. A poll landing while the provider is mid-sentence must not replace what they are
 * typing; the version they are editing against is likewise kept, so the save they eventually make is judged against
 * the state they actually saw.
 */
export type CateringAccessFormState = { identity: string; value: CateringAccessDraft | null; dirty: boolean };
export function hydrateCateringAccessForm(current: CateringAccessFormState, identity: string, next: CateringAccessDraft): CateringAccessFormState {
  if (current.identity === identity && current.dirty) return current;
  return { identity, value: next, dirty: false };
}
export function editCateringAccessField<K extends keyof CateringAccessDraft>(current: CateringAccessFormState, field: K, value: CateringAccessDraft[K]): CateringAccessFormState {
  if (!current.value) return current;
  return { ...current, value: { ...current.value, [field]: value }, dirty: true };
}
/** A failed save keeps the edit AND its dirty flag, so the next poll cannot quietly overwrite unsaved work. */
export function preserveCateringAccessForm(current: CateringAccessFormState): CateringAccessFormState {
  return current.value ? { ...current, dirty: true } : current;
}
/** An accepted save re-bases the form on the authoritative response, including its new version. */
export function settleCateringAccessForm(current: CateringAccessFormState, identity: string, saved: CateringExecutionAccessView): CateringAccessFormState {
  if (current.identity !== identity) return current;
  return { identity, value: cateringAccessDraftFrom(saved), dirty: false };
}

/* ------------------------------------------------------------------------------------------------------------- *
 * Presentation
 * ------------------------------------------------------------------------------------------------------------- */

/** The readiness badge's visual weight. Derived from the state alone, never from a count the client computed. */
export function cateringReadinessVariant(state: CateringReadinessState): "default" | "secondary" | "destructive" {
  return state === "blocked" ? "destructive" : state === "needs_attention" ? "secondary" : "default";
}
/** A scheduled window, rendered only from what is actually set. An unscheduled item says so rather than showing "–". */
export function formatCateringTimelineWindow(scheduledTime: string | null, endTime: string | null): string {
  if (!scheduledTime && !endTime) return "Unscheduled";
  if (scheduledTime && endTime) return `${scheduledTime}–${endTime}`;
  return scheduledTime ?? `until ${endTime}`;
}
export function formatCateringEquipmentWindow(date: string | null, time: string | null): string | null {
  if (!date && !time) return null;
  if (date && time) return `${date} ${time}`;
  return date ?? time;
}
/** Crew is labelled by its allowlisted role, or by the custom label the row actually carries. */
export function cateringStaffRoleLabel(assignment: Pick<CateringExecutionStaffView, "role" | "customRole">, labels: Record<CateringStaffRole, string>): string {
  return assignment.role === "custom" ? assignment.customRole || labels.custom : labels[assignment.role];
}
/**
 * Splits the run-of-show into what the provider keeps to themselves and what the customer also sees.
 *
 * A customer's payload contains shared items only, so for them the private list is always empty -- the split is not
 * what enforces privacy, the server's SQL filter is. This exists so a provider can SEE which parts of their plan
 * the customer is reading.
 */
export function splitCateringTimeline(items: readonly CateringExecutionTimelineItemView[]) {
  return {
    shared: items.filter((item) => item.visibility === "shared"),
    providerPrivate: items.filter((item) => item.visibility !== "shared"),
  };
}
export function splitCateringEquipment(items: readonly CateringExecutionEquipmentView[]) {
  return {
    shared: items.filter((item) => item.visibility === "shared"),
    providerPrivate: items.filter((item) => item.visibility !== "shared"),
  };
}
/** Only a provider is ever offered a visibility choice; a customer is shown no hint that one exists. */
export function cateringExecutionVisibilityChoices(role: "provider" | "customer"): { value: CateringExecutionVisibility; label: string }[] {
  return role === "provider"
    ? [{ value: "provider_private", label: "Provider only" }, { value: "shared", label: "Share with customer" }]
    : [];
}
export const CATERING_EXECUTION_READ_ONLY_BANNER = "This booking is cancelled or completed, so its execution plan is read-only.";
export const CATERING_EXECUTION_CUSTOMER_EMPTY = "Your caterer has not shared an event plan yet.";
export const CATERING_EXECUTION_PROVIDER_EMPTY = "No run-of-show has been added yet.";
