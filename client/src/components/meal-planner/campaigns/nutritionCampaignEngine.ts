import { NUTRITION_CAMPAIGN_CATALOG } from '@/components/meal-planner/campaigns/nutritionCampaignCatalog';
import {
  NutritionCampaignMissionMetric,
  NutritionCampaignProgress,
  NutritionCampaignSignals,
} from '@/components/meal-planner/campaigns/nutritionCampaignTypes';
import { deriveAdaptiveMissionTargets, type AdaptiveCampaignProfile } from '@/components/meal-planner/campaigns/adaptiveCampaignScaling';

const metricValue = (signals: NutritionCampaignSignals, metric: NutritionCampaignMissionMetric): number => {
  switch (metric) {
    case 'planned_breakfasts': return signals.plannedBreakfasts;
    case 'prep_tasks_completed': return signals.prepTasksCompleted;
    case 'grocery_items_resolved': return signals.groceryItemsResolved;
    case 'pantry_ingredients_used': return signals.pantryIngredientsUsed;
    case 'leftover_friendly_meals': return signals.leftoverFriendlyMeals;
    case 'protein_goal_days': return signals.proteinGoalDays;
    case 'semantic_variety_score': return signals.semanticVarietyScore;
    case 'prep_overload_reduction': return signals.prepOverloadReduction;
    default: return 0;
  }
};

export const evaluateCampaignProgress = (
  campaignId: string,
  signals: NutritionCampaignSignals,
  startedAt: string,
  adaptiveProfile?: AdaptiveCampaignProfile,
): NutritionCampaignProgress | null => {
  const campaign = NUTRITION_CAMPAIGN_CATALOG.find((item) => item.id === campaignId);
  if (!campaign) return null;

  const adaptiveTargets = adaptiveProfile ? deriveAdaptiveMissionTargets(campaign, adaptiveProfile) : null;

  const missionProgress = campaign.missions.map((mission) => {
    const value = metricValue(signals, mission.metric);
    const target = adaptiveTargets?.[mission.metric] ?? mission.target;
    const progressPct = Math.min(100, Math.round((value / target) * 100));
    return {
      mission,
      value,
      target,
      progressPct,
      completed: value >= target,
    };
  });

  const completedMissions = missionProgress.filter((mission) => mission.completed).length;
  const completionPct = Math.round((completedMissions / campaign.missions.length) * 100);

  return {
    campaignId: campaign.id,
    startedAt,
    missionProgress,
    completedMissions,
    totalMissions: campaign.missions.length,
    completionPct,
    complete: completedMissions === campaign.missions.length,
  };
};
