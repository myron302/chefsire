// server/services/recipes-service.ts
import fetch from "node-fetch";

export type RecipeCardData = {
  id: string;
  title: string;
  image?: string | null;
  imageUrl?: string | null;
  cuisine?: string | null;
  mealType?: string | null;
  dietTags?: string[];
  ratingSpoons?: number | null;
  cookTime?: number | null;
  servings?: number | null;
  source?: string;
  // ADD THIS LINE - include instructions!
  strInstructions?: string | null;
};

export type RecipeSearchOptions = {
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
  strCategory: string | null;
  strArea: string | null;
  strInstructions: string | null;
  strMealThumb: string | null;
  strTags: string | null; // comma-separated
};

function mapMealDB(m: MealDBMeal): RecipeCardData {
  // ThemealDB rarely includes rating/time/servings; we leave them undefined
  const tags = (m.strTags || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  return {
    id: `mealdb_${m.idMeal}`,
    title: m.strMeal,
    image: m.strMealThumb || null,
    imageUrl: m.strMealThumb || null,
    cuisine: m.strArea || null,      // e.g., "Italian"
    mealType: m.strCategory || null, // e.g., "Seafood"
    dietTags: tags.length ? tags : undefined,
    ratingSpoons: null,
    cookTime: null,
    servings: null,
    source: "mealdb",
    // ADD THIS LINE - pass through the instructions!
    strInstructions: m.strInstructions || null,
  };
}

async function mealdbSearchByName(q: string): Promise<RecipeCardData[]> {
  const url = `https://www.themealdb.com/api/json/v1/1/search.php?s=${encodeURIComponent(q)}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`MealDB error ${res.status}`);
  const json = (await res.json()) as { meals: MealDBMeal[] | null };
  const meals = json.meals || [];
  return meals.map(mapMealDB);
}

async function mealdbRandom(count = 8): Promise<RecipeCardData[]> {
  // Fetch several random meals in parallel
  const urls = Array.from({ length: count }, () => "https://www.themealdb.com/api/json/v1/1/random.php");
  const results = await Promise.allSettled(
    urls.map(async (u) => {
      const res = await fetch(u);
      if (!res.ok) throw new Error(`MealDB error ${res.status}`);
      const json = (await res.json()) as { meals: MealDBMeal[] | null };
      const m = (json.meals || [])[0];
      return m ? mapMealDB(m) : null;
    })
  );
  return results
    .map((r) => (r.status === "fulfilled" ? r.value : null))
    .filter((x): x is RecipeCardData => !!x);
}

const STATIC_FALLBACK: RecipeCardData[] = [
  {
    id: "static_salmon",
    title: "Honey Glazed Salmon with Roasted Vegetables",
    image:
      "https://images.unsplash.com/photo-1467003909585-2f8a72700288?w=800&h=600&fit=crop&auto=format",
    imageUrl:
      "https://images.unsplash.com/photo-1467003909585-2f8a72700288?w=800&h=600&fit=crop&auto=format",
    cuisine: "American",
    mealType: "Dinner",
    dietTags: ["Seafood", "Healthy"],
    ratingSpoons: 4,
    cookTime: 30,
    servings: 4,
    source: "static",
    strInstructions: "1. Preheat oven to 400°F. 2. Season salmon with salt and pepper. 3. Brush with honey glaze. 4. Roast vegetables and salmon for 20-25 minutes until cooked through.",
  },
  {
    id: "static_pasta",
    title: "Fresh Fettuccine with Wild Mushroom Ragu",
    image:
      "https://images.unsplash.com/photo-1621996346565-e3dbc353d2e5?w=800&h=600&fit=crop&auto=format",
    imageUrl:
      "https://images.unsplash.com/photo-1621996346565-e3dbc353d2e5?w=800&h=600&fit=crop&auto=format",
    cuisine: "Italian",
    mealType: "Dinner",
    dietTags: ["Pasta", "Vegetarian"],
    ratingSpoons: 5,
    cookTime: 45,
    servings: 4,
    source: "static",
    strInstructions: "1. Cook fettuccine according to package directions. 2. Sauté mixed wild mushrooms with garlic and herbs. 3. Add cream and simmer. 4. Toss pasta with mushroom ragu and serve with parmesan.",
  },
];

export async function searchRecipes(opts: RecipeSearchOptions) {
  const pageSize = Math.max(1, Math.min(50, opts.pageSize ?? 24));
  const offset = Math.max(0, opts.offset ?? 0);

  try {
    let items: RecipeCardData[] = [];

    if (opts.q && opts.q.trim()) {
      // Exact proxy of your working example (search by name)
      items = await mealdbSearchByName(opts.q.trim());
    } else {
      // No query → show random real meals
      items = await mealdbRandom(8);
    }

    // (Optional) Client-side-style filtering—very light:
    if (opts.cuisines?.length) {
      const set = new Set(opts.cuisines.map((s) => s.toLowerCase()));
      items = items.filter((r) => (r.cuisine ? set.has(r.cuisine.toLowerCase()) : true));
    }
    if (opts.mealTypes?.length) {
      const set = new Set(opts.mealTypes.map((s) => s.toLowerCase()));
      items = items.filter((r) => (r.mealType ? set.has(r.mealType.toLowerCase()) : true));
    }
    if (opts.diets?.length) {
      const set = new Set(opts.diets.map((s) => s.toLowerCase()));
      items = items.filter((r) =>
        (r.dietTags || []).some((t) => set.has(t.toLowerCase()))
      );
    }

    const total = items.length;
    const sliced = items.slice(offset, offset + pageSize);

    // If still empty, return static so the UI always shows something
    const finalItems = sliced.length ? sliced : STATIC_FALLBACK;

    return {
      ok: true as const,
      total: finalItems.length,
      source: finalItems === STATIC_FALLBACK ? "static" : "mealdb",
      results: finalItems,
    };
  } catch (err) {
    // On any failure, provide static fallback instead of empty
    return {
      ok: true as const,
      total: STATIC_FALLBACK.length,
      source: "static",
      results: STATIC_FALLBACK,
    };
  }
}
