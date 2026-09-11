import {
  CATERING_CLOSEOUT_BLOCKED_CODE,
  CATERING_CLOSEOUT_ITEM_NOTE_MAXIMUM,
  CATERING_CLOSEOUT_NOTES_MAXIMUM,
  CATERING_CLOSEOUT_NOT_AVAILABLE_CODE,
  CATERING_CLOSEOUT_VERSION_CONFLICT_CODE,
  CATERING_CLOSEOUT_VERSION_CONFLICT_MESSAGE,
  type CateringCloseoutItemKey,
  type CateringCloseoutItemState,
  type CateringCloseoutItemView,
  type CateringCloseoutRecordView,
  type CateringCloseoutSignalState,
  type CateringCloseoutState,
} from "@shared/catering-booking-closeout";

/**
 * The pure state the Phase 2K closeout section is built from.
 *
 * Everything here is a total function of its arguments. There is no React, no fetch and no clock, which is what
 * makes the behaviour that actually matters -- identity scoping, conflict recovery, draft settlement -- testable
 * without a DOM, and what keeps the component a thin rendering of decisions taken here.
 *
 * IDENTITY SCOPING IS BUILT IN FROM THE START, not retrofitted. Every piece of local state in this module carries
 * the `userId:bookingId` it belongs to, and every predicate that decides whether something may render or submit
 * takes the identity on screen and compares it. That is the Phase 2J lesson applied at the outset: the booking
 * workspace stays MOUNTED across `/bookings/A` -> `/bookings/B`, so component state, in-flight requests and cached
 * responses all outlive the booking they were made for, and a value that does not say which booking it belongs to
 * cannot be stopped from rendering under another one.
 */

export type CateringCloseoutError = { message: string; code?: string; offline?: boolean };

/** A refused optimistic-concurrency precondition: the client must reload the newer record, not retry blindly. */
export function isCateringCloseoutConflict(error: CateringCloseoutError | null | undefined): boolean {
  return error?.code === CATERING_CLOSEOUT_VERSION_CONFLICT_CODE;
}
/** The booking's lifecycle does not permit closeout work -- which means the view on screen is stale. */
export function isCateringCloseoutUnavailable(error: CateringCloseoutError | null | undefined): boolean {
  return error?.code === CATERING_CLOSEOUT_NOT_AVAILABLE_CODE;
}

/**
 * Whether a refusal means the authoritative closeout view must be re-read.
 *
 * A conflict, a lifecycle refusal and a blocked completion all describe a server state the client's copy no longer
 * matches, so all three refetch. A transport failure deliberately does NOT: the request may have been applied and
 * its response lost, and refetching would not tell the participant anything the retry will not, while a refetch on
 * a connection that just failed is likely to fail too.
 */
export function shouldRefetchCloseoutAfterError(error: CateringCloseoutError | null | undefined): boolean {
  if (!error || error.offline) return false;
  return error.code === CATERING_CLOSEOUT_VERSION_CONFLICT_CODE
    || error.code === CATERING_CLOSEOUT_NOT_AVAILABLE_CODE
    || error.code === CATERING_CLOSEOUT_BLOCKED_CODE;
}

/**
 * What the participant is told about a failed closeout write, and whether retrying is the right response.
 *
 * A conflict is not retryable: the same stale precondition would be refused again, so the answer is to reload the
 * newer record. A lifecycle refusal is not retryable either -- the booking is what it is. A transport failure IS
 * retryable, and keeps the participant's draft, because the write may or may not have landed and their words are
 * not something a lost response may throw away.
 */
export function cateringCloseoutFailureNotice(error: CateringCloseoutError): { message: string; retryable: boolean; keepsEdit: boolean } {
  if (error.offline) return { message: "We could not reach ChefSire. Your changes are still here -- try again.", retryable: true, keepsEdit: true };
  if (isCateringCloseoutConflict(error)) return { message: CATERING_CLOSEOUT_VERSION_CONFLICT_MESSAGE, retryable: false, keepsEdit: true };
  return { message: error.message || "This closeout change could not be saved", retryable: !error.code, keepsEdit: true };
}

/* ------------------------------------------------------------------------------------------------------------- *
 * Identity-scoped local state
 * ------------------------------------------------------------------------------------------------------------- */

/**
 * One piece of booking-local state, tagged with the booking it describes.
 *
 * `identity` is `userId:bookingId`, and it is part of the VALUE rather than of a ref beside it, so any code holding
 * the value can ask the question. `dirty` records that the participant has typed something the server has not
 * accepted, which is what stops a poll from replacing their words.
 */
export type CateringCloseoutFormState<T> = { identity: string; value: T; dirty: boolean; conflicted: boolean };

export function emptyCateringCloseoutForm<T>(value: T): CateringCloseoutFormState<T> {
  return { identity: "", value, dirty: false, conflicted: false };
}

/**
 * Hydrates a form from the authoritative payload, unless the participant has unsaved edits.
 *
 * Three cases, decided in one place. A form belonging to another booking is REPLACED wholesale -- never merged --
 * because nothing about booking A's draft is relevant to booking B. A clean form takes the authoritative value. A
 * dirty form is left alone, so a fifteen-second poll cannot quietly overwrite a half-written note.
 *
 * The exception is a form whose last save was refused as stale: it keeps the participant's text and clears the
 * conflict, because the version it will now submit against comes from the payload this hydration is carrying.
 */
