import { NUTRITION_CAMPAIGN_CATALOG } from '@/components/meal-planner/campaigns/nutritionCampaignCatalog';
import type { NutritionCampaign, NutritionCampaignAdaptiveRecommendation, NutritionCampaignProgress } from '@/components/meal-planner/campaigns/nutritionCampaignTypes';

export const selectActiveCampaign = (campaignId: string | null | undefined): NutritionCampaign | null =>
  NUTRITION_CAMPAIGN_CATALOG.find((item) => item.id === campaignId) ?? null;

export const selectCampaignCompletion = (progress: NutritionCampaignProgress | null | undefined): number =>
  typeof progress?.completionRate === 'number' ? progress.completionRate : 0;

export const selectCampaignMilestones = (progress: NutritionCampaignProgress | null | undefined): string[] =>
  Array.isArray(progress?.recentMilestones) ? progress.recentMilestones : [];

export const selectCampaignProgress = (progress: NutritionCampaignProgress | null | undefined) => ({
  completionRate: selectCampaignCompletion(progress),
  missionsCompleted: progress?.completedMissions.length ?? 0,
  milestones: selectCampaignMilestones(progress),
});

export const selectRankedCampaigns = (
  recommendationsByCampaignId: Record<string, NutritionCampaignAdaptiveRecommendation> | null | undefined,
): NutritionCampaign[] => {
  const withOrder = NUTRITION_CAMPAIGN_CATALOG.map((campaign, index) => ({ campaign, index }));
  return withOrder
    .sort((a, b) => {
      const aFit = recommendationsByCampaignId?.[a.campaign.id]?.fitScore;
      const bFit = recommendationsByCampaignId?.[b.campaign.id]?.fitScore;
      if (typeof aFit === 'number' && typeof bFit === 'number') return bFit - aFit;
      if (typeof aFit === 'number') return -1;
      if (typeof bFit === 'number') return 1;
      return a.index - b.index;
    })
    .map((item) => item.campaign);
};
