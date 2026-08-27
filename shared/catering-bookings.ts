import { z } from "zod";

export const CATERING_BOOKING_STATUSES = ["pending_confirmation", "confirmed", "cancelled", "completed"] as const;
export type CateringBookingStatus = typeof CATERING_BOOKING_STATUSES[number];
export type CateringBookingActor = "provider" | "customer";

export const cateringBookingIdSchema = z.string().uuid();
export const cateringBookingPageSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(20),
  status: z.enum(CATERING_BOOKING_STATUSES).optional(),
  role: z.enum(["provider", "customer"]).optional(),
});
export const cateringBookingOfferSchema = z.object({
  agreedPrice: z.coerce.number().finite().min(0).max(99_999_999.99).optional(),
  currency: z.string().trim().regex(/^[A-Z]{3}$/).default("USD"),
}).strict();
export const cateringBookingCancelSchema = z.object({ reason: z.string().trim().max(1000).optional() }).strict();

export type CateringBookingView = {
  id: string; inquiryId: string; status: CateringBookingStatus; eventDate: string;
  eventType: string | null; guestCount: number | null; packageId: string | null;
  packageTitle: string | null; agreedPrice: string | null; currency: string;
  providerConfirmedAt: string | null; customerConfirmedAt: string | null; confirmedAt: string | null;
  cancelledAt: string | null; cancelledBy: CateringBookingActor | null; completedAt: string | null;
  createdAt: string; updatedAt: string;
};
