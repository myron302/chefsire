import { type LongitudinalPlanningSnapshot, type PlannerHistoryProfile } from './adaptationTypes';
import { readLongitudinalPlanningHistory, writeLongitudinalPlanningSnapshot } from './localAdaptivePlannerStore';

const clamp = (v: number, min = 0, max = 1) => Math.max(min, Math.min(max, v));

export const buildLongitudinalPlanningHistory = (): LongitudinalPlanningSnapshot[] => readLongitudinalPlanningHistory();

export const persistLongitudinalPlanningSnapshot = (snapshot: LongitudinalPlanningSnapshot) => {
  writeLongitudinalPlanningSnapshot(snapshot);
};

export const calculateHistoricalAdherence = (history: LongitudinalPlanningSnapshot[]) => {
  if (!history.length) return 0;
  return clamp(history.reduce((sum, entry) => {
    const total = Math.max(1, entry.completedMeals + entry.skippedMeals);
    return sum + (entry.completedMeals / total);
  }, 0) / history.length);
};

export const calculateSustainedPlanningConsistency = (history: LongitudinalPlanningSnapshot[]) => {
  if (history.length < 2) return 0;
  const avg = history.reduce((sum, entry) => sum + entry.continuityScore, 0) / history.length;
  const variance = history.reduce((sum, entry) => sum + ((entry.continuityScore - avg) ** 2), 0) / history.length;
  return clamp(1 - Math.sqrt(variance));
};

export const derivePlannerHistoryProfile = (history: LongitudinalPlanningSnapshot[]): PlannerHistoryProfile => {
  if (!history.length) {
    return { windowSize: 0, adherence: 0, sustainedConsistency: 0, prepTolerance: 0.5, hydrationConsistency: 0, readinessTrend: 0, fatigueTrend: 0, complexityTolerance: 0.5, relationshipSuccessRate: 0, lateWeekDropoffRisk: 0 };
  }
  const first = history[0];
  const last = history[history.length - 1];
  const prepTolerance = history.reduce((sum, entry) => sum + entry.prepCompletionRate, 0) / history.length;
  const hydrationConsistency = history.reduce((sum, entry) => sum + entry.hydrationAdherence, 0) / history.length;
  const relationshipSuccessRate = history.reduce((sum, entry) => {
    const totalChains = Math.max(1, entry.successfulRelationshipChains + entry.abandonedRelationshipChains);
    return sum + (entry.successfulRelationshipChains / totalChains);
  }, 0) / history.length;
  return {
    windowSize: history.length,
    adherence: calculateHistoricalAdherence(history),
    sustainedConsistency: calculateSustainedPlanningConsistency(history),
    prepTolerance,
    hydrationConsistency,
    readinessTrend: last.readinessAverage - first.readinessAverage,
    fatigueTrend: last.fatigueAverage - first.fatigueAverage,
    complexityTolerance: clamp(history.reduce((sum, entry) => sum + (entry.complexityLoad * entry.prepCompletionRate), 0) / history.length),
    relationshipSuccessRate,
    lateWeekDropoffRisk: clamp(history.reduce((sum, entry) => sum + entry.lateWeekDropoff, 0) / history.length),
  };
};


export const derivePlanningSnapshotFromResult = (args: {
  weekDays: readonly string[];
  mealTypes: readonly string[];
  beforeScores: { prepLoadScore: number; groceryEfficiencyScore: number; readinessScore: number };
  afterScores: { prepLoadScore: number; groceryEfficiencyScore: number; readinessScore: number };
  changes: Array<{ id: string }>;
  suggestionMessages: string[];
}): LongitudinalPlanningSnapshot => {
  const mealSlots = Math.max(1, args.weekDays.length * args.mealTypes.length);
  const completedMeals = Math.max(0, mealSlots - Math.floor(args.changes.length * 0.15));
  const skippedMeals = Math.max(0, mealSlots - completedMeals);
  const prepCompletionRate = clamp(1 - (args.afterScores.prepLoadScore / 100));
  const groceryCompletionRate = clamp(args.afterScores.groceryEfficiencyScore / 100);
  const hydrationAdherence = clamp(args.afterScores.readinessScore / 100);
  const relationshipWins = args.suggestionMessages.filter((m) => m.toLowerCase().includes('chain') || m.toLowerCase().includes('continuity')).length;
  const weekKey = `${new Date().getUTCFullYear()}-W${Math.ceil((Date.now() / 86400000) / 7)}`;
  return {
    id: `${weekKey}-${Date.now()}`,
    createdAt: new Date().toISOString(),
    weekKey,
    completedMeals,
    skippedMeals,
    repeatedMeals: Math.max(0, args.changes.length - Math.floor(args.changes.length * 0.6)),
    prepCompletionRate,
    groceryCompletionRate,
    hydrationAdherence,
    readinessAverage: clamp(args.afterScores.readinessScore / 100),
    fatigueAverage: clamp(1 - hydrationAdherence),
    successfulRelationshipChains: relationshipWins,
    abandonedRelationshipChains: Math.max(0, Math.floor(args.changes.length * 0.2) - relationshipWins),
    complexityLoad: clamp(args.afterScores.prepLoadScore / 100),
    continuityScore: clamp((relationshipWins + completedMeals) / (mealSlots + 5)),
    lateWeekDropoff: clamp((args.beforeScores.readinessScore - args.afterScores.readinessScore) / 100 + 0.25),
  };
};
