import type { NutritionCampaignAdaptiveRecommendation } from '@/components/meal-planner/campaigns/nutritionCampaignTypes';

export const selectAdaptiveConfidence = (recommendation: NutritionCampaignAdaptiveRecommendation | null | undefined): number =>
  typeof recommendation?.confidence === 'number' ? recommendation.confidence : 0;

export const selectTemporalRhythmSummary = <T>(
  temporalPhase: T,
  temporalTransitions: string[],
  cadenceRecommendations: string[],
) => ({
  phase: temporalPhase,
  transitions: temporalTransitions,
  cadenceRecommendations,
});

export const selectStabilizationSummary = (
  contextualStability: { resilienceScore?: number } | null | undefined,
  temporalStability: { stabilityIndex?: number } | null | undefined,
) => ({
  contextualResilienceScore: contextualStability?.resilienceScore ?? 0,
  temporalStabilityIndex: temporalStability?.stabilityIndex ?? 0,
});
