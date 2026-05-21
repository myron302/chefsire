import type { RelationshipEdge, LeftoverChain, PrepOpportunity } from './relationshipTypes';

export const buildMealRelationshipChains = (edges: RelationshipEdge[]) => edges
  .filter((edge) => edge.type === 'leftover' || edge.type === 'prep' || edge.type === 'ingredient')
  .sort((a, b) => b.weight - a.weight)
  .slice(0, 40);

export const detectBatchPrepClusters = (prepOpportunities: PrepOpportunity[]) => prepOpportunities
  .filter((opportunity) => opportunity.mealIds.length >= 3)
  .sort((a, b) => b.mealIds.length - a.mealIds.length);

export const deriveMealContinuityScore = (params: { totalMeals: number; edges: RelationshipEdge[]; leftoverChains: LeftoverChain[] }) => {
  const { totalMeals, edges, leftoverChains } = params;
  if (!totalMeals) return 0;
  const connected = new Set(edges.flatMap((edge) => [edge.sourceId, edge.targetId])).size;
  const connectivity = connected / totalMeals;
  const chainBonus = leftoverChains.length > 0 ? Math.min(0.25, leftoverChains.length / Math.max(1, totalMeals)) : 0;
  return Math.round(Math.min(1, connectivity + chainBonus) * 100);
};
