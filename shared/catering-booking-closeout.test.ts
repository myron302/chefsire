import assert from "node:assert/strict";
import test from "node:test";
import {
  CATERING_CLOSEOUT_ITEM_KEYS,
  CATERING_CLOSEOUT_ITEM_STATES,
  CATERING_CLOSEOUT_PROVIDER_ONLY_SIGNALS,
  CATERING_CLOSEOUT_PROVIDER_ONLY_STATES,
  CATERING_CLOSEOUT_REQUIRED_ITEM_KEYS,
  CATERING_CLOSEOUT_SIGNALS,
  CATERING_CLOSEOUT_SIGNAL_DETAILS,
  CATERING_CLOSEOUT_STATES,
  cateringCloseoutEquipmentVisibleTo,
  cateringCloseoutItemIsRequired,
  cateringCloseoutItemIsResolved,
  cateringCloseoutMayComplete,
  cateringCloseoutEquipmentStatusesAreExhaustive,
  cateringCloseoutSignalState,
  cateringCloseoutSignalVisibleTo,
  cateringEquipmentIsClosedOut,
  cateringEquipmentIsOutstandingAfterService,
  cateringEventServiceOccurred,
  cateringProviderProfilePath,
  cateringCloseoutSectionPath,
  cateringCloseoutCommunicationPath,
  deriveCateringCloseout,
  deriveCateringCloseoutState,
  mayMutateCateringCloseout,
  mayReadCateringCloseout,
  type CateringCloseoutFacts,
} from "./catering-booking-closeout";
import { CATERING_EQUIPMENT_STATUSES, cateringEquipmentIsSettled } from "./catering-booking-execution";
import { CATERING_BOOKING_STATUSES } from "./catering-bookings";

/**
 * The Phase 2K contract.
 *
 * Every rule this phase depends on is stated once, here, and asserted here: the lifecycle gate, the closeout
 * reading of the Phase 2J equipment allowlist, the per-actor derivation, and the privacy boundary that keeps a
 * provider-private checklist out of every value a customer receives.
 */

const FACTS: CateringCloseoutFacts = {
  eventServiceOccurred: true,
  closedOut: false,
  outstandingEquipmentCount: 0,
  outstandingSharedRequirementCount: 0,
  sharedDocumentCount: 0,
  unresolvedRequiredItemCount: 0,
  resolvedItemCount: 0,
  equipmentItemResolved: false,
  documentsItemResolved: false,
  reviewItemResolved: false,
  hasProviderNotes: false,
  customerReviewExists: false,
};
const facts = (patch: Partial<CateringCloseoutFacts> = {}): CateringCloseoutFacts => ({ ...FACTS, ...patch });

/* ----------------------------------------------------------------------------------------------------------- *
 * Lifecycle gating
 * ----------------------------------------------------------------------------------------------------------- */

test("only a completed booking that actually records a completion counts as a served event", () => {
  assert.equal(cateringEventServiceOccurred({ status: "completed", completedAt: new Date() }), true);
  // A status of `completed` with no recorded completion instant is not evidence of service. It is the same rule
  // Phase 2E already applies to review verification, reused rather than restated.
  assert.equal(cateringEventServiceOccurred({ status: "completed", completedAt: null }), false);
  for (const status of CATERING_BOOKING_STATUSES.filter((value) => value !== "completed")) {
    assert.equal(cateringEventServiceOccurred({ status, completedAt: new Date() }), false, `${status} is not a served event`);
  }
});

test("a cancelled booking never becomes actionable, however recently it was cancelled", () => {
  const cancelled = { status: "cancelled" as const, completedAt: new Date() };
  assert.equal(mayMutateCateringCloseout(cancelled, "provider"), false);
  assert.equal(deriveCateringCloseoutState(facts({ eventServiceOccurred: false }), "provider"), "not_applicable");
  assert.equal(deriveCateringCloseoutState(facts({ eventServiceOccurred: false }), "customer"), "not_applicable");
});

test("a future confirmed booking cannot be falsely closed out", () => {
  const confirmed = { status: "confirmed" as const, completedAt: null };
  assert.equal(mayMutateCateringCloseout(confirmed, "provider"), false);
  // Even with every required item somehow resolved, the completion gate refuses without a served event.
  assert.equal(cateringCloseoutMayComplete(facts({ eventServiceOccurred: false, unresolvedRequiredItemCount: 0 })), false);
});

