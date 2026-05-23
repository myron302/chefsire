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
const MAX_OBJECTIVE_HISTORY = 120;
const MAX_RELATIONSHIP_HISTORY = 120;

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
  // TODO(neon-api-contract): profile contract => GET/POST /api/adaptive-planner/profile
  // payload: { profileVersion, plannerMode, adaptationCadence, currentGoalFocus, profileMetadata }.
  // TODO(neon-api-contract): objective contract => GET/POST /api/adaptive-planner/objectives
  // payload: { objectiveVersion, objectiveKey, objectiveStatus, objectiveScore, summaryMetadata, observedAt }.
  // TODO(neon-api-contract): relationship contract => GET/POST /api/adaptive-planner/relationships
  // payload: { relationshipVersion, sourceDimension, targetDimension, confidenceScore, relationshipMetadata }.
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
  getObjectiveHistory: () => readJsonArray<PlannerObjectiveHistoryRecord>(ADAPTIVE_PLANNER_STORAGE_KEYS.objectiveHistory).slice(-MAX_OBJECTIVE_HISTORY),
  putObjectiveHistory: (records) => {
    writeJsonArray(ADAPTIVE_PLANNER_STORAGE_KEYS.objectiveHistory, records.slice(-MAX_OBJECTIVE_HISTORY));
  },
  getRelationshipLearningHistory: () => readJsonArray<RelationshipLearningHistoryRecord>(ADAPTIVE_PLANNER_STORAGE_KEYS.relationshipLearningHistory).slice(-MAX_RELATIONSHIP_HISTORY),
  putRelationshipLearningHistory: (records) => {
    writeJsonArray(ADAPTIVE_PLANNER_STORAGE_KEYS.relationshipLearningHistory, records.slice(-MAX_RELATIONSHIP_HISTORY));
  },
  getSnapshot: () => ({
    profile: {
      id: `adaptive-profile-${new Date().toISOString()}`,
      observedAt: new Date().toISOString(),
      profileVersion: 'v1',
      objectiveHistory: readJsonArray<PlannerObjectiveHistoryRecord>(ADAPTIVE_PLANNER_STORAGE_KEYS.objectiveHistory).slice(-MAX_OBJECTIVE_HISTORY),
      relationshipLearningHistory: readJsonArray<RelationshipLearningHistoryRecord>(ADAPTIVE_PLANNER_STORAGE_KEYS.relationshipLearningHistory).slice(-MAX_RELATIONSHIP_HISTORY),
    },
    longitudinalSnapshots: readJsonArray<LongitudinalPlanningSnapshot>(ADAPTIVE_PLANNER_STORAGE_KEYS.longitudinalSnapshots).slice(-MAX_LONGITUDINAL_HISTORY),
    nutritionPersonalityMemory: readJsonArray<AdaptiveNutritionPersonalityMemoryRecord | { message: string; observedAt: string }>(ADAPTIVE_PLANNER_STORAGE_KEYS.nutritionPersonalityMemory)
      .slice(-MAX_PERSONALITY_MEMORY)
      .map((record) => ({ id: 'id' in record ? record.id : `${record.observedAt}-${record.message}`, observedAt: record.observedAt, message: record.message })),
  }),
});

export const createNeonAdaptivePlannerPersistenceAdapter = (): AdaptivePlannerPersistenceAdapter => ({
  getLongitudinalSnapshots: () => [],
  putLongitudinalSnapshot: (snapshot) => { if (typeof window !== "undefined") void fetch("/api/adaptive-planner/history", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(snapshot) }).catch(() => undefined); },
  getNutritionPersonalityMemory: () => [],
  appendNutritionPersonalityMemory: (records) => { if (typeof window !== "undefined") void fetch("/api/adaptive-planner/personality", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ records }) }).catch(() => undefined); },
  getObjectiveHistory: () => [],
  putObjectiveHistory: (records) => { if (typeof window !== "undefined") void fetch("/api/adaptive-planner/objectives", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ records }) }).catch(() => undefined); },
  getRelationshipLearningHistory: () => [],
  putRelationshipLearningHistory: (records) => { if (typeof window !== "undefined") void fetch("/api/adaptive-planner/relationships", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ records }) }).catch(() => undefined); },
  getSnapshot: () => ({
    profile: {
      id: 'adaptive-profile-neon-placeholder',
      observedAt: new Date().toISOString(),
      profileVersion: 'v1',
      objectiveHistory: readJsonArray<PlannerObjectiveHistoryRecord>(ADAPTIVE_PLANNER_STORAGE_KEYS.objectiveHistory).slice(-MAX_OBJECTIVE_HISTORY),
      relationshipLearningHistory: readJsonArray<RelationshipLearningHistoryRecord>(ADAPTIVE_PLANNER_STORAGE_KEYS.relationshipLearningHistory).slice(-MAX_RELATIONSHIP_HISTORY),
    },
    longitudinalSnapshots: [],
    nutritionPersonalityMemory: [],
  }),
});
