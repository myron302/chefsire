import { type AdaptivePlannerProfile, type LongitudinalPlanningSnapshot } from './adaptationTypes';
import { derivePlannerHistoryProfile } from './longitudinalHistory';
import { deriveAdaptiveBehaviorSignals, deriveBehavioralOptimizationAdjustments } from './behavioralAdaptation';
import { deriveSustainablePlanningProfile } from './sustainabilityEngine';
import { deriveRelationshipLearningProfile } from './adaptiveRelationshipLearning';

export const deriveAdaptivePlannerProfile = (history: LongitudinalPlanningSnapshot[]): AdaptivePlannerProfile => {
  const historyProfile = derivePlannerHistoryProfile(history);
  const behaviorSignals = deriveAdaptiveBehaviorSignals(historyProfile);
  const behaviorAdjustments = deriveBehavioralOptimizationAdjustments(historyProfile);
  const sustainability = deriveSustainablePlanningProfile(history);
  const relationshipLearning = deriveRelationshipLearningProfile(history);

  const recommendations: string[] = [];
  if (behaviorSignals.reducePrepComplexity) recommendations.push('Lower prep complexity improved adherence in recent planning cycles.');
  if (behaviorSignals.favorContinuity) recommendations.push('Continuity-focused sequencing is aligned with your stronger completion weeks.');
  if (behaviorSignals.reduceLateWeekIntensity) recommendations.push('Late-week intensity is being reduced due to recurring completion dropoff signals.');
  if (sustainability.sustainabilityScore > 0.7) recommendations.push('Prep sustainability improved and current cadence appears maintainable.');
  if (relationshipLearning.successRate > 0.65) recommendations.push('Batch-prep chains are improving grocery completion consistency.');
  recommendations.push(...sustainability.unsustainablePatterns);
  recommendations.push(...relationshipLearning.breakdownPatterns);

  return {
    history: historyProfile,
    behaviorSignals,
    behaviorAdjustments,
    sustainability,
    relationshipLearning,
    recommendations,
  };
};
