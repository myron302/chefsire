import type { NutritionBehavioralIntelligenceProfile } from '@/components/meal-planner/campaigns/behavioral-intelligence/behavioralIntelligenceProfile';
import type { NutritionCampaignEvolutionMemory } from '@/components/meal-planner/campaigns/evolution/campaignEvolutionMemory';

export type NutritionLifeStateSignals = {
  repeatedPrepFailures: number;
  continuityCollapse: number;
  cadenceInstability: number;
  reducedAdherenceVelocity: number;
  repeatedRecoveryInterventions: number;
  lateWeekFatiguePattern: number;
  lowPrepResilience: number;
};

const clamp01 = (value: number): number => Math.max(0, Math.min(1, value));

export const deriveLifeStateSignals = (
  behavioral: NutritionBehavioralIntelligenceProfile,
  memories: NutritionCampaignEvolutionMemory[],
): NutritionLifeStateSignals => {
  const prepWatchRate = memories.length
    ? memories.filter((item) => item.prepStabilitySignals.includes('prep-overload-watch')).length / memories.length
    : 0;
  const failedPrepStrategies = memories.flatMap((item) => item.failedStrategies).filter((item) => item.includes('prep')).length;
  const recoveryDensity = memories.length ? memories.flatMap((item) => item.recoveryInterventions).length / memories.length : 0;
  const avgMomentum = memories.length
    ? memories.reduce((sum, item) => sum + (item.momentumHistory[item.momentumHistory.length - 1] ?? 0.5), 0) / memories.length
    : behavioral.momentumRecoveryScore;

  return {
    repeatedPrepFailures: clamp01(prepWatchRate * 0.65 + Math.min(failedPrepStrategies, 10) / 10 * 0.35),
    continuityCollapse: clamp01(1 - behavioral.continuityPreferenceScore),
    cadenceInstability: clamp01(1 - behavioral.cadenceStabilityScore),
    reducedAdherenceVelocity: clamp01(1 - behavioral.sustainabilityResilienceScore * 0.6 - avgMomentum * 0.4),
    repeatedRecoveryInterventions: clamp01(recoveryDensity / 3),
    lateWeekFatiguePattern: clamp01((1 - behavioral.momentumRecoveryScore) * 0.6 + (1 - behavioral.prepToleranceScore) * 0.4),
    lowPrepResilience: clamp01((1 - behavioral.prepToleranceScore) * 0.7 + prepWatchRate * 0.3),
  };
};

export const deriveContextualStressSignals = (signals: NutritionLifeStateSignals) => ({
  burnoutPressure: clamp01(signals.lateWeekFatiguePattern * 0.5 + signals.repeatedRecoveryInterventions * 0.3 + signals.reducedAdherenceVelocity * 0.2),
  recoveryPressure: clamp01(signals.repeatedRecoveryInterventions * 0.6 + signals.continuityCollapse * 0.4),
  timeScarcityPressure: clamp01(signals.repeatedPrepFailures * 0.5 + signals.lowPrepResilience * 0.5),
});

export const deriveEnvironmentalVolatilitySignals = (signals: NutritionLifeStateSignals) => ({
  scheduleVolatility: clamp01(signals.cadenceInstability * 0.6 + signals.continuityCollapse * 0.4),
  householdDisruption: clamp01(signals.continuityCollapse * 0.45 + signals.repeatedPrepFailures * 0.35 + signals.repeatedRecoveryInterventions * 0.2),
  shoppingInstability: clamp01(signals.repeatedPrepFailures * 0.55 + signals.reducedAdherenceVelocity * 0.45),
  socialDisruption: clamp01(signals.cadenceInstability * 0.5 + signals.reducedAdherenceVelocity * 0.5),
});
