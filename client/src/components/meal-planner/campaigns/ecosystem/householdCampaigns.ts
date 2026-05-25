import type { NutritionCampaignProgress } from '@/components/meal-planner/campaigns/nutritionCampaignTypes';

export type SharedCampaignState = {
  campaignId: string;
  participants: number;
  completedParticipants: number;
  continuityStreakSharedDays: number;
  collaborativeMissions: string[];
};

export const deriveSharedCampaignProgress = (
  progress: NutritionCampaignProgress | null,
  participants = 1,
): SharedCampaignState | null => {
  if (!progress) return null;
  const completedParticipants = progress.complete ? Math.max(1, Math.round(participants * 0.6)) : Math.floor(participants * (progress.completionPct / 100));
  return {
    campaignId: progress.campaignId,
    participants,
    completedParticipants,
    continuityStreakSharedDays: Math.round((progress.momentum || 0.4) * 7),
    collaborativeMissions: progress.missionProgress.filter((mission) => !mission.completed).map((mission) => mission.mission.title).slice(0, 3),
  };
};

export const deriveCollaborativeMissionSuggestions = (sharedState: SharedCampaignState | null): string[] => {
  if (!sharedState) return [];
  const suggestions = sharedState.collaborativeMissions.map((mission) => `Coordinate on: ${mission}`);
  if (sharedState.participants >= 2) suggestions.push('Split prep and grocery ownership by weekday.');
  if (sharedState.continuityStreakSharedDays >= 4) suggestions.push('Protect streak momentum with one shared anchor meal.');
  return suggestions.slice(0, 4);
};
