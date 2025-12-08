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

// Fisher-Yates shuffle algorithm for randomizing arrays
function shuffleArray<T>(array: T[]): T[] {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

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

  // Empty query => serve a fresh random page every request (original behavior)
  if (!params.q || params.q.trim() === "") {
    // Fetch random meals from TheMealDB
    const randomMeals = await getRandomMeals(pageSize + offset);
    const filtered = filterMeals(randomMeals, {
      cuisines: params.cuisines ?? [],
      diets: params.diets ?? [],
      mealTypes: params.mealTypes ?? [],
    });

    const page = filtered.slice(offset, offset + pageSize);
    let results = page.map(mapMealDB);

    // On FIRST page only, mix in a few local recipes with images
    if (offset === 0) {
      try {
        const localRecipes = await RecipeService.searchLocalRecipes(db, {
          cuisines: params.cuisines,
          diets: params.diets,
          mealTypes: params.mealTypes,
          pageSize: 10, // Get up to 10 candidates
          offset: 0,
        });

        // Filter: only recipes WITH images
        const localWithImages = localRecipes.filter(r => r.imageUrl && r.imageUrl.trim());

        if (localWithImages.length > 0) {
          // Randomize local recipes to avoid repetition
          const shuffledLocal = shuffleArray(localWithImages);

          // Take up to 3 random local recipes with images
          const localResults: RecipeItem[] = shuffledLocal.slice(0, 3).map((recipe) => ({
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

          // Mix: first 3 local recipes, then enough random to reach pageSize
          const randomNeeded = pageSize - localResults.length;
          results = [...localResults, ...results.slice(0, randomNeeded)];
        }
      } catch (error) {
        console.error("Error fetching local recipes for mixing:", error);
        // Continue with only external recipes
      }
    }

    // Return total that indicates more recipes available (for infinite scroll)
    return { total: filtered.length + 1000, source: SOURCE, results };
  }

  // Named search - prioritize local results
  const q = params.q.trim();

  // Search local database
  const localRecipes = await RecipeService.searchLocalRecipes(db, {
    q,
    cuisines: params.cuisines,
    diets: params.diets,
    mealTypes: params.mealTypes,
    pageSize: 100, // Get more local results for search
    offset: 0,
  });

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

  // Search external API
  const url = `https://www.themealdb.com/api/json/v1/1/search.php?s=${encodeURIComponent(q)}`;
  const json = await fetchJSON<{ meals: MealDBMeal[] | null }>(url, 12000);
  const meals = json.meals ?? [];

  const filtered = filterMeals(meals, {
    cuisines: params.cuisines ?? [],
    diets: params.diets ?? [],
    mealTypes: params.mealTypes ?? [],
  });

  const externalResults = filtered.map(mapMealDB);

  // Merge: local recipes first, then external
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
