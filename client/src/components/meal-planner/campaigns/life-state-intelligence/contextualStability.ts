import type { NutritionCampaignEvolutionMemory } from '@/components/meal-planner/campaigns/evolution/campaignEvolutionMemory';
import type { NutritionLifeStateProfile } from '@/components/meal-planner/campaigns/life-state-intelligence/lifeStateProfile';

const clamp01 = (value: number): number => Math.max(0, Math.min(1, value));

export const deriveRecoveryStabilizationWindows = (profile: NutritionLifeStateProfile): string[] => {
  const windows: string[] = [];
  if (profile.recoveryPressureScore >= 0.55) windows.push('Prioritize 2-3 day stabilization windows after disruption spikes.');
  if (profile.energyConsistencyScore <= 0.45) windows.push('Use low-energy recovery windows with repeated safe meals.');
  if (profile.scheduleVolatilityScore <= 0.4) windows.push('Leverage stable days for prep rebound windows.');
  return windows;
};

export const deriveVolatilityRecoveryPatterns = (memories: NutritionCampaignEvolutionMemory[]) => {
  const disruption = memories.filter((item) => item.prepStabilitySignals.includes('prep-overload-watch')).length;
  const recoveries = memories.filter((item) => item.recoveryInterventions.length > 0).length;
  const reboundRatio = memories.length ? recoveries / memories.length : 0;
  return {
    disruptionEpisodes: disruption,
    recoveryEpisodes: recoveries,
    reboundRatio: clamp01(reboundRatio),
    burnoutCycleRisk: clamp01(disruption / Math.max(1, memories.length) * 0.6 + (1 - reboundRatio) * 0.4),
  };
};

export const deriveContextualStabilityProfile = (profile: NutritionLifeStateProfile, memories: NutritionCampaignEvolutionMemory[]) => {
  const volatilityPatterns = deriveVolatilityRecoveryPatterns(memories);
  const stabilizationTrend = clamp01(1 - profile.scheduleVolatilityScore * 0.5 - profile.stabilizationNeedScore * 0.3 + profile.energyConsistencyScore * 0.2);
  return {
    stabilizationTrend,
    recoveryReboundStrength: volatilityPatterns.reboundRatio,
    burnoutCycleRisk: volatilityPatterns.burnoutCycleRisk,
    prepRecoveryWindowOpen: profile.timeScarcityScore < 0.55 && profile.burnoutPressureScore < 0.6,
  };
};
