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
  assert.deepEqual(describeCateringAmendmentChanges({ changedFields: ["terms_note"], before, after: terms({ termsNote: null }) }).map((c) => [c.before, c.after]), [["Buffet", "None"]]);
  assert.equal(formatCateringAmendmentMoney(null, "USD"), "Not specified");
  assert.equal(formatCateringAmendmentMoney(5, "USD"), "USD 0.05");
});

test("only terms-moved conflicts tell the UI to show the newest state instead of retrying", () => {
  for (const code of ["amendment_closed", "amendment_pending", "amendment_not_pending", "stale_terms"]) assert.equal(isCateringAmendmentConflict(code), true);
  for (const code of ["billing_terms_locked", "date_unavailable", "no_change", undefined]) assert.equal(isCateringAmendmentConflict(code), false);
});

const rows = (changedFields: Parameters<typeof describeCateringAmendmentChanges>[0]["changedFields"], before: CateringAmendmentTerms, after: CateringAmendmentTerms) =>
  describeCateringAmendmentChanges({ changedFields, before, after }).map((c) => `${c.label}: ${c.before} -> ${c.after}`);

test("a currency-only change with no price is still shown as the currency moving, never as 'Not specified -> Not specified'", () => {
  assert.deepEqual(rows(["currency"], terms({ priceCents: null }), terms({ priceCents: null, currency: "EUR" })), ["Currency: USD -> EUR"]);
});

test("a currency-only change under a stated price shows the same amount in the new currency AND the currency row", () => {
  assert.deepEqual(rows(["currency"], terms({ priceCents: 50000 }), terms({ priceCents: 50000, currency: "EUR" })), ["Agreed price: USD 500.00 -> EUR 500.00", "Currency: USD -> EUR"]);
});

test("a price-only change is one price row, in both directions through null", () => {
  assert.deepEqual(rows(["price_cents"], terms({ priceCents: 50000 }), terms({ priceCents: 60000 })), ["Agreed price: USD 500.00 -> USD 600.00"]);
  assert.deepEqual(rows(["price_cents"], terms({ priceCents: null }), terms({ priceCents: 50000 })), ["Agreed price: Not specified -> USD 500.00"]);
  assert.deepEqual(rows(["price_cents"], terms({ priceCents: 50000 }), terms({ priceCents: null })), ["Agreed price: USD 500.00 -> Not specified"]);
});

test("price and currency changing together are two distinct rows, with no duplicate", () => {
  assert.deepEqual(rows(["price_cents", "currency"], terms({ priceCents: null }), terms({ priceCents: 50000, currency: "EUR" })), ["Agreed price: Not specified -> EUR 500.00", "Currency: USD -> EUR"]);
  assert.deepEqual(rows(["price_cents", "currency"], terms({ priceCents: 50000 }), terms({ priceCents: 60000, currency: "EUR" })), ["Agreed price: USD 500.00 -> EUR 600.00", "Currency: USD -> EUR"]);
});

test("unchanged null price and unchanged currency emit nothing, and every listed field is visible", () => {
  assert.deepEqual(rows(["guest_count"], terms({ priceCents: null }), terms({ priceCents: null, guestCount: 5 })), ["Guests: 100 -> 5"]);
  const all = rows(["event_date", "guest_count", "price_cents", "currency", "terms_note"], terms(), terms({ eventDate: "2099-10-11", guestCount: 1, priceCents: 1, currency: "EUR", termsNote: "x" }));
  assert.equal(all.length, 5);
});

test("the currency contract is the server's three-letter pattern, and a lowercase or long code is refused", () => {
  assert.equal(cateringAmendmentProposalSchema.safeParse({ ...REQUEST, currency: "EUR" }).success, true);
  for (const bad of ["eur", "EURO", "E", "E1R"]) assert.equal(cateringAmendmentProposalSchema.safeParse({ ...REQUEST, currency: bad }).success, false, bad);
});
