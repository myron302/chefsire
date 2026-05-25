import type { NutritionCampaignDefinition } from '@/components/meal-planner/campaigns/nutritionCampaignTypes';
import type { NutritionCampaignRemix } from '@/components/meal-planner/campaigns/identity/campaignRemix';

export type NutritionCampaignLineage = {
  derivedFrom?: string;
  inspiredBy?: string;
  adaptationBranch?: string;
  creatorLineage?: string;
};

export const deriveCampaignLineage = (
  campaign: NutritionCampaignDefinition,
  remix?: NutritionCampaignRemix,
  creatorName?: string,
): NutritionCampaignLineage => ({
  derivedFrom: remix ? `Derived from ${remix.basedOnTitle}` : undefined,
  inspiredBy: `Inspired by ${campaign.title}`,
  adaptationBranch: campaign.theme === 'leftovers' ? 'Household adaptation branch' : 'Adaptive campaign branch',
  creatorLineage: creatorName ? `${creatorName} template lineage` : 'ChefSire creator lineage',
});

export const deriveCampaignEvolutionNarrative = (lineage: NutritionCampaignLineage): string =>
  [lineage.derivedFrom, lineage.inspiredBy, lineage.adaptationBranch, lineage.creatorLineage].filter(Boolean).join(' · ');
