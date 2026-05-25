import type { NutritionCampaignAdaptiveRecommendation, NutritionCampaignDefinition } from '@/components/meal-planner/campaigns/nutritionCampaignTypes';

export type SeasonalCampaignNarrative = {
  season: 'spring' | 'summer' | 'autumn' | 'winter';
  title: string;
  narrative: string;
};

export const deriveSeasonalNarratives = (month = new Date().getUTCMonth() + 1): SeasonalCampaignNarrative => {
  if (month >= 3 && month <= 5) return { season: 'spring', title: 'Fresh Spring Reset', narrative: 'Light reset arcs that restore cadence and semantic freshness.' };
  if (month >= 6 && month <= 8) return { season: 'summer', title: 'Summer Hydration Rhythm', narrative: 'Hydration-aware pacing and lower-friction continuity rituals.' };
  if (month >= 9 && month <= 11) return { season: 'autumn', title: 'Autumn Comfort Balance', narrative: 'Comfort-balanced prep with sustainability-conscious variety anchors.' };
  return { season: 'winter', title: 'Holiday Recovery Stabilization', narrative: 'Recovery-protective progression for volatility-heavy weeks.' };
};

export const deriveSeasonalCampaigns = (
  campaigns: NutritionCampaignDefinition[],
  month = new Date().getUTCMonth() + 1,
): NutritionCampaignDefinition[] => {
  const seasonal = deriveSeasonalNarratives(month);
  return campaigns.filter((campaign) => {
    if (seasonal.season === 'spring') return campaign.theme === 'protein' || campaign.theme === 'leftovers';
    if (seasonal.season === 'summer') return campaign.theme === 'grocery' || campaign.theme === 'meal-prep';
    if (seasonal.season === 'autumn') return campaign.theme === 'pantry' || campaign.theme === 'budget';
    return campaign.theme === 'recovery' || campaign.theme === 'meal-prep';
  });
};

export const deriveSeasonalRecommendations = (
  campaigns: NutritionCampaignDefinition[],
  adaptiveRecommendationsByCampaignId?: Record<string, NutritionCampaignAdaptiveRecommendation>,
): string[] => {
  const seasonal = deriveSeasonalCampaigns(campaigns);
  return seasonal
    .map((campaign) => ({
      id: campaign.id,
      score: adaptiveRecommendationsByCampaignId?.[campaign.id]?.fitScore ?? 50,
      reasons: adaptiveRecommendationsByCampaignId?.[campaign.id]?.fitReasons ?? [],
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 3)
    .map((row) => row.reasons[0] ? `${row.id}: ${row.reasons[0]}` : `${row.id}: Seasonal continuity fit`);
};
