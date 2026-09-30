import { z } from "zod";

// The client selects only the desired presentation tier. Payment-related fields
// are deliberately rejected: they are not authoritative billing evidence.
export const nutritionSubscriptionChangeSchema = z.object({
  tier: z.enum(["free", "premium"]),
});

const nonNegativeNutritionAmount = z.number().finite().nonnegative();

export const nutritionGoalsUpdateSchema = z.object({
  dailyCalorieGoal: z.number().int().nonnegative().optional(),
  macroGoals: z.object({
    protein: nonNegativeNutritionAmount,
    carbs: nonNegativeNutritionAmount,
    fat: nonNegativeNutritionAmount,
  }).strict().optional(),
  dietaryRestrictions: z.array(z.string()).optional(),
}).strict().refine((goals) => Object.keys(goals).length > 0, {
  message: "At least one nutrition goal is required",
});

export const nutritionLogCreateSchema = z.object({
  date: z.coerce.date(),
  mealType: z.string().trim().min(1),
  recipeId: z.string().trim().min(1).optional(),
  customFoodName: z.string().trim().min(1).optional(),
  servings: z.number().finite().positive(),
  calories: z.number().int().nonnegative(),
  protein: nonNegativeNutritionAmount.optional(),
  carbs: nonNegativeNutritionAmount.optional(),
  fat: nonNegativeNutritionAmount.optional(),
  fiber: nonNegativeNutritionAmount.optional(),
  imageUrl: z.string().optional(),
}).strict();
