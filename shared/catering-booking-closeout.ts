import { z } from "zod";
import type { CateringBookingStatus } from "./catering-bookings";
import { qualifiesAsVerifiedCateringEvent } from "./catering-reviews";
import { cateringBookingWorkspacePath } from "./catering-booking-operations";
import {
  CATERING_EQUIPMENT_STATUSES,
  type CateringEquipmentStatus,
  type CateringExecutionVisibility,
} from "./catering-booking-execution";

/**
 * Phase 2K: post-event CLOSEOUT, layered beneath an existing catering booking.
 *
 * Nothing in this module is a booking status, and nothing in it can move one. The authoritative lifecycle stays
 * exactly the four Phase 2G values, and the provider's Phase 2G completion action remains the only mechanism that
 * makes a booking `completed`. Closeout is the operational work that happens AFTER that: equipment coming back,
 * final documents having been shared, the customer being followed up with, internal notes being written, an
 * incident being resolved. A booking can be `completed` for a fortnight while closeout work is still outstanding,
 * and that distinction is the whole point of this phase.
 *
 * "ARCHIVE" IS DELIBERATELY NOT THE WORD. The term already means something else in this codebase -- a drinks drop
 * or a competition entry that has aged out of its live window -- and it reads, in a booking context, like the
 * booking itself has moved somewhere. `closed_out` says what actually happened: the provider finished the
 * operational wrap-up. The booking is untouched, still `completed`, and still exactly where it was.
 *
 * Three rules shape every contract below, and they are the same three Phase 2J established.
 *
 * The server is the only authority on identity. No schema here accepts a providerId, customerId, closedOutBy,
 * completedBy, actor, role or eligibility field, and every one of them is `.strict()`, so such a field is REFUSED
 * rather than quietly dropped. Participants come from the persisted booking and the acting user from the session.
 *
 * The closeout CHECKLIST is provider-private in its entirety. Not filtered per item -- there is no customer
 * representation of it at all: no array, no count, no state, no key on the payload. A customer therefore cannot
 * learn that an incident was recorded, that a note exists, or that any internal item is outstanding, through a
 * field, an object's presence, a count, a timestamp, a version, an ordering, a readiness value, an activity row, a
 * notification or the wording of a refusal.
 *
 * And nothing financial is invented. ChefSire has no catering invoice, deposit, final-payment or refund system --
 * the audit for this phase found none, and the booking's `agreedPrice`/`currency` are the only money facts that
 * exist. So closeout reports no balance, issues no receipt, and computes no amount. A "final invoice" here is
 * nothing more than a real Phase 2I file a participant actually uploaded, described by its real filename.
 */

/* ------------------------------------------------------------------------------------------------------------- *
 * The checklist
 * ------------------------------------------------------------------------------------------------------------- */

/**
 * The closeout checklist allowlist.
 *
 * A NARROW PHASE 2K MODEL RATHER THAN PHASE 2H TASKS, and the audit decided that rather than preference. Phase 2H
 * tasks close exactly when the workspace closes -- `mayEditCateringWorkspace` is `pending_confirmation` or
 * `confirmed` -- so every task mutation on a completed booking is refused. Closeout work happens only AFTER
 * completion, so representing it as Phase 2H tasks would mean either widening that contract (changing what a task
 * is, for every existing booking) or shipping a checklist nobody could ever tick. Neither is acceptable, so this is
 * its own bounded, keyed model that leaves Phase 2H exactly as it was.
 *
 * The keys are fixed and few. This is not a freeform to-do list: a provider cannot invent a key, the enum, the
 * database CHECK and this array cannot drift, and a customer-visible surface has nothing to render from because it
 * never receives any of it.
 */
export const CATERING_CLOSEOUT_ITEM_KEYS = [
  "equipment_return_confirmed",
  "final_documents_delivered",
  "customer_follow_up_completed",
  "internal_event_notes_completed",
  "review_request_handled",
  "incident_follow_up_resolved",
  "final_admin_review_completed",
] as const;
export type CateringCloseoutItemKey = typeof CATERING_CLOSEOUT_ITEM_KEYS[number];

/**
 * The state of one checklist item.
 *
 * `not_applicable` is a first-class answer, not an absence. Not every booking has a rental to return, a document to
 * deliver or an incident to resolve, and forcing a provider to tick "done" on work that never existed would make
 * the record a lie. Marking an item not applicable is a deliberate, attributed, timestamped assertion exactly like
 * completing it, and it satisfies the same blocker.
 *
 * `pending` is the state every key starts in -- including keys that have no row yet, which is what
 * `serializeCloseoutChecklist` reports for them.
 *
 * INCIDENT AND DAMAGE FOLLOW-UP (the `incident_follow_up_resolved` key) uses exactly these three values and needs
 * no model of its own: `not_applicable` means nothing happened, `pending` means something did and is unresolved,
 * `completed` means it has been dealt with. It is operational tracking and nothing more. There is no liability
 * determination here, no insurance claim, no customer debt, no damage charge, no automatic fee and no refund
 * decision -- ChefSire has no authoritative system for any of those, so this phase does not pretend to one.
 */
export const CATERING_CLOSEOUT_ITEM_STATES = ["pending", "completed", "not_applicable"] as const;
export type CateringCloseoutItemState = typeof CATERING_CLOSEOUT_ITEM_STATES[number];
/** An item is RESOLVED when the provider has answered it, either way. Only `pending` is an open question. */
export function cateringCloseoutItemIsResolved(state: CateringCloseoutItemState): boolean {
  return state !== "pending";
}

