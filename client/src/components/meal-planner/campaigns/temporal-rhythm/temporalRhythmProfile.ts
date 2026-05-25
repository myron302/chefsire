import type { NutritionBehavioralIntelligenceProfile } from '@/components/meal-planner/campaigns/behavioral-intelligence/behavioralIntelligenceProfile';
import type { NutritionCampaignEvolutionMemory } from '@/components/meal-planner/campaigns/evolution/campaignEvolutionMemory';
import type { NutritionLifeStateProfile } from '@/components/meal-planner/campaigns/life-state-intelligence/lifeStateProfile';
import { deriveCadenceTransitionSignals, deriveRecoveryTimingSignals, deriveTemporalRhythmSignals } from '@/components/meal-planner/campaigns/temporal-rhythm/temporalSignals';

export type NutritionTemporalRhythmProfile = {
  noveltyWindowScore: number;
  stabilizationWindowScore: number;
  recoveryWindowScore: number;
  transformationMomentumScore: number;
  cadenceTransitionScore: number;
  prepRecoveryWindowScore: number;
  continuityProtectionScore: number;
  temporalFlexibilityScore: number;
  rhythmStabilityScore: number;
  seasonalRhythmScore: number;
  temporalConfidence: number;
  evolutionVersion: number;
  lastUpdatedAt: string;
};

const clamp01 = (value: number): number => Math.max(0, Math.min(1, value));

export const createDefaultTemporalRhythmProfile = (): NutritionTemporalRhythmProfile => ({
  noveltyWindowScore: 0.4, stabilizationWindowScore: 0.5, recoveryWindowScore: 0.45, transformationMomentumScore: 0.4,
  cadenceTransitionScore: 0.45, prepRecoveryWindowScore: 0.45, continuityProtectionScore: 0.5, temporalFlexibilityScore: 0.45,
  rhythmStabilityScore: 0.45, seasonalRhythmScore: 0.4, temporalConfidence: 0.2, evolutionVersion: 1, lastUpdatedAt: new Date().toISOString(),
});

export const deriveTemporalRhythmProfile = (
  behavioral: NutritionBehavioralIntelligenceProfile,
  lifeState: NutritionLifeStateProfile,
  memories: NutritionCampaignEvolutionMemory[],
): NutritionTemporalRhythmProfile => {
  const rhythm = deriveTemporalRhythmSignals(behavioral, lifeState, memories);
  const cadence = deriveCadenceTransitionSignals(behavioral, lifeState, memories);
  const recovery = deriveRecoveryTimingSignals(behavioral, lifeState, memories);
  const stability = clamp01((rhythm.stabilizationDurationQuality + cadence.cadenceTransitionStability + recovery.recoveryCycleEfficiency) / 3);
  return {
    noveltyWindowScore: clamp01(rhythm.momentumRecoveryTiming * 0.55 + (1 - lifeState.stabilizationNeedScore) * 0.45),
    stabilizationWindowScore: clamp01(rhythm.stabilizationDurationQuality * 0.65 + lifeState.stabilizationNeedScore * 0.35),
    recoveryWindowScore: clamp01(recovery.lateWeekFatigueRecovery * 0.4 + recovery.successfulRecoverySequencing * 0.6),
    transformationMomentumScore: clamp01(behavioral.momentumRecoveryScore * 0.65 + cadence.cadenceTransitionStability * 0.35),
    cadenceTransitionScore: cadence.cadenceTransitionStability,
    prepRecoveryWindowScore: clamp01(recovery.prepReboundTiming * 0.7 + recovery.continuityReboundWindow * 0.3),
    continuityProtectionScore: clamp01(recovery.continuityReboundWindow * 0.6 + (1 - lifeState.scheduleVolatilityScore) * 0.4),
    temporalFlexibilityScore: clamp01(behavioral.cadenceStabilityScore * 0.6 + cadence.transitionReadiness * 0.4),
    rhythmStabilityScore: stability,
    seasonalRhythmScore: clamp01((1 - lifeState.seasonalStressScore) * 0.6 + stability * 0.4),
    temporalConfidence: clamp01((behavioral.behavioralConfidence + lifeState.contextualConfidence + Math.min(memories.length, 16) / 16) / 3),
    evolutionVersion: 1,
    lastUpdatedAt: new Date().toISOString(),
  };
};

export const updateTemporalRhythmProfile = (
  previous: NutritionTemporalRhythmProfile | null,
  behavioral: NutritionBehavioralIntelligenceProfile,
  lifeState: NutritionLifeStateProfile,
  memories: NutritionCampaignEvolutionMemory[],
): NutritionTemporalRhythmProfile => {
  const derived = deriveTemporalRhythmProfile(behavioral, lifeState, memories);
  if (!previous) return derived;
  const smooth = (a: number, b: number): number => clamp01(a * 0.4 + b * 0.6);
  return {
    ...derived,
    noveltyWindowScore: smooth(previous.noveltyWindowScore, derived.noveltyWindowScore),
    stabilizationWindowScore: smooth(previous.stabilizationWindowScore, derived.stabilizationWindowScore),
    recoveryWindowScore: smooth(previous.recoveryWindowScore, derived.recoveryWindowScore),
    transformationMomentumScore: smooth(previous.transformationMomentumScore, derived.transformationMomentumScore),
    cadenceTransitionScore: smooth(previous.cadenceTransitionScore, derived.cadenceTransitionScore),
    prepRecoveryWindowScore: smooth(previous.prepRecoveryWindowScore, derived.prepRecoveryWindowScore),
    continuityProtectionScore: smooth(previous.continuityProtectionScore, derived.continuityProtectionScore),
    temporalFlexibilityScore: smooth(previous.temporalFlexibilityScore, derived.temporalFlexibilityScore),
    rhythmStabilityScore: smooth(previous.rhythmStabilityScore, derived.rhythmStabilityScore),
    seasonalRhythmScore: smooth(previous.seasonalRhythmScore, derived.seasonalRhythmScore),
    temporalConfidence: smooth(previous.temporalConfidence, derived.temporalConfidence),
    evolutionVersion: previous.evolutionVersion + 1,
    lastUpdatedAt: new Date().toISOString(),
  };
};
