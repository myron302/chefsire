import { and, eq } from "drizzle-orm";
import { db } from "../db/index.js";
import { mealPlanPurchases } from "../../shared/schema.js";
import { mealPlanEntitlementPredicate } from "./meal-plan-entitlement.js";

/**
 * Who may see what of a meal-plan blueprint.
 *
 *  - "full":    the plan's contents (`blueprint_versions.meal_structure`) may be returned.
 *  - "preview": storefront metadata only (the same fields the public browse list already shows).
 *  - "none":    the plan must be indistinguishable from one that does not exist.
 *
 * The model has exactly two ways to hold the contents: being the creator, or holding an entitlement row
 * (`verified_paid` or `free_acquired`, see meal-plan-entitlement.ts). Likes, saves, comments and
 * shared-week copies are social bookmarks, not entitlements. ChefSire has no blueprint collaborator concept.
 */
export type MealPlanAccess = "full" | "preview" | "none";

export function decideMealPlanAccess(input: {
  status: string | null | undefined;
  creatorId: string;
  viewerId: string | null | undefined;
  hasEntitlement: boolean;
}): MealPlanAccess {
  if (input.viewerId && String(input.viewerId) === String(input.creatorId)) return "full";
  // An entitlement is proof of purchase/acquisition, so it keeps working if the creator later unpublishes the plan.
  if (input.viewerId && input.hasEntitlement) return "full";
  if (input.status !== "published") return "none";
  return "preview";
}

export async function viewerHoldsMealPlanEntitlement(viewerId: string | null | undefined, blueprintId: string) {
  if (!viewerId) return false;
  const [row] = await db
    .select({ id: mealPlanPurchases.id })
    .from(mealPlanPurchases)
    .where(and(
      eq(mealPlanPurchases.userId, viewerId),
      eq(mealPlanPurchases.blueprintId, blueprintId),
      mealPlanEntitlementPredicate,
    ))
    .limit(1);
  return Boolean(row);
}
