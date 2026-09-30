/**
 * Owner-editable contract for custom drinks (`PATCH /api/drinks/custom-drinks/:id`).
 *
 * The endpoint used to forward `req.body` into `storage.updateCustomDrink`, which spread it into
 * drizzle's `.set(...)`; the body WAS the UPDATE, so an owner could write `userId`, `id`, the
 * engagement counters (`likesCount`, `savesCount`, `sharesCount`) and the timestamps.
 *
 * custom_drinks columns, classified:
 *   owner-editable content  name, category, drinkType, ingredients, calories, protein, carbs, fiber,
 *                           fat, description, imageUrl, fitnessGoal, difficulty, prepTime, rating,
 *                           isPublic   (all of these are client-supplied at creation too)
 *   identity / ownership    id, userId
 *   engagement counters     likesCount, savesCount, sharesCount (moved only by like/save storage ops)
 *   timestamps              createdAt, updatedAt (updatedAt is stamped by storage)
 *
 * The schema is `.strict()`: any key outside the allowlist rejects the whole request (400) instead of
 * being stripped, and `toCustomDrinkOwnerPatch` names every column it writes.
 */
import { z } from "zod";

export const CUSTOM_DRINK_OWNER_EDITABLE_FIELDS = [
  "name",
  "category",
  "drinkType",
  "ingredients",
  "calories",
  "protein",
  "carbs",
  "fiber",
  "fat",
  "description",
  "imageUrl",
  "fitnessGoal",
  "difficulty",
  "prepTime",
  "rating",
  "isPublic",
] as const;

export const CUSTOM_DRINK_PROTECTED_FIELDS = [
  "id",
  "userId",
  "likesCount",
  "savesCount",
  "sharesCount",
  "createdAt",
  "updatedAt",
] as const;

const ingredientSchema = z
  .object({
    name: z.string(),
    category: z.string(),
    calories: z.number().finite(),
    protein: z.number().finite(),
    carbs: z.number().finite(),
    fiber: z.number().finite(),
    icon: z.string(),
  })
  .strict();

// numeric(5,2) columns; accepted as number or decimal string, stored as a string like drizzle expects.
const decimal = z
  .union([z.number().finite(), z.string().regex(/^-?\d+(\.\d+)?$/)])
  .transform((v) => String(v));

const int = z.number().int().min(-2147483648).max(2147483647);

export const customDrinkOwnerPatchSchema = z
  .object({
    name: z.string().min(1),
    category: z.string().min(1),
    drinkType: z.string().nullable(),
    ingredients: z.array(ingredientSchema),
    calories: int,
    protein: decimal,
    carbs: decimal,
    fiber: decimal,
    fat: decimal,
    description: z.string().nullable(),
    imageUrl: z.string().nullable(),
    fitnessGoal: z.string().nullable(),
    difficulty: z.string().nullable(),
    prepTime: int.nullable(),
    rating: int.nullable(),
    isPublic: z.boolean().nullable(),
  })
  .partial()
  .strict()
  .refine((v) => Object.values(v).some((x) => x !== undefined), {
    message: "Provide at least one field to update",
  });

export type CustomDrinkOwnerPatch = Partial<{
  name: string;
  category: string;
  drinkType: string | null;
  ingredients: z.infer<typeof ingredientSchema>[];
  calories: number;
  protein: string;
  carbs: string;
  fiber: string;
  fat: string;
  description: string | null;
  imageUrl: string | null;
  fitnessGoal: string | null;
  difficulty: string | null;
  prepTime: number | null;
  rating: number | null;
  isPublic: boolean | null;
}>;

/** Builds the DB patch column-by-column from a parsed value; never a spread of client input. */
export function toCustomDrinkOwnerPatch(p: z.infer<typeof customDrinkOwnerPatchSchema>): CustomDrinkOwnerPatch {
  return {
    name: p.name,
    category: p.category,
    drinkType: p.drinkType,
    ingredients: p.ingredients,
    calories: p.calories,
    protein: p.protein,
    carbs: p.carbs,
    fiber: p.fiber,
    fat: p.fat,
    description: p.description,
    imageUrl: p.imageUrl,
    fitnessGoal: p.fitnessGoal,
    difficulty: p.difficulty,
    prepTime: p.prepTime,
    rating: p.rating,
    isPublic: p.isPublic,
  };
}
