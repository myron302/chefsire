import type { NutritionBehavioralIntelligenceProfile } from '@/components/meal-planner/campaigns/behavioral-intelligence/behavioralIntelligenceProfile';
import type { NutritionCampaignAdaptiveRecommendation } from '@/components/meal-planner/campaigns/nutritionCampaignTypes';
import type { NutritionLifeStateProfile } from '@/components/meal-planner/campaigns/life-state-intelligence/lifeStateProfile';

const clamp01 = (value: number): number => Math.max(0, Math.min(1, value));

export const deriveContextualCompatibilityScore = (
  behavioral: NutritionBehavioralIntelligenceProfile,
  profile: NutritionLifeStateProfile,
  recommendation?: NutritionCampaignAdaptiveRecommendation,
): number => {
  const fitScore = recommendation?.fitScore ?? 0.5;
  const protectivePenalty = profile.scheduleVolatilityScore * 0.15 + profile.burnoutPressureScore * 0.2 + profile.timeScarcityScore * 0.15;
  const resilienceBoost = behavioral.recoveryStabilizationScore * 0.2 + behavioral.continuityPreferenceScore * 0.15;
  return clamp01(fitScore * 0.7 + resilienceBoost - protectivePenalty);
};

export const deriveContextualRecommendationConfidence = (
  profile: NutritionLifeStateProfile,
  compatibilityScore: number,
): number => clamp01(compatibilityScore * 0.6 + profile.contextualConfidence * 0.4);

export const deriveProtectiveRecommendationBias = (profile: NutritionLifeStateProfile): string[] => {
  const bias: string[] = [];
  if (profile.burnoutPressureScore >= 0.5) bias.push('Bias toward low-load recovery-friendly recommendations.');
  if (profile.scheduleVolatilityScore >= 0.5) bias.push('Favor flexible cadence over strict prep milestones.');
  if (profile.shoppingInstabilityScore >= 0.5) bias.push('Prefer campaigns with simplified grocery demands.');
  if (profile.stabilizationNeedScore >= 0.6) bias.push('Prioritize continuity-preserving missions before novelty objectives.');
  return bias;
};
