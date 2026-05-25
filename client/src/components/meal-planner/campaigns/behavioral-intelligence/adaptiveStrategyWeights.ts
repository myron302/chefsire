import type { NutritionBehavioralIntelligenceProfile } from '@/components/meal-planner/campaigns/behavioral-intelligence/behavioralIntelligenceProfile';

export type AdaptiveStrategyWeights = Record<'continuityAnchor' | 'recoveryPacing' | 'prepReduction' | 'noveltyCadence', number>;

const clamp01 = (value: number): number => Math.max(0, Math.min(1, value));

export const deriveAdaptiveStrategyWeights = (profile: NutritionBehavioralIntelligenceProfile): AdaptiveStrategyWeights => ({
  continuityAnchor: clamp01(0.4 + profile.continuityPreferenceScore * 0.6),
  recoveryPacing: clamp01(0.35 + profile.recoveryStabilizationScore * 0.65),
  prepReduction: clamp01(0.3 + (1 - profile.prepToleranceScore) * 0.7),
  noveltyCadence: clamp01(0.2 + profile.noveltyToleranceScore * 0.8),
});

export const deriveBehavioralStrategyBias = (weights: AdaptiveStrategyWeights): string[] => {
  const bias: string[] = [];
  if (weights.continuityAnchor >= 0.75) bias.push('Continuity anchors gain weight');
  if (weights.recoveryPacing >= 0.7) bias.push('Recovery pacing gains confidence');
  if (weights.prepReduction >= 0.65) bias.push('Prep reduction becomes default recommendation');
  if (weights.noveltyCadence <= 0.45) bias.push('Novelty-heavy cadence gets penalized');
  if (!bias.length) bias.push('Balanced adaptive strategy weighting');
  return bias;
};
