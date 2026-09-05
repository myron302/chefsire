import { cateringBookingMessagesKey } from "@shared/catering-booking-communication";
import { cateringBookingFilesKey } from "@shared/catering-booking-files";
import { cateringBookingWorkspaceKey } from "@shared/catering-booking-operations";

/**
 * Cross-booking identity for asynchronous booking mutations.
 *
 * The workspace sections stay MOUNTED while the route's booking changes -- only their props do -- so a mutation
 * started on booking A can resolve after the component has re-rendered for booking B. React Query invokes
 * `onSuccess`/`onError`/`onSettled` with the callback closure from the LATEST render, so anything those callbacks
 * read from render scope (`bookingId`, a cache key built from it, an `invalidate()` helper, a ref) describes B while
 * the result in hand describes A. The consequences are all real: A's caches are never refreshed and stay stale, B's
 * are invalidated for a change that did not touch it, B's own-mutation suppression is armed by A's upload and
 * silently swallows the counterpart change B was supposed to announce, and A's success or error text is painted
 * onto B.
 *
 * Every asynchronous completion therefore has TWO identities, and they are not interchangeable:
 *
 *  1. the ORIGINATING booking, carried immutably in the mutation's own variables. It is the authoritative target
 *     for cache invalidation, own-mutation suppression, and the attempt's own result, whether or not it is still on
 *     screen;
 *  2. the CURRENTLY RENDERED booking, which may only receive VISIBLE local UI state, and only when the two match.
 *
 * Nothing here reaches for the current render. Every function takes the identity it is answering about, so a
 * callback physically cannot substitute one booking for the other.
 */
export type CateringMutationOrigin = { userId: string; bookingId: string; identity: string };

/** The identity string both sections already key their local state by: this actor, on this booking. */
export function cateringMutationIdentity(userId: string, bookingId: string): string {
  return `${userId}:${bookingId}`;
}
export function cateringMutationOrigin(userId: string, bookingId: string): CateringMutationOrigin {
  return { userId, bookingId, identity: cateringMutationIdentity(userId, bookingId) };
}
/** Whether the booking a completion belongs to is still the booking on screen. Visible UI state turns on this. */
export function cateringOriginIsCurrent(origin: CateringMutationOrigin, identity: string): boolean {
  return origin.identity === identity;
}

/**
 * The caches one completion must refresh, derived from the ORIGIN rather than from whatever is rendered now.
 *
 * Only this actor's own booking-scoped keys appear, exactly as before: the counterpart's actor-scoped keys are
 * deliberately untouched, because this client has no legitimate way to refresh them.
 */
export function cateringOriginWorkspaceInvalidations(origin: CateringMutationOrigin): readonly (readonly unknown[])[] {
  return [cateringBookingWorkspaceKey(origin.userId, origin.bookingId)];
}
export function cateringOriginMessageInvalidations(origin: CateringMutationOrigin): readonly (readonly unknown[])[] {
  return [cateringBookingMessagesKey(origin.userId, origin.bookingId), ...cateringOriginWorkspaceInvalidations(origin)];
}
export function cateringOriginFileInvalidations(origin: CateringMutationOrigin): readonly (readonly unknown[])[] {
  return [cateringBookingFilesKey(origin.userId, origin.bookingId), ...cateringOriginWorkspaceInvalidations(origin)];
}

/**
 * Applies a state transition only when the state belongs to the origin the completion came from.
 *
 * Both sections keep their local state stamped with the identity it was built for, so this is a second, independent
 * guard on top of the identity-change reset: a completion for A can never rewrite the state B is currently showing,
 * even in the render before that reset commits.
 */
export function applyForCateringOrigin<S extends { identity: string }>(state: S, origin: CateringMutationOrigin, apply: (state: S) => S): S {
  return cateringOriginIsCurrent(origin, state.identity) ? apply(state) : state;
}

/**
 * One completed attempt's visible outcome, stamped with the booking it belongs to.
 *
 * `useMutation`'s own `isSuccess`/`isError`/`error` are properties of the HOOK, not of a booking: they survive a
 * prop change, so "Message sent." or an upload error from A renders on B. Recording the outcome with its origin and
 * reading it back through `visibleCateringMutationOutcome` makes that impossible -- and it still shows correctly if
 * the participant navigates back.
 */
export type CateringMutationOutcome = { identity: string; status: "succeeded" | "failed"; message: string | null };
export function cateringMutationOutcome(origin: CateringMutationOrigin, status: "succeeded" | "failed", message: string | null = null): CateringMutationOutcome {
  return { identity: origin.identity, status, message };
}
export function visibleCateringMutationOutcome(outcome: CateringMutationOutcome | null, identity: string): CateringMutationOutcome | null {
  return outcome !== null && outcome.identity === identity ? outcome : null;
}

