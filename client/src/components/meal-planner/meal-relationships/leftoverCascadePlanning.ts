import { buildMealRelationshipGraph } from './relationshipGraph';

export type LeftoverCascade = {
  id: string;
  mealIds: string[];
  mealNames: string[];
  daySpan: string;
  score: number;
};

export const scoreLeftoverCascade = (chain: any) => {
  const reuseLinks = Array.isArray(chain?.mealIds) ? Math.max(0, chain.mealIds.length - 1) : 0;
  const span = Math.max(1, Number(chain?.spanDays || chain?.mealIds?.length || 1));
  return Math.round((reuseLinks * 15) + Math.max(0, (4 - span) * 6));
};

export const generateLeftoverCascadeCandidates = (weeklyMeals: Record<string, any>): LeftoverCascade[] => {
  const graph = buildMealRelationshipGraph(weeklyMeals);
  return graph.leftoverChains.map((chain, index) => {
    const mealIds = chain.mealIds;
    const linkedNodes = graph.nodes.filter((node) => mealIds.includes(node.id));
    const mealNames = linkedNodes.map((meal) => meal.mealName);
    const start = linkedNodes[0]?.day || 'start';
    const end = linkedNodes[linkedNodes.length - 1]?.day || start;
    return {
      id: `leftover-${index}`,
      mealIds,
      mealNames,
      daySpan: `${start}→${end}`,
      score: scoreLeftoverCascade(chain),
    };
  }).sort((a, b) => b.score - a.score);
};

export const scheduleLeftoverChain = (weeklyMeals: Record<string, any>) => {
  return generateLeftoverCascadeCandidates(weeklyMeals).slice(0, 4).map((cascade) => ({
    ...cascade,
    leftoverCascadeId: cascade.id,
    generatedFromRelationshipGraph: true,
  }));
};