export function hydrateCateringCloseoutForm<T>(current: CateringCloseoutFormState<T>, identity: string, next: T): CateringCloseoutFormState<T> {
  if (current.identity !== identity) return { identity, value: next, dirty: false, conflicted: false };
  if (current.conflicted) return { ...current, conflicted: false };
  if (current.dirty) return current;
  return { ...current, value: next };
}

/** An edit marks the form dirty and clears any conflict flag: the participant is composing a fresh attempt. */
export function editCateringCloseoutForm<T>(current: CateringCloseoutFormState<T>, value: T): CateringCloseoutFormState<T> {
  return { ...current, value, dirty: true, conflicted: false };
}
/** A refused save keeps the text and records that the next hydration must rebase it onto the newer version. */
export function markCateringCloseoutFormConflict<T>(current: CateringCloseoutFormState<T>): CateringCloseoutFormState<T> {
  return { ...current, dirty: true, conflicted: true };
}

/**
 * Settles a form against the EXACT value that was submitted, not against whatever is on screen when the response
 * lands.
 *
 * The form stays editable during a slow request on purpose -- a provider on a venue car park should not be made to
 * wait -- so by the time a save is accepted the text may already have moved on. Clearing unconditionally is how
 * those newer words disappeared. If the live value is still the submitted one the form goes clean; if it has moved
 * on it is left entirely alone, and the next save carries the version this one just produced.
 */
export function settleCateringCloseoutForm<T>(
  current: CateringCloseoutFormState<T>,
  identity: string,
  submitted: T,
  authoritative: T,
): CateringCloseoutFormState<T> {
  if (current.identity !== identity) return current;
  if (current.value !== submitted) return current;
  return { identity, value: authoritative, dirty: false, conflicted: false };
}

/**
 * Whether a form may be read or submitted right now.
 *
 * It is the identity check and nothing else, stated once so the render path and every handler ask exactly the same
 * question rather than two slightly different ones.
 */
export function cateringCloseoutFormIsCurrent<T>(current: CateringCloseoutFormState<T>, identity: string): boolean {
  return current.identity === identity;
}

/* ------------------------------------------------------------------------------------------------------------- *
 * Checklist drafts
 * ------------------------------------------------------------------------------------------------------------- */

/**
 * The open editor for one checklist item.
 *
 * `expectedUpdatedAt` is the version the editor was opened against, captured at open time and carried through the
 * save: it is `null` for a key with no row yet, which is exactly what the server reads as a first touch. It is
 * never re-read from a later payload while the editor is open, because that would silently rebase a stale edit
 * onto a newer record and defeat the precondition entirely.
 */
export type OpenCateringCloseoutItemEditor = {
  identity: string;
  key: CateringCloseoutItemKey;
  state: CateringCloseoutItemState;
  note: string;
  expectedUpdatedAt: string | null;
  conflicted: boolean;
};
export type CateringCloseoutItemEditorState = OpenCateringCloseoutItemEditor | null;

export function cateringCloseoutEditorFor(item: CateringCloseoutItemView, identity: string): OpenCateringCloseoutItemEditor {
  return { identity, key: item.key, state: item.state, note: item.providerNote ?? "", expectedUpdatedAt: item.updatedAt, conflicted: false };
}
export function editCateringCloseoutEditor(
  editor: CateringCloseoutItemEditorState,
  identity: string,
  key: CateringCloseoutItemKey,
  patch: Partial<Pick<OpenCateringCloseoutItemEditor, "state" | "note">>,
): CateringCloseoutItemEditorState {
  if (!editor || editor.identity !== identity || editor.key !== key) return editor;
  return { ...editor, ...patch, conflicted: false };
}
/**
 * The editor for one item, or null.
 *
 * Refuses on identity first, which is what stops booking A's open editor from rendering into booking B's list --
 * including for the one committed render before a passive reset effect has flushed.
 */
export function activeCateringCloseoutEditor(
  editor: CateringCloseoutItemEditorState,
  identity: string,
  key: CateringCloseoutItemKey,
  actionable: boolean,
): OpenCateringCloseoutItemEditor | null {
  if (!actionable || !editor || editor.identity !== identity || editor.key !== key) return null;
  return editor;
}
export function maySubmitCateringCloseoutEditor(editor: OpenCateringCloseoutItemEditor, actionable: boolean, pending: boolean): boolean {
  return actionable && !pending && !editor.conflicted && editor.note.length <= CATERING_CLOSEOUT_ITEM_NOTE_MAXIMUM;
}
export function markCateringCloseoutEditorConflict(editor: CateringCloseoutItemEditorState, key: CateringCloseoutItemKey): CateringCloseoutItemEditorState {
  if (!editor || editor.key !== key) return editor;
  return { ...editor, conflicted: true };
}
/**
 * Whether a conflicted editor may be reloaded onto the newer record.
 *
 * Only once the post-conflict refetch has actually landed a version OTHER than the one that was refused. Offering
 * the reload before then would reload the same stale version and conflict again, which reads as the control being
 * broken.
 */