/**
 * The items that must be resolved before operational closeout may be completed.
 *
 * The split is about consequence, not importance. An unreturned rental, an undelivered document, an unresolved
 * incident and an unfinished administrative review all leave something in the real world hanging, so closing out
 * over them would record something untrue. Thanking a customer, writing internal notes and chasing a review are
 * relationship work that a provider may legitimately decide not to do; they are tracked, reported and never a gate.
 *
 * Every required item can always be answered, because `not_applicable` is always available -- so this can never
 * produce a booking that is impossible to close out.
 */
export const CATERING_CLOSEOUT_REQUIRED_ITEM_KEYS: readonly CateringCloseoutItemKey[] = [
  "equipment_return_confirmed",
  "final_documents_delivered",
  "incident_follow_up_resolved",
  "final_admin_review_completed",
];
export function cateringCloseoutItemIsRequired(key: CateringCloseoutItemKey): boolean {
  return CATERING_CLOSEOUT_REQUIRED_ITEM_KEYS.includes(key);
}

export const CATERING_CLOSEOUT_ITEM_LABELS: Record<CateringCloseoutItemKey, string> = {
  equipment_return_confirmed: "Equipment and rentals returned",
  final_documents_delivered: "Final documents delivered",
  customer_follow_up_completed: "Customer followed up with",
  internal_event_notes_completed: "Internal event notes written",
  review_request_handled: "Review follow-up handled",
  incident_follow_up_resolved: "Incident or damage follow-up resolved",
  final_admin_review_completed: "Final administrative review done",
};
export const CATERING_CLOSEOUT_ITEM_DESCRIPTIONS: Record<CateringCloseoutItemKey, string> = {
  equipment_return_confirmed: "Every rental, hired item and piece of your own kit is back where it belongs.",
  final_documents_delivered: "Anything the customer still needs a copy of has been shared with them.",
  customer_follow_up_completed: "You have thanked the customer or answered their post-event questions.",
  internal_event_notes_completed: "Your own record of how the event went is written down.",
  review_request_handled: "You have decided whether to ask this customer for a review, and acted on it.",
  incident_follow_up_resolved: "Anything that went wrong on the day has been followed up and settled.",
  final_admin_review_completed: "You have given this booking a last look and there is nothing outstanding.",
};
export const CATERING_CLOSEOUT_ITEM_STATE_LABELS: Record<CateringCloseoutItemState, string> = {
  pending: "Outstanding",
  completed: "Done",
  not_applicable: "Not applicable",
};

/** Bounds, enforced by Zod and by database CHECK constraints, never by a TypeScript type alone. */
export const CATERING_CLOSEOUT_ITEM_NOTE_MAXIMUM = 2000;
export const CATERING_CLOSEOUT_NOTES_MAXIMUM = 8000;
/** How many shared documents the closeout view lists. A bounded read, never an unbounded collection inlined. */
export const CATERING_CLOSEOUT_DOCUMENT_LIMIT = 20;

/* ------------------------------------------------------------------------------------------------------------- *
 * Request schemas
 * ------------------------------------------------------------------------------------------------------------- */

/**
 * The optimistic-concurrency precondition every Phase 2K write states, spelled exactly as Phase 2H and Phase 2J
 * spell theirs: the serialized `updatedAt` the submitted edit was based on. It is a precondition only -- the server
 * stays authoritative for the next `updatedAt` and never persists a client value.
 */
export const cateringCloseoutVersionSchema = z.string().datetime();

/**
 * Setting one checklist item. It is a STATE assertion, not an event, exactly like a Phase 2J milestone: asking for
 * the same state twice leaves one row in one state, which is what makes a retried request from a phone on a bad
 * connection harmless with no idempotency token at all.
 *
 * `expectedUpdatedAt` is absent the first time a key is touched -- there is no row and therefore no version to be
 * stale against -- and REQUIRED thereafter. The server decides which case applies from the persisted row under a
 * lock, never from whether the client chose to send the field.
 */
export const cateringCloseoutItemSaveSchema = z.object({
  state: z.enum(CATERING_CLOSEOUT_ITEM_STATES),
  /** Provider-private in every channel. Never serialized to a customer, never used in activity or notifications. */
  providerNote: z.string().trim().max(CATERING_CLOSEOUT_ITEM_NOTE_MAXIMUM).nullable().optional(),
  expectedUpdatedAt: cateringCloseoutVersionSchema.optional(),
}).strict();

/**
 * The provider's private post-event notes for the booking as a whole.
 *
 * A SEPARATE CONCERN from the Phase 2J access record's `providerPrivateNotes`, and deliberately not an overload of
 * it. That field is about getting into and working in a venue before an event; this one is about what happened at
 * an event that is over. Overloading one column with both would mean a post-event note edit moved the version of a
 * record whose venue instructions had not changed, and would make two unrelated pieces of writing share one
 * concurrency version and one audit trail.
 */
export const cateringCloseoutNotesSaveSchema = z.object({
  providerNotes: z.string().trim().max(CATERING_CLOSEOUT_NOTES_MAXIMUM).nullable(),
  expectedUpdatedAt: cateringCloseoutVersionSchema.optional(),
}).strict();

