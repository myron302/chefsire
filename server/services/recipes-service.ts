// server/services/recipes-service.ts
// Node 18+ has global fetch (you’re on Node 22) — no extra deps needed.

export type RecipeCardData = {
  id: string;
  title: string;
  image?: string | null;
  imageUrl?: string | null;          // for older client code
  cuisine?: string | null;           // e.g. MealDB "area"
  mealType?: string | null;          // e.g. MealDB "category"
  dietTags?: string[];               // not provided by MealDB; we leave empty
  ratingSpoons?: number | null;      // simple 0–5 rating for UI
  cookTime?: number | null;          // dummy values so cards look nice
  servings?: number | null;          // dummy values so cards look nice
  source?: string;                   // "mealdb"
};

export type SearchParams = {
  q?: string;
  cuisines?: string[];
  diets?: string[];
  mealTypes?: string[];
  pageSize?: number;
  offset?: number;
};

export type SearchResult = {
  results: RecipeCardData[];
  total: number;
  source: string;
};

// --- helpers ---------------------------------------------------------------

async function fetchJson<T>(url: string, timeoutMs = 8000): Promise<T> {
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { signal: controller.signal });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return (await res.json()) as T;
  } finally {
    clearTimeout(t);
  }
}

function toCardFromMeal(meal: any): RecipeCardData {
  // MealDB search returns { idMeal, strMeal, strMealThumb, strArea, strCategory, ... }
  const cookTime = 15 * (1 + (Number(meal.idMeal) % 6)); // 15,30,...,90
  const rating = (Number(meal.idMeal) % 5) + 1;          // 1..5
  const servings = 2 + (Number(meal.idMeal) % 5);        // 2..6

  const image = meal.strMealThumb || null;

  return {
    id: String(meal.idMeal),
    title: meal.strMeal || "Untitled",
    image,
    imageUrl: image, // keep both keys for any client variant
    cuisine: meal.strArea || null,
    mealType: meal.strCategory || null,
    dietTags: [],
    ratingSpoons: rating,
    cookTime,
    servings,
    source: "mealdb",
  };
}

function dedupeById(list: RecipeCardData[]): RecipeCardData[] {
  const seen = new Set<string>();
  const out: RecipeCardData[] = [];
  for (const r of list) {
    if (seen.has(r.id)) continue;
    seen.add(r.id);
    out.push(r);
  }
  return out;
}

// --- providers (TheMealDB) ------------------------------------------------

type MealDbSearchResp = { meals: any[] | null };

// Search by free text (name)
async function mealDbSearchByName(q: string): Promise<RecipeCardData[]> {
  const url = `https://www.themealdb.com/api/json/v1/1/search.php?s=${encodeURIComponent(q)}`;
  const json = await fetchJson<MealDbSearchResp>(url);
  const meals = json.meals ?? [];
  return meals.map(toCardFromMeal);
}

// Filter by Area (we map your “cuisines” to MealDB “area” best effort)
async function mealDbFilterByArea(area: string): Promise<RecipeCardData[]> {
  const url = `https://www.themealdb.com/api/json/v1/1/filter.php?a=${encodeURIComponent(area)}`;
  const json = await fetchJson<MealDbSearchResp>(url);
  const meals = json.meals ?? [];
  // filter.php returns only id/name/thumb (no area/category) — we’ll fill partials
  return meals.map((m: any) =>
    toCardFromMeal({
      ...m,
      strArea: area,
      strCategory: null,
    })
  );
}

// Filter by Category (use for “mealTypes” when it matches MealDB categories)
async function mealDbFilterByCategory(cat: string): Promise<RecipeCardData[]> {
  const url = `https://www.themealdb.com/api/json/v1/1/filter.php?c=${encodeURIComponent(cat)}`;
  const json = await fetchJson<MealDbSearchResp>(url);
  const meals = json.meals ?? [];
  return meals.map((m: any) =>
    toCardFromMeal({
      ...m,
      strArea: null,
      strCategory: cat,
    })
  );
}

