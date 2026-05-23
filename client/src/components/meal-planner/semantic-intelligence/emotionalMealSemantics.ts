import { deriveMealSemanticProfile } from './semanticMealIdentity';
import type { EmotionalMealSemantics } from './semanticTypes';

export const deriveEmotionalMealSemantics = (meal: any): EmotionalMealSemantics => {
  const profile = deriveMealSemanticProfile(meal);
  const has = (tag: string) => profile.tags.includes(tag as any);
  const adherenceSafetyScore = Math.round((
    (has('routine-friendly') ? 0.3 : 0) +
    (has('low-effort') ? 0.25 : 0) +
    (has('recovery-friendly') ? 0.2 : 0) +
    (has('comfort') ? 0.15 : 0) +
    (has('social') ? 0.1 : 0)
  ) * 100);

  return {
    isComfortFallback: has('comfort') || has('cozy'),
    isSocialMeal: has('social'),
    isRecoveryMeal: has('restorative') || has('recovery-friendly'),
    isStressFriendly: has('stress-friendly') || has('comfort') || has('low-effort'),
    isLowFriction: has('low-effort') || has('batch-friendly') || has('modular'),
    adherenceSafetyScore,
  };
};

export const detectComfortAnchors = (meals: any[]): { mealId: string; strength: number }[] => {
  return meals.map((meal) => {
    const profile = deriveMealSemanticProfile(meal);
    const strength = Number((((profile.semanticWeights.comfort || 0) + (profile.semanticWeights.cozy || 0) + (profile.semanticWeights['recovery-friendly'] || 0)) / 3).toFixed(2));
    return { mealId: String(meal?.id || meal?.title || meal?.name || 'meal'), strength };
  }).filter((anchor) => anchor.strength >= 0.45);
};

export const calculateRecoveryMealAffinity = (meals: any[]): number => {
  if (!meals.length) return 0;
  const recoveryCount = meals.filter((meal) => {
    const semantics = deriveEmotionalMealSemantics(meal);
    return semantics.isRecoveryMeal || semantics.isLowFriction;
  }).length;
  return Number((recoveryCount / meals.length).toFixed(2));
};
