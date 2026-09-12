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
/**
 * One booking-local form, and the authoritative version its editable text was hydrated FROM.
 *
 * `baseVersion` is the whole point of this shape. The form deliberately keeps the participant's unsaved text when
 * a fifteen-second poll brings in a newer record -- but the version it submits against has to be kept with it.
 * Taking `expectedUpdatedAt` from the freshly polled payload instead let a dirty draft claim it was based on a
 * record the provider had never seen: another tab saves at V1 -> V2, this tab polls V2, keeps its own text, and
 * then submits that text stating V2. The server accepts it, and the other tab's words are silently gone.
 *
 * So the version travels WITH the text. It advances only when this form's own save is accepted, or when a clean
 * form hydrates; never merely because somebody else wrote.
 */
export type CateringCloseoutFormState<T> = {
  identity: string;
  value: T;
  /** The authoritative `updatedAt` this form's text was hydrated from, or null before any record existed. */
  baseVersion: string | null;
  dirty: boolean;
  conflicted: boolean;
};

export function emptyCateringCloseoutForm<T>(value: T): CateringCloseoutFormState<T> {
  return { identity: "", value, baseVersion: null, dirty: false, conflicted: false };
}

/**
 * Hydrates a form from the authoritative payload, unless the participant has unsaved edits.
 *
 * Four cases, decided in one place.
 *
 * A form belonging to another booking is REPLACED wholesale -- never merged -- because nothing about booking A's
 * draft is relevant to booking B, including its version.
 *
 * A CLEAN form takes both the authoritative text and the authoritative version. There is nothing to lose, so
 * moving with the record is always safe.
 *
 * A DIRTY form keeps BOTH. Keeping the text while letting the version advance was the defect: it is precisely the
 * combination that claims "I edited the newest record" about a draft written against an older one.
 *
 * A form whose last save was REFUSED AS STALE is returned COMPLETELY untouched -- text, version and the conflict
 * flag alike. Keeping the text and version while clearing the flag was strictly the worst of both: saving
 * re-enabled, the discard control vanished, and the next save still stated the version that had just been refused,
 * so the provider could loop on 409 forever with no way out. The conflict is theirs to resolve, and a poll is not
 * a resolution -- only the explicit discard-and-reload is, and it reads the CURRENT authoritative record at the
 * moment they choose it.
 */
export function hydrateCateringCloseoutForm<T>(
  current: CateringCloseoutFormState<T>,
  identity: string,
  next: T,
  nextVersion: string | null,
): CateringCloseoutFormState<T> {
  if (current.identity !== identity) return { identity, value: next, baseVersion: nextVersion, dirty: false, conflicted: false };
  // Conflicted first, and untouched: hydration is not a resolution, however many times it runs.
  if (current.conflicted) return current;
  if (current.dirty) return current;
  return { ...current, value: next, baseVersion: nextVersion };
}

/** An edit marks the form dirty and clears any conflict flag: the participant is composing a fresh attempt. */
export function editCateringCloseoutForm<T>(current: CateringCloseoutFormState<T>, value: T): CateringCloseoutFormState<T> {
  return { ...current, value, dirty: true, conflicted: false };
}
/** A refused save keeps the text AND the version it was based on, and only records that saving is blocked. */
export function markCateringCloseoutFormConflict<T>(current: CateringCloseoutFormState<T>): CateringCloseoutFormState<T> {
  return { ...current, dirty: true, conflicted: true };
}
/**
 * The explicit escape from a conflict: take the authoritative record, discarding this draft.
 *
 * Deliberately a separate, user-invoked function rather than something a hydration does on its own. A conflict
 * means two people wrote the same record, and which text survives is the provider's decision, not a poll's.
 */
export function discardCateringCloseoutForm<T>(identity: string, authoritative: T, authoritativeVersion: string | null): CateringCloseoutFormState<T> {
  return { identity, value: authoritative, baseVersion: authoritativeVersion, dirty: false, conflicted: false };
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
  savedVersion: string | null,
): CateringCloseoutFormState<T> {
  if (current.identity !== identity) return current;
  // Newer words typed while the request was in flight are kept -- but the version DOES advance, because this
  // form's own save was accepted and produced it. That is the one thing allowed to move a dirty form's version,
  // and it is what lets the very next save of those newer words succeed instead of conflicting with itself.
  if (current.value !== submitted) return { ...current, baseVersion: savedVersion };
  return { identity, value: authoritative, baseVersion: savedVersion, dirty: false, conflicted: false };
}

