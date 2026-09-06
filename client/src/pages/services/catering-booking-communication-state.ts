import { CATERING_MESSAGE_MAX_LENGTH, type CateringBookingMessagePageView, type CateringBookingMessageView } from "@shared/catering-booking-communication";
import { CATERING_WORKSPACE_READ_ONLY_CODE } from "@shared/catering-booking-operations";

/**
 * Client state for the booking Communication section. Everything here is pure so the send lifecycle -- composing,
 * sending, retrying, failing -- can be reasoned about and tested without a network or a DOM.
 */

/**
 * One send in flight or one that failed, held beside the persisted thread rather than inside it.
 *
 * `clientRequestId` is generated once when the participant presses send and is REUSED for every retry of that same
 * text. That is what makes a retry idempotent end to end: the server scopes the token to this booking and this
 * sender, so a retry after a timeout that actually succeeded returns the original message instead of posting a
 * second one. A new composition always gets a new token, so two deliberate identical messages stay two messages.
 */
export type PendingCateringMessage = { clientRequestId: string; text: string; status: "sending" | "failed"; error: string | null };
/**
 * `text` is the live, freely editable composer draft. `pending` is a separate, immutable record of the attempt that
 * is in flight or has failed. They are deliberately not the same value: an attempt keeps the exact text it was
 * started with so a retry re-sends that and nothing else, while the participant stays free to type something new
 * without either mutating the attempt or having their new text destroyed when the attempt resolves.
 */
export type CateringComposerState = { identity: string; text: string; pending: PendingCateringMessage | null };
export const EMPTY_CATERING_COMPOSER: CateringComposerState = { identity: "", text: "", pending: null };

export function hydrateCateringComposer(state: CateringComposerState, identity: string): CateringComposerState {
  return state.identity === identity ? state : { identity, text: "", pending: null };
}
export function editCateringComposer(state: CateringComposerState, text: string): CateringComposerState {
  return { ...state, text };
}

/** A composed message must survive trimming and stay within the same bound the server enforces. */
export function cateringMessageIsSendable(text: string): boolean {
  const trimmed = text.trim();
  return trimmed.length > 0 && trimmed.length <= CATERING_MESSAGE_MAX_LENGTH;
}
/**
 * Whether the send control may be used right now. A send already in flight blocks another one, which is the
 * duplicate-send protection a double tap actually hits; a failed send is retried through its own control rather
 * than by pressing send again, so it blocks too.
 */
export function maySendCateringMessage(state: CateringComposerState, editable: boolean, offline = false): boolean {
  if (!editable || offline) return false;
  if (state.pending !== null) return false;
  return cateringMessageIsSendable(state.text);
}

/** Starts one send. The composer keeps the text until the server accepts it, so a failure never loses what was typed. */
export function startCateringMessageSend(state: CateringComposerState, clientRequestId: string): { next: CateringComposerState; payload: { text: string; clientRequestId: string } } | null {
  const text = state.text.trim();
  if (!cateringMessageIsSendable(text) || state.pending !== null) return null;
  return { next: { ...state, pending: { clientRequestId, text, status: "sending", error: null } }, payload: { text, clientRequestId } };
}
/**
 * Resolves a send that succeeded.
 *
 * The composer is cleared ONLY when it still holds exactly the draft that was submitted. The live composer and the
 * attempt in flight are two separate things: the attempt is immutable once started, while the composer stays
 * editable, so a participant may well have typed something new while the request was in flight or after it failed.
 * Clearing unconditionally would delete that newer text -- which is exactly what a successful retry used to do,
 * since a retry re-sends the ORIGINAL attempt's text while the composer has moved on. The trim comparison means a
 * draft that only differs by surrounding whitespace still counts as the submitted one.
 */
