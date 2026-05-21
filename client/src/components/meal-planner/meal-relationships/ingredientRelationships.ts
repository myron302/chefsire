import { normalizeMealIngredient } from '../plannerGroceryUtils';
import type { RelationshipNode, RelationshipEdge, IngredientCluster } from './relationshipTypes';

const INGREDIENT_FAMILIES: Record<string, string[]> = {
  protein: ['chicken', 'beef', 'turkey', 'tofu', 'salmon', 'bean', 'lentil'],
  grains: ['rice', 'quinoa', 'pasta', 'oat', 'bread', 'tortilla'],
  aromatics: ['onion', 'garlic', 'ginger', 'scallion'],
  sauces: ['sauce', 'dressing', 'vinaigrette', 'salsa', 'marinade'],
};

const familyForIngredient = (ingredient: string) => Object.entries(INGREDIENT_FAMILIES).find(([, words]) => words.some((w) => ingredient.includes(w)))?.[0];

export const calculateIngredientRelationshipStrength = (a: RelationshipNode, b: RelationshipNode) => {
  const aSet = new Set(a.normalizedIngredients);
  const shared = b.normalizedIngredients.filter((name) => aSet.has(name));
  const familyOverlap = b.normalizedIngredients.filter((name) => {
    const family = familyForIngredient(name);
    return family && a.normalizedIngredients.some((candidate) => familyForIngredient(candidate) === family);
  });
  const sharedRatio = shared.length / Math.max(1, Math.min(a.normalizedIngredients.length, b.normalizedIngredients.length));
  return Math.max(0, Math.min(1, sharedRatio * 0.8 + (familyOverlap.length > 0 ? 0.2 : 0)));
};

export const buildIngredientRelationshipGraph = (nodes: RelationshipNode[]): RelationshipEdge[] => {
  const edges: RelationshipEdge[] = [];
  for (let i = 0; i < nodes.length; i += 1) {
    for (let j = i + 1; j < nodes.length; j += 1) {
      const weight = calculateIngredientRelationshipStrength(nodes[i], nodes[j]);
      if (weight < 0.25) continue;
      edges.push({ sourceId: nodes[i].id, targetId: nodes[j].id, type: 'ingredient', weight, reasons: ['shared ingredients / ingredient-family overlap'] });
    }
  }
  return edges;
};

export const detectReusableIngredientClusters = (nodes: RelationshipNode[]): IngredientCluster[] => {
  const mealIdsByIngredient = new Map<string, string[]>();
  nodes.forEach((node) => {
    node.normalizedIngredients.forEach((raw) => {
      const ingredient = normalizeMealIngredient(raw);
      if (!ingredient) return;
      mealIdsByIngredient.set(ingredient, [...(mealIdsByIngredient.get(ingredient) || []), node.id]);
    });
  });

  return Array.from(mealIdsByIngredient.entries())
    .filter(([, mealIds]) => new Set(mealIds).size >= 2)
    .map(([ingredient, mealIds]) => ({
      id: `ingredient-${ingredient.replace(/[^a-z0-9]+/g, '-')}`,
      ingredient,
      mealIds: Array.from(new Set(mealIds)),
      strength: Math.min(1, mealIds.length / Math.max(2, nodes.length * 0.45)),
    }))
    .sort((a, b) => b.mealIds.length - a.mealIds.length)
    .slice(0, 24);
};
