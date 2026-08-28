import type { CateringBookingStatus } from "@shared/catering-bookings";

export type InquiryBookingProjection = { id: string; status: CateringBookingStatus; providerConfirmedAt: string | null; customerConfirmedAt: string | null };

export function inquiryBookingPresentation(booking: InquiryBookingProjection | null) {
  if (!booking) return { canOffer: true, label: "Offer booking confirmation" } as const;
  if (booking.status === "pending_confirmation") return { canOffer: false, label: booking.providerConfirmedAt && !booking.customerConfirmedAt ? "Waiting for customer confirmation" : "Booking terms offered" } as const;
  if (booking.status === "confirmed") return { canOffer: false, label: "Booking confirmed" } as const;
  if (booking.status === "cancelled") return { canOffer: false, label: "Booking cancelled" } as const;
  return { canOffer: false, label: "Event completed" } as const;
}

export function cateringOfferInvalidationKeys(providerId: string) {
  return [["catering", "inquiries", providerId], ["catering", "bookings", providerId], ["catering", "dashboard", providerId]] as const;
}

export function applyInquiryBookingProjection<T extends { id: string; booking: InquiryBookingProjection | null }>(inquiries: T[], inquiryId: string, booking: InquiryBookingProjection): T[] {
  return inquiries.map((inquiry) => inquiry.id === inquiryId ? { ...inquiry, booking } : inquiry);
}
