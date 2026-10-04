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

test("bad input is explained field by field, money never goes through a float, and once billing exists only a stated price-to-price change or a non-money change is legal", () => {
  const draft = amendmentDraftFromTerms(current);
  const bad = buildAmendmentProposal({ ...draft, eventDate: "2099-02-31", guestCount: "0", price: "12.345" }, current, open);
  assert.equal(bad.ok, false);
  if (!bad.ok) assert.deepEqual(Object.keys(bad.errors).sort(), ["eventDate", "guestCount", "price"]);
  // Phase 2P: with billing live, a change between two stated prices is legal (the server records the difference as a charge or credit).
  const repriced = buildAmendmentProposal({ ...draft, price: "2900", guestCount: "110" }, current, { billingTermsLocked: true });
  assert.deepEqual(repriced, { ok: true, body: { priceCents: 290000, guestCount: 110 } });
  const cleared = buildAmendmentProposal({ ...draft, price: "" }, current, { billingTermsLocked: true });
  assert.equal(cleared.ok, false, "clearing the price leaves no stated difference to record");
  const recurrency = buildAmendmentProposal({ ...draft, currency: "EUR" }, current, { billingTermsLocked: true });
  assert.equal(recurrency.ok, false, "no conversion exists, so the currency stays locked");
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

test("the draft carries the current currency, and an unchanged currency is never sent", () => {
  const draft = amendmentDraftFromTerms(current);
  assert.equal(draft.currency, "USD");
  const guestOnly = buildAmendmentProposal({ ...draft, guestCount: "110" }, current, open);
  assert.deepEqual(guestOnly, { ok: true, body: { guestCount: 110 } });
  assert.equal(buildAmendmentProposal({ ...draft, currency: " usd " }, current, open).ok, false, "the canonical form equals the current one: nothing changed");
});

test("price-only, currency-only, price+currency and neither", () => {
  const draft = amendmentDraftFromTerms(current);
  assert.deepEqual(buildAmendmentProposal({ ...draft, price: "2900" }, current, open), { ok: true, body: { priceCents: 290000 } });
  assert.deepEqual(buildAmendmentProposal({ ...draft, currency: "eur" }, current, open), { ok: true, body: { currency: "EUR" } }, "no price is demanded for a currency change");
  assert.deepEqual(buildAmendmentProposal({ ...draft, price: "2900", currency: "EUR" }, current, open), { ok: true, body: { priceCents: 290000, currency: "EUR" } });
  assert.equal(buildAmendmentProposal(draft, current, open).ok, false);
  const unpriced = { ...current, priceCents: null };
  assert.deepEqual(buildAmendmentProposal({ ...amendmentDraftFromTerms(unpriced), currency: "EUR" }, unpriced, open), { ok: true, body: { currency: "EUR" } }, "a currency-only change on an unpriced booking is a real change");
});

test("currency is validated against the server pattern and locked once billing has started", () => {
  const draft = amendmentDraftFromTerms(current);
  for (const bad of ["EU", "EURO", "E1R", ""]) {
    const result = buildAmendmentProposal({ ...draft, currency: bad }, current, open);
    assert.equal(result.ok, false, bad);
    if (!result.ok) assert.ok(result.errors.currency, bad);
  }
  const locked = buildAmendmentProposal({ ...draft, currency: "EUR" }, current, { billingTermsLocked: true });
  assert.deepEqual(locked.ok === false && Object.keys(locked.errors), ["currency"]);
  assert.match(locked.ok === false ? locked.errors.currency ?? "" : "", /Billing has started/);
  assert.equal(buildAmendmentProposal({ ...draft, currency: "USD", guestCount: "105" }, current, { billingTermsLocked: true }).ok, true, "an untouched currency never trips the lock");
});
