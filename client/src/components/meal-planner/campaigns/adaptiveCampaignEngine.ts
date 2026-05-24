import { NUTRITION_CAMPAIGN_CATALOG } from '@/components/meal-planner/campaigns/nutritionCampaignCatalog';
import type { NutritionCampaignDefinition, NutritionCampaignSignals } from '@/components/meal-planner/campaigns/nutritionCampaignTypes';
import type { AdaptiveNutritionIdentity } from '@/components/meal-planner/personality-modeling/personalityTypes';
import { rankAdaptiveCampaigns } from './adaptiveCampaignRecommendations';
import { deriveAdaptiveMissionTargets, deriveCampaignDifficulty, deriveCampaignIntensity, deriveCampaignPacing, type AdaptiveCampaignProfile } from './adaptiveCampaignScaling';
import { deriveCampaignNarrative } from './adaptiveCampaignNarratives';

export type AdaptiveCampaignContext = {
  signals?: Partial<NutritionCampaignSignals>;
  personality?: AdaptiveNutritionIdentity | null;
  sustainabilityScore?: number;
  readinessScore?: number;
};

export const deriveAdaptiveCampaignProfile = (context: AdaptiveCampaignContext): AdaptiveCampaignProfile => {
  const personality = context.personality;
  return {
    prepTolerance: personality ? 1 - personality.personality.prepHeavyDinnerFatigue : 0.55,
    continuitySuccess: personality ? (personality.personality.repetitiveBreakfastPreference * 0.45 + personality.personality.lunchContinuitySuccess * 0.55) : 0.55,
    fatigueSensitivity: personality?.boredom.continuityFatigueRisk ?? 0.45,
    volatilityLevel: personality?.scheduleVolatility.scheduleVolatility ?? 0.35,
    adherenceStrength: personality ? (personality.recoveryComfort.fallbackMealEffectiveness * 0.5 + personality.personality.lateWeekCookingAdherence * 0.5) : 0.55,
    sustainabilityScore: context.sustainabilityScore ?? 0.6,
    readinessScore: context.readinessScore ?? 0.55,
    semanticFatigue: context.signals?.semanticVarietyScore ? Math.max(0, (70 - context.signals.semanticVarietyScore) / 70) : 0.4,
  };
};

export const deriveAdaptiveCampaignView = (context: AdaptiveCampaignContext): {
  profile: AdaptiveCampaignProfile;
  rankedCampaigns: Array<NutritionCampaignDefinition & { fitScore: number; fitReasons: string[] }>;
  missionTargetsByCampaignId: Record<string, Record<string, number>>;
  narrative: string;
  pacing: ReturnType<typeof deriveCampaignPacing>;
  difficulty: number;
  intensity: ReturnType<typeof deriveCampaignIntensity>;
} => {
  const profile = deriveAdaptiveCampaignProfile(context);
  const rankedCampaigns = rankAdaptiveCampaigns(NUTRITION_CAMPAIGN_CATALOG, profile);
  const missionTargetsByCampaignId = Object.fromEntries(
    NUTRITION_CAMPAIGN_CATALOG.map((campaign) => [campaign.id, deriveAdaptiveMissionTargets(campaign, profile)]),
  );
  return {
    profile,
    rankedCampaigns,
    missionTargetsByCampaignId,
    narrative: deriveCampaignNarrative(profile),
    pacing: deriveCampaignPacing(profile),
    difficulty: deriveCampaignDifficulty(profile),
    intensity: deriveCampaignIntensity(profile),
  };
};
