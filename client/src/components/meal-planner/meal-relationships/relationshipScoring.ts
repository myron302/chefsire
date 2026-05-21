import type { MealRelationshipGraph } from './relationshipTypes';

export const calculateRelationshipEfficiency = (graph: MealRelationshipGraph) => {
  const coverage = graph.nodes.length ? new Set(graph.edges.flatMap((edge) => [edge.sourceId, edge.targetId])).size / graph.nodes.length : 0;
  const ingredientStrength = graph.ingredientClusters.reduce((sum, cluster) => sum + cluster.strength, 0) / Math.max(1, graph.ingredientClusters.length);
  const prepStrength = graph.prepOpportunities.reduce((sum, item) => sum + item.efficiency, 0) / Math.max(1, graph.prepOpportunities.length);
  const leftoverSafety = graph.leftoverChains.reduce((sum, chain) => sum + chain.safetyScore, 0) / Math.max(1, graph.leftoverChains.length) / 100;
  return Math.round((coverage * 0.35 + ingredientStrength * 0.25 + prepStrength * 0.25 + leftoverSafety * 0.15) * 100);
};

export const deriveRelationshipInsights = (graph: MealRelationshipGraph) => {
  const insights: string[] = [];
  const topPrep = graph.prepOpportunities[0];
  if (topPrep) insights.push(`Batch-prepped ${topPrep.artifact} supports ${topPrep.mealIds.length} meals.`);
  if (graph.ingredientClusters.length > 0) insights.push(`Ingredient continuity spans ${graph.ingredientClusters[0].mealIds.length} linked meals for ${graph.ingredientClusters[0].ingredient}.`);
  const longestChain = graph.leftoverChains.sort((a, b) => b.mealIds.length - a.mealIds.length)[0];
  if (longestChain) insights.push(`Leftover reuse chain spans ${longestChain.mealIds.length - 1} days with safety score ${longestChain.safetyScore}.`);
  if (graph.continuityScore >= 70) insights.push('Meal continuity is strong, reducing isolated one-off prep work.');
  return insights;
};
