import type { NutritionCampaignDefinition } from '@/components/meal-planner/campaigns/nutritionCampaignTypes';

export type NutritionCampaignMood = 'recovery' | 'momentum' | 'continuity' | 'sustainability' | 'prep-mastery';

export type NutritionCampaignThemeTokens = {
  accentColor: string;
  gradient: string;
  bgClassName: string;
  textClassName: string;
  borderClassName: string;
};

export const deriveCampaignMood = (campaign: NutritionCampaignDefinition): NutritionCampaignMood => {
  if (campaign.theme === 'recovery') return 'recovery';
  if (campaign.theme === 'meal-prep') return 'prep-mastery';
  if (campaign.theme === 'leftovers') return 'continuity';
  if (campaign.theme === 'budget' || campaign.theme === 'pantry') return 'sustainability';
  return 'momentum';
};

export const deriveCampaignAccentColor = (campaign: NutritionCampaignDefinition): string => {
  const mood = deriveCampaignMood(campaign);
  return {
    recovery: '#0ea5e9',
    momentum: '#f97316',
    continuity: '#6366f1',
    sustainability: '#16a34a',
    'prep-mastery': '#0f766e',
  }[mood];
};

export const deriveCampaignThemeTokens = (campaign: NutritionCampaignDefinition): NutritionCampaignThemeTokens => {
  const mood = deriveCampaignMood(campaign);
  switch (mood) {
    case 'recovery':
      return { accentColor: '#0ea5e9', gradient: 'from-sky-500/20 to-cyan-500/20', bgClassName: 'bg-sky-50', textClassName: 'text-sky-900', borderClassName: 'border-sky-200' };
    case 'continuity':
      return { accentColor: '#6366f1', gradient: 'from-indigo-500/20 to-violet-500/20', bgClassName: 'bg-indigo-50', textClassName: 'text-indigo-900', borderClassName: 'border-indigo-200' };
    case 'sustainability':
      return { accentColor: '#16a34a', gradient: 'from-emerald-500/20 to-lime-500/20', bgClassName: 'bg-emerald-50', textClassName: 'text-emerald-900', borderClassName: 'border-emerald-200' };
    case 'prep-mastery':
      return { accentColor: '#0f766e', gradient: 'from-teal-500/20 to-cyan-500/20', bgClassName: 'bg-teal-50', textClassName: 'text-teal-900', borderClassName: 'border-teal-200' };
    default:
      return { accentColor: '#f97316', gradient: 'from-orange-500/20 to-amber-500/20', bgClassName: 'bg-orange-50', textClassName: 'text-orange-900', borderClassName: 'border-orange-200' };
  }
};
