import type { CateringBookingStatus } from "@shared/catering-bookings";
import {
  CATERING_CLOSEOUT_BLOCKED_CODE,
  CATERING_CLOSEOUT_BLOCKED_MESSAGE,
  CATERING_CLOSEOUT_CLOSED_CODE,
  CATERING_CLOSEOUT_CLOSED_MESSAGE,
  CATERING_CLOSEOUT_ITEM_KEYS,
  CATERING_CLOSEOUT_NOT_AVAILABLE_CODE,
  CATERING_CLOSEOUT_NOT_AVAILABLE_MESSAGE,
  CATERING_CLOSEOUT_NOT_FOUND_CODE,
  CATERING_CLOSEOUT_NOT_FOUND_MESSAGE,
  CATERING_CLOSEOUT_REQUIRED_ITEM_KEYS,
  CATERING_CLOSEOUT_VERSION_CONFLICT_CODE,
  CATERING_CLOSEOUT_VERSION_CONFLICT_MESSAGE,
  cateringCloseoutItemIsResolved,
  cateringCloseoutMayComplete,
  cateringEquipmentIsOutstandingAfterService,
  cateringCloseoutEquipmentVisibleTo,
  cateringEventServiceOccurred,
  deriveCateringCloseout,
  mayMutateCateringCloseout,
  type CateringCloseoutFacts,
  type CateringCloseoutItemKey,
  type CateringCloseoutItemState,
} from "@shared/catering-booking-closeout";
import type { CateringEquipmentStatus, CateringExecutionVisibility } from "@shared/catering-booking-execution";

export { cateringEventServiceOccurred, deriveCateringCloseout, mayMutateCateringCloseout, cateringCloseoutMayComplete };

/**
 * Why a closeout mutation was refused before any transaction is opened.
 *
 * The same two-outcome shape Phase 2H and Phase 2J use, and for the same reason: "you may not write here" answers
 * one boolean for two unrelated situations the client must tell apart. A booking whose lifecycle does not permit
 * closeout means the workspace on screen is stale and needs an authoritative refresh; a customer attempting a
 * provider mutation means the opposite -- the workspace is fine and refetching it would change nothing.
 *
 * LIFECYCLE IS DECIDED FIRST, so a booking that is still pending, still merely confirmed, or cancelled answers
 * `not_available` whoever asked, and only a booking whose event was actually served can refuse an actor. That
 * ordering also means a customer probing a cancelled booking learns nothing about it that the booking record did
 * not already tell them.
 */
export function cateringCloseoutGuard(
  booking: { status: CateringBookingStatus; completedAt: unknown },
  role: "provider" | "customer",
): "allowed" | "not_available" | "forbidden" {
  if (!cateringEventServiceOccurred(booking)) return "not_available";
  return mayMutateCateringCloseout(booking, role) ? "allowed" : "forbidden";
}

/** How a refused closeout write answers: the truthful message, plus the code the client classifies it by. */
export const CATERING_CLOSEOUT_NOT_AVAILABLE_REFUSAL = { status: 409, message: CATERING_CLOSEOUT_NOT_AVAILABLE_MESSAGE, code: CATERING_CLOSEOUT_NOT_AVAILABLE_CODE } as const;
export const CATERING_CLOSEOUT_CONFLICT_REFUSAL = { status: 409, message: CATERING_CLOSEOUT_VERSION_CONFLICT_MESSAGE, code: CATERING_CLOSEOUT_VERSION_CONFLICT_CODE } as const;
export const CATERING_CLOSEOUT_BLOCKED_REFUSAL = { status: 409, message: CATERING_CLOSEOUT_BLOCKED_MESSAGE, code: CATERING_CLOSEOUT_BLOCKED_CODE } as const;
export const CATERING_CLOSEOUT_NOT_FOUND_REFUSAL = { status: 404, message: CATERING_CLOSEOUT_NOT_FOUND_MESSAGE, code: CATERING_CLOSEOUT_NOT_FOUND_CODE } as const;
/**
 * The closed-out mutation boundary.
 *
 * Once operational closeout is recorded closed, the checklist that decided it may not move until the provider
 * explicitly reopens. Read from the authoritative record under the closeout advisory lock, never from a request
 * and never from anything fetched before the transaction, so a completion that landed between a client's read and
 * its write is seen.
 *
 * PROVIDER-PRIVATE NOTES ARE DELIBERATELY NOT BEHIND THIS BOUNDARY, and that is a product decision backed by the
 * derivation rather than a convenience. `providerNotes` reaches exactly one fact, `hasProviderNotes`, which
 * `deriveCateringCloseoutState` reads only on a branch it can never reach while `closedOut` is true -- the closed
 * check returns first. It feeds no signal, it is absent from `cateringCloseoutMayComplete`, and a customer
 * receives neither the text nor this record's version. So a provider writing down what they remember about a
 * finished event cannot move the derived state, a blocker, `mayCloseOut`, or one value any customer can observe.
 * Blocking it would restrict a harmless private record with no integrity benefit at all.
 */
