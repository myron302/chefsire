import type { NutritionCampaignProgress } from '@/components/meal-planner/campaigns/nutritionCampaignTypes';

export type NutritionSemanticCadenceMemory = {
  cadenceSuccess: number;
  cadenceFatigueRisk: number;
  noveltyTolerance: number;
  repetitionStability: number;
  recoveryCadenceEffectiveness: number;
};

const clamp01 = (value: number): number => Math.max(0, Math.min(1, value));

export const deriveSemanticCadenceMemory = (progress: NutritionCampaignProgress | null): NutritionSemanticCadenceMemory => {
  const momentum = clamp01(progress?.momentum ?? 0.5);
  const stability = clamp01(progress?.journeyStability ?? 0.5);
  const semanticVariety = progress?.missionProgress.find((mission) => mission.mission.metric === 'semantic_variety_score')?.progressPct ?? 50;
  const variety = clamp01(semanticVariety / 100);
  return {
    cadenceSuccess: clamp01(momentum * 0.55 + stability * 0.45),
    cadenceFatigueRisk: clamp01((1 - stability) * 0.6 + (1 - momentum) * 0.4),
    noveltyTolerance: clamp01(variety * 0.7 + momentum * 0.3),
    repetitionStability: clamp01(stability * 0.7 + (1 - variety) * 0.3),
    recoveryCadenceEffectiveness: clamp01((progress?.completionSemantics?.recoveryCompletion ? 0.6 : 0.25) + momentum * 0.3),
  };
};

export const deriveCadenceStability = (memory: NutritionSemanticCadenceMemory): 'fragile' | 'steady' | 'strong' => {
  const score = (memory.cadenceSuccess + memory.repetitionStability + (1 - memory.cadenceFatigueRisk)) / 3;
  if (score >= 0.7) return 'strong';
  if (score >= 0.5) return 'steady';
  return 'fragile';
};

export const deriveNoveltyRecoveryPatterns = (memory: NutritionSemanticCadenceMemory): string[] => {
  const patterns: string[] = [];
  if (memory.noveltyTolerance >= 0.65) patterns.push('responds-well-to-semantic-refresh');
  if (memory.recoveryCadenceEffectiveness >= 0.65) patterns.push('recovery-cadence-effective');
  if (memory.cadenceFatigueRisk >= 0.6) patterns.push('cadence-fatigue-watch');
  if (memory.repetitionStability >= 0.65) patterns.push('repetition-stabilizes-continuity');
  return patterns.slice(0, 5);
};
