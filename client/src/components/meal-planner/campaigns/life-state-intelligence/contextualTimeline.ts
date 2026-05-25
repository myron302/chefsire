import type { NutritionLifeStateProfile } from '@/components/meal-planner/campaigns/life-state-intelligence/lifeStateProfile';

export type ContextualMilestone = { id: string; detail: string; severity: 'info' | 'watch' | 'protective' };

export const deriveContextualMilestones = (profile: NutritionLifeStateProfile): ContextualMilestone[] => {
  const milestones: ContextualMilestone[] = [];
  if (profile.scheduleVolatilityScore <= 0.4) milestones.push({ id: 'schedule-stabilized', detail: 'Schedule volatility stabilized.', severity: 'info' });
  if (profile.burnoutPressureScore <= 0.4) milestones.push({ id: 'burnout-reduced', detail: 'Burnout pressure reduced.', severity: 'info' });
  if (profile.recoveryPressureScore <= 0.45) milestones.push({ id: 'recovery-softened', detail: 'Recovery pressure softened.', severity: 'info' });
  if (profile.stabilizationNeedScore >= 0.6) milestones.push({ id: 'protective-mode', detail: 'Continuity protection mode activated during instability.', severity: 'protective' });
  if (profile.timeScarcityScore >= 0.6) milestones.push({ id: 'time-scarcity-watch', detail: 'Time scarcity elevated; simplify prep cadence.', severity: 'watch' });
  return milestones;
};

export const deriveLifeStateEvolutionTimeline = (profile: NutritionLifeStateProfile): ContextualMilestone[] => {
  const milestones = deriveContextualMilestones(profile);
  if (!milestones.length) {
    return [{ id: 'context-calibrating', detail: 'Life-state intelligence is calibrating from recent campaign behavior.', severity: 'info' }];
  }
  return milestones;
};
