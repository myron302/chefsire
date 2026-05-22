import type { AutoPlannerMode } from '../auto-planner/autoPlannerTypes';

export type PlannerObjectiveKey =
  | 'continuity'
  | 'variety'
  | 'fatigue'
  | 'prepEfficiency'
  | 'groceryEfficiency'
  | 'freshnessTiming'
  | 'recoverySpacing'
  | 'readiness'
  | 'planningCompleteness'
  | 'momentum'
  | 'pantryReuse'
  | 'macroQuality'
  | 'temporalFlow';

export type PlannerObjectiveProfile = Record<PlannerObjectiveKey, number>;

export type ObjectiveMode = AutoPlannerMode | 'balanced';

export type PlannerObjectiveMetrics = Record<PlannerObjectiveKey, number>;

export type ObjectiveContribution = {
  key: PlannerObjectiveKey;
  weight: number;
  value: number;
  weightedScore: number;
  deltaFromBaseline?: number;
};

export type PlannerObjectiveEvaluation = {
  profile: PlannerObjectiveProfile;
  normalizedProfile: PlannerObjectiveProfile;
  constrainedProfile: PlannerObjectiveProfile;
  score: number;
  metrics: PlannerObjectiveMetrics;
  contributions: ObjectiveContribution[];
  overfittingSignals: string[];
  tradeoffBalance: number;
};
