import type { NutritionCampaignAdaptiveRecommendation, NutritionCampaignDefinition, NutritionCampaignProgress } from '@/components/meal-planner/campaigns/nutritionCampaignTypes';

export type CoachCampaignInsight = {
  campaignId: string;
  recommendation: string;
  explanation: string;
  nudge: string;
  phaseTransitionExplanation?: string;
  recoveryActivationExplanation?: string;
};

export const deriveCampaignInterventionReasoning = (
  progress: NutritionCampaignProgress | null,
): string => {
  if (!progress) return 'Campaign intervention awaits active progress signals.';
  if (progress.phase && progress.transitionReason) return `Phase ${progress.phase} transition: ${progress.transitionReason}`;
  if ((progress.momentum || 0) < 0.45) return 'Momentum dipped, so recovery pacing interventions are prioritized.';
  return 'Momentum remains healthy; reinforcement nudges are recommended.';
};

export const deriveCoachCampaignInsights = (
  campaigns: NutritionCampaignDefinition[],
  adaptiveRecommendationsByCampaignId?: Record<string, NutritionCampaignAdaptiveRecommendation>,
  progress?: NutritionCampaignProgress | null,
): CoachCampaignInsight[] => {
  return campaigns.slice(0, 3).map((campaign) => {
    const recommendation = adaptiveRecommendationsByCampaignId?.[campaign.id];
    const fit = recommendation?.fitScore ?? 50;
    const reasons = recommendation?.fitReasons?.slice(0, 2).join(' · ') || 'Balanced campaign fit';
    return {
      campaignId: campaign.id,
      recommendation: fit >= 70 ? `Prioritize ${campaign.title}` : `Consider ${campaign.title}`,
      explanation: `${reasons}.`,
      nudge: fit >= 70 ? 'Lock this campaign before weekly drift increases.' : 'Use as a support track if readiness drops.',
      phaseTransitionExplanation: progress?.phaseNarrative,
      recoveryActivationExplanation: progress?.completionSemantics?.recoveryCompletion
        ? 'Recovery protection remains active and stable.'
        : 'Recovery protocol will activate if momentum weakens.',
    };
  });
};
