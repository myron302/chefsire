import assert from "node:assert/strict";
import test from "node:test";
import { cateringCloseoutFacts, type CateringCloseoutSourceRows } from "./catering-booking-closeout-policy";
import { deriveCateringCloseout } from "@shared/catering-booking-closeout";
import { serializeCloseoutRecord, serializeCustomerCloseoutReview } from "../serializers/catering-booking-closeout";

/**
 * The Phase 2K privacy boundary, asserted end to end over the CUSTOMER's whole payload rather than field by field.
 *
 * The question this suite answers is the one Phase 2J learned the hard way: not "is the private thing absent", but
 * "can the private thing be INFERRED". So each test builds the entire customer-facing payload from a set of source
 * rows, changes a provider-private fact, rebuilds it, and asserts the two are byte-identical. A leak through a
 * count, a timestamp, a version, an ordering, a readiness value or the wording of a detail would show up here even
 * though no private field is named anywhere in it.
 */

const SERVED = { status: "completed" as const, completedAt: new Date("2026-09-01T18:00:00.000Z") };
const NOW = new Date("2026-09-05T10:00:00.000Z");
const EARLIER = new Date("2026-09-04T09:00:00.000Z");

const rows = (patch: Partial<CateringCloseoutSourceRows> = {}): CateringCloseoutSourceRows => ({
  booking: SERVED,
  // Always overridden by `customerPayload`, which passes the record whose fields it is varying explicitly.
  record: undefined,
  equipment: [{ visibility: "shared", status: "returned" }],
  items: [],
  outstandingSharedRequirementCount: 1,
  sharedDocumentCount: 2,
  customerReviewExists: false,
  ...patch,
});

const closeoutRecordRow = (patch: Record<string, unknown> = {}) => ({
  bookingId: "b1", providerNotes: null, closedOutAt: null, closedOutBy: null,
  reopenCount: 0, lastReopenedAt: null, lastReopenedBy: null, updatedBy: null,
  createdAt: EARLIER, updatedAt: EARLIER, ...patch,
}) as never;

/** The complete customer-facing payload, built exactly as the route builds it. */
function customerPayload(source: CateringCloseoutSourceRows, record: ReturnType<typeof closeoutRecordRow>) {
  const facts = cateringCloseoutFacts({ ...source, record: record as never }, "customer");
  return JSON.stringify({
    closeout: serializeCloseoutRecord(record, "customer"),
    readiness: deriveCateringCloseout(facts, "customer"),
    customerReview: serializeCustomerCloseoutReview({ mayReview: true, alreadyReviewed: source.customerReviewExists, providerId: "provider-1" }),
  });
}

test("a provider writing private post-event notes changes nothing a customer receives", () => {
  const source = rows();
  const before = customerPayload(source, closeoutRecordRow());
  // The note is written, so the record's own version moves too -- which is exactly the channel a serialized
  // `updatedAt` would have opened. The customer's projection carries no version at all.
  const after = customerPayload(source, closeoutRecordRow({ providerNotes: "the kitchen was tiny", updatedAt: NOW, updatedBy: "provider-1" }));
  assert.equal(after, before);
});

test("recording an internal incident changes nothing a customer receives", () => {
  const before = customerPayload(rows(), closeoutRecordRow());
  const after = customerPayload(rows({
    items: [{ itemKey: "incident_follow_up_resolved", state: "pending" }],
  }), closeoutRecordRow());
  assert.equal(after, before);
  // Not even that one exists: no `incidentCount`, no array length, no blocker, no wording.
  assert.equal(before.includes("incident"), false);
});

test("resolving every checklist item changes nothing a customer receives", () => {
  const before = customerPayload(rows(), closeoutRecordRow());
  const after = customerPayload(rows({
    items: [
      { itemKey: "equipment_return_confirmed", state: "completed" },
      { itemKey: "final_documents_delivered", state: "completed" },
      { itemKey: "customer_follow_up_completed", state: "completed" },
      { itemKey: "internal_event_notes_completed", state: "completed" },
      { itemKey: "review_request_handled", state: "not_applicable" },
      { itemKey: "incident_follow_up_resolved", state: "not_applicable" },
      { itemKey: "final_admin_review_completed", state: "completed" },
    ],
  }), closeoutRecordRow());
  assert.equal(after, before);
});

test("a provider-private equipment record changes nothing a customer receives", () => {
  const before = customerPayload(rows(), closeoutRecordRow());
  const after = customerPayload(rows({
    equipment: [
      { visibility: "shared", status: "returned" },
      // Three private rentals, one of them still out. A customer must not learn any of that -- not through a
      // count, not by their own state flipping to blocked, not through the wording of a detail.
      { visibility: "provider_private", status: "in_use" },
      { visibility: "provider_private", status: "planned" },
      { visibility: "provider_private", status: "cancelled" },
    ],
  }), closeoutRecordRow());
  assert.equal(after, before);
});

test("a shared equipment record legitimately DOES change what a customer receives", () => {
  // The counterfactual, so the assertions above are not merely testing that nothing ever changes.
  const before = customerPayload(rows(), closeoutRecordRow());
  const after = customerPayload(rows({ equipment: [{ visibility: "shared", status: "in_use" }] }), closeoutRecordRow());
  assert.notEqual(after, before);
  assert.ok(after.includes("blocked"), "an outstanding shared rental is a customer's business");
});

test("the customer's own facts legitimately change what they receive", () => {
  assert.notEqual(
    customerPayload(rows({ outstandingSharedRequirementCount: 0 }), closeoutRecordRow()),
    customerPayload(rows({ outstandingSharedRequirementCount: 3 }), closeoutRecordRow()),
  );
  assert.notEqual(
    customerPayload(rows({ customerReviewExists: true }), closeoutRecordRow()),
    customerPayload(rows({ customerReviewExists: false }), closeoutRecordRow()),
  );
});

test("closing out legitimately changes what a customer receives, and is the only closeout write that does", () => {
  const open = customerPayload(rows(), closeoutRecordRow());
  const closed = customerPayload(rows(), closeoutRecordRow({ closedOutAt: NOW, closedOutBy: "provider-1", updatedAt: NOW }));
  assert.notEqual(closed, open);
  assert.ok(closed.includes("closed_out"));
  // And even then, who closed it out never travels.
  assert.equal(closed.includes("provider-1") && closed.includes("closedOutBy"), false);
});

test("no customer payload contains a provider-only key name at all", () => {
  const payload = customerPayload(rows({
    items: [{ itemKey: "incident_follow_up_resolved", state: "pending" }],
    equipment: [{ visibility: "provider_private", status: "in_use" }],
  }), closeoutRecordRow({ providerNotes: "private", updatedAt: NOW }));
  for (const key of ["checklist", "providerNotes", "providerNote", "updatedAt", "resolvedBy", "closedOutBy", "lastReopenedBy", "unresolvedRequired", "equipmentItemResolved", "not_started", "ready_to_close"]) {
    assert.equal(payload.includes(key), false, `${key} must not appear in a customer payload`);
  }
});

test("a provider's own payload does legitimately carry all of it", () => {
  const facts = cateringCloseoutFacts(rows({
    items: [{ itemKey: "incident_follow_up_resolved", state: "pending" }],
    record: closeoutRecordRow({ providerNotes: "private" }) as never,
  }), "provider");
  assert.equal(facts.hasProviderNotes, true);
  assert.ok(facts.unresolvedRequiredItemCount > 0);
  const view = deriveCateringCloseout(facts, "provider");
  assert.ok(view.signals.some((signal) => signal.signal === "checklist"));
});
