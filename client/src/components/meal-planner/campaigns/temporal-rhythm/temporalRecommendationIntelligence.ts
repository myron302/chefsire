import type { NutritionCampaignAdaptiveRecommendation } from '@/components/meal-planner/campaigns/nutritionCampaignTypes';
import type { NutritionBehavioralIntelligenceProfile } from '@/components/meal-planner/campaigns/behavioral-intelligence/behavioralIntelligenceProfile';
import type { NutritionLifeStateProfile } from '@/components/meal-planner/campaigns/life-state-intelligence/lifeStateProfile';
import type { NutritionTemporalRhythmProfile } from '@/components/meal-planner/campaigns/temporal-rhythm/temporalRhythmProfile';

const clamp01 = (value: number): number => Math.max(0, Math.min(1, value));

export const deriveTemporalCompatibilityScore = (
  behavioral: NutritionBehavioralIntelligenceProfile,
  life: NutritionLifeStateProfile,
  temporal: NutritionTemporalRhythmProfile,
  recommendation?: NutritionCampaignAdaptiveRecommendation,
): number => clamp01(
  behavioral.momentumRecoveryScore * 0.2 + (1 - life.scheduleVolatilityScore) * 0.2 + temporal.rhythmStabilityScore * 0.3 + temporal.recoveryWindowScore * 0.2 + ((recommendation?.fitScore ?? 0.5) * 0.1),
);

export const deriveTemporalRecommendationConfidence = (temporal: NutritionTemporalRhythmProfile, compatibility: number): number => clamp01(
  temporal.temporalConfidence * 0.55 + compatibility * 0.45,
);

export const deriveTemporalProtectionBias = (temporal: NutritionTemporalRhythmProfile): string[] => [
  temporal.continuityProtectionScore < 0.5 ? 'Prioritize continuity protection windows before escalation.' : 'Continuity protection can stay light-touch this cycle.',
  temporal.recoveryWindowScore < 0.5 ? 'Hold challenge until recovery timing improves.' : 'Recovery timing supports selective challenge windows.',
];
