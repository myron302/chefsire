export type ActiveNutritionCampaignState = {
  campaignId: string;
  startedAt: string;
};

export const getCampaignStorageKey = (userId?: string | null) => `nutrition-campaign-active-v1:${userId || 'anon'}`;

export const loadActiveCampaignState = (userId?: string | null): ActiveNutritionCampaignState | null => {
  try {
    const raw = localStorage.getItem(getCampaignStorageKey(userId));
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed?.campaignId || !parsed?.startedAt) return null;
    return parsed;
  } catch (error) {
    console.error('Unable to load active nutrition campaign state:', error);
    return null;
  }
};

export const saveActiveCampaignState = (state: ActiveNutritionCampaignState | null, userId?: string | null) => {
  try {
    const key = getCampaignStorageKey(userId);
    if (!state) {
      localStorage.removeItem(key);
      return;
    }
    localStorage.setItem(key, JSON.stringify(state));
  } catch (error) {
    console.error('Unable to save active nutrition campaign state:', error);
  }
};
