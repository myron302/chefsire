import type { NutritionCampaignAdaptiveRecommendation } from '@/components/meal-planner/campaigns/nutritionCampaignTypes';
import type { NutritionBehavioralIntelligenceProfile } from '@/components/meal-planner/campaigns/behavioral-intelligence/behavioralIntelligenceProfile';

const clamp01 = (value: number): number => Math.max(0, Math.min(1, value));

export const deriveBehavioralCompatibilityScore = (
  profile: NutritionBehavioralIntelligenceProfile,
  recommendation?: NutritionCampaignAdaptiveRecommendation,
): number => {
  if (!recommendation) return profile.behavioralConfidence;
  const pacingFit = recommendation.pacing === 'slow'
    ? profile.prepToleranceScore < 0.55 ? 1 : 0.7
    : recommendation.pacing === 'steady'
      ? 0.85
      : profile.noveltyToleranceScore > 0.6 ? 0.8 : 0.45;
  const intensityFit = recommendation.intensity === 'low'
    ? profile.recoveryStabilizationScore
    : recommendation.intensity === 'moderate'
      ? (profile.cadenceStabilityScore + profile.noveltyToleranceScore) / 2
      : profile.noveltyToleranceScore;
  return clamp01((recommendation.fitScore * 0.5) + (pacingFit * 0.25) + (intensityFit * 0.25));
};

export const deriveGlobalRecommendationBias = (profile: NutritionBehavioralIntelligenceProfile): string[] => {
  const bias: string[] = [];
  if (profile.continuityPreferenceScore >= 0.65) bias.push('Prefer continuity anchors across campaigns');
  if (profile.prepToleranceScore < 0.5) bias.push('Default to prep-light sequencing');
  if (profile.recoveryStabilizationScore >= 0.6) bias.push('Prioritize recovery pacing before acceleration');
  if (profile.noveltyToleranceScore < 0.45) bias.push('Penalize novelty-heavy cadence');
  if (!bias.length) bias.push('Maintain balanced adaptive sequencing');
  return bias;
};

export const deriveBehavioralRecommendationConfidence = (
  profile: NutritionBehavioralIntelligenceProfile,
  compatibilityScore: number,
): number => clamp01((profile.behavioralConfidence * 0.6) + (compatibilityScore * 0.4));
