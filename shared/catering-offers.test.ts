import assert from "node:assert/strict";
import test from "node:test";
import {
  CATERING_OFFER_HISTORY_LIMIT, CATERING_OFFER_PRICE_MAX_CENTS, cateringFirstOfferSchema, cateringOfferAcceptSchema, cateringOfferActions, cateringOfferChangeRequestSchema,
  cateringOfferNegotiationState, cateringOfferRevisionRequestSchema, describeCateringOfferChanges, dollarsToCents, formatCateringOfferMoney, isCateringOfferConflict,
} from "./catering-offers";

const ID = "11111111-1111-4111-8111-111111111111";

test("dollars become cents only when they are an exact two-decimal amount, never by rounding a float", () => {
  assert.equal(dollarsToCents(1250.5), 125050);
  assert.equal(dollarsToCents(0), 0);
  assert.equal(dollarsToCents(99_999_999.99), CATERING_OFFER_PRICE_MAX_CENTS);
  for (const bad of [0.1 + 0.2, 1.005, -1, Number.NaN, Number.POSITIVE_INFINITY, 100_000_000, 1e21]) assert.equal(dollarsToCents(bad), null, String(bad));
});

test("the first-offer body keeps the pre-2N dollar spelling, expresses everything as cents and refuses an ambiguous price", () => {
  assert.deepEqual(cateringFirstOfferSchema.parse({ agreedPrice: "1250.50", currency: "USD" }), { priceCents: 125050, guestCount: undefined, note: undefined, currency: "USD" });
  assert.deepEqual(cateringFirstOfferSchema.parse({}), { priceCents: null, guestCount: undefined, note: undefined, currency: "USD" });
  assert.equal(cateringFirstOfferSchema.parse({ priceCents: 0 }).priceCents, 0);
  assert.equal(cateringFirstOfferSchema.parse({ note: "   " }).note, undefined);
  for (const bad of [{ priceCents: 1.5 }, { priceCents: -1 }, { priceCents: CATERING_OFFER_PRICE_MAX_CENTS + 1 }, { agreedPrice: 0.30000000000000004 }, { agreedPrice: 5, priceCents: 500 }, { providerId: "x" }, { status: "confirmed" }, { guestCount: 0 }, { guestCount: 100_001 }, { currency: "usd" }]) {
    assert.equal(cateringFirstOfferSchema.safeParse(bad).success, false, JSON.stringify(bad));
  }
});

test("a revision names the revision it was written against and carries a retry key, and no actor", () => {
  const ok = { expectedRevisionId: ID, clientRequestId: ID, priceCents: 100 };
  assert.equal(cateringOfferRevisionRequestSchema.safeParse(ok).success, true);
  assert.equal(cateringOfferRevisionRequestSchema.safeParse({ ...ok, expectedRevisionId: null }).success, true, "null means a legacy offer with no revision");
  assert.equal(cateringOfferRevisionRequestSchema.safeParse({ priceCents: 1, clientRequestId: ID }).success, false, "the revision being edited must be named");
  assert.equal(cateringOfferRevisionRequestSchema.safeParse({ ...ok, clientRequestId: "x" }).success, false);
  for (const forged of [{ providerId: "p" }, { userId: "u" }, { actorRole: "provider" }, { proposedBy: "customer" }, { revisionNumber: 9 }]) {
    assert.equal(cateringOfferRevisionRequestSchema.safeParse({ ...ok, ...forged }).success, false, JSON.stringify(forged));
  }
});

test("a change request needs a message, a revision to answer and a retry key, and carries no terms of its own", () => {
  const ok = { revisionId: ID, message: "Lower the price please", clientRequestId: ID };
  assert.equal(cateringOfferChangeRequestSchema.safeParse(ok).success, true);
  assert.equal(cateringOfferChangeRequestSchema.safeParse({ ...ok, revisionId: null }).success, true);
  assert.equal(cateringOfferChangeRequestSchema.parse({ ...ok, message: "  hi  " }).message, "hi");
  for (const bad of [{ message: "   " }, { message: "x".repeat(2001) }, { priceCents: 1 }, { customerId: "c" }, { revisionId: "nope" }]) {
    assert.equal(cateringOfferChangeRequestSchema.safeParse({ ...ok, ...bad }).success, false, JSON.stringify(bad));
  }
});

