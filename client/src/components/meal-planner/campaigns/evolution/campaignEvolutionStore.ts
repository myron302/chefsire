import type { NutritionCampaignEvolutionMemory } from '@/components/meal-planner/campaigns/evolution/campaignEvolutionMemory';

const STORAGE_KEY = 'mealPlanner.campaignEvolutionMemory.v1';
const MAX_CAMPAIGN_MEMORY = 24;

type EvolutionMemoryStore = {
  memories: NutritionCampaignEvolutionMemory[];
};

const isBrowser = (): boolean => typeof window !== 'undefined' && Boolean(window.localStorage);

const emptyStore = (): EvolutionMemoryStore => ({ memories: [] });

export const pruneCampaignEvolutionMemory = (memories: NutritionCampaignEvolutionMemory[]): NutritionCampaignEvolutionMemory[] =>
  [...memories]
    .sort((a, b) => Date.parse(b.lastUpdatedAt) - Date.parse(a.lastUpdatedAt))
    .slice(0, MAX_CAMPAIGN_MEMORY);

export const getCampaignEvolutionMemory = (): NutritionCampaignEvolutionMemory[] => {
  if (!isBrowser()) return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as EvolutionMemoryStore;
    if (!parsed || !Array.isArray(parsed.memories)) return [];
    return pruneCampaignEvolutionMemory(parsed.memories.filter((item) => item && typeof item.campaignId === 'string'));
  } catch {
    return [];
  }
};

export const saveCampaignEvolutionMemory = (memories: NutritionCampaignEvolutionMemory[]): NutritionCampaignEvolutionMemory[] => {
  const pruned = pruneCampaignEvolutionMemory(memories);
  if (!isBrowser()) return pruned;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(emptyStore()));
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ memories: pruned }));
  } catch {
    // preserve graceful fallback
  }
  return pruned;
};
