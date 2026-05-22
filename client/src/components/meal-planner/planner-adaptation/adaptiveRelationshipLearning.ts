import { type LongitudinalPlanningSnapshot, type RelationshipLearningProfile } from './adaptationTypes';

export const analyzeHistoricalMealChains = (history: LongitudinalPlanningSnapshot[]) => {
  const successful = history.reduce((sum, entry) => sum + entry.successfulRelationshipChains, 0);
  const abandoned = history.reduce((sum, entry) => sum + entry.abandonedRelationshipChains, 0);
  return { successful, abandoned, successRate: successful / Math.max(1, successful + abandoned) };
};

export const deriveSuccessfulRelationshipPatterns = (history: LongitudinalPlanningSnapshot[]) => {
  const insights: string[] = [];
  const chain = analyzeHistoricalMealChains(history);
  if (chain.successRate > 0.65) insights.push('Leftover and prep chains remain stable across recent weeks.');
  if (history.some((entry) => entry.groceryCompletionRate > 0.75 && entry.successfulRelationshipChains > entry.abandonedRelationshipChains)) {
    insights.push('Batch-prep cluster continuity is supporting grocery completion.');
  }
  return insights;
};

export const detectRelationshipBreakdownPatterns = (history: LongitudinalPlanningSnapshot[]) => {
  const alerts: string[] = [];
  const chain = analyzeHistoricalMealChains(history);
  if (chain.successRate < 0.5) alerts.push('Relationship chains are frequently breaking before completion.');
  if (history.some((entry) => entry.abandonedRelationshipChains > entry.successfulRelationshipChains)) {
    alerts.push('Some weeks show abandoned leftover cascades exceeding successful chains.');
  }
  return alerts;
};

export const deriveRelationshipLearningProfile = (history: LongitudinalPlanningSnapshot[]): RelationshipLearningProfile => {
  const chain = analyzeHistoricalMealChains(history);
  return {
    successfulPatterns: deriveSuccessfulRelationshipPatterns(history),
    breakdownPatterns: detectRelationshipBreakdownPatterns(history),
    successRate: chain.successRate,
  };
};
