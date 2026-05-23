import {
  createLocalAdaptivePlannerPersistenceAdapter,
  createNeonAdaptivePlannerPersistenceAdapter,
  type AdaptivePlannerPersistenceAdapter,
} from './adaptivePersistenceAdapter';
import { ADAPTIVE_PLANNER_STORAGE_KEYS } from './adaptivePersistenceTypes';
import { hydrateAdaptivePlannerState } from './adaptiveHydration';
import {
  enqueueAdaptivePlannerSync,
  hasPendingAdaptivePlannerSync,
  settleAdaptivePlannerSyncBatch,
  takeAdaptivePlannerSyncBatch,
} from './adaptiveSyncQueue';
import type { AdaptiveSyncMetadata, AdaptiveSyncQueueItem } from './adaptiveSyncTypes';

const DEFAULT_SYNC_METADATA: AdaptiveSyncMetadata = {
  pendingSync: false,
  syncVersion: 'v1',
  localRevision: 0,
  remoteRevision: 0,
};

const readSyncMetadata = (): AdaptiveSyncMetadata => {
  if (typeof window === 'undefined') return DEFAULT_SYNC_METADATA;
  try {
    return { ...DEFAULT_SYNC_METADATA, ...(JSON.parse(window.localStorage.getItem(ADAPTIVE_PLANNER_STORAGE_KEYS.syncMetadata) || '{}') as Partial<AdaptiveSyncMetadata>) };
  } catch {
    return DEFAULT_SYNC_METADATA;
  }
};

const writeSyncMetadata = (metadata: AdaptiveSyncMetadata) => {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(ADAPTIVE_PLANNER_STORAGE_KEYS.syncMetadata, JSON.stringify(metadata));
  } catch {
    // ignore metadata persistence failures
  }
};

const localAdapter = createLocalAdaptivePlannerPersistenceAdapter();
const remoteAdapter = createNeonAdaptivePlannerPersistenceAdapter();
let flushTimer: ReturnType<typeof setTimeout> | null = null;
let hydrationInFlight = false;

const processQueueItem = (item: AdaptiveSyncQueueItem, remote: AdaptivePlannerPersistenceAdapter): boolean => {
  try {
    if (item.entityType === 'snapshot') remote.putLongitudinalSnapshot(item.payload as any);
    if (item.entityType === 'personalityMemory') remote.appendNutritionPersonalityMemory(item.payload as any);
    if (item.entityType === 'objectiveHistory') remote.putObjectiveHistory(item.payload as any);
    if (item.entityType === 'relationshipLearning') remote.putRelationshipLearningHistory(item.payload as any);
    return true;
  } catch {
    return false;
  }
};

export const flushAdaptivePlannerQueue = () => {
  const batch = takeAdaptivePlannerSyncBatch(12);
  if (!batch.length) return;

  const processedIds: string[] = [];
  const failedIds: string[] = [];
  batch.forEach((item) => {
    processedIds.push(item.id);
    if (!processQueueItem(item, remoteAdapter)) failedIds.push(item.id);
  });
  settleAdaptivePlannerSyncBatch(processedIds, failedIds);

  const metadata = readSyncMetadata();
  writeSyncMetadata({
    ...metadata,
    pendingSync: hasPendingAdaptivePlannerSync(),
    lastSyncedAt: failedIds.length ? metadata.lastSyncedAt : new Date().toISOString(),
    localRevision: metadata.localRevision,
    remoteRevision: failedIds.length ? metadata.remoteRevision : metadata.remoteRevision + 1,
  });
};

export const enqueueAndScheduleAdaptivePlannerSync = (item: Omit<AdaptiveSyncQueueItem, 'id' | 'createdAt' | 'retryCount'>) => {
  enqueueAdaptivePlannerSync(item);
  const metadata = readSyncMetadata();
  writeSyncMetadata({ ...metadata, pendingSync: true, localRevision: metadata.localRevision + 1 });

  if (flushTimer) return;
  flushTimer = setTimeout(() => {
    flushTimer = null;
    flushAdaptivePlannerQueue();
  }, 1200);
};

export const initializeAdaptivePlannerHydration = async () => {
  if (hydrationInFlight) return;
  hydrationInFlight = true;
  try {
    const merged = await hydrateAdaptivePlannerState(localAdapter, remoteAdapter);
    merged.longitudinalSnapshots.forEach((snapshot) => localAdapter.putLongitudinalSnapshot(snapshot));
    localAdapter.appendNutritionPersonalityMemory(merged.nutritionPersonalityMemory);
    localAdapter.putObjectiveHistory(merged.objectiveHistory);
    localAdapter.putRelationshipLearningHistory(merged.relationshipLearningHistory);
    if (hasPendingAdaptivePlannerSync()) flushAdaptivePlannerQueue();
  } finally {
    hydrationInFlight = false;
  }
};

export const getAdaptiveSyncMetadata = (): AdaptiveSyncMetadata => readSyncMetadata();
