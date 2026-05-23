import {
  createLocalAdaptivePlannerPersistenceAdapter,
  type AdaptivePlannerPersistenceAdapter,
} from './adaptivePersistenceAdapter';
import { enqueueAndScheduleAdaptivePlannerSync, initializeAdaptivePlannerHydration } from './adaptiveSyncEngine';
import type { AdaptiveNutritionPersonalityMemoryRecord } from './adaptivePersistenceTypes';
import type { LongitudinalPlanningSnapshot } from './adaptationTypes';

const localAdaptivePlannerStore: AdaptivePlannerPersistenceAdapter = createLocalAdaptivePlannerPersistenceAdapter();
let hasInitializedHydration = false;

const ensureAdaptiveHydration = () => {
  if (hasInitializedHydration) return;
  hasInitializedHydration = true;
  void initializeAdaptivePlannerHydration();
};

export const readLongitudinalPlanningHistory = (): LongitudinalPlanningSnapshot[] => {
  ensureAdaptiveHydration();
  return localAdaptivePlannerStore.getLongitudinalSnapshots();
};

export const writeLongitudinalPlanningSnapshot = (snapshot: LongitudinalPlanningSnapshot) => {
  localAdaptivePlannerStore.putLongitudinalSnapshot(snapshot);
  enqueueAndScheduleAdaptivePlannerSync({ entityType: 'snapshot', payload: snapshot });
};

export const appendNutritionPersonalityMemory = (records: AdaptiveNutritionPersonalityMemoryRecord[]) => {
  localAdaptivePlannerStore.appendNutritionPersonalityMemory(records);
  enqueueAndScheduleAdaptivePlannerSync({ entityType: 'personalityMemory', payload: records });
};

export const readNutritionPersonalityMemory = (): AdaptiveNutritionPersonalityMemoryRecord[] => {
  ensureAdaptiveHydration();
  return localAdaptivePlannerStore.getNutritionPersonalityMemory();
};
