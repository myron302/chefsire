import { type AdaptiveBehaviorSignals, type BehavioralOptimizationAdjustments, type PlannerHistoryProfile } from './adaptationTypes';
import { deriveAdherenceAwareWeights } from './adherenceAnalysis';

const clamp = (v: number, min = 0, max = 1) => Math.max(min, Math.min(max, v));

export const calculateAdaptiveComplexityTolerance = (history: PlannerHistoryProfile) => {
  const fatiguePenalty = Math.max(0, history.fatigueTrend) * 0.35;
  const dropoffPenalty = history.lateWeekDropoffRisk * 0.25;
  return clamp(history.complexityTolerance - fatiguePenalty - dropoffPenalty);
};

export const deriveAdaptiveBehaviorSignals = (history: PlannerHistoryProfile): AdaptiveBehaviorSignals => {
  const adaptiveComplexityTolerance = calculateAdaptiveComplexityTolerance(history);
  return {
    reducePrepComplexity: history.prepTolerance < 0.55 || adaptiveComplexityTolerance < 0.45,
    avoidFailedChains: history.relationshipSuccessRate < 0.5,
    favorContinuity: history.adherence > 0.7 && history.sustainedConsistency > 0.6,
    reduceContinuityDueToFatigue: history.fatigueTrend > 0.1,
    reduceLateWeekIntensity: history.lateWeekDropoffRisk > 0.4,
    adaptiveComplexityTolerance,
  };
};

export const deriveBehavioralOptimizationAdjustments = (history: PlannerHistoryProfile): BehavioralOptimizationAdjustments => {
  const weights = deriveAdherenceAwareWeights(history);
  const signals = deriveAdaptiveBehaviorSignals(history);
  return {
    prepComplexityMultiplier: signals.reducePrepComplexity ? 0.82 : 1,
    continuityMultiplier: signals.reduceContinuityDueToFatigue ? 0.9 : (signals.favorContinuity ? 1.12 : 1),
    temporalIntensityMultiplier: signals.reduceLateWeekIntensity ? 0.86 : 1,
    readinessBalanceBias: weights.readinessWeight,
    failedChainPenalty: signals.avoidFailedChains ? 0.88 : 1,
  };
};
