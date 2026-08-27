import assert from "node:assert/strict";
import test from "node:test";
import { bookingActor, mayCancel, mayComplete, mayConfirm, mayInquiryProduceBooking, nextConfirmationStatus, qualifiesBookingForVerifiedReview } from "./catering-booking-policy";

const pending = { status: "pending_confirmation", providerConfirmedAt: null, customerConfirmedAt: null } as const;
test("accepted inquiry is qualifying but does not itself confirm a booking", () => {
  assert.equal(mayInquiryProduceBooking({ status: "pending" }), false);
  assert.equal(mayInquiryProduceBooking({ status: "accepted" }), true);
  assert.equal(nextConfirmationStatus(pending as never, "provider"), "pending_confirmation");
});
test("bilateral explicit confirmation is required", () => {
  assert.equal(nextConfirmationStatus({ ...pending, providerConfirmedAt: new Date() } as never, "customer"), "confirmed");
  assert.equal(nextConfirmationStatus({ ...pending, customerConfirmedAt: new Date() } as never, "provider"), "confirmed");
  assert.equal(mayConfirm({ status: "cancelled" } as never, "customer"), false);
});
test("ownership roles cannot be forged", () => {
  const booking = { providerId: "p", customerId: "c" } as never;
  assert.equal(bookingActor(booking, "p"), "provider"); assert.equal(bookingActor(booking, "c"), "customer"); assert.equal(bookingActor(booking, "x"), null);
});
test("cancel and completion transitions are conservative and terminal", () => {
  assert.equal(mayCancel("pending_confirmation"), true); assert.equal(mayCancel("confirmed"), true);
  assert.equal(mayCancel("completed"), false); assert.equal(mayCancel("cancelled"), false);
  assert.equal(mayComplete({ status: "confirmed", eventDate: "2026-08-27" } as never, "provider", "2026-08-27"), true);
  assert.equal(mayComplete({ status: "confirmed", eventDate: "2026-08-28" } as never, "provider", "2026-08-27"), false);
  assert.equal(mayComplete({ status: "cancelled", eventDate: "2026-08-01" } as never, "provider", "2026-08-27"), false);
  assert.equal(mayComplete({ status: "confirmed", eventDate: "2026-08-01" } as never, "customer", "2026-08-27"), false);
});
test("only persisted completion qualifies review verification", () => {
  assert.equal(qualifiesBookingForVerifiedReview({ status: "confirmed", completedAt: null } as never), false);
  assert.equal(qualifiesBookingForVerifiedReview({ status: "completed", completedAt: new Date() } as never), true);
});
