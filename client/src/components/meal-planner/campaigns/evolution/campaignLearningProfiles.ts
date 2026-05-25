import type { NutritionCampaignEvolutionMemory } from '@/components/meal-planner/campaigns/evolution/campaignEvolutionMemory';

export type NutritionCampaignLearningProfile = {
  campaignId: string;
  summary: string;
  preferences: string[];
  sensitivities: string[];
  strengths: string[];
};

export const deriveCampaignLearningProfile = (memory: NutritionCampaignEvolutionMemory): NutritionCampaignLearningProfile => {
  const preferences: string[] = [];
  const sensitivities: string[] = [];
  const strengths: string[] = [];

  if (memory.continuityAnchors.length > 0) preferences.push('Prefers continuity-heavy pacing');
  if (memory.semanticCadencePatterns.some((item) => item.includes('refresh'))) preferences.push('Responds well to semantic refresh');
  if (memory.prepStabilitySignals.some((item) => item.includes('overload'))) sensitivities.push('Sensitive to prep overload');
  if (memory.recoveryInterventions.length > 0) strengths.push('Stabilizes with recovery anchors');
  if (memory.successfulStrategies.length >= 3) strengths.push('Builds momentum through adaptive consistency');

  const summary = [preferences[0], sensitivities[0], strengths[0]].filter(Boolean).join(' · ') || 'Learning profile is building as campaign history grows.';
  return {
    campaignId: memory.campaignId,
    summary,
    preferences: preferences.slice(0, 4),
    sensitivities: sensitivities.slice(0, 4),
    strengths: strengths.slice(0, 4),
  };
};

export const deriveAdaptiveLearningInsights = (profile: NutritionCampaignLearningProfile): string[] =>
  [...profile.preferences, ...profile.sensitivities, ...profile.strengths].slice(0, 6);
