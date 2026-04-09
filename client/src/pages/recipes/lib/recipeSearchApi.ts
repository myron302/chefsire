import type { ContentSourceFilter } from "@shared/content-source";
import type { SearchResponse } from "./recipeList.types";

export const DEFAULT_PAGE_SIZE = 24;

export type RecipeSearchFilters = {
  cuisines?: string[];
  ethnicities?: string[];
  dietary?: string[];
  mealTypes?: string[];
};

function parseSearchResponse(res: Response, json: SearchResponse) {
  if (!res.ok || !("ok" in json) || json.ok === false) {
    const msg = (json as any)?.error || `Request failed (${res.status})`;
    throw new Error(msg);
  }

  return json.items || [];
}

export function getSourceFilterFromUrlParam(sourceFromUrl: string | null): ContentSourceFilter {
  if (sourceFromUrl === "chefsire" || sourceFromUrl === "external" || sourceFromUrl === "all") {
    return sourceFromUrl;
  }
  return "all";
}

export function getQueryTermFromUrlSearch(urlSearch: string): string {
  const params = new URLSearchParams(urlSearch);
  const q = params.get("q")?.trim();
  if (q) return q;

  // compatibility fallback for older links/client state that used `search`
  const search = params.get("search")?.trim();
  return search || "";
}

export function hasRecipeSearchFilters(filters?: RecipeSearchFilters): boolean {
  if (!filters) return false;
  return !!(
    filters.cuisines?.length ||
    filters.ethnicities?.length ||
    filters.dietary?.length ||
    filters.mealTypes?.length
  );
}

export function applyRecipeSearchFilters(params: URLSearchParams, filters?: RecipeSearchFilters) {
  if (!filters) return;

  const cuisines = Array.from(
    new Set([...(filters.cuisines || []), ...(filters.ethnicities || [])].map((x) => x.trim()).filter(Boolean))
  );
  if (cuisines.length) params.set("cuisines", cuisines.join(","));

  const diets = (filters.dietary || []).map((x) => x.trim()).filter(Boolean);
  if (diets.length) params.set("diets", diets.join(","));

  const mealTypes = (filters.mealTypes || []).map((x) => x.trim()).filter(Boolean);
  if (mealTypes.length) params.set("mealTypes", mealTypes.join(","));
}

export async function fetchRandomRecipes({
  count = DEFAULT_PAGE_SIZE,
  source = "all",
}: {
  count?: number;
  source?: ContentSourceFilter;
}) {
  const params = new URLSearchParams();
  params.set("count", String(count));
  params.set("source", source);

  const res = await fetch(`/api/recipes/random?${params.toString()}`);
  const json = (await res.json()) as SearchResponse;
  return parseSearchResponse(res, json);
}

export async function fetchSearchRecipes({
  term,
  pageOffset,
  pageSize = DEFAULT_PAGE_SIZE,
  source = "all",
  filters,
}: {
  term: string;
  pageOffset: number;
  pageSize?: number;
  source?: ContentSourceFilter;
  filters?: RecipeSearchFilters;
}) {
  const params = new URLSearchParams();
  if (term.trim()) params.set("q", term.trim());
  params.set("pageSize", String(pageSize));
  params.set("offset", String(pageOffset));
  params.set("source", source);
  applyRecipeSearchFilters(params, filters);

  const res = await fetch(`/api/recipes/search?${params.toString()}`);
  const json = (await res.json()) as SearchResponse;
  return parseSearchResponse(res, json);
}
