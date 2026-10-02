import { z } from "zod";
import type { CateringBookingStatus } from "./catering-bookings";

export const CATERING_INQUIRY_EMAIL_MAX_LENGTH = 254;
export const CATERING_INQUIRY_PHONE_MAX_LENGTH = 32;

const blankToUndefined = (value: unknown) => (typeof value === "string" && value.trim() === "" ? undefined : value);
const phoneDigits = (value: string) => value.replace(/\D/g, "");

/**
 * Structured contact details a customer shares with the provider they are asking. Both are optional, and a blank
 * field means "not given" rather than an empty string. The email is lowercased; the phone keeps only the characters a
 * dialled number uses, with runs of whitespace collapsed. Nothing here is a contact-management system: the values live
 * on the inquiry and are shown only to the inquiry's own two participants.
 */
export const cateringInquiryContactSchema = z.object({
  customerEmail: z.preprocess(blankToUndefined, z.string().trim().toLowerCase().max(CATERING_INQUIRY_EMAIL_MAX_LENGTH, "Email is too long").email("Enter a valid email address").optional()),
  customerPhone: z.preprocess(blankToUndefined, z.string().trim().max(CATERING_INQUIRY_PHONE_MAX_LENGTH, "Phone number is too long")
    .regex(/^[0-9+().\-\s]+$/, "Phone number can contain digits, spaces and + ( ) - . only")
    .refine((value) => { const digits = phoneDigits(value).length; return digits >= 7 && digits <= 15; }, "Enter a phone number with 7 to 15 digits")
    .transform((value) => value.replace(/\s+/g, " "))
    .optional()),
});

/** The authoritative inquiry statuses. `booked` and the offer states are derived from a booking, never stored here. */
export const CATERING_INQUIRY_STATUSES = ["pending", "accepted", "declined", "cancelled"] as const;
export type CateringInquiryStatus = typeof CATERING_INQUIRY_STATUSES[number];

export const CATERING_CUSTOMER_INQUIRY_STAGES = ["awaiting_provider", "accepted_awaiting_offer", "offered", "booked", "completed", "booking_cancelled", "declined", "withdrawn"] as const;
export type CateringCustomerInquiryStage = typeof CATERING_CUSTOMER_INQUIRY_STAGES[number];

/**
 * What the customer should be told. An offer IS a `catering_bookings` row still awaiting confirmation, so every stage
 * from "offered" onward is read from the booking and the inquiry's own status is consulted only while no booking exists.
 */
export function deriveCateringCustomerInquiryStage(status: string | null, booking: { status: string } | null): CateringCustomerInquiryStage {
  if (booking) {
    if (booking.status === "pending_confirmation") return "offered";
    if (booking.status === "confirmed") return "booked";
    if (booking.status === "completed") return "completed";
    return "booking_cancelled";
  }
  if (status === "accepted") return "accepted_awaiting_offer";
  if (status === "declined") return "declined";
  if (status === "cancelled") return "withdrawn";
  return "awaiting_provider";
}

/**
 * A customer may withdraw only while the inquiry has not produced a booking. Once a booking exists -- an offer included
 * -- the booking lifecycle is authoritative and the existing booking cancellation is the only way to walk away. The
 * column is nullable but defaults to `pending`, so a NULL status is an open inquiry exactly as `pending` is.
 */
export function canCustomerWithdrawCateringInquiry(status: string | null, hasBooking: boolean): boolean {
  return !hasBooking && (status === "pending" || status === "accepted" || status === null);
}

export const CATERING_CUSTOMER_REQUESTS_SECTION = "my-requests";
export const CATERING_CUSTOMER_REQUESTS_URL = `/services/catering#${CATERING_CUSTOMER_REQUESTS_SECTION}`;
export const CATERING_PROVIDER_INQUIRIES_URL = "/services/catering/provider#inquiries";

export type CateringCustomerInquiryView = {
  id: string;
  stage: CateringCustomerInquiryStage;
  status: string;
  canWithdraw: boolean;
  eventDate: string;
  eventType: string | null;
  guestCount: number | null;
  cuisinePreferences: string[];
  budget: string | null;
  message: string | null;
  contactEmail: string | null;
  contactPhone: string | null;
  submittedAt: string | null;
  packageTitle: string | null;
  provider: { id: string; displayName: string };
  booking: { id: string; status: CateringBookingStatus; agreedPrice: string | null; currency: string; providerConfirmedAt: string | null; customerConfirmedAt: string | null } | null;
};

export type CateringCustomerInquiryPage = {
  inquiries: CateringCustomerInquiryView[];
  pagination: { page: number; limit: number; total: number; totalPages: number };
};

export type CateringInquiryWithdrawalCode = "inquiry_not_found" | "inquiry_has_booking" | "inquiry_not_withdrawable";
