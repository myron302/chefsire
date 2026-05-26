import type { NutritionBehavioralIntelligenceProfile } from '@/components/meal-planner/campaigns/behavioral-intelligence/behavioralIntelligenceProfile';
import type { NutritionCampaignEvolutionMemory } from '@/components/meal-planner/campaigns/evolution/campaignEvolutionMemory';
import type { NutritionLifeStateProfile } from '@/components/meal-planner/campaigns/life-state-intelligence/lifeStateProfile';

const clamp01 = (value: number): number => Math.max(0, Math.min(1, value));
const activityRatio = (memories: NutritionCampaignEvolutionMemory[]): number => clamp01(Math.min(memories.length, 12) / 12);

export const deriveRecoveryTimingSignals = (behavioral: NutritionBehavioralIntelligenceProfile, life: NutritionLifeStateProfile, memories: NutritionCampaignEvolutionMemory[]) => ({
  lateWeekFatigueRecovery: clamp01(life.recoveryPressureScore * 0.5 + behavioral.recoveryStabilizationScore * 0.5),
  continuityReboundWindow: clamp01((1 - life.scheduleVolatilityScore) * 0.45 + behavioral.sustainabilityResilienceScore * 0.55),
  successfulRecoverySequencing: clamp01(behavioral.momentumRecoveryScore * 0.7 + activityRatio(memories) * 0.3),
  prepReboundTiming: clamp01((1 - life.timeScarcityScore) * 0.5 + behavioral.prepToleranceScore * 0.5),
  recoveryCycleEfficiency: clamp01((1 - life.burnoutPressureScore) * 0.4 + behavioral.recoveryStabilizationScore * 0.6),
});

export const deriveCadenceTransitionSignals = (behavioral: NutritionBehavioralIntelligenceProfile, life: NutritionLifeStateProfile, memories: NutritionCampaignEvolutionMemory[]) => ({
  cadenceTransitionStability: clamp01((1 - life.scheduleVolatilityScore) * 0.5 + behavioral.cadenceStabilityScore * 0.5),
  noveltyCollapseTiming: clamp01(life.stabilizationNeedScore * 0.5 + (1 - behavioral.noveltyToleranceScore) * 0.5),
  transitionReadiness: clamp01((behavioral.behavioralConfidence + life.contextualConfidence + activityRatio(memories)) / 3),
});

export const deriveTemporalRhythmSignals = (behavioral: NutritionBehavioralIntelligenceProfile, life: NutritionLifeStateProfile, memories: NutritionCampaignEvolutionMemory[]) => {
  const recovery = deriveRecoveryTimingSignals(behavioral, life, memories);
  const cadence = deriveCadenceTransitionSignals(behavioral, life, memories);
  return {
    ...recovery,
    ...cadence,
    momentumRecoveryTiming: clamp01(behavioral.momentumRecoveryScore * 0.6 + recovery.recoveryCycleEfficiency * 0.4),
    stabilizationDurationQuality: clamp01((1 - life.stabilizationNeedScore) * 0.3 + cadence.cadenceTransitionStability * 0.35 + recovery.continuityReboundWindow * 0.35),
  };
};
