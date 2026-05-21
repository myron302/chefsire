import { normalizePlannerSlot } from './plannerNormalization';

export const extractMealIngredients = (meal: any): any[] => normalizePlannerSlot(meal?.mealItems).filter((item: any) => item && String(item.name || '').trim());
export const extractMealProteins = (meal: any): number => Number(meal?.protein) || extractMealIngredients(meal).reduce((sum, item: any) => sum + (Number(item?.protein) || 0), 0);
export const extractMealTags = (meal: any): string[] => normalizePlannerSlot<string>(meal?.tags).map((t: any) => String(t).trim()).filter(Boolean);
export const extractMealNutrition = (meal: any) => ({
  calories: Number(meal?.calories) || 0,
  protein: Number(meal?.protein) || 0,
  carbs: Number(meal?.carbs) || 0,
  fat: Number(meal?.fat) || 0,
});
export const extractMealPrepMetadata = (meal: any) => ({
  prepMinutes: Number(meal?.prepMinutes || meal?.prepTimeMinutes || meal?.prepTime) || 0,
  cookMinutes: Number(meal?.cookMinutes || meal?.cookTimeMinutes || meal?.cookTime) || 0,
  difficulty: String(meal?.difficulty || '').toLowerCase(),
});
