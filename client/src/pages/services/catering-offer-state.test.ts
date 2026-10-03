import assert from "node:assert/strict";
import test from "node:test";
import { cateringOfferRevisionKey } from "@shared/catering-offers";
import {
  CateringOfferRequestError, cateringOfferInvalidationKeys, isCurrentOfferTarget, newCateringClientRequestId, offerAuthorLabel, offerDraftFromNegotiation,
  validateChangeRequestMessage, validateOfferDraft,
} from "./catering-offer-state";

const keyText = (keys: readonly (readonly string[])[]) => keys.map((key) => key.join("/"));

test("offer cache keys are scoped to the acting user AND the booking, so an account switch can never read another's offer", () => {
  assert.deepEqual(cateringOfferRevisionKey("u1", "b1"), ["catering", "offer", "u1", "b1"]);
  assert.notDeepEqual(cateringOfferRevisionKey("u1", "b1"), cateringOfferRevisionKey("u2", "b1"));
  assert.notDeepEqual(cateringOfferRevisionKey("u1", "b1"), cateringOfferRevisionKey("u1", "b2"));
});

test("a provider revision refreshes this booking's offer, the booking lists and the provider projections, and nothing global", () => {
  const keys = keyText(cateringOfferInvalidationKeys({ surfaceUserId: "prov", providerId: "prov", bookingId: "b1", action: "revise" }));
  assert.deepEqual(keys, ["catering/offer/prov/b1", "catering/booking-workspace/prov/b1", "catering/bookings/prov", "catering/inquiries/prov", "catering/dashboard/prov"]);
  assert.ok(keys.every((key) => key.startsWith("catering/")), "every key is namespaced; no empty key that would match the whole cache");
});

test("a customer's change request touches only their own surfaces and the provider's lists, never their request list", () => {
  const keys = keyText(cateringOfferInvalidationKeys({ surfaceUserId: "cust", providerId: "prov", bookingId: "b1", action: "request-changes" }));
  assert.ok(keys.includes("catering/offer/cust/b1") && keys.includes("catering/bookings/prov"));
  assert.equal(keys.some((key) => key.startsWith("catering/inquiries/customer")), false);
  assert.equal(keys.some((key) => key.includes("other")), false);
});

test("an acceptance or a decline also refreshes the customer's own request list, because its stage derives from the booking", () => {
  for (const action of ["accept", "decline"] as const) {
    const keys = keyText(cateringOfferInvalidationKeys({ surfaceUserId: "cust", providerId: "prov", bookingId: "b1", action }));
    assert.ok(keys.includes("catering/inquiries/customer/cust"), action);
    assert.equal(keys.filter((key, index) => keys.indexOf(key) !== index).length, 0, "no duplicate invalidations");
  }
});

test("without a known provider only the actor's own keys are named", () => {
  const keys = keyText(cateringOfferInvalidationKeys({ surfaceUserId: "cust", providerId: null, bookingId: "b1", action: "revise" }));
  assert.deepEqual(keys, ["catering/offer/cust/b1", "catering/booking-workspace/cust/b1", "catering/bookings/cust"]);
});

test("a response is shown only for the user and booking it was sent for", () => {
  assert.equal(isCurrentOfferTarget({ userId: "u1", bookingId: "b1" }, { userId: "u1", bookingId: "b1" }), true);
  assert.equal(isCurrentOfferTarget({ userId: "u2", bookingId: "b1" }, { userId: "u1", bookingId: "b1" }), false, "account switched");
  assert.equal(isCurrentOfferTarget({ userId: "u1", bookingId: "b2" }, { userId: "u1", bookingId: "b1" }), false, "navigated to another booking");
});

test("a 409 with an offer-moved code is a conflict to re-read; any other failure is an ordinary error", () => {
  assert.equal(new CateringOfferRequestError("m", 409, "stale_revision").isConflict, true);
  assert.equal(new CateringOfferRequestError("m", 409, "negotiation_closed").isConflict, true);
  assert.equal(new CateringOfferRequestError("m", 409, "revision_limit").isConflict, false);
  assert.equal(new CateringOfferRequestError("m", 500, "stale_revision").isConflict, false);
  assert.equal(new CateringOfferRequestError("m", 409, null).isConflict, false);
});

