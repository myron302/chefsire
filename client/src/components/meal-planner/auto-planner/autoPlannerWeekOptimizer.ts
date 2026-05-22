import type { AutoPlannerMode } from './autoPlannerTypes';
import { simulateWeeklyArrangement } from './autoPlannerSimulationEngine';
import { calculateCompositeOptimizationScore, deriveOptimizationTradeoffs } from './autoPlannerTradeoffAnalysis';
import { scoreRelationshipDrivenWeek } from '../meal-relationships/relationshipDrivenPlanning';
import { evaluatePlannerObjectives } from '../planner-objectives/plannerObjectiveEngine';

export const compareWeeklyPlans = (a: Record<string, any>, b: Record<string, any>, weekDays: readonly string[], mealTypes: readonly string[]) => {
  const scoreA = calculateCompositeOptimizationScore(a, weekDays, mealTypes);
  const scoreB = calculateCompositeOptimizationScore(b, weekDays, mealTypes);
  if (scoreA === scoreB) return 0;
  return scoreA > scoreB ? -1 : 1;
};

export const scoreCandidateWeek = (weeklyMeals: Record<string, any>, weekDays: readonly string[], mealTypes: readonly string[]) => {
  const mode: AutoPlannerMode = 'balanced';
  const unified = evaluatePlannerObjectives({ weeklyMeals, weekDays, mealTypes, mode }).score;
  const core = calculateCompositeOptimizationScore(weeklyMeals, weekDays, mealTypes);
  const relationship = scoreRelationshipDrivenWeek(weeklyMeals, weekDays, mealTypes).score;
  return Math.round((unified * 0.7) + (Math.round((core * 0.7) + (relationship * 0.3)) * 0.3));
};

export const optimizeWeeklyIteration = (weeklyMeals: Record<string, any>, pool: any[], weekDays: readonly string[], mealTypes: readonly string[], mode: AutoPlannerMode, baseScoreMeal: (meal: any) => number) => {
  const candidates = simulateWeeklyArrangement(weeklyMeals, pool, weekDays, mealTypes, mode, baseScoreMeal);
  const ranked = [...candidates].sort((a, b) => compareWeeklyPlans(a, b, weekDays, mealTypes));
  const best = ranked[0] || weeklyMeals;
  return { best, score: scoreCandidateWeek(best, weekDays, mealTypes), evaluated: ranked.length };
};

export const runOptimizationPass = (weeklyMeals: Record<string, any>, pool: any[], weekDays: readonly string[], mealTypes: readonly string[], mode: AutoPlannerMode, baseScoreMeal: (meal: any) => number) => {
  return optimizeWeeklyIteration(weeklyMeals, pool, weekDays, mealTypes, mode, baseScoreMeal);
};

export const evolveWeeklyPlan = (weeklyMeals: Record<string, any>, pool: any[], weekDays: readonly string[], mealTypes: readonly string[], mode: AutoPlannerMode, baseScoreMeal: (meal: any) => number, iterations = 3) => {
  let current = weeklyMeals;
  let bestScore = scoreCandidateWeek(current, weekDays, mealTypes);
  let evaluatedWeeks = 1;

  for (let i = 0; i < iterations; i += 1) {
    const result = runOptimizationPass(current, pool, weekDays, mealTypes, mode, baseScoreMeal);
    evaluatedWeeks += result.evaluated;
    if (result.score <= bestScore) break;
    current = result.best;
    bestScore = result.score;
  }

  return { next: current, score: bestScore, evaluatedWeeks };
};

export const optimizeWeeklyRhythm = evolveWeeklyPlan;

export const summarizeOptimizationDeltas = (before: Record<string, any>, after: Record<string, any>, weekDays: readonly string[], mealTypes: readonly string[]) => {
  return deriveOptimizationTradeoffs(before, after, weekDays, mealTypes);
};
