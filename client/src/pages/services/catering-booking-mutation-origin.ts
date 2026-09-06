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
 * Per-booking file snapshots and the exact deltas this actor's own successful mutations are expected to produce.
 *
 * Activity refresh exists because a counterpart's shared upload or removal writes an activity row that the parent
 * workspace -- which does not poll -- will otherwise never see. The actor's OWN mutations already refresh that
 * workspace, so announcing them again is noise, and one boolean per booking used to be enough to absorb them.
 *
 * It is not. A boolean says only "some local mutation happened before the next changed page", so it swallows the
 * WHOLE transition. Upload f3 locally; before the refetch returns, the counterpart shares f4; the next authoritative
 * page is [f4, f3, f1, f2]. The list renders f4 correctly and the boolean is spent absorbing a change that was half
 * somebody else's -- and since no further page change is coming, Activity stays stale indefinitely. The same holds
 * for a local removal that coalesces with a counterpart's upload or removal.
 *
 * So the ledger records what each successful local mutation should DO -- add this id, remove that id -- and matches
 * it against the actual delta. Only a delta with nothing left over after that subtraction is purely local. Pending
 * expectations are consumed only when they are actually observed, so an authoritative response that carries one of
 * two pending uploads leaves the other armed for the response that does carry it.
 *
 * Everything here is keyed by booking, so a completion for one booking can neither explain nor suppress another's,
 * and everything is read from the ids the server already serialized to THIS actor -- a customer's pages carry no
 * provider-private file, so no such id, count, or timing is available to this logic at all.
 */
export type CateringFilePending = { additions: ReadonlySet<string>; removals: ReadonlySet<string> };
export type CateringFileLedger = {
  /** The newest authoritative page's ids, newest first, as last observed for each booking. */
  snapshots: ReadonlyMap<string, readonly string[]>;
  pending: ReadonlyMap<string, CateringFilePending>;
};
export const EMPTY_CATERING_FILE_LEDGER: CateringFileLedger = { snapshots: new Map(), pending: new Map() };
const NO_PENDING: CateringFilePending = { additions: new Set(), removals: new Set() };

export function cateringFilePending(ledger: CateringFileLedger, identity: string): CateringFilePending {
  return ledger.pending.get(identity) ?? NO_PENDING;
}
function withPending(ledger: CateringFileLedger, identity: string, pending: CateringFilePending): CateringFileLedger {
  const next = new Map(ledger.pending);
  if (pending.additions.size === 0 && pending.removals.size === 0) next.delete(identity); else next.set(identity, pending);
  return { snapshots: ledger.snapshots, pending: next };
}
const withId = (set: ReadonlySet<string>, id: string) => { const next = new Set(set); next.add(id); return next; };
const withoutIds = (set: ReadonlySet<string>, ids: readonly string[]) => {
  if (ids.every((id) => !set.has(id))) return set;
  const next = new Set(set);
  for (const id of ids) next.delete(id);
  return next;
};
const keepIds = (set: ReadonlySet<string>, keep: (id: string) => boolean) => {
  const next = new Set<string>();
  set.forEach((id) => { if (keep(id)) next.add(id); });
  return next.size === set.size ? set : next;
};

/**
 * Arms the addition one successful upload is expected to produce, by the AUTHORITATIVE id the server answered with.
 *
 * An id the newest page already carries is not armed: an idempotent retry answered from the upload ledger created
 * nothing, so no delta is coming, and an expectation that never matches would sit waiting to absorb a counterpart's
 * change instead. When the id is genuinely absent the expectation is real whether or not the response called it a
 * duplicate -- a first attempt that timed out after succeeding still created this actor's own file.
 */
export function expectCateringFileAddition(ledger: CateringFileLedger, origin: CateringMutationOrigin, fileId: string): CateringFileLedger {
  if (ledger.snapshots.get(origin.identity)?.includes(fileId)) return ledger;
  const pending = cateringFilePending(ledger, origin.identity);
  if (pending.additions.has(fileId)) return ledger;
  return withPending(ledger, origin.identity, { additions: withId(pending.additions, fileId), removals: pending.removals });
}
/** Arms the removal one successful delete is expected to produce, by the id the request named. */
export function expectCateringFileRemoval(ledger: CateringFileLedger, origin: CateringMutationOrigin, fileId: string): CateringFileLedger {
  const pending = cateringFilePending(ledger, origin.identity);
  if (pending.removals.has(fileId)) return ledger;
  return withPending(ledger, origin.identity, { additions: pending.additions, removals: withId(pending.removals, fileId) });
}

