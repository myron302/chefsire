import type { NutritionCampaignIdentity } from '@/components/meal-planner/campaigns/identity/campaignIdentity';

const STORAGE_KEY = 'mealPlanner.savedCampaigns.v1';
const MAX_SAVED = 40;

const safeRead = (): NutritionCampaignIdentity[] => {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return [];
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

const safeWrite = (items: NutritionCampaignIdentity[]): void => {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return;
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(items.slice(0, MAX_SAVED)));
  } catch {
    // localStorage unavailable: no-op fallback to preserve planner behavior
  }
};

export const getSavedCampaigns = (): NutritionCampaignIdentity[] => safeRead();

export const saveCampaignIdentity = (identity: NutritionCampaignIdentity): NutritionCampaignIdentity[] => {
  const existing = safeRead().filter((item) => item.campaignId !== identity.campaignId);
  const next = [identity, ...existing];
  safeWrite(next);
  return next;
};

export const removeSavedCampaign = (campaignId: string): NutritionCampaignIdentity[] => {
  const next = safeRead().filter((item) => item.campaignId !== campaignId);
  safeWrite(next);
  return next;
};
