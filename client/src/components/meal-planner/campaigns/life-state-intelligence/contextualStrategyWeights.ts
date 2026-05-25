import type { NutritionLifeStateProfile } from '@/components/meal-planner/campaigns/life-state-intelligence/lifeStateProfile';

const clamp01 = (value: number): number => Math.max(0, Math.min(1, value));

export const deriveContextualStrategyWeights = (profile: NutritionLifeStateProfile) => ({
  recoveryPacing: clamp01(0.3 + profile.recoveryPressureScore * 0.55 + profile.burnoutPressureScore * 0.15),
  continuityAnchors: clamp01(0.25 + profile.stabilizationNeedScore * 0.45 + profile.householdDisruptionScore * 0.2),
  noveltyReduction: clamp01(0.2 + profile.burnoutPressureScore * 0.45 + profile.scheduleVolatilityScore * 0.2),
  prepSimplification: clamp01(0.2 + profile.timeScarcityScore * 0.5 + profile.shoppingInstabilityScore * 0.2),
  grocerySimplification: clamp01(0.2 + profile.shoppingInstabilityScore * 0.55 + profile.scheduleVolatilityScore * 0.15),
});

export const deriveProtectiveAdaptationBias = (weights: ReturnType<typeof deriveContextualStrategyWeights>): string[] => {
  const notes: string[] = [];
  if (weights.recoveryPacing >= 0.6) notes.push('Recovery pacing has emergency priority.');
  if (weights.continuityAnchors >= 0.6) notes.push('Continuity anchors are in protective mode.');
  if (weights.noveltyReduction >= 0.55) notes.push('Novelty cadence is temporarily reduced to limit fatigue.');
  if (weights.prepSimplification >= 0.55) notes.push('Prep simplification is upweighted to protect consistency.');
  if (weights.grocerySimplification >= 0.55) notes.push('Grocery simplification activated under instability.');
  return notes;
};
