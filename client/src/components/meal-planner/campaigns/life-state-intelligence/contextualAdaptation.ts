import type { NutritionLifeStateProfile } from '@/components/meal-planner/campaigns/life-state-intelligence/lifeStateProfile';

export const deriveContextualAdaptationBias = (profile: NutritionLifeStateProfile): string[] => {
  const output: string[] = [];
  if (profile.scheduleVolatilityScore >= 0.55) output.push('Reduce prep intensity while schedule volatility is elevated.');
  if (profile.householdDisruptionScore >= 0.5) output.push('Increase continuity anchors to protect household meal flow.');
  if (profile.burnoutPressureScore >= 0.5) output.push('Prioritize recovery pacing and lower novelty load this week.');
  if (profile.shoppingInstabilityScore >= 0.45) output.push('Simplify grocery cadence with short, repeatable lists.');
  if (profile.stabilizationNeedScore >= 0.55) output.push('Favor familiar semantic patterns until continuity rebounds.');
  return output;
};

export const deriveContextualInterventionStrategies = (profile: NutritionLifeStateProfile): string[] => {
  const strategies: string[] = [];
  if (profile.timeScarcityScore >= 0.5) strategies.push('Time-compressed prep blocks + backup no-cook meals');
  if (profile.recoveryPressureScore >= 0.5) strategies.push('Recovery guardrails after disruption days');
  if (profile.socialDisruptionScore >= 0.45) strategies.push('Flexible social meal slots with continuity anchors');
  if (profile.energyConsistencyScore <= 0.45) strategies.push('Low-friction meal repeats on low-energy windows');
  return strategies;
};

export const deriveLifeStateRecommendationAdjustments = (profile: NutritionLifeStateProfile) => ({
  prepIntensityAdjustment: -(profile.timeScarcityScore * 0.5 + profile.scheduleVolatilityScore * 0.4),
  continuityAnchorBoost: profile.householdDisruptionScore * 0.5 + profile.stabilizationNeedScore * 0.35,
  recoveryPacingBoost: profile.recoveryPressureScore * 0.6 + profile.burnoutPressureScore * 0.25,
  semanticFamiliarityBoost: profile.stabilizationNeedScore * 0.45 + profile.burnoutPressureScore * 0.25,
  grocerySimplificationBoost: profile.shoppingInstabilityScore * 0.7,
});
