import type { NutritionCampaignAdaptiveRecommendation, NutritionCampaignDefinition, NutritionCampaignProgress } from '@/components/meal-planner/campaigns/nutritionCampaignTypes';
import { deriveCampaignOrigin, deriveCampaignSourceLabel, deriveCampaignDiscoveryReason } from '@/components/meal-planner/campaigns/ecosystem/campaignOrigins';
import { deriveCreatorCampaignRecommendations } from '@/components/meal-planner/campaigns/ecosystem/creatorCampaignTemplates';
import { deriveSeasonalCampaigns, deriveSeasonalNarratives } from '@/components/meal-planner/campaigns/ecosystem/seasonalCampaigns';
import { deriveCampaignIdentity } from '@/components/meal-planner/campaigns/identity/campaignIdentity';
import { deriveCampaignRemix, deriveCampaignRemixNarrative } from '@/components/meal-planner/campaigns/identity/campaignRemix';
import { deriveCampaignCollections } from '@/components/meal-planner/campaigns/identity/campaignCollections';
import { deriveCampaignLineage, deriveCampaignEvolutionNarrative } from '@/components/meal-planner/campaigns/identity/campaignLineage';

type BuildCampaignPanelViewModelInput = {
  activeCampaignId: string | null;
  progress: NutritionCampaignProgress | null;
  rankedCampaigns: NutritionCampaignDefinition[];
  adaptiveRecommendationsByCampaignId?: Record<string, NutritionCampaignAdaptiveRecommendation>;
};

export type CampaignSuggestionCardViewModel = {
  campaign: NutritionCampaignDefinition;
  recommendation?: NutritionCampaignAdaptiveRecommendation;
  isTopRecommendation: boolean;
  isActive: boolean;
  isSeasonal: boolean;
  isHouseholdReady: boolean;
  isAiCoachRecommended: boolean;
  sourceLabel: string;
  seasonalLabel: string | null;
  creatorTemplate?: ReturnType<typeof deriveCreatorCampaignRecommendations>[string];
  discoveryReason: string;
  identity: ReturnType<typeof deriveCampaignIdentity>;
  remixNarrative: string;
  evolutionNarrative: string;
  collectionLabel: string | null;
};

export type CampaignPanelViewModel = {
  topCampaignId: string | undefined;
  suggestedCampaigns: CampaignSuggestionCardViewModel[];
};

export const buildCampaignPanelViewModel = ({
  activeCampaignId,
  progress,
  rankedCampaigns,
  adaptiveRecommendationsByCampaignId,
}: BuildCampaignPanelViewModelInput): CampaignPanelViewModel => {
  const topCampaignId = rankedCampaigns[0]?.id;
  const creatorTemplatesByCampaignId = deriveCreatorCampaignRecommendations(rankedCampaigns, adaptiveRecommendationsByCampaignId);
  const seasonalCampaignIds = new Set(deriveSeasonalCampaigns(rankedCampaigns).map((campaign) => campaign.id));
  const seasonalNarrative = deriveSeasonalNarratives();
  const collections = deriveCampaignCollections(rankedCampaigns);

  return {
    topCampaignId,
    suggestedCampaigns: rankedCampaigns.map((campaign) => {
      const recommendation = adaptiveRecommendationsByCampaignId?.[campaign.id];
      const creatorTemplate = creatorTemplatesByCampaignId[campaign.id];
      const isSeasonal = seasonalCampaignIds.has(campaign.id);
      const isHouseholdReady = campaign.theme === 'meal-prep' || campaign.theme === 'leftovers';
      const origin = deriveCampaignOrigin(campaign, {
        hasCreatorTemplate: Boolean(creatorTemplate),
        isSeasonal,
        isHouseholdReady,
        recommendation,
      });
      const creatorName = creatorTemplate?.creatorName;
      const identity = deriveCampaignIdentity(campaign, progress, creatorName);
      const remix = deriveCampaignRemix(campaign, { householdContinuity: campaign.theme === 'leftovers' });
      const lineage = deriveCampaignLineage(campaign, remix, creatorName);
      const collection = collections.find((item) => item.campaignIds.includes(campaign.id));

      return {
        campaign,
        recommendation,
        isTopRecommendation: topCampaignId === campaign.id,
        isActive: activeCampaignId === campaign.id,
        isSeasonal,
        isHouseholdReady,
        isAiCoachRecommended: activeCampaignId !== campaign.id && topCampaignId === campaign.id,
        sourceLabel: deriveCampaignSourceLabel(origin),
        seasonalLabel: isSeasonal ? seasonalNarrative.title : null,
        creatorTemplate,
        discoveryReason: deriveCampaignDiscoveryReason(origin),
        identity,
        remixNarrative: deriveCampaignRemixNarrative(remix),
        evolutionNarrative: deriveCampaignEvolutionNarrative(lineage),
        collectionLabel: collection?.label ?? null,
      };
    }),
  };
};