export function mayReloadCateringCloseoutEditor(
  editor: CateringCloseoutItemEditorState,
  identity: string,
  items: readonly CateringCloseoutItemView[],
): boolean {
  if (!editor || editor.identity !== identity || !editor.conflicted) return false;
  const fresh = items.find((item) => item.key === editor.key);
  return Boolean(fresh && fresh.updatedAt !== editor.expectedUpdatedAt);
}
/** An editor open on a booking that is no longer actionable closes; one on a live item keeps the provider's text. */
export function reconcileCateringCloseoutEditor(
  editor: CateringCloseoutItemEditorState,
  identity: string,
  actionable: boolean,
): CateringCloseoutItemEditorState {
  if (!editor) return null;
  if (editor.identity !== identity) return null;
  return actionable ? editor : null;
}
/** After an accepted save the editor closes, unless the provider has kept typing into the very same item. */
export function settleCateringCloseoutEditor(
  editor: CateringCloseoutItemEditorState,
  submitted: { identity: string; key: CateringCloseoutItemKey; state: CateringCloseoutItemState; note: string },
  saved: CateringCloseoutItemView | undefined,
): CateringCloseoutItemEditorState {
  if (!editor || editor.identity !== submitted.identity || editor.key !== submitted.key) return editor;
  if (editor.state !== submitted.state || editor.note !== submitted.note) {
    // Newer edits are kept and rebased onto the version this save produced, so the next attempt can succeed.
    return saved ? { ...editor, expectedUpdatedAt: saved.updatedAt, conflicted: false } : editor;
  }
  return null;
}

/* ------------------------------------------------------------------------------------------------------------- *
 * Payloads
 * ------------------------------------------------------------------------------------------------------------- */

/** An empty note means "not set", which the API spells `null`. An empty string would be a value. */
export function closeoutOptionalText(value: string): string | null {
  const trimmed = value.trim();
  return trimmed === "" ? null : trimmed;
}
export function cateringCloseoutItemPayload(editor: OpenCateringCloseoutItemEditor) {
  return {
    state: editor.state,
    providerNote: closeoutOptionalText(editor.note),
    // Absent on a first touch, present thereafter -- exactly what the server distinguishes under its own lock.
    ...(editor.expectedUpdatedAt ? { expectedUpdatedAt: editor.expectedUpdatedAt } : {}),
  };
}
export function cateringCloseoutNotesPayload(notes: string, expectedUpdatedAt: string | null) {
  return {
    providerNotes: closeoutOptionalText(notes),
    ...(expectedUpdatedAt ? { expectedUpdatedAt } : {}),
  };
}
/**
 * The precondition a completion or a reopening states.
 *
 * Absent when no closeout record exists yet, which is exactly what the server reads as a first write. Both actions
 * take the same shape because both are preconditions on the same single record; they are named separately so a
 * later change to one cannot silently change the other.
 */
export function cateringCloseoutCompletePayload(record: CateringCloseoutRecordView) {
  return record.updatedAt ? { expectedUpdatedAt: record.updatedAt } : {};
}
export function cateringCloseoutReopenPayload(record: CateringCloseoutRecordView) {
  return record.updatedAt ? { expectedUpdatedAt: record.updatedAt } : {};
}
export function mayEditCateringCloseoutNotes(form: CateringCloseoutFormState<string>, identity: string, actionable: boolean, pending: boolean): boolean {
  return actionable && !pending && cateringCloseoutFormIsCurrent(form, identity) && form.value.length <= CATERING_CLOSEOUT_NOTES_MAXIMUM;
}

/* ------------------------------------------------------------------------------------------------------------- *
 * Presentation
 * ------------------------------------------------------------------------------------------------------------- */

export function cateringCloseoutStateVariant(state: CateringCloseoutState): "default" | "secondary" | "destructive" | "outline" {
  if (state === "blocked") return "destructive";
  if (state === "closed_out") return "default";
  if (state === "ready_to_close") return "secondary";
  return "outline";
}
export function cateringCloseoutSignalVariant(state: CateringCloseoutSignalState): "default" | "secondary" | "destructive" {
  if (state === "blocked") return "destructive";
  if (state === "needs_attention") return "secondary";
  return "default";
}
/** The items a provider still has to answer, so the interface can lead with them rather than with a flat list. */
export function outstandingCateringCloseoutItems(items: readonly CateringCloseoutItemView[]): CateringCloseoutItemView[] {
  return items.filter((item) => item.state === "pending");
}
/** Progress as counts alone, computed from the payload rather than from a number the server was asked to store. */
export function cateringCloseoutProgress(items: readonly CateringCloseoutItemView[]): { resolved: number; total: number } {
  return { resolved: items.filter((item) => item.state !== "pending").length, total: items.length };
}
export function formatCateringCloseoutInstant(instant: string | null): string {
  if (!instant) return "";
  const parsed = new Date(instant);
  return Number.isNaN(parsed.getTime()) ? "" : parsed.toLocaleString();
}