/**
 * Completing operational closeout, and reopening it.
 *
 * Both carry a version precondition, and both are IDEMPOTENT: the server answers an already-closed booking with
 * the record it already has rather than a conflict, and writes no second activity row and no second notification.
 * That ordering -- settled state first, version second -- is what makes a retry after an uncertain network response
 * safe, because a successful first attempt has by definition moved the version the retry is carrying.
 *
 * Reopening is deliberate and audited rather than an accidental toggle: it is a different route with a different
 * verb, it requires the provider to confirm, and it persists its own count, instant and actor.
 */
export const cateringCloseoutCompleteSchema = z.object({ expectedUpdatedAt: cateringCloseoutVersionSchema.optional() }).strict();
export const cateringCloseoutReopenSchema = z.object({ expectedUpdatedAt: cateringCloseoutVersionSchema.optional() }).strict();

/* ------------------------------------------------------------------------------------------------------------- *
 * Refusal codes
 * ------------------------------------------------------------------------------------------------------------- */

export const CATERING_CLOSEOUT_VERSION_CONFLICT_CODE = "catering_closeout_version_conflict";
export const CATERING_CLOSEOUT_VERSION_CONFLICT_MESSAGE = "This closeout record changed since you started editing it. Reload the latest version before saving.";
/**
 * The booking's lifecycle does not permit closeout work.
 *
 * ONE code and ONE message for every lifecycle reason -- a booking still pending confirmation, a confirmed booking
 * whose event has not happened, and a cancelled booking all answer identically. The client's response is the same
 * in every case (refetch the authoritative booking and render what it says), and a message that distinguished them
 * would be a second, weaker statement of a lifecycle the booking already reports.
 */
export const CATERING_CLOSEOUT_NOT_AVAILABLE_CODE = "catering_closeout_not_available";
export const CATERING_CLOSEOUT_NOT_AVAILABLE_MESSAGE = "Post-event closeout is available once the provider has marked the event complete";
/** Required closeout work is still outstanding, so the booking may not be recorded as operationally closed out. */
export const CATERING_CLOSEOUT_BLOCKED_CODE = "catering_closeout_blocked";
export const CATERING_CLOSEOUT_BLOCKED_MESSAGE = "Resolve the outstanding required closeout items before closing this booking out";
/**
 * The checklist is being changed behind a closeout that is already recorded as closed.
 *
 * Closing out is an assertion that the operational work is finished. Letting a required item slide back to
 * `pending` afterwards produced a record that contradicted itself: `closed_out` dominates the derived state, so
 * both participants kept seeing a finished wrap-up while required work was outstanding, a repeated completion
 * answered `already_closed`, and no reopen was ever recorded -- no count, no instant, no actor, no activity row.
 *
 * The explicit reopen action is the ONLY way back. It is deliberate, audited and customer-visible, which is
 * exactly what changing a closed record should be, and re-opening as a side effect of a checklist save would have
 * thrown all of that away silently.
 */
export const CATERING_CLOSEOUT_CLOSED_CODE = "catering_closeout_closed";
export const CATERING_CLOSEOUT_CLOSED_MESSAGE = "This booking is closed out. Reopen closeout before changing the checklist.";

/** A closeout record a provider may act on that does not exist yet, where the action needs one. */
export const CATERING_CLOSEOUT_NOT_FOUND_CODE = "catering_closeout_not_found";
export const CATERING_CLOSEOUT_NOT_FOUND_MESSAGE = "Closeout record not found";

/* ------------------------------------------------------------------------------------------------------------- *
 * Lifecycle gating
 * ------------------------------------------------------------------------------------------------------------- */

/**
 * Whether service actually happened, judged from the AUTHORITATIVE booking and nothing else.
 *
 * Not from a date the client computed, not from the event date having passed, and not from an inquiry state. The
 * one fact that proves an event was served is the provider's Phase 2G completion, and this reuses the Phase 2E
 * predicate that already decides exactly that question for review verification -- so "this event happened" means
 * the same thing in closeout as it does in the review system, rather than being decided twice.
 *
 * A CANCELLED booking is therefore false here, always. Its history stays fully readable, but no closeout checklist,
 * no closeout state other than `not_applicable` and no closeout mutation is offered on it, because every one of
 * those would assert that a service took place. A pending or confirmed booking whose event has not been completed
 * is false for the same reason: closeout is not actionable before there is anything to close out.
 */
export function cateringEventServiceOccurred(booking: { status: CateringBookingStatus; completedAt: unknown }): boolean {
  return qualifiesAsVerifiedCateringEvent(booking as { status?: string | null; completedAt?: unknown });
}
/**
 * Whether this booking can still produce a Phase 2K state change, and therefore whether the closeout view must
 * keep asking.
 *
 * Reading it the other way round -- polling only while the event is served and closeout is open -- left two stale
 * windows, both of which a participant could sit in indefinitely with the tab focused and no focus transition to
 * rescue them:
 *
 *   BEFORE SERVICE. A customer who opens the workspace while the booking is still confirmed sees a
 *   non-actionable closeout. The provider then completes the event -- and nothing tells them, because the query
 *   that would have noticed had switched itself off precisely because service had not happened yet.
 *
 *   AFTER A REOPEN. A customer who has been told their caterer finished wrapping up sees `closed_out`. The
 *   provider then reopens it, which deliberately notifies nobody, and no cache of another user's is invalidated
 *   by it. Their view could contradict the shared activity row above it forever.
 *
 * Only a CANCELLED booking is genuinely terminal here. Phase 2G cancellation is irreversible, a cancelled booking
 * can never become completed, so `cateringEventServiceOccurred` is false for it permanently and its closeout state
 * is fixed at `not_applicable`. Every other status can still move: pending and confirmed can reach completion, and
 * a completed booking's closeout can start, progress, close and reopen any number of times.
 *
 * An UNKNOWN status keeps polling. Nothing has been read yet, so nothing is known to be terminal, and the safe
 * direction is to ask.
 */
