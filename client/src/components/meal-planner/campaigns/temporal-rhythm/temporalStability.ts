import type { NutritionTemporalRhythmProfile } from '@/components/meal-planner/campaigns/temporal-rhythm/temporalRhythmProfile';

const clamp01 = (value: number): number => Math.max(0, Math.min(1, value));

export const deriveRhythmResilience = (profile: NutritionTemporalRhythmProfile): number => clamp01(
  profile.rhythmStabilityScore * 0.5 + profile.temporalFlexibilityScore * 0.3 + profile.continuityProtectionScore * 0.2,
);

export const deriveRecoveryCycleStability = (profile: NutritionTemporalRhythmProfile): number => clamp01(
  profile.recoveryWindowScore * 0.5 + profile.prepRecoveryWindowScore * 0.5,
);

export const deriveTemporalStabilityProfile = (profile: NutritionTemporalRhythmProfile) => ({
  cadenceResilience: deriveRhythmResilience(profile),
  reboundTimingQuality: clamp01(profile.prepRecoveryWindowScore * 0.6 + profile.recoveryWindowScore * 0.4),
  recoveryDurationEffectiveness: clamp01(profile.recoveryWindowScore * 0.7 + profile.stabilizationWindowScore * 0.3),
  continuityPreservationTiming: clamp01(profile.continuityProtectionScore * 0.7 + profile.rhythmStabilityScore * 0.3),
  noveltyRecoveryStabilization: clamp01((1 - Math.abs(profile.noveltyWindowScore - profile.stabilizationWindowScore)) * 0.8 + profile.temporalFlexibilityScore * 0.2),
  recoveryCycleStability: deriveRecoveryCycleStability(profile),
});
