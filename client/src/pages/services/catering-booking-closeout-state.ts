import {
  CATERING_CLOSEOUT_BLOCKED_CODE,
  CATERING_CLOSEOUT_CLOSED_CODE,
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
    || error.code === CATERING_CLOSEOUT_BLOCKED_CODE
    // A checklist edit refused because closeout is already closed means this client's payload still shows it open.
    || error.code === CATERING_CLOSEOUT_CLOSED_CODE;
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
 * Authoritative versions returned by accepted mutations
 * ------------------------------------------------------------------------------------------------------------- */

/**
 * The freshest authoritative versions this client has been TOLD about by an accepted mutation response.
 *
 * ONE COHERENT RULE, and this ledger is what enforces it: a successful mutation response that advances an
 * authoritative version must immediately advance the version subsequent mutations state their precondition
 * against. Query invalidation still runs afterwards for full reconciliation, but it is no longer the only thing
 * that moves the concurrency token.
 *
 * Without this there is a real, single-actor race with no competing editor anywhere in it. A provider saves their
 * private notes on record version A; the server writes and answers with version B; the mutation settles and
 * `isPending` goes false while the invalidated query has not refetched yet; the provider immediately saves again,
 * completes closeout, or reopens it -- and that second request states `expectedUpdatedAt: A`, which the server
 * correctly refuses with a 409 that describes a conflict that never happened. The same shape exists between
 * complete and reopen, and on the checklist between an item save and reopening that item's editor.
 *
 * Adopting the version our OWN accepted write produced is not a weakening of optimistic concurrency. The whole
 * point of the precondition is "I am editing on top of what I last saw", and we did see this: we made it. There is
 * no unseen third-party change hiding behind a version the server minted for our own request, and the server's
 * requirement is untouched -- every write still carries a precondition and is still refused if it is stale.
 */
export type CateringCloseoutVersions = {
  /** The booking these versions describe. A ledger from another booking is never read. */
  identity: string;
  /** The closeout record version the newest accepted record mutation returned, or null. */
  record: string | null;
  /** Per-item versions the newest accepted checklist saves returned, keyed by item key. */
  items: Readonly<Record<string, string>>;
};

export const EMPTY_CATERING_CLOSEOUT_VERSIONS: CateringCloseoutVersions = { identity: "", record: null, items: {} };

/**
 * The later of two serialized instants, comparing the INSTANT rather than its spelling -- exactly as the server's
 * own precondition check does, so a value round-tripped through any equivalent ISO form still compares equal.
 *
 * Taking the LATER of the adopted version and the query's is correct in both directions. Immediately after a save
 * the adopted one is newer and is used. Once the refetch lands the two agree. And if another tab has since
 * advanced the record, the query's is newer and wins -- which is the same version this client would have sent
 * before the ledger existed, so nothing is made weaker, only better informed. An unparseable value never wins.
 */
export function laterCateringVersion(left: string | null | undefined, right: string | null | undefined): string | null {
  const leftAt = left == null ? NaN : Date.parse(left);
  const rightAt = right == null ? NaN : Date.parse(right);
  if (!Number.isFinite(leftAt)) return Number.isFinite(rightAt) ? right! : null;
  if (!Number.isFinite(rightAt)) return left!;
  return rightAt > leftAt ? right! : left!;
}

/**
 * Reads the authoritative versions out of one accepted mutation response.
 *
 * Deliberately general rather than one reader per route: it takes whichever of `closeout` and `checklist` the
 * response actually carries, so the rule holds for every current Phase 2K mutation and for any later one whose
 * response carries both. Today `PUT /closeout/notes`, `POST /closeout/complete` and `POST /closeout/reopen` return
 * a record, and `PUT /closeout/items/:key` returns the checklist; none of them returns the other, and none of them
 * has to be special-cased here.
 */
export function cateringCloseoutVersionsFromResponse(value: Record<string, unknown> | null | undefined): { record?: string | null; items?: Record<string, string> } {
  const result: { record?: string | null; items?: Record<string, string> } = {};
  const record = (value?.closeout as { updatedAt?: string | null } | undefined)?.updatedAt;
  if (typeof record === "string") result.record = record;
  const checklist = value?.checklist as readonly CateringCloseoutItemView[] | undefined;
  if (Array.isArray(checklist)) {
    const items: Record<string, string> = {};
    for (const item of checklist) if (typeof item?.updatedAt === "string") items[item.key] = item.updatedAt;
    result.items = items;
  }
  return result;
}

/**
 * Installs the versions an accepted response returned, under the booking that issued the request.
 *
 * A ledger belonging to another booking is REPLACED rather than merged, so booking A's versions can never leak into
 * booking B's -- the same discipline every other piece of state in this module follows. Each version is merged with
 * `laterCateringVersion`, so an out-of-order response cannot move a version backwards.
 */
export function adoptCateringCloseoutVersions(
  current: CateringCloseoutVersions,
  identity: string,
  returned: { record?: string | null; items?: Record<string, string> },
): CateringCloseoutVersions {
  const base = current.identity === identity ? current : { identity, record: null, items: {} };
  const record = returned.record === undefined ? base.record : laterCateringVersion(base.record, returned.record);
  let items = base.items;
  if (returned.items) {
    const next: Record<string, string> = { ...base.items };
    for (const [key, version] of Object.entries(returned.items)) {
      const merged = laterCateringVersion(next[key] ?? null, version);
      if (merged) next[key] = merged;
    }
    items = next;
  }
  return { identity, record, items };
}

/**
 * The closeout record a mutation should state its precondition against.
 *
 * The authoritative record from the query, with `updatedAt` advanced to the freshest version this client knows.
 * Rebasing ONCE here, at the top, is what keeps the three record mutations -- notes, complete and reopen -- from
 * each having to remember to do it, and is why a version adopted by any one of them is immediately used by the
 * other two. A ledger from another booking is ignored outright, so the one committed render before a navigation
 * reset flushes cannot rebase booking B's record onto booking A's version.
 */
export function cateringCloseoutRebasedRecord(
  record: CateringCloseoutRecordView,
  versions: CateringCloseoutVersions,
  identity: string,
): CateringCloseoutRecordView {
  if (versions.identity !== identity || versions.record === null) return record;
  const updatedAt = laterCateringVersion(record.updatedAt ?? null, versions.record);
  return updatedAt === (record.updatedAt ?? null) ? record : { ...record, updatedAt };
}

/**
 * The checklist an editor should be opened from, with each item's version advanced to the freshest known.
 *
 * Rebasing the LIST rather than the editor means every downstream reader -- opening an editor, deciding whether a
 * conflicted one may reload, rendering -- sees the same versions with no signature of its own to change. It is what
 * fixes the checklist's own instance of this race: answer an item, watch its editor close, immediately reopen it,
 * and the editor used to be built from the stale query row and conflict on the very next save.
 *
 * A conflicted editor's reload offer is unaffected: a refused save adopts nothing, so the ledger holds no newer
 * version for that item and this is a no-op in exactly that case.
 */
export function cateringCloseoutRebasedChecklist(
  items: readonly CateringCloseoutItemView[],
  versions: CateringCloseoutVersions,
  identity: string,
): CateringCloseoutItemView[] {
  if (versions.identity !== identity) return [...items];
  return items.map((item) => {
    const updatedAt = laterCateringVersion(item.updatedAt, versions.items[item.key] ?? null);
    return updatedAt === item.updatedAt ? item : { ...item, updatedAt };
  });
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
  editable: boolean,
): OpenCateringCloseoutItemEditor | null {
  if (!editable || !editor || editor.identity !== identity || editor.key !== key) return null;
  return editor;
}
/**
 * `editable` is the CHECKLIST's own editability, not merely whether closeout is actionable. Callers pass
 * `cateringCloseoutChecklistIsEditable(actionable, closedOut)`, so an editor stops being submittable the moment
 * this client learns closeout was closed -- including by another tab, through an ordinary poll.
 */
export function maySubmitCateringCloseoutEditor(editor: OpenCateringCloseoutItemEditor, editable: boolean, pending: boolean): boolean {
  return editable && !pending && !editor.conflicted && editor.note.length <= CATERING_CLOSEOUT_ITEM_NOTE_MAXIMUM;
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
/**
 * An editor open on a booking whose checklist is no longer editable closes; one on a live item keeps the
 * provider's text. `editable` is the checklist's own editability, so closing out through a poll drops the editor
 * rather than leaving it on screen to be refused.
 */
export function reconcileCateringCloseoutEditor(
  editor: CateringCloseoutItemEditorState,
  identity: string,
  editable: boolean,
): CateringCloseoutItemEditorState {
  if (!editor) return null;
  if (editor.identity !== identity) return null;
  return editable ? editor : null;
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