export function completeCateringMessageSend(state: CateringComposerState, clientRequestId: string): CateringComposerState {
  if (state.pending?.clientRequestId !== clientRequestId) return state;
  const submitted = state.pending.text;
  if (state.text.trim() !== submitted) return { ...state, pending: null };
  return { ...state, text: "", pending: null };
}
/** A failure keeps the attempt's own text and token, so "Try again" resends that message rather than a new one. */
export function failCateringMessageSend(state: CateringComposerState, clientRequestId: string, error: string): CateringComposerState {
  if (state.pending?.clientRequestId !== clientRequestId) return state;
  return { ...state, pending: { ...state.pending, status: "failed", error } };
}
/**
 * Retrying reuses the failed attempt's own token AND its own text, which is what makes the retry idempotent on the
 * server. Whatever the composer holds now is untouched, and stays untouched when the retry succeeds.
 */
export function retryCateringMessageSend(state: CateringComposerState): { next: CateringComposerState; payload: { text: string; clientRequestId: string } } | null {
  const pending = state.pending;
  if (!pending || pending.status !== "failed") return null;
  return { next: { ...state, pending: { ...pending, status: "sending", error: null } }, payload: { text: pending.text, clientRequestId: pending.clientRequestId } };
}
/** Abandoning a failed send returns its text to the composer so nothing the participant typed is thrown away. */
export function discardCateringMessageSend(state: CateringComposerState): CateringComposerState {
  const pending = state.pending;
  if (!pending || pending.status !== "failed") return state;
  return { ...state, text: state.text.trim() === "" ? pending.text : state.text, pending: null };
}

/**
 * Flattens the infinite query's pages into one chronological thread.
 *
 * Pages arrive newest-page-first ("load older" appends earlier pages), and each page is already oldest-first inside
 * itself, so the pages are reversed and concatenated. Messages are de-duplicated by id, which is what keeps a
 * refetch that overlaps a boundary -- or a send landing while an older page is loading -- from showing a message
 * twice.
 */
export function combineCateringMessagePages(pages: readonly CateringBookingMessagePageView[]): CateringBookingMessageView[] {
  const seen = new Set<string>();
  const combined: CateringBookingMessageView[] = [];
  for (const page of [...pages].reverse()) {
    for (const message of page.messages) {
      if (seen.has(message.id)) continue;
      seen.add(message.id);
      combined.push(message);
    }
  }
  return combined;
}
/** The boundary that loads the page before the oldest one held, or undefined once the beginning is reached. */
export function nextCateringMessageCursor(page: { nextCursor: string | null } | undefined): string | undefined {
  return page?.nextCursor ?? undefined;
}

/** The id the read marker should be moved to: the newest message the participant has actually been shown. */
export function latestCateringMessageId(messages: readonly CateringBookingMessageView[]): string | null {
  return messages.length === 0 ? null : messages[messages.length - 1].id;
}
/**
 * Whether marking the conversation read is worth a request. It is skipped when there is nothing to mark and when the
 * marker has not moved since the last successful mark, so simply looking at an open conversation does not write.
 */
export function shouldMarkCateringConversationRead(latestId: string | null, markedId: string | null, unreadCount: number): boolean {
  if (latestId === null) return false;
  if (latestId === markedId) return false;
  return unreadCount > 0;
}

/**
 * The newest message the actor has actually been shown.
 *
 * Fetching a page is not reading it. The initial page routinely exceeds the scroll viewport, and unread messages
 * can span pages that have not been requested at all, so marking `latestId` read on mount told the server a
 * participant had seen messages that were merely in memory -- and, because the server marker is monotonic, that
 * claim could not be walked back.
 *
 * The boundary therefore advances only when the newest loaded message is genuinely on screen, which the component
 * observes with a sentinel at the end of the thread. That is deliberately conservative: a participant who reads
 * halfway and leaves advances nothing, which leaves messages unread rather than falsely marking them read.
 */
export type CateringViewedState = { identity: string; viewedId: string | null };
export const EMPTY_CATERING_VIEWED: CateringViewedState = { identity: "", viewedId: null };

export function hydrateCateringViewed(state: CateringViewedState, identity: string): CateringViewedState {
  return state.identity === identity ? state : { identity, viewedId: null };
}
/**
 * Records that the end of the thread is on screen, so the newest LOADED message has been displayed. A null
 * `latestId` (nothing loaded) records nothing: an empty conversation has no viewed boundary to speak of.
 */
