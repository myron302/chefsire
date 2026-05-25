import type { NutritionBehavioralIntelligenceProfile } from '@/components/meal-planner/campaigns/behavioral-intelligence/behavioralIntelligenceProfile';

export type BehavioralMilestone = {
  id: string;
  detail: string;
  signal: 'continuity' | 'recovery' | 'novelty' | 'prep' | 'momentum';
};

export const deriveBehavioralMilestones = (profile: NutritionBehavioralIntelligenceProfile): BehavioralMilestone[] => {
  const milestones: BehavioralMilestone[] = [];
  if (profile.continuityPreferenceScore >= 0.7) milestones.push({ id: 'continuity-stabilized', detail: 'Continuity preference stabilized', signal: 'continuity' });
  if (profile.recoveryStabilizationScore >= 0.65) milestones.push({ id: 'recovery-improved', detail: 'Recovery responsiveness improved', signal: 'recovery' });
  if (profile.noveltyToleranceScore < 0.5) milestones.push({ id: 'novelty-decreased', detail: 'Novelty tolerance decreased', signal: 'novelty' });
  if (profile.prepToleranceScore >= 0.6) milestones.push({ id: 'prep-resilience', detail: 'Prep resilience improved', signal: 'prep' });
  if (profile.momentumRecoveryScore >= 0.6) milestones.push({ id: 'momentum-consistency', detail: 'Momentum recovery became more consistent', signal: 'momentum' });
  return milestones;
};

export const deriveBehavioralEvolutionTimeline = (profile: NutritionBehavioralIntelligenceProfile): BehavioralMilestone[] => deriveBehavioralMilestones(profile);
