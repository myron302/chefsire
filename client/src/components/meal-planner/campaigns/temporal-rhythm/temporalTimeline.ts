import type { NutritionTemporalRhythmProfile } from '@/components/meal-planner/campaigns/temporal-rhythm/temporalRhythmProfile';

export const deriveTemporalMilestones = (profile: NutritionTemporalRhythmProfile): string[] => {
  const milestones: string[] = [];
  if (profile.recoveryWindowScore > 0.6) milestones.push('Recovery windows stabilized.');
  if (profile.noveltyWindowScore > 0.6) milestones.push('Novelty timing improved.');
  if (profile.continuityProtectionScore > 0.6) milestones.push('Continuity protection became proactive.');
  if (profile.cadenceTransitionScore > 0.6) milestones.push('Cadence transitions became smoother.');
  if (profile.transformationMomentumScore > 0.6) milestones.push('Momentum rebound accelerated.');
  return milestones;
};

export const deriveTemporalEvolutionTimeline = (profile: NutritionTemporalRhythmProfile): string[] => [
  `Rhythm stability ${Math.round(profile.rhythmStabilityScore * 100)}%.`,
  `Temporal flexibility ${Math.round(profile.temporalFlexibilityScore * 100)}%.`,
  ...deriveTemporalMilestones(profile),
];
