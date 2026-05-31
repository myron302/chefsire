import { useEffect, useState } from 'react';
import { loadActiveCampaignState, saveActiveCampaignState } from '@/components/meal-planner/campaigns/nutritionCampaignProgress';

export const usePlannerCampaignState = (userId?: string | null) => {
  const [activeCampaignId, setActiveCampaignId] = useState<string | null>(null);
  const [activeCampaignStartedAt, setActiveCampaignStartedAt] = useState<string | null>(null);

  useEffect(() => {
    const state = loadActiveCampaignState(userId);
    if (state) {
      setActiveCampaignId(state.campaignId);
      setActiveCampaignStartedAt(state.startedAt);
    }
  }, [userId]);

  useEffect(() => {
    if (!activeCampaignId || !activeCampaignStartedAt) return;
    saveActiveCampaignState({ campaignId: activeCampaignId, startedAt: activeCampaignStartedAt }, userId);
  }, [activeCampaignId, activeCampaignStartedAt, userId]);

  const activateCampaign = (campaignId: string) => {
    setActiveCampaignId(campaignId);
    setActiveCampaignStartedAt(new Date().toISOString());
  };

  const clearCampaign = () => {
    setActiveCampaignId(null);
    setActiveCampaignStartedAt(null);
    saveActiveCampaignState(null, userId);
  };

  return {
    activeCampaignId,
    setActiveCampaignId,
    activeCampaignStartedAt,
    setActiveCampaignStartedAt,
    activateCampaign,
    clearCampaign,
  };
};
