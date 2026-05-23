import type {
  PlannerObjectiveHistoryRecord,
  RelationshipLearningHistoryRecord,
} from './adaptivePersistenceTypes';
import type { LongitudinalPlanningSnapshot } from './adaptationTypes';

const toMillis = (value?: string): number => {
  if (!value) return 0;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

export const resolveSnapshotConflict = (
  localSnapshot: LongitudinalPlanningSnapshot | undefined,
  remoteSnapshot: LongitudinalPlanningSnapshot,
): LongitudinalPlanningSnapshot => {
  if (!localSnapshot) return remoteSnapshot;
  return toMillis(localSnapshot.createdAt) >= toMillis(remoteSnapshot.createdAt) ? localSnapshot : remoteSnapshot;
};

export const resolveProfileConflict = <T extends { observedAt: string }>(localProfile: T | undefined, remoteProfile: T | undefined): T | undefined => {
  if (!remoteProfile) return localProfile;
  if (!localProfile) return remoteProfile;
  return toMillis(localProfile.observedAt) >= toMillis(remoteProfile.observedAt) ? localProfile : remoteProfile;
};

export const mergeObjectiveHistory = (
  localHistory: PlannerObjectiveHistoryRecord[],
  remoteHistory: PlannerObjectiveHistoryRecord[],
  maxEntries = 120,
): PlannerObjectiveHistoryRecord[] => {
  const merged = new Map<string, PlannerObjectiveHistoryRecord>();
  [...remoteHistory, ...localHistory].forEach((entry) => {
    const existing = merged.get(entry.id);
    if (!existing || toMillis(entry.observedAt) >= toMillis(existing.observedAt)) merged.set(entry.id, entry);
  });
  return Array.from(merged.values()).sort((a, b) => toMillis(a.observedAt) - toMillis(b.observedAt)).slice(-maxEntries);
};

export const mergeRelationshipLearning = (
  localHistory: RelationshipLearningHistoryRecord[],
  remoteHistory: RelationshipLearningHistoryRecord[],
  maxEntries = 120,
): RelationshipLearningHistoryRecord[] => {
  const merged = new Map<string, RelationshipLearningHistoryRecord>();
  [...remoteHistory, ...localHistory].forEach((entry) => {
    const existing = merged.get(entry.id);
    if (!existing || toMillis(entry.observedAt) >= toMillis(existing.observedAt)) merged.set(entry.id, entry);
  });
  return Array.from(merged.values()).sort((a, b) => toMillis(a.observedAt) - toMillis(b.observedAt)).slice(-maxEntries);
};


export const resolveAdaptivePlannerConflicts = <T>(localValue: T, remoteValue: T, resolver: (localState: T, remoteState: T) => T): T => resolver(localValue, remoteValue);
