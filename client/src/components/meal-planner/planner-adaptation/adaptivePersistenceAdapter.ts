import type {
  AdaptiveNutritionPersonalityMemoryRecord,
  AdaptivePlannerPersistenceSnapshot,
  PlannerObjectiveHistoryRecord,
  RelationshipLearningHistoryRecord,
} from './adaptivePersistenceTypes';
import { ADAPTIVE_PLANNER_STORAGE_KEYS } from './adaptivePersistenceTypes';
import type { LongitudinalPlanningSnapshot } from './adaptationTypes';

const MAX_LONGITUDINAL_HISTORY = 12;
const MAX_PERSONALITY_MEMORY = 24;

const readJsonArray = <T>(key: string): T[] => {
  if (typeof window === 'undefined') return [];
  try {
    const parsed = JSON.parse(window.localStorage.getItem(key) || '[]');
    return Array.isArray(parsed) ? (parsed as T[]) : [];
  } catch {
    return [];
  }
};

const writeJsonArray = <T>(key: string, value: T[]) => {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // no-op: persistence failures should not affect planner behavior
  }
};

export type AdaptivePlannerPersistenceAdapter = {
  getLongitudinalSnapshots: () => LongitudinalPlanningSnapshot[];
  putLongitudinalSnapshot: (snapshot: LongitudinalPlanningSnapshot) => void;
  getNutritionPersonalityMemory: () => AdaptiveNutritionPersonalityMemoryRecord[];
  appendNutritionPersonalityMemory: (records: AdaptiveNutritionPersonalityMemoryRecord[]) => void;
  // TODO(neon-api): add getAdaptivePlannerProfile and putAdaptivePlannerProfile endpoints.
  // TODO(neon-api): add getObjectiveHistory and putObjectiveHistory endpoints.
  // TODO(neon-api): add getRelationshipLearningHistory and putRelationshipLearningHistory endpoints.
  getObjectiveHistory: () => PlannerObjectiveHistoryRecord[];
  putObjectiveHistory: (_records: PlannerObjectiveHistoryRecord[]) => void;
  getRelationshipLearningHistory: () => RelationshipLearningHistoryRecord[];
  putRelationshipLearningHistory: (_records: RelationshipLearningHistoryRecord[]) => void;
  getSnapshot: () => AdaptivePlannerPersistenceSnapshot;
};

export const createLocalAdaptivePlannerPersistenceAdapter = (): AdaptivePlannerPersistenceAdapter => ({
  getLongitudinalSnapshots: () => readJsonArray<LongitudinalPlanningSnapshot>(ADAPTIVE_PLANNER_STORAGE_KEYS.longitudinalSnapshots).slice(-MAX_LONGITUDINAL_HISTORY),
  putLongitudinalSnapshot: (snapshot) => {
    const current = readJsonArray<LongitudinalPlanningSnapshot>(ADAPTIVE_PLANNER_STORAGE_KEYS.longitudinalSnapshots);
    const next = [...current.filter((entry) => entry.weekKey !== snapshot.weekKey), snapshot].slice(-MAX_LONGITUDINAL_HISTORY);
    writeJsonArray(ADAPTIVE_PLANNER_STORAGE_KEYS.longitudinalSnapshots, next);
  },
  getNutritionPersonalityMemory: () => {
    const records = readJsonArray<AdaptiveNutritionPersonalityMemoryRecord | { message: string; observedAt: string }>(ADAPTIVE_PLANNER_STORAGE_KEYS.nutritionPersonalityMemory).slice(-MAX_PERSONALITY_MEMORY);
    return records.map((record) => ({ id: 'id' in record ? record.id : `${record.observedAt}-${record.message}`, observedAt: record.observedAt, message: record.message }));
  },
  appendNutritionPersonalityMemory: (records) => {
    const current = readJsonArray<AdaptiveNutritionPersonalityMemoryRecord | { message: string; observedAt: string }>(ADAPTIVE_PLANNER_STORAGE_KEYS.nutritionPersonalityMemory);
    const normalizedCurrent = current.map((record) => ({ id: 'id' in record ? record.id : `${record.observedAt}-${record.message}`, observedAt: record.observedAt, message: record.message }));
    writeJsonArray(ADAPTIVE_PLANNER_STORAGE_KEYS.nutritionPersonalityMemory, [...normalizedCurrent, ...records].slice(-MAX_PERSONALITY_MEMORY));
  },
  getObjectiveHistory: () => [],
  putObjectiveHistory: () => {},
  getRelationshipLearningHistory: () => [],
  putRelationshipLearningHistory: () => {},
  getSnapshot: () => ({
    profile: {
      id: `adaptive-profile-${new Date().toISOString()}`,
      observedAt: new Date().toISOString(),
      profileVersion: 'v1',
      objectiveHistory: [],
      relationshipLearningHistory: [],
    },
    longitudinalSnapshots: readJsonArray<LongitudinalPlanningSnapshot>(ADAPTIVE_PLANNER_STORAGE_KEYS.longitudinalSnapshots).slice(-MAX_LONGITUDINAL_HISTORY),
    nutritionPersonalityMemory: readJsonArray<AdaptiveNutritionPersonalityMemoryRecord | { message: string; observedAt: string }>(ADAPTIVE_PLANNER_STORAGE_KEYS.nutritionPersonalityMemory)
      .slice(-MAX_PERSONALITY_MEMORY)
      .map((record) => ({ id: 'id' in record ? record.id : `${record.observedAt}-${record.message}`, observedAt: record.observedAt, message: record.message })),
  }),
});

export const createNeonAdaptivePlannerPersistenceAdapter = (): AdaptivePlannerPersistenceAdapter => ({
  // TODO(neon-api): implement GET /api/adaptive-planner/snapshots.
  getLongitudinalSnapshots: () => [],
  // TODO(neon-api): implement POST /api/adaptive-planner/snapshots.
  putLongitudinalSnapshot: () => {},
  // TODO(neon-api): implement GET /api/adaptive-planner/nutrition-personality-memory.
  getNutritionPersonalityMemory: () => [],
  // TODO(neon-api): implement POST /api/adaptive-planner/nutrition-personality-memory.
  appendNutritionPersonalityMemory: () => {},
  // TODO(neon-api): implement GET /api/adaptive-planner/objective-history.
  getObjectiveHistory: () => [],
  // TODO(neon-api): implement POST /api/adaptive-planner/objective-history.
  putObjectiveHistory: () => {},
  // TODO(neon-api): implement GET /api/adaptive-planner/relationship-history.
  getRelationshipLearningHistory: () => [],
  // TODO(neon-api): implement POST /api/adaptive-planner/relationship-history.
  putRelationshipLearningHistory: () => {},
  getSnapshot: () => ({
    profile: {
      id: 'adaptive-profile-neon-placeholder',
      observedAt: new Date().toISOString(),
      profileVersion: 'v1',
      objectiveHistory: [],
      relationshipLearningHistory: [],
    },
    longitudinalSnapshots: [],
    nutritionPersonalityMemory: [],
  }),
});
