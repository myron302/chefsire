import type { NutritionCampaignProgress } from '@/components/meal-planner/campaigns/nutritionCampaignTypes';

export type NutritionCampaignEventType =
  | 'phase-transition'
  | 'milestone-unlocked'
  | 'recovery-protection-activated'
  | 'momentum-unlocked'
  | 'continuity-streak-achieved';

export type NutritionCampaignEvent = {
  id: string;
  campaignId: string;
  type: NutritionCampaignEventType;
  title: string;
  description: string;
  occurredAt: string;
};

export const deriveCampaignEvents = (progress: NutritionCampaignProgress | null): NutritionCampaignEvent[] => {
  if (!progress) return [];
  const events: NutritionCampaignEvent[] = [];
  const occurredAt = new Date().toISOString();

  if (progress.phase) {
    events.push({
      id: `${progress.campaignId}-phase-${progress.phase}`,
      campaignId: progress.campaignId,
      type: 'phase-transition',
      title: 'Phase transition',
      description: progress.phaseNarrative || 'Campaign advanced to a new adaptive phase.',
      occurredAt,
    });
  }
  if (progress.completionSemantics?.recoveryCompletion) {
    events.push({ id: `${progress.campaignId}-recovery`, campaignId: progress.campaignId, type: 'recovery-protection-activated', title: 'Recovery protection activated', description: 'Recovery completion semantics reached stabilization threshold.', occurredAt });
  }
  if ((progress.momentum || 0) >= 0.8) {
    events.push({ id: `${progress.campaignId}-momentum`, campaignId: progress.campaignId, type: 'momentum-unlocked', title: 'Momentum unlocked', description: 'Adaptive momentum crossed the high-confidence threshold.', occurredAt });
  }
  if ((progress.journeyStability || 0) >= 0.7) {
    events.push({ id: `${progress.campaignId}-continuity`, campaignId: progress.campaignId, type: 'continuity-streak-achieved', title: 'Continuity streak achieved', description: 'Journey stability confirms durable continuity behavior.', occurredAt });
  }
  if (progress.complete) {
    events.push({ id: `${progress.campaignId}-milestone`, campaignId: progress.campaignId, type: 'milestone-unlocked', title: 'Milestone unlocked', description: 'Campaign mission milestone completed.', occurredAt });
  }

  return events;
};
