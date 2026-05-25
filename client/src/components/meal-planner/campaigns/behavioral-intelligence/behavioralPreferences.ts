import type { NutritionBehavioralIntelligenceProfile } from '@/components/meal-planner/campaigns/behavioral-intelligence/behavioralIntelligenceProfile';

export const deriveBehavioralStrengths = (profile: NutritionBehavioralIntelligenceProfile): string[] => {
  const strengths: string[] = [];
  if (profile.continuityPreferenceScore >= 0.7) strengths.push('Strong continuity preference');
  if (profile.recoveryStabilizationScore >= 0.65) strengths.push('High recovery responsiveness');
  if (profile.cadenceStabilityScore >= 0.65) strengths.push('Cadence stability is reliable');
  if (profile.sustainabilityResilienceScore >= 0.65) strengths.push('Sustainability resilience is improving');
  return strengths;
};

export const deriveBehavioralSensitivitySignals = (profile: NutritionBehavioralIntelligenceProfile): string[] => {
  const signals: string[] = [];
  if (profile.noveltyToleranceScore < 0.45) signals.push('Low novelty tolerance');
  if (profile.prepToleranceScore < 0.5) signals.push('Prep-sensitive scheduling');
  if (profile.momentumRecoveryScore < 0.5) signals.push('Momentum recovery needs tighter support');
  if (profile.failedStrategyPatterns[0]) signals.push(`Watch recurring friction: ${profile.failedStrategyPatterns[0]}`);
  return signals;
};

export const deriveBehavioralPreferenceNarratives = (profile: NutritionBehavioralIntelligenceProfile): string[] => {
  const narratives = [...deriveBehavioralStrengths(profile), ...deriveBehavioralSensitivitySignals(profile)];
  if (profile.semanticRefreshResponsiveness >= 0.65) narratives.push('Responds well to semantic refresh');
  if (!narratives.length) narratives.push('Behavioral profile is still calibrating across campaigns');
  return narratives;
};
