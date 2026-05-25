import type { NutritionCampaignEvolutionMemory } from '@/components/meal-planner/campaigns/evolution/campaignEvolutionMemory';

export type CrossCampaignBehavioralPatterns = {
  totalCampaigns: number;
  repeatedSuccessPatterns: string[];
  repeatedFailurePatterns: string[];
  cadenceConsistency: number;
  prepOverloadRecurrence: number;
  recoveryEffectiveness: number;
  continuityStabilizationTrend: number;
  averageAdherenceTrend: number;
  averageMomentum: number;
  remixSuccessRate: number;
};

const clamp01 = (value: number): number => Math.max(0, Math.min(1, value));

const topPatterns = (all: string[], minCount = 2, max = 6): string[] => {
  const counts = all.reduce<Record<string, number>>((acc, pattern) => {
    acc[pattern] = (acc[pattern] ?? 0) + 1;
    return acc;
  }, {});
  return Object.entries(counts)
    .filter(([, count]) => count >= minCount)
    .sort((a, b) => b[1] - a[1])
    .slice(0, max)
    .map(([pattern]) => pattern);
};

export const deriveCrossCampaignBehavioralPatterns = (memories: NutritionCampaignEvolutionMemory[]): CrossCampaignBehavioralPatterns => {
  if (!memories.length) {
    return {
      totalCampaigns: 0,
      repeatedSuccessPatterns: [],
      repeatedFailurePatterns: [],
      cadenceConsistency: 0.5,
      prepOverloadRecurrence: 0.5,
      recoveryEffectiveness: 0.5,
      continuityStabilizationTrend: 0.5,
      averageAdherenceTrend: 0.5,
      averageMomentum: 0.5,
      remixSuccessRate: 0.5,
    };
  }

  const cadenceSignalRatio = memories
    .map((memory) => memory.semanticCadencePatterns.length / Math.max(1, memory.semanticCadencePatterns.length + memory.failedStrategies.length))
    .reduce((sum, value) => sum + value, 0) / memories.length;

  const prepOverloadCount = memories.flatMap((memory) => memory.prepStabilitySignals).filter((signal) => signal.includes('overload')).length;
  const prepSignalCount = memories.flatMap((memory) => memory.prepStabilitySignals).length;

  const recoverySignals = memories.flatMap((memory) => memory.recoveryInterventions);
  const continuitySignals = memories.flatMap((memory) => memory.continuityAnchors);

  const remixOutcomes = memories.flatMap((memory) => memory.remixOutcomes);
  const remixPositive = remixOutcomes.filter((outcome) => /lift|stable|improved|success|effective/i.test(outcome)).length;

  return {
    totalCampaigns: memories.length,
    repeatedSuccessPatterns: topPatterns(memories.flatMap((memory) => memory.successfulStrategies)),
    repeatedFailurePatterns: topPatterns(memories.flatMap((memory) => memory.failedStrategies)),
    cadenceConsistency: clamp01(cadenceSignalRatio),
    prepOverloadRecurrence: prepSignalCount > 0 ? clamp01(prepOverloadCount / prepSignalCount) : 0.5,
    recoveryEffectiveness: clamp01(recoverySignals.length / Math.max(1, recoverySignals.length + memories.flatMap((memory) => memory.failedStrategies).length)),
    continuityStabilizationTrend: clamp01(continuitySignals.length / Math.max(1, memories.length * 2)),
    averageAdherenceTrend: clamp01(memories.reduce((sum, memory) => sum + memory.adherenceTrend, 0) / memories.length),
    averageMomentum: clamp01(memories.reduce((sum, memory) => sum + (memory.momentumHistory.at(-1) ?? 0.5), 0) / memories.length),
    remixSuccessRate: remixOutcomes.length ? clamp01(remixPositive / remixOutcomes.length) : 0.5,
  };
};

export const deriveSharedAdaptivePatterns = (patterns: CrossCampaignBehavioralPatterns): string[] => [
  ...patterns.repeatedSuccessPatterns.map((pattern) => `success:${pattern}`),
  ...patterns.repeatedFailurePatterns.map((pattern) => `risk:${pattern}`),
].slice(0, 8);

export const deriveBehavioralConsistency = (patterns: CrossCampaignBehavioralPatterns): number => {
  const positive = (patterns.cadenceConsistency + patterns.recoveryEffectiveness + patterns.continuityStabilizationTrend + patterns.averageAdherenceTrend) / 4;
  const penalty = patterns.prepOverloadRecurrence * 0.35;
  return clamp01(positive - penalty + 0.2);
};