export function recordCateringViewedBoundary(state: CateringViewedState, latestId: string | null): CateringViewedState {
  if (latestId === null || latestId === state.viewedId) return state;
  return { ...state, viewedId: latestId };
}
/**
 * The boundary a read mark may use: the newest DISPLAYED message, never the newest fetched one. Returning null
 * while nothing has been displayed is what keeps an unread count intact for a participant who opened the
 * conversation scrolled above the unread messages.
 */
export function cateringReadableBoundary(state: CateringViewedState, identity: string): string | null {
  return state.identity === identity ? state.viewedId : null;
}

/**
 * A fingerprint of the RENDERED message set: how many pages are loaded, how many messages they hold, and whether
 * an older page can still be fetched.
 *
 * `latestId` alone does not identify what is on screen. Loading older messages prepends them without changing the
 * newest one, so evidence gathered before the prepend stayed stamped with the same boundary and remained valid for
 * a thread that now renders entirely different content -- while scroll restoration deliberately kept the reader
 * where they were, so the newly prepended messages had never been on screen at all. The bottom-of-thread
 * observations are LIVE evidence about one rendering, and a prepend makes them evidence about a rendering that no
 * longer exists.
 *
 * Including `hasOlderPages` in the key is what makes exhausting pagination a change of rendering like any other: it
 * forces the sentinel to be observed again rather than letting a stale positive carry over. Per-message coverage is
 * keyed separately, by message id, because those messages genuinely were seen.
 */
export function cateringMessagePageKey(pages: readonly { messages: readonly unknown[] }[] | undefined, hasOlderPages: boolean): string {
  const suffix = hasOlderPages ? "more" : "end";
  if (!pages || pages.length === 0) return `0:0:${suffix}`;
  const count = pages.reduce((total, page) => total + page.messages.length, 0);
  return `${pages.length}:${count}:${suffix}`;
}

/**
 * The oldest loaded message the participant must actually have seen before the newest one may be marked read.
 *
 * Seeing the bottom of the thread proves nothing about what is above it. After the final older page is prepended,
 * scroll restoration deliberately keeps the reader where they were -- near the newest messages -- so the bottom
 * sentinel is immediately visible again and the re-created observers report a perfectly fresh positive for the new
 * page set. Nothing about that sequence involves the reader looking at the backlog that was just loaded, yet the
 * read marker is chronological: advancing it to the newest message sweeps every one of those messages read.
 *
 * The boundary comes from the endpoint's own `unreadStartId`: the earliest unread incoming message for this actor,
 * derived server-side from their persisted marker and never capped. A count alone could not supply it, because the
 * count is bounded at a ceiling and reports `capped` beyond it -- a lower bound, not a total -- so a large backlog
 * could never be located and the participant stayed stuck at "99+" forever. Three answers, and the difference
 * between the last two is the point:
 *
 *  - `none`: nothing is unread, so there is no range to traverse and the bottom alone decides.
 *  - `message`: this exact message must be seen before the boundary may advance past it.
 *  - `unresolved`: the range reaches past what is loaded (or the count is capped, so its true size is unknown).
 *    An unidentifiable range can never be proved traversed, so nothing may be marked.
 *
 * `authoritative` records WHERE the answer came from, because the two sources support different conclusions. The
 * endpoint derives its answer from this actor's persisted marker, so a `message` it names really is the EARLIEST
 * unread message and every older page holds only history this actor has already read. The fallback derives its
 * answer from a bounded unread count and the loaded `mine` flags, which cannot say anything about pages nobody has
 * fetched. Only the first supports ignoring older pages; see `cateringUnreadIntervalIsLoaded`.
 */
export type CateringUnreadStart =
  | { kind: "none"; authoritative: boolean }
  | { kind: "unresolved"; authoritative: boolean }
  | { kind: "message"; id: string; authoritative: boolean };

