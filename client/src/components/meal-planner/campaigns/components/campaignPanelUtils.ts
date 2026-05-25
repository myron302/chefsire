import type { NutritionCampaignAdaptiveRecommendation, NutritionCampaignDefinition } from '@/components/meal-planner/campaigns/nutritionCampaignTypes';

export function pacingLabel(recommendation?: NutritionCampaignAdaptiveRecommendation) {
  if (!recommendation?.pacing && !recommendation?.intensity) return null;
  const pacing = recommendation?.pacing ? recommendation.pacing : 'steady';
  const intensity = recommendation?.intensity ? recommendation.intensity : 'moderate';
  return `${pacing} pace · ${intensity} intensity`;
}

export function buildMissionWhy(campaign: NutritionCampaignDefinition, recommendation?: NutritionCampaignAdaptiveRecommendation) {
  const reasons = recommendation?.fitReasons?.slice(0, 2) ?? [];
  if (reasons.length > 0) {
    return `Supports your current focus: ${reasons.join(' · ')}`;
  }
  return `Builds progress toward ${campaign.goals[0]?.toLowerCase() || 'consistent weekly nutrition habits'}.`;
}

export function recommendationReasonLabel(campaign: NutritionCampaignDefinition, recommendation?: NutritionCampaignAdaptiveRecommendation) {
  return recommendation?.fitReasons?.join(' · ') || campaign.goals[0];
}
