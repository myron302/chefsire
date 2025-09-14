// server/services/recipes-providers.ts
export type NormalizedRecipe = {
  id: string;
  title: string;
  image?: string;
  readyInMinutes?: number | null;
  servings?: number | null;
  source?: "spoonacular" | "edamam";
  diets?: string[];
  cuisines?: string[];
  mealTypes?: string[];
  rating?: number | null;
  url?: string;
};

type SearchReq = {
  q?: string;
  cuisines?: string[];
  diets?: string[];
  mealTypes?: string[];
  maxReadyMinutes?: number;
  pageSize?: number;
  offset?: number;
};

const SPOON_KEY = process.env.SPOONACULAR_API_KEY || "";
const EDAMAM_APP_ID = process.env.EDAMAM_APP_ID || "";
const EDAMAM_APP_KEY = process.env.EDAMAM_APP_KEY || "";

export async function fetchSpoonacularRecipes(req: SearchReq): Promise<NormalizedRecipe[]> {
  if (!SPOON_KEY) return [];

  const params = new URLSearchParams();
  if (req.q) params.set("query", req.q);
  if (req.cuisines?.length) params.set("cuisine", req.cuisines.join(","));
  if (req.diets?.length) params.set("diet", req.diets.join(","));
  if (req.maxReadyMinutes) params.set("maxReadyTime", String(req.maxReadyMinutes));
  params.set("number", String(req.pageSize || 24));
  params.set("offset", String(req.offset || 0));
  params.set("addRecipeInformation", "true");
  params.set("apiKey", SPOON_KEY);

  const url = `https://api.spoonacular.com/recipes/complexSearch?${params.toString()}`;
  const r = await fetch(url);
  if (!r.ok) return [];

  const json = await r.json();
  const results = Array.isArray(json.results) ? json.results : [];
  return results.map((it: any) => ({
    id: String(it.id),
    title: it.title,
    image: it.image,
    readyInMinutes: it.readyInMinutes ?? null,
    servings: it.servings ?? null,
    source: "spoonacular",
    diets: (it.diets || []).map((x: string) => x.toLowerCase()),
    cuisines: (it.cuisines || []).map((x: string) => x.toLowerCase()),
    mealTypes: (it.dishTypes || []).map((x: string) => x.toLowerCase()),
    rating: it.spoonacularScore ?? null,
    url: it.sourceUrl || it.spoonacularSourceUrl,
  }));
}

export async function fetchEdamamRecipes(req: SearchReq): Promise<NormalizedRecipe[]> {
  if (!EDAMAM_APP_ID || !EDAMAM_APP_KEY) return [];

  const params = new URLSearchParams();
  params.set("type", "public");
  params.set("app_id", EDAMAM_APP_ID);
  params.set("app_key", EDAMAM_APP_KEY);
  params.set("q", req.q || "recipe");
  if (req.diets?.length) {
    // Edamam "health" filters roughly map here; you can adjust mapping later
    req.diets.forEach((d) => params.append("health", d.toLowerCase()));
  }
  if (req.maxReadyMinutes) params.set("time", `1-${req.maxReadyMinutes}`);
  const from = req.offset || 0;
  const to = from + (req.pageSize || 24);
  params.set("from", String(from));
  params.set("to", String(to));

  const url = `https://api.edamam.com/api/recipes/v2?${params.toString()}`;
  const r = await fetch(url);
  if (!r.ok) return [];

  const json = await r.json();
  const hits = Array.isArray(json.hits) ? json.hits : [];
  return hits.map((h: any) => {
    const rec = h.recipe || {};
    const id = rec.uri ? String(rec.uri).split("#recipe_").pop() : String(Math.random());
    return {
      id: id,
      title: rec.label,
      image: rec.image,
      readyInMinutes: rec.totalTime || null,
      servings: rec.yield || null,
      source: "edamam" as const,
      diets: (rec.dietLabels || []).map((x: string) => x.toLowerCase()),
      cuisines: (rec.cuisineType || []).map((x: string) => x.toLowerCase()),
      mealTypes: (rec.mealType || []).map((x: string) => x.toLowerCase()),
      rating: null,
      url: rec.url,
    };
  });
}

export function mergeDedupRecipes(a: NormalizedRecipe[], b: NormalizedRecipe[]): NormalizedRecipe[] {
  const map = new Map<string, NormalizedRecipe>();
  const push = (list: NormalizedRecipe[]) => {
    for (const r of list) {
      if (!map.has(r.id)) map.set(r.id, r);
    }
  };
  push(a);
  push(b);
  return Array.from(map.values());
}
