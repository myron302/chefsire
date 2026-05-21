import { buildMealRelationshipGraph } from './relationshipGraph';

export type PrepArtifact = {
  id: string;
  label: string;
  ingredient: string;
  supportedMealIds: string[];
  coverageScore: number;
};

export const deriveReusablePrepArtifacts = (weeklyMeals: Record<string, any>): PrepArtifact[] => {
  const graph = buildMealRelationshipGraph(weeklyMeals);
  return graph.ingredientClusters.map((cluster, index) => ({
    id: `artifact-${index}`,
    label: `Batch prep ${cluster.ingredient}`,
    ingredient: cluster.ingredient,
    supportedMealIds: cluster.mealIds,
    coverageScore: Math.round((cluster.mealIds.length / Math.max(1, graph.nodes.length)) * 100),
  })).filter((artifact) => artifact.supportedMealIds.length >= 2).sort((a, b) => b.coverageScore - a.coverageScore);
};

export const calculateArtifactCoverageScore = (artifacts: PrepArtifact[], totalMeals: number) => {
  const coveredMeals = new Set(artifacts.flatMap((artifact) => artifact.supportedMealIds));
  return Math.round((coveredMeals.size / Math.max(1, totalMeals)) * 100);
};

export const planMealsAroundPrepArtifacts = (weeklyMeals: Record<string, any>) => {
  const graph = buildMealRelationshipGraph(weeklyMeals);
  const artifacts = deriveReusablePrepArtifacts(weeklyMeals);
  return artifacts.slice(0, 6).map((artifact) => ({
    ...artifact,
    mealNames: graph.nodes.filter((node) => artifact.supportedMealIds.includes(node.id)).map((node) => node.mealName),
  }));
};
