import { qualifiesAsVerifiedCateringEvent } from "@shared/catering-reviews";

export function reviewEligibility(input: { reviewerId: string; providerId: string; providerEnabled: boolean }) {
  if (!input.providerEnabled) return { allowed: false, reason: "Provider is not listed" } as const;
  if (input.reviewerId === input.providerId) return { allowed: false, reason: "You cannot review yourself" } as const;
  return { allowed: true } as const;
}

export function reviewVerification(inquiry: { customerId: string; chefId: string; status?: string | null } | null, reviewerId: string, providerId: string) {
  if (!inquiry) return false;
  if (inquiry.customerId !== reviewerId || inquiry.chefId !== providerId) throw new Error("INQUIRY_MISMATCH");
  return qualifiesAsVerifiedCateringEvent(inquiry);
}

export function canMutateCustomerReview(reviewReviewerId: string, sessionUserId: string): boolean {
  return reviewReviewerId === sessionUserId;
}
