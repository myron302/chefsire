// server/services/recipes-service.ts
// Minimal, self-contained search service that:
// 1) Returns a couple of local demo recipes (always).
// 2) Pulls from TheMealDB (no API key required) when possible.
// 3) Optionally pulls from Spoonacular if SPOONACULAR_API_KEY is set.
// 4) Merges, de-dupes, applies light filtering & pagination.

type RecipeItem = {
  id: string;
  title: string;
  imageUrl?: string | null;
  ingredients?: string[];
  instructions?: string[] | string;
  cookTime?: number | null;
  servings?: number | null;
  difficulty?: string | null;
  calories?: number | null;
  protein?: string | number | null;
  carbs?: string | number | null;
  fat?: string | number | null;
  fiber?: string | number | null;
  cuisine?: string | null;
  mealType?: string | null;
  dietTags?: string[];
  source?: "local" | "mealdb" | "spoonacular" | string;
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
  total: number;
  results: RecipeItem[];
};

// --- Local always-on fallback (so the page never comes up empty) ---
const localFeatured: RecipeItem[] = [
  {
    id: "local-1",
    title: "Honey Glazed Salmon with Roasted Vegetables",
    imageUrl:
      "https://images.unsplash.com/photo-1467003909585-2f8a72700288?w=800&h=600&fit=crop&auto=format",
    ingredients: [
      "4 salmon fillets",
      "2 tbsp honey",
      "1 tbsp soy sauce",
      "2 cloves garlic, minced",
      "Mixed vegetables (broccoli, carrots, bell peppers)",
      "Olive oil",
      "Salt and pepper to taste",
    ],
    instructions: [
      "Preheat oven to 400°F (200°C).",
      "Mix honey, soy sauce, and garlic for glaze.",
      "Season salmon with salt and pepper, brush with glaze.",
      "Roast vegetables 15 min, add salmon, bake 12–15 min.",
    ],
    cookTime: 30,
    servings: 4,
    difficulty: "Easy",
    cuisine: "Seafood",
    dietTags: ["High-Protein"],
    source: "local",
  },
  {
    id: "local-2",
    title: "Fresh Fettuccine with Wild Mushroom Ragu",
    imageUrl:
      "https://images.unsplash.com/photo-1621996346565-e3dbc353d2e5?w=800&h=600&fit=crop&auto=format",
    ingredients: [
      "2 cups all-purpose flour",
      "3 large eggs",
      "1 lb mixed wild mushrooms",
      "2 tbsp olive oil",
      "2 cloves garlic, minced",
      "Fresh thyme",
      "1/2 cup white wine",
      "Parmesan cheese",
      "Salt and pepper",
    ],
    instructions: [
      "Make pasta dough; rest 30 min; roll and cut.",
      "Sauté mushrooms with garlic and thyme.",
      "Deglaze with white wine; simmer.",
      "Cook pasta; toss with ragu; serve with Parmesan.",
    ],
    cookTime: 45,
    servings: 4,
    difficulty: "Medium",
    cuisine: "Italian",
    dietTags: [],
    source: "local",
  },
];

// -------------------- TheMealDB (no key required) --------------------
type MealDBMeal = {
  idMeal: string;
  strMeal: string;
  strMealThumb: string | null;
  strInstructions: string | null;
  strArea: string | null;       // cuisine/area (e.g., "Mexican")
  strCategory: string | null;   // meal type/category (e.g., "Dessert")
  [k: `strIngredient${number}`]: string | null;
  [k: `strMeasure${number}`]: string | null;
};

function mapMealDBMeal(meal: MealDBMeal): RecipeItem {
  const ingredients: string[] = [];
  for (let i = 1; i <= 20; i++) {
    const ing = (meal as any)[`strIngredient${i}`] as string | null;
    const meas = (meal as any)[`strMeasure${i}`] as string | null;
    if (ing && ing.trim()) {
      ingredients.push(meas && meas.trim() ? `${meas.trim()} ${ing.trim()}` : ing.trim());
    }
  }

  // Split instructions into steps if possible
  const instructions =
    meal.strInstructions?.includes("\n")
      ? meal.strInstructions
          ?.split(/\r?\n/)
          .map((s) => s.trim())
          .filter(Boolean)
      : meal.strInstructions || "";

  return {
    id: `mealdb-${meal.idMeal}`,
    title: meal.strMeal,
    imageUrl: meal.strMealThumb,
    ingredients,
    instructions,
    cookTime: null,
    servings: null,
    difficulty: null,
    cuisine: meal.strArea || null,
    mealType: meal.strCategory || null,
    source: "mealdb",
  };
}

