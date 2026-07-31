import type { CateringInquiry } from "@shared/schema";

export type CateringInquiryRole = "provider" | "customer" | null;

export function cateringInquiryRole(inquiry: CateringInquiry, userId: string): CateringInquiryRole {
  if (inquiry.chefId === userId) return "provider";
  if (inquiry.customerId === userId) return "customer";
  return null;
}

export function canTransitionCateringInquiry(
  role: Exclude<CateringInquiryRole, null>,
  currentStatus: string | null,
  nextStatus: string,
): boolean {
  if (currentStatus !== "pending") return false;
  return role === "provider"
    ? nextStatus === "accepted" || nextStatus === "declined"
    : nextStatus === "cancelled";
}

