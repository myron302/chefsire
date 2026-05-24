import { NUTRITION_CAMPAIGN_CATALOG } from '@/components/meal-planner/campaigns/nutritionCampaignCatalog';
import {
  NutritionCampaignMissionMetric,
  NutritionCampaignProgress,
  NutritionCampaignSignals,
} from '@/components/meal-planner/campaigns/nutritionCampaignTypes';
import { deriveAdaptiveMissionTargets, type AdaptiveCampaignProfile } from '@/components/meal-planner/campaigns/adaptiveCampaignScaling';
import { derivePhaseAwareMissionTargets } from '@/components/meal-planner/campaigns/adaptiveCampaignArcs';
import { calculateCampaignJourneyStability, deriveCampaignCompletionSemantics, deriveCampaignJourneySummary, evolveCampaignJourney } from '@/components/meal-planner/campaigns/adaptiveCampaignJourney';

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
  userId?: string | null,
): NutritionCampaignProgress | null => {
  const campaign = NUTRITION_CAMPAIGN_CATALOG.find((item) => item.id === campaignId);
  if (!campaign) return null;

  const adaptiveTargets = adaptiveProfile ? deriveAdaptiveMissionTargets(campaign, adaptiveProfile) : null;
  const journey = evolveCampaignJourney({ campaignId, signals, profile: adaptiveProfile, userId });
  const phaseTargets = adaptiveTargets ? derivePhaseAwareMissionTargets(adaptiveTargets, journey.phase) : null;

  const missionProgress = campaign.missions.map((mission) => {
    const value = metricValue(signals, mission.metric);
    const target = phaseTargets?.[mission.metric] ?? adaptiveTargets?.[mission.metric] ?? mission.target;
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

  const completionSemantics = deriveCampaignCompletionSemantics(journey.trajectory, completionPct);
  const journeySummary = deriveCampaignJourneySummary(journey.history);

  return {
    campaignId: campaign.id,
    startedAt,
    missionProgress,
    completedMissions,
    totalMissions: campaign.missions.length,
    completionPct,
    complete: completedMissions === campaign.missions.length,
    phase: journey.phase,
    phaseNarrative: journey.narrative,
    momentum: journey.momentum,
    transitionReason: journeySummary.completedPhases.length ? journey.history[journey.history.length - 1]?.reason : undefined,
    journeyStability: calculateCampaignJourneyStability(journey.history),
    completionSemantics,
  };
};
