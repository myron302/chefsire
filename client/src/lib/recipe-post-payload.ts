/**
 * The `recipe` object POST /api/posts expects when `isRecipe` is true (server/routes/posts.ts recipeSchema):
 * title (required), ingredients and instructions (each at least one non-empty string), optional integer cookTime
 * (>= 0) and servings (>= 1), optional difficulty and imageUrl. Blank optional fields are omitted, not sent as null:
 * the schema's optional() accepts a missing key but rejects null.
 */
export type RecipePostInput = {
  title: string;
  ingredients: string[];
  instructions: string[];
  cookTime?: string | number | null;
  servings?: string | number | null;
  difficulty?: string | null;
  imageUrl?: string | null;
};

export type RecipePostPayload = {
  title: string;
  ingredients: string[];
  instructions: string[];
  cookTime?: number;
  servings?: number;
  difficulty?: string;
  imageUrl?: string;
};

const wholeNumber = (value: string | number | null | undefined, min: number): number | undefined => {
  if (value === null || value === undefined || String(value).trim() === "") return undefined;
  const n = Number(value);
  return Number.isInteger(n) && n >= min ? n : undefined;
};

export function buildRecipePostPayload(input: RecipePostInput): RecipePostPayload {
  const payload: RecipePostPayload = {
    title: input.title.trim(),
    ingredients: input.ingredients.map((s) => s.trim()).filter(Boolean),
    instructions: input.instructions.map((s) => s.trim()).filter(Boolean),
  };
  const cookTime = wholeNumber(input.cookTime, 0);
  const servings = wholeNumber(input.servings, 1);
  if (cookTime !== undefined) payload.cookTime = cookTime;
  if (servings !== undefined) payload.servings = servings;
  if (input.difficulty?.trim()) payload.difficulty = input.difficulty.trim();
  if (input.imageUrl?.trim()) payload.imageUrl = input.imageUrl.trim();
  return payload;
}