export const CATERING_CLOSEOUT_TERMINAL_BOOKING_STATUSES: readonly CateringBookingStatus[] = ["cancelled"];
export function cateringCloseoutCanStillChange(status: CateringBookingStatus | undefined): boolean {
  if (status === undefined) return true;
  return !CATERING_CLOSEOUT_TERMINAL_BOOKING_STATUSES.includes(status);
}

/** Every Phase 2K mutation is provider-only, and only on a booking whose event was actually served. */
export function mayMutateCateringCloseout(booking: { status: CateringBookingStatus; completedAt: unknown }, role: "provider" | "customer"): boolean {
  return role === "provider" && cateringEventServiceOccurred(booking);
}
/**
 * Whether the CHECKLIST may be edited right now, as opposed to whether closeout is actionable at all.
 *
 * The two are not the same, and conflating them is what let the interface offer edit controls that the server
 * would only ever refuse. `actionable` answers "is this the provider, on a booking whose event was served" --
 * which stays true after closing out, because reopening and private notes are both still legitimate. Editing the
 * checklist is narrower: once operational closeout is recorded closed, the checklist that decided it is frozen
 * until the provider explicitly reopens.
 *
 * This is the client-side statement of exactly the boundary the route enforces under its advisory lock. It is not
 * a substitute for that boundary -- the server remains the backstop -- but normal use should never be steered into
 * a refusal, and an editor opened a moment before another tab closed the booking out must stop being usable the
 * instant this client learns of it.
 *
 * Provider-private notes are deliberately NOT behind this: they are editable after closeout by design, because
 * they provably cannot move the derived state, a blocker, `mayCloseOut`, or any value a customer receives.
 */
export function cateringCloseoutChecklistIsEditable(actionable: boolean, closedOut: boolean): boolean {
  return actionable && !closedOut;
}

/** Reading never closes. Both participants may read a closeout view of any booking, under their own projection. */
export function mayReadCateringCloseout(): boolean { return true; }

/* ------------------------------------------------------------------------------------------------------------- *
 * Equipment, read through the Phase 2J contract
 * ------------------------------------------------------------------------------------------------------------- */

/**
 * The equipment statuses that are still OUTSTANDING once the event is over.
 *
 * This is a Phase 2K reading of the EXISTING Phase 2J allowlist -- every value below comes from
 * `CATERING_EQUIPMENT_STATUSES` and this phase invents none -- and it deliberately differs from Phase 2J's
 * pre-event `cateringEquipmentIsSettled`. Before the event, an item that has been received or put into use is
 * settled: it arrived, which is what the provider was waiting on. After the event that is exactly backwards. A
 * chafer still recorded as `in_use` the week after a wedding has not come back, and a rental still `received` is
 * still somebody's to return. Reusing the pre-event predicate here would have quietly reported those as closed.
 *
 * So after service only `returned` and `cancelled` mean an item needs nothing further: one came back, the other
 * never went out. `planned`, `confirmed`, `received` and `in_use` are all outstanding.
 */
export const CATERING_CLOSEOUT_SETTLED_EQUIPMENT_STATUSES: readonly CateringEquipmentStatus[] = ["returned", "cancelled"];
export function cateringEquipmentIsClosedOut(status: CateringEquipmentStatus): boolean {
  return CATERING_CLOSEOUT_SETTLED_EQUIPMENT_STATUSES.includes(status);
}
export function cateringEquipmentIsOutstandingAfterService(status: CateringEquipmentStatus): boolean {
  return !cateringEquipmentIsClosedOut(status);
}
/** Guards the reading above against the Phase 2J allowlist, so a status added there cannot be silently unclassified. */
export function cateringCloseoutEquipmentStatusesAreExhaustive(): boolean {
  return CATERING_EQUIPMENT_STATUSES.every((status) =>
    cateringEquipmentIsClosedOut(status) !== cateringEquipmentIsOutstandingAfterService(status));
}
/** One equipment row is visible to this actor under the Phase 2J visibility rule, restated nowhere else. */
export function cateringCloseoutEquipmentVisibleTo(visibility: CateringExecutionVisibility, role: "provider" | "customer"): boolean {
  return role === "provider" || visibility === "shared";
}

/* ------------------------------------------------------------------------------------------------------------- *
 * Derived closeout state
 * ------------------------------------------------------------------------------------------------------------- */

/**
 * Closeout progress is DERIVED, never stored.
 *
 * There is no persisted percentage, no cached score and no client-supplied count anywhere in this module. The
 * server reads the actor's own authorized rows, reduces them to the facts below, and derives the state from them
 * deterministically -- which is what makes a blocker impossible to forge from a request body: there is nothing to
 * forge, because nothing about progress is accepted as input.
 *
 * These states are OPERATIONAL and presentational. `closed_out` in particular is NOT a booking status: it never
 * appears on the booking record, the booking stays `completed`, and nothing here can move a lifecycle.
 */
