// server/services/recipes-service.ts
import { RecipeService } from "./recipe.service";
import { db } from "../db";

type SearchParams = {
  q?: string;
  cuisines?: string[];
  diets?: string[];
  mealTypes?: string[];
  pageSize?: number;
  offset?: number;
};

type MealDBMeal = {
  idMeal: string;
  strMeal: string;
  strMealThumb?: string | null;
  strArea?: string | null;
  strCategory?: string | null;
  strTags?: string | null;
  strInstructions?: string | null;
};

export type RecipeItem = {
  id: string;
  title: string;
  image: string | null;
  imageUrl: string | null;
  cuisine: string | null;
  mealType: string | null;
  dietTags?: string[];
  instructions?: string | null;
  ratingSpoons: number | null;
  cookTime: number | null;
  servings: number | null;
  source: "mealdb";
  averageRating?: string | number | null;
};

const SOURCE: "mealdb" = "mealdb";

async function fetchJSON<T>(url: string, timeoutMs = 10000): Promise<T> {
  const ctrl = new AbortController();
  const to = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, { signal: ctrl.signal });
    if (!res.ok) throw new Error(`Upstream ${res.status} for ${url}`);
    return (await res.json()) as T;
  } finally {
    clearTimeout(to);
  }
}

function mapMealDB(m: MealDBMeal): RecipeItem {
  const tags = (m.strTags || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  return {
    id: `mealdb_${m.idMeal}`,
    title: m.strMeal,
    image: m.strMealThumb || null,
    imageUrl: m.strMealThumb || null,
    cuisine: m.strArea || null,
    mealType: m.strCategory || null,
    dietTags: tags.length ? tags : undefined,
    instructions: m.strInstructions || null,
    ratingSpoons: null,
    cookTime: null,
    servings: null,
    source: SOURCE,
  };
}

function normalizeList(list?: string[] | null): string[] | undefined {
  if (!list || !list.length) return undefined;
  return list.map((s) => s.trim().toLowerCase()).filter(Boolean);
}

function filterMeals(
  meals: MealDBMeal[],
  { cuisines, diets, mealTypes }: Required<Pick<SearchParams, "cuisines" | "diets" | "mealTypes">>
): MealDBMeal[] {
  const wantCuisines = normalizeList(cuisines);
  const wantMealTypes = normalizeList(mealTypes);
  const wantDiets = normalizeList(diets);

  if (!wantCuisines && !wantMealTypes && !wantDiets) return meals;

  return meals.filter((m) => {
    if (wantCuisines) {
      const area = (m.strArea || "").trim().toLowerCase();
      if (!area || !wantCuisines.includes(area)) return false;
    }
    if (wantMealTypes) {
      const cat = (m.strCategory || "").trim().toLowerCase();
      if (!cat || !wantMealTypes.includes(cat)) return false;
    }
    if (wantDiets) {
      const tags = (m.strTags || "")
        .split(",")
        .map((s) => s.trim().toLowerCase())
        .filter(Boolean);
      if (!tags.length || !wantDiets.some((d) => tags.includes(d))) return false;
    }
    return true;
  });
}

// True-random set by calling TheMealDB's random endpoint repeatedly
async function getRandomMeals(target = 24): Promise<MealDBMeal[]> {
  const out: MealDBMeal[] = [];
  const seen = new Set<string>();
  let attempts = 0;

  while (out.length < target && attempts < target * 5) {
    attempts++;
    try {
      const json = await fetchJSON<{ meals: MealDBMeal[] | null }>(
        "https://www.themealdb.com/api/json/v1/1/random.php",
        10000
      );
      const m = json.meals?.[0];
      if (m && !seen.has(m.idMeal)) {
        out.push(m);
        seen.add(m.idMeal);
      }
    } catch {
      // ignore transient upstream failures
    }
  }
  return out;
}

export async function searchRecipes(params: SearchParams): Promise<{
  total: number;
  source: typeof SOURCE;
  results: RecipeItem[];
}> {
  const pageSize = Math.min(Math.max(params.pageSize ?? 24, 1), 60);
  const offset = Math.max(params.offset ?? 0, 0);

  // First, search local database for saved recipes
  const localRecipes = await RecipeService.searchLocalRecipes(db, {
    q: params.q,
    cuisines: params.cuisines,
    diets: params.diets,
    mealTypes: params.mealTypes,
    pageSize: pageSize * 2, // Get more to account for filtering
    offset: 0,
  });

  // Convert local recipes to RecipeItem format
  const localResults: RecipeItem[] = localRecipes.map((recipe) => ({
    id: recipe.id,
    title: recipe.title,
    image: recipe.imageUrl,
    imageUrl: recipe.imageUrl,
    cuisine: recipe.cuisine || null,
    mealType: recipe.mealType || null,
    dietTags: recipe.dietTags,
    instructions: Array.isArray(recipe.instructions) ? recipe.instructions.join("\n") : null,
    ratingSpoons: recipe.averageRating ? Number(recipe.averageRating) : null,
    cookTime: recipe.cookTime,
    servings: recipe.servings,
    source: SOURCE,
    averageRating: recipe.averageRating,
  }));

  console.log(`🔍 Found ${localResults.length} local recipes for query: "${params.q || '(random)'}"`);

  // If we have enough local results, return them
  if (localResults.length >= pageSize) {
    const page = localResults.slice(offset, offset + pageSize);
    return { total: localResults.length, source: SOURCE, results: page };
  }

  // Not enough local results, supplement with external API
  const neededExternal = pageSize - localResults.length;

  // Empty query => serve a fresh random page every request
  if (!params.q || params.q.trim() === "") {
    const randomMeals = await getRandomMeals(neededExternal + offset);
    const filtered = filterMeals(randomMeals, {
      cuisines: params.cuisines ?? [],
      diets: params.diets ?? [],
      mealTypes: params.mealTypes ?? [],
    });
    const externalResults = filtered.map(mapMealDB);

    // Merge local and external, deduplicating
    const merged = deduplicateRecipes([...localResults, ...externalResults]);
    const page = merged.slice(offset, offset + pageSize);
    return { total: merged.length, source: SOURCE, results: page };
  }

  // Named search (MealDB search-by-name)
  const q = params.q.trim();
  const url = `https://www.themealdb.com/api/json/v1/1/search.php?s=${encodeURIComponent(q)}`;
  const json = await fetchJSON<{ meals: MealDBMeal[] | null }>(url, 12000);
  const meals = json.meals ?? [];

  const filtered = filterMeals(meals, {
    cuisines: params.cuisines ?? [],
    diets: params.diets ?? [],
    mealTypes: params.mealTypes ?? [],
  });

  const externalResults = filtered.map(mapMealDB);

  // Merge local and external, deduplicating
  const merged = deduplicateRecipes([...localResults, ...externalResults]);
  const total = merged.length;
  const page = merged.slice(offset, offset + pageSize);

  return { total, source: SOURCE, results: page };
}

/**
 * Deduplicate recipes, preferring local versions over external
 */
function deduplicateRecipes(recipes: RecipeItem[]): RecipeItem[] {
  const seen = new Set<string>();
  const result: RecipeItem[] = [];

  for (const recipe of recipes) {
    // Use title as dedup key (normalize for comparison)
    const key = recipe.title.toLowerCase().trim();

    if (!seen.has(key)) {
      seen.add(key);
      result.push(recipe);
    }
  }

  return result;
}
