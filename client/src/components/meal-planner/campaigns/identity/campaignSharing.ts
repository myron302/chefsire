import type { NutritionCampaignDefinition, NutritionCampaignProgress } from '@/components/meal-planner/campaigns/nutritionCampaignTypes';
import type { NutritionCampaignIdentity } from '@/components/meal-planner/campaigns/identity/campaignIdentity';

export type NutritionCampaignSharePayload = {
  id: string;
  title: string;
  summary: string;
  missions: string[];
  pacingProfile: string;
  adaptiveHighlights: string[];
  achievementHighlights: string[];
  journeySignature: string;
};

export const deriveCampaignSharePayload = (
  campaign: NutritionCampaignDefinition,
  identity: NutritionCampaignIdentity,
  progress?: NutritionCampaignProgress | null,
): NutritionCampaignSharePayload => ({
  id: campaign.id,
  title: identity.shareTitle,
  summary: campaign.description,
  missions: campaign.missions.map((mission) => mission.title),
  pacingProfile: identity.pacingSignature,
  adaptiveHighlights: [progress?.phaseNarrative, progress?.transitionReason].filter(Boolean) as string[],
  achievementHighlights: progress?.complete ? [campaign.rewardCopy] : [],
  journeySignature: identity.journeySignature,
});

export const deriveCampaignShareSummary = (payload: NutritionCampaignSharePayload): string =>
  `${payload.title}: ${payload.summary} · Pacing ${payload.pacingProfile}`;

export const deriveCampaignExportData = (payload: NutritionCampaignSharePayload): string => JSON.stringify(payload, null, 2);
