// server/services/recipes-service.ts
// ESM module. Works with Node 18+ (global fetch) and your esbuild setup.
// Route imports it like: import { searchRecipes } from "../services/recipes-service";

type SearchOptions = {
  q?: string;
  mealTypes?: string[];   // e.g. ["Breakfast","Dinner"]
  diets?: string[];       // e.g. ["Vegan","Vegetarian"]
  compliance?: string[];  // e.g. ["Halal","Kosher"]
  cuisines?: string[];    // e.g. ["Italian","Mexican"]
  limit?: number;
  offset?: number;
};

export type RecipeItem = {
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
  source?: "local" | "mealdb" | "spoonacular" | string;
  cuisine?: string | null;
  mealType?: string | null;
  dietTags?: string[] | null;
};

export type SearchResult = {
  items: RecipeItem[];
  total: number;
  source: string; // "multi" | "mealdb" | "spoonacular" | "local"
};

// ---------- helpers ----------

const asArray = <T,>(v: T | T[] | undefined | null): T[] =>
  Array.isArray(v) ? v : v == null ? [] : [v];

function normalizeText(s?: string | null) {
  return (s ?? "").trim();
}

function splitLines(instructions?: string | null): string[] {
  const txt = normalizeText(instructions);
  if (!txt) return [];
  // TheMealDB often uses line breaks. Split on \r?\n and filter empties.
  return txt.split(/\r?\n+/).map((l) => l.trim()).filter(Boolean);
}

// ---------- Local sample fallback (so the page never empties) ----------

const LOCAL_SEED: RecipeItem[] = [
  {
    id: "seed-1",
    title: "Honey Glazed Salmon with Roasted Vegetables",
    imageUrl: "https://images.unsplash.com/photo-1467003909585-2f8a72700288?w=800&h=600&fit=crop&auto=format",
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
      "Season salmon; brush with glaze.",
      "Roast vegetables with olive oil for 15 minutes.",
      "Add salmon to pan and bake 12–15 minutes.",
    ],
    cookTime: 30,
    servings: 4,
    difficulty: "Easy",
    calories: 350,
    protein: "28g",
    carbs: "15g",
    fat: "18g",
    fiber: "3g",
    cuisine: "Seafood",
    dietTags: ["High-Protein"],
    source: "local",
  },
  {
    id: "seed-2",
    title: "Fresh Fettuccine with Wild Mushroom Ragu",
    imageUrl: "https://images.unsplash.com/photo-1621996346565-e3dbc353d2e5?w=800&h=600&fit=crop&auto=format",
    ingredients: [
      "2 cups all-purpose flour",
      "3 large eggs",
      "1 lb mixed wild mushrooms",
      "1/2 cup white wine",
      "2 tbsp olive oil",
      "2 cloves garlic, minced",
      "Fresh thyme",
      "Parmesan cheese",
      "Salt and pepper to taste",
    ],
    instructions: [
      "Make pasta dough; rest 30 minutes.",
      "Roll and cut into fettuccine.",
      "Sauté mushrooms with garlic and thyme.",
      "Add wine and simmer.",
      "Cook pasta; toss with ragu; serve with Parmesan.",
    ],
    cookTime: 45,
    servings: 4,
    difficulty: "Medium",
    calories: 420,
    protein: "18g",
    carbs: "52g",
    fat: "14g",
    fiber: "4g",
    cuisine: "Italian",
    dietTags: ["Vegetarian"],
    source: "local",
  },
];

// ---------- TheMealDB provider ----------

async function mealDbSearch(q?: string): Promise<RecipeItem[]> {
  try {
    const base = "https://www.themealdb.com/api/json/v1/1";
    // If no q provided, use a first-letter search (more reliable than empty search)
    const url = q && q.trim()
      ? `${base}/search.php?s=${encodeURIComponent(q.trim())}`
      : `${base}/search.php?f=c`; // give some results by default

    const res = await fetch(url);
    if (!res.ok) throw new Error(`TheMealDB HTTP ${res.status}`);
    const data = await res.json();

    const meals: any[] = asArray(data?.meals);
    return meals.map((m) => {
      // Collect ingredients/measures (TheMealDB stores as strIngredient1..20)
      const ings: string[] = [];
      for (let i = 1; i <= 20; i++) {
        const ing = normalizeText(m[`strIngredient${i}`]);
        const measure = normalizeText(m[`strMeasure${i}`]);
        if (ing) ings.push(measure ? `${measure} ${ing}` : ing);
      }

      return {
        id: `mealdb-${m.idMeal}`,
        title: normalizeText(m.strMeal) || "Untitled",
        imageUrl: normalizeText(m.strMealThumb) || null,
        ingredients: ings,
        instructions: splitLines(m.strInstructions),
        cookTime: null,
        servings: null,
        difficulty: null,
        calories: null,
        protein: null,
        carbs: null,
        fat: null,
        fiber: null,
        cuisine: normalizeText(m.strArea) || null,
        mealType: normalizeText(m.strCategory) || null,
        dietTags: null,
        source: "mealdb",
      } satisfies RecipeItem;
    });
  } catch {
    return [];
  }
}

