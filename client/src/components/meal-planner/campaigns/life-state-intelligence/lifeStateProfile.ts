import type { NutritionBehavioralIntelligenceProfile } from '@/components/meal-planner/campaigns/behavioral-intelligence/behavioralIntelligenceProfile';
import type { NutritionCampaignEvolutionMemory } from '@/components/meal-planner/campaigns/evolution/campaignEvolutionMemory';
import { deriveContextualStressSignals, deriveEnvironmentalVolatilitySignals, deriveLifeStateSignals } from '@/components/meal-planner/campaigns/life-state-intelligence/lifeStateSignals';

export type NutritionLifeStateProfile = {
  scheduleVolatilityScore: number;
  timeScarcityScore: number;
  burnoutPressureScore: number;
  householdDisruptionScore: number;
  shoppingInstabilityScore: number;
  recoveryPressureScore: number;
  seasonalStressScore: number;
  energyConsistencyScore: number;
  socialDisruptionScore: number;
  stabilizationNeedScore: number;
  contextualConfidence: number;
  evolutionVersion: number;
  lastUpdatedAt: string;
};

const clamp01 = (value: number): number => Math.max(0, Math.min(1, value));
export const createDefaultLifeStateProfile = (): NutritionLifeStateProfile => ({
  scheduleVolatilityScore: 0.35,
  timeScarcityScore: 0.35,
  burnoutPressureScore: 0.3,
  householdDisruptionScore: 0.3,
  shoppingInstabilityScore: 0.3,
  recoveryPressureScore: 0.3,
  seasonalStressScore: 0.25,
  energyConsistencyScore: 0.55,
  socialDisruptionScore: 0.25,
  stabilizationNeedScore: 0.3,
  contextualConfidence: 0.2,
  evolutionVersion: 1,
  lastUpdatedAt: new Date().toISOString(),
});

export const deriveLifeStateProfile = (
  behavioral: NutritionBehavioralIntelligenceProfile,
  memories: NutritionCampaignEvolutionMemory[],
): NutritionLifeStateProfile => {
  const lifeSignals = deriveLifeStateSignals(behavioral, memories);
  const stress = deriveContextualStressSignals(lifeSignals);
  const volatility = deriveEnvironmentalVolatilitySignals(lifeSignals);
  const seasonalBurden = clamp01(lifeSignals.cadenceInstability * 0.4 + lifeSignals.lateWeekFatiguePattern * 0.6);
  const energyConsistency = clamp01(behavioral.momentumRecoveryScore * 0.6 + behavioral.sustainabilityResilienceScore * 0.4);
  const stabilizationNeed = clamp01((stress.recoveryPressure + volatility.scheduleVolatility + stress.burnoutPressure) / 3);

  return {
    scheduleVolatilityScore: volatility.scheduleVolatility,
    timeScarcityScore: stress.timeScarcityPressure,
    burnoutPressureScore: stress.burnoutPressure,
    householdDisruptionScore: volatility.householdDisruption,
    shoppingInstabilityScore: volatility.shoppingInstability,
    recoveryPressureScore: stress.recoveryPressure,
    seasonalStressScore: seasonalBurden,
    energyConsistencyScore: energyConsistency,
    socialDisruptionScore: volatility.socialDisruption,
    stabilizationNeedScore: stabilizationNeed,
    contextualConfidence: clamp01(behavioral.behavioralConfidence * 0.7 + Math.min(memories.length, 12) / 12 * 0.3),
    evolutionVersion: 1,
    lastUpdatedAt: new Date().toISOString(),
  };
};

export const updateLifeStateProfile = (
  previous: NutritionLifeStateProfile | null,
  behavioral: NutritionBehavioralIntelligenceProfile,
  memories: NutritionCampaignEvolutionMemory[],
): NutritionLifeStateProfile => {
  const derived = deriveLifeStateProfile(behavioral, memories);
  if (!previous) return derived;

  const smooth = (a: number, b: number): number => clamp01(a * 0.45 + b * 0.55);
  return {
    ...derived,
    scheduleVolatilityScore: smooth(previous.scheduleVolatilityScore, derived.scheduleVolatilityScore),
    timeScarcityScore: smooth(previous.timeScarcityScore, derived.timeScarcityScore),
    burnoutPressureScore: smooth(previous.burnoutPressureScore, derived.burnoutPressureScore),
    householdDisruptionScore: smooth(previous.householdDisruptionScore, derived.householdDisruptionScore),
    shoppingInstabilityScore: smooth(previous.shoppingInstabilityScore, derived.shoppingInstabilityScore),
    recoveryPressureScore: smooth(previous.recoveryPressureScore, derived.recoveryPressureScore),
    seasonalStressScore: smooth(previous.seasonalStressScore, derived.seasonalStressScore),
    energyConsistencyScore: smooth(previous.energyConsistencyScore, derived.energyConsistencyScore),
    socialDisruptionScore: smooth(previous.socialDisruptionScore, derived.socialDisruptionScore),
    stabilizationNeedScore: smooth(previous.stabilizationNeedScore, derived.stabilizationNeedScore),
    contextualConfidence: smooth(previous.contextualConfidence, derived.contextualConfidence),
    evolutionVersion: previous.evolutionVersion + 1,
    lastUpdatedAt: new Date().toISOString(),
  };
};
