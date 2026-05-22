import type { LongitudinalPlanningSnapshot } from '../planner-adaptation/adaptationTypes';
import type { CookingIdentityProfile } from './personalityTypes';

const clamp = (v: number, min = 0, max = 1) => Math.max(min, Math.min(max, v));

export const calculateCookingEngagement = (history: LongitudinalPlanningSnapshot[]) => {
  if (!history.length) return 0.5;
  return clamp(history.reduce((sum, entry) => sum + ((entry.prepCompletionRate + entry.readinessAverage) / 2), 0) / history.length);
};

export const detectPrepResistancePatterns = (history: LongitudinalPlanningSnapshot[]) => {
  if (!history.length) return 0.5;
  return clamp(history.reduce((sum, entry) => sum + (entry.complexityLoad * (1 - entry.prepCompletionRate)), 0) / history.length);
};

export const deriveCookingIdentityProfile = (history: LongitudinalPlanningSnapshot[]): CookingIdentityProfile => {
  const cookingEngagement = calculateCookingEngagement(history);
  const prepResistance = detectPrepResistancePatterns(history);
  const weeknightComplexityTolerance = clamp(1 - prepResistance);
  const weekendPrepEnthusiasm = clamp(cookingEngagement * 0.7 + (1 - history.reduce((sum, entry) => sum + entry.lateWeekDropoff, 0) / Math.max(1, history.length)) * 0.3);
  const modularMealPreference = clamp((1 - prepResistance) * 0.5 + history.reduce((sum, entry) => sum + entry.continuityScore, 0) / Math.max(1, history.length) * 0.5);
  return { cookingEngagement, prepResistance, weeknightComplexityTolerance, weekendPrepEnthusiasm, modularMealPreference };
};