export function cateringUnreadStart(
  messages: readonly { id: string; mine: boolean }[],
  unreadCount: number,
  capped = false,
  authoritativeStartId?: string | null,
): CateringUnreadStart {
  // The endpoint's own answer wins whenever it has given one. It is derived from the actor's persisted marker and
  // is never capped, so it resolves a backlog of any size -- which is what stops a count past the ceiling from
  // leaving the range permanently unidentifiable and the participant permanently stuck at "99+".
  if (authoritativeStartId !== undefined) {
    if (authoritativeStartId === null) return { kind: "none", authoritative: true };
    // Known, but not yet fetched: identified is not the same as loaded, and an unloaded message cannot be seen.
    return messages.some((message) => message.id === authoritativeStartId)
      ? { kind: "message", id: authoritativeStartId, authoritative: true }
      : { kind: "unresolved", authoritative: true };
  }
  // Fallback for a page cached before the field existed. It is the previous derivation exactly, including refusing
  // a capped count -- conservative, and self-healing the moment a current response arrives.
  if (!Number.isFinite(unreadCount) || unreadCount <= 0) return { kind: "none", authoritative: false };
  if (capped) return { kind: "unresolved", authoritative: false };
  const incoming = messages.filter((message) => !message.mine);
  // Fewer incoming messages loaded than are unread means the range starts in a page nobody has fetched.
  if (incoming.length < unreadCount) return { kind: "unresolved", authoritative: false };
  return { kind: "message", id: incoming[incoming.length - unreadCount].id, authoritative: false };
}
/** The stamp form, so a change of required boundary is a change of identity like any other. */
export function cateringUnreadStartKey(start: CateringUnreadStart): string {
  return start.kind === "message" ? `message:${start.id}` : start.kind;
}
/** The id to hang the traversal sentinel on, or null when there is no specific message to require. */
export function cateringUnreadStartId(start: CateringUnreadStart): string | null {
  return start.kind === "message" ? start.id : null;
}

/**
 * What a visibility observation is ABOUT: the newest message, the rendered page set, and the unread range that must
 * be traversed. Evidence is only ever evidence for one of these.
 */
export type CateringViewGeneration = { latestId: string | null; pageKey: string; unreadStartKey: string };
export function cateringViewGeneration(latestId: string | null, pageKey: string, start: CateringUnreadStart): CateringViewGeneration {
  return { latestId, pageKey, unreadStartKey: cateringUnreadStartKey(start) };
}

/**
 * Whether the participant has actually seen what they need to see, FOR ONE GENERATION.
 *
 * THE BOTTOM. One sentinel after the last message, observed against two roots. The thread's own scroll container
 * answers "is the end of the list inside the thread's viewport" -- true permanently for any thread short enough not
 * to scroll, wherever the card sits -- and the document viewport answers whether it is actually on screen. This
 * evidence is LIVE: it has to hold right now.
 *
 * THE RANGE. Seeing where the unread range begins and seeing where it ends does not mean the middle was read. A
 * reader can scroll until the first unread message appears, then drag the scrollbar thumb straight to the bottom:
 * both endpoints are genuinely observed, every message between them never entered the viewport, and marking the
 * newest one read sweeps all of them. So coverage is tracked message by message and collapsed into a CONTIGUOUS
 * FRONTIER: the run of messages, starting at the authoritative unread start, that have each actually been on
 * screen. A gap stops the frontier dead, however much lies beyond it.
 *
 * Coverage accumulates by stable message id, so it survives a poll that replaces page objects, and it survives a
 * prepend -- loading a page makes messages available, never viewed. It is discarded only when the required range
 * itself changes, which is the one event that makes what was covered no longer the question being asked.
 */
export type CateringThreadVisibility = {
  observedId: string | null; pageKey: string | null; unreadStartKey: string | null;
  sentinelInThread: boolean; sentinelInViewport: boolean;
  coveredKey: string | null; covered: ReadonlySet<string>;
};
export const EMPTY_CATERING_THREAD_VISIBILITY: CateringThreadVisibility = {
  observedId: null, pageKey: null, unreadStartKey: null,
  sentinelInThread: false, sentinelInViewport: false,
  coveredKey: null, covered: new Set<string>(),
};

