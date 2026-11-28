/**
 * The request bodies the four drink save actions send to `POST /api/drinks/custom-drinks`.
 *
 * These were four inline object literals inside two page components. Codex's P2 on #1514 was that the
 * regression test for them validated a hard-coded fixture of its own rather than anything the builders
 * produce -- so a builder reverting to numeric decimals, dropping `fiber`/`fat`, or sending a fractional
 * rating would leave the test green and the save broken. That is the shape of a test that passes while
 * asserting nothing, and it was guarding the exact defect this PR exists to fix.
 *
 * So the payloads live here, the pages call these functions, and the test calls the same ones. There is now
 * one definition of each payload instead of two, and a regression in it has nowhere to hide.
 *
 * The contract they have to satisfy is `insertCustomDrinkSchema` over the `custom_drinks` table:
 *   - `calories`, `prepTime`, `rating` are integer columns -- numbers, and `rating` must not be fractional
 *   - `protein`, `carbs`, `fiber`, `fat` are NOT NULL `decimal` columns, which Drizzle takes as STRINGS, so a
 *     number is a 400 and an omission is a 400 rather than a default
 */

/** An ingredient as the builders accumulate it. The column is jsonb, so the schema does not police this. */
export type DrinkIngredient = Record<string, unknown>;

export interface DrinkGoal {
  id: string;
  name: string;
}

export interface SmoothieDraft {
  ingredients: DrinkIngredient[];
  calories: number;
  protein: number;
  carbs: number;
  fiber: number;
}

export interface CaffeinatedDraft {
  ingredients: DrinkIngredient[];
  calories: number;
  caffeine: number;
  carbs: number;
  sugar: number;
}

/** One decimal place, as a string, because the column is `decimal` and Drizzle wants a string. */
const decimal1 = (value: number): string => (Math.round(value * 10) / 10).toString();

export function smoothieBuilderPayload(goal: DrinkGoal, draft: SmoothieDraft) {
  return {
    name: `Custom ${goal.name} Smoothie`,
    category: "smoothies",
    drinkType: goal.id,
    ingredients: draft.ingredients,
    calories: Math.round(draft.calories),
    protein: decimal1(draft.protein),
    carbs: decimal1(draft.carbs),
    fiber: decimal1(draft.fiber),
    fat: "2",
    fitnessGoal: goal.name,
    difficulty: "Custom",
    prepTime: 5,
    rating: 5,
    isPublic: false,
  };
}

export function smoothiePremadePayload(recipe: any) {
  return {
    name: recipe.name,
    category: "smoothies",
    drinkType: recipe.workoutType,
    ingredients: (recipe.ingredients as string[]).map((name) => ({
      name,
      category: "ingredient",
      calories: 0,
      protein: 0,
      carbs: 0,
      fiber: 0,
      icon: "🥤",
    })),
    calories: recipe.calories,
    protein: String(recipe.protein),
    carbs: Math.round((recipe.calories * 0.6) / 4).toString(),
    fiber: "2",
    fat: "3",
    fitnessGoal: recipe.workoutType,
    difficulty: recipe.difficulty,
    prepTime: parseInt(recipe.time),
    // The star ratings on the premade cards are fractional (4.8); the column is an integer.
    rating: Math.round(recipe.rating),
    isPublic: false,
  };
}

export function caffeinatedBuilderPayload(goal: DrinkGoal, draft: CaffeinatedDraft) {
  return {
    name: `Custom ${goal.name} Drink`,
    category: "caffeinated",
    drinkType: goal.id,
    ingredients: draft.ingredients,
    calories: Math.round(draft.calories),
    caffeine: Math.round(draft.caffeine),
    carbs: decimal1(draft.carbs),
    // a number, unlike the decimals: `sugar` has no column at all (see KEYS_WITH_NO_COLUMN)
    sugar: Math.round(draft.sugar * 10) / 10,
    protein: "2",
    fiber: "0",
    fat: "0",
    fitnessGoal: goal.name,
    difficulty: "Custom",
    prepTime: 4,
    rating: 5,
    isPublic: false,
  };
}

export function caffeinatedPremadePayload(recipe: any) {
  return {
    name: recipe.name,
    category: "caffeinated",
    drinkType: recipe.goalType,
    ingredients: (recipe.ingredients as string[]).map((name) => ({
      name,
      category: "ingredient",
      calories: 0,
      caffeine: 0,
      carbs: 0,
      sugar: 0,
      icon: "☕",
    })),
    calories: recipe.calories,
    caffeine: recipe.caffeine,
    carbs: Math.round((recipe.calories * 0.5) / 4).toString(),
    sugar: 10,
    protein: "2",
    fiber: "0",
    fat: "0",
    fitnessGoal: recipe.goalType,
    difficulty: recipe.difficulty,
    prepTime: parseInt(recipe.time),
    rating: Math.round(recipe.rating),
    isPublic: false,
  };
}

/**
 * `custom_drinks` has no `caffeine` and no `sugar` column, and `insertCustomDrinkSchema` is a non-strict Zod
 * object, so the route's `.parse()` STRIPS them without complaint and the save succeeds having thrown them
 * away. Found while answering the finding above: the caffeine figure a caffeinated drink is built around does
 * not persist at all.
 *
 * Not fixed here, because a column is a migration and this PR is about a URL prefix and a payload contract.
 * It is listed so the test can assert that this is the WHOLE list -- a fifth phantom field added later fails
 * rather than disappearing quietly the same way.
 */
export const KEYS_WITH_NO_COLUMN = ["caffeine", "sugar"] as const;