export const CATERING_CLOSEOUT_STATES = ["not_applicable", "not_started", "in_progress", "blocked", "ready_to_close", "closed_out"] as const;
export type CateringCloseoutState = typeof CATERING_CLOSEOUT_STATES[number];
/**
 * `not_started`, `in_progress` and `ready_to_close` describe the PROVIDER's internal checklist, which a customer
 * has no representation of at all, so a customer is never given one of them. Their view resolves to
 * `not_applicable`, `closed_out`, `blocked` or `in_progress` -- and its `in_progress` means only "the caterer is
 * wrapping up", derived from customer-authorized facts alone.
 */
export const CATERING_CLOSEOUT_PROVIDER_ONLY_STATES: readonly CateringCloseoutState[] = ["not_started", "ready_to_close"];

export const CATERING_CLOSEOUT_STATE_LABELS: Record<CateringCloseoutState, string> = {
  not_applicable: "No closeout needed",
  not_started: "Not started",
  in_progress: "In progress",
  blocked: "Needs attention",
  ready_to_close: "Ready to close out",
  closed_out: "Closed out",
};

/** The signals a closeout summary is built from, in the order they are reported. */
export const CATERING_CLOSEOUT_SIGNALS = ["checklist", "equipment_return", "shared_requirements", "final_documents", "review_follow_up"] as const;
export type CateringCloseoutSignal = typeof CATERING_CLOSEOUT_SIGNALS[number];
/**
 * `checklist` is omitted from a customer's summary ENTIRELY -- not reported as ready, not as unknown, simply
 * absent -- because its presence in any state would tell a customer that an internal checklist exists for this
 * booking and that it is or is not satisfied, which is precisely the private fact the checklist is.
 */
export const CATERING_CLOSEOUT_PROVIDER_ONLY_SIGNALS: readonly CateringCloseoutSignal[] = ["checklist"];
export function cateringCloseoutSignalVisibleTo(signal: CateringCloseoutSignal, role: "provider" | "customer"): boolean {
  return role === "provider" || !CATERING_CLOSEOUT_PROVIDER_ONLY_SIGNALS.includes(signal);
}

export const CATERING_CLOSEOUT_SIGNAL_STATES = ["ready", "needs_attention", "blocked"] as const;
export type CateringCloseoutSignalState = typeof CATERING_CLOSEOUT_SIGNAL_STATES[number];

/**
 * The reduced, already-authorized facts a closeout summary is derived from.
 *
 * Every count is computed from rows the ACTOR may see. A customer's facts are built from shared equipment and
 * shared requirements only, and carry no checklist numbers at all, so a provider-private equipment record, a
 * private note or an internal incident cannot change a single value a customer receives. Nothing here is ever read
 * from a request.
 */
export type CateringCloseoutFacts = {
  /** The authoritative booking says an event was actually served. Never a client date computation. */
  eventServiceOccurred: boolean;
  /** Operational closeout has been recorded complete. */
  closedOut: boolean;
  /** Equipment visible to this actor that is still outstanding after service. */
  outstandingEquipmentCount: number;
  /** Phase 2H SHARED requirements still pending. Both actors already see these, so both actors' facts count them. */
  outstandingSharedRequirementCount: number;
  /** Shared Phase 2I files that exist on this booking. Counted per actor from shared rows only, for both actors. */
  sharedDocumentCount: number;
  /**
   * PROVIDER FACTS ONLY. Each is zero/false in a customer's facts, and every signal and state that reads them is
   * either provider-only or written so that a customer's derivation cannot reach them.
   */
  unresolvedRequiredItemCount: number;
  resolvedItemCount: number;
  equipmentItemResolved: boolean;
  documentsItemResolved: boolean;
  reviewItemResolved: boolean;
  hasProviderNotes: boolean;
  /** Whether a review by this booking's customer for this booking's provider exists. A published, public fact. */
  customerReviewExists: boolean;
};

/**
 * The exact derivation rules for one signal, one actor at a time. Total, deterministic, and dependent on nothing
 * but the facts above -- no clock, no randomness, no row ordering and no request input.
 *
 *  - `checklist`           provider only. blocked while any REQUIRED item is unresolved; ready otherwise.
 *  - `equipment_return`    blocked while visible equipment is outstanding AND -- for a provider -- the equipment
 *                          item is unresolved; needs_attention for a provider who has resolved it with records
 *                          still outstanding; ready at zero.
 *  - `shared_requirements` needs_attention while any shared Phase 2H requirement is pending; ready otherwise.
 *  - `final_documents`     ready once a shared document exists, or -- for a provider -- once the documents item is
 *                          resolved; needs_attention otherwise.
 *  - `review_follow_up`    ready once a review exists, or -- for a provider -- once the review item is resolved;
 *                          needs_attention otherwise. Never blocked: a review is the customer's to give or not.
 *
 * A CUSTOMER'S `equipment_return` DELIBERATELY DOES NOT READ THE CHECKLIST. The provider's reading folds in
 * whether they have answered the equipment item, because for them the item is the assertion that settles it. A
 * customer may not know that item exists, let alone its state, so their signal is a function of shared equipment
 * rows alone -- which is what stops a provider-private checklist edit from changing a value a customer receives.
 */