/**
 * Which bookings currently have a request of this kind in flight.
 *
 * `useMutation().isPending` is a hook-level boolean for the same reason, so an upload started on A disables the
 * upload control -- and paints "Uploading your file…" -- on B. Counting per identity keeps "busy" a statement about
 * one booking, and tolerates two bookings being busy at once.
 */
export type CateringInFlight = ReadonlyMap<string, number>;
export const EMPTY_CATERING_IN_FLIGHT: CateringInFlight = new Map();
export function enterCateringMutation(inFlight: CateringInFlight, origin: CateringMutationOrigin): CateringInFlight {
  const next = new Map(inFlight);
  next.set(origin.identity, (next.get(origin.identity) ?? 0) + 1);
  return next;
}
export function exitCateringMutation(inFlight: CateringInFlight, origin: CateringMutationOrigin): CateringInFlight {
  const held = inFlight.get(origin.identity);
  if (held === undefined) return inFlight;
  const next = new Map(inFlight);
  if (held <= 1) next.delete(origin.identity); else next.set(origin.identity, held - 1);
  return next;
}
export function cateringMutationIsPending(inFlight: CateringInFlight, identity: string): boolean {
  return (inFlight.get(identity) ?? 0) > 0;
}

/**
 * Unsent message text preserved after a failed send, kept per booking.
 *
 * This is local recovery state and nothing more -- nothing is persisted and nothing is retried from it. It exists
 * because a send can lose a race with the counterpart cancelling or completing the booking: the server is right to
 * refuse it, but the composer that held the text is then replaced by the read-only banner, and the participant's
 * words vanish with no way to copy them. Keying by booking is what stops A's unsent text from surfacing on B, and
 * what lets it still be there if the participant navigates back to A within this mount.
 */
export type CateringUnsentMessages = ReadonlyMap<string, string>;
export const EMPTY_CATERING_UNSENT_MESSAGES: CateringUnsentMessages = new Map();
export function recordCateringUnsentMessage(unsent: CateringUnsentMessages, origin: CateringMutationOrigin, text: string): CateringUnsentMessages {
  if (text.trim() === "") return clearCateringUnsentMessage(unsent, origin);
  const next = new Map(unsent);
  next.set(origin.identity, text);
  return next;
}
export function clearCateringUnsentMessage(unsent: CateringUnsentMessages, origin: CateringMutationOrigin): CateringUnsentMessages {
  if (!unsent.has(origin.identity)) return unsent;
  const next = new Map(unsent);
  next.delete(origin.identity);
  return next;
}
export function cateringUnsentMessage(unsent: CateringUnsentMessages, identity: string): string | null {
  return unsent.get(identity) ?? null;
}

/**
 * Per-booking file boundary baselines and own-mutation suppression, in one immutable ledger.
 *
 * A single `ownMutationRef` boolean is booking-ambiguous once the component can change bookings while mounted: an
 * upload that succeeds on A arms it, and the next boundary change observed on B -- a counterpart's shared upload --
 * is absorbed as "mine", so B's Activity panel is never refreshed and the two halves of B's workspace disagree.
 *
 * Both halves are therefore keyed by identity. A baseline is per booking too, so returning to a booking does not
 * re-announce its whole list as a change, and an arming survives navigation away and back exactly as the booking's
 * own state does.
 */
export type CateringFileLedger = { boundaries: ReadonlyMap<string, string>; armed: ReadonlySet<string> };
export const EMPTY_CATERING_FILE_LEDGER: CateringFileLedger = { boundaries: new Map(), armed: new Set() };

/** Arms suppression for ONE booking. Only a mutation that actually changed that booking's list may call this. */
export function armCateringOwnFileMutation(ledger: CateringFileLedger, origin: CateringMutationOrigin): CateringFileLedger {
  if (ledger.armed.has(origin.identity)) return ledger;
  const armed = new Set(ledger.armed);
  armed.add(origin.identity);
  return { boundaries: ledger.boundaries, armed };
}

/**
 * Records the newest-page fingerprint observed for one booking and answers whether that change was a counterpart's.
 *
 * A first observation is a baseline and announces nothing; an unchanged fingerprint does nothing at all; a change
 * this actor caused consumes that booking's arming exactly once. Only a change that is neither is a counterpart's
 * shared upload or removal, which is what the parent workspace's Activity panel has to be refreshed for.
 */
export function observeCateringFileBoundary(ledger: CateringFileLedger, identity: string, boundary: string | null): { next: CateringFileLedger; refreshActivity: boolean } {
  if (boundary === null || ledger.boundaries.get(identity) === boundary) return { next: ledger, refreshActivity: false };
  const baseline = !ledger.boundaries.has(identity);
  const own = ledger.armed.has(identity);
  const boundaries = new Map(ledger.boundaries);
  boundaries.set(identity, boundary);
  let armed = ledger.armed;
  if (own) {
    const remaining = new Set(ledger.armed);
    remaining.delete(identity);
    armed = remaining;
  }
  return { next: { boundaries, armed }, refreshActivity: !baseline && !own };
}
