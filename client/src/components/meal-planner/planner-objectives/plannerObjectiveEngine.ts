import { derivePlannerObjectiveProfile, normalizeObjectiveWeights } from './plannerObjectiveProfiles';
import { applyObjectiveBalanceConstraints, calculateOptimizationTradeoffBalance, detectObjectiveOverfitting } from './plannerObjectiveConstraints';
import { calculateObjectiveContributionBreakdown, calculatePlannerObjectiveMetrics, calculateUnifiedPlannerObjectiveScore, deriveObjectiveOptimizationSummary } from './plannerObjectiveScoring';
import type { ObjectiveMode, PlannerObjectiveEvaluation, PlannerObjectiveProfile } from './plannerObjectiveTypes';

export const evaluatePlannerObjectives = (params: {
  weeklyMeals: Record<string, any>;
  weekDays: readonly string[];
  mealTypes: readonly string[];
  mode: ObjectiveMode;
  proteinGoal?: number;
  profileOverrides?: Partial<PlannerObjectiveProfile>;
  baselineWeeklyMeals?: Record<string, any>;
}): PlannerObjectiveEvaluation => {
  const profile = derivePlannerObjectiveProfile(params.mode, params.profileOverrides);
  const normalizedProfile = normalizeObjectiveWeights(profile);
  const constrainedProfile = applyObjectiveBalanceConstraints(normalizedProfile);
  const metrics = calculatePlannerObjectiveMetrics(params.weeklyMeals, params.weekDays, params.mealTypes, params.proteinGoal || 0);
  const baseline = params.baselineWeeklyMeals
    ? calculatePlannerObjectiveMetrics(params.baselineWeeklyMeals, params.weekDays, params.mealTypes, params.proteinGoal || 0)
    : undefined;
  const contributions = calculateObjectiveContributionBreakdown(metrics, constrainedProfile, baseline);
  const score = calculateUnifiedPlannerObjectiveScore(metrics, constrainedProfile);
  const overfittingSignals = detectObjectiveOverfitting(metrics);
  const tradeoffBalance = calculateOptimizationTradeoffBalance(metrics);
  return { profile, normalizedProfile, constrainedProfile, score, metrics, contributions, overfittingSignals, tradeoffBalance };
};

export const summarizeObjectiveImprovements = (beforeMeals: Record<string, any>, afterMeals: Record<string, any>, weekDays: readonly string[], mealTypes: readonly string[], mode: ObjectiveMode, proteinGoal = 0) => {
  const before = evaluatePlannerObjectives({ weeklyMeals: beforeMeals, weekDays, mealTypes, mode, proteinGoal });
  const after = evaluatePlannerObjectives({ weeklyMeals: afterMeals, weekDays, mealTypes, mode, proteinGoal, baselineWeeklyMeals: beforeMeals });
  return {
    before,
    after,
    summary: deriveObjectiveOptimizationSummary(before.metrics, after.metrics),
  };
};
