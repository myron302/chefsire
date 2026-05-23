import { type AdaptivePlannerProfile } from '../planner-adaptation/adaptationTypes';
export type AutoPlannerMode = 'balanced' | 'high-protein' | 'budget-friendly' | 'minimal-prep' | 'pantry-reuse' | 'variety-focused' | 'grocery-efficient' | 'recovery-focused';

export type AutoPlannerPriorities = {
  proteinPriority: number;
  budgetPriority: number;
  prepSimplicity: number;
  varietyPriority: number;
  pantryReusePriority: number;
  groceryEfficiencyPriority: number;
  fillEmptyOnly: boolean;
};

export type PlannerSlotKey = { day: string; mealType: string };

export type AutoPlannerChange = {
  id: string;
  slot: PlannerSlotKey;
  action: 'add' | 'replace';
  meal: any;
  reason: string;
  generatedByAutoPlanner: true;
  autoPlannerMode: AutoPlannerMode;
  optimizationVersion: number;
};

export type AutoPlannerScores = {
  varietyScore: number;
  prepLoadScore: number;
  pantryReuseScore: number;
  proteinCoverageScore: number;
  groceryEfficiencyScore: number;
  readinessScore: number;
};

export type AutoPlannerSuggestion = { id: string; message: string; tone: 'positive' | 'neutral' | 'warning'; category?: 'core' | 'lifestyle' | 'prep' | 'freshness' | 'recovery' };

export type AutoPlannerResult = {
  mode: AutoPlannerMode;
  changes: AutoPlannerChange[];
  beforeScores: AutoPlannerScores;
  afterScores: AutoPlannerScores;
  suggestions: AutoPlannerSuggestion[];
  lifestyleContext?: {
    dayRhythm?: Array<{ day: string; energyLoad: number; energyLevel: 'low' | 'medium' | 'high'; prepWindowType: string }>;
    freshnessPriority?: { fragileEarlyWeek: number; fragileLateWeek: number };
    prepWindowType?: string;
    energyLoad?: number;
  };
  adaptiveProfile?: AdaptivePlannerProfile;
  semanticIntelligence?: {
    comfortAnchorStrength: number;
    recoveryMealAffinity: number;
    seasonalBalanceScore: number;
    semanticVarietyScore: number;
    semanticRecommendations: string[];
  };
};