async function fetchMealDB(q?: string): Promise<RecipeItem[]> {
  try {
    // If no q, MealDB still allows an empty search to return many popular meals.
    const url = new URL("https://www.themealdb.com/api/json/v1/1/search.php");
    url.searchParams.set("s", q || "");
    const res = await fetch(url.toString());
    if (!res.ok) return [];
    const json = await res.json();
    const meals: MealDBMeal[] = json?.meals || [];
    return meals.map(mapMealDBMeal);
  } catch {
    return [];
  }
}

// ---------------------- Spoonacular (optional) -----------------------
type SpoonacularResult = {
  id: number;
  title: string;
  image?: string;
  readyInMinutes?: number;
  servings?: number;
  cuisines?: string[];
  dishTypes?: string[];
  nutrition?: any;
};

function mapSpoon(r: SpoonacularResult): RecipeItem {
  return {
    id: `spoon-${r.id}`,
    title: r.title,
    imageUrl: r.image || null,
    cookTime: r.readyInMinutes ?? null,
    servings: r.servings ?? null,
    cuisine: (r.cuisines && r.cuisines[0]) || null,
    mealType: (r.dishTypes && r.dishTypes[0]) || null,
    instructions: [], // need a second call for full instructions; keeping simple
    ingredients: [],
    source: "spoonacular",
  };
}

async function fetchSpoonacular(q?: string, pageSize = 24, offset = 0): Promise<RecipeItem[]> {
  const key = process.env.SPOONACULAR_API_KEY;
  if (!key) return [];
  try {
    const url = new URL("https://api.spoonacular.com/recipes/complexSearch");
    if (q) url.searchParams.set("query", q);
    url.searchParams.set("number", String(pageSize));
    url.searchParams.set("offset", String(offset));
    url.searchParams.set("addRecipeInformation", "true"); // richer fields
    url.searchParams.set("instructionsRequired", "false");

    const res = await fetch(`${url.toString()}&apiKey=${encodeURIComponent(key)}`);
    if (!res.ok) return [];
    const json = await res.json();
    const results: SpoonacularResult[] = json?.results || [];
    return results.map(mapSpoon);
  } catch {
    return [];
  }
}

// ------------------- Utilities: filter + de-dupe + page --------------
function textIncludes(hay: string, needle: string) {
  return hay.toLowerCase().includes(needle.toLowerCase());
}

function applyFilters(
  items: RecipeItem[],
  p: SearchParams
): RecipeItem[] {
  let out = items.slice();

  if (p.q && p.q.trim()) {
    const q = p.q.trim().toLowerCase();
    out = out.filter(
      (r) =>
        textIncludes(r.title, q) ||
        (r.cuisine && textIncludes(r.cuisine, q)) ||
        (Array.isArray(r.ingredients) &&
          r.ingredients.some((ing) => textIncludes(String(ing), q)))
    );
  }

  if (p.cuisines && p.cuisines.length) {
    const set = new Set(p.cuisines.map((s) => s.toLowerCase()));
    out = out.filter((r) => (r.cuisine ? set.has(r.cuisine.toLowerCase()) : false));
  }

  if (p.mealTypes && p.mealTypes.length) {
    const set = new Set(p.mealTypes.map((s) => s.toLowerCase()));
    out = out.filter((r) => (r.mealType ? set.has(r.mealType.toLowerCase()) : true));
  }

  // diets are highly provider-specific; keep as a no-op unless tags exist
  if (p.diets && p.diets.length) {
    const set = new Set(p.diets.map((s) => s.toLowerCase()));
    out = out.filter((r) =>
      (r.dietTags || []).some((t) => set.has(t.toLowerCase()))
    );
  }

  return out;
}

function dedupe(items: RecipeItem[]): RecipeItem[] {
  const seen = new Set<string>();
  const out: RecipeItem[] = [];
  for (const r of items) {
    const key = (r.title || r.id).toLowerCase().trim();
    if (!seen.has(key)) {
      seen.add(key);
      out.push(r);
    }
  }
  return out;
}

function paginate(items: RecipeItem[], pageSize = 24, offset = 0): RecipeItem[] {
  const start = Math.max(0, offset);
  const end = start + Math.max(1, pageSize);
  return items.slice(start, end);
}

// ----------------------------- MAIN ---------------------------------
export async function searchRecipes(params: SearchParams): Promise<SearchResult> {
  const pageSize = params.pageSize ?? 24;
  const offset = params.offset ?? 0;

  // Always include local fallback so UI never shows empty on first load.
  let combined: RecipeItem[] = [...localFeatured];

  // TheMealDB (free)
  const mealDbItems = await fetchMealDB(params.q);
  combined.push(...mealDbItems);

  // Spoonacular (if API key configured)
  const spoonItems = await fetchSpoonacular(params.q, pageSize, offset);
  combined.push(...spoonItems);

  // De-dupe & filter
  combined = dedupe(combined);
  combined = applyFilters(combined, params);

  const total = combined.length;
  const page = paginate(combined, pageSize, offset);

  return { total, results: page };
}
