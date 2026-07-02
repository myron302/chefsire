import { useEffect, useRef, useState } from 'react';
import { fetchCampaignState, startCampaign } from '@/components/meal-planner/campaigns/api/campaignPersistenceApi';

export const usePlannerCampaignState = (userId?: string | null) => {
  const [activeCampaignId, setActiveCampaignId] = useState<string | null>(null);
  const [activeCampaignStartedAt, setActiveCampaignStartedAt] = useState<string | null>(null);
  const [lastActivatedCampaignId, setLastActivatedCampaignId] = useState<string | null>(null);
  const activationVersionRef = useRef(0);

  const [campaignActionPending, setCampaignActionPending] = useState(false);
  const [campaignActionError, setCampaignActionError] = useState<string | null>(null);

  useEffect(() => {
    if (!userId) return;
    let mounted = true;
    const loadActivationVersion = activationVersionRef.current;
    fetchCampaignState()
      .then((state) => {
        if (!mounted || activationVersionRef.current !== loadActivationVersion) return;
        setActiveCampaignId(state.activeCampaign?.campaignId ?? null);
        setActiveCampaignStartedAt(state.activeCampaign?.startedAt ?? null);
        setLastActivatedCampaignId(null);
      })
      .catch((error) => {
        if (mounted && activationVersionRef.current === loadActivationVersion) {
          setCampaignActionError(error instanceof Error ? error.message : 'Failed to load campaign state');
        }
      });
    return () => { mounted = false; };
  }, [userId]);

  const activateCampaign = async (campaignId: string) => {
    setCampaignActionPending(true);
    setCampaignActionError(null);
    try {
      const active = await startCampaign(campaignId);
      activationVersionRef.current += 1;
      setActiveCampaignId(active.campaignId);
      setActiveCampaignStartedAt(active.startedAt ?? new Date().toISOString());
      setLastActivatedCampaignId(active.campaignId);
    } catch (error) {
      setCampaignActionError(error instanceof Error ? error.message : 'Failed to start campaign');
      throw error;
    } finally {
      setCampaignActionPending(false);
    }
  };

  const clearCampaign = () => {
    setActiveCampaignId(null);
    setActiveCampaignStartedAt(null);
    setLastActivatedCampaignId(null);

  };

  return {
    activeCampaignId,
    setActiveCampaignId,
    activeCampaignStartedAt,
    lastActivatedCampaignId,
    setActiveCampaignStartedAt,
    activateCampaign,
    clearCampaign,
    campaignActionPending,
    campaignActionError,
  };
};
