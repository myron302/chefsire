import { type PlannerHistoryProfile } from './adaptationTypes';

const clamp = (v: number, min = 0, max = 1) => Math.max(min, Math.min(max, v));

export const deriveAdherenceAwareWeights = (history: PlannerHistoryProfile) => {
  const adherenceBias = 1 + ((history.adherence - 0.5) * 0.4);
  const consistencyBias = 1 + ((history.sustainedConsistency - 0.5) * 0.3);
  const fatiguePenalty = 1 - Math.max(0, history.fatigueTrend) * 0.25;
  return {
    continuityWeight: clamp(adherenceBias * consistencyBias, 0.65, 1.35),
    prepWeight: clamp((1 - history.prepTolerance) + 0.75, 0.65, 1.35),
    readinessWeight: clamp((history.readinessTrend >= 0 ? 1.1 : 0.9) * fatiguePenalty, 0.6, 1.3),
    temporalWeight: clamp(1 - (history.lateWeekDropoffRisk * 0.3), 0.7, 1.2),
  };
};
