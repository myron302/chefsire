import type { ObjectiveContribution, PlannerObjectiveMetrics } from './plannerObjectiveTypes';

export const formatObjectiveDeltaInsight = (key: string, delta: number) => {
  if (Math.abs(delta) < 2) return `${key} stable`;
  return `${key} ${delta > 0 ? 'improved' : 'declined'} by ${Math.abs(Math.round(delta))}%`;
};

export const deriveObjectiveContributionChips = (contributions: ObjectiveContribution[]) => contributions
  .slice(0, 6)
  .map((contribution) => `${contribution.key} +${Math.round(contribution.weightedScore)}`);

export const deriveObjectiveOptimizationSummary = (before: PlannerObjectiveMetrics, after: PlannerObjectiveMetrics) => {
  return (Object.keys(after) as Array<keyof PlannerObjectiveMetrics>)
    .map((key) => formatObjectiveDeltaInsight(key, after[key] - before[key]))
    .slice(0, 8);
};
