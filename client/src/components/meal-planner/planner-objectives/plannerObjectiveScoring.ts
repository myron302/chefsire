import { calculateWeeklyScores } from '../auto-planner/autoPlannerScoring';
import { calculateRelationshipEfficiencyScore } from '../meal-relationships/relationshipGraph';
import { scoreRelationshipDrivenWeek } from '../meal-relationships/relationshipDrivenPlanning';
import { calculateRecoverySpacing, analyzeWeeklyVarietyRhythm } from '../auto-planner/autoPlannerTradeoffAnalysis';
import { calculateWeeklyPlannerStress, calculateGroceryFragmentation, calculateIngredientOverlapScore, calculatePantryReuseEfficiency, calculateMealFatigueScore } from '../auto-planner/autoPlannerOptimizationEngine';
import { calculateFreshnessFlowScore, calculateTemporalFlowScore } from '../auto-planner/autoPlannerRhythmEngine';
import { getMealsForSlot } from '../planner-graph/plannerGraphUtils';
import type { ObjectiveContribution, PlannerObjectiveMetrics, PlannerObjectiveProfile } from './plannerObjectiveTypes';

const clamp = (v: number) => Math.max(0, Math.min(100, Math.round(v)));
const gatherMeals = (weeklyMeals: Record<string, any>, weekDays: readonly string[], mealTypes: readonly string[]) => weekDays.flatMap((d) => mealTypes.flatMap((m) => getMealsForSlot(weeklyMeals, d, m))).filter(Boolean);

export const calculatePlannerObjectiveMetrics = (weeklyMeals: Record<string, any>, weekDays: readonly string[], mealTypes: readonly string[], proteinGoal = 0): PlannerObjectiveMetrics => {
  const meals = gatherMeals(weeklyMeals, weekDays, mealTypes);
  const relationshipGraph = calculateRelationshipEfficiencyScore(weeklyMeals);
  const relationshipWeek = scoreRelationshipDrivenWeek(weeklyMeals, weekDays, mealTypes);
  const weeklyScores = calculateWeeklyScores(weeklyMeals, weekDays, mealTypes, proteinGoal);
  const freshnessFlow = calculateFreshnessFlowScore(weeklyMeals, weekDays, mealTypes);
  const temporalFlow = calculateTemporalFlowScore(weeklyMeals, weekDays, mealTypes);
  const completeness = weekDays.length * mealTypes.length ? (meals.length / (weekDays.length * mealTypes.length)) * 100 : 0;
  return {
    continuity: clamp((relationshipGraph.continuityScore * 0.6) + (relationshipWeek.continuityScore * 0.4)),
    variety: clamp(analyzeWeeklyVarietyRhythm(weeklyMeals, weekDays, mealTypes)),
    fatigue: clamp(100 - calculateMealFatigueScore(meals)),
    prepEfficiency: clamp(100 - Math.min(100, calculateWeeklyPlannerStress(weeklyMeals, weekDays, mealTypes) * 5)),
    groceryEfficiency: clamp(100 - calculateGroceryFragmentation(meals)),
    freshnessTiming: clamp(freshnessFlow),
    recoverySpacing: clamp(calculateRecoverySpacing(weeklyMeals, weekDays, mealTypes)),
    readiness: clamp(weeklyScores.readinessScore),
    planningCompleteness: clamp(completeness),
    momentum: clamp(calculateIngredientOverlapScore(meals)),
    pantryReuse: clamp(calculatePantryReuseEfficiency(meals)),
    macroQuality: clamp(weeklyScores.proteinCoverageScore),
    temporalFlow: clamp(temporalFlow),
  };
};

export const calculateObjectiveContributionBreakdown = (metrics: PlannerObjectiveMetrics, profile: PlannerObjectiveProfile, baseline?: PlannerObjectiveMetrics): ObjectiveContribution[] => (
  (Object.keys(profile) as Array<keyof PlannerObjectiveProfile>).map((key) => ({
    key,
    weight: profile[key],
    value: metrics[key],
    weightedScore: metrics[key] * profile[key],
    deltaFromBaseline: baseline ? metrics[key] - baseline[key] : undefined,
  })).sort((a, b) => b.weightedScore - a.weightedScore)
);

export const calculateUnifiedPlannerObjectiveScore = (metrics: PlannerObjectiveMetrics, profile: PlannerObjectiveProfile) => {
  const score = Object.keys(profile).reduce((sum, key) => sum + (metrics[key as keyof PlannerObjectiveProfile] * profile[key as keyof PlannerObjectiveProfile]), 0);
  return clamp(score);
};

export const deriveObjectiveOptimizationSummary = (before: PlannerObjectiveMetrics, after: PlannerObjectiveMetrics) => {
  const deltas = Object.keys(after).map((key) => ({ key, delta: after[key as keyof PlannerObjectiveMetrics] - before[key as keyof PlannerObjectiveMetrics] }));
  return deltas
    .filter((d) => Math.abs(d.delta) >= 3)
    .sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta))
    .slice(0, 5)
    .map((d) => `${d.key} ${d.delta >= 0 ? '+' : ''}${Math.round(d.delta)}`);
};
