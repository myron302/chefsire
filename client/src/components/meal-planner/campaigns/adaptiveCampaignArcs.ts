import type { NutritionCampaignMissionMetric, NutritionCampaignSignals } from './nutritionCampaignTypes';
import type { AdaptiveCampaignProfile } from './adaptiveCampaignScaling';
import { deriveCampaignPhase, deriveCampaignPhaseIntensity, type CampaignJourneyPhase, type CampaignTrajectory } from './adaptiveCampaignPhases';

export const deriveCampaignTrajectory = (
  signals: NutritionCampaignSignals,
  profile?: AdaptiveCampaignProfile,
): CampaignTrajectory => {
  const adherenceTrajectory = profile?.adherenceStrength ?? Math.min(1, (signals.proteinGoalDays + signals.plannedBreakfasts / 2) / 9);
  const fatigueTrajectory = profile?.fatigueSensitivity ?? Math.max(0, 1 - (signals.prepOverloadReduction / 100));
  const prepStability = profile?.prepTolerance ?? Math.min(1, signals.prepTasksCompleted / 6);
  const semanticFatigue = profile?.semanticFatigue ?? Math.max(0, (70 - signals.semanticVarietyScore) / 70);
  const continuitySuccess = profile?.continuitySuccess ?? Math.min(1, signals.leftoverFriendlyMeals / 5);
  const readinessTrend = profile?.readinessScore ?? Math.min(1, (signals.plannedBreakfasts + signals.groceryItemsResolved / 3) / 9);
  const sustainabilityTrend = profile?.sustainabilityScore ?? Math.min(1, (signals.prepOverloadReduction + signals.pantryIngredientsUsed * 8) / 100);
  const volatilityPattern = profile?.volatilityLevel ?? Number((1 - prepStability * 0.6 - continuitySuccess * 0.4).toFixed(2));
  const missionCompletionConsistency = Math.min(1, (signals.prepTasksCompleted + signals.proteinGoalDays + signals.groceryItemsResolved / 2) / 12);

  return { adherenceTrajectory, fatigueTrajectory, prepStability, semanticFatigue, continuitySuccess, readinessTrend, sustainabilityTrend, volatilityPattern, missionCompletionConsistency };
};

export const deriveCampaignArc = (trajectory: CampaignTrajectory): {
  phase: CampaignJourneyPhase;
  intensity: number;
  trajectory: CampaignTrajectory;
} => {
  const phase = deriveCampaignPhase(trajectory);
  return { phase, intensity: deriveCampaignPhaseIntensity(phase), trajectory };
};

export const derivePhaseMissionModifiers = (phase: CampaignJourneyPhase): Partial<Record<NutritionCampaignMissionMetric, number>> => {
  switch (phase) {
    case 'recovery':
    case 'sustainability-protection':
      return { prep_tasks_completed: 0.8, prep_overload_reduction: 1.15, pantry_ingredients_used: 1.1 };
    case 'momentum':
      return { leftover_friendly_meals: 1.15, protein_goal_days: 1.1, planned_breakfasts: 1.1 };
    case 'escalation':
      return { prep_tasks_completed: 1.2, grocery_items_resolved: 1.15, protein_goal_days: 1.2 };
    case 'reset':
      return { semantic_variety_score: 1.2, leftover_friendly_meals: 0.9, planned_breakfasts: 0.95 };
    case 'stabilization':
      return { prep_tasks_completed: 0.9, planned_breakfasts: 1.0, prep_overload_reduction: 1.05 };
    default:
      return {};
  }
};

export const derivePhaseAwareMissionTargets = (
  baseTargets: Record<string, number>,
  phase: CampaignJourneyPhase,
): Record<string, number> => {
  const modifiers = derivePhaseMissionModifiers(phase);
  return Object.fromEntries(Object.entries(baseTargets).map(([metric, target]) => {
    const modifier = modifiers[metric as NutritionCampaignMissionMetric] ?? 1;
    return [metric, Math.max(1, Math.round(target * modifier))];
  }));
};
