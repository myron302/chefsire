import type { NutritionCampaignDefinition } from '@/components/meal-planner/campaigns/nutritionCampaignTypes';

export type NutritionCampaignRemix = {
  basedOnCampaignId: string;
  basedOnTitle: string;
  modifications: string[];
  remixLabel: string;
};

export const deriveCampaignRemix = (
  campaign: NutritionCampaignDefinition,
  options?: { recoveryFocus?: boolean; householdContinuity?: boolean; reducedPrepIntensity?: boolean },
): NutritionCampaignRemix => {
  const modifications: string[] = [];
  if (options?.recoveryFocus || campaign.theme === 'recovery') modifications.push('Modified for recovery pacing');
  if (options?.householdContinuity || campaign.theme === 'leftovers') modifications.push('Adapted for household continuity');
  if (options?.reducedPrepIntensity) modifications.push('Reduced prep intensity');
  if (!modifications.length) modifications.push('Semantic refresh');

  return {
    basedOnCampaignId: campaign.id,
    basedOnTitle: campaign.title,
    modifications,
    remixLabel: `Based on ${campaign.title}`,
  };
};

export const deriveCampaignRemixNarrative = (remix: NutritionCampaignRemix): string =>
  `${remix.remixLabel} · ${remix.modifications.join(' · ')}`;
