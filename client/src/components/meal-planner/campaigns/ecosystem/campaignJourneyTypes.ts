import type { NutritionCampaignDefinition, NutritionCampaignProgress } from '@/components/meal-planner/campaigns/nutritionCampaignTypes';

export type CampaignJourneyType =
  | 'recovery'
  | 'transformation'
  | 'sustainability'
  | 'prep mastery'
  | 'continuity'
  | 'variety recovery'
  | 'household coordination'
  | 'performance optimization';

export const deriveCampaignJourneyType = (
  campaign: NutritionCampaignDefinition,
  progress: NutritionCampaignProgress | null,
): CampaignJourneyType => {
  if (campaign.theme === 'recovery') return 'recovery';
  if (campaign.theme === 'meal-prep') return 'prep mastery';
  if (campaign.theme === 'pantry' || campaign.theme === 'budget') return 'sustainability';
  if (campaign.theme === 'leftovers') return 'variety recovery';
  if ((progress?.momentum || 0) >= 0.8) return 'performance optimization';
  if ((progress?.journeyStability || 0) >= 0.65) return 'continuity';
  return 'transformation';
};

export const deriveJourneyCategoryNarrative = (journeyType: CampaignJourneyType): string => {
  switch (journeyType) {
    case 'recovery': return 'Protect recovery while maintaining nutritional confidence.';
    case 'transformation': return 'A guided transformation arc from instability to consistency.';
    case 'sustainability': return 'High-leverage sustainability loops for pantry and budget control.';
    case 'prep mastery': return 'Operational prep mastery with adaptive pacing.';
    case 'continuity': return 'Continuity-first routines that keep execution durable.';
    case 'variety recovery': return 'Restore variety to prevent semantic fatigue and adherence drift.';
    case 'household coordination': return 'Shared planning rituals that coordinate household execution.';
    default: return 'Performance-optimized progression tuned for momentum.';
  }
};
