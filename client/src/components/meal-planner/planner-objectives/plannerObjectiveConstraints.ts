import type { PlannerObjectiveMetrics, PlannerObjectiveProfile } from './plannerObjectiveTypes';

export const applyObjectiveBalanceConstraints = (profile: PlannerObjectiveProfile): PlannerObjectiveProfile => {
  const constrained = { ...profile };
  const cap = 0.22;
  const floor = 0.03;
  (Object.keys(constrained) as Array<keyof PlannerObjectiveProfile>).forEach((key) => {
    constrained[key] = Math.min(cap, Math.max(floor, constrained[key]));
  });
  if (constrained.continuity > constrained.variety * 1.8) constrained.continuity = constrained.variety * 1.8;
  if (constrained.prepEfficiency > constrained.freshnessTiming * 2.2) constrained.prepEfficiency = constrained.freshnessTiming * 2.2;
  if (constrained.pantryReuse > constrained.macroQuality * 1.9) constrained.pantryReuse = constrained.macroQuality * 1.9;
  const total = Object.values(constrained).reduce((a, b) => a + b, 0) || 1;
  return Object.fromEntries(Object.entries(constrained).map(([k, v]) => [k, v / total])) as PlannerObjectiveProfile;
};

export const detectObjectiveOverfitting = (metrics: PlannerObjectiveMetrics) => {
  const messages: string[] = [];
  if (metrics.continuity > 85 && metrics.variety < 45) messages.push('Continuity is high while variety is lagging.');
  if (metrics.prepEfficiency > 80 && metrics.freshnessTiming < 45) messages.push('Prep reuse is elevated while freshness timing is weak.');
  if (metrics.pantryReuse > 80 && metrics.macroQuality < 50) messages.push('Pantry reuse is outpacing macro quality.');
  return messages;
};

export const calculateOptimizationTradeoffBalance = (metrics: PlannerObjectiveMetrics) => {
  const penalties = [
    Math.max(0, metrics.continuity - metrics.variety),
    Math.max(0, metrics.prepEfficiency - metrics.freshnessTiming),
    Math.max(0, metrics.pantryReuse - metrics.macroQuality),
  ];
  return Math.max(0, Math.min(100, 100 - Math.round((penalties[0] * 0.35) + (penalties[1] * 0.35) + (penalties[2] * 0.3))));
};