/**
 * What changed between two newest-page snapshots, told apart from the window that shows them.
 *
 * The page is the newest N files this actor may see, so its far edge moves on its own and a plain set difference
 * over it says things that are not true. Both directions are wrong in their own way, and fixing one by fixing the
 * other is what produced the bug this replaces:
 *
 *  - a counterpart's upload arrives at the HEAD and pushes the oldest id off the tail. That id was not deleted; it
 *    is still there, one page further down. Calling it a removal invents a deletion nobody performed.
 *  - a deletion inside the page frees a slot, and the next file down is revealed at the TAIL. That id was not
 *    uploaded; it has existed all along. Calling it an addition invents an upload nobody performed.
 *
 * Discounting BOTH edges unconditionally -- the previous attempt -- makes the two cancel: a counterpart deleting
 * the oldest file in the page produced `-f1, +f0`, both were written off as window churn, and a real shared-file
 * deletion was never announced. So each edge effect is budgeted by the thing that can actually cause it:
 *
 *  - a file can only be REVEALED into a slot something vacated, so at most as many trailing arrivals as there are
 *    ids the next page no longer carries may be discounted. With nothing missing, an arrival is an upload.
 *  - a file can only be PUSHED OFF by something arriving ahead of it, so at most as many trailing departures as
 *    there are genuine additions may be discounted. With no additions, a departure is a deletion.
 *
 * Both are contiguous runs at the end of their own list, because that is the only shape displacement can take:
 * scanning inward stops at the first id the two pages still share. Everything the budgets do not absorb is real.
 *
 * ONE CASE REMAINS UNDECIDABLE, and it is undecidable from this data rather than unhandled: an upload and the
 * deletion of the page's own oldest file in the same transition leave `[f5,f4,f3,f2,f1] -> [f6,f5,f4,f3,f2]`,
 * which is byte for byte what the upload alone produces. Page 0 holds no evidence to separate them. The budget
 * resolves it as displacement, which is what keeps a plain local upload from being reported as a counterpart's
 * deletion; the deletion is picked up by the next focus refetch. A deletion anywhere else in the page, coalesced
 * with any number of uploads, is detected normally.
 */
export function cateringFileDelta(previous: readonly string[], next: readonly string[]): { added: readonly string[]; removed: readonly string[] } {
  const previousIds = new Set(previous);
  const nextIds = new Set(next);
  // Reveals: a trailing run of arrivals, budgeted by how many ids actually left. An arrival with nothing to fill
  // for is an upload, whatever its position.
  let revealBudget = previous.reduce((total, id) => (nextIds.has(id) ? total : total + 1), 0);
  const revealed = new Set<string>();
  for (let index = next.length - 1; index >= 0; index -= 1) {
    const id = next[index];
    if (previousIds.has(id) || revealBudget === 0) break;
    revealed.add(id);
    revealBudget -= 1;
  }
  const added = next.filter((id) => !previousIds.has(id) && !revealed.has(id));
  // Displacements: a trailing run of departures, budgeted by how many files genuinely arrived ahead of them. A
  // departure with nothing pushing it is a deletion, whatever its position.
  let displaceBudget = added.length;
  const displaced = new Set<string>();
  for (let index = previous.length - 1; index >= 0; index -= 1) {
    const id = previous[index];
    if (nextIds.has(id) || displaceBudget === 0) break;
    displaced.add(id);
    displaceBudget -= 1;
  }
  const removed = previous.filter((id) => !nextIds.has(id) && !displaced.has(id));
  return { added, removed };
}

const sameIds = (left: readonly string[], right: readonly string[]) => left.length === right.length && left.every((id, index) => id === right[index]);

/**
 * Settles files an authoritative reconciliation proved removed, outside the newest page entirely.
 *
 * A file preserved below the refreshed window is invisible to the page delta above -- nothing newer will ever
 * mention it -- so its removal arrives through the presence check instead. The same attribution rule applies: a
 * removal this actor performed is already accounted for and announces nothing, and anything else is a counterpart's
 * and refreshes Activity. Expectations are consumed exactly once, so a repeat answer cannot announce it twice.
 */
export function settleCateringRemovedFiles(ledger: CateringFileLedger, identity: string, removedIds: readonly string[]): { next: CateringFileLedger; refreshActivity: boolean } {
  if (removedIds.length === 0) return { next: ledger, refreshActivity: false };
  const pending = cateringFilePending(ledger, identity);
  const unexplained = removedIds.some((id) => !pending.removals.has(id));
  const settled: CateringFilePending = { additions: pending.additions, removals: withoutIds(pending.removals, removedIds) };
  return { next: withPending(ledger, identity, settled), refreshActivity: unexplained };
}

/**
 * Records one authoritative snapshot and answers whether it contains anything this actor did not do.
 *
 * A first snapshot for a booking is a baseline: files that already existed are not activity. It still reconciles
 * pending expectations against it, because a mutation can complete while the participant is looking at another
 * booking -- an upload already visible in the baseline is explained and consumed, one still absent stays armed for
 * the response that carries it, and the mirror image holds for removals.
 *
 * Otherwise the delta is computed and the pending expectations are subtracted from it. Only expectations actually
 * observed are consumed, so a partial or out-of-order response cannot discard one that has not landed yet.
 */
export function observeCateringFileSnapshot(ledger: CateringFileLedger, identity: string, snapshot: readonly string[] | null): { next: CateringFileLedger; refreshActivity: boolean } {
  if (snapshot === null) return { next: ledger, refreshActivity: false };
  const previous = ledger.snapshots.get(identity);
  if (previous !== undefined && sameIds(previous, snapshot)) return { next: ledger, refreshActivity: false };
  const pending = cateringFilePending(ledger, identity);
  const snapshots = new Map(ledger.snapshots);
  snapshots.set(identity, snapshot);
  if (previous === undefined) {
    const present = new Set(snapshot);
    const settled: CateringFilePending = {
      additions: keepIds(pending.additions, (id) => !present.has(id)),
      removals: keepIds(pending.removals, (id) => present.has(id)),
    };
    return { next: withPending({ snapshots, pending: ledger.pending }, identity, settled), refreshActivity: false };
  }
  const delta = cateringFileDelta(previous, snapshot);
  const unexplained = delta.added.some((id) => !pending.additions.has(id)) || delta.removed.some((id) => !pending.removals.has(id));
  const settled: CateringFilePending = {
    additions: withoutIds(pending.additions, delta.added),
    removals: withoutIds(pending.removals, delta.removed),
  };
  return { next: withPending({ snapshots, pending: ledger.pending }, identity, settled), refreshActivity: unexplained };
}
