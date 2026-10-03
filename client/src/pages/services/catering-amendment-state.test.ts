import assert from "node:assert/strict";
import test from "node:test";
import { amendmentDraftFromTerms, buildAmendmentProposal, cateringAmendmentInvalidationKeys, CateringAmendmentRequestError } from "./catering-amendment-state";

const current = { eventDate: "2099-10-10", guestCount: 100, priceCents: 250000, currency: "USD", termsNote: "Buffet" };
const open = { billingTermsLocked: false };

test("an untouched draft proposes nothing, and only edited terms are sent", () => {
  const draft = amendmentDraftFromTerms(current);
  assert.deepEqual(buildAmendmentProposal(draft, current, open), { ok: false, errors: { form: "Change at least one term to propose an amendment." } });
  const edited = buildAmendmentProposal({ ...draft, guestCount: "125", price: "$2,900.50", message: " bigger " }, current, open);
  assert.deepEqual(edited, { ok: true, body: { guestCount: 125, priceCents: 290050, message: "bigger" } });
});

test("a blank guest count, price or description is an explicit clear, never an omission", () => {
  const draft = amendmentDraftFromTerms(current);
  assert.deepEqual(buildAmendmentProposal({ ...draft, guestCount: "", price: "", termsNote: "  " }, current, open), { ok: true, body: { guestCount: null, priceCents: null, termsNote: null } });
  const empty = { ...current, guestCount: null, priceCents: null, termsNote: null };
  assert.equal(buildAmendmentProposal(amendmentDraftFromTerms(empty), empty, open).ok, false, "blank over blank is not a change");
});

test("bad input is explained field by field, money never goes through a float, and a locked price is refused up front", () => {
  const draft = amendmentDraftFromTerms(current);
  const bad = buildAmendmentProposal({ ...draft, eventDate: "2099-02-31", guestCount: "0", price: "12.345" }, current, open);
  assert.equal(bad.ok, false);
  if (!bad.ok) assert.deepEqual(Object.keys(bad.errors).sort(), ["eventDate", "guestCount", "price"]);
  const locked = buildAmendmentProposal({ ...draft, price: "2900", guestCount: "110" }, current, { billingTermsLocked: true });
  assert.equal(locked.ok, false);
  const stillLegal = buildAmendmentProposal({ ...draft, guestCount: "110" }, current, { billingTermsLocked: true });
  assert.deepEqual(stillLegal, { ok: true, body: { guestCount: 110 } });
});

test("errors classify into stale-state conflicts and in-place refusals, and only an accepted amendment refreshes billing", () => {
  assert.equal(new CateringAmendmentRequestError("x", 409, "stale_terms").isConflict, true);
  assert.equal(new CateringAmendmentRequestError("x", 409, "billing_terms_locked").isConflict, false);
  assert.equal(new CateringAmendmentRequestError("x", 409, "billing_terms_locked").isRefusal, true);
  assert.equal(new CateringAmendmentRequestError("x", 500, "stale_terms").isConflict, false);
  const accept = cateringAmendmentInvalidationKeys({ surfaceUserId: "u1", bookingId: "b1", action: "accept" }).map((k) => k.join("/"));
  const decline = cateringAmendmentInvalidationKeys({ surfaceUserId: "u1", bookingId: "b1", action: "decline" }).map((k) => k.join("/"));
  assert.equal(accept.some((k) => k.includes("booking-billing")), true);
  assert.equal(decline.some((k) => k.includes("booking-billing")), false);
  assert.equal(accept.every((k) => k.includes("u1")), true);
});