test("closeout mutation is provider-only, and reading never closes", () => {
  const served = { status: "completed" as const, completedAt: new Date() };
  assert.equal(mayMutateCateringCloseout(served, "provider"), true);
  assert.equal(mayMutateCateringCloseout(served, "customer"), false);
  assert.equal(mayReadCateringCloseout(), true);
});

/* ----------------------------------------------------------------------------------------------------------- *
 * Equipment, read through the Phase 2J allowlist
 * ----------------------------------------------------------------------------------------------------------- */

test("the closeout equipment reading uses the exact Phase 2J allowlist and classifies every value", () => {
  assert.equal(cateringCloseoutEquipmentStatusesAreExhaustive(), true);
  for (const status of CATERING_EQUIPMENT_STATUSES) {
    assert.equal(cateringEquipmentIsClosedOut(status), !cateringEquipmentIsOutstandingAfterService(status));
  }
  assert.deepEqual(CATERING_EQUIPMENT_STATUSES.filter(cateringEquipmentIsClosedOut), ["returned", "cancelled"]);
});

test("received and in_use equipment is outstanding after service, though Phase 2J calls it settled before one", () => {
  // This is the whole reason Phase 2K has its own reading. Before an event, "received" means the thing arrived and
  // the provider can stop chasing it. After one, it means the thing is still out and has not come back. Reusing the
  // pre-event predicate would have quietly reported an unreturned rental as closed.
  for (const status of ["received", "in_use"] as const) {
    assert.equal(cateringEquipmentIsSettled(status), true, "Phase 2J still treats it as settled before the event");
    assert.equal(cateringEquipmentIsOutstandingAfterService(status), true, "and Phase 2K treats it as outstanding after one");
  }
  assert.equal(cateringEquipmentIsOutstandingAfterService("planned"), true);
  assert.equal(cateringEquipmentIsOutstandingAfterService("confirmed"), true);
});

test("equipment visibility follows the Phase 2J rule: a customer sees shared records and nothing else", () => {
  assert.equal(cateringCloseoutEquipmentVisibleTo("provider_private", "provider"), true);
  assert.equal(cateringCloseoutEquipmentVisibleTo("provider_private", "customer"), false);
  assert.equal(cateringCloseoutEquipmentVisibleTo("shared", "customer"), true);
});

/* ----------------------------------------------------------------------------------------------------------- *
 * The checklist
 * ----------------------------------------------------------------------------------------------------------- */

test("every checklist key is answerable, and required keys are a strict subset", () => {
  assert.equal(new Set(CATERING_CLOSEOUT_ITEM_KEYS).size, CATERING_CLOSEOUT_ITEM_KEYS.length);
  for (const key of CATERING_CLOSEOUT_REQUIRED_ITEM_KEYS) {
    assert.ok(CATERING_CLOSEOUT_ITEM_KEYS.includes(key), `${key} is a real key`);
    assert.equal(cateringCloseoutItemIsRequired(key), true);
  }
  assert.ok(CATERING_CLOSEOUT_REQUIRED_ITEM_KEYS.length < CATERING_CLOSEOUT_ITEM_KEYS.length, "some items are optional");
});

test("not_applicable resolves an item exactly as completion does, so no booking can be impossible to close out", () => {
  assert.equal(cateringCloseoutItemIsResolved("pending"), false);
  assert.equal(cateringCloseoutItemIsResolved("completed"), true);
  assert.equal(cateringCloseoutItemIsResolved("not_applicable"), true);
  assert.deepEqual([...CATERING_CLOSEOUT_ITEM_STATES], ["pending", "completed", "not_applicable"]);
});

test("incident follow-up is a checklist key rather than a model of its own", () => {
  assert.ok(CATERING_CLOSEOUT_ITEM_KEYS.includes("incident_follow_up_resolved"));
  assert.equal(cateringCloseoutItemIsRequired("incident_follow_up_resolved"), true);
});

/* ----------------------------------------------------------------------------------------------------------- *
 * Signals
 * ----------------------------------------------------------------------------------------------------------- */

