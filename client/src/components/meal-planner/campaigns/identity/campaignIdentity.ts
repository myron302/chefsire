import type { NutritionCampaignDefinition, NutritionCampaignProgress } from '@/components/meal-planner/campaigns/nutritionCampaignTypes';
import { deriveCampaignJourneyType } from '@/components/meal-planner/campaigns/ecosystem/campaignJourneyTypes';
import { deriveCampaignThemeTokens } from '@/components/meal-planner/campaigns/identity/campaignVisualIdentity';

export type NutritionCampaignIdentity = {
  campaignId: string;
  slug: string;
  creatorAttribution: string;
  shareTitle: string;
  campaignSummary: string;
  pacingSignature: string;
  journeySignature: string;
  semanticIdentityTags: string[];
  visualIdentity: ReturnType<typeof deriveCampaignThemeTokens>;
};

const slugify = (value: string): string => value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

export const deriveCampaignSignature = (campaign: NutritionCampaignDefinition): string => {
  const missionDensity = campaign.missions.length >= 4 ? 'prep-intensive' : 'semantic-refresh';
  const continuity = campaign.theme === 'leftovers' || campaign.theme === 'meal-prep' ? 'continuity-driven' : 'momentum-optimizer';
  return `${campaign.theme}-${missionDensity}-${continuity}`;
};

export const deriveCampaignVisualIdentity = (campaign: NutritionCampaignDefinition) => deriveCampaignThemeTokens(campaign);

export const deriveCampaignIdentity = (
  campaign: NutritionCampaignDefinition,
  progress?: NutritionCampaignProgress | null,
  creatorName?: string,
): NutritionCampaignIdentity => {
  const journeyType = deriveCampaignJourneyType(campaign, progress || null) || 'Guided journey';
  const pacingSignature = progress?.phase || (campaign.durationDays <= 7 ? 'Recovery-first' : 'Continuity-driven');
  return {
    campaignId: campaign.id,
    slug: slugify(campaign.title),
    creatorAttribution: creatorName ? `Creator: ${creatorName}` : 'ChefSire Nutrition Studio',
    shareTitle: `${campaign.title} · ${journeyType}`,
    campaignSummary: campaign.description,
    pacingSignature,
    journeySignature: deriveCampaignSignature(campaign),
    semanticIdentityTags: [campaign.theme, journeyType.toLowerCase().replace(/\s+/g, '-'), `${campaign.durationDays}-day`],
    visualIdentity: deriveCampaignThemeTokens(campaign),
  };
};