export function cateringCloseoutIsClosed(record: { closedOutAt: Date | null } | undefined): boolean {
  return Boolean(record?.closedOutAt);
}
export const CATERING_CLOSEOUT_CLOSED_REFUSAL = { status: 409, message: CATERING_CLOSEOUT_CLOSED_MESSAGE, code: CATERING_CLOSEOUT_CLOSED_CODE } as const;
export const CATERING_CLOSEOUT_FORBIDDEN_MESSAGE = "Only the booking provider may change post-event closeout";

/**
 * The optimistic-concurrency comparison every closeout mutation uses, identical in behaviour to the Phase 2J one.
 *
 * It compares the INSTANT rather than its spelling, so a client that round-trips the serialized `updatedAt` through
 * any equivalent ISO form still matches, while a value from an older version does not.
 *
 * `absentIsFirstTouch` is what distinguishes a checklist item nobody has touched -- where there is no row and so no
 * version to be stale against -- from an edit that simply forgot its precondition. The CALLER decides which case
 * applies by reading the persisted row under a lock, never by trusting whether the client chose to send the field.
 */
export function cateringCloseoutVersionMatches(
  current: { updatedAt: Date } | undefined,
  expectedUpdatedAt: string | undefined,
): boolean {
  if (!current) return expectedUpdatedAt === undefined;
  if (expectedUpdatedAt === undefined) return false;
  const expected = Date.parse(expectedUpdatedAt);
  return Number.isFinite(expected) && expected === current.updatedAt.getTime();
}

/* ------------------------------------------------------------------------------------------------------------- *
 * Checklist resolution
 * ------------------------------------------------------------------------------------------------------------- */

export type CateringCloseoutPersistedItem = { state: string; providerNote: string | null; resolvedAt: Date | null; updatedAt: Date };
export type CateringCloseoutItemSaveInput = { state: CateringCloseoutItemState; providerNote?: string | null; expectedUpdatedAt?: string };

/**
 * Resolves one checklist item save against the authoritative LOCKED row, or against its absence.
 *
 * Three outcomes, and only one of them writes:
 *
 *  - `conflict`  the submitted precondition does not describe the persisted row. A first touch that carries a
 *                version, and a repeat touch that carries a stale one or none, are both this.
 *  - `unchanged` the state and the note already say exactly what was asked for. Nothing is written and no version
 *                moves, which is what makes a retried request from a phone idempotent in the strongest sense: the
 *                second attempt cannot even disturb the concurrency version the first one produced.
 *  - `save`      the merged row to persist, with the resolution audit derived rather than accepted.
 *
 * `resolvedAt` and `resolvedBy` are decided HERE, from the resulting state, so the paired database CHECK can never
 * be violated by a write path that forgot one of them: a pending item clears both, and a resolved item keeps the
 * instant it was first resolved at rather than restamping it on an unrelated note edit.
 */
