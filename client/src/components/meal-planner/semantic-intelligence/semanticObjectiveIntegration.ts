import { deriveMealSemanticProfile } from './semanticMealIdentity';
import { calculateRecoveryMealAffinity, detectComfortAnchors } from './emotionalMealSemantics';
import { calculateSemanticVarietyScore, detectSemanticFatigue, deriveSemanticMealBalance } from './semanticVariety';
import { deriveSeasonalMealAffinity } from './seasonalSemantics';
import type { SemanticIntelligenceSnapshot } from './semanticTypes';

export const deriveSemanticIntelligenceSnapshot = (plan: Record<string, any>, weekDays: readonly string[], mealTypes: readonly string[]): SemanticIntelligenceSnapshot => {
  const meals = weekDays.flatMap((day) => mealTypes.flatMap((mealType) => (plan?.[day]?.[mealType] || []).slice(0, 1))).filter(Boolean);
  const mealProfiles = Object.fromEntries(meals.map((meal, idx) => [String(meal?.id || meal?.title || meal?.name || idx), deriveMealSemanticProfile(meal)]));
  const comfortAnchors = detectComfortAnchors(meals);
  const seasonalSummerAvg = meals.length
    ? meals.reduce((sum, meal) => sum + deriveSeasonalMealAffinity(meal).summer, 0) / meals.length
    : 0;
  const semanticVarietyScore = calculateSemanticVarietyScore(meals);
  const fatigue = detectSemanticFatigue(meals);
  const balance = deriveSemanticMealBalance(meals);
  const recoveryAffinity = calculateRecoveryMealAffinity(meals);

  const semanticRecommendations: string[] = [
    ...balance,
    ...fatigue,
  ];

  if (comfortAnchors.length) semanticRecommendations.push('Comfort-oriented meals improved late-week adherence resilience.');
  if (recoveryAffinity >= 0.35) semanticRecommendations.push('Recovery-style meals support sustainability after high-effort sequences.');
  if (seasonalSummerAvg >= 0.55) semanticRecommendations.push('Fresh/light meal bias aligns with warmer-season energy needs.');

  return {
    mealProfiles,
    comfortAnchorStrength: Number((comfortAnchors.reduce((sum, a) => sum + a.strength, 0) / Math.max(1, comfortAnchors.length)).toFixed(2)),
    recoveryMealAffinity: recoveryAffinity,
    seasonalBalanceScore: Number((seasonalSummerAvg * 100).toFixed(0)),
    semanticVarietyScore,
    semanticRecommendations,
  };
};
