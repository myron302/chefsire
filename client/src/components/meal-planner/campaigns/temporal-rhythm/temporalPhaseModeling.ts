import type { NutritionTemporalRhythmProfile } from '@/components/meal-planner/campaigns/temporal-rhythm/temporalRhythmProfile';

export type TemporalPhase = 'recovery' | 'stabilization' | 'momentum' | 'transformation' | 'protection' | 'novelty-reintroduction';

export const deriveTemporalPhase = (profile: NutritionTemporalRhythmProfile): TemporalPhase => {
  if (profile.recoveryWindowScore < 0.45) return 'recovery';
  if (profile.continuityProtectionScore < 0.45) return 'protection';
  if (profile.rhythmStabilityScore < 0.5) return 'stabilization';
  if (profile.transformationMomentumScore > 0.7) return 'transformation';
  if (profile.noveltyWindowScore > 0.65) return 'novelty-reintroduction';
  return 'momentum';
};

export const deriveTemporalPhaseTransitions = (profile: NutritionTemporalRhythmProfile): string[] => [
  profile.recoveryWindowScore > 0.55 ? 'Recovery → Stabilization ready.' : 'Recovery hold remains active.',
  profile.rhythmStabilityScore > 0.58 ? 'Stabilization → Momentum ready.' : 'Stabilization extension recommended.',
  profile.noveltyWindowScore > 0.65 ? 'Momentum → Novelty reintroduction unlocked.' : 'Novelty gate remains protected.',
];

export const deriveRhythmCycleNarratives = (profile: NutritionTemporalRhythmProfile): string[] => {
  const phase = deriveTemporalPhase(profile);
  return [
    `Current temporal phase: ${phase}.`,
    `Cadence transition score: ${Math.round(profile.cadenceTransitionScore * 100)}%.`,
    `Recovery window readiness: ${Math.round(profile.recoveryWindowScore * 100)}%.`,
  ];
};
