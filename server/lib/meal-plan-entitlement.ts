import { and, eq, inArray, isNotNull } from "drizzle-orm";
import { mealPlanPurchases } from "../../shared/schema";

export const VERIFIED_PAID_MEAL_PLAN_STATUS = "verified_paid" as const;
export const FREE_MEAL_PLAN_ACQUISITION_STATUS = "free_acquired" as const;
export const MEAL_PLAN_ENTITLEMENT_STATUSES = [
  VERIFIED_PAID_MEAL_PLAN_STATUS,
  FREE_MEAL_PLAN_ACQUISITION_STATUS,
] as const;

/**
 * The one query boundary for meal-plan entitlement. The database constraint
 * guarantees free_acquired has no provider evidence and verified_paid has a
 * complete, authoritative provider evidence tuple.
 */
export const mealPlanEntitlementPredicate = inArray(
  mealPlanPurchases.paymentStatus,
  [...MEAL_PLAN_ENTITLEMENT_STATUSES],
);

/** Paid financial reporting is deliberately narrower than entitlement. */
export const verifiedPaidMealPlanPredicate = and(
  eq(mealPlanPurchases.paymentStatus, VERIFIED_PAID_MEAL_PLAN_STATUS),
  eq(mealPlanPurchases.acquisitionType, "paid"),
  isNotNull(mealPlanPurchases.paymentProvider),
  isNotNull(mealPlanPurchases.providerPaymentId),
  eq(mealPlanPurchases.providerPaymentStatus, "COMPLETED"),
  isNotNull(mealPlanPurchases.paymentVerifiedAt),
);

export function isMealPlanEntitlement(row: {
  paymentStatus?: string | null;
  acquisitionType?: string | null;
  pricePaidCents?: number | null;
  paymentProvider?: string | null;
  providerPaymentId?: string | null;
  providerPaymentStatus?: string | null;
  paymentVerifiedAt?: Date | string | null;
}) {
  if (row.paymentStatus === FREE_MEAL_PLAN_ACQUISITION_STATUS) {
    return row.acquisitionType === "free" && row.pricePaidCents === 0
      && !row.paymentProvider && !row.providerPaymentId
      && !row.providerPaymentStatus && !row.paymentVerifiedAt;
  }
  return row.paymentStatus === VERIFIED_PAID_MEAL_PLAN_STATUS
    && row.acquisitionType === "paid"
    && Number(row.pricePaidCents) > 0
    && Boolean(row.paymentProvider?.trim())
    && Boolean(row.providerPaymentId?.trim())
    && row.providerPaymentStatus === "COMPLETED"
    && Boolean(row.paymentVerifiedAt);
}
