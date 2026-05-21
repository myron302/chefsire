import type { PlannerMealRef } from '../planner-graph/plannerTypes';

export type RelationshipNode = PlannerMealRef & { id: string; mealName: string; normalizedIngredients: string[]; dayIndex: number };
export type RelationshipEdgeType = 'ingredient' | 'prep' | 'leftover' | 'chain';
export type RelationshipEdge = { sourceId: string; targetId: string; type: RelationshipEdgeType; weight: number; reasons: string[] };

export type IngredientCluster = { id: string; ingredient: string; mealIds: string[]; strength: number };
export type PrepOpportunity = { id: string; artifact: string; mealIds: string[]; efficiency: number; notes: string[] };
export type LeftoverChain = { id: string; mealIds: string[]; spanDays: number; safetyScore: number; ingredient: string };

export type MealRelationshipGraph = {
  nodes: RelationshipNode[];
  edges: RelationshipEdge[];
  ingredientClusters: IngredientCluster[];
  prepOpportunities: PrepOpportunity[];
  leftoverChains: LeftoverChain[];
  continuityScore: number;
  relationshipEfficiency: number;
  insights: string[];
};
