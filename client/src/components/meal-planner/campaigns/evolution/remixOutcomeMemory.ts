import type { NutritionCampaignProgress } from '@/components/meal-planner/campaigns/nutritionCampaignTypes';

export type NutritionRemixOutcomeMemory = {
  completionLift: number;
  adherenceLift: number;
  continuityLift: number;
  prepReliefLift: number;
  outcomeLabel: 'positive' | 'neutral' | 'mixed';
};

const clamp01 = (value: number): number => Math.max(0, Math.min(1, value));

export const deriveRemixEffectiveness = (progress: NutritionCampaignProgress | null): number => {
  if (!progress) return 0.5;
  const completion = clamp01(progress.completionPct / 100);
  const momentum = clamp01(progress.momentum ?? 0.5);
  const stability = clamp01(progress.journeyStability ?? 0.5);
  return clamp01(completion * 0.35 + momentum * 0.3 + stability * 0.35);
};

export const deriveRemixOutcomeMemory = (progress: NutritionCampaignProgress | null): NutritionRemixOutcomeMemory => {
  const effectiveness = deriveRemixEffectiveness(progress);
  const prepReductionProgress = progress?.missionProgress.find((mission) => mission.mission.metric === 'prep_overload_reduction')?.progressPct ?? 50;
  const prepRelief = clamp01(prepReductionProgress / 100);
  const continuity = clamp01(progress?.journeyStability ?? 0.5);
  const adherence = clamp01(progress?.momentum ?? 0.5);
  const completion = clamp01((progress?.completionPct ?? 50) / 100);
  const outcomeLabel: NutritionRemixOutcomeMemory['outcomeLabel'] =
    effectiveness >= 0.68 ? 'positive' : effectiveness < 0.48 ? 'mixed' : 'neutral';

  return {
    completionLift: completion,
    adherenceLift: adherence,
    continuityLift: continuity,
    prepReliefLift: prepRelief,
    outcomeLabel,
  };
};

export const deriveRemixEvolutionNarrative = (memory: NutritionRemixOutcomeMemory): string => {
  if (memory.outcomeLabel === 'positive') return 'Remix changes improved continuity and adherence across the campaign.';
  if (memory.outcomeLabel === 'mixed') return 'Remix outcomes are mixed; retain continuity anchors and reduce prep intensity.';
  return 'Remix outcomes are stable with modest adherence gains.';
};
