import type { LongitudinalPlanningSnapshot } from '../planner-adaptation/adaptationTypes';
import type { RecoveryComfortProfile } from './personalityTypes';

const clamp = (v: number, min = 0, max = 1) => Math.max(min, Math.min(max, v));

export const calculateFallbackMealEffectiveness = (history: LongitudinalPlanningSnapshot[]) => {
  if (!history.length) return 0.5;
  const rescueSignal = history.reduce((sum, entry) => sum + (entry.lateWeekDropoff > 0.4 ? entry.completedMeals / Math.max(1, entry.completedMeals + entry.skippedMeals) : 0), 0) / history.length;
  return clamp(rescueSignal);
};

export const detectComfortMealStabilizers = (history: LongitudinalPlanningSnapshot[]) => {
  const stabilizers: string[] = [];
  const fallbackEffectiveness = calculateFallbackMealEffectiveness(history);
  if (fallbackEffectiveness > 0.55) stabilizers.push('Comfort-style bowl meals improved late-week adherence.');
  const continuity = history.reduce((sum, entry) => sum + entry.continuityScore, 0) / Math.max(1, history.length);
  if (continuity > 0.6) stabilizers.push('Recovery-friendly continuity is stabilizing lower-energy days.');
  if (!stabilizers.length) stabilizers.push('Low-effort fallback meals remain a useful recovery anchor.');
  return stabilizers;
};

export const deriveRecoveryMealPatterns = (history: LongitudinalPlanningSnapshot[]): RecoveryComfortProfile => {
  const fallbackMealEffectiveness = calculateFallbackMealEffectiveness(history);
  const lowEnergyFallbackBias = clamp(history.reduce((sum, entry) => sum + (entry.fatigueAverage * entry.prepCompletionRate), 0) / Math.max(1, history.length));
  const recoveryMealTendency = clamp((fallbackMealEffectiveness + lowEnergyFallbackBias) / 2);
  const comfortMealStabilizers = detectComfortMealStabilizers(history);
  return { recoveryMealTendency, comfortMealStabilizers, fallbackMealEffectiveness, lowEnergyFallbackBias };
};
