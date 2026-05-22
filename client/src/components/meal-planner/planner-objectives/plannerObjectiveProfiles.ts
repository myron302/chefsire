import type { ObjectiveMode, PlannerObjectiveProfile } from './plannerObjectiveTypes';

const BALANCED_PROFILE: PlannerObjectiveProfile = {
  continuity: 1,
  variety: 1,
  fatigue: 1,
  prepEfficiency: 1,
  groceryEfficiency: 1,
  freshnessTiming: 1,
  recoverySpacing: 1,
  readiness: 1,
  planningCompleteness: 1,
  momentum: 1,
  pantryReuse: 1,
  macroQuality: 1,
  temporalFlow: 1,
};

const MODE_MULTIPLIERS: Record<ObjectiveMode, Partial<PlannerObjectiveProfile>> = {
  balanced: {},
  'high-protein': { macroQuality: 1.5, readiness: 1.2 },
  'budget-friendly': { groceryEfficiency: 1.35, pantryReuse: 1.25 },
  'minimal-prep': { prepEfficiency: 1.45, fatigue: 1.2, recoverySpacing: 1.15 },
  'pantry-reuse': { pantryReuse: 1.5, groceryEfficiency: 1.2, freshnessTiming: 0.9 },
  'variety-focused': { variety: 1.5, fatigue: 1.25, continuity: 0.9 },
  'grocery-efficient': { groceryEfficiency: 1.5, freshnessTiming: 1.2, pantryReuse: 1.2 },
  'recovery-focused': { recoverySpacing: 1.5, fatigue: 1.25, temporalFlow: 1.2 },
};

export const normalizeObjectiveWeights = (profile: PlannerObjectiveProfile): PlannerObjectiveProfile => {
  const total = Object.values(profile).reduce((sum, value) => sum + Math.max(0, value), 0) || 1;
  return Object.fromEntries(Object.entries(profile).map(([key, value]) => [key, Math.max(0, value) / total])) as PlannerObjectiveProfile;
};

export const deriveAdaptiveObjectiveWeights = (mode: ObjectiveMode, overrides?: Partial<PlannerObjectiveProfile>) => {
  const multipliers = MODE_MULTIPLIERS[mode] || {};
  const profile = { ...BALANCED_PROFILE };
  (Object.keys(profile) as Array<keyof PlannerObjectiveProfile>).forEach((key) => {
    profile[key] = profile[key] * (multipliers[key] || 1) * (overrides?.[key] || 1);
  });
  return normalizeObjectiveWeights(profile);
};

export const derivePlannerObjectiveProfile = (mode: ObjectiveMode, overrides?: Partial<PlannerObjectiveProfile>) => {
  return deriveAdaptiveObjectiveWeights(mode, overrides);
};
