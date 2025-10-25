// client/src/utils/recipe-helpers.ts

/**
 * Shared recipe and drink utility functions
 * Extracted from large drink component files to reduce duplication
 */

export interface Measured {
  amount: number | string;
  unit: string;
  item: string;
  note?: string;
}

/**
 * Create a measured ingredient
 * @param amount - Amount of ingredient
 * @param unit - Unit of measurement (cup, tbsp, etc.)
 * @param item - Ingredient name
 * @param note - Optional note about the ingredient
 */
export const createMeasuredIngredient = (
  amount: number | string,
  unit: string,
  item: string,
  note: string = ""
): Measured => ({ amount, unit, item, note });

/**
 * Clamp a number between min and max values
 * @param n - Number to clamp
 * @param min - Minimum value (default: 1)
 * @param max - Maximum value (default: 6)
 */
export const clamp = (n: number, min = 1, max = 6): number =>
  Math.max(min, Math.min(max, n));

/**
 * Convert a decimal number to a nice fraction string
 * Examples: 0.5 -> "1/2", 1.25 -> "1 1/4", 2 -> "2"
 * @param value - Decimal number to convert
 */
export const toNiceFraction = (value: number): string => {
  const rounded = Math.round(value * 4) / 4;
  const whole = Math.trunc(rounded);
  const frac = Math.round((rounded - whole) * 4);
  const fracMap: Record<number, string> = {
    0: "",
    1: "1/4",
    2: "1/2",
    3: "3/4",
  };
  const fracStr = fracMap[frac];

  if (!whole && fracStr) return fracStr;
  if (whole && fracStr) return `${whole} ${fracStr}`;
  return `${whole}`;
};

/**
 * Scale an ingredient amount by number of servings
 * Converts to nice fractions for display
 * @param baseAmount - Base amount (for 1 serving)
 * @param servings - Number of servings to scale to
 */
export const scaleAmount = (
  baseAmount: number | string,
  servings: number
): number | string => {
  const n =
    typeof baseAmount === "number"
      ? baseAmount
      : parseFloat(String(baseAmount));

  if (Number.isNaN(n)) return baseAmount;
  return toNiceFraction(n * servings);
};

/**
 * Scale a full ingredient object by number of servings
 * @param ingredient - Measured ingredient to scale
 * @param servings - Number of servings
 */
export const scaleIngredient = (
  ingredient: Measured,
  servings: number
): Measured => ({
  ...ingredient,
  amount: scaleAmount(ingredient.amount, servings),
});

/**
 * Scale an array of ingredients by number of servings
 * @param ingredients - Array of measured ingredients
 * @param servings - Number of servings
 */
export const scaleIngredients = (
  ingredients: Measured[],
  servings: number
): Measured[] => ingredients.map((ing) => scaleIngredient(ing, servings));

/**
 * Calculate total calories for a recipe based on servings
 * @param baseCalories - Calories per serving
 * @param servings - Number of servings
 */
export const calculateTotalCalories = (
  baseCalories: number,
  servings: number
): number => Math.round(baseCalories * servings);

/**
 * Format a time duration in minutes to a readable string
 * Examples: 5 -> "5 min", 90 -> "1h 30min"
 * @param minutes - Duration in minutes
 */
export const formatDuration = (minutes: number): string => {
  if (minutes < 60) return `${minutes} min`;

  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;

  if (mins === 0) return `${hours}h`;
  return `${hours}h ${mins}min`;
};

/**
 * Parse a fraction string to decimal
 * Examples: "1/2" -> 0.5, "1 1/4" -> 1.25
 * @param fractionStr - Fraction string to parse
 */
export const parseFraction = (fractionStr: string): number => {
  const parts = fractionStr.trim().split(" ");
  let result = 0;

  parts.forEach((part) => {
    if (part.includes("/")) {
      const [num, denom] = part.split("/").map(Number);
      result += num / denom;
    } else {
      result += Number(part);
    }
  });

  return result;
};