export function cateringCloseoutSignalState(
  signal: CateringCloseoutSignal,
  facts: CateringCloseoutFacts,
  role: "provider" | "customer",
): CateringCloseoutSignalState {
  const provider = role === "provider";
  switch (signal) {
    case "checklist":
      return facts.unresolvedRequiredItemCount > 0 ? "blocked" : "ready";
    case "equipment_return":
      if (facts.outstandingEquipmentCount === 0) return "ready";
      if (!provider) return "blocked";
      return facts.equipmentItemResolved ? "needs_attention" : "blocked";
    case "shared_requirements":
      return facts.outstandingSharedRequirementCount > 0 ? "needs_attention" : "ready";
    case "final_documents":
      if (facts.sharedDocumentCount > 0) return "ready";
      return provider && facts.documentsItemResolved ? "ready" : "needs_attention";
    case "review_follow_up":
      if (facts.customerReviewExists) return "ready";
      return provider && facts.reviewItemResolved ? "ready" : "needs_attention";
  }
}

/**
 * The fixed wording for every (signal, state, role) pair.
 *
 * Nothing a provider typed ever reaches a customer through a closeout summary. A detail is looked up here by enum
 * values, so an internal note, an incident description or a vendor's name cannot leak into a customer's summary
 * however it was worded: there is no path from a persisted string to this text.
 */
export const CATERING_CLOSEOUT_SIGNAL_LABELS: Record<CateringCloseoutSignal, string> = {
  checklist: "Closeout checklist",
  equipment_return: "Equipment and rentals",
  shared_requirements: "Outstanding requirements",
  final_documents: "Final documents",
  review_follow_up: "Review",
};
export const CATERING_CLOSEOUT_SIGNAL_DETAILS: Record<"provider" | "customer", Record<CateringCloseoutSignal, Record<CateringCloseoutSignalState, string>>> = {
  provider: {
    checklist: { ready: "Every required closeout item is resolved", needs_attention: "Closeout items are still outstanding", blocked: "Required closeout items are still outstanding" },
    equipment_return: { ready: "Every equipment record is returned or cancelled", needs_attention: "You confirmed the return, but some equipment records are not marked returned", blocked: "Some equipment is not yet recorded as returned" },
    shared_requirements: { ready: "No outstanding requirements", needs_attention: "Requirements shared with the customer are still outstanding", blocked: "Requirements shared with the customer are still outstanding" },
    final_documents: { ready: "Final documents are settled", needs_attention: "No documents have been shared with the customer", blocked: "No documents have been shared with the customer" },
    review_follow_up: { ready: "Review follow-up is settled", needs_attention: "This customer has not left a review yet", blocked: "This customer has not left a review yet" },
  },
  customer: {
    checklist: { ready: "", needs_attention: "", blocked: "" },
    equipment_return: { ready: "Nothing is outstanding", needs_attention: "Some equipment is still outstanding", blocked: "Some equipment from this event is still outstanding" },
    shared_requirements: { ready: "Nothing is waiting on you", needs_attention: "Your caterer is still waiting on something from you", blocked: "Your caterer is still waiting on something from you" },
    final_documents: { ready: "Shared documents are available below", needs_attention: "No documents have been shared for this event", blocked: "No documents have been shared for this event" },
    review_follow_up: { ready: "You have reviewed this caterer", needs_attention: "You have not reviewed this caterer yet", blocked: "You have not reviewed this caterer yet" },
  },
};

export type CateringCloseoutSignalView = { signal: CateringCloseoutSignal; label: string; state: CateringCloseoutSignalState; detail: string };

/**
 * The whole derivation, for one actor.
 *
 * A PROVIDER'S state, in order:
 *   - the booking records no served event                       -> `not_applicable`
 *   - closeout is recorded complete                             -> `closed_out`
 *   - equipment is outstanding and its item is unanswered       -> `blocked`
 *   - every required item is resolved                           -> `ready_to_close`
 *   - nothing has been resolved and no notes written            -> `not_started`
 *   - otherwise                                                 -> `in_progress`
 *
 * `blocked` is reserved for a derived blocker -- real equipment records the provider has not accounted for -- so it
 * says something the checklist counts do not. Once that item is answered the state falls through to the ordinary
 * checklist progression, which is why closeout is always reachable: equipment rows are Phase 2J records and Phase
 * 2J closes its mutations on a completed booking, so a gate that required those rows to change could never be
 * cleared. The provider's answer is the assertion that settles it, and it is attributed and timestamped.
 *
 * A CUSTOMER'S state is a function of customer-authorized facts alone:
 *   - the booking records no served event                       -> `not_applicable`
 *   - closeout is recorded complete                             -> `closed_out`
 *   - shared equipment is still outstanding                     -> `blocked`
 *   - otherwise                                                 -> `in_progress`
 *
 * Their state can therefore never move because of a provider-private checklist edit, a private note, an internal
 * incident, or a provider-private equipment record -- none of which appear in the facts their derivation reads.
 */
