import type { NutritionCampaignProgress } from '@/components/meal-planner/campaigns/nutritionCampaignTypes';
import type { NutritionCampaignEvolutionMemory } from '@/components/meal-planner/campaigns/evolution/campaignEvolutionMemory';

export type CampaignEvolutionTimelineItem = {
  id: string;
  title: string;
  detail: string;
  tone: 'positive' | 'watch';
};

export const deriveEvolutionTimeline = (
  progress: NutritionCampaignProgress | null,
  memory: NutritionCampaignEvolutionMemory | null,
): CampaignEvolutionTimelineItem[] => {
  if (!progress || !memory) return [];
  const items: CampaignEvolutionTimelineItem[] = [];

  if ((progress.journeyStability ?? 0) >= 0.65) {
    items.push({
      id: 'continuity-stabilized',
      title: 'Continuity stabilized',
      detail: 'Recovery pacing stabilized continuity.',
      tone: 'positive',
    });
  }
  if (progress.completionSemantics?.semanticResetCompletion) {
    items.push({
      id: 'semantic-reset-effective',
      title: 'Semantic reset effective',
      detail: 'Semantic reset reduced fatigue pressure.',
      tone: 'positive',
    });
  }
  if (memory.prepStabilitySignals.some((item) => item.includes('overload'))) {
    items.push({
      id: 'prep-overload-watch',
      title: 'Prep load adjustment',
      detail: 'Prep reduction improved sustainability.',
      tone: 'watch',
    });
  }
  if ((progress.momentum ?? 0) >= 0.65) {
    items.push({
      id: 'momentum-recovered',
      title: 'Momentum recovered',
      detail: 'Momentum recovered after cadence shift.',
      tone: 'positive',
    });
  }

  return items.slice(0, 6);
};

export const deriveEvolutionMilestones = (timeline: CampaignEvolutionTimelineItem[]): string[] =>
  timeline.filter((item) => item.tone === 'positive').map((item) => item.title).slice(0, 4);
