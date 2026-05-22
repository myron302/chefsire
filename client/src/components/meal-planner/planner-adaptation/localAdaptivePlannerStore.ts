import {
  createLocalAdaptivePlannerPersistenceAdapter,
  type AdaptivePlannerPersistenceAdapter,
} from './adaptivePersistenceAdapter';
import type { AdaptiveNutritionPersonalityMemoryRecord } from './adaptivePersistenceTypes';
import type { LongitudinalPlanningSnapshot } from './adaptationTypes';

const localAdaptivePlannerStore: AdaptivePlannerPersistenceAdapter = createLocalAdaptivePlannerPersistenceAdapter();

export const readLongitudinalPlanningHistory = (): LongitudinalPlanningSnapshot[] => localAdaptivePlannerStore.getLongitudinalSnapshots();

export const writeLongitudinalPlanningSnapshot = (snapshot: LongitudinalPlanningSnapshot) => {
  localAdaptivePlannerStore.putLongitudinalSnapshot(snapshot);
};

export const appendNutritionPersonalityMemory = (records: AdaptiveNutritionPersonalityMemoryRecord[]) => {
  localAdaptivePlannerStore.appendNutritionPersonalityMemory(records);
};

export const readNutritionPersonalityMemory = (): AdaptiveNutritionPersonalityMemoryRecord[] => (
  localAdaptivePlannerStore.getNutritionPersonalityMemory()
);
