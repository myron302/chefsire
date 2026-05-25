import type { NutritionCampaignDefinition } from '@/components/meal-planner/campaigns/nutritionCampaignTypes';

const COLLECTION_STORAGE_KEY = 'mealPlanner.campaignCollections.v1';

export type NutritionCampaignCollection = {
  id: string;
  label: string;
  campaignIds: string[];
};

export const deriveCampaignCollections = (campaigns: NutritionCampaignDefinition[]): NutritionCampaignCollection[] => {
  const byTheme = (id: string, label: string, predicate: (campaign: NutritionCampaignDefinition) => boolean): NutritionCampaignCollection => ({
    id,
    label,
    campaignIds: campaigns.filter(predicate).map((campaign) => campaign.id),
  });
  return [
    byTheme('recovery', 'Recovery journeys', (campaign) => campaign.theme === 'recovery'),
    byTheme('prep', 'Prep mastery', (campaign) => campaign.theme === 'meal-prep'),
    byTheme('sustainability', 'Sustainability favorites', (campaign) => campaign.theme === 'budget' || campaign.theme === 'pantry'),
    byTheme('seasonal', 'Seasonal resets', (campaign) => campaign.durationDays >= 7),
    byTheme('creator', 'Creator campaigns', () => true),
  ].filter((collection) => collection.campaignIds.length > 0);
};

export const saveCampaignCollection = (collection: NutritionCampaignCollection): NutritionCampaignCollection[] => {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return [];
    const raw = window.localStorage.getItem(COLLECTION_STORAGE_KEY);
    const parsed = raw ? (JSON.parse(raw) as NutritionCampaignCollection[]) : [];
    const next = [collection, ...parsed.filter((item) => item.id !== collection.id)].slice(0, 20);
    window.localStorage.setItem(COLLECTION_STORAGE_KEY, JSON.stringify(next));
    return next;
  } catch {
    return [];
  }
};
