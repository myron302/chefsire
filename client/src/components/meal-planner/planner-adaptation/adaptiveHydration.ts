import type { AdaptivePlannerPersistenceAdapter } from './adaptivePersistenceAdapter';
import type { AdaptivePlannerHydrationState } from './adaptiveSyncTypes';
import {
  mergeObjectiveHistory,
  mergeRelationshipLearning,
  resolveProfileConflict,
  resolveSnapshotConflict,
} from './adaptiveConflictResolution';

export const mergeAdaptivePlannerSnapshots = (
  localState: AdaptivePlannerHydrationState,
  remoteState: AdaptivePlannerHydrationState,
): AdaptivePlannerHydrationState => {
  const mergedSnapshotsByWeek = new Map(localState.longitudinalSnapshots.map((snapshot) => [snapshot.weekKey, snapshot]));
  remoteState.longitudinalSnapshots.forEach((remoteSnapshot) => {
    const current = mergedSnapshotsByWeek.get(remoteSnapshot.weekKey);
    mergedSnapshotsByWeek.set(remoteSnapshot.weekKey, resolveSnapshotConflict(current, remoteSnapshot));
  });

  const personalityById = new Map(localState.nutritionPersonalityMemory.map((record) => [record.id, record]));
  remoteState.nutritionPersonalityMemory.forEach((record) => {
    const resolved = resolveProfileConflict(personalityById.get(record.id), record);
    if (resolved) personalityById.set(record.id, resolved);
  });

  return {
    longitudinalSnapshots: Array.from(mergedSnapshotsByWeek.values()),
    nutritionPersonalityMemory: Array.from(personalityById.values()).sort((a, b) => Date.parse(a.observedAt) - Date.parse(b.observedAt)).slice(-24),
    objectiveHistory: mergeObjectiveHistory(localState.objectiveHistory, remoteState.objectiveHistory),
    relationshipLearningHistory: mergeRelationshipLearning(localState.relationshipLearningHistory, remoteState.relationshipLearningHistory),
  };
};

export const hydrateAdaptivePlannerState = async (
  localAdapter: AdaptivePlannerPersistenceAdapter,
  remoteAdapter: AdaptivePlannerPersistenceAdapter,
): Promise<AdaptivePlannerHydrationState> => {
  const localState: AdaptivePlannerHydrationState = {
    longitudinalSnapshots: localAdapter.getLongitudinalSnapshots(),
    nutritionPersonalityMemory: localAdapter.getNutritionPersonalityMemory(),
    objectiveHistory: localAdapter.getObjectiveHistory(),
    relationshipLearningHistory: localAdapter.getRelationshipLearningHistory(),
  };

  try {
    const remoteState: AdaptivePlannerHydrationState = {
      longitudinalSnapshots: remoteAdapter.getLongitudinalSnapshots(),
      nutritionPersonalityMemory: remoteAdapter.getNutritionPersonalityMemory(),
      objectiveHistory: remoteAdapter.getObjectiveHistory(),
      relationshipLearningHistory: remoteAdapter.getRelationshipLearningHistory(),
    };
    return mergeAdaptivePlannerSnapshots(localState, remoteState);
  } catch {
    return localState;
  }
};
