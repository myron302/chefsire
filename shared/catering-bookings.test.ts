import assert from "node:assert/strict";
import test from "node:test";
import { cateringBookingCancelSchema, cateringBookingOfferSchema, cateringBookingPageSchema } from "./catering-bookings";

test("booking pagination is bounded and deterministic inputs are validated", () => {
  assert.deepEqual(cateringBookingPageSchema.parse({}), { page: 1, limit: 20 });
  assert.equal(cateringBookingPageSchema.safeParse({ limit: 51 }).success, false);
  assert.deepEqual(cateringBookingPageSchema.parse({ page: "2", limit: "10", status: "completed", role: "provider" }), { page: 2, limit: 10, status: "completed", role: "provider" });
});
test("offer accepts only a bounded optional agreed price and canonical currency", () => {
  assert.deepEqual(cateringBookingOfferSchema.parse({ agreedPrice: "1250.50", currency: "USD" }), { agreedPrice: 1250.5, currency: "USD" });
  assert.equal(cateringBookingOfferSchema.safeParse({ agreedPrice: -1 }).success, false);
  assert.equal(cateringBookingOfferSchema.safeParse({ status: "completed" }).success, false);
  assert.equal(cateringBookingOfferSchema.safeParse({ providerId: "forged" }).success, false);
});
test("cancellation input cannot forge actor or timestamps", () => {
  assert.deepEqual(cateringBookingCancelSchema.parse({ reason: "Schedule conflict" }), { reason: "Schedule conflict" });
  assert.equal(cateringBookingCancelSchema.safeParse({ cancelledBy: "customer", cancelledAt: new Date() }).success, false);
});
