import type { NutritionCampaignProgress } from '@/components/meal-planner/campaigns/nutritionCampaignTypes';
import {
  deriveAdaptiveStabilizationSignals,
  deriveFailedAdaptiveStrategies,
  deriveSuccessfulAdaptiveStrategies,
} from '@/components/meal-planner/campaigns/evolution/campaignAdaptiveStrategies';
import { deriveSemanticCadenceMemory, deriveNoveltyRecoveryPatterns } from '@/components/meal-planner/campaigns/evolution/semanticCadenceMemory';
import { deriveRemixOutcomeMemory } from '@/components/meal-planner/campaigns/evolution/remixOutcomeMemory';

export type NutritionCampaignEvolutionMemory = {
  campaignId: string;
  successfulStrategies: string[];
  failedStrategies: string[];
  semanticCadencePatterns: string[];
  recoveryInterventions: string[];
  continuityAnchors: string[];
  prepStabilitySignals: string[];
  adherenceTrend: number;
  momentumHistory: number[];
  remixOutcomes: string[];
  evolutionVersion: number;
  lastUpdatedAt: string;
};

const clamp01 = (value: number): number => Math.max(0, Math.min(1, value));
const pushCapped = <T,>(items: T[], next: T, max = 10): T[] => [...items, next].slice(-max);

export const deriveCampaignEvolutionMemory = (
  campaignId: string,
  progress: NutritionCampaignProgress | null,
): NutritionCampaignEvolutionMemory => {
  const successfulStrategies = deriveSuccessfulAdaptiveStrategies(progress).map((item) => item.label);
  const failedStrategies = deriveFailedAdaptiveStrategies(progress).map((item) => item.label);
  const cadenceMemory = deriveSemanticCadenceMemory(progress);
  const noveltyRecoveryPatterns = deriveNoveltyRecoveryPatterns(cadenceMemory);
  const remixMemory = deriveRemixOutcomeMemory(progress);
  const stabilization = deriveAdaptiveStabilizationSignals(progress);

  return {
    campaignId,
    successfulStrategies,
    failedStrategies,
    semanticCadencePatterns: noveltyRecoveryPatterns,
    recoveryInterventions: stabilization.filter((item) => item.includes('recovery') || item.includes('semantic-reset')),
    continuityAnchors: stabilization.filter((item) => item.includes('continuity') || item.includes('stabilized')),
    prepStabilitySignals: progress?.missionProgress.some((mission) => mission.mission.metric === 'prep_overload_reduction' && mission.progressPct < 50)
      ? ['prep-overload-watch']
      : ['prep-stability-improving'],
    adherenceTrend: clamp01((progress?.completionPct ?? 50) / 100),
    momentumHistory: [clamp01(progress?.momentum ?? 0.5)],
    remixOutcomes: [remixMemory.outcomeLabel],
    evolutionVersion: 1,
    lastUpdatedAt: new Date().toISOString(),
  };
};

export const updateCampaignEvolutionMemory = (
  previous: NutritionCampaignEvolutionMemory | null,
  campaignId: string,
  progress: NutritionCampaignProgress | null,
): NutritionCampaignEvolutionMemory => {
  const derived = deriveCampaignEvolutionMemory(campaignId, progress);
  if (!previous) return derived;

  const mergedSuccess = Array.from(new Set([...previous.successfulStrategies, ...derived.successfulStrategies])).slice(-8);
  const mergedFailed = Array.from(new Set([...previous.failedStrategies, ...derived.failedStrategies])).slice(-8);
  const mergedCadence = Array.from(new Set([...previous.semanticCadencePatterns, ...derived.semanticCadencePatterns])).slice(-8);
  const mergedRecovery = Array.from(new Set([...previous.recoveryInterventions, ...derived.recoveryInterventions])).slice(-8);
  const mergedContinuity = Array.from(new Set([...previous.continuityAnchors, ...derived.continuityAnchors])).slice(-8);
  const mergedPrep = Array.from(new Set([...previous.prepStabilitySignals, ...derived.prepStabilitySignals])).slice(-8);
  const mergedRemix = Array.from(new Set([...previous.remixOutcomes, ...derived.remixOutcomes])).slice(-8);
  return {
    ...previous,
    campaignId,
    successfulStrategies: mergedSuccess,
    failedStrategies: mergedFailed,
    semanticCadencePatterns: mergedCadence,
    recoveryInterventions: mergedRecovery,
    continuityAnchors: mergedContinuity,
    prepStabilitySignals: mergedPrep,
    adherenceTrend: clamp01((previous.adherenceTrend + derived.adherenceTrend) / 2),
    momentumHistory: pushCapped(previous.momentumHistory, clamp01(progress?.momentum ?? 0.5), 16),
    remixOutcomes: mergedRemix,
    evolutionVersion: previous.evolutionVersion + 1,
    lastUpdatedAt: new Date().toISOString(),
  };
};
