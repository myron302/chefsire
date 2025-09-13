// server/services/recipes-providers.ts
import fetch from "node-fetch";

export type RecipesQuery = {
  q?: string;
  cuisines?: string[];
  diets?: string[];
  mealTypes?: string[];
  maxReadyMinutes?: number;
  pageSize?: number;
  offset?: number;
  // Anything else you want to support…
};

export type NormalizedRecipe = {
  id: string;
  title: string;
  imageUrl: string | null;
  author: string | null;
  createdAt: string; // ISO
  readyInMinutes: number | null;
  servings: number | null;
  difficulty: string | null;
  cuisine: string[];   // plural to hold multiple
  mealType: string[];  // plural to hold multiple
  ingredients: string[];
  instructions: string[];
  ratingSpoons: number | null; // 0..5
  diets: string[];
  allergens?: string[];
  source: "spoonacular" | "edamam";
};

// ———————————————————————————————————————
// Utilities

function safeNum(n: any, def: number | null = null): number | null {
  const v = Number(n);
  return Number.isFinite(v) ? v : def;
}

function pickFirst<T>(arr: T[] | undefined | null): T | null {
  return Array.isArray(arr) && arr.length ? (arr[0] as T) : null;
}

// ———————————————————————————————————————
// Spoonacular

const SPOONACULAR_KEY = process.env.SPOONACULAR_API_KEY || "";

export async function fetchSpoonacularRecipes(query: RecipesQuery): Promise<NormalizedRecipe[]> {
  if (!SPOONACULAR_KEY) return [];

  const params = new URLSearchParams();
  params.set("apiKey", SPOONACULAR_KEY);
  params.set("number", String(query.pageSize ?? 24));
  if (query.offset) params.set("offset", String(query.offset));
  if (query.q) params.set("query", query.q);
  if (query.maxReadyMinutes) params.set("maxReadyTime", String(query.maxReadyMinutes));
  if (query.cuisines?.length) params.set("cuisine", query.cuisines.join(","));
  if (query.diets?.length) params.set("diet", query.diets.join(","));
  if (query.mealTypes?.length) params.set("type", query.mealTypes.join(","));

  // 1) search
  const searchUrl = `https://api.spoonacular.com/recipes/complexSearch?${params.toString()}&addRecipeInformation=true`;
  const res = await fetch(searchUrl);
  if (!res.ok) return [];
  const json: any = await res.json();
  const results: any[] = json?.results || [];

  // 2) normalize
  return results.map((r) => {
    const cuisines = Array.isArray(r.cuisines) ? r.cuisines : [];
    const dishTypes = Array.isArray(r.dishTypes) ? r.dishTypes : [];
    const diets = Array.isArray(r.diets) ? r.diets : [];

    // Spoonacular returns a short summary and an array of extendedIngredients:
    const ing = Array.isArray(r.extendedIngredients)
      ? r.extendedIngredients.map((x: any) =>
          [x.amount, x.unit, x.nameClean || x.name].filter(Boolean).join(" ").trim()
        )
      : [];

    // Instructions can be in analyzedInstructions
    let steps: string[] = [];
    if (Array.isArray(r.analyzedInstructions) && r.analyzedInstructions[0]?.steps) {
      steps = r.analyzedInstructions[0].steps.map((s: any) => s.step);
    } else if (r.instructions) {
      steps = [String(r.instructions)];
    }

    return {
      id: String(r.id),
      title: String(r.title || "Untitled"),
      imageUrl: r.image || null,
      author: r.sourceName || null,
      createdAt: new Date().toISOString(),
      readyInMinutes: safeNum(r.readyInMinutes),
      servings: safeNum(r.servings),
      difficulty: null,
      cuisine: cuisines,
      mealType: dishTypes,
      ingredients: ing,
      instructions: steps,
      ratingSpoons: safeNum(r.spoonacularScore, null) ? Math.round((r.spoonacularScore / 100) * 5) : null,
      diets,
      source: "spoonacular" as const
    };
  });
}

// ———————————————————————————————————————
// Edamam

const EDAMAM_APP_ID = process.env.EDAMAM_APP_ID || "";
const EDAMAM_APP_KEY = process.env.EDAMAM_APP_KEY || "";

export async function fetchEdamamRecipes(query: RecipesQuery): Promise<NormalizedRecipe[]> {
  if (!EDAMAM_APP_ID || !EDAMAM_APP_KEY) return [];

  const params = new URLSearchParams();
  params.set("type", "public");
  params.set("app_id", EDAMAM_APP_ID);
  params.set("app_key", EDAMAM_APP_KEY);
  params.set("imageSize", "REGULAR");
  params.set("random", "false");
  params.set("field", "label");
  params.set("field", "image");
  params.append("field", "totalTime");
  params.append("field", "yield");
  params.append("field", "cuisineType");
  params.append("field", "mealType");
  params.append("field", "ingredientLines");
  params.append("field", "ingredients");
  params.append("field", "healthLabels");
  params.append("field", "dietLabels");

  if (query.q) params.set("q", query.q);
  if (query.pageSize) params.set("imageSize", "REGULAR");
  if (query.maxReadyMinutes) params.set("time", `1-${query.maxReadyMinutes}`);
  if (query.cuisines?.length) params.set("cuisineType", query.cuisines.join(","));
  if (query.mealTypes?.length) params.set("mealType", query.mealTypes.join(","));
  // diets map loosely to dietLabels/healthLabels; we pass q for now.

  const url = `https://api.edamam.com/api/recipes/v2?${params.toString()}`;
  const res = await fetch(url);
  if (!res.ok) return [];

  const json: any = await res.json();
  const hits: any[] = json?.hits || [];

  return hits.map((h) => {
    const r = h.recipe || {};
    const cuisines = Array.isArray(r.cuisineType) ? r.cuisineType : [];
    const mealType = Array.isArray(r.mealType) ? r.mealType : [];
    const diets = [
      ...(Array.isArray(r.dietLabels) ? r.dietLabels : []),
      ...(Array.isArray(r.healthLabels) ? r.healthLabels : []),
    ];

    const ingredients: string[] = Array.isArray(r.ingredientLines) ? r.ingredientLines : [];

    return {
      id: String(r.uri || r.label || Math.random().toString(36).slice(2)),
      title: String(r.label || "Untitled"),
      imageUrl: r.image || null,
      author: pickFirst((r?.source && [r.source]) || null),
      createdAt: new Date().toISOString(),
      readyInMinutes: safeNum(r.totalTime),
      servings: safeNum(r.yield),
      difficulty: null,
      cuisine: cuisines,
      mealType,
      ingredients,
      instructions: [], // Edamam often lacks full instruction steps in API
      ratingSpoons: null,
      diets,
      source: "edamam" as const
    };
  });
}

// ———————————————————————————————————————
// Merge helpers

export function mergeDedupRecipes(...lists: NormalizedRecipe[][]): NormalizedRecipe[] {
  const map = new Map<string, NormalizedRecipe>();
  for (const list of lists) {
    for (const r of list) {
      if (!map.has(r.id)) map.set(r.id, r);
    }
  }
  return Array.from(map.values());
}