/**
 * Advance a form's base version after THIS TAB's own accepted mutation on the same parent record, without touching
 * its text.
 *
 * The third case the notes model needed. A dirty draft must ignore a version another writer produced -- that is
 * what stops a silent overwrite -- but the provider's OWN complete or reopen also advances
 * `catering_booking_closeout.updatedAt`, and neither of them modifies `providerNotes`. Treating that like a
 * stranger's write made the provider conflict with themselves: type a note, close out, save the note, refused.
 *
 * So the text stays exactly as it is, `dirty` stays true, and only the version moves -- to one this tab watched
 * the server mint, for a write that provably left this field alone.
 *
 * A CONFLICTED form is returned untouched. Completing or reopening is not a resolution of a notes conflict, and
 * curing one here would hand back a savable form whose text was still written against a record somebody else has
 * since changed -- precisely the overwrite the conflict exists to prevent. The explicit reload remains the only
 * way out.
 */
export function rebaseCateringCloseoutFormVersion<T>(
  current: CateringCloseoutFormState<T>,
  identity: string,
  version: string | null,
): CateringCloseoutFormState<T> {
  if (current.identity !== identity) return current;
  if (current.conflicted) return current;
  if (version === null || current.baseVersion === version) return current;
  return { ...current, baseVersion: version };
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
  /** The booking this version describes. A ledger from another booking is never read. */
  identity: string;
  /** The closeout record version the newest accepted record mutation returned, or null. */
  record: string | null;
};

export const EMPTY_CATERING_CLOSEOUT_VERSIONS: CateringCloseoutVersions = { identity: "", record: null };

/**
 * WHY THE CHECKLIST IS NOT IN HERE.
 *
 * A concurrency version and the value it describes are one atomic pair. Carrying checklist versions in a ledger
 * separate from the rendered rows let them come apart: a save of item A returns the whole authoritative checklist,
 * so the ledger adopted item B's NEWER version while the rendered B kept its OLDER value. If the reconciliation
 * refetch then failed, the client sat holding B1 paired with BV2 -- and the next save of B would state BV2, which
 * the server accepts, silently overwriting the B2 another tab had written. Optimistic concurrency defeated by its
 * own bookkeeping.
 *
 * So the checklist response is INSTALLED into the query cache instead, values and versions together, and the rows
 * are read straight from it. There is no longer any mechanism by which a checklist version can arrive without the
 * value it belongs to.
 *
 * The record version legitimately stays here because it has no such pair to break. The two fields it protects are
 * read raw from the query (`closedOut`, `reopenCount`) or owned by a form that deliberately keeps its own text
 * (`providerNotes`), and the only writes that state it -- complete and reopen -- are idempotent state assertions
 * carrying no client value that could clobber anything.
 */

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
export function cateringCloseoutVersionsFromResponse(value: Record<string, unknown> | null | undefined): { record?: string | null } {
  const result: { record?: string | null } = {};
  const record = (value?.closeout as { updatedAt?: string | null } | undefined)?.updatedAt;
  if (typeof record === "string") result.record = record;
  return result;
}

/**
 * The authoritative checklist a response carries, or null.
 *
 * Returned by the item save, captured inside its transaction while the closeout advisory lock was still held, and
 * complete for every key -- state, note, resolution instant and version. It is installed WHOLE, so every row's
 * value and version move together and neither can be adopted without the other.
 */
