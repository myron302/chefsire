import { MEAL_TYPES, WEEK_DAYS } from './nutritionMealPlannerUtils';
import { getMealsForSlot } from './planner-graph/plannerGraphUtils';
import { extractMealIngredients } from './planner-graph/plannerMealExtraction';

export type PlannerGrocerySourceMeal = {
  mealName: string;
  day: string;
  mealType: string;
  recipeId?: string | number;
  recipeTitle?: string;
};

export type PlannerGrocerySourceRow = {
  id: string;
  rawName: string;
  normalizedName: string;
  displayName: string;
  quantity?: string;
  category?: string;
  notes?: string;
  meal: PlannerGrocerySourceMeal;
};

export type PlannerGrocerySuggestion = {
  id: string;
  name: string;
  normalizedName: string;
  quantitySummary: string;
  sourceMealsCount: number;
  linkedMealNames: string[];
  sourceMeals: PlannerGrocerySourceMeal[];
  sourceRecipeIds: Array<string | number>;
  category?: string;
  generated: true;
  pantryMatchStatus: 'in-pantry' | 'on-list-pantry' | 'missing';
  pantryMatches: string[];
  checked: boolean;
  accepted: boolean;
  dismissed: boolean;
  onManualList: boolean;
  manualListItemIds: string[];
  rows: PlannerGrocerySourceRow[];
};

export type PlannerGroceryDerivationState = {
  dismissedIds?: string[];
  checkedIds?: string[];
  acceptedIds?: string[];
  editedById?: Record<string, { name?: string; quantitySummary?: string; category?: string }>;
};

const SAFE_DESCRIPTORS = new Set([
  'boneless',
  'skinless',
  'fresh',
  'frozen',
  'raw',
  'cooked',
  'chopped',
  'diced',
  'sliced',
  'minced',
  'shredded',
  'grated',
  'whole',
  'large',
  'small',
  'medium',
  'extra',
]);

const GENERIC_COMPONENT_WORDS = new Set([
  'serving',
  'servings',
  'portion',
  'portions',
  'ingredient',
  'ingredients',
  'meal',
]);

const PROTEIN_WORDS = ['chicken', 'beef', 'turkey', 'pork', 'salmon', 'tuna', 'shrimp', 'tofu', 'tempeh', 'egg', 'eggs', 'beans', 'lentils'];
const PRODUCE_WORDS = ['apple', 'banana', 'berry', 'berries', 'spinach', 'lettuce', 'tomato', 'tomatoes', 'pepper', 'peppers', 'onion', 'broccoli', 'carrot', 'potato', 'potatoes', 'avocado', 'mushroom', 'zucchini', 'fruit', 'vegetable'];
const DAIRY_WORDS = ['milk', 'cheese', 'yogurt', 'cream', 'butter', 'cottage'];
const GRAIN_WORDS = ['rice', 'pasta', 'bread', 'tortilla', 'oats', 'quinoa', 'flour', 'noodle', 'noodles'];

const titleCase = (value: string) => value
  .split(' ')
  .filter(Boolean)
  .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
  .join(' ');

const singularizeToken = (token: string) => {
  if (token.length <= 3) return token;
  if (token.endsWith('ies')) return `${token.slice(0, -3)}y`;
  if (token.endsWith('oes')) return token.slice(0, -2);
  if (token.endsWith('ches') || token.endsWith('shes')) return token.slice(0, -2);
  if (token.endsWith('s') && !token.endsWith('ss')) return token.slice(0, -1);
  return token;
};

