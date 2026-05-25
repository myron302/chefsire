import type { NutritionCampaignDefinition, NutritionCampaignAdaptiveRecommendation } from '@/components/meal-planner/campaigns/nutritionCampaignTypes';

export type NutritionCampaignOrigin =
  | 'system'
  | 'ai-coach'
  | 'creator'
  | 'seasonal'
  | 'household'
  | 'transformation'
  | 'featured';

export const deriveCampaignOrigin = (
  campaign: NutritionCampaignDefinition,
  context?: {
    hasCreatorTemplate?: boolean;
    isSeasonal?: boolean;
    isHouseholdReady?: boolean;
    recommendation?: NutritionCampaignAdaptiveRecommendation;
  },
): NutritionCampaignOrigin => {
  if (context?.hasCreatorTemplate) return 'creator';
  if (context?.isSeasonal) return 'seasonal';
  if (context?.isHouseholdReady) return 'household';
  if (campaign.theme === 'recovery' || context?.recommendation?.fitReasons.some((reason) => /recovery/i.test(reason))) return 'transformation';
  if ((context?.recommendation?.fitScore || 0) >= 85) return 'ai-coach';
  if ((context?.recommendation?.fitScore || 0) >= 75) return 'featured';
  return 'system';
};

export const deriveCampaignSourceLabel = (origin: NutritionCampaignOrigin): string => {
  switch (origin) {
    case 'ai-coach': return 'AI Coach Pick';
    case 'creator': return 'Creator Template';
    case 'seasonal': return 'Seasonal Journey';
    case 'household': return 'Household Ready';
    case 'transformation': return 'Transformation Track';
    case 'featured': return 'Featured';
    default: return 'Core Planner';
  }
};

export const deriveCampaignDiscoveryReason = (origin: NutritionCampaignOrigin): string => {
  switch (origin) {
    case 'ai-coach': return 'Recommended by AI Coach';
    case 'creator': return 'Creator-curated challenge';
    case 'seasonal': return 'Featured seasonal journey';
    case 'household': return 'Household continuity challenge';
    case 'transformation': return 'Transformation recovery pathway';
    case 'featured': return 'Featured by planner momentum signals';
    default: return 'System-guided campaign foundation';
  }
};
