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
/** Only the send that is actually in flight may clear the composer, so a stale response never wipes a new draft. */
export function completeCateringMessageSend(state: CateringComposerState, clientRequestId: string): CateringComposerState {
  if (state.pending?.clientRequestId !== clientRequestId) return state;
  return { ...state, text: "", pending: null };
}
/** A failure keeps the text and the token, so "Try again" resends the same message rather than a new one. */
export function failCateringMessageSend(state: CateringComposerState, clientRequestId: string, error: string): CateringComposerState {
  if (state.pending?.clientRequestId !== clientRequestId) return state;
  return { ...state, pending: { ...state.pending, status: "failed", error } };
}
/** Retrying reuses the failed send's own token, which is what makes the retry idempotent on the server. */
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