export const normalizeMealIngredient = (value: unknown) => {
  const cleaned = String(value ?? '')
    .toLowerCase()
    .replace(/[()[\]{}]/g, ' ')
    .replace(/[.,;:!]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  if (!cleaned) return '';

  const tokens = cleaned
    .split(' ')
    .map((token) => token.replace(/^[^a-z0-9]+|[^a-z0-9]+$/g, ''))
    .filter(Boolean)
    .filter((token) => !SAFE_DESCRIPTORS.has(token))
    .map(singularizeToken);

  return tokens.join(' ').trim();
};

const isUsefulIngredient = (name: string) => {
  const normalized = normalizeMealIngredient(name);
  if (!normalized) return false;
  if (GENERIC_COMPONENT_WORDS.has(normalized)) return false;
  return normalized.length > 1;
};

const inferCategory = (name: string, fallback?: string) => {
  if (fallback) return fallback;
  const normalized = normalizeMealIngredient(name);
  const hasAny = (words: string[]) => words.some((word) => normalized.includes(word));
  if (hasAny(PROTEIN_WORDS)) return 'Protein';
  if (hasAny(PRODUCE_WORDS)) return 'Produce';
  if (hasAny(DAIRY_WORDS)) return 'Dairy';
  if (hasAny(GRAIN_WORDS)) return 'Grains';
  return 'From Recipe';
};

const safeId = (value: string) => value.replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'item';

export const aggregatePlannerGroceries = (weeklyMeals: Record<string, any> | null | undefined): PlannerGrocerySourceRow[] => {
  if (!weeklyMeals || typeof weeklyMeals !== 'object') return [];

  const rows: PlannerGrocerySourceRow[] = [];

  WEEK_DAYS.forEach((day) => {
    MEAL_TYPES.forEach((mealType) => {
      getMealsForSlot(weeklyMeals, day, mealType).forEach((meal: any, mealIndex: number) => {
        const mealName = String(meal?.name || meal?.title || `${day} ${mealType}`).trim();
        extractMealIngredients(meal).forEach((item: any, itemIndex: number) => {
          const rawName = String(item?.name || '').trim();
          if (!isUsefulIngredient(rawName)) return;
          const normalizedName = normalizeMealIngredient(rawName);
          rows.push({
            id: `${day}-${mealType}-${meal?.entryId || meal?.id || mealIndex}-${item?.id || itemIndex}-${safeId(normalizedName)}`,
            rawName,
            normalizedName,
            displayName: titleCase(normalizedName || rawName.toLowerCase()),
            quantity: String(item?.quantity || item?.amount || '').trim() || undefined,
            category: inferCategory(rawName, item?.category),
            notes: String(item?.notes || '').trim() || undefined,
            meal: {
              mealName,
              day,
              mealType,
              recipeId: meal?.sourceRecipeId || meal?.recipeId,
              recipeTitle: meal?.sourceRecipeTitle,
            },
          });
        });
      });
    });
  });

  return rows;
};

const summarizeQuantities = (rows: PlannerGrocerySourceRow[]) => {
  const counts = new Map<string, number>();
  rows.forEach((row) => {
    const quantity = row.quantity?.trim();
    if (!quantity) return;
    counts.set(quantity, (counts.get(quantity) || 0) + 1);
  });

  if (counts.size === 0) return `${rows.length} planned use${rows.length === 1 ? '' : 's'}`;

  return Array.from(counts.entries())
    .map(([quantity, count]) => count > 1 ? `${quantity} ×${count}` : quantity)
    .slice(0, 4)
    .join(' + ');
};

const unique = <T,>(values: T[]) => Array.from(new Set(values.filter(Boolean)));

export const matchPantryIngredients = (suggestionName: string, groceryList: any[]) => {
  const normalized = normalizeMealIngredient(suggestionName);
  const matches = groceryList.filter((item: any) => normalizeMealIngredient(item?.name || item?.item) === normalized);
  const pantryMatches = matches.filter((item: any) => item?.isPantryItem);

  return {
    pantryMatchStatus: pantryMatches.length > 0 ? 'on-list-pantry' as const : 'missing' as const,
    pantryMatches: pantryMatches.map((item: any) => String(item?.name || item?.item || '').trim()).filter(Boolean),
    onManualList: matches.some((item: any) => !item?.isPantryItem),
    manualListItemIds: matches.map((item: any) => String(item?.id || '')).filter(Boolean),
  };
};

export const derivePlannerGrocerySuggestions = (
  weeklyMeals: Record<string, any> | null | undefined,
  groceryList: any[] = [],
  state: PlannerGroceryDerivationState = {},
): PlannerGrocerySuggestion[] => {
  const dismissed = new Set(state.dismissedIds || []);
  const checked = new Set(state.checkedIds || []);
  const accepted = new Set(state.acceptedIds || []);
  const grouped = new Map<string, PlannerGrocerySourceRow[]>();

  aggregatePlannerGroceries(weeklyMeals).forEach((row) => {
    const key = row.normalizedName;
    if (!key) return;
    grouped.set(key, [...(grouped.get(key) || []), row]);
  });

  return Array.from(grouped.entries()).map(([normalizedName, rows]) => {
    const id = `planner-grocery-${safeId(normalizedName)}`;
    const edits = state.editedById?.[id] || {};
    const pantry = matchPantryIngredients(edits.name || rows[0].displayName, groceryList);
    const linkedMealNames = unique(rows.map((row) => row.meal.mealName));
    const sourceRecipeIds = unique(rows.map((row) => row.meal.recipeId).filter((value) => value !== undefined));
    const onManualChecked = groceryList.some((item: any) => (
      normalizeMealIngredient(item?.name || item?.item) === normalizedName && Boolean(item?.checked)
    ));
    const onPantry = pantry.pantryMatchStatus !== 'missing';

    return {
      id,
      name: edits.name || rows[0].displayName,
      normalizedName,
      quantitySummary: edits.quantitySummary || summarizeQuantities(rows),
      sourceMealsCount: linkedMealNames.length,
      linkedMealNames,
      sourceMeals: rows.map((row) => row.meal),
      sourceRecipeIds,
      category: edits.category || inferCategory(rows[0].rawName, rows[0].category),
      generated: true as const,
      pantryMatchStatus: onPantry ? pantry.pantryMatchStatus : 'missing',
      pantryMatches: pantry.pantryMatches,
      checked: checked.has(id) || onManualChecked || onPantry,
      accepted: accepted.has(id) || pantry.onManualList,
      dismissed: dismissed.has(id),
      onManualList: pantry.onManualList,
      manualListItemIds: pantry.manualListItemIds,
      rows,
    };
  }).sort((a, b) => {
    if (a.checked !== b.checked) return a.checked ? 1 : -1;
    if (a.sourceMealsCount !== b.sourceMealsCount) return b.sourceMealsCount - a.sourceMealsCount;
    return a.name.localeCompare(b.name);
  });
};
