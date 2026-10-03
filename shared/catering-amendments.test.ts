import assert from "node:assert/strict";
import test from "node:test";
import { cateringAmendmentActions, cateringAmendmentProposalSchema, describeCateringAmendmentChanges, formatCateringAmendmentMoney, isCateringAmendmentConflict, type CateringAmendmentTerms } from "./catering-amendments";

const REQUEST = { expectedBaseAmendmentId: null, clientRequestId: "6f1d3f0e-1c1e-4a55-9a58-0d7f5f3a9b11" };
const terms = (over: Partial<CateringAmendmentTerms> = {}): CateringAmendmentTerms => ({ eventDate: "2099-10-10", guestCount: 100, priceCents: 250000, currency: "USD", termsNote: null, ...over });

test("a proposal must name a real term, accepts explicit nulls, and rejects anything outside the allowlist", () => {
  assert.equal(cateringAmendmentProposalSchema.safeParse(REQUEST).success, false, "nothing to change");
  assert.equal(cateringAmendmentProposalSchema.safeParse({ ...REQUEST, message: "hi" }).success, false, "a message alone changes nothing");
  const cleared = cateringAmendmentProposalSchema.parse({ ...REQUEST, guestCount: null, priceCents: null, termsNote: "  " });
  assert.deepEqual([cleared.guestCount, cleared.priceCents, cleared.termsNote, cleared.eventDate], [null, null, null, undefined]);
  for (const forged of [{ providerId: "x" }, { status: "cancelled" }, { agreedPrice: 5 }, { packageId: "x" }, { bookingId: "x" }]) {
    assert.equal(cateringAmendmentProposalSchema.safeParse({ ...REQUEST, guestCount: 5, ...forged }).success, false, JSON.stringify(forged));
  }
  assert.equal(cateringAmendmentProposalSchema.safeParse({ ...REQUEST, priceCents: 10.5 }).success, false, "money is whole cents");
  assert.equal(cateringAmendmentProposalSchema.safeParse({ ...REQUEST, eventDate: "2099-02-31" }).success, false);
  assert.equal(cateringAmendmentProposalSchema.safeParse({ ...REQUEST, eventDate: "2099-02-28" }).success, true);
});

test("who may do what follows the booking state and who proposed", () => {
  const none = { role: "provider" as const, bookingStatus: "confirmed", pendingProposedBy: null, historyFull: false };
  assert.deepEqual(cateringAmendmentActions(none), { canPropose: true, canAccept: false, canDecline: false, canWithdraw: false });
  assert.deepEqual(cateringAmendmentActions({ ...none, pendingProposedBy: "provider" }), { canPropose: false, canAccept: false, canDecline: false, canWithdraw: true });
  assert.deepEqual(cateringAmendmentActions({ ...none, pendingProposedBy: "customer" }), { canPropose: false, canAccept: true, canDecline: true, canWithdraw: false });
  assert.equal(cateringAmendmentActions({ ...none, historyFull: true }).canPropose, false);
  for (const bookingStatus of ["pending_confirmation", "completed", "cancelled"]) {
    assert.deepEqual(cateringAmendmentActions({ ...none, bookingStatus, pendingProposedBy: "customer" }), { canPropose: false, canAccept: false, canDecline: false, canWithdraw: false }, bookingStatus);
  }
});

test("changes read OLD -> NEW for changed terms only, in words and not just colour", () => {
  const before = terms({ termsNote: "Buffet" });
  const changes = describeCateringAmendmentChanges({ changedFields: ["event_date", "guest_count", "price_cents"], before, after: terms({ eventDate: "2099-10-17", guestCount: 125, priceCents: 290000, termsNote: "ignored" }) });
  assert.deepEqual(changes.map((c) => [c.label, c.before, c.after]), [["Event date", "Oct 10, 2099", "Oct 17, 2099"], ["Guests", "100", "125"], ["Agreed price", "USD 2,500.00", "USD 2,900.00"]]);
  assert.deepEqual(describeCateringAmendmentChanges({ changedFields: ["guest_count"], before, after: terms({ guestCount: null, priceCents: 1 }) }).map((c) => [c.label, c.after]), [["Guests", "Not specified"]]);
  assert.equal(describeCateringAmendmentChanges({ changedFields: ["currency"], before, after: terms({ currency: "EUR" }) })[0].after, "EUR 2,500.00");
  assert.deepEqual(describeCateringAmendmentChanges({ changedFields: ["terms_note"], before, after: terms({ termsNote: null }) }).map((c) => [c.before, c.after]), [["Buffet", "None"]]);
  assert.equal(formatCateringAmendmentMoney(null, "USD"), "Not specified");
  assert.equal(formatCateringAmendmentMoney(5, "USD"), "USD 0.05");
});

test("only terms-moved conflicts tell the UI to show the newest state instead of retrying", () => {
  for (const code of ["amendment_closed", "amendment_pending", "amendment_not_pending", "stale_terms"]) assert.equal(isCateringAmendmentConflict(code), true);
  for (const code of ["billing_terms_locked", "date_unavailable", "no_change", undefined]) assert.equal(isCateringAmendmentConflict(code), false);
});
