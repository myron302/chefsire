import type { NutritionTierKey } from "./constants";
import { hasAuthoritativePaidEntitlement } from "../../lib/subscription-security";

export function coerceNutritionTierFromUser(user: any): NutritionTierKey {
  return user?.nutritionPremium && hasAuthoritativePaidEntitlement() ? "premium" : "free";
}

export function deriveNutritionStatus(user: any): "active" | "inactive" | "expired" {
  const isPremium = !!user?.nutritionPremium && hasAuthoritativePaidEntitlement();
  const endsAtRaw = user?.nutritionTrialEndsAt;
  const endsAt = endsAtRaw ? new Date(endsAtRaw) : null;

  if (!isPremium) return "inactive";
  if (endsAt && !Number.isNaN(endsAt.getTime()) && endsAt.getTime() < Date.now()) return "expired";
  return "active";
}

export function parseValidDateOrNull(input: unknown): Date | null {
  if (!input) return null;
  const date = new Date(input as any);
  return Number.isNaN(date.getTime()) ? null : date;
}
