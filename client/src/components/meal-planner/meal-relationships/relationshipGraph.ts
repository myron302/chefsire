import { getAllPlannerMeals } from '../planner-graph/plannerGraphUtils';
import { extractMealIngredients } from '../planner-graph/plannerMealExtraction';
import { normalizeMealIngredient } from '../plannerGroceryUtils';
import { MEAL_TYPES, WEEK_DAYS } from '../nutritionMealPlannerUtils';
import { buildIngredientRelationshipGraph, detectReusableIngredientClusters } from './ingredientRelationships';
import { buildLeftoverLifecycleGraph, detectMealCarryoverChains } from './leftoverLifecycle';
import { buildMealRelationshipChains, deriveMealContinuityScore } from './mealChainAnalysis';
import { buildPrepDependencyGraph, calculatePrepReuseEfficiency, detectSharedPrepOpportunities } from './prepDependencyGraph';
import { calculateRelationshipEfficiency, deriveRelationshipInsights } from './relationshipScoring';
import type { MealRelationshipGraph, RelationshipNode } from './relationshipTypes';

const toNode = (ref: any): RelationshipNode => ({
  ...ref,
  id: String(ref?.meal?.entryId || ref?.meal?.id || `${ref.day}-${ref.mealType}-${ref.index}`),
  mealName: String(ref?.meal?.name || ref?.meal?.title || `${ref.day} ${ref.mealType}`).trim(),
  normalizedIngredients: extractMealIngredients(ref.meal).map((row) => normalizeMealIngredient(row?.name || '')).filter(Boolean),
  dayIndex: WEEK_DAYS.indexOf(ref.day),
});

export const buildMealRelationshipGraph = (weeklyMeals: Record<string, any> | null | undefined): MealRelationshipGraph => {
  const nodes = getAllPlannerMeals(weeklyMeals, WEEK_DAYS, MEAL_TYPES).map(toNode).slice(0, 80);
  const ingredientEdges = buildIngredientRelationshipGraph(nodes);
  const prepOpportunities = detectSharedPrepOpportunities(nodes);
  const prepEdges = buildPrepDependencyGraph(nodes);
  const leftoverEdges = buildLeftoverLifecycleGraph(nodes);
  const ingredientClusters = detectReusableIngredientClusters(nodes);
  const leftoverChains = detectMealCarryoverChains(nodes, leftoverEdges);
  const edges = [...ingredientEdges, ...prepEdges, ...leftoverEdges];
  const continuityScore = deriveMealContinuityScore({ totalMeals: nodes.length, edges, leftoverChains });

  const graph: MealRelationshipGraph = {
    nodes,
    edges: buildMealRelationshipChains(edges),
    ingredientClusters,
    prepOpportunities,
    leftoverChains,
    continuityScore,
    relationshipEfficiency: 0,
    insights: [],
  };

  graph.relationshipEfficiency = calculateRelationshipEfficiency(graph);
  graph.insights = deriveRelationshipInsights(graph);
  return graph;
};

export const analyzeMealRelationships = buildMealRelationshipGraph;
export const optimizeMealReuseChains = (weeklyMeals: Record<string, any> | null | undefined) => buildMealRelationshipGraph(weeklyMeals);
export const calculateRelationshipEfficiencyScore = (weeklyMeals: Record<string, any> | null | undefined) => {
  const graph = buildMealRelationshipGraph(weeklyMeals);
  return { continuityScore: graph.continuityScore, efficiencyScore: graph.relationshipEfficiency, prepReuseScore: calculatePrepReuseEfficiency(graph.prepOpportunities, graph.nodes.length) };
};
