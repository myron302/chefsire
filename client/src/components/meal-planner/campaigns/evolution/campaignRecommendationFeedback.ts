import type { NutritionCampaignAdaptiveRecommendation } from '@/components/meal-planner/campaigns/nutritionCampaignTypes';
import type { NutritionCampaignEvolutionMemory } from '@/components/meal-planner/campaigns/evolution/campaignEvolutionMemory';

export type NutritionCampaignRecommendationFeedback = {
  confidence: number;
  recommendationNudge: string[];
  cautionSignals: string[];
};

const clamp01 = (value: number): number => Math.max(0, Math.min(1, value));

export const deriveAdaptiveRecommendationConfidence = (
  memory: NutritionCampaignEvolutionMemory,
  recommendation?: NutritionCampaignAdaptiveRecommendation,
): number => {
  const base = recommendation?.fitScore ? clamp01(recommendation.fitScore / 100) : 0.5;
  const successLift = clamp01(memory.successfulStrategies.length / 8) * 0.25;
  const failurePenalty = clamp01(memory.failedStrategies.length / 8) * 0.2;
  const continuityLift = clamp01(memory.continuityAnchors.length / 6) * 0.2;
  return clamp01(base + successLift + continuityLift - failurePenalty);
};

export const deriveCampaignRecommendationFeedback = (
  memory: NutritionCampaignEvolutionMemory,
  recommendation?: NutritionCampaignAdaptiveRecommendation,
): NutritionCampaignRecommendationFeedback => {
  const confidence = deriveAdaptiveRecommendationConfidence(memory, recommendation);
  const recommendationNudge = memory.successfulStrategies.slice(0, 3).map((strategy) => `Lean into ${strategy}`);
  const cautionSignals = memory.failedStrategies.slice(0, 3).map((strategy) => `Avoid ${strategy} cadence`);
  if (memory.recoveryInterventions.length > 0) recommendationNudge.push('Keep recovery anchors in weekly rhythm');
  return {
    confidence,
    recommendationNudge: recommendationNudge.slice(0, 4),
    cautionSignals,
  };
};
