import type { CateringBooking } from "@shared/schema";
import type { CateringBookingView } from "@shared/catering-bookings";

const iso = (value: Date | null) => value?.toISOString() ?? null;
/** Explicit participant serializer. Cancellation reason intentionally remains private to the server. */
export function serializeCateringBooking(row: CateringBooking): CateringBookingView {
  return {
    id: row.id, inquiryId: row.inquiryId, providerId: row.providerId, status: row.status as CateringBookingView["status"], eventDate: row.eventDate,
    eventType: row.eventType, guestCount: row.guestCount, packageId: row.packageId,
    packageTitle: row.packageTitleSnapshot, agreedPrice: row.agreedPrice, currency: row.currency,
    providerConfirmedAt: iso(row.providerConfirmedAt), customerConfirmedAt: iso(row.customerConfirmedAt), confirmedAt: iso(row.confirmedAt),
    cancelledAt: iso(row.cancelledAt), cancelledBy: row.cancelledBy as CateringBookingView["cancelledBy"], completedAt: iso(row.completedAt),
    createdAt: row.createdAt.toISOString(), updatedAt: row.updatedAt.toISOString(),
  };
}
