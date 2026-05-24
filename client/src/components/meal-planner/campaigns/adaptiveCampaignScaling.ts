import type { NutritionCampaignDefinition, NutritionCampaignMission, NutritionCampaignMissionMetric } from '@/components/meal-planner/campaigns/nutritionCampaignTypes';

export type AdaptiveCampaignProfile = {
  prepTolerance: number;
  continuitySuccess: number;
  fatigueSensitivity: number;
  volatilityLevel: number;
  adherenceStrength: number;
  sustainabilityScore: number;
  readinessScore: number;
  semanticFatigue: number;
};

export type AdaptiveMissionTargets = Record<NutritionCampaignMissionMetric, number>;

const clamp = (value: number, min = 0, max = 1): number => Math.min(max, Math.max(min, value));

const clampTarget = (value: number): number => Math.max(1, Math.round(value));

export const deriveCampaignDifficulty = (profile: AdaptiveCampaignProfile): number => {
  const stability = 1 - profile.volatilityLevel;
  const readiness = profile.readinessScore;
  const sustainability = profile.sustainabilityScore;
  return clamp((profile.adherenceStrength * 0.35) + (stability * 0.25) + (readiness * 0.2) + (sustainability * 0.2));
};

export const deriveCampaignPacing = (profile: AdaptiveCampaignProfile): 'slow' | 'steady' | 'accelerated' => {
  const paceScore = (1 - profile.fatigueSensitivity) * 0.4 + profile.adherenceStrength * 0.35 + (1 - profile.volatilityLevel) * 0.25;
  if (paceScore < 0.45) return 'slow';
  if (paceScore < 0.72) return 'steady';
  return 'accelerated';
};

export const deriveCampaignIntensity = (profile: AdaptiveCampaignProfile): 'low' | 'moderate' | 'high' => {
  const score = deriveCampaignDifficulty(profile) * 0.6 + profile.prepTolerance * 0.2 + (1 - profile.semanticFatigue) * 0.2;
  if (score < 0.45) return 'low';
  if (score < 0.72) return 'moderate';
  return 'high';
};

export const deriveAdaptiveMissionTargets = (
  campaign: NutritionCampaignDefinition,
  profile: AdaptiveCampaignProfile,
): AdaptiveMissionTargets => {
  const difficulty = deriveCampaignDifficulty(profile);
  const complexityTargets = deriveMissionComplexityTargets(profile);

  return campaign.missions.reduce((acc, mission) => {
    acc[mission.metric] = scaleCampaignMissionDifficulty(mission, profile, difficulty, complexityTargets);
    return acc;
  }, {
    planned_breakfasts: 0,
    prep_tasks_completed: 0,
    grocery_items_resolved: 0,
    pantry_ingredients_used: 0,
    leftover_friendly_meals: 0,
    protein_goal_days: 0,
    semantic_variety_score: 0,
    prep_overload_reduction: 0,
  } as AdaptiveMissionTargets);
};

export const deriveMissionComplexityTargets = (profile: AdaptiveCampaignProfile): { lowFrictionBias: number; continuityBias: number; varietyBias: number } => ({
  lowFrictionBias: clamp((1 - profile.prepTolerance) * 0.55 + profile.fatigueSensitivity * 0.45, 0.75, 1.35),
  continuityBias: clamp(profile.continuitySuccess * 0.6 + profile.adherenceStrength * 0.4, 0.85, 1.4),
  varietyBias: clamp(profile.semanticFatigue * 0.7 + (1 - profile.volatilityLevel) * 0.3, 0.85, 1.5),
});

export const scaleCampaignMissionDifficulty = (
  mission: NutritionCampaignMission,
  profile: AdaptiveCampaignProfile,
  difficulty = deriveCampaignDifficulty(profile),
  complexityTargets = deriveMissionComplexityTargets(profile),
): number => {
  const stableMultiplier = clamp(0.85 + difficulty * 0.45, 0.8, 1.35);

  switch (mission.metric) {
    case 'planned_breakfasts':
      return clampTarget(mission.target * stableMultiplier * complexityTargets.continuityBias);
    case 'prep_tasks_completed':
      return clampTarget(mission.target * stableMultiplier * (1 / complexityTargets.lowFrictionBias));
    case 'grocery_items_resolved':
      return clampTarget(mission.target * clamp(0.9 + profile.readinessScore * 0.3, 0.8, 1.25));
    case 'pantry_ingredients_used':
      return clampTarget(mission.target * clamp(0.9 + profile.sustainabilityScore * 0.35, 0.8, 1.3));
    case 'leftover_friendly_meals':
      return clampTarget(mission.target * clamp(0.9 + profile.continuitySuccess * 0.35, 0.85, 1.35));
    case 'protein_goal_days':
      return clampTarget(mission.target * stableMultiplier);
    case 'semantic_variety_score':
      return clampTarget(mission.target * complexityTargets.varietyBias);
    case 'prep_overload_reduction':
      return clampTarget(mission.target * clamp(1 + profile.fatigueSensitivity * 0.25 + profile.volatilityLevel * 0.2, 1, 1.4));
    default:
      return mission.target;
  }
};
