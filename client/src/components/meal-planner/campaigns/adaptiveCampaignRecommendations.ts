import type { NutritionCampaignDefinition } from '@/components/meal-planner/campaigns/nutritionCampaignTypes';
import type { AdaptiveCampaignProfile } from './adaptiveCampaignScaling';
import { deriveCampaignMood, deriveCampaignRecoveryFocus } from './adaptiveCampaignNarratives';

export const deriveCampaignRecommendationReasons = (
  campaign: NutritionCampaignDefinition,
  profile: AdaptiveCampaignProfile,
): string[] => {
  const reasons: string[] = [];
  if (profile.continuitySuccess >= 0.65) reasons.push('High continuity fit');
  if (profile.prepTolerance < 0.45 || profile.fatigueSensitivity > 0.62) reasons.push('Low prep intensity');
  if (deriveCampaignRecoveryFocus(profile) > 0.62) reasons.push('Recovery-friendly');
  if (profile.semanticFatigue >= 0.62) reasons.push('Freshness reset');
  if (campaign.theme === 'recovery' && profile.volatilityLevel > 0.55) reasons.push('Comfort stabilization');
  return reasons.slice(0, 4);
};

export const calculateCampaignFitScore = (
  campaign: NutritionCampaignDefinition,
  profile: AdaptiveCampaignProfile,
): number => {
  const mood = deriveCampaignMood(profile);
  const themeBoost = (
    (campaign.theme === 'recovery' && mood === 'recovery') ||
    (campaign.theme === 'meal-prep' && profile.prepTolerance >= 0.55) ||
    (campaign.theme === 'leftovers' && profile.continuitySuccess >= 0.6) ||
    (campaign.theme === 'pantry' && profile.sustainabilityScore >= 0.58)
  ) ? 0.14 : 0;

  const profileScore =
    (profile.adherenceStrength * 0.2) +
    ((1 - profile.volatilityLevel) * 0.15) +
    (profile.sustainabilityScore * 0.2) +
    (profile.continuitySuccess * 0.2) +
    ((1 - profile.fatigueSensitivity) * 0.1) +
    ((1 - profile.semanticFatigue) * 0.15);

  return Math.round(Math.min(100, (profileScore + themeBoost) * 100));
};

export const rankAdaptiveCampaigns = (
  campaigns: NutritionCampaignDefinition[],
  profile: AdaptiveCampaignProfile,
): Array<NutritionCampaignDefinition & { fitScore: number; fitReasons: string[] }> => {
  return campaigns.map((campaign) => ({
    ...campaign,
    fitScore: calculateCampaignFitScore(campaign, profile),
    fitReasons: deriveCampaignRecommendationReasons(campaign, profile),
  })).sort((a, b) => b.fitScore - a.fitScore);
};
