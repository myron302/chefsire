import { extractMealIngredients, extractMealPrepMetadata } from './plannerMealExtraction';

export const calculateMealComplexity = (meal: any): number => {
  const ingredients = extractMealIngredients(meal).length;
  const { prepMinutes, cookMinutes, difficulty } = extractMealPrepMetadata(meal);
  const difficultyScore = difficulty === 'hard' ? 3 : difficulty === 'medium' ? 2 : difficulty ? 1 : 0;
  return ingredients + Math.round((prepMinutes + cookMinutes) / 15) + difficultyScore;
};

export const calculatePrepComplexity = (meals: any[]): number => meals.reduce((sum, meal) => sum + calculateMealComplexity(meal), 0);

export const calculateIngredientOverlap = (meals: any[]): number => {
  const names = meals.flatMap((meal) => extractMealIngredients(meal).map((item: any) => String(item.name || '').toLowerCase().trim()).filter(Boolean));
  if (!names.length) return 0;
  const unique = new Set(names);
  return 1 - (unique.size / names.length);
};

export const calculateMealDiversity = (meals: any[]): number => {
  if (!meals.length) return 0;
  const unique = new Set(meals.map((meal: any) => String(meal?.name || meal?.title || '').trim().toLowerCase()).filter(Boolean));
  return unique.size / meals.length;
};