export function cateringCloseoutChecklistFromResponse(value: Record<string, unknown> | null | undefined): CateringCloseoutItemView[] | null {
  const checklist = value?.checklist;
  if (!Array.isArray(checklist)) return null;
  return checklist.every((item) => item && typeof item.key === "string") ? checklist as CateringCloseoutItemView[] : null;
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
  returned: { record?: string | null },
): CateringCloseoutVersions {
  const base = current.identity === identity ? current : { identity, record: null };
  const record = returned.record === undefined ? base.record : laterCateringVersion(base.record, returned.record);
  return { identity, record };
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

/* ------------------------------------------------------------------------------------------------------------- *
 * Externally-caused closeout transitions
 * ------------------------------------------------------------------------------------------------------------- */

/**
 * The last closeout state this client observed for one booking.
 *
 * It exists because two queries describe the same event and only one of them polls. When a PROVIDER closes out,
 * the server writes the closed state and the `booking_closed_out` shared activity row in one transaction -- but a
 * CUSTOMER sitting in their workspace has two separate caches, and the provider's invalidation cannot reach
 * another person's browser. Their closeout card learns of it on the next poll; their Activity panel, which does
 * not poll, would keep omitting the event indefinitely. Reopening has exactly the same shape.
 *
 * So the closeout poll -- the only thing here that does learn of external change -- reports the transition, and
 * the workspace query is refreshed once for it. Nothing new is written, no event is fabricated, no second activity
 * system exists, and no transport is added: the server already recorded the truth, this only re-reads it.
 */
export type CateringCloseoutTransitionRecord = { identity: string; closedOut: boolean } | null;

/**
 * Whether an observation is a genuine transition, and what to remember.
 *
 * Deliberately conservative in three directions, because the cost of a false positive is a refetch loop:
 *
 *  - a FIRST observation of a booking is never a transition, so an initial load that already reads `closedOut:
 *    true` triggers nothing -- the workspace query is loading alongside it and needs no nudge;
 *  - a different booking is never a transition either, so navigating A -> B records B and refreshes nothing, and
 *    the record from A cannot make B look like it moved;
 *  - an unchanged observation returns the PREVIOUS record by reference, so repeated polls reporting the same state
 *    are inert however many of them arrive.
 *
 * Only an actual change of `closedOut`, on the same booking, after a previous observation, reports `true` -- and
 * the new state is recorded at the same time, so the very next poll is inert again.
 */
export function observeCateringCloseoutTransition(
  previous: CateringCloseoutTransitionRecord,
  identity: string,
  closedOut: boolean,
): { record: CateringCloseoutTransitionRecord; transitioned: boolean } {
  if (!previous || previous.identity !== identity) return { record: { identity, closedOut }, transitioned: false };
  if (previous.closedOut === closedOut) return { record: previous, transitioned: false };
  return { record: { identity, closedOut }, transitioned: true };
}

/* ------------------------------------------------------------------------------------------------------------- *
 * Transient notices
 * ------------------------------------------------------------------------------------------------------------- */

/**
 * One transient message, tagged with the booking that produced it.
 *
 * Every other piece of booking-local state here carries its identity; the notice did not, and it is the one
 * rendered inside `role="alert"`. So on a navigation to an already-cached booking B -- where B renders immediately
 * and the passive reset effect has not flushed -- booking A's refusal was not merely displayed under B, it was
 * ANNOUNCED to assistive technology as if it belonged to the booking the participant is now looking at.
 */
export type CateringCloseoutNotice = { identity: string; message: string; retryable: boolean };

/**
 * The notice that may be rendered right now, or null.
 *
 * Read on the RENDER path, exactly like `activeCateringCloseoutEditor`, so the first committed render of another
 * booking already suppresses it rather than waiting for an effect to clear it a tick later.
 */
export function activeCateringCloseoutNotice(notice: CateringCloseoutNotice | null, identity: string): CateringCloseoutNotice | null {
  return notice && notice.identity === identity ? notice : null;
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
/**
 * An ordinary local edit to an open editor.
 *
 * It does NOT clear a conflict. Typing is not a resolution: `expectedUpdatedAt` is untouched by an edit, so
 * clearing the flag re-enabled Save against the very version that had just been refused and hid the Reload control
 * that was the way out -- the provider could then loop on 409 indefinitely by doing nothing but editing.
 *
 * Editing while conflicted is still allowed, deliberately: the provider may want to adjust their words before
 * deciding. It simply stays unsavable until they explicitly reload onto the authoritative row.
 */
export function editCateringCloseoutEditor(
  editor: CateringCloseoutItemEditorState,
  identity: string,
  key: CateringCloseoutItemKey,
  patch: Partial<Pick<OpenCateringCloseoutItemEditor, "state" | "note">>,
): CateringCloseoutItemEditorState {
  if (!editor || editor.identity !== identity || editor.key !== key) return editor;
  return { ...editor, ...patch };
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
  return actionable && !pending && !form.conflicted && cateringCloseoutFormIsCurrent(form, identity) && form.value.length <= CATERING_CLOSEOUT_NOTES_MAXIMUM;
}
/**
 * Whether the explicit discard-and-reload escape should be offered: only for a form this booking owns whose save
 * was actually refused as stale.
 */
export function mayDiscardCateringCloseoutNotes(form: CateringCloseoutFormState<string>, identity: string): boolean {
  return form.conflicted && cateringCloseoutFormIsCurrent(form, identity);
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
