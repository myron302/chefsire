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

// Dates must be explicit strings (YYYY-MM-DD or ISO-8601 date-time). Unlike
// z.coerce.date(), null/""/0 are rejected instead of becoming 1970-01-01.
const nutritionLogDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}([T ]\d{2}:\d{2}(:\d{2}(\.\d+)?)?(Z|[+-]\d{2}:?\d{2})?)?$/, "Invalid date")
  .transform((value, ctx) => {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Invalid date" });
      return z.NEVER;
    }
    return date;
  });

export const nutritionLogCreateSchema = z.object({
  date: nutritionLogDate,
  mealType: z.string().trim().min(1),
  recipeId: z.string().trim().min(1).optional(),
  customFoodName: z.string().trim().min(1).optional(),
  servings: z.number().finite().positive(),
  calories: z.number().int().nonnegative(),
  protein: nonNegativeNutritionAmount.optional(),
  carbs: nonNegativeNutritionAmount.optional(),
  fat: nonNegativeNutritionAmount.optional(),
  fiber: nonNegativeNutritionAmount.optional(),
  sodium: nonNegativeNutritionAmount.optional(),
  sugar: nonNegativeNutritionAmount.optional(),
  imageUrl: z.string().optional(),
}).strict();
