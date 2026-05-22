import { type AdaptivePlannerProfile, type LongitudinalPlanningSnapshot } from './adaptationTypes';
import { derivePlannerHistoryProfile } from './longitudinalHistory';
import { deriveAdaptiveBehaviorSignals, deriveBehavioralOptimizationAdjustments } from './behavioralAdaptation';
import { deriveSustainablePlanningProfile } from './sustainabilityEngine';
import { deriveRelationshipLearningProfile } from './adaptiveRelationshipLearning';
import { buildAdaptiveNutritionIdentity } from '../personality-modeling/nutritionPersonality';
import { derivePersonalityObjectiveAdjustments, derivePersonalityRecommendations } from '../personality-modeling/personalityObjectiveAdjustments';


const PERSONALITY_STORAGE_KEY = 'mealPlanner.nutritionPersonality.v1';
const PERSONALITY_MEMORY_LIMIT = 24;

const persistNutritionPersonalityMemory = (recommendations: string[], observedAt: string) => {
  if (typeof window === 'undefined') return;
  try {
    const parsed = JSON.parse(window.localStorage.getItem(PERSONALITY_STORAGE_KEY) || '[]');
    const safe = Array.isArray(parsed) ? parsed : [];
    const next = [...safe, ...recommendations.map((message) => ({ message, observedAt }))].slice(-PERSONALITY_MEMORY_LIMIT);
    window.localStorage.setItem(PERSONALITY_STORAGE_KEY, JSON.stringify(next));
  } catch {
    // no-op: storage failures should not affect planner behavior
  }
};


export const deriveAdaptivePlannerProfile = (history: LongitudinalPlanningSnapshot[]): AdaptivePlannerProfile => {
  const historyProfile = derivePlannerHistoryProfile(history);
  const behaviorSignals = deriveAdaptiveBehaviorSignals(historyProfile);
  const behaviorAdjustments = deriveBehavioralOptimizationAdjustments(historyProfile);
  const sustainability = deriveSustainablePlanningProfile(history);
  const relationshipLearning = deriveRelationshipLearningProfile(history);
  const nutritionPersonality = buildAdaptiveNutritionIdentity(history);
  const personalityAdjustments = derivePersonalityObjectiveAdjustments(nutritionPersonality);

  const recommendations: string[] = [];
  if (behaviorSignals.reducePrepComplexity) recommendations.push('Lower prep complexity improved adherence in recent planning cycles.');
  if (behaviorSignals.favorContinuity) recommendations.push('Continuity-focused sequencing is aligned with your stronger completion weeks.');
  if (behaviorSignals.reduceLateWeekIntensity) recommendations.push('Late-week intensity is being reduced due to recurring completion dropoff signals.');
  if (sustainability.sustainabilityScore > 0.7) recommendations.push('Prep sustainability improved and current cadence appears maintainable.');
  if (relationshipLearning.successRate > 0.65) recommendations.push('Batch-prep chains are improving grocery completion consistency.');
  recommendations.push(...sustainability.unsustainablePatterns);
  recommendations.push(...relationshipLearning.breakdownPatterns);
  recommendations.push(...derivePersonalityRecommendations(nutritionPersonality));
  persistNutritionPersonalityMemory(recommendations, new Date().toISOString());

  return {
    history: historyProfile,
    behaviorSignals,
    behaviorAdjustments: {
      ...behaviorAdjustments,
      prepComplexityMultiplier: behaviorAdjustments.prepComplexityMultiplier * personalityAdjustments.prepComplexityMultiplier,
      continuityMultiplier: behaviorAdjustments.continuityMultiplier * personalityAdjustments.continuityMultiplier,
      temporalIntensityMultiplier: behaviorAdjustments.temporalIntensityMultiplier * personalityAdjustments.temporalIntensityMultiplier,
      readinessBalanceBias: behaviorAdjustments.readinessBalanceBias * personalityAdjustments.readinessBalanceBias,
      failedChainPenalty: behaviorAdjustments.failedChainPenalty * personalityAdjustments.failedChainPenalty,
    },
    sustainability,
    relationshipLearning,
    recommendations,
    nutritionPersonality,
  };
};
