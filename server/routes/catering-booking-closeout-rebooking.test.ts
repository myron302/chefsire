import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { cateringProviderProfilePath, type CateringBookingCloseoutView } from "@shared/catering-booking-closeout";
import { reviewEligibility } from "../services/catering-review-policy";

/**
 * A rebooking CTA is only truthful while the page it points at exists.
 *
 * `GET /providers/:id` answers 410 PROVIDER_UNAVAILABLE for a provider whose catering listing is switched off, so
 * advertising a path to it renders a control that lands on an error. The closeout route already holds the
 * authoritative listing state -- it fetches it for the customer's review eligibility -- so the truthful place to
 * decide this is the payload, not an interface guessing at it.
 *
 * The key is OMITTED rather than nulled, exactly as every other unavailable Phase 2K key is, which is why the
 * client needed no change: its existing `{closeout.rebookPath && ...}` guard already hides the action.
 */
const here = path.dirname(fileURLToPath(import.meta.url));
const route = fs.readFileSync(path.join(here, "catering-booking-closeout.ts"), "utf8");
const providerRoute = fs.readFileSync(path.join(here, "catering.ts"), "utf8");
const component = fs.readFileSync(path.join(here, "..", "..", "client", "src", "components", "catering", "BookingCloseout.tsx"), "utf8");

/**
 * The customer branch of the payload, modelled exactly as the route builds it: a conditional spread gated on the
 * authoritative listing state.
 */
function customerPayload(providerEnabled: boolean, providerId = "provider-1"): Partial<CateringBookingCloseoutView> {
  const providerListed = Boolean(providerEnabled);
  return {
    customerReview: {
      mayReview: reviewEligibility({ reviewerId: "customer-1", providerId, providerEnabled }).allowed,
      alreadyReviewed: false,
      reviewPath: cateringProviderProfilePath(providerId),
    },
    ...(providerListed ? { rebookPath: cateringProviderProfilePath(providerId) } : {}),
  };
}

/* ----------------------------------------------------------------------------------------------------------- *
 * Payload behaviour
 * ----------------------------------------------------------------------------------------------------------- */

test("an enabled provider listing supplies a rebooking path", () => {
  const payload = customerPayload(true);
  assert.equal(payload.rebookPath, "/services/catering/provider/provider-1");
});

test("a disabled provider listing supplies no rebooking path at all", () => {
  const payload = customerPayload(false);
  // Absent, not null: the same "absent keys rather than empty values" rule every other optional Phase 2K key
  // follows, so the payload contract is unchanged and nothing has to interpret a null.
  assert.equal("rebookPath" in payload, false);
  assert.equal(payload.rebookPath, undefined);
});

test("the destination the route would have offered is the one that answers 410", () => {
  // The concrete reason this matters: the provider page refuses an unlisted provider outright.
  assert.ok(providerRoute.includes("PROVIDER_UNAVAILABLE"));
  assert.ok(providerRoute.includes("if (!provider.cateringEnabled) {"));
  assert.ok(providerRoute.includes('return res.status(410)'));
});

test("review eligibility was already gated on the same fact, which is the precedent this follows", () => {
  assert.equal(customerPayload(true).customerReview!.mayReview, true);
  assert.equal(customerPayload(false).customerReview!.mayReview, false);
  // And its CTA already hid itself, which is why only rebooking was broken.
  assert.equal(reviewEligibility({ reviewerId: "c", providerId: "p", providerEnabled: false }).allowed, false);
});

test("neither variant carries anything from the completed booking", () => {
  for (const enabled of [true, false]) {
    const serialized = JSON.stringify(customerPayload(enabled));
    for (const leaked of ["eventDate", "guestCount", "agreedPrice", "packageId", "bookingId", "status", "deposit", "menu"]) {
      assert.equal(serialized.includes(leaked), false, `${leaked} must never travel with a rebooking link`);
    }
  }
});

/* ----------------------------------------------------------------------------------------------------------- *
 * The route's own wiring
 * ----------------------------------------------------------------------------------------------------------- */

test("the listing state is read from the authoritative user row the route already fetches", () => {
  assert.ok(route.includes("const providerListed = !provider && Boolean(providerRows[0]?.enabled);"));
  assert.ok(route.includes("db.select({ enabled: users.cateringEnabled }).from(users).where(eq(users.id, booking.providerId))"));
  // No second query was added for it, and nothing is read from a request.
  assert.equal((route.match(/users\.cateringEnabled/g) ?? []).length, 1);
});

test("the rebooking key is conditional on that state, and appears nowhere else", () => {
  assert.ok(route.includes("...(providerListed ? { rebookPath: cateringProviderProfilePath(booking.providerId) } : {}),"));
  // Exactly one place can emit it, so there is no unguarded second path.
  assert.equal((route.match(/rebookPath/g) ?? []).length, 1);
});

test("the rebooking key stays customer-only: a provider's payload has neither it nor the listing query", () => {
  const read = route.slice(route.indexOf('r.get("/bookings/:id/closeout"'), route.indexOf('r.put("/bookings/:id/closeout/items/:itemKey"'));
  // The provider branch of the conditional spread carries the checklist and their review view, and nothing else.
  assert.ok(read.includes("{ checklist: serializeCloseoutChecklist(itemRows), providerReview: serializeProviderCloseoutReview(customerReviewExists) }"));
  // `providerListed` is false on a provider's request by construction, so it can never gate a key into their payload.
  assert.ok(route.includes("!provider && Boolean(providerRows[0]?.enabled)"));
  assert.ok(read.includes("provider ? Promise.resolve([]) : db.select({ enabled: users.cateringEnabled })"));
});

test("no booking state is cloned or mutated by any of this", () => {
  // The read is a read. Gating a link changed nothing about what this route writes, which is still nothing.
  const read = route.slice(route.indexOf('r.get("/bookings/:id/closeout"'), route.indexOf('r.put("/bookings/:id/closeout/items/:itemKey"'));
  for (const write of [".insert(", ".update(", ".delete("]) {
    assert.equal(read.includes(write), false, `the cohesive read must not ${write}`);
  }
});

/* ----------------------------------------------------------------------------------------------------------- *
 * The interface
 * ----------------------------------------------------------------------------------------------------------- */

test("the customer interface renders the CTA only when the payload supplies a path", () => {
  assert.ok(component.includes("{closeout.rebookPath && <Button asChild"));
  assert.ok(component.includes("<Link href={closeout.rebookPath}>Work with this caterer again</Link>"));
  // It never builds a provider path of its own, so it cannot route anywhere the server did not sanction.
  assert.equal(component.includes("cateringProviderProfilePath"), false);
  assert.equal(component.includes("/services/catering/provider/"), false);
});

test("the interface has no fallback that would offer rebooking anyway", () => {
  const follow = component.slice(component.indexOf('aria-labelledby="closeout-follow-up"'), component.indexOf('aria-labelledby="closeout-checklist"'));
  assert.equal(/rebook[^&]*\?\?/.test(follow), false, "no default is substituted for an absent path");
  assert.equal(follow.includes("Work with this caterer again") && follow.includes("closeout.rebookPath &&"), true);
});