function rebaseCateringVisibility(state: CateringThreadVisibility, generation: CateringViewGeneration): CateringThreadVisibility {
  // A different required range is a different question: the coverage collected for the old one says nothing about
  // this one, so it goes with everything else.
  if (state.unreadStartKey !== generation.unreadStartKey) {
    return { ...EMPTY_CATERING_THREAD_VISIBILITY, observedId: generation.latestId, pageKey: generation.pageKey, unreadStartKey: generation.unreadStartKey, coveredKey: generation.unreadStartKey };
  }
  // A new message or a new rendering: the bottom must be re-observed, but coverage is keyed by message id and those
  // messages were genuinely seen, so it stands.
  if (state.observedId !== generation.latestId || state.pageKey !== generation.pageKey) {
    return { ...state, observedId: generation.latestId, pageKey: generation.pageKey, sentinelInThread: false, sentinelInViewport: false };
  }
  return state;
}

/** The bottom sentinel inside the thread's own scroll container (`root: threadRef.current`). */
export function recordCateringSentinelVisibility(state: CateringThreadVisibility, generation: CateringViewGeneration, visible: boolean): CateringThreadVisibility {
  const base = rebaseCateringVisibility(state, generation);
  return base.sentinelInThread === visible ? base : { ...base, sentinelInThread: visible };
}
/** The SAME bottom sentinel in the browser/document viewport (`root: null`) -- never the container's. */
export function recordCateringViewportVisibility(state: CateringThreadVisibility, generation: CateringViewGeneration, visible: boolean): CateringThreadVisibility {
  const base = rebaseCateringVisibility(state, generation);
  return base.sentinelInViewport === visible ? base : { ...base, sentinelInViewport: visible };
}
/**
 * Records that these messages were on screen. Only additions matter -- a message scrolling back out was still seen
 * -- so this accumulates and never subtracts, and an observation that adds nothing returns the SAME object so a
 * repeating callback cannot churn React state.
 *
 * Order is irrelevant here on purpose. Callbacks arrive asynchronously and can arrive out of order; what makes the
 * result deterministic is that the frontier below is computed from the MESSAGE ordering, not from the order the
 * observations happened to land in.
 */
export function recordCateringMessageCoverage(state: CateringThreadVisibility, generation: CateringViewGeneration, ids: readonly string[]): CateringThreadVisibility {
  const base = rebaseCateringVisibility(state, generation);
  const added = ids.filter((id) => !base.covered.has(id));
  if (added.length === 0) return base;
  const covered = new Set(base.covered);
  for (const id of added) covered.add(id);
  return { ...base, covered, coveredKey: generation.unreadStartKey };
}

/**
 * The furthest message reachable from the unread start through an UNBROKEN run of covered messages, or null when
 * the start itself has not been seen.
 *
 * Every rendered message counts, not only incoming ones: the reader's own messages sit between them in the
 * chronology, and requiring the whole run is both simpler and impossible to skip past. Walking the loaded list in
 * order is what makes a scrollbar jump visible as what it is -- the messages in the middle are simply absent from
 * the set, so the walk stops at the first of them no matter how much beyond it was observed.
 */
export function cateringCoverageFrontier(messages: readonly { id: string }[], unreadStartId: string | null, covered: ReadonlySet<string>): string | null {
  if (unreadStartId === null) return null;
  const from = messages.findIndex((message) => message.id === unreadStartId);
  if (from === -1 || !covered.has(unreadStartId)) return null;
  let frontier = unreadStartId;
  for (let index = from + 1; index < messages.length; index += 1) {
    if (!covered.has(messages[index].id)) break;
    frontier = messages[index].id;
  }
  return frontier;
}

/** The newest message is on screen, in both coordinate systems, right now, for this generation. */
export function cateringThreadEndIsOnScreen(state: CateringThreadVisibility, generation: CateringViewGeneration): boolean {
  if (generation.latestId === null) return false;
  if (state.observedId !== generation.latestId || state.pageKey !== generation.pageKey || state.unreadStartKey !== generation.unreadStartKey) return false;
  return state.sentinelInThread && state.sentinelInViewport;
}
/**
 * The unread range was actually traversed: nothing to traverse, or an unbroken run of seen messages reaching from
 * its authoritative start all the way to the message about to be marked read.
 */