// Default showcase (when no q/filters given): pull a few popular categories
async function mealDbDefaultShowcase(): Promise<RecipeCardData[]> {
  const picks = ["Seafood", "Beef", "Chicken", "Dessert"];
  const lists = await Promise.allSettled(picks.map(mealDbFilterByCategory));
  const flat = lists
    .flatMap((p) => (p.status === "fulfilled" ? p.value : []))
    .slice(0, 48);
  return dedupeById(flat);
}

// --- public search ---------------------------------------------------------

export async function searchRecipes(params: SearchParams): Promise<SearchResult> {
  const {
    q,
    cuisines = [],
    mealTypes = [],
    // diets not supported by MealDB; we ignore but keep in params
    pageSize = 24,
    offset = 0,
  } = params;

  let pool: RecipeCardData[] = [];

  try {
    // Priority 1: text search
    if (q && q.trim()) {
      pool = await mealDbSearchByName(q.trim());
    }

    // Priority 2: filters
    if (!pool.length) {
      const areaLists = await Promise.allSettled(
        cuisines.slice(0, 3).map(mealDbFilterByArea)
      );
      const catLists = await Promise.allSettled(
        mealTypes.slice(0, 3).map(mealDbFilterByCategory)
      );
      pool = [
        ...areaLists.flatMap((p) => (p.status === "fulfilled" ? p.value : [])),
        ...catLists.flatMap((p) => (p.status === "fulfilled" ? p.value : [])),
      ];
    }

    // Priority 3: default showcase
    if (!pool.length) {
      pool = await mealDbDefaultShowcase();
    }
  } catch (_e) {
    // If MealDB is down or blocked, fall back to static items so the UI never looks empty.
    pool = STATIC_FALLBACK_RECIPES;
  }

  // Deduplicate and paginate
  const unique = dedupeById(pool);
  const total = unique.length;
  const paged = unique.slice(offset, offset + pageSize);

  // If absolutely nothing, ensure at least a few examples (last-resort fallback)
  const results = paged.length ? paged : STATIC_FALLBACK_RECIPES.slice(0, pageSize);

  return { results, total: results.length, source: "mealdb" };
}

// --- static fallback (used if APIs fail or return nothing) -----------------

const STATIC_FALLBACK_RECIPES: RecipeCardData[] = [
  {
    id: "sf-1",
    title: "Honey Glazed Salmon with Roasted Vegetables",
    image:
      "https://images.unsplash.com/photo-1467003909585-2f8a72700288?w=800&h=600&fit=crop&auto=format",
    imageUrl:
      "https://images.unsplash.com/photo-1467003909585-2f8a72700288?w=800&h=600&fit=crop&auto=format",
    cuisine: "American",
    mealType: "Dinner",
    ratingSpoons: 4,
    cookTime: 30,
    servings: 4,
    source: "static",
  },
  {
    id: "sf-2",
    title: "Fresh Fettuccine with Wild Mushroom Ragu",
    image:
      "https://images.unsplash.com/photo-1621996346565-e3dbc353d2e5?w=800&h=600&fit=crop&auto=format",
    imageUrl:
      "https://images.unsplash.com/photo-1621996346565-e3dbc353d2e5?w=800&h=600&fit=crop&auto=format",
    cuisine: "Italian",
    mealType: "Dinner",
    ratingSpoons: 5,
    cookTime: 45,
    servings: 4,
    source: "static",
  },
  {
    id: "sf-3",
    title: "Thai Green Curry",
    image:
      "https://images.unsplash.com/photo-1544025162-d76694265947?w=800&h=600&fit=crop&auto=format",
    imageUrl:
      "https://images.unsplash.com/photo-1544025162-d76694265947?w=800&h=600&fit=crop&auto=format",
    cuisine: "Thai",
    mealType: "Dinner",
    ratingSpoons: 4,
    cookTime: 35,
    servings: 4,
    source: "static",
  },
];
