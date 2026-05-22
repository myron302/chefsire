import type { LongitudinalPlanningSnapshot } from '../planner-adaptation/adaptationTypes';
import { calculateMealBoredomRisk } from './boredomModeling';
import { deriveCookingIdentityProfile } from './cookingIdentity';
import { deriveRecoveryMealPatterns } from './recoveryPatterns';
import { deriveScheduleVolatilityProfile } from './scheduleVolatility';
import type { AdaptiveNutritionIdentity, MealTypeAdherencePattern, NutritionPersonalityProfile } from './personalityTypes';

const clamp = (v: number, min = 0, max = 1) => Math.max(min, Math.min(max, v));

export const deriveBehavioralMealPreferences = (history: LongitudinalPlanningSnapshot[]): MealTypeAdherencePattern => {
  if (!history.length) return { breakfast: 0.5, lunch: 0.5, dinner: 0.5 };
  const adherence = history.reduce((sum, entry) => sum + entry.completedMeals / Math.max(1, entry.completedMeals + entry.skippedMeals), 0) / history.length;
  return {
    breakfast: clamp(adherence * 0.95 + 0.05),
    lunch: clamp(adherence),
    dinner: clamp(adherence - history.reduce((sum, entry) => sum + entry.lateWeekDropoff, 0) / history.length * 0.2),
  };
};

export const deriveRoutineStabilityProfile = (history: LongitudinalPlanningSnapshot[]) => {
  if (!history.length) return 0.5;
  const continuity = history.reduce((sum, entry) => sum + entry.continuityScore, 0) / history.length;
  const dropoffPenalty = history.reduce((sum, entry) => sum + entry.lateWeekDropoff, 0) / history.length;
  return clamp(continuity * 0.7 + (1 - dropoffPenalty) * 0.3);
};

export const deriveNutritionPersonalityProfile = (history: LongitudinalPlanningSnapshot[]): NutritionPersonalityProfile => {
  const mealTypeAdherence = deriveBehavioralMealPreferences(history);
  const routineStability = deriveRoutineStabilityProfile(history);
  const prepHeavyDinnerFatigue = clamp(history.reduce((sum, entry) => sum + (entry.complexityLoad * entry.lateWeekDropoff), 0) / Math.max(1, history.length));
  return {
    repetitiveBreakfastPreference: clamp(routineStability * mealTypeAdherence.breakfast),
    lunchContinuitySuccess: clamp(mealTypeAdherence.lunch * routineStability),
    prepHeavyDinnerFatigue,
    comfortRecoveryTendency: clamp(history.reduce((sum, entry) => sum + entry.fatigueAverage, 0) / Math.max(1, history.length)),
    lateWeekCookingAdherence: clamp(1 - history.reduce((sum, entry) => sum + entry.lateWeekDropoff, 0) / Math.max(1, history.length)),
    shoppingConsistency: clamp(history.reduce((sum, entry) => sum + entry.groceryCompletionRate, 0) / Math.max(1, history.length)),
    mealTypeAdherence,
  };
};

export const buildAdaptiveNutritionIdentity = (history: LongitudinalPlanningSnapshot[]): AdaptiveNutritionIdentity => {
  const historyWindowUsed = history.slice(-12);
  const personality = deriveNutritionPersonalityProfile(historyWindowUsed);
  const boredom = calculateMealBoredomRisk(historyWindowUsed);
  const cookingIdentity = deriveCookingIdentityProfile(historyWindowUsed);
  const scheduleVolatility = deriveScheduleVolatilityProfile(historyWindowUsed);
  const recoveryComfort = deriveRecoveryMealPatterns(historyWindowUsed);
  const adaptivePreferenceMemory = [
    { key: 'breakfast-continuity', score: personality.repetitiveBreakfastPreference, observedAt: new Date().toISOString() },
    { key: 'dinner-fatigue-risk', score: personality.prepHeavyDinnerFatigue, observedAt: new Date().toISOString() },
    { key: 'comfort-recovery', score: recoveryComfort.recoveryMealTendency, observedAt: new Date().toISOString() },
    { key: 'variety-tolerance', score: boredom.varietyTolerance, observedAt: new Date().toISOString() },
  ].slice(-16);

  return { personality, boredom, cookingIdentity, scheduleVolatility, recoveryComfort, adaptivePreferenceMemory, historyWindowUsed };
};