export function resolveCateringCloseoutItemSave(
  current: CateringCloseoutPersistedItem | undefined,
  input: CateringCloseoutItemSaveInput,
  now: Date,
) {
  // The requested RESULTING state, derived against the authoritative row before anything is judged. An absent
  // `providerNote` means "leave it alone"; an explicit null means "clear it". Presence, not truthiness.
  const nextState = input.state;
  const nextNote = "providerNote" in input ? (input.providerNote ?? null) : current?.providerNote ?? null;
  const currentState = (current?.state ?? "pending") as CateringCloseoutItemState;
  // ALREADY SATISFIED IS DECIDED BEFORE THE PRECONDITION, and that ordering is the whole point.
  //
  // A state assertion that asks for what is already persisted changes nothing, so there is nothing for a stale
  // version to be stale ABOUT. Judging the precondition first broke the exact lost-response retry this phase claims
  // to support: the provider submits an item on version A, the server commits and advances to B, the response is
  // lost, and the retry -- carrying the same payload and the same version A it was built with -- was refused as a
  // conflict even though the server already held precisely the state being asked for. The same hole existed on a
  // FIRST touch, where the retry carries no version at all and the row it created now has one.
  //
  // This does not weaken optimistic concurrency, because it is reached only when the request would write nothing.
  // A request whose material values differ from the authoritative row falls through to the precondition below and
  // still conflicts, so a materially different stale edit is never mistaken for a retry. Nothing is written, no
  // version moves, and no activity or notification can be duplicated on this path -- the route's `unchanged`
  // branch performs no write at all.
  if (current && currentState === nextState && (current.providerNote ?? null) === nextNote) {
    return { kind: "unchanged", item: current } as const;
  }
  // Only now, with a request that would genuinely alter authoritative state, is the precondition enforced.
  if (!cateringCloseoutVersionMatches(current, input.expectedUpdatedAt)) return { kind: "conflict" } as const;
  const resolved = cateringCloseoutItemIsResolved(nextState);
  return {
    kind: "save",
    state: nextState,
    providerNote: nextNote,
    // Keep the original resolution instant when the item was already resolved and stays resolved, so editing a note
    // does not rewrite when the work was actually done.
    resolvedAt: resolved ? (cateringCloseoutItemIsResolved(currentState) && current?.resolvedAt ? current.resolvedAt : now) : null,
    resolvedIsNew: resolved && !cateringCloseoutItemIsResolved(currentState),
    clearsResolution: !resolved,
    updatedAt: now,
  } as const;
}

export type CateringCloseoutNotesSaveInput = { providerNotes: string | null; expectedUpdatedAt?: string };
/** The same three outcomes for the provider's private post-event notes, against the one closeout record. */
export function resolveCateringCloseoutNotesSave(
  current: { providerNotes: string | null; updatedAt: Date } | undefined,
  input: CateringCloseoutNotesSaveInput,
  now: Date,
) {
  // Same ordering, and for the same reason: notes are a state assertion too. A retry of a save whose response was
  // lost carries the version it was built with, which the committed first attempt has by definition already moved
  // past -- and asking for text the server already holds writes nothing, so a stale version has nothing to be
  // stale about. A request whose text genuinely differs falls through and still conflicts.
  if (current && (current.providerNotes ?? null) === input.providerNotes) return { kind: "unchanged" } as const;
  if (!cateringCloseoutVersionMatches(current, input.expectedUpdatedAt)) return { kind: "conflict" } as const;
  return { kind: "save", providerNotes: input.providerNotes, updatedAt: now } as const;
}

/* ------------------------------------------------------------------------------------------------------------- *
 * Completion and reopening
 * ------------------------------------------------------------------------------------------------------------- */

export type CateringCloseoutPersistedRecord = { closedOutAt: Date | null; reopenCount: number; updatedAt: Date };

/**
 * Resolves a closeout completion against the authoritative locked record.
 *
 * SETTLED STATE IS CHECKED BEFORE THE VERSION, and that ordering is the whole idempotency guarantee. A provider on
 * a venue car park taps "Close out", the request commits, the response is lost, and the retry arrives carrying the
 * version the first attempt has by definition already moved past. Judging the version first would answer that retry
 * with a conflict -- for a request that succeeded -- and the provider would be left unsure whether the booking is
 * closed out. Judging the settled state first answers it with the truth: it is already closed, nothing more is
 * written, and no second activity row or notification is produced.
 *
 * The blocker check reads the locked checklist, so a required item another tab resolved or reopened between the
 * early guard and this transaction is seen as it actually is.
 */
export function resolveCateringCloseoutComplete(
  current: CateringCloseoutPersistedRecord | undefined,
  facts: CateringCloseoutFacts,
  expectedUpdatedAt: string | undefined,
  now: Date,
) {
  if (current?.closedOutAt) return { kind: "already_closed", record: current } as const;
  if (!cateringCloseoutVersionMatches(current, expectedUpdatedAt)) return { kind: "conflict" } as const;
  if (!cateringCloseoutMayComplete(facts)) return { kind: "blocked" } as const;
  return { kind: "close", closedOutAt: now, updatedAt: now } as const;
}

