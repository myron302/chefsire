import type { CateringBooking, CateringInquiry } from "@shared/schema";
import type { CateringBookingActor, CateringBookingStatus } from "@shared/catering-bookings";
import { dateOrdinal } from "./catering-availability";

export function mayInquiryProduceBooking(inquiry: Pick<CateringInquiry, "status">): boolean {
  return inquiry.status === "accepted";
}
export function bookingActor(booking: Pick<CateringBooking, "providerId" | "customerId">, userId: string): CateringBookingActor | null {
  if (booking.providerId === userId) return "provider";
  if (booking.customerId === userId) return "customer";
  return null;
}
export function nextConfirmationStatus(booking: Pick<CateringBooking, "status" | "providerConfirmedAt" | "customerConfirmedAt">, actor: CateringBookingActor): CateringBookingStatus {
  if (booking.status !== "pending_confirmation") return booking.status as CateringBookingStatus;
  const providerConfirmed = actor === "provider" || Boolean(booking.providerConfirmedAt);
  const customerConfirmed = actor === "customer" || Boolean(booking.customerConfirmedAt);
  return providerConfirmed && customerConfirmed ? "confirmed" : "pending_confirmation";
}
export function mayConfirm(booking: Pick<CateringBooking, "status">, actor: CateringBookingActor): boolean {
  return booking.status === "pending_confirmation" && (actor === "provider" || actor === "customer");
}
export function mayCancel(status: string): boolean { return status === "pending_confirmation" || status === "confirmed"; }
export function mayComplete(booking: Pick<CateringBooking, "status" | "eventDate">, actor: CateringBookingActor, currentDate: string): boolean {
  return actor === "provider" && booking.status === "confirmed" && dateOrdinal(currentDate) >= dateOrdinal(booking.eventDate);
}
export function qualifiesBookingForVerifiedReview(booking: Pick<CateringBooking, "status" | "completedAt"> | null | undefined): boolean {
  return booking?.status === "completed" && Boolean(booking.completedAt);
}
