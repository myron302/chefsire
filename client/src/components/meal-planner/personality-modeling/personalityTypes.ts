import type { LongitudinalPlanningSnapshot } from '../planner-adaptation/adaptationTypes';

export type MealTypeAdherencePattern = Record<string, number>;

export type NutritionPersonalityProfile = {
  repetitiveBreakfastPreference: number;
  lunchContinuitySuccess: number;
  prepHeavyDinnerFatigue: number;
  comfortRecoveryTendency: number;
  lateWeekCookingAdherence: number;
  shoppingConsistency: number;
  mealTypeAdherence: MealTypeAdherencePattern;
};

export type BoredomProfile = {
  varietyTolerance: number;
  repetitionStability: number;
  continuityFatigueRisk: number;
  textureFatigueRisk: number;
  flavorFatigueRisk: number;
};

export type CookingIdentityProfile = {
  cookingEngagement: number;
  prepResistance: number;
  weeknightComplexityTolerance: number;
  weekendPrepEnthusiasm: number;
  modularMealPreference: number;
};

export type ScheduleVolatilityProfile = {
  weeklyStabilityMap: Record<string, number>;
  volatilePlanningZones: string[];
  scheduleVolatility: number;
  sundayResetStrength: number;
};

export type RecoveryComfortProfile = {
  recoveryMealTendency: number;
  comfortMealStabilizers: string[];
  fallbackMealEffectiveness: number;
  lowEnergyFallbackBias: number;
};

export type AdaptiveNutritionIdentity = {
  personality: NutritionPersonalityProfile;
  boredom: BoredomProfile;
  cookingIdentity: CookingIdentityProfile;
  scheduleVolatility: ScheduleVolatilityProfile;
  recoveryComfort: RecoveryComfortProfile;
  adaptivePreferenceMemory: Array<{ key: string; score: number; observedAt: string }>;
  historyWindowUsed: LongitudinalPlanningSnapshot[];
};
