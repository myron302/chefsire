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
 * Whether the end of the thread is genuinely on the participant's screen, FOR A NAMED MESSAGE BOUNDARY.
 *
 * Two things have to be true, and one alone is not evidence of the other. The message list is its own scroll
 * container, so an IntersectionObserver rooted on it answers only "is the sentinel inside the container's own
 * viewport" -- true for any thread short enough not to scroll, no matter where the container itself is. And the
 * Communication section sits below several other workspace sections, so on a phone a short thread can satisfy that
 * intra-container test while the whole card is still far below the fold. The second observation, of the container
 * against the document viewport, is what supplies the missing half.
 *
 * Both halves being true is still not enough on its own, because IntersectionObserver reports asynchronously and a
 * boolean carries no record of WHAT it saw. Message A is visible, both observers report true, a refetch appends
 * message B and pushes the sentinel below the fold -- and in the window before the observers report false, the
 * evidence collected for A reads as evidence for B. B would be recorded viewed, and the explicit read mutation
 * would mark a message nobody had seen.
 *
 * So the evidence is stamped with the boundary it was collected for. `observedId` is the `latestId` that was
 * current when the observation arrived, and an observation for a different boundary discards whatever was held and
 * starts the new boundary from nothing. Whether the end of the thread is on screen is then a question that can only
 * be asked ABOUT a boundary, never in the abstract -- which is what makes a change of `latestId` invalidate prior
 * evidence immediately and synchronously, with no dependence on a later observer callback arriving to say false.
 */
export type CateringThreadVisibility = { observedId: string | null; sentinelInThread: boolean; threadOnScreen: boolean };
export const EMPTY_CATERING_THREAD_VISIBILITY: CateringThreadVisibility = { observedId: null, sentinelInThread: false, threadOnScreen: false };

/**
 * Moves the evidence onto `latestId`, discarding anything collected for a different boundary. Evidence already
 * stamped with this boundary is returned untouched -- and as the SAME object, so a repeating observer callback
 * cannot churn React state.
 */
function rebaseCateringVisibility(state: CateringThreadVisibility, latestId: string | null): CateringThreadVisibility {
  return state.observedId === latestId ? state : { observedId: latestId, sentinelInThread: false, threadOnScreen: false };
}
export function recordCateringSentinelVisibility(state: CateringThreadVisibility, latestId: string | null, visible: boolean): CateringThreadVisibility {
  const base = rebaseCateringVisibility(state, latestId);
  return base.sentinelInThread === visible ? base : { ...base, sentinelInThread: visible };
}
export function recordCateringThreadVisibility(state: CateringThreadVisibility, latestId: string | null, visible: boolean): CateringThreadVisibility {
  const base = rebaseCateringVisibility(state, latestId);
  return base.threadOnScreen === visible ? base : { ...base, threadOnScreen: visible };
}
/**
 * The whole conjunction, and the only thing permitted to advance the viewed boundary: both observations, both
 * positive, and both collected for THIS boundary. A null `latestId` (nothing loaded) can never be viewed, so an
 * unloaded message can never be marked read.
 *
 * Defaulting every part to false or null is what makes an environment with no IntersectionObserver, a section never
 * scrolled to, or a boundary whose evidence has not yet been re-collected leave messages UNREAD rather than falsely
 * read: an unproven observation is not an observation.
 */
export function cateringThreadEndIsOnScreen(state: CateringThreadVisibility, latestId: string | null): boolean {
  if (latestId === null || state.observedId !== latestId) return false;
  return state.sentinelInThread && state.threadOnScreen;
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
