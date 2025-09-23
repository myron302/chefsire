// server/services/recipes-service.ts
import { storage } from "../storage";
import {
  fetchSpoonacularRecipes,
  fetchEdamamRecipes,
  mergeDedupRecipes,
} from "./recipes-providers";

export type RecipeSource = "all" | "external" | "local";

export interface SearchParams {
  q?: string;
  cuisines?: string[];
  diets?: string[];
  mealTypes?: string[];
  maxReadyMinutes?: number;
  pageSize?: number;
  offset?: number;
  source?: RecipeSource;
}

/**
 * Unified recipe search across local DB + external providers.
 * Returns { results, total, source } — results are de-duplicated.
 */
export async function searchRecipes(params: SearchParams) {
  const {
    q,
    cuisines = [],
    diets = [],
    mealTypes = [],
    maxReadyMinutes,
    pageSize = 24,
    offset = 0,
    source = "all",
  } = params || {};

  const rq = { q, cuisines, diets, mealTypes, maxReadyMinutes, pageSize, offset };

  // External providers
  let external: any[] = [];
  if (source === "all" || source === "external") {
    const [spoon, edam] = await Promise.all([
      fetchSpoonacularRecipes(rq).catch(() => []),
      fetchEdamamRecipes(rq).catch(() => []),
    ]);
    external = mergeDedupRecipes(spoon, edam);
  }

  // Local DB
  let local: any[] = [];
  if (source === "all" || source === "local") {
    try {
      local = await storage.searchLocalRecipes({
        q,
        cuisines,
        diets,
        mealTypes,
        pageSize,
        offset,
      });
    } catch {
      local = [];
    }
  }

  const combined =
    source === "external"
      ? external
      : source === "local"
      ? local
      : mergeDedupRecipes(local, external);

  return {
    results: combined,
    total: combined.length,
    source,
  };
}
