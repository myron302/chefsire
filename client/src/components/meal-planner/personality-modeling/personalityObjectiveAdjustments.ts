import type { BehavioralOptimizationAdjustments } from '../planner-adaptation/adaptationTypes';
import type { AdaptiveNutritionIdentity } from './personalityTypes';

const clamp = (v: number, min = 0.7, max = 1.35) => Math.max(min, Math.min(max, v));

export const derivePersonalityObjectiveAdjustments = (identity: AdaptiveNutritionIdentity): BehavioralOptimizationAdjustments => {
  const dinnerFatigue = identity.personality.prepHeavyDinnerFatigue;
  const boredomRisk = identity.boredom.continuityFatigueRisk;
  const volatility = identity.scheduleVolatility.scheduleVolatility;
  const recoveryStrength = identity.recoveryComfort.fallbackMealEffectiveness;

  return {
    prepComplexityMultiplier: clamp(1 - dinnerFatigue * 0.3),
    continuityMultiplier: clamp(1 + (identity.personality.lunchContinuitySuccess - boredomRisk) * 0.2),
    temporalIntensityMultiplier: clamp(1 - volatility * 0.25),
    readinessBalanceBias: clamp(1 + recoveryStrength * 0.1, 0.8, 1.2),
    failedChainPenalty: clamp(1 - (boredomRisk * 0.15), 0.75, 1.2),
  };
};

export const derivePersonalityRecommendations = (identity: AdaptiveNutritionIdentity): string[] => {
  const notes: string[] = [];
  if (identity.personality.repetitiveBreakfastPreference > 0.65) notes.push('Breakfast continuity remains a strong adherence anchor.');
  if (identity.boredom.textureFatigueRisk > 0.55) notes.push('Rotating dinner textures improved completion stability.');
  if (identity.personality.prepHeavyDinnerFatigue > 0.55) notes.push('Prep-heavy Wednesday dinners continue reducing completion consistency.');
  if (identity.cookingIdentity.weekendPrepEnthusiasm > 0.6) notes.push('Weekend prep enthusiasm remains high.');
  if (identity.scheduleVolatility.volatilePlanningZones.includes('friday')) notes.push('Low-effort Friday meals improved sustainability.');
  notes.push(...identity.recoveryComfort.comfortMealStabilizers);
  return notes.slice(0, 10);
};
