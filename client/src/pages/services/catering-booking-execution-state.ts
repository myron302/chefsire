import {
  CATERING_EXECUTION_NOT_FOUND_CODE,
  CATERING_EXECUTION_SET_CHANGED_CODE,
  CATERING_EXECUTION_VERSION_CONFLICT_CODE,
  CATERING_WORKSPACE_READ_ONLY_CODE,
  cateringEquipmentIsBlocking,
  cateringTimelineItemIsBlocking,
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
 * What every create draft carries alongside its fields: the idempotency token, and the material payload that token
 * was minted FOR.
 *
 * The fingerprint is the load-bearing half. A token that is reused simply because one exists is a token that can be
 * pointed at a payload it was never issued for, and the server -- correctly -- answers such a request with the
 * record the token already produced. The client then reads that as "my current draft was saved" and clears work
 * that was never persisted at all:
 *
 *   1. payload A is submitted under token X;  2. the server commits A;  3. the response is lost;
 *   4. the provider materially edits the draft into payload B;  5. a retry under X returns A;
 *   6. the client clears B, which never existed anywhere.
 *
 * Binding the token to a fingerprint of its payload makes that impossible: an exact retry of A reuses X (which is
 * what idempotency is for), and B is a different payload, so it gets its own token and is genuinely created.
 */
export type CateringDraftToken = {
  requestId: string | null;
  /** The material payload `requestId` was minted for, or null when no token has been minted yet. */
  requestFingerprint: string | null;
};
export type CateringTimelineDraft = CateringDraftToken & {
  title: string; description: string; category: CateringTimelineCategory;
  scheduledTime: string; endTime: string; visibility: CateringExecutionVisibility; isBlocker: boolean;
};
export const EMPTY_CATERING_TIMELINE_DRAFT: CateringTimelineDraft = {
  title: "", description: "", category: "setup", scheduledTime: "", endTime: "", visibility: "provider_private", isBlocker: false,
  requestId: null, requestFingerprint: null,
};
export type CateringStaffDraft = CateringDraftToken & {
  workerName: string; role: CateringStaffRole; customRole: string; contactNote: string;
  arrivalTime: string; departureTime: string; responsibilityNote: string;
};
export const EMPTY_CATERING_STAFF_DRAFT: CateringStaffDraft = {
  workerName: "", role: "server", customRole: "", contactNote: "", arrivalTime: "", departureTime: "", responsibilityNote: "",
  requestId: null, requestFingerprint: null,
};
export type CateringEquipmentDraft = CateringDraftToken & {
  name: string; quantity: string; sourceType: CateringEquipmentSource; sourceName: string;
  pickupDate: string; pickupTime: string; returnDate: string; returnTime: string;
  status: CateringEquipmentStatus; isBlocker: boolean; notes: string; visibility: CateringExecutionVisibility;
};
export const EMPTY_CATERING_EQUIPMENT_DRAFT: CateringEquipmentDraft = {
  name: "", quantity: "1", sourceType: "provider_owned", sourceName: "", pickupDate: "", pickupTime: "",
  returnDate: "", returnTime: "", status: "planned", isBlocker: false, notes: "", visibility: "provider_private",
  requestId: null, requestFingerprint: null,
};

/** An empty text input means "not set", which the API spells `null`. An empty string would be a value. */
export function optionalText(value: string): string | null {
  const trimmed = value.trim();
  return trimmed === "" ? null : trimmed;
}
/**
 * The MATERIAL part of a create request: the body the server will act on, with the idempotency token removed.
 *
 * Derived from the real payload builders rather than from the draft, so only fields that actually travel in the
 * request participate. A draft's own bookkeeping -- the token, the fingerprint -- is client-only and is excluded by
 * construction, because it never appears in a built body at all.
 */
export function cateringMaterialPayload(body: Record<string, unknown>): Record<string, unknown> {
  const { clientRequestId: _token, ...material } = body;
  return material;
}
/** A stable fingerprint of that material payload: key order cannot change the answer. */
export function cateringMaterialFingerprint(body: Record<string, unknown>): string {
  const material = cateringMaterialPayload(body);
  return JSON.stringify(Object.keys(material).sort().map((field) => [field, material[field]]));
}

/**
 * Prepares one create attempt: the draft to store, and the body to send.
 *
 * The token is reused only when the material payload is IDENTICAL to the one it was minted for -- which is exactly
 * an exact retry, and exactly when the server resolving to the already-created record is the right answer. Any
 * material change mints a fresh token, so the changed payload is created rather than silently answered with the
 * older record.
 *
 * The body is built from the draft that will be stored, so the token in the request and the token in the draft are
 * always the same one.
 */
export function prepareCateringCreate<T extends CateringDraftToken>(
  draft: T,
  build: (draft: T) => Record<string, unknown>,
  mint: () => string,
): { draft: T; body: Record<string, unknown> } {
  const fingerprint = cateringMaterialFingerprint(build(draft));
  const reusable = draft.requestId !== null && draft.requestFingerprint === fingerprint;
  const next = reusable ? draft : { ...draft, requestId: mint(), requestFingerprint: fingerprint };
  return { draft: next, body: build(next) };
}

/** After an accepted submit the token is spent, so the reset draft carries neither it nor its fingerprint. */
export function resetCateringDraft<T extends CateringDraftToken>(empty: T): T {
  return { ...empty, requestId: null, requestFingerprint: null };
}

/**
 * Whether the live draft is still exactly the attempt that was submitted.
 *
 * Drafts are flat records of scalars, so this is a whole-value comparison including the token and its fingerprint --
 * any keystroke, any changed select, any newer attempt makes it false.
 */
export function cateringDraftIsUnchanged<T extends CateringDraftToken>(live: T, submitted: T): boolean {
  const fields = Object.keys(live as object).concat(Object.keys(submitted as object));
  return fields.every((field) => (live as Record<string, unknown>)[field] === (submitted as Record<string, unknown>)[field]);
}

/**
 * Settles a create draft against the exact attempt the server just accepted.
 *
 * The form stays editable while a request is in flight -- deliberately, because a provider on a slow venue
 * connection should not be made to wait -- so by the time a response lands the draft may already hold the NEXT
 * record they are typing. Clearing unconditionally is how that record disappeared: submit A, start typing B, A
 * succeeds, B is wiped, and nothing anywhere records that B ever existed.
 *
 * So the completion clears only what it actually accounts for. If the live draft is still the submitted attempt, the
 * form empties as it should. If it has moved on, the newer edits are kept and it is left entirely alone -- the
 * created record appears in the list above either way, which is the real confirmation that A landed.
 */
export function settleCateringCreateDraft<T extends CateringDraftToken>(live: T, submitted: T, empty: T): T {
  return cateringDraftIsUnchanged(live, submitted) ? resetCateringDraft(empty) : live;
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
  draft: Omit<CateringTimelineDraft, keyof CateringDraftToken>;
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

/**
 * Settles the open item editor against the exact draft that was submitted.
 *
 * Closing on success was unconditional, which is the same bug the create drafts had: the fields stay editable while
 * the request is in flight, so a provider who kept typing after pressing Save had those words closed away and lost.
 * If the editor still holds what was sent, it closes as it should. If it has moved on, it stays OPEN with the newer
 * text and is rebased onto the version the save just produced -- so the next Save is judged against the row as it
 * now is, rather than conflicting against the version this very request superseded.
 */
export function settleCateringTimelineEditor(
  live: CateringTimelineEditorState,
  submitted: { itemId: string; draft: OpenCateringTimelineEditor["draft"] },
  savedUpdatedAt: string,
): CateringTimelineEditorState {
  if (!live || live.itemId !== submitted.itemId) return live;
  const untouched = (Object.keys(live.draft) as (keyof OpenCateringTimelineEditor["draft"])[])
    .every((field) => live.draft[field] === submitted.draft[field]);
  if (untouched) return null;
  return { ...live, expectedUpdatedAt: savedUpdatedAt, conflict: false };
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
/**
 * The access form's local state.
 *
 * `rebase` is set when the server refused a save because the form's `expectedUpdatedAt` was stale. Without it, a
 * conflict was terminal: the form stays dirty so the refetch cannot hydrate it, the stale version therefore stays
 * in the draft, and every subsequent Save conflicts again -- forever, until the provider hard-refreshes and loses
 * everything they had typed. The flag is what lets the next authoritative payload hand the form a fresh version
 * WITHOUT touching a single edited field.
 */
export type CateringAccessFormState = { identity: string; value: CateringAccessDraft | null; dirty: boolean; rebase?: boolean };
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

/**
 * Marks a dirty access form as needing its concurrency version rebased, after the server refused the save as stale.
 *
 * The edits are untouched -- this only records that the version they are based on is no longer current, so the next
 * authoritative payload can supply a usable one.
 */
export function markCateringAccessConflict(current: CateringAccessFormState): CateringAccessFormState {
  return current.value ? { ...current, dirty: true, rebase: true } : current;
}

/**
 * REBASES a dirty access form onto the authoritative version, keeping every edited field exactly as it is.
 *
 * This is the whole of the fix. Only `expectedUpdatedAt` moves; every instruction the provider typed stays. The
 * next Save is then judged against the version the server actually holds, so it can succeed -- no hard refresh, no
 * lost draft, and optimistic concurrency fully intact, because the form is still stating a real version it has now
 * genuinely observed.
 *
 * It applies only to a form that asked to be rebased and only when the authoritative record actually carries a
 * DIFFERENT version, so a refetch that has not landed yet leaves the flag set and tries again on the next one. The
 * lost-response case resolves through here too: if the save really did commit before the response was lost, the
 * refetch shows those values, the rebase supplies the new version, and re-saving an unchanged record is a harmless
 * no-op server-side (no activity, no notification).
 */
export function rebaseCateringAccessForm(current: CateringAccessFormState, identity: string, authoritative: CateringExecutionAccessView): CateringAccessFormState {
  if (!current.value || current.identity !== identity || !current.rebase) return current;
  if (authoritative.updatedAt === current.value.expectedUpdatedAt) return current;
  return { ...current, value: { ...current.value, expectedUpdatedAt: authoritative.updatedAt }, dirty: true, rebase: false };
}

/**
 * The one path the component's hydration effect takes, so the three cases cannot be applied in the wrong order.
 *
 * A clean form (or a different booking) hydrates wholesale. A dirty form awaiting a rebase keeps its edits and takes
 * the new version. A dirty form that is merely dirty is left completely alone.
 */
export function reconcileCateringAccessForm(current: CateringAccessFormState, identity: string, authoritative: CateringExecutionAccessView): CateringAccessFormState {
  if (current.identity !== identity || !current.dirty) return hydrateCateringAccessForm(current, identity, cateringAccessDraftFrom(authoritative));
  return rebaseCateringAccessForm(current, identity, authoritative);
}
/**
 * An accepted save re-bases the form on the authoritative response -- but only when the form still holds what was
 * actually sent.
 *
 * Same rule as everywhere else in this module: a provider may have kept typing while the save was in flight, and
 * replacing the form with the server's answer would discard those words. When the live form has moved on, its edits
 * are kept and only the concurrency version is taken from the response, so the next Save is judged against the row
 * this save just produced instead of conflicting against the version it replaced.
 */
export function settleCateringAccessForm(
  current: CateringAccessFormState,
  identity: string,
  saved: CateringExecutionAccessView,
  submitted?: CateringAccessDraft,
): CateringAccessFormState {
  if (current.identity !== identity) return current;
  const live = current.value;
  const untouched = !submitted || !live
    || (Object.keys(live) as (keyof CateringAccessDraft)[]).every((field) => live[field] === submitted[field]);
  // Clean, and rebased onto the version just written -- so there is nothing left to reconcile.
  if (untouched) return { identity, value: cateringAccessDraftFrom(saved), dirty: false, rebase: false };
  return { identity, value: { ...live!, expectedUpdatedAt: saved.updatedAt }, dirty: true, rebase: false };
}

/* ------------------------------------------------------------------------------------------------------------- *
 * Presentation
 * ------------------------------------------------------------------------------------------------------------- */

/**
 * Whether the interface shows a Blocking badge, by the SAME predicate the server's readiness derivation uses.
 *
 * Reading `isBlocker` alone made the badge disagree with the readiness summary rendered a few lines above it: a
 * rental that had been received, put into use, returned or cancelled is settled and no longer counted as blocking
 * by the server, yet still wore a destructive "Blocking" badge. These re-export the canonical predicates rather
 * than restating the status list, so the two readings cannot drift. The persisted `isBlocker` flag is untouched --
 * it is the record of what was on the critical path, and hiding a badge is not a reason to erase it.
 */
export { cateringEquipmentIsBlocking, cateringTimelineItemIsBlocking };

/**
 * Whether a read-only access record has any instruction TEXT to show, which is a different question from whether it
 * has anything meaningful to say.
 *
 * Confirmation and instructions are separate facts. A record with `accessConfirmed: true` and no notes is a real,
 * meaningful state -- the caterer has confirmed they can get in -- and rendering "No access instructions have been
 * added." instead of it told the customer the opposite of the truth. So the empty-instructions message is now
 * exactly that, shown alongside the confirmation rather than in place of it.
 */
export function cateringAccessHasInstructions(entries: readonly unknown[]): boolean {
  return entries.length > 0;
}
export const CATERING_ACCESS_NO_INSTRUCTIONS = "No access instructions have been added.";

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
