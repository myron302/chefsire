import assert from "node:assert/strict";
import test from "node:test";
import { applyInquiryBookingProjection, cateringOfferInvalidationKeys, inquiryBookingPresentation, type InquiryBookingProjection } from "./catering-inquiry-booking-state";

const booking = (status: InquiryBookingProjection["status"]): InquiryBookingProjection => ({ id: "booking-1", status, providerConfirmedAt: "2026-08-28T10:00:00.000Z", customerConfirmedAt: status === "confirmed" || status === "completed" ? "2026-08-28T11:00:00.000Z" : null });
test("accepted inquiry without a booking offers confirmation", () => assert.deepEqual(inquiryBookingPresentation(null), { canOffer: true, label: "Offer booking confirmation" }));
test("pending offer waits for the customer and cannot be offered twice", () => assert.deepEqual(inquiryBookingPresentation(booking("pending_confirmation")), { canOffer: false, label: "Waiting for customer confirmation" }));
test("confirmed, cancelled, and completed bookings expose truthful states", () => {
  assert.deepEqual(inquiryBookingPresentation(booking("confirmed")), { canOffer: false, label: "Booking confirmed" });
  assert.deepEqual(inquiryBookingPresentation(booking("cancelled")), { canOffer: false, label: "Booking cancelled" });
  assert.deepEqual(inquiryBookingPresentation(booking("completed")), { canOffer: false, label: "Event completed" });
});
test("offer success targets inquiry, booking, and dashboard cache families", () => assert.deepEqual(cateringOfferInvalidationKeys("provider-1"), [["catering", "inquiries", "provider-1"], ["catering", "bookings", "provider-1"], ["catering", "dashboard", "provider-1"]]));
test("successful offer immediately applies the persisted projection to the visible inquiry", () => {
  const offered = booking("pending_confirmation");
  assert.deepEqual(applyInquiryBookingProjection([{ id: "inquiry-1", booking: null }, { id: "inquiry-2", booking: null }], "inquiry-2", offered), [{ id: "inquiry-1", booking: null }, { id: "inquiry-2", booking: offered }]);
});
