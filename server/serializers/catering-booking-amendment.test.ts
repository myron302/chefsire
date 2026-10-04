import assert from "node:assert/strict";
import test from "node:test";
import type { CateringBookingAmendment } from "@shared/schema";
import { serializeCateringAmendment } from "./catering-booking-amendment";

const T = new Date("2099-01-01T00:00:00Z");
const row = (over: Partial<CateringBookingAmendment> = {}): CateringBookingAmendment => ({
  id: "a1", bookingId: "SECRET-BOOKING", amendmentNumber: 1, proposedByUserId: "SECRET-USER", proposedByRole: "provider", clientRequestId: "SECRET-KEY", status: "pending", changedFields: ["guest_count"],
  baseAcceptedAmendmentId: null, baseEventDate: "2099-10-10", baseGuestCount: 100, basePriceCents: 250000, baseCurrency: "USD", baseTermsNote: "Buffet",
  eventDate: null, guestCount: 125, priceCents: null, currency: null, termsNote: null, message: "Bigger party", respondedByUserId: "SECRET-RESPONDER", respondedAt: null, createdAt: T, ...over,
});

test("the projection is built field by field and leaks no internal id, key or responder", () => {
  const view = serializeCateringAmendment(row());
  assert.equal(JSON.stringify(view).includes("SECRET"), false);
  assert.deepEqual(Object.keys(view).sort(), ["after", "amendmentNumber", "before", "changedFields", "createdAt", "id", "message", "proposedBy", "respondedAt", "status"]);
});

test("before is the frozen base and after applies only the changed fields; an unlisted column is never read", () => {
  const view = serializeCateringAmendment(row({ priceCents: 999 }));
  assert.deepEqual([view.before.guestCount, view.after.guestCount, view.after.priceCents, view.after.eventDate, view.after.termsNote], [100, 125, 250000, "2099-10-10", "Buffet"]);
  const cleared = serializeCateringAmendment(row({ changedFields: ["guest_count", "terms_note"], guestCount: null, termsNote: null }));
  assert.deepEqual([cleared.after.guestCount, cleared.after.termsNote], [null, null], "a listed null is a clear, not a missing value");
});