test("the checklist signal is provider-only and absent from a customer's summary entirely", () => {
  assert.deepEqual([...CATERING_CLOSEOUT_PROVIDER_ONLY_SIGNALS], ["checklist"]);
  assert.equal(cateringCloseoutSignalVisibleTo("checklist", "customer"), false);
  const customer = deriveCateringCloseout(facts({ unresolvedRequiredItemCount: 4 }), "customer");
  assert.equal(customer.signals.some((signal) => signal.signal === "checklist"), false);
  // Not reported as ready, not as unknown -- simply not present, which is what stops its existence being inferable.
  assert.equal(JSON.stringify(customer).includes("checklist"), false);
});

test("a provider's equipment signal folds in their own answer; a customer's reads shared rows alone", () => {
  assert.equal(cateringCloseoutSignalState("equipment_return", facts({ outstandingEquipmentCount: 2 }), "provider"), "blocked");
  assert.equal(cateringCloseoutSignalState("equipment_return", facts({ outstandingEquipmentCount: 2, equipmentItemResolved: true }), "provider"), "needs_attention");
  assert.equal(cateringCloseoutSignalState("equipment_return", facts({ outstandingEquipmentCount: 0 }), "provider"), "ready");
  // A customer has no representation of the checklist item, so their signal cannot depend on it.
  assert.equal(cateringCloseoutSignalState("equipment_return", facts({ outstandingEquipmentCount: 1, equipmentItemResolved: true }), "customer"), "blocked");
  assert.equal(cateringCloseoutSignalState("equipment_return", facts({ outstandingEquipmentCount: 0, equipmentItemResolved: false }), "customer"), "ready");
});

test("settled equipment no longer blocks either actor", () => {
  assert.equal(cateringCloseoutSignalState("equipment_return", facts({ outstandingEquipmentCount: 0 }), "provider"), "ready");
  assert.equal(cateringCloseoutSignalState("equipment_return", facts({ outstandingEquipmentCount: 0 }), "customer"), "ready");
});

test("review follow-up is never a blocker: a review is the customer's to give or withhold", () => {
  for (const role of ["provider", "customer"] as const) {
    assert.notEqual(cateringCloseoutSignalState("review_follow_up", facts(), role), "blocked");
  }
  assert.equal(cateringCloseoutSignalState("review_follow_up", facts({ customerReviewExists: true }), "customer"), "ready");
  assert.equal(cateringCloseoutSignalState("review_follow_up", facts({ reviewItemResolved: true }), "provider"), "ready");
  // A provider resolving their own item cannot make a customer's signal claim a review exists.
  assert.equal(cateringCloseoutSignalState("review_follow_up", facts({ reviewItemResolved: true }), "customer"), "needs_attention");
});

test("every signal detail is fixed wording looked up by enum, never anything a provider typed", () => {
  for (const role of ["provider", "customer"] as const) {
    for (const signal of CATERING_CLOSEOUT_SIGNALS) {
      for (const state of ["ready", "needs_attention", "blocked"] as const) {
        assert.equal(typeof CATERING_CLOSEOUT_SIGNAL_DETAILS[role][signal][state], "string");
      }
    }
  }
});

/* ----------------------------------------------------------------------------------------------------------- *
 * Derived state
 * ----------------------------------------------------------------------------------------------------------- */

test("a provider's state walks not_started -> in_progress -> ready_to_close", () => {
  assert.equal(deriveCateringCloseoutState(facts({ unresolvedRequiredItemCount: 4 }), "provider"), "not_started");
  assert.equal(deriveCateringCloseoutState(facts({ unresolvedRequiredItemCount: 2, resolvedItemCount: 2 }), "provider"), "in_progress");
  assert.equal(deriveCateringCloseoutState(facts({ unresolvedRequiredItemCount: 0, resolvedItemCount: 4 }), "provider"), "ready_to_close");
  // Writing notes alone is progress, even before anything is answered.
  assert.equal(deriveCateringCloseoutState(facts({ unresolvedRequiredItemCount: 4, hasProviderNotes: true }), "provider"), "in_progress");
});