export function cateringUnreadRangeWasTraversed(
  state: CateringThreadVisibility,
  generation: CateringViewGeneration,
  start: CateringUnreadStart,
  messages: readonly { id: string }[],
): boolean {
  if (start.kind === "none") return true;
  // A range whose extent is unknown can never be shown to have been traversed.
  if (start.kind === "unresolved") return false;
  if (state.coveredKey !== generation.unreadStartKey) return false;
  if (generation.latestId === null) return false;
  // The frontier has to reach the very message the marker would advance to; one short is one unseen message.
  return cateringCoverageFrontier(messages, start.id, state.covered) === generation.latestId;
}

/**
 * Whether everything that must be traversed is actually loaded.
 *
 * This used to be `!hasOlderPages` -- ANY older page blocked the boundary -- and that is far too strong once the
 * endpoint names the unread start. Consider a five-hundred message conversation read through message 499 when
 * message 500 arrives. The server answers `unreadStartId: m500`, the first page loads m471..m500, and older pages
 * exist, so the flat gate refused: the participant had to hand-load hundreds of messages they had already read
 * before the one new message could be marked read. The messages behind that pagination are, by construction,
 * OLDER than the unread start -- which is to say already read -- so their existence proves nothing and blocks
 * nothing.
 *
 * What the gate was actually protecting against is an unread message hiding in an unfetched page, and that is
 * exactly what the three answers below already distinguish:
 *
 *  - `unresolved`: the start could not be identified, so an unread message may well be in a page nobody fetched.
 *    Blocked, and no amount of pagination state changes that -- only actually loading it can.
 *  - `message`, from the endpoint: the earliest unread message is named AND loaded. Everything older is read.
 *  - `none`, from the endpoint: nothing is unread at all, so there is nothing for a page to hide.
 *
 * The fallback derivation is the exception and keeps the old conservative gate. It reads a bounded count and the
 * loaded `mine` flags -- a page cached before the endpoint carried the field -- and a count that is stale-low
 * cannot see unread messages sitting in pages nobody has fetched. Provenance, not pagination state, is what
 * decides: `authoritative` is a fact about where the answer came from, never inferred from what is loaded.
 */
export function cateringUnreadIntervalIsLoaded(start: CateringUnreadStart, hasOlderPages: boolean): boolean {
  if (start.kind === "unresolved") return false;
  if (start.authoritative) return true;
  return !hasOlderPages;
}

/**
 * The whole rule. The newest message may be recorded as viewed only when every one of these holds:
 *
 *  - the authoritative unread interval is entirely loaded, so no unread message is hiding behind pagination;
 *  - that interval was traversed contiguously, message by message, up to the newest message;
 *  - the newest message is on screen now, in the thread viewport and the browser viewport alike;
 *  - all of that evidence belongs to one generation.
 *
 * Defaulting every part to empty is what makes an environment with no IntersectionObserver, a section never
 * scrolled to, a prepend that has not been re-observed, a scrollbar jump over the middle of the backlog, or an
 * unread range that cannot be identified leave messages UNREAD rather than falsely read.
 */
export function mayRecordCateringViewedBoundary(
  state: CateringThreadVisibility,
  generation: CateringViewGeneration,
  hasOlderPages: boolean,
  start: CateringUnreadStart,
  messages: readonly { id: string }[],
): boolean {
  if (!cateringUnreadIntervalIsLoaded(start, hasOlderPages)) return false;
  if (!cateringUnreadRangeWasTraversed(state, generation, start, messages)) return false;
  return cateringThreadEndIsOnScreen(state, generation);
}

/**
 * Automatic read-marking state, kept separate from the mutation's own pending/error flags.
 *
 * `markedId` is the last boundary the server confirmed. `attemptedId` is the last boundary an automatic attempt was
 * made for, whether it succeeded or failed. They are different things, and conflating them is what produced an
 * unbounded retry loop: a failed mark leaves `unreadCount` above zero and `markedId` unchanged, so an effect keyed
 * only on those plus the mutation's pending flag re-fires the instant the mutation returns to idle, forever.
 *
 * Recording the attempt separately bounds it to one automatic request per candidate boundary. A failure for M10
 * therefore stops, while a newer M11 is a new candidate and earns its own single attempt -- a failure never blocks
 * legitimate later progress.
 */