test("a request id is a fresh uuid every time, so a new submission is never mistaken for a retry", () => {
  const ids = new Set(Array.from({ length: 50 }, newCateringClientRequestId));
  assert.equal(ids.size, 50);
  for (const id of ids) assert.match(id, /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
});

test("the price field is parsed from text to cents once, with no float, and rejects what is not money", () => {
  const ok = (price: string) => { const r = validateOfferDraft({ price, guestCount: "", note: "" }); assert.equal(r.ok, true, price); return r.ok ? r.terms.priceCents : undefined; };
  assert.equal(ok("1250"), 125000);
  assert.equal(ok("1250.5"), 125050);
  assert.equal(ok("$1,250.50"), 125050);
  assert.equal(ok("0"), 0);
  assert.equal(ok(""), null);
  assert.equal(ok("0.07"), 7);
  assert.equal(ok("99999999.99"), 9_999_999_999);
  for (const bad of ["abc", "-5", "1.234", "1e3", "100000000", "1,2,3x", "12.", ".5"]) {
    const r = validateOfferDraft({ price: bad, guestCount: "", note: "" });
    assert.equal(r.ok, false, bad);
    if (!r.ok) assert.ok(r.errors.price);
  }
});

test("guest count and note are validated before anything is sent", () => {
  assert.equal(validateOfferDraft({ price: "", guestCount: "40", note: "  hello  " }).ok, true);
  const good = validateOfferDraft({ price: "", guestCount: "40", note: "  hello  " });
  assert.deepEqual(good.ok && good.terms, { priceCents: null, guestCount: 40, note: "hello", currency: "USD" });
  for (const bad of ["0", "-3", "2.5", "forty", "100001"]) {
    const r = validateOfferDraft({ price: "", guestCount: bad, note: "" });
    assert.equal(r.ok, false, bad);
  }
  const long = validateOfferDraft({ price: "", guestCount: "", note: "x".repeat(2001) });
  assert.equal(long.ok, false);
  assert.equal(validateOfferDraft({ price: "", guestCount: "", note: "" }).ok && true, true, "an empty offer is a valid offer");
});

test("a change request message is required and bounded", () => {
  assert.equal(validateChangeRequestMessage("Please lower it"), null);
  assert.ok(validateChangeRequestMessage("   "));
  assert.ok(validateChangeRequestMessage("x".repeat(2001)));
});

test("a revision form starts from what is currently offered, so a revision changes only what the provider changes", () => {
  const revisions = [{ id: "r2", priceCents: 123456, guestCount: 55, note: "Includes dessert" }, { id: "r1", priceCents: 1, guestCount: 1, note: "old" }] as never;
  assert.deepEqual(offerDraftFromNegotiation({ legacy: false, legacyTerms: null, revisions, currentRevisionId: "r2" }), { price: "1234.56", guestCount: "55", note: "Includes dessert" });
  assert.deepEqual(offerDraftFromNegotiation({ legacy: true, legacyTerms: { priceCents: 120000, currency: "USD", guestCount: 40, offeredAt: null }, revisions: [], currentRevisionId: null }), { price: "1200.00", guestCount: "40", note: "" });
  assert.deepEqual(offerDraftFromNegotiation({ legacy: true, legacyTerms: { priceCents: null, currency: "USD", guestCount: null, offeredAt: null }, revisions: [], currentRevisionId: null }), { price: "", guestCount: "", note: "" });
  assert.equal(offerDraftFromNegotiation({ legacy: false, legacyTerms: null, revisions: [{ id: "r", priceCents: 5, guestCount: null, note: null }] as never, currentRevisionId: "r" }).price, "0.05");
});

test("authors are labelled relative to the viewer", () => {
  assert.equal(offerAuthorLabel("provider", "provider"), "You");
  assert.equal(offerAuthorLabel("provider", "customer"), "Caterer");
  assert.equal(offerAuthorLabel("customer", "provider"), "Customer");
  assert.equal(offerAuthorLabel("customer", "customer"), "You");
});
