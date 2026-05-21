import type { RelationshipNode, RelationshipEdge, PrepOpportunity } from './relationshipTypes';

const PREP_ARTIFACTS: Record<string, string[]> = {
  'batch protein': ['chicken', 'beef', 'turkey', 'tofu', 'bean', 'lentil'],
  'cooked grains': ['rice', 'quinoa', 'pasta', 'oat'],
  'chopped aromatics': ['onion', 'garlic', 'pepper', 'carrot', 'celery'],
  'sauces / dressings': ['sauce', 'dressing', 'vinaigrette', 'salsa', 'marinade'],
  'roasted vegetables': ['broccoli', 'zucchini', 'cauliflower', 'sweet potato', 'vegetable'],
};

const matchingArtifacts = (ingredients: string[]) => Object.entries(PREP_ARTIFACTS)
  .filter(([, words]) => ingredients.some((name) => words.some((word) => name.includes(word))))
  .map(([artifact]) => artifact);

export const detectSharedPrepOpportunities = (nodes: RelationshipNode[]): PrepOpportunity[] => {
  const grouped = new Map<string, string[]>();
  nodes.forEach((node) => {
    matchingArtifacts(node.normalizedIngredients).forEach((artifact) => {
      grouped.set(artifact, [...(grouped.get(artifact) || []), node.id]);
    });
  });

  return Array.from(grouped.entries()).filter(([, ids]) => new Set(ids).size >= 2).map(([artifact, mealIds]) => ({
    id: `prep-${artifact.replace(/[^a-z0-9]+/g, '-')}`,
    artifact,
    mealIds: Array.from(new Set(mealIds)),
    efficiency: Math.min(1, mealIds.length / Math.max(2, nodes.length * 0.4)),
    notes: [`${artifact} can be prepared once and reused across ${new Set(mealIds).size} meals.`],
  }));
};

export const buildPrepDependencyGraph = (nodes: RelationshipNode[]): RelationshipEdge[] => {
  const opportunities = detectSharedPrepOpportunities(nodes);
  return opportunities.flatMap((opportunity) => opportunity.mealIds.flatMap((sourceId, i) => opportunity.mealIds.slice(i + 1).map((targetId) => ({
    sourceId,
    targetId,
    type: 'prep' as const,
    weight: opportunity.efficiency,
    reasons: [opportunity.artifact],
  }))));
};

export const calculatePrepReuseEfficiency = (opportunities: PrepOpportunity[], nodeCount: number) => {
  if (!nodeCount) return 0;
  const coveredMealIds = new Set(opportunities.flatMap((opportunity) => opportunity.mealIds));
  const coverage = coveredMealIds.size / nodeCount;
  const weighted = opportunities.reduce((sum, item) => sum + item.efficiency, 0) / Math.max(1, opportunities.length);
  return Math.round((coverage * 0.65 + weighted * 0.35) * 100);
};
