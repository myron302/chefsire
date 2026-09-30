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

// Dates must be explicit strings. z.coerce.date() would turn null into the epoch,
// and Date parsing silently normalizes impossible calendar dates (2026-02-30 ->
// 2026-03-02), so components are validated explicitly:
//   - YYYY-MM-DD        -> UTC midnight of that exact, real calendar date
//   - date-time         -> requires an explicit Z or numeric UTC offset, so the
//                          stored instant never depends on the server timezone
const DATE_ONLY = /^(\d{4})-(\d{2})-(\d{2})$/;
const DATE_TIME = /^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})(?::(\d{2})(?:\.\d+)?)?(Z|[+-]\d{2}:\d{2})$/;

function isRealCalendarDate(year: number, month: number, day: number): boolean {
  const utc = new Date(Date.UTC(year, month - 1, day));
  utc.setUTCFullYear(year); // Date.UTC maps years 0-99 to 1900-1999
  return utc.getUTCFullYear() === year && utc.getUTCMonth() === month - 1 && utc.getUTCDate() === day;
}

export function parseNutritionLogDate(value: string): Date | null {
  const dateOnly = DATE_ONLY.exec(value);
  if (dateOnly) {
    const [year, month, day] = [Number(dateOnly[1]), Number(dateOnly[2]), Number(dateOnly[3])];
    if (!isRealCalendarDate(year, month, day)) return null;
    const date = new Date(Date.UTC(year, month - 1, day));
    date.setUTCFullYear(year);
    return date;
  }
  const dateTime = DATE_TIME.exec(value);
  if (!dateTime) return null;
  const [year, month, day, hour, minute] = dateTime.slice(1, 6).map(Number);
  const second = dateTime[6] === undefined ? 0 : Number(dateTime[6]);
  if (!isRealCalendarDate(year, month, day) || hour > 23 || minute > 59 || second > 59) return null;
  const offset = dateTime[7];
  if (offset !== "Z") {
    const [offsetHour, offsetMinute] = offset.slice(1).split(":").map(Number);
    if (offsetHour > 23 || offsetMinute > 59) return null;
  }
  const parsed = new Date(value.replace(" ", "T"));
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

const nutritionLogDate = z.string().transform((value, ctx) => {
  const date = parseNutritionLogDate(value);
  if (!date) {
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
