import type { CateringBooking, CateringInquiry } from "@shared/schema";
import type { CateringBookingStatus } from "@shared/catering-bookings";
import { canCustomerWithdrawCateringInquiry, deriveCateringCustomerInquiryStage, type CateringCustomerInquiryView } from "@shared/catering-inquiries";
import { calendarDateInTimezone } from "../services/catering-availability";

export type CateringCustomerInquiryRow = {
  inquiry: CateringInquiry;
  booking: Pick<CateringBooking, "id" | "status" | "agreedPrice" | "currency" | "providerConfirmedAt" | "customerConfirmedAt"> | null;
  provider: { id: string; displayName: string | null; username: string | null };
  packageTitle: string | null;
};

/**
 * Explicit customer-side projection of an inquiry. Built field by field so a column added to the table later reaches a
 * customer only by a deliberate edit here. The booking carries only what the customer needs to follow an offer: its
 * status, price and who has confirmed. Cancellation reasons, internal attribution and the provider's private workspace
 * data are never selected into the row in the first place.
 */
export function serializeCateringCustomerInquiry({ inquiry, booking, provider, packageTitle }: CateringCustomerInquiryRow): CateringCustomerInquiryView {
  return {
    id: inquiry.id,
    stage: deriveCateringCustomerInquiryStage(inquiry.status, booking),
    status: inquiry.status ?? "pending",
    canWithdraw: canCustomerWithdrawCateringInquiry(inquiry.status, booking !== null),
    eventDate: calendarDateInTimezone(inquiry.eventDate, "UTC"),
    eventType: inquiry.eventType,
    guestCount: inquiry.guestCount,
    cuisinePreferences: inquiry.cuisinePreferences ?? [],
    budget: inquiry.budget,
    message: inquiry.message,
    contactEmail: inquiry.customerEmail,
    contactPhone: inquiry.customerPhone,
    submittedAt: inquiry.createdAt ? inquiry.createdAt.toISOString() : null,
    packageTitle,
    provider: { id: provider.id, displayName: provider.displayName || provider.username || "Caterer" },
    booking: booking ? {
      id: booking.id,
      status: booking.status as CateringBookingStatus,
      agreedPrice: booking.agreedPrice,
      currency: booking.currency,
      providerConfirmedAt: booking.providerConfirmedAt ? booking.providerConfirmedAt.toISOString() : null,
      customerConfirmedAt: booking.customerConfirmedAt ? booking.customerConfirmedAt.toISOString() : null,
    } : null,
  };
}
