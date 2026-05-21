import type { RelationshipNode, RelationshipEdge, LeftoverChain } from './relationshipTypes';

const MAX_LEFTOVER_DAY_SPAN = 3;

export const calculateLeftoverReusePotential = (source: RelationshipNode, target: RelationshipNode) => {
  const dayGap = target.dayIndex - source.dayIndex;
  if (dayGap <= 0 || dayGap > MAX_LEFTOVER_DAY_SPAN) return 0;
  const shared = source.normalizedIngredients.filter((name) => target.normalizedIngredients.includes(name));
  return Math.min(1, (shared.length / Math.max(1, source.normalizedIngredients.length)) * (1 - (dayGap - 1) * 0.2));
};

export const buildLeftoverLifecycleGraph = (nodes: RelationshipNode[]): RelationshipEdge[] => {
  const edges: RelationshipEdge[] = [];
  nodes.forEach((source) => {
    nodes.forEach((target) => {
      if (source.id === target.id) return;
      const weight = calculateLeftoverReusePotential(source, target);
      if (weight < 0.2) return;
      edges.push({ sourceId: source.id, targetId: target.id, type: 'leftover', weight, reasons: ['leftover carryover freshness window'] });
    });
  });
  return edges;
};

export const detectMealCarryoverChains = (nodes: RelationshipNode[], leftoverEdges: RelationshipEdge[]): LeftoverChain[] => {
  const bySource = new Map<string, RelationshipEdge[]>();
  leftoverEdges.forEach((edge) => bySource.set(edge.sourceId, [...(bySource.get(edge.sourceId) || []), edge]));

  const chains: LeftoverChain[] = [];
  nodes.forEach((node) => {
    const first = (bySource.get(node.id) || []).sort((a, b) => b.weight - a.weight)[0];
    if (!first) return;
    const second = (bySource.get(first.targetId) || []).sort((a, b) => b.weight - a.weight)[0];
    const mealIds = second ? [node.id, first.targetId, second.targetId] : [node.id, first.targetId];
    if (mealIds.length < 2) return;
    chains.push({
      id: `carryover-${mealIds.join('-')}`,
      mealIds,
      spanDays: Math.max(1, mealIds.length - 1),
      safetyScore: Math.round(((first.weight + (second?.weight || first.weight)) / (second ? 2 : 1)) * 100),
      ingredient: 'shared cooked components',
    });
  });
  return chains.slice(0, 12);
};
