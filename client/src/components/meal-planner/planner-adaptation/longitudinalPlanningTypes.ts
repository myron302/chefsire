export type LongitudinalPlanningSnapshot = {
  id: string;
  createdAt: string;
  weekKey: string;
  completedMeals: number;
  skippedMeals: number;
  repeatedMeals: number;
  prepCompletionRate: number;
  groceryCompletionRate: number;
  hydrationAdherence: number;
  readinessAverage: number;
  fatigueAverage: number;
  successfulRelationshipChains: number;
  abandonedRelationshipChains: number;
  complexityLoad: number;
  continuityScore: number;
  lateWeekDropoff: number;
};
