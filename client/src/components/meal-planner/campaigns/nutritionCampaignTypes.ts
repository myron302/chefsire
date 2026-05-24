export type NutritionCampaignTheme =
  | 'meal-prep'
  | 'protein'
  | 'pantry'
  | 'grocery'
  | 'recovery'
  | 'leftovers'
  | 'budget';

export type NutritionCampaignMissionMetric =
  | 'planned_breakfasts'
  | 'prep_tasks_completed'
  | 'grocery_items_resolved'
  | 'pantry_ingredients_used'
  | 'leftover_friendly_meals'
  | 'protein_goal_days'
  | 'semantic_variety_score'
  | 'prep_overload_reduction';

export type NutritionCampaignMission = {
  id: string;
  title: string;
  description: string;
  metric: NutritionCampaignMissionMetric;
  target: number;
};

export type NutritionCampaignProgressRule = {
  metric: NutritionCampaignMissionMetric;
  description: string;
};

export type NutritionCampaignDefinition = {
  id: string;
  title: string;
  description: string;
  durationDays: number;
  theme: NutritionCampaignTheme;
  narrative: string;
  goals: string[];
  missions: NutritionCampaignMission[];
  progressRules: NutritionCampaignProgressRule[];
  rewardCopy: string;
  plannerIntegrationSignals: string[];
};

export type NutritionCampaignSignals = {
  plannedBreakfasts: number;
  prepTasksCompleted: number;
  groceryItemsResolved: number;
  pantryIngredientsUsed: number;
  leftoverFriendlyMeals: number;
  proteinGoalDays: number;
  semanticVarietyScore: number;
  prepOverloadReduction: number;
};

export type NutritionCampaignMissionProgress = {
  mission: NutritionCampaignMission;
  value: number;
  target: number;
  progressPct: number;
  completed: boolean;
};

export type NutritionCampaignCompletionSemantics = {
  sustainabilityCompletion: boolean;
  recoveryCompletion: boolean;
  continuityCompletion: boolean;
  stabilizationCompletion: boolean;
  semanticResetCompletion: boolean;
  missionCompletionPct: number;
};

export type NutritionCampaignProgress = {
  campaignId: string;
  startedAt: string;
  missionProgress: NutritionCampaignMissionProgress[];
  completedMissions: number;
  totalMissions: number;
  completionPct: number;
  complete: boolean;
  phase?: string;
  phaseNarrative?: string;
  momentum?: number;
  transitionReason?: string;
  journeyStability?: number;
  completionSemantics?: NutritionCampaignCompletionSemantics;
};


export type NutritionCampaignAdaptiveRecommendation = {
  fitScore: number;
  fitReasons: string[];
  narrative?: string;
  pacing?: 'slow' | 'steady' | 'accelerated';
  intensity?: 'low' | 'moderate' | 'high';
};
