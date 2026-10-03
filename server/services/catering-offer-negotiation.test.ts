import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { CateringBooking, CateringOfferRevision } from "@shared/schema";
import {
  acceptanceRetryContradictsAccepted, bookingPriceCents, bookingTermsFromRevision, buildCateringOfferNegotiationView, currentCateringOffer, hasPendingCateringChangeRequest,
  resolveCateringOfferAcceptance,
} from "./catering-offer-negotiation";

const here = path.dirname(fileURLToPath(import.meta.url));
const read = (relative: string) => fs.readFileSync(path.join(here, relative), "utf8");
const T = new Date("2099-01-01T00:00:00Z");
let n = 0;
const revision = (over: Partial<CateringOfferRevision>): CateringOfferRevision => ({
  id: `rev-${++n}`, bookingId: "b1", revisionNumber: n, kind: "offer", proposedByUserId: "SECRET-USER-ID", proposedByRole: "provider", clientRequestId: "SECRET-REQUEST-KEY",
  respondsToRevisionId: null, priceCents: 100000, currency: "USD", guestCount: 40, note: null, acceptedAt: null, createdAt: T, ...over,
});
const booking = (over: Partial<CateringBooking> = {}) => ({ id: "b1", status: "pending_confirmation", customerConfirmedAt: null, providerConfirmedAt: T, agreedPrice: "1000.00", currency: "USD", guestCount: 40, cancellationReason: "SECRET-REASON", ...over }) as CateringBooking;

test("the current offer is the highest-numbered OFFER, so a customer's change request never becomes one and there can only be one", () => {
  const one = revision({ revisionNumber: 1 });
  const ask = revision({ revisionNumber: 2, kind: "change_request", proposedByRole: "customer", priceCents: null, guestCount: null, note: "lower?", respondsToRevisionId: one.id });
  const two = revision({ revisionNumber: 3 });
  assert.equal(currentCateringOffer([]), null);
  assert.equal(currentCateringOffer([ask]), null);
  assert.equal(currentCateringOffer([one, ask])?.id, one.id);
  assert.equal(currentCateringOffer([one, ask, two])?.id, two.id);
});

test("a change request is pending only while it is the last word", () => {
  const one = revision({ revisionNumber: 1 });
  const ask = revision({ revisionNumber: 2, kind: "change_request", proposedByRole: "customer" });
  assert.equal(hasPendingCateringChangeRequest([]), false);
  assert.equal(hasPendingCateringChangeRequest([one]), false);
  assert.equal(hasPendingCateringChangeRequest([one, ask]), true);
  assert.equal(hasPendingCateringChangeRequest([one, ask, revision({ revisionNumber: 3 })]), false);
});

test("acceptance resolves only against the current revision, or against none for a legacy offer", () => {
  const one = revision({ revisionNumber: 1 });
  const two = revision({ revisionNumber: 2 });
  assert.deepEqual(resolveCateringOfferAcceptance([], null), { kind: "ok", revision: null });
  assert.deepEqual(resolveCateringOfferAcceptance([one, two], two.id), { kind: "ok", revision: two });
  const stale = resolveCateringOfferAcceptance([one, two], one.id);
  assert.deepEqual([stale.kind, stale.kind === "refused" && stale.status, stale.kind === "refused" && stale.code], ["refused", 409, "stale_revision"]);
  const missing = resolveCateringOfferAcceptance([one], null);
  assert.deepEqual([missing.kind, missing.kind === "refused" && missing.code], ["refused", "offer_revision_required"]);
  const ghost = resolveCateringOfferAcceptance([], "some-id");
  assert.deepEqual([ghost.kind, ghost.kind === "refused" && ghost.code], ["refused", "stale_revision"]);
});

test("a retried acceptance contradicts the record only if it names a different revision than the accepted one", () => {
  const one = revision({ revisionNumber: 1, acceptedAt: T });
  assert.equal(acceptanceRetryContradictsAccepted([one], one.id), false);
  assert.equal(acceptanceRetryContradictsAccepted([one], "other"), true);
  assert.equal(acceptanceRetryContradictsAccepted([one], undefined), false);
  assert.equal(acceptanceRetryContradictsAccepted([one], null), false);
  assert.equal(acceptanceRetryContradictsAccepted([revision({})], "x"), false);
});

test("booking terms are derived from cents exactly, and absence stays absence", () => {
  assert.deepEqual(bookingTermsFromRevision({ priceCents: 123456, guestCount: 7, currency: "USD" }), { agreedPrice: "1234.56", guestCount: 7, currency: "USD" });
  assert.deepEqual(bookingTermsFromRevision({ priceCents: 0, guestCount: null, currency: "EUR" }), { agreedPrice: "0.00", guestCount: null, currency: "EUR" });
  assert.equal(bookingTermsFromRevision({ priceCents: null, guestCount: null, currency: "USD" }).agreedPrice, null);
  assert.equal(bookingPriceCents({ agreedPrice: "1200.00" }), 120000);
  assert.equal(bookingPriceCents({ agreedPrice: null }), null);
  assert.equal(bookingPriceCents({ agreedPrice: "0.00" }), 0);
});

