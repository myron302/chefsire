import { buildMealRelationshipGraph } from './relationshipGraph';
import { buildSeedMealChains } from './mealChainGeneration';
import { deriveReusablePrepArtifacts, calculateArtifactCoverageScore } from './prepArtifactPlanning';
import { generateLeftoverCascadeCandidates } from './leftoverCascadePlanning';
import { flattenPlannerMeals } from '../planner-graph/plannerIteration';
import { extractMealIngredients } from '../planner-graph/plannerMealExtraction';
import { MEAL_TYPES, WEEK_DAYS } from '../nutritionMealPlannerUtils';

const getPlannerMeals = (weeklyMeals: Record<string, any>, weekDays: readonly string[], mealTypes: readonly string[]) => (
  flattenPlannerMeals(weeklyMeals, weekDays, mealTypes).map((ref) => ref.meal).filter(Boolean)
);

export const calculateCandidateContinuityGain = (candidate: any, weeklyMeals: Record<string, any>) => {
  const graph = buildMealRelationshipGraph(weeklyMeals);
  const candidateIngredients = new Set(extractMealIngredients(candidate).map((i: any) => String(i?.name || '').toLowerCase().trim()));
  const continuityMatches = graph.nodes.reduce((sum, node) => sum + node.normalizedIngredients.filter((i) => candidateIngredients.has(i)).length, 0);
  return Math.round(Math.min(100, continuityMatches * 4));
};

export const calculateCandidatePrepReuseGain = (candidate: any, weeklyMeals: Record<string, any>) => {
  const artifacts = deriveReusablePrepArtifacts(weeklyMeals);
  const ingredients = new Set(extractMealIngredients(candidate).map((i: any) => String(i?.name || '').toLowerCase().trim()));
  const reusable = artifacts.filter((artifact) => ingredients.has(artifact.ingredient)).length;
  return Math.round(Math.min(100, reusable * 20));
};

export const calculateCandidateLeftoverChainGain = (candidate: any, weeklyMeals: Record<string, any>) => {
  const cascades = generateLeftoverCascadeCandidates(weeklyMeals);
  const name = String(candidate?.name || '').toLowerCase();
  const matches = cascades.filter((cascade) => cascade.mealNames.some((mealName) => mealName.toLowerCase() === name)).length;
  return Math.round(Math.min(100, matches * 30 + (Number(candidate?.leftoverFriendly) ? 25 : 0)));
};

export const rankCandidatesByRelationshipValue = (candidates: any[], weeklyMeals: Record<string, any>) => {
  return [...candidates].map((candidate) => {
    const continuity = calculateCandidateContinuityGain(candidate, weeklyMeals);
    const prepReuse = calculateCandidatePrepReuseGain(candidate, weeklyMeals);
    const leftover = calculateCandidateLeftoverChainGain(candidate, weeklyMeals);
    const relationshipValue = Math.round((continuity * 0.45) + (prepReuse * 0.3) + (leftover * 0.25));
    return { ...candidate, relationshipValue, relationshipDrivenReason: `Continuity +${continuity}, prep reuse +${prepReuse}, leftover chain +${leftover}.` };
  }).sort((a, b) => b.relationshipValue - a.relationshipValue);
};

export const generateRelationshipDrivenCandidates = (pool: any[], weeklyMeals: Record<string, any>) => {
  return rankCandidatesByRelationshipValue(pool, weeklyMeals).slice(0, Math.max(8, Math.min(30, pool.length)));
};

export const scoreRelationshipDrivenWeek = (weeklyMeals: Record<string, any>, weekDays: readonly string[], mealTypes: readonly string[]) => {
  const graph = buildMealRelationshipGraph(weeklyMeals);
  const chains = buildSeedMealChains(weeklyMeals);
  const artifacts = deriveReusablePrepArtifacts(weeklyMeals);
  const cascades = generateLeftoverCascadeCandidates(weeklyMeals);
  const meals = getPlannerMeals(weeklyMeals, weekDays, mealTypes);
  const artifactCoverage = calculateArtifactCoverageScore(artifacts, meals.length);
  const chainValue = Math.round(chains.slice(0, 4).reduce((sum, chain) => sum + chain.score, 0) / Math.max(1, Math.min(4, chains.length)));
  const leftoverValue = Math.round(cascades.slice(0, 4).reduce((sum, cascade) => sum + cascade.score, 0) / Math.max(1, Math.min(4, cascades.length)));
  const score = Math.round((graph.continuityScore * 0.35) + (artifactCoverage * 0.25) + (chainValue * 0.2) + (leftoverValue * 0.2));
  return { score, chainValue, artifactCoverage, leftoverValue, continuityScore: graph.continuityScore, chains, artifacts, cascades };
};

export const scoreCanonicalRelationshipDrivenWeek = (weeklyMeals: Record<string, any>) => scoreRelationshipDrivenWeek(weeklyMeals, WEEK_DAYS, MEAL_TYPES);

export const deriveRelationshipDrivenRecommendations = (weeklyMeals: Record<string, any>, weekDays: readonly string[], mealTypes: readonly string[]) => {
  const summary = scoreRelationshipDrivenWeek(weeklyMeals, weekDays, mealTypes);
  const chain = summary.chains[0];
  const artifact = summary.artifacts[0];
  const cascade = summary.cascades[0];
  const messages: string[] = [];
  if (chain) messages.push(`${chain.mealNames[0]} now supports ${chain.mealIds.length} linked meals across ${chain.days[0]}–${chain.days[chain.days.length - 1]}.`);
  if (artifact) messages.push(`${artifact.label} is reused across ${artifact.supportedMealIds.length} meals to reduce prep duplication.`);
  if (cascade) messages.push(`A leftover-friendly chain was created from ${cascade.daySpan} across ${cascade.mealNames.length} connected meals.`);
  messages.push(`Continuity score is ${summary.continuityScore} with artifact coverage at ${summary.artifactCoverage}%.`);
  return { ...summary, messages };
};

export const evolveWeeklyPlanWithRelationships = (weeklyMeals: Record<string, any>, weekDays: readonly string[], mealTypes: readonly string[], candidatePool: any[]) => {
  const scored = deriveRelationshipDrivenRecommendations(weeklyMeals, weekDays, mealTypes);
  const prioritizedPool = generateRelationshipDrivenCandidates(candidatePool, weeklyMeals);
  return { prioritizedPool, relationshipSummary: scored };
};
