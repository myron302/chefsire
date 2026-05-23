import type {
  AdaptiveNutritionPersonalityMemoryRecord,
  PlannerObjectiveHistoryRecord,
  RelationshipLearningHistoryRecord,
} from './adaptivePersistenceTypes';
import type { LongitudinalPlanningSnapshot } from './adaptationTypes';

export type AdaptiveSyncMetadata = {
  lastSyncedAt?: string;
  pendingSync: boolean;
  syncVersion: 'v1';
  localRevision: number;
  remoteRevision: number;
};

export type AdaptivePlannerHydrationState = {
  longitudinalSnapshots: LongitudinalPlanningSnapshot[];
  nutritionPersonalityMemory: AdaptiveNutritionPersonalityMemoryRecord[];
  objectiveHistory: PlannerObjectiveHistoryRecord[];
  relationshipLearningHistory: RelationshipLearningHistoryRecord[];
};

export type AdaptiveSyncEntityType = 'snapshot' | 'personalityMemory' | 'objectiveHistory' | 'relationshipLearning';

export type AdaptiveSyncQueueItem = {
  id: string;
  entityType: AdaptiveSyncEntityType;
  createdAt: string;
  retryCount: number;
  payload: unknown;
};