test("the negotiation view exposes neither user ids, retry keys nor the booking's private columns", () => {
  const one = revision({ revisionNumber: 1 });
  const two = revision({ revisionNumber: 2 });
  for (const role of ["provider", "customer"] as const) {
    const text = JSON.stringify(buildCateringOfferNegotiationView(booking(), role, [one, two]));
    assert.doesNotMatch(text, /SECRET-/);
    assert.doesNotMatch(text, /proposedByUserId|clientRequestId|cancellationReason/);
  }
});

test("a legacy offer shows the booking's own terms and invents no history", () => {
  const view = buildCateringOfferNegotiationView(booking(), "customer", []);
  assert.deepEqual([view.legacy, view.currentRevisionId, view.revisions], [true, null, []]);
  assert.deepEqual(view.legacyTerms, { priceCents: 100000, currency: "USD", guestCount: 40, offeredAt: T.toISOString() });
  assert.equal(view.actions.canAccept, true);
});

test("once revisions exist the view is revision-led, newest first, with exactly one current", () => {
  const one = revision({ revisionNumber: 1 });
  const two = revision({ revisionNumber: 2 });
  const view = buildCateringOfferNegotiationView(booking(), "provider", [one, two]);
  assert.deepEqual([view.legacy, view.legacyTerms, view.currentRevisionId], [false, null, two.id]);
  assert.deepEqual(view.revisions.map((row) => [row.revisionNumber, row.isCurrent]), [[2, true], [1, false]]);
});

test("an accepted or cancelled negotiation is read-only for both sides", () => {
  const one = revision({ revisionNumber: 1, acceptedAt: T });
  for (const status of ["confirmed", "completed", "cancelled"]) {
    for (const role of ["provider", "customer"] as const) {
      const view = buildCateringOfferNegotiationView(booking({ status, customerConfirmedAt: T }), role, [one]);
      assert.deepEqual(Object.values(view.actions), [false, false, false, false], `${role}/${status}`);
    }
  }
  assert.equal(buildCateringOfferNegotiationView(booking({ status: "confirmed" }), "customer", [one]).state, "accepted");
  assert.equal(buildCateringOfferNegotiationView(booking({ status: "cancelled" }), "customer", [one]).state, "closed");
});

test("structure: every negotiation write takes the booking row lock before it judges anything", () => {
  const service = read("catering-offer-negotiation.ts");
  assert.match(service, /\.limit\(1\)\.for\("update"\)/);
  for (const fn of ["createProviderOfferRevision", "createCustomerChangeRequest"]) {
    const body = service.slice(service.indexOf(`export async function ${fn}`));
    assert.ok(body.indexOf("lockCateringBookingForNegotiation(tx") < body.indexOf("listCateringOfferRevisions(tx"), `${fn} locks first`);
    assert.ok(body.indexOf("listCateringOfferRevisions(tx") < body.indexOf("insertRevision("), `${fn} judges before it writes`);
  }
  const route = read("../routes/catering-bookings.ts");
  const confirm = route.slice(route.indexOf('"/bookings/:id/customer-confirm"'), route.indexOf('"/bookings/:id/cancel"'));
  assert.match(confirm, /\.limit\(1\)\.for\("update"\)/);
  assert.ok(confirm.indexOf('.for("update")') < confirm.indexOf("resolveCateringOfferAcceptance("));
  assert.ok(confirm.indexOf("resolveCateringOfferAcceptance(") < confirm.indexOf("tx.update(cateringBookings)"));
  assert.ok(confirm.indexOf("tx.update(cateringBookings)") < confirm.indexOf("stampCateringOfferAccepted("));
  assert.match(confirm, /\.\.\.terms, customerConfirmedAt: now, status: nextStatus/, "terms and confirmation are one statement");
});

test("structure: the negotiation router derives identity from the session and never from the request", () => {
  const route = read("../routes/catering-booking-offers.ts");
  assert.equal((route.match(/requireAuth/g) ?? []).length >= 4, true);
  assert.doesNotMatch(route, /req\.body\.(userId|providerId|customerId|actorRole)|req\.query/);
  assert.match(route, /\(req\.user as \{ id: string \}\)\.id/);
  assert.match(route, /\.catch\(\(\) => undefined\)/, "a failed notification never undoes the transition");
  assert.ok(route.indexOf("db.transaction") < route.indexOf("db.insert(notifications)"), "notified only after the transaction committed");
});
