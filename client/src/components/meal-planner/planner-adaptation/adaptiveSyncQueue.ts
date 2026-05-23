import { ADAPTIVE_PLANNER_STORAGE_KEYS } from './adaptivePersistenceTypes';
import type { AdaptiveSyncQueueItem } from './adaptiveSyncTypes';

const MAX_QUEUE_ITEMS = 200;
const MAX_RETRIES = 4;

const readQueue = (): AdaptiveSyncQueueItem[] => {
  if (typeof window === 'undefined') return [];
  try {
    const parsed = JSON.parse(window.localStorage.getItem(ADAPTIVE_PLANNER_STORAGE_KEYS.syncQueue) || '[]');
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

const writeQueue = (queue: AdaptiveSyncQueueItem[]) => {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(ADAPTIVE_PLANNER_STORAGE_KEYS.syncQueue, JSON.stringify(queue.slice(-MAX_QUEUE_ITEMS)));
  } catch {
    // keep local planner functional even if writes fail
  }
};

export const enqueueAdaptivePlannerSync = (item: Omit<AdaptiveSyncQueueItem, 'id' | 'createdAt' | 'retryCount'>) => {
  const queue = readQueue();
  queue.push({ ...item, id: `${Date.now()}-${Math.random().toString(36).slice(2)}`, createdAt: new Date().toISOString(), retryCount: 0 });
  writeQueue(queue);
};

export const takeAdaptivePlannerSyncBatch = (limit = 10): AdaptiveSyncQueueItem[] => readQueue().slice(0, limit);

export const settleAdaptivePlannerSyncBatch = (processedIds: string[], failedIds: string[]) => {
  const queue = readQueue();
  const failedSet = new Set(failedIds);
  const processedSet = new Set(processedIds);
  const next = queue.flatMap((item) => {
    if (!processedSet.has(item.id)) return [item];
    if (!failedSet.has(item.id)) return [];
    if (item.retryCount + 1 >= MAX_RETRIES) return [];
    return [{ ...item, retryCount: item.retryCount + 1 }];
  });
  writeQueue(next);
};

export const hasPendingAdaptivePlannerSync = (): boolean => readQueue().length > 0;
