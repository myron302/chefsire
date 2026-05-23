export type MealSemanticTag =
  | 'comfort'
  | 'restorative'
  | 'cozy'
  | 'fresh'
  | 'heavy'
  | 'light'
  | 'social'
  | 'indulgent'
  | 'energizing'
  | 'low-effort'
  | 'prep-heavy'
  | 'modular'
  | 'batch-friendly'
  | 'recovery-friendly'
  | 'stress-friendly'
  | 'novelty-oriented'
  | 'routine-friendly';

export type MealSemanticProfile = {
  tags: MealSemanticTag[];
  semanticWeights: Record<MealSemanticTag, number>;
  confidence: number;
  identity: string;
};

export type CuisineSemanticIdentity = {
  cuisineFamilies: string[];
  flavorArchetypes: string[];
  ingredientClusters: string[];
};

export type EmotionalMealSemantics = {
  isComfortFallback: boolean;
  isSocialMeal: boolean;
  isRecoveryMeal: boolean;
  isStressFriendly: boolean;
  isLowFriction: boolean;
  adherenceSafetyScore: number;
};

export type SeasonalMealSemantics = {
  seasonalAffinity: Record<'spring' | 'summer' | 'fall' | 'winter', number>;
  temporalFit: Record<'weeknight' | 'weekend' | 'post-work' | 'prep-window', number>;
  energyProfile: 'low' | 'medium' | 'high';
};

export type SemanticVarietySummary = {
  semanticVarietyScore: number;
  fatigueSignals: string[];
  balanceSummary: string[];
};

export type SemanticIntelligenceSnapshot = {
  mealProfiles: Record<string, MealSemanticProfile>;
  comfortAnchorStrength: number;
  recoveryMealAffinity: number;
  seasonalBalanceScore: number;
  semanticVarietyScore: number;
  semanticRecommendations: string[];
};
