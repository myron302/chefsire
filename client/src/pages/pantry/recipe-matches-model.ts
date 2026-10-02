/**
 * Boundary between `GET /api/pantry/users/me/pantry/recipe-suggestions` and the "What Can I Cook?" page.
 *
 * The endpoint (`storage.getRecipesFromPantryItems`) returns each suggestion as the `recipes` row plus scoring:
 *   { id, title, imageUrl, ingredients: string[], cookTime, difficulty, ...,
 *     matchScore /* 0-100 *\/, ingredientMatches /* count *\/, totalIngredients, missingIngredients: string[], missingCount }
 * The page used to read `name`, a 0-1 score and a `matchingIngredients` array, none of which the endpoint sends.
 * Everything the page renders is derived here, once, from what the endpoint really returns.
 */

export type RecipeMatch = {
  id: string;
  title: string;
  imageUrl?: string;
  /** Whole-number percentage, 0-100 (the endpoint's own scale; never rescaled or multiplied again). */
  matchPercent: number;
  /** How many of the recipe's ingredients the pantry covers (the endpoint's `ingredientMatches`). */
  matchingCount: number;
  totalIngredients: number;
  /** Real ingredient names from the recipe that the pantry does not cover. */
  missingIngredients: string[];
  /** Real ingredient names from the recipe that the pantry covers (recipe ingredients minus the missing ones). */
  matchingIngredients: string[];
  cookTime?: number;
  difficulty?: string;
};

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null;
const strings = (value: unknown): string[] => (Array.isArray(value) ? value.filter((v): v is string => typeof v === "string") : []);
const count = (value: unknown, fallback: number): number =>
  typeof value === "number" && Number.isFinite(value) && value >= 0 ? Math.floor(value) : fallback;

export function normalizeRecipeSuggestions(payload: unknown): RecipeMatch[] {
  const list = isRecord(payload) && Array.isArray(payload.suggestions) ? payload.suggestions : [];
  const out: RecipeMatch[] = [];
  for (const raw of list) {
    if (!isRecord(raw) || typeof raw.id !== "string" || !raw.id) continue;
    const ingredients = strings(raw.ingredients);
    const missingIngredients = strings(raw.missingIngredients);
    // Names we can prove from the response: the recipe's own ingredients that are not in the missing list.
    const missing = new Set(missingIngredients);
    const matchingIngredients = ingredients.filter((ing) => !missing.has(ing));
    const totalIngredients = count(raw.totalIngredients, ingredients.length);
    const matchingCount = Math.min(count(raw.ingredientMatches, matchingIngredients.length), totalIngredients);
    const score = typeof raw.matchScore === "number" && Number.isFinite(raw.matchScore) ? raw.matchScore : 0;
    out.push({
      id: raw.id,
      title: typeof raw.title === "string" ? raw.title : "",
      imageUrl: typeof raw.imageUrl === "string" && raw.imageUrl ? raw.imageUrl : undefined,
      matchPercent: Math.max(0, Math.min(100, Math.round(score))),
      matchingCount,
      totalIngredients,
      missingIngredients,
      matchingIngredients,
      cookTime: typeof raw.cookTime === "number" && raw.cookTime > 0 ? raw.cookTime : undefined,
      difficulty: typeof raw.difficulty === "string" && raw.difficulty ? raw.difficulty : undefined,
    });
  }
  return out;
}

/** The page's filter select holds a fraction of a whole ("0.5" = 50%+); the scores are percentages. */
export function meetsMinimumMatch(match: RecipeMatch, minimumFraction: string): boolean {
  const minimum = Number.parseFloat(minimumFraction);
  return Number.isFinite(minimum) ? match.matchPercent >= minimum * 100 : true;
}

export function matchColor(percent: number): string {
  if (percent >= 90) return "bg-green-100 text-green-800 border-green-200";
  if (percent >= 70) return "bg-blue-100 text-blue-800 border-blue-200";
  if (percent >= 50) return "bg-yellow-100 text-yellow-800 border-yellow-200";
  return "bg-gray-100 text-gray-800 border-gray-200";
}

export function matchLabel(percent: number): string {
  if (percent >= 90) return "Excellent Match";
  if (percent >= 70) return "Good Match";
  if (percent >= 50) return "Partial Match";
  return "Low Match";
}
