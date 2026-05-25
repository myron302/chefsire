import type { NutritionCampaignDefinition, NutritionCampaignAdaptiveRecommendation } from '@/components/meal-planner/campaigns/nutritionCampaignTypes';

export type NutritionCampaignTemplate = {
  id: string;
  campaignId: string;
  creatorName: string;
  creatorAvatar: string;
  creatorDescription: string;
  tags: string[];
  difficulty: 'beginner' | 'intermediate' | 'advanced';
  pacingStyle: 'gentle' | 'balanced' | 'intense';
  nutritionPhilosophy: string;
};

export const CREATOR_CAMPAIGN_TEMPLATES: NutritionCampaignTemplate[] = [
  {
    id: 'template-renee-recovery',
    campaignId: 'recovery-comfort-week',
    creatorName: 'Renee Park, RD',
    creatorAvatar: '👩🏽‍⚕️',
    creatorDescription: 'Dietitian-focused reset journeys for hectic work weeks.',
    tags: ['recovery', 'consistency', 'burnout-prevention'],
    difficulty: 'beginner',
    pacingStyle: 'gentle',
    nutritionPhilosophy: 'Stabilize first, optimize second.',
  },
  {
    id: 'template-marco-prep',
    campaignId: 'meal-prep-reset-7-day',
    creatorName: 'Marco Lin',
    creatorAvatar: '👨🏻‍🍳',
    creatorDescription: 'Batch-cooking specialist for continuity under schedule volatility.',
    tags: ['prep', 'resilience', 'time-saving'],
    difficulty: 'intermediate',
    pacingStyle: 'balanced',
    nutritionPhilosophy: 'Small prep anchors compound weekly momentum.',
  },
  {
    id: 'template-amy-variety',
    campaignId: 'smart-leftovers-challenge',
    creatorName: 'Amy Hale',
    creatorAvatar: '🧠',
    creatorDescription: 'Flavor diversity strategist for semantic fatigue recovery.',
    tags: ['variety', 'motivation', 'sustainability'],
    difficulty: 'advanced',
    pacingStyle: 'intense',
    nutritionPhilosophy: 'Novelty restores planning adherence.',
  },
];

export const deriveCreatorCampaignRecommendations = (
  campaigns: NutritionCampaignDefinition[],
  adaptiveRecommendationsByCampaignId?: Record<string, NutritionCampaignAdaptiveRecommendation>,
): Record<string, NutritionCampaignTemplate> => {
  const templatesByCampaignId = new Map(CREATOR_CAMPAIGN_TEMPLATES.map((template) => [template.campaignId, template]));

  return campaigns.reduce<Record<string, NutritionCampaignTemplate>>((acc, campaign) => {
    const template = templatesByCampaignId.get(campaign.id);
    if (!template) return acc;

    const fitScore = adaptiveRecommendationsByCampaignId?.[campaign.id]?.fitScore ?? 0;
    if (fitScore >= 50 || campaign.theme === 'recovery' || campaign.theme === 'meal-prep') {
      acc[campaign.id] = template;
    }
    return acc;
  }, {});
};
