import React from 'react';
import type { NutritionCampaignAdaptiveRecommendation, NutritionCampaignProgress } from '@/components/meal-planner/campaigns/nutritionCampaignTypes';
import { deriveCreatorCampaignRecommendations } from '@/components/meal-planner/campaigns/ecosystem/creatorCampaignTemplates';
import { deriveCampaignIdentity } from '@/components/meal-planner/campaigns/identity/campaignIdentity';
import { getSavedCampaigns, removeSavedCampaign, saveCampaignIdentity } from '@/components/meal-planner/campaigns/identity/savedCampaignStore';
import { deriveCampaignEvolutionMemory, updateCampaignEvolutionMemory } from '@/components/meal-planner/campaigns/evolution/campaignEvolutionMemory';
import { getCampaignEvolutionMemory, saveCampaignEvolutionMemory } from '@/components/meal-planner/campaigns/evolution/campaignEvolutionStore';
import { deriveBehavioralIntelligenceProfile, updateBehavioralIntelligenceProfile } from '@/components/meal-planner/campaigns/behavioral-intelligence/behavioralIntelligenceProfile';
import { getBehavioralIntelligenceProfile, saveBehavioralIntelligenceProfile } from '@/components/meal-planner/campaigns/behavioral-intelligence/behavioralIntelligenceStore';
import { createDefaultLifeStateProfile, updateLifeStateProfile } from '@/components/meal-planner/campaigns/life-state-intelligence/lifeStateProfile';
import { getLifeStateProfile, saveLifeStateProfile } from '@/components/meal-planner/campaigns/life-state-intelligence/lifeStateStore';
import { createDefaultTemporalRhythmProfile, updateTemporalRhythmProfile } from '@/components/meal-planner/campaigns/temporal-rhythm/temporalRhythmProfile';
import { getTemporalRhythmProfile, saveTemporalRhythmProfile } from '@/components/meal-planner/campaigns/temporal-rhythm/temporalRhythmStore';
import { selectActiveCampaign } from '@/components/meal-planner/planner-core/selectors';

export type CampaignEvolutionMemoryById = Record<string, ReturnType<typeof deriveCampaignEvolutionMemory>>;

type UseCampaignPersistenceInput = {
  activeCampaignId: string | null;
  progress: NutritionCampaignProgress | null;
  adaptiveRecommendationsByCampaignId?: Record<string, NutritionCampaignAdaptiveRecommendation>;
};

export const useCampaignPersistence = ({
  activeCampaignId,
  progress,
  adaptiveRecommendationsByCampaignId,
}: UseCampaignPersistenceInput) => {
  const [savedCampaignIds, setSavedCampaignIds] = React.useState<Set<string>>(() => new Set(getSavedCampaigns().map((item) => item.campaignId)));
  const [evolutionMemoryByCampaignId, setEvolutionMemoryByCampaignId] = React.useState(() => {
    const fromStore = getCampaignEvolutionMemory();
    return fromStore.reduce<CampaignEvolutionMemoryById>((acc, item) => {
      acc[item.campaignId] = item;
      return acc;
    }, {});
  });
  const [behavioralProfile, setBehavioralProfile] = React.useState(() => getBehavioralIntelligenceProfile());
  const [lifeStateProfile, setLifeStateProfile] = React.useState(() => getLifeStateProfile() ?? createDefaultLifeStateProfile());
  const [temporalRhythmProfile, setTemporalRhythmProfile] = React.useState(() => getTemporalRhythmProfile() ?? createDefaultTemporalRhythmProfile());

  const toggleSavedCampaign = React.useCallback((campaignId: string) => {
    const campaign = selectActiveCampaign(campaignId);
    if (!campaign) return;
    const creator = deriveCreatorCampaignRecommendations([campaign], adaptiveRecommendationsByCampaignId)[campaign.id]?.creatorName;
    setSavedCampaignIds((prev) => {
      if (prev.has(campaignId)) {
        removeSavedCampaign(campaignId);
        const next = new Set(prev);
        next.delete(campaignId);
        return next;
      }
      const identity = deriveCampaignIdentity(campaign, progress, creator);
      saveCampaignIdentity(identity);
      return new Set(prev).add(campaignId);
    });
  }, [adaptiveRecommendationsByCampaignId, progress]);

  React.useEffect(() => {
    if (!activeCampaignId) return;
    let nextValue: CampaignEvolutionMemoryById | null = null;
    setEvolutionMemoryByCampaignId((prev) => {
      const nextMemory = updateCampaignEvolutionMemory(prev[activeCampaignId] ?? null, activeCampaignId, progress);
      const next = { ...prev, [activeCampaignId]: nextMemory };
      nextValue = next;
      const allMemories = saveCampaignEvolutionMemory(Object.values(next));
      setBehavioralProfile((previous) => {
        const updated = updateBehavioralIntelligenceProfile(previous, allMemories);
        return saveBehavioralIntelligenceProfile(updated);
      });
      return next;
    });
    if (nextValue) {
      const allMemories = Object.values(nextValue) as ReturnType<typeof deriveCampaignEvolutionMemory>[];
      const behavioralForLifeState = updateBehavioralIntelligenceProfile(behavioralProfile, allMemories);
      const nextLifeState = updateLifeStateProfile(lifeStateProfile, behavioralForLifeState, allMemories);
      setLifeStateProfile(saveLifeStateProfile(nextLifeState));
      const nextTemporal = updateTemporalRhythmProfile(temporalRhythmProfile, behavioralForLifeState, nextLifeState, allMemories);
      setTemporalRhythmProfile(saveTemporalRhythmProfile(nextTemporal));
    }
  }, [activeCampaignId, progress, behavioralProfile, lifeStateProfile, temporalRhythmProfile]);

  return {
    savedCampaignIds,
    toggleSavedCampaign,
    evolutionMemoryByCampaignId,
    behavioralProfile,
    lifeStateProfile,
    temporalRhythmProfile,
  };
};
