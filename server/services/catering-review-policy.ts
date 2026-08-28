import { qualifiesAsVerifiedCateringEvent } from "@shared/catering-reviews";

export function reviewEligibility(input: { reviewerId: string; providerId: string; providerEnabled: boolean }) {
  if (!input.providerEnabled) return { allowed: false, reason: "Provider is not listed" } as const;
  if (input.reviewerId === input.providerId) return { allowed: false, reason: "You cannot review yourself" } as const;
  return { allowed: true } as const;
}

type ReviewBookingEvidence = { customerId: string; providerId: string; status?: string | null; completedAt?: unknown };

/** One review per reviewer/provider is verified by any completed booking for that exact pair. */
export function reviewVerification(inquiry: { customerId: string; chefId: string } | null, bookings: ReviewBookingEvidence[], reviewerId: string, providerId: string) {
  if (inquiry && (inquiry.customerId !== reviewerId || inquiry.chefId !== providerId)) throw new Error("INQUIRY_MISMATCH");
  return bookings.some((booking) => booking.customerId === reviewerId && booking.providerId === providerId && qualifiesAsVerifiedCateringEvent(booking));
}

export function canMutateCustomerReview(reviewReviewerId: string, sessionUserId: string): boolean {
  return reviewReviewerId === sessionUserId;
}

export function cateringReviewViewerId(authenticatedUserId: string | undefined, providerId: string): string | null {
  return authenticatedUserId && authenticatedUserId !== providerId ? authenticatedUserId : null;
}
