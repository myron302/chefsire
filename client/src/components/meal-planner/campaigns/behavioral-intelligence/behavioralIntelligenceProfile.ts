import type { NutritionCampaignEvolutionMemory } from '@/components/meal-planner/campaigns/evolution/campaignEvolutionMemory';
import {
  deriveBehavioralConsistency,
  deriveCrossCampaignBehavioralPatterns,
  deriveSharedAdaptivePatterns,
} from '@/components/meal-planner/campaigns/behavioral-intelligence/crossCampaignAggregation';

export type NutritionBehavioralIntelligenceProfile = {
  continuityPreferenceScore: number;
  noveltyToleranceScore: number;
  prepToleranceScore: number;
  recoveryStabilizationScore: number;
  cadenceStabilityScore: number;
  sustainabilityResilienceScore: number;
  momentumRecoveryScore: number;
  semanticRefreshResponsiveness: number;
  successfulStrategyPatterns: string[];
  failedStrategyPatterns: string[];
  remixPreferencePatterns: string[];
  behavioralConfidence: number;
  evolutionVersion: number;
  lastUpdatedAt: string;
};

const clamp01 = (value: number): number => Math.max(0, Math.min(1, value));

export const deriveBehavioralIntelligenceProfile = (memories: NutritionCampaignEvolutionMemory[]): NutritionBehavioralIntelligenceProfile => {
  const aggregated = deriveCrossCampaignBehavioralPatterns(memories);
  const consistency = deriveBehavioralConsistency(aggregated);
  const sharedPatterns = deriveSharedAdaptivePatterns(aggregated);

  return {
    continuityPreferenceScore: clamp01(aggregated.continuityStabilizationTrend * 0.65 + aggregated.averageAdherenceTrend * 0.35),
    noveltyToleranceScore: clamp01(1 - aggregated.prepOverloadRecurrence * 0.35 + aggregated.cadenceConsistency * 0.25),
    prepToleranceScore: clamp01(1 - aggregated.prepOverloadRecurrence),
    recoveryStabilizationScore: aggregated.recoveryEffectiveness,
    cadenceStabilityScore: aggregated.cadenceConsistency,
    sustainabilityResilienceScore: clamp01((aggregated.averageAdherenceTrend + aggregated.averageMomentum) / 2),
    momentumRecoveryScore: clamp01(aggregated.averageMomentum * 0.7 + aggregated.recoveryEffectiveness * 0.3),
    semanticRefreshResponsiveness: clamp01(aggregated.remixSuccessRate * 0.5 + aggregated.cadenceConsistency * 0.5),
    successfulStrategyPatterns: aggregated.repeatedSuccessPatterns,
    failedStrategyPatterns: aggregated.repeatedFailurePatterns,
    remixPreferencePatterns: sharedPatterns.filter((pattern) => pattern.startsWith('success:')).slice(0, 5),
    behavioralConfidence: clamp01(consistency * 0.7 + Math.min(aggregated.totalCampaigns, 10) / 10 * 0.3),
    evolutionVersion: 1,
    lastUpdatedAt: new Date().toISOString(),
  };
};

export const updateBehavioralIntelligenceProfile = (
  previous: NutritionBehavioralIntelligenceProfile | null,
  memories: NutritionCampaignEvolutionMemory[],
): NutritionBehavioralIntelligenceProfile => {
  const derived = deriveBehavioralIntelligenceProfile(memories);
  if (!previous) return derived;

  return {
    ...derived,
    successfulStrategyPatterns: Array.from(new Set([...previous.successfulStrategyPatterns, ...derived.successfulStrategyPatterns])).slice(-8),
    failedStrategyPatterns: Array.from(new Set([...previous.failedStrategyPatterns, ...derived.failedStrategyPatterns])).slice(-8),
    remixPreferencePatterns: Array.from(new Set([...previous.remixPreferencePatterns, ...derived.remixPreferencePatterns])).slice(-8),
    behavioralConfidence: clamp01((previous.behavioralConfidence + derived.behavioralConfidence) / 2),
    evolutionVersion: previous.evolutionVersion + 1,
    lastUpdatedAt: new Date().toISOString(),
  };
};