test("outstanding equipment blocks a provider until they answer the equipment item, and never permanently", () => {
  const outstanding = facts({ outstandingEquipmentCount: 3, unresolvedRequiredItemCount: 4 });
  assert.equal(deriveCateringCloseoutState(outstanding, "provider"), "blocked");
  // Phase 2J closes equipment mutation on a completed booking, so a gate that needed those rows to change could
  // never be cleared. The provider's own answer is what settles it.
  const answered = facts({ outstandingEquipmentCount: 3, equipmentItemResolved: true, unresolvedRequiredItemCount: 0, resolvedItemCount: 4 });
  assert.equal(deriveCateringCloseoutState(answered, "provider"), "ready_to_close");
  assert.equal(cateringCloseoutMayComplete(answered), true);
});

test("closed_out dominates every other state, for both actors", () => {
  const closed = facts({ closedOut: true, unresolvedRequiredItemCount: 4, outstandingEquipmentCount: 9 });
  assert.equal(deriveCateringCloseoutState(closed, "provider"), "closed_out");
  assert.equal(deriveCateringCloseoutState(closed, "customer"), "closed_out");
  // And an already-closed booking is not "completable" again: the route answers a retry idempotently instead.
  assert.equal(cateringCloseoutMayComplete(closed), false);
});

test("a customer never receives a provider-only state", () => {
  const inputs: CateringCloseoutFacts[] = [
    facts(), facts({ closedOut: true }), facts({ eventServiceOccurred: false }),
    facts({ outstandingEquipmentCount: 1 }), facts({ unresolvedRequiredItemCount: 4, resolvedItemCount: 0 }),
    facts({ unresolvedRequiredItemCount: 0, resolvedItemCount: 7 }),
  ];
  for (const input of inputs) {
    const state = deriveCateringCloseoutState(input, "customer");
    assert.ok(CATERING_CLOSEOUT_STATES.includes(state));
    assert.equal(CATERING_CLOSEOUT_PROVIDER_ONLY_STATES.includes(state), false, `customer must not see ${state}`);
  }
});

test("no provider-private fact changes any value a customer receives", () => {
  const base = facts({ outstandingEquipmentCount: 0, outstandingSharedRequirementCount: 1, sharedDocumentCount: 2 });
  const withPrivateWork = facts({
    ...base,
    // Every provider-only fact moved at once: an incident recorded, notes written, items answered.
    unresolvedRequiredItemCount: 4, resolvedItemCount: 3, equipmentItemResolved: true,
    documentsItemResolved: true, reviewItemResolved: true, hasProviderNotes: true,
  });
  assert.deepEqual(deriveCateringCloseout(withPrivateWork, "customer"), deriveCateringCloseout(base, "customer"));
});

test("mayCloseOut is false for a customer under every circumstance", () => {
  const ready = facts({ unresolvedRequiredItemCount: 0, resolvedItemCount: 7 });
  assert.equal(deriveCateringCloseout(ready, "provider").mayCloseOut, true);
  assert.equal(deriveCateringCloseout(ready, "customer").mayCloseOut, false);
});

test("blockers are exactly the blocked signals, so the two can never disagree", () => {
  const view = deriveCateringCloseout(facts({ unresolvedRequiredItemCount: 1, outstandingEquipmentCount: 2 }), "provider");
  assert.deepEqual(view.blockers, view.signals.filter((signal) => signal.state === "blocked"));
  assert.ok(view.blockers.length > 0);
});

/* ----------------------------------------------------------------------------------------------------------- *
 * Paths
 * ----------------------------------------------------------------------------------------------------------- */

test("rebooking points at the existing provider page and carries nothing from the booking", () => {
  const path = cateringProviderProfilePath("provider-1");
  assert.equal(path, "/services/catering/provider/provider-1");
  for (const leaked of ["date", "guest", "price", "package", "booking", "menu", "deposit"]) {
    assert.equal(path.includes(leaked), false, `${leaked} must not travel with a rebooking link`);
  }
});

test("closeout and communication paths are the existing workspace sections for the actor's own role", () => {
  assert.equal(cateringCloseoutSectionPath("provider", "b1"), "/services/catering/provider/bookings/b1#closeout");
  assert.equal(cateringCloseoutSectionPath("customer", "b1"), "/services/catering/bookings/b1#closeout");
  assert.equal(cateringCloseoutCommunicationPath("customer", "b1"), "/services/catering/bookings/b1#communication");
});