export function deriveCateringCloseoutState(facts: CateringCloseoutFacts, role: "provider" | "customer"): CateringCloseoutState {
  if (!facts.eventServiceOccurred) return "not_applicable";
  if (facts.closedOut) return "closed_out";
  if (role === "customer") return facts.outstandingEquipmentCount > 0 ? "blocked" : "in_progress";
  if (facts.outstandingEquipmentCount > 0 && !facts.equipmentItemResolved) return "blocked";
  if (facts.unresolvedRequiredItemCount === 0) return "ready_to_close";
  if (facts.resolvedItemCount === 0 && !facts.hasProviderNotes) return "not_started";
  return "in_progress";
}

export type CateringCloseoutReadinessView = {
  state: CateringCloseoutState;
  signals: CateringCloseoutSignalView[];
  blockers: CateringCloseoutSignalView[];
  /** Whether the provider may complete closeout right now. Always false for a customer: they never may. */
  mayCloseOut: boolean;
};

/**
 * The derivation the route serves, for one actor.
 *
 * `blockers` is the subset of `signals` in the blocked state -- repeated for the client's convenience rather than
 * derived separately, so the two can never disagree, and a customer's blockers are by construction drawn from the
 * signals a customer may already see.
 *
 * `mayCloseOut` restates exactly the server's own gate rather than a looser approximation of it, so the button the
 * provider sees and the transaction that would run agree. It is false for a customer under every circumstance.
 */
export function deriveCateringCloseout(facts: CateringCloseoutFacts, role: "provider" | "customer"): CateringCloseoutReadinessView {
  const signals = CATERING_CLOSEOUT_SIGNALS.filter((signal) => cateringCloseoutSignalVisibleTo(signal, role)).map((signal) => {
    const state = cateringCloseoutSignalState(signal, facts, role);
    return { signal, label: CATERING_CLOSEOUT_SIGNAL_LABELS[signal], state, detail: CATERING_CLOSEOUT_SIGNAL_DETAILS[role][signal][state] };
  });
  return {
    state: deriveCateringCloseoutState(facts, role),
    signals,
    blockers: signals.filter((entry) => entry.state === "blocked"),
    mayCloseOut: role === "provider" && cateringCloseoutMayComplete(facts),
  };
}

/**
 * The ONE gate on completing operational closeout, stated once and used by the client's button, the route's early
 * guard and the locked transaction alike.
 *
 * An already-closed booking is `false` here because there is nothing left to do -- the route answers that case
 * idempotently rather than by refusing, so this predicate never has to describe it.
 */
export function cateringCloseoutMayComplete(facts: CateringCloseoutFacts): boolean {
  return facts.eventServiceOccurred && !facts.closedOut && facts.unresolvedRequiredItemCount === 0;
}

/* ------------------------------------------------------------------------------------------------------------- *
 * Serialized views
 * ------------------------------------------------------------------------------------------------------------- */

/**
 * One checklist item, PROVIDER ONLY.
 *
 * There is no customer variant of this type and the route never builds one: a customer's closeout payload carries
 * no `checklist` key at all. The absence is the privacy boundary -- not a filter that could be called with the
 * wrong argument.
 *
 * `completedBy` is persisted for audit and never serialized, to any actor. Only the provider can resolve an item,
 * so the id would tell no participant anything they do not already know, and it is exactly the kind of internal
 * attribution this phase promises not to expose.
 */
export type CateringCloseoutItemView = {
  key: CateringCloseoutItemKey;
  label: string;
  description: string;
  required: boolean;
  state: CateringCloseoutItemState;
  providerNote: string | null;
  resolvedAt: string | null;
  /** Null for a key with no row yet, which is exactly the precondition the client sends back to create it. */
  updatedAt: string | null;
};

/** One shared document, reported through the EXISTING Phase 2I file view. No second file model exists here. */
export type CateringCloseoutDocumentView = {
  id: string;
  filename: string;
  contentType: string;
  byteSize: number;
  uploadedByRole: "provider" | "customer";
  uploaderName: string | null;
  createdAt: string;
};

/**
 * What a provider is told about review follow-up.
 *
 * One boolean, derived from the EXISTING Phase 2E review table. It reports only whether a review this provider can
 * already read on their own public profile exists -- published reviews are public and attributed -- so it discloses
 * nothing new. It carries no rating, no body, no draft (the review system has no drafts), and no eligibility the
 * provider could act on: a provider cannot manufacture, grant or remove a customer's ability to review.
 */
export type CateringCloseoutProviderReviewView = { customerReviewExists: boolean };
/**
 * What a customer is told about reviewing.
 *
 * Eligibility is the EXISTING Phase 2E rule, evaluated server-side and merely reported here; the review itself is
 * still created by the existing review flow, against the existing endpoint, under the existing unique constraint
 * that permits one review per reviewer and provider. `alreadyReviewed` reflects that constraint so the interface
 * offers "update your review" rather than a create the server would refuse.
 */
export type CateringCloseoutCustomerReviewView = {
  mayReview: boolean;
  alreadyReviewed: boolean;
  /** The existing public provider page, which is where the existing review flow lives. No new review surface. */
  reviewPath: string;
};

export type CateringCloseoutRecordView = {
  closedOut: boolean;
  closedOutAt: string | null;
  /** How many times closeout has been reopened. A count, never who did it: attribution stays internal. */
  reopenCount: number;
  lastReopenedAt: string | null;
  /** The optimistic-concurrency version. PROVIDER ONLY -- see the serializer for why a customer gets no version. */
  updatedAt?: string | null;
  /** Provider-private post-event notes. PROVIDER ONLY: the key is absent from a customer's object, not null. */
  providerNotes?: string | null;
};

