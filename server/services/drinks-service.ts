// server/services/drinks-service.ts
// Drinks integration via TheCocktailDB (no API key required for the free tier).
// Node 18+ has global fetch; no need for node-fetch.

export type DrinkItem = {
  id: string;            // "cocktaildb:<idDrink>"
  sourceId: string;      // <idDrink>
  source: "cocktaildb";
  title: string;
  imageUrl?: string | null;
  instructions?: string | null;
  category?: string | null;
  alcoholic?: string | null; // "Alcoholic" | "Non_Alcoholic" | ...
  glass?: string | null;
  ingredients?: string[]; // "1 oz Gin", "1 oz Tonic", ...
};

export type DrinksSearchParams = {
  q?: string;
  ingredient?: string;
  category?: string;
  alcoholic?: string; // "Alcoholic" | "Non_Alcoholic"
  pageSize?: number;  // default 12
  offset?: number;    // default 0
};

// Helpers
const API = "https://www.thecocktaildb.com/api/json/v1/1";

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

function parseDrink(d: any): DrinkItem {
  const ingredients: string[] = [];
  for (let i = 1; i <= 15; i++) {
    const ing = d[`strIngredient${i}`];
    const meas = d[`strMeasure${i}`];
    if (ing && String(ing).trim() !== "") {
      const line = [meas, ing].filter(Boolean).join(" ").trim();
      ingredients.push(line);
    }
  }
  return {
    id: `cocktaildb:${d.idDrink}`,
    sourceId: String(d.idDrink),
    source: "cocktaildb",
    title: String(d.strDrink || "").trim(),
    imageUrl: d.strDrinkThumb || null,
    instructions: d.strInstructions || null,
    category: d.strCategory || null,
    alcoholic: d.strAlcoholic || null,
    glass: d.strGlass || null,
    ingredients,
  };
}

// Look up full details by ID (needed because some "filter" endpoints return partials)
export async function lookupDrink(sourceId: string): Promise<DrinkItem | null> {
  const r = await fetch(`${API}/lookup.php?i=${encodeURIComponent(sourceId)}`);
  const j = await r.json();
  const m = Array.isArray(j?.drinks) ? j.drinks[0] : null;
  return m ? parseDrink(m) : null;
}

// Random
export async function randomDrink(): Promise<DrinkItem | null> {
  const r = await fetch(`${API}/random.php`);
  const j = await r.json();
  const m = Array.isArray(j?.drinks) ? j.drinks[0] : null;
  return m ? parseDrink(m) : null;
}

// Meta lists to populate filters
export async function listMeta() {
  const [cats, glasses, alcoholics, ingredients] = await Promise.all([
    fetch(`${API}/list.php?c=list`).then(r => r.json()).then(j => (j?.drinks || []).map((x: any) => x.strCategory).filter(Boolean)),
    fetch(`${API}/list.php?g=list`).then(r => r.json()).then(j => (j?.drinks || []).map((x: any) => x.strGlass).filter(Boolean)),
    fetch(`${API}/list.php?a=list`).then(r => r.json()).then(j => (j?.drinks || []).map((x: any) => x.strAlcoholic).filter(Boolean)),
    fetch(`${API}/list.php?i=list`).then(r => r.json()).then(j => (j?.drinks || []).map((x: any) => x.strIngredient1).filter(Boolean)),
  ]);

  // Common friendly order: Alcoholic / Non_Alcoholic / Optional alcohol
  const alcoholicOrdered = Array.from(new Set(alcoholics)).sort((a, b) => {
    const rank = (s: string) =>
      s === "Alcoholic" ? 0 :
      s === "Non_Alcoholic" ? 1 :
      2;
    return rank(a) - rank(b) || a.localeCompare(b);
  });

  return {
    categories: Array.from(new Set(cats)).sort(),
    glasses: Array.from(new Set(glasses)).sort(),
    alcoholic: alcoholicOrdered,
    ingredients: Array.from(new Set(ingredients)).sort(),
  };
}

// Core search
export async function searchDrinks(
  params: DrinksSearchParams
): Promise<{ results: DrinkItem[]; total: number; params: DrinksSearchParams }> {
  const pageSize = clamp(params.pageSize ?? 12, 1, 30);
  const offset = Math.max(0, params.offset ?? 0);

  // Strategy (CocktailDB allows only one filter param at a time):
  // 1) If q (name search): search.php?s=...
  // 2) else if ingredient: filter.php?i=...
  // 3) else if category:   filter.php?c=...
  // 4) else if alcoholic:  filter.php?a=...
  // 5) else: return empty (or random list if you’d like)
  let list: any[] = [];
  let mode: "search" | "filter" | "none" = "none";
  let url = "";

  if (params.q && params.q.trim()) {
    mode = "search";
    url = `${API}/search.php?s=${encodeURIComponent(params.q.trim())}`;
  } else if (params.ingredient && params.ingredient.trim()) {
    mode = "filter";
    url = `${API}/filter.php?i=${encodeURIComponent(params.ingredient.trim())}`;
  } else if (params.category && params.category.trim()) {
    mode = "filter";
    url = `${API}/filter.php?c=${encodeURIComponent(params.category.trim())}`;
  } else if (params.alcoholic && params.alcoholic.trim()) {
    mode = "filter";
    url = `${API}/filter.php?a=${encodeURIComponent(params.alcoholic.trim())}`;
  } else {
    return { results: [], total: 0, params };
  }

  const r = await fetch(url);
  const j = await r.json();
  list = Array.isArray(j?.drinks) ? j.drinks : [];

  // When mode=search, results already contain full objects (with instructions).
  if (mode === "search") {
    const sliced = list.slice(offset, offset + pageSize).map(parseDrink);
    return { results: sliced, total: list.length, params };
  }

  // When mode=filter, the API returns partials => lookup each id for full details.
  const slice = list.slice(offset, offset + pageSize);
  const details = await Promise.all(
    slice.map((x: any) => lookupDrink(String(x.idDrink)).catch(() => null))
  );
  const results = details.filter(Boolean) as DrinkItem[];
  return { results, total: list.length, params };
}