// ---------- Spoonacular provider (optional) ----------

async function spoonacularSearch(q?: string): Promise<RecipeItem[]> {
  const key = process.env.SPOONACULAR_API_KEY;
  if (!key) return []; // silently skip if no key set

  try {
    // We use complexSearch to get images + info in one call
    const params = new URLSearchParams({
      query: q?.trim() || "dinner",
      number: "15",
      addRecipeInformation: "true",
      instructionsRequired: "true",
    });

    const url = `https://api.spoonacular.com/recipes/complexSearch?${params.toString()}&apiKey=${encodeURIComponent(
      key
    )}`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Spoonacular HTTP ${res.status}`);
    const data = await res.json();
    const results: any[] = asArray(data?.results);

    return results.map((r) => {
      const ings: string[] = asArray(r?.extendedIngredients).map((it: any) =>
        normalizeText(it?.original || it?.name)
      ).filter(Boolean);

      // Spoonacular gives summary/instructions as HTML sometimes; strip tags lightly
      const instructions =
        typeof r?.instructions === "string"
          ? r.instructions.replace(/<[^>]+>/g, "\n").split(/\r?\n+/).map((l: string) => l.trim()).filter(Boolean)
          : [];

      return {
        id: `spoon-${r.id}`,
        title: normalizeText(r.title) || "Untitled",
        imageUrl: normalizeText(r.image) || null,
        ingredients: ings,
        instructions,
        cookTime: Number.isFinite(r.readyInMinutes) ? r.readyInMinutes : null,
        servings: Number.isFinite(r.servings) ? r.servings : null,
        difficulty: null,
        calories: null,
        protein: null,
        carbs: null,
        fat: null,
        fiber: null,
        cuisine: asArray(r?.cuisines).join(", ") || null,
        mealType: asArray(r?.dishTypes).join(", ") || null,
        dietTags: asArray(r?.diets),
        source: "spoonacular",
      } satisfies RecipeItem;
    });
  } catch {
    return [];
  }
}

// ---------- Filtering (light, best-effort) ----------

function applyFilters(items: RecipeItem[], opts: SearchOptions): RecipeItem[] {
  const q = normalizeText(opts.q)?.toLowerCase();

  let out = items;

  if (q) {
    out = out.filter((it) => {
      const hay = [
        it.title,
        ...(it.ingredients || []),
        ...(Array.isArray(it.instructions) ? it.instructions : [it.instructions ?? ""]),
        it.cuisine ?? "",
        it.mealType ?? "",
        ...(it.dietTags || []),
      ]
        .join(" ")
        .toLowerCase();
      return hay.includes(q);
    });
  }

  if (opts.cuisines?.length) {
    const want = new Set(opts.cuisines.map((s) => s.toLowerCase()));
    out = out.filter((it) => {
      const c = (it.cuisine || "").toLowerCase();
      return c && Array.from(want).some((w) => c.includes(w));
    });
  }

  if (opts.diets?.length) {
    const want = new Set(opts.diets.map((s) => s.toLowerCase()));
    out = out.filter((it) => {
      const tags = (it.dietTags || []).map((t) => t.toLowerCase());
      // “diet” match is loose; if no tags, don’t exclude
      return tags.length === 0 || [...want].some((w) => tags.includes(w));
    });
  }

  // "compliance" (Halal/Kosher) — if we had tags we’d filter; keep best-effort no-op for now
  // if you tag items later (dietTags includes "Halal"), this will work automatically.

  if (opts.mealTypes?.length) {
    const want = new Set(opts.mealTypes.map((s) => s.toLowerCase()));
    out = out.filter((it) => {
      const mt = (it.mealType || "").toLowerCase();
      return mt && [...want].some((w) => mt.includes(w));
    });
  }

  return out;
}

function dedupeByTitle(items: RecipeItem[]): RecipeItem[] {
  const seen = new Set<string>();
  const out: RecipeItem[] = [];
  for (const it of items) {
    const key = (it.title || "").toLowerCase();
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(it);
  }
  return out;
}

// ---------- Main service ----------

export async function searchRecipes(options: SearchOptions = {}): Promise<SearchResult> {
  const limit = Math.max(1, Math.min(50, options.limit ?? 24));
  const offset = Math.max(0, options.offset ?? 0);

  // Run providers in parallel; always include local seed last (as fallback)
  const [mealdb, spoon] = await Promise.all([mealDbSearch(options.q), spoonacularSearch(options.q)]);
  let combined = [...mealdb, ...spoon];

  // If both providers returned nothing, seed with local examples so UI isn’t empty
  if (combined.length === 0) {
    combined = [...LOCAL_SEED];
  }

  // Apply filters & dedupe
  combined = applyFilters(combined, options);
  combined = dedupeByTitle(combined);

  const total = combined.length;
  const paged = combined.slice(offset, offset + limit);

  return {
    items: paged,
    total,
    source: combined.some((x) => x.source === "spoonacular")
      ? "multi"
      : combined.some((x) => x.source === "mealdb")
      ? "mealdb"
      : "local",
  };
}