test("acceptance names a revision or none, and nothing else", () => {
  assert.equal(cateringOfferAcceptSchema.safeParse({}).success, true);
  assert.equal(cateringOfferAcceptSchema.safeParse({ revisionId: null }).success, true);
  assert.equal(cateringOfferAcceptSchema.safeParse({ revisionId: ID }).success, true);
  assert.equal(cateringOfferAcceptSchema.safeParse({ revisionId: ID, customerId: "c" }).success, false);
  assert.equal(cateringOfferAcceptSchema.safeParse({ revisionId: "nope" }).success, false);
});

test("each side is offered exactly the actions the booking state allows", () => {
  const open = { bookingStatus: "pending_confirmation", customerConfirmedAt: false, changeRequestPending: false, historyFull: false };
  assert.deepEqual(cateringOfferActions({ ...open, role: "provider" }), { canRevise: true, canAccept: false, canRequestChanges: false, canDecline: false });
  assert.deepEqual(cateringOfferActions({ ...open, role: "customer" }), { canRevise: false, canAccept: true, canRequestChanges: true, canDecline: true });
  assert.equal(cateringOfferActions({ ...open, role: "customer", changeRequestPending: true }).canRequestChanges, false);
  assert.equal(cateringOfferActions({ ...open, role: "customer", changeRequestPending: true }).canAccept, true);
  assert.equal(cateringOfferActions({ ...open, role: "provider", historyFull: true }).canRevise, false);
  for (const status of ["confirmed", "cancelled", "completed"]) {
    for (const role of ["provider", "customer"] as const) assert.deepEqual(cateringOfferActions({ ...open, role, bookingStatus: status }), { canRevise: false, canAccept: false, canRequestChanges: false, canDecline: false }, `${role}/${status}`);
  }
  assert.equal(cateringOfferActions({ ...open, role: "customer", customerConfirmedAt: true }).canAccept, false);
});

test("the negotiation state is read from the booking, so a closed negotiation cannot look open", () => {
  assert.deepEqual(["pending_confirmation", "confirmed", "completed", "cancelled", "anything-else"].map(cateringOfferNegotiationState), ["open", "accepted", "accepted", "closed", "closed"]);
});

test("money renders from cents without a float and 'no price' is not zero", () => {
  assert.equal(formatCateringOfferMoney(125050, "USD"), "USD 1250.50");
  assert.equal(formatCateringOfferMoney(0, "USD"), "USD 0.00");
  assert.equal(formatCateringOfferMoney(5, "EUR"), "EUR 0.05");
  assert.equal(formatCateringOfferMoney(null, "USD"), "Not specified");
});

test("changes between two offers are described only where something changed", () => {
  const a = { priceCents: 150000, guestCount: 40, note: "Buffet", currency: "USD" };
  assert.deepEqual(describeCateringOfferChanges(null, a), []);
  assert.deepEqual(describeCateringOfferChanges(a, { ...a }), []);
  assert.deepEqual(describeCateringOfferChanges(a, { ...a, priceCents: 140000 }), ["Price: USD 1500.00 → USD 1400.00"]);
  assert.deepEqual(describeCateringOfferChanges(a, { ...a, guestCount: null, note: "Buffet + dessert" }), ["Guests: 40 → Not specified", "Terms description updated"]);
});

test("a stale-offer answer is recognised as a conflict, and an ordinary refusal is not", () => {
  for (const code of ["stale_revision", "offer_revision_required", "negotiation_closed", "change_request_pending"]) assert.equal(isCateringOfferConflict(code), true);
  for (const code of ["revision_limit", undefined, null, "other"]) assert.equal(isCateringOfferConflict(code), false);
  assert.equal(CATERING_OFFER_HISTORY_LIMIT, 50);
});