export type CateringReadMarkState = { identity: string; markedId: string | null; attemptedId: string | null; failed: boolean };
export const EMPTY_CATERING_READ_MARK: CateringReadMarkState = { identity: "", markedId: null, attemptedId: null, failed: false };

/** Reopening the conversation, or switching actor or booking, is a legitimate fresh start for automatic marking. */
export function hydrateCateringReadMark(state: CateringReadMarkState, identity: string): CateringReadMarkState {
  return state.identity === identity ? state : { ...EMPTY_CATERING_READ_MARK, identity };
}

/**
 * Whether an automatic mark-read request may be issued right now.
 *
 * On top of "is there anything to mark", this refuses a boundary that has already been attempted. That single
 * condition is what makes the loop impossible: after one attempt for a given `latestId`, the effect cannot fire
 * again for it however many times the component rerenders or the mutation's flags change.
 */
export function shouldAutoMarkCateringConversationRead(state: CateringReadMarkState, latestId: string | null, unreadCount: number): boolean {
  if (!shouldMarkCateringConversationRead(latestId, state.markedId, unreadCount)) return false;
  return latestId !== state.attemptedId;
}

/** Records that this boundary has been attempted, before the request goes out, so no second one can start. */
export function startCateringReadMark(state: CateringReadMarkState, latestId: string): CateringReadMarkState {
  return { ...state, attemptedId: latestId, failed: false };
}
/**
 * A confirmed mark records the marker the SERVER reports, not the one that was requested. The server's marker is
 * monotonic, so a request that lost to a newer boundary is answered with that newer one, and taking it at face
 * value here keeps the client from re-attempting something the server has already moved past.
 */
export function completeCateringReadMark(state: CateringReadMarkState, authoritativeMarkedId: string | null): CateringReadMarkState {
  return { ...state, markedId: authoritativeMarkedId, failed: false };
}
/** A failure is remembered rather than retried: the attempted boundary stays recorded, so the effect will not refire. */
export function failCateringReadMark(state: CateringReadMarkState, attemptedId: string): CateringReadMarkState {
  return state.attemptedId !== attemptedId ? state : { ...state, failed: true };
}
/**
 * An explicit retry clears the recorded attempt, which lets the effect issue exactly one more request for whatever
 * the current boundary is. It does not itself send anything, so a double click cannot produce two requests.
 */
export function retryCateringReadMark(state: CateringReadMarkState): CateringReadMarkState {
  return state.failed ? { ...state, attemptedId: null, failed: false } : state;
}
/** Whether to offer the retry affordance: only after a failure that still has something left to mark. */
export function mayRetryCateringReadMark(state: CateringReadMarkState, latestId: string | null, unreadCount: number): boolean {
  return state.failed && shouldMarkCateringConversationRead(latestId, state.markedId, unreadCount);
}

export function cateringCommunicationErrorCode(error: unknown): string | null {
  const code = typeof error === "object" && error !== null ? (error as { code?: unknown }).code : undefined;
  return typeof code === "string" ? code : null;
}
/** A booking that closed while the composer was open means the section on screen is stale and must be refetched. */
export function isCateringCommunicationReadOnly(error: unknown): boolean {
  return cateringCommunicationErrorCode(error) === CATERING_WORKSPACE_READ_ONLY_CODE;
}

/** The banner a historical conversation renders instead of a composer. */
export const CATERING_COMMUNICATION_READ_ONLY_BANNER = "This booking is closed. The conversation stays readable, but no new messages can be sent.";
export const CATERING_COMMUNICATION_EMPTY = "No messages have been sent about this booking yet.";

/** A short, accessible day-and-time label for one message, rendered in the reader's own locale. */
export function formatCateringMessageTimestamp(createdAt: string): string {
  const parsed = new Date(createdAt);
  if (Number.isNaN(parsed.getTime())) return "";
  return new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(parsed);
}
