import { type LongitudinalPlanningSnapshot, type SustainabilityProfile } from './adaptationTypes';

const clamp = (v: number, min = 0, max = 1) => Math.max(min, Math.min(max, v));

export const detectUnsustainablePlanningPatterns = (history: LongitudinalPlanningSnapshot[]) => {
  const patterns: string[] = [];
  const recent = history.slice(-4);
  if (!recent.length) return patterns;
  if (recent.filter((entry) => entry.prepCompletionRate < 0.5).length >= 2) patterns.push('Prep load is consistently exceeding sustainable execution.');
  if (recent.filter((entry) => entry.lateWeekDropoff > 0.4).length >= 2) patterns.push('Late-week adherence dropoff is recurring.');
  if (recent.filter((entry) => entry.groceryCompletionRate < 0.55).length >= 2) patterns.push('Grocery completion is below sustainable levels.');
  return patterns;
};

export const calculateSustainabilityScore = (history: LongitudinalPlanningSnapshot[]) => {
  if (!history.length) return 0.5;
  const recent = history.slice(-6);
  const prep = recent.reduce((sum, entry) => sum + entry.prepCompletionRate, 0) / recent.length;
  const grocery = recent.reduce((sum, entry) => sum + entry.groceryCompletionRate, 0) / recent.length;
  const hydration = recent.reduce((sum, entry) => sum + entry.hydrationAdherence, 0) / recent.length;
  const fatigue = recent.reduce((sum, entry) => sum + entry.fatigueAverage, 0) / recent.length;
  const dropoff = recent.reduce((sum, entry) => sum + entry.lateWeekDropoff, 0) / recent.length;
  return clamp((prep * 0.25) + (grocery * 0.25) + (hydration * 0.15) + ((1 - fatigue) * 0.2) + ((1 - dropoff) * 0.15));
};

export const deriveSustainablePlanningProfile = (history: LongitudinalPlanningSnapshot[]): SustainabilityProfile => {
  const score = calculateSustainabilityScore(history);
  const patterns = detectUnsustainablePlanningPatterns(history);
  const recent = history.slice(-6);
  const safeAverage = (selector: (entry: LongitudinalPlanningSnapshot) => number) => {
    if (!recent.length) return 0;
    return recent.reduce((sum, entry) => sum + selector(entry), 0) / recent.length;
  };

  return {
    sustainabilityScore: score,
    unsustainablePatterns: patterns,
    sustainableComplexityScore: clamp(safeAverage((entry) => entry.complexityLoad * entry.prepCompletionRate)),
    sustainablePrepLoad: safeAverage((entry) => entry.prepCompletionRate),
    sustainableGroceryCompletion: safeAverage((entry) => entry.groceryCompletionRate),
  };
};
