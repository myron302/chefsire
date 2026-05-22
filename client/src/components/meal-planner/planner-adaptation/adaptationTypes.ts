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

export type PlannerHistoryProfile = {
  windowSize: number;
  adherence: number;
  sustainedConsistency: number;
  prepTolerance: number;
  hydrationConsistency: number;
  readinessTrend: number;
  fatigueTrend: number;
  complexityTolerance: number;
  relationshipSuccessRate: number;
  lateWeekDropoffRisk: number;
};

export type AdaptiveBehaviorSignals = {
  reducePrepComplexity: boolean;
  avoidFailedChains: boolean;
  favorContinuity: boolean;
  reduceContinuityDueToFatigue: boolean;
  reduceLateWeekIntensity: boolean;
  adaptiveComplexityTolerance: number;
};

export type BehavioralOptimizationAdjustments = {
  prepComplexityMultiplier: number;
  continuityMultiplier: number;
  temporalIntensityMultiplier: number;
  readinessBalanceBias: number;
  failedChainPenalty: number;
};

export type SustainabilityProfile = {
  sustainabilityScore: number;
  unsustainablePatterns: string[];
  sustainableComplexityScore: number;
  sustainablePrepLoad: number;
  sustainableGroceryCompletion: number;
};

export type RelationshipLearningProfile = {
  successfulPatterns: string[];
  breakdownPatterns: string[];
  successRate: number;
};

export type AdaptivePlannerProfile = {
  history: PlannerHistoryProfile;
  behaviorSignals: AdaptiveBehaviorSignals;
  behaviorAdjustments: BehavioralOptimizationAdjustments;
  sustainability: SustainabilityProfile;
  relationshipLearning: RelationshipLearningProfile;
  recommendations: string[];
};
