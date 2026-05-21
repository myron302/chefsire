import { buildMealRelationshipGraph } from './relationshipGraph';

export type RelationshipMealChain = {
  id: string;
  seedMealId: string;
  mealIds: string[];
  days: string[];
  mealNames: string[];
  score: number;
};

export const generateDerivativeMealOptions = (weeklyMeals: Record<string, any>, seedMealId: string) => {
  const graph = buildMealRelationshipGraph(weeklyMeals);
  const edges = graph.edges.filter((edge) => edge.sourceId === seedMealId || edge.targetId === seedMealId);
  return edges.map((edge) => ({
    mealId: edge.sourceId === seedMealId ? edge.targetId : edge.sourceId,
    relation: edge.type,
    weight: edge.weight,
  })).sort((a, b) => b.weight - a.weight);
};

export const scoreMealChainPotential = (weeklyMeals: Record<string, any>, mealIds: string[]) => {
  const graph = buildMealRelationshipGraph(weeklyMeals);
  const edgeSet = new Set(mealIds);
  const edgeScore = graph.edges
    .filter((edge) => edgeSet.has(edge.sourceId) && edgeSet.has(edge.targetId))
    .reduce((sum, edge) => sum + edge.weight, 0);
  const leftovers = graph.leftoverChains.filter((chain) => chain.mealIds.some((mealId) => edgeSet.has(mealId))).length;
  return Math.round(edgeScore + (leftovers * 8));
};

export const constructMealReuseSequence = (weeklyMeals: Record<string, any>, chain: RelationshipMealChain) => {
  return chain.mealIds.map((mealId, index) => ({
    mealId,
    chainId: chain.id,
    sequenceIndex: index,
    generatedFromRelationshipGraph: true,
  }));
};

export const buildSeedMealChains = (weeklyMeals: Record<string, any>) => {
  const graph = buildMealRelationshipGraph(weeklyMeals);
  return graph.nodes.slice(0, 24).map((node) => {
    const derivatives = generateDerivativeMealOptions(weeklyMeals, node.id).slice(0, 3);
    const mealIds = [node.id, ...derivatives.map((item) => item.mealId)];
    const meals = graph.nodes.filter((candidate) => mealIds.includes(candidate.id));
    return {
      id: `chain-${node.id}`,
      seedMealId: node.id,
      mealIds,
      mealNames: meals.map((meal) => meal.mealName),
      days: meals.map((meal) => meal.day),
      score: scoreMealChainPotential(weeklyMeals, mealIds),
    } satisfies RelationshipMealChain;
  }).filter((chain) => chain.mealIds.length > 1).sort((a, b) => b.score - a.score);
};
