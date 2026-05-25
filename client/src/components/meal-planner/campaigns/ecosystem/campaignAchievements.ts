import type { NutritionCampaignProgress } from '@/components/meal-planner/campaigns/nutritionCampaignTypes';

export type CampaignAchievement = {
  id: string;
  title: string;
  unlocked: boolean;
  narrative: string;
};

export const deriveCampaignAchievements = (progress: NutritionCampaignProgress | null): CampaignAchievement[] => {
  if (!progress) return [];
  return [
    { id: 'recovery-stabilized', title: 'Recovery stabilized', unlocked: Boolean(progress.completionSemantics?.recoveryCompletion), narrative: 'Recovery protection stayed active across mission windows.' },
    { id: 'continuity-4-week', title: '4-week continuity maintained', unlocked: (progress.momentum || 0) >= 0.7, narrative: 'Continuity behavior sustained with stable mission cadence.' },
    { id: 'prep-resilience', title: 'Prep resilience unlocked', unlocked: progress.missionProgress.some((mission) => mission.mission.metric === 'prep_tasks_completed' && mission.completed), narrative: 'Prep workload stayed resilient under weekly volatility.' },
    { id: 'semantic-fatigue-recovery', title: 'Semantic fatigue recovery completed', unlocked: Boolean(progress.completionSemantics?.semanticResetCompletion), narrative: 'Variety and novelty recovered enough to protect adherence.' },
  ];
};

export const deriveMilestoneUnlocks = (progress: NutritionCampaignProgress | null): string[] => (
  deriveCampaignAchievements(progress).filter((achievement) => achievement.unlocked).map((achievement) => achievement.title)
);

export const deriveCampaignStreakRewards = (progress: NutritionCampaignProgress | null): string[] => {
  if (!progress) return [];
  const rewards: string[] = [];
  if ((progress.momentum || 0) >= 0.8) rewards.push('Momentum unlocked');
  if ((progress.journeyStability || 0) >= 0.7) rewards.push('Continuity streak achieved');
  if (progress.complete) rewards.push('Campaign completion reward ready');
  return rewards;
};