/**
 * Resolves a reopening, with the same settled-state-first ordering and therefore the same retry safety: reopening a
 * booking that is already open writes nothing and produces no second activity row.
 *
 * Reopening is deliberate rather than an accidental toggle. It is its own route, it carries its own precondition,
 * and it increments a persisted count and stamps its own instant and actor -- so a booking that was closed out,
 * reopened and closed out again says exactly that, and the customer's activity feed says it too.
 */
export function resolveCateringCloseoutReopen(
  current: CateringCloseoutPersistedRecord | undefined,
  expectedUpdatedAt: string | undefined,
  now: Date,
) {
  if (!current) return { kind: "not_found" } as const;
  if (!current.closedOutAt) return { kind: "already_open", record: current } as const;
  if (!cateringCloseoutVersionMatches(current, expectedUpdatedAt)) return { kind: "conflict" } as const;
  return { kind: "reopen", reopenCount: current.reopenCount + 1, reopenedAt: now, updatedAt: now } as const;
}

/* ------------------------------------------------------------------------------------------------------------- *
 * Facts
 * ------------------------------------------------------------------------------------------------------------- */

export type CateringCloseoutSourceRows = {
  booking: { status: CateringBookingStatus; completedAt: unknown };
  record: { closedOutAt: Date | null; providerNotes: string | null } | undefined;
  /** Every equipment row for the booking. Filtered to the actor's visibility HERE, by the Phase 2J rule. */
  equipment: readonly { visibility: string; status: string }[];
  /** The checklist rows that exist. Always empty for a customer, whose request never queries the table at all. */
  items: readonly { itemKey: string; state: string }[];
  outstandingSharedRequirementCount: number;
  sharedDocumentCount: number;
  customerReviewExists: boolean;
};

/**
 * Reduces the actor's own authorized rows to the facts the derivation reads.
 *
 * Every provider-only number is forced to its empty value for a customer rather than merely being unused, so a
 * customer's facts cannot carry a checklist count even if a caller were to hand this function provider rows by
 * mistake. That is belt and braces on top of the route, which does not QUERY the checklist for a customer at all.
 *
 * Equipment is filtered by the Phase 2J visibility rule, so a provider-private record contributes to no count a
 * customer receives -- and therefore to no signal, no state, no blocker and no wording.
 */
export function cateringCloseoutFacts(rows: CateringCloseoutSourceRows, role: "provider" | "customer"): CateringCloseoutFacts {
  const provider = role === "provider";
  const equipment = rows.equipment.filter((item) => cateringCloseoutEquipmentVisibleTo(item.visibility as CateringExecutionVisibility, role));
  const byKey = new Map(rows.items.map((item) => [item.itemKey, item.state as CateringCloseoutItemState] as const));
  const stateOf = (key: CateringCloseoutItemKey): CateringCloseoutItemState => byKey.get(key) ?? "pending";
  const resolvedItemCount = CATERING_CLOSEOUT_ITEM_KEYS.filter((key) => cateringCloseoutItemIsResolved(stateOf(key))).length;
  const unresolvedRequiredItemCount = CATERING_CLOSEOUT_REQUIRED_ITEM_KEYS.filter((key) => !cateringCloseoutItemIsResolved(stateOf(key))).length;
  return {
    eventServiceOccurred: cateringEventServiceOccurred(rows.booking),
    closedOut: Boolean(rows.record?.closedOutAt),
    outstandingEquipmentCount: equipment.filter((item) => cateringEquipmentIsOutstandingAfterService(item.status as CateringEquipmentStatus)).length,
    outstandingSharedRequirementCount: rows.outstandingSharedRequirementCount,
    sharedDocumentCount: rows.sharedDocumentCount,
    unresolvedRequiredItemCount: provider ? unresolvedRequiredItemCount : 0,
    resolvedItemCount: provider ? resolvedItemCount : 0,
    equipmentItemResolved: provider && cateringCloseoutItemIsResolved(stateOf("equipment_return_confirmed")),
    documentsItemResolved: provider && cateringCloseoutItemIsResolved(stateOf("final_documents_delivered")),
    reviewItemResolved: provider && cateringCloseoutItemIsResolved(stateOf("review_request_handled")),
    hasProviderNotes: provider && Boolean(rows.record?.providerNotes?.trim()),
    customerReviewExists: rows.customerReviewExists,
  };
}