export type CateringBookingCloseoutView = {
  role: "provider" | "customer";
  /** Whether Phase 2K mutations are open at all. Derived from the authoritative booking, never from a date. */
  actionable: boolean;
  bookingStatus: CateringBookingStatus;
  eventServiceOccurred: boolean;
  closeout: CateringCloseoutRecordView;
  readiness: CateringCloseoutReadinessView;
  documents: CateringCloseoutDocumentView[];
  /** Where a participant continues the conversation: the EXISTING Phase 2I booking communication section. */
  communicationPath: string;
  /** Absent keys rather than empty values: a customer's payload carries no provider-only field at all. */
  checklist?: CateringCloseoutItemView[];
  providerReview?: CateringCloseoutProviderReviewView;
  customerReview?: CateringCloseoutCustomerReviewView;
  /** The customer's truthful path to working with this caterer again. Provider payloads carry no rebooking key. */
  rebookPath?: string;
};

/* ------------------------------------------------------------------------------------------------------------- *
 * Paths, keys and shared wording
 * ------------------------------------------------------------------------------------------------------------- */

export const CATERING_CLOSEOUT_SECTION = "closeout";
export const cateringBookingCloseoutPath = (bookingId: string) => `/api/catering/bookings/${bookingId}/closeout`;
export const cateringBookingCloseoutKey = (userId: string, bookingId: string) => ["catering", "booking-closeout", userId, bookingId] as const;
export function cateringCloseoutSectionPath(role: "provider" | "customer", bookingId: string): string {
  return `${cateringBookingWorkspacePath(role, bookingId)}#${CATERING_CLOSEOUT_SECTION}`;
}
/**
 * The EXISTING Phase 2I communication section of the same workspace. No second messaging surface is introduced.
 *
 * It is a link to READ the thread, not a channel to write in. Phase 2I's `mayPostCateringBookingMessage` closes
 * with the Phase 2H edit window, so on a completed booking -- the only kind this section is ever rendered for --
 * the composer is unavailable to both participants. The wording below says so rather than implying otherwise, and
 * Phase 2K does not widen that boundary to make its own copy true.
 */
export function cateringCloseoutCommunicationPath(role: "provider" | "customer", bookingId: string): string {
  return `${cateringBookingWorkspacePath(role, bookingId)}#communication`;
}
/**
 * The EXISTING public provider page, which is where both the existing inquiry flow and the existing review flow
 * live.
 *
 * A "work with this caterer again" action goes HERE and nowhere else. It starts a genuinely new inquiry: no date,
 * guest count, price, menu, package, acceptance, booking status or payment state is carried forward, because none
 * of it is carried anywhere -- the link names the provider and nothing else. The completed booking is historical
 * truth and is never cloned, copied or reopened to make a new one.
 */
export function cateringProviderProfilePath(providerId: string): string {
  return `/services/catering/provider/${providerId}`;
}

/**
 * The single closeout notification.
 *
 * Fixed wording with no provider-private content in the title, the message or the metadata, and sent only for the
 * one event that genuinely concerns the customer: their caterer has finished wrapping up. Internal checklist work,
 * private notes, incidents and reopening notify nobody.
 */
export const CATERING_CLOSEOUT_NOTIFICATION = {
  type: "catering_booking_closeout",
  title: "Catering event closed out",
  message: "Your caterer has finished wrapping up this event.",
} as const;

/**
 * What a participant is told about the booking conversation.
 *
 * "View", not "message". The conversation is read-only for BOTH participants once an event is complete, so telling
 * a provider they could ask their customer for a review there described an action neither of them can take -- the
 * composer is not rendered and the send would be refused. The link stays, because reading the history is genuinely
 * useful; only the claim about what can be done with it is corrected.
 */
export const CATERING_CLOSEOUT_CONVERSATION_ACTION = "View the booking conversation";
export const CATERING_CLOSEOUT_CONVERSATION_NOTE = "The booking conversation is read-only once an event is complete. You can read the full history, but no new messages can be sent on this booking.";

/**
 * The provider's review-status line. It reports a fact and names no channel: a provider who wants to ask for a
 * review reaches their customer however they already do, and records that on the closeout checklist.
 */
export const CATERING_CLOSEOUT_PROVIDER_REVIEW_PRESENT = "This customer has left a review on your profile.";
export const CATERING_CLOSEOUT_PROVIDER_REVIEW_ABSENT = "This customer has not left a review yet.";

/** Wording the interface shares with the contract, so the two cannot describe the lifecycle differently. */
/** What a provider is told in place of the edit controls while closeout stands, and where to go to change it. */
export const CATERING_CLOSEOUT_CHECKLIST_LOCKED_NOTICE = "This booking is closed out, so the checklist is read-only. Reopen closeout below if you need to change it.";

export const CATERING_CLOSEOUT_CANCELLED_NOTICE = "This booking was cancelled, so no event service took place and there is no post-event closeout.";
export const CATERING_CLOSEOUT_PENDING_NOTICE = "Post-event closeout opens once your provider marks the event complete.";
export const CATERING_CLOSEOUT_PROVIDER_PENDING_NOTICE = "Post-event closeout opens once you mark this event complete.";
