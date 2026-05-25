import type { NutritionTemporalRhythmProfile } from '@/components/meal-planner/campaigns/temporal-rhythm/temporalRhythmProfile';

const clamp01 = (value: number): number => Math.max(0, Math.min(1, value));

export const deriveTemporalStrategyWeights = (profile: NutritionTemporalRhythmProfile) => ({
  recoveryPacingWeight: clamp01((1 - profile.recoveryWindowScore) * 0.55 + profile.stabilizationWindowScore * 0.45),
  noveltyReintroductionWeight: clamp01(profile.noveltyWindowScore * profile.rhythmStabilityScore),
  continuityAnchorWeight: clamp01((1 - profile.continuityProtectionScore) * 0.5 + (1 - profile.cadenceTransitionScore) * 0.5),
  prepRecoveryProtectionWeight: clamp01(profile.prepRecoveryWindowScore * 0.7 + (1 - profile.temporalFlexibilityScore) * 0.3),
});

export const deriveRhythmProtectionBias = (weights: ReturnType<typeof deriveTemporalStrategyWeights>): string[] => [
  weights.recoveryPacingWeight > 0.55 ? 'Recovery pacing receives temporary timing priority.' : 'Recovery pacing can remain baseline.',
  weights.noveltyReintroductionWeight < 0.45 ? 'Delay novelty reintroduction until stability rises.' : 'Novelty reintroduction is rhythm-approved.',
  weights.continuityAnchorWeight > 0.55 ? 'Activate continuity anchors preemptively.' : 'Continuity anchors can stay reactive.',
  weights.prepRecoveryProtectionWeight > 0.55 ? 'Protect prep rebound windows in scheduling.' : 'Prep windows can stay flexible.',
];
