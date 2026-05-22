import type { AdaptiveNutritionIdentity } from '../personality-modeling/personalityTypes';
import type { LongitudinalPlanningSnapshot } from './adaptationTypes';

export const ADAPTIVE_PLANNER_STORAGE_KEYS = {
  longitudinalSnapshots: 'mealPlanner.longitudinalHistory.v1',
  nutritionPersonalityMemory: 'mealPlanner.nutritionPersonality.v1',
} as const;

export type PlannerObjectiveHistoryRecord = {
  id: string;
  observedAt: string;
  objectiveKey: string;
  message: string;
  source: 'objective' | 'recommendation' | 'personality';
  scoreDelta?: number;
};

export type RelationshipLearningHistoryRecord = {
  id: string;
  observedAt: string;
  weekKey?: string;
  successfulChains: number;
  abandonedChains: number;
  successRate: number;
  notes: string[];
};

export type AdaptiveNutritionPersonalityMemoryRecord = {
  id: string;
  observedAt: string;
  message: string;
};

export type AdaptivePlannerProfileSnapshot = {
  id: string;
  observedAt: string;
  profileVersion: 'v1';
  nutritionPersonality?: AdaptiveNutritionIdentity;
  objectiveHistory: PlannerObjectiveHistoryRecord[];
  relationshipLearningHistory: RelationshipLearningHistoryRecord[];
};

export type AdaptivePlannerPersistenceSnapshot = {
  profile: AdaptivePlannerProfileSnapshot;
  longitudinalSnapshots: LongitudinalPlanningSnapshot[];
  nutritionPersonalityMemory: AdaptiveNutritionPersonalityMemoryRecord[];
};
