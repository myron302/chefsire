import type { LongitudinalPlanningSnapshot } from '../planner-adaptation/adaptationTypes';
import type { BoredomProfile } from './personalityTypes';

const clamp = (v: number, min = 0, max = 1) => Math.max(min, Math.min(max, v));

export const deriveVarietyTolerance = (history: LongitudinalPlanningSnapshot[]) => {
  if (!history.length) return 0.5;
  const averageRepetition = history.reduce((sum, entry) => sum + entry.repeatedMeals, 0) / history.length;
  const repetitionLoad = clamp(averageRepetition / 8);
  const continuitySupport = clamp(history.reduce((sum, entry) => sum + entry.continuityScore, 0) / history.length);
  return clamp((1 - repetitionLoad) * 0.6 + continuitySupport * 0.4);
};

export const deriveRepetitionStability = (history: LongitudinalPlanningSnapshot[]) => {
  if (history.length < 2) return 0.5;
  const sorted = [...history].slice(-8);
  const firstHalf = sorted.slice(0, Math.floor(sorted.length / 2));
  const secondHalf = sorted.slice(Math.floor(sorted.length / 2));
  const avg = (items: LongitudinalPlanningSnapshot[]) => items.reduce((sum, item) => sum + item.repeatedMeals, 0) / Math.max(1, items.length);
  const delta = Math.abs(avg(secondHalf) - avg(firstHalf));
  return clamp(1 - delta / 6);
};

export const detectContinuityFatigue = (history: LongitudinalPlanningSnapshot[]) => {
  if (!history.length) return 0;
  const fatigueCoupling = history.reduce((sum, entry) => sum + (entry.continuityScore * entry.lateWeekDropoff), 0) / history.length;
  return clamp(fatigueCoupling);
};

export const calculateMealBoredomRisk = (history: LongitudinalPlanningSnapshot[]): BoredomProfile => {
  const varietyTolerance = deriveVarietyTolerance(history);
  const repetitionStability = deriveRepetitionStability(history);
  const continuityFatigueRisk = detectContinuityFatigue(history);
  const textureFatigueRisk = clamp((1 - repetitionStability) * 0.65 + continuityFatigueRisk * 0.35);
  const flavorFatigueRisk = clamp((1 - varietyTolerance) * 0.7 + continuityFatigueRisk * 0.3);
  return { varietyTolerance, repetitionStability, continuityFatigueRisk, textureFatigueRisk, flavorFatigueRisk };
};
