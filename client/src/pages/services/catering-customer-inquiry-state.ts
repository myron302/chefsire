import type { CateringCustomerInquiryStage, CateringCustomerInquiryView } from "@shared/catering-inquiries";
import { cateringProviderInquiryKey } from "./catering-inquiry-booking-state";

/** One cache entry per signed-in customer, so switching accounts can never show or invalidate another's requests. */
export const cateringCustomerInquiriesKey = (customerId: string) => ["catering", "inquiries", "customer", customerId] as const;

export const CATERING_CUSTOMER_INQUIRY_PAGE_SIZE = 10;

export type CateringCustomerInquiryPresentation = {
  label: string;
  description: string;
  /** Terminal requests are history: no action beyond reading them. */
  terminal: boolean;
  /** Whether the booking, not this request, is where the customer acts next. */
  managedAsBooking: boolean;
};

const PRESENTATION: Record<CateringCustomerInquiryStage, CateringCustomerInquiryPresentation> = {
  awaiting_provider: { label: "Waiting for the caterer", description: "The caterer has not responded yet. You can withdraw this request until a booking exists.", terminal: false, managedAsBooking: false },
  accepted_awaiting_offer: { label: "Accepted, waiting for booking terms", description: "The caterer accepted your request. Nothing is booked until they offer terms and you confirm them.", terminal: false, managedAsBooking: false },
  offered: { label: "Booking terms offered", description: "Review the terms. Nothing is booked until you confirm, and you can cancel the booking from its page.", terminal: false, managedAsBooking: true },
  booked: { label: "Booking confirmed", description: "This request became a confirmed booking. Manage it from the booking.", terminal: false, managedAsBooking: true },
  completed: { label: "Event completed", description: "This request became a booking and the event has been completed.", terminal: true, managedAsBooking: true },
  booking_cancelled: { label: "Booking cancelled", description: "This request became a booking that was later cancelled.", terminal: true, managedAsBooking: true },
  declined: { label: "Declined by the caterer", description: "The caterer declined this request. It is kept here for your records.", terminal: true, managedAsBooking: false },
  withdrawn: { label: "Withdrawn by you", description: "You withdrew this request. It is kept here for your records.", terminal: true, managedAsBooking: false },
};

export function customerInquiryPresentation(stage: CateringCustomerInquiryStage): CateringCustomerInquiryPresentation {
  return PRESENTATION[stage];
}

/** Withdrawal is offered only when the server said it is legal for this exact row; the client derives no rule of its own. */
export function customerInquiryActions(inquiry: Pick<CateringCustomerInquiryView, "canWithdraw" | "booking">): { withdraw: boolean; viewBookingId: string | null } {
  return { withdraw: inquiry.canWithdraw && inquiry.booking === null, viewBookingId: inquiry.booking?.id ?? null };
}

/** After a withdrawal only this customer's request list, and the provider's inquiry projection it affects, are refreshed. */
export function cateringInquiryWithdrawalInvalidationKeys(input: { customerId: string; providerId: string }) {
  return [cateringCustomerInquiriesKey(input.customerId), cateringProviderInquiryKey(input.providerId), ["catering", "dashboard", input.providerId]] as const;
}

export type WithdrawalDialogTarget = { customerId: string; inquiryId: string };

/**
 * An accepted withdrawal closes the confirmation only if it is still the one on screen. A response that arrives after the
 * customer switched accounts, or opened the dialog for a different request, leaves the current dialog exactly as it is.
 */
export function settleWithdrawalDialog<T extends WithdrawalDialogTarget>(current: T | null, submitted: WithdrawalDialogTarget): T | null {
  if (!current) return current;
  return current.customerId === submitted.customerId && current.inquiryId === submitted.inquiryId ? null : current;
}

export function customerInquiryPageLabel(page: number, totalPages: number): string {
  return `Page ${page} of ${Math.max(totalPages, 1)}`;
}
