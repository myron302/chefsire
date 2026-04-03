export const NUTRITION_SUBSCRIPTION_TIERS = {
  free: {
    name: "Free",
    price: 0,
    features: [
      "Basic nutrition logging",
      "Daily calorie summary",
      "Set nutrition goals",
      "Manual meal entries",
    ],
  },
  premium: {
    name: "Premium",
    price: 9.99,
    features: [
      "Everything in Free",
      "Advanced nutrition insights",
      "Premium tracking tools",
      "Priority nutrition features",
      "Expanded reports/history",
    ],
  },
} as const;

export type NutritionTierKey = keyof typeof NUTRITION_SUBSCRIPTION_TIERS;

export function nutritionTierPriceAsString(tier: NutritionTierKey): string {
  const price = NUTRITION_SUBSCRIPTION_TIERS[tier]?.price ?? 0;
  return Number(price).toFixed(2);
}
