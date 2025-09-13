// client/src/hooks/useRecipesQuery.ts
import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useRecipesFilters } from "@/hooks/useRecipesFilters";

/** Match the server's NormalizedRecipe */
export type NormalizedRecipe = {
  id: string;
  title: string;
  image?: string | null;
  source: "local" | "spoonacular" | "edamam" | "unknown";
  url?: string | null;
  cookTime?: number | null;
  servings?: number | null;
  cuisine?: string | null;
  dietTags?: string[];
  mealType?: string | null;
  ingredients?: string[];
  instructions?: string[];
  ratingSpoons?: number | null;
  likes?: number;
  comments?: number;
};

/** Server response shape from /api/recipes/search */
export type RecipesSearchResponse = {
  results: NormalizedRecipe[];
  total: number;
  source: "all" | "external" | "local";
};

export type UseRecipesQueryOptions = {
  /** 1-based page number for pagination UI; converted to offset internally */
  page?: number;
  /** page size (server allows 1–50, default 24) */
  pageSize?: number;
  /** optional free-text search term */
  search?: string;
  /** restrict the source if desired */
  source?: "all" | "external" | "local";
  /** allow parent to toggle off while mounting */
  enabled?: boolean;
};

function buildQueryString(opts: {
  search?: string;
  cuisines: string[];
  diets: string[];
  mealTypes: string[];
  maxReadyMinutes?: number;
  page?: number;
  pageSize?: number;
  source?: "all" | "external" | "local";
}) {
  const {
    search,
    cuisines,
    diets,
    mealTypes,
    maxReadyMinutes,
    page = 1,
    pageSize = 24,
    source = "all",
  } = opts;

  const offset = Math.max(0, (page - 1) * pageSize);

  const params = new URLSearchParams();

  if (search && search.trim()) params.set("q", search.trim());

  if (cuisines.length) params.set("cuisines", cuisines.join(","));
  if (diets.length) params.set("diets", diets.join(","));
  if (mealTypes.length) params.set("mealTypes", mealTypes.join(","));

  if (maxReadyMinutes && Number.isFinite(maxReadyMinutes)) {
    params.set("maxReadyMinutes", String(maxReadyMinutes));
  }

  params.set("pageSize", String(pageSize));
  params.set("offset", String(offset));
  params.set("source", source);

  return params.toString();
}

/**
 * Fetch recipes (local + external providers) based on current filters.
 * Relies on the global queryFn from queryClient, so we pass a full URL in queryKey[0].
 */
export function useRecipesQuery({
  page = 1,
  pageSize = 24,
  search,
  source = "all",
  enabled = true,
}: UseRecipesQueryOptions = {}) {
  const { state } = useRecipesFilters();

  // Map UI filters → API params
  const queryString = useMemo(() => {
    // We treat “dietary” as diets for the API; “ethnicities” are folded into cuisines for now
    const cuisines = Array.from(
      new Set([...(state.cuisines || []), ...(state.ethnicities || [])])
    );

    const diets = state.dietary || [];
    const mealTypes = state.mealTypes || [];
    const maxReadyMinutes =
      state.maxCookTime && state.maxCookTime > 0 ? state.maxCookTime : undefined;

    return buildQueryString({
      search,
      cuisines,
      diets,
      mealTypes,
      maxReadyMinutes,
      page,
      pageSize,
      source,
    });
  }, [
    search,
    source,
    page,
    pageSize,
    state.cuisines,
    state.ethnicities,
    state.dietary,
    state.mealTypes,
    state.maxCookTime,
  ]);

  // Important: your global queryFn expects the queryKey to be a single-string URL
  const url = `/api/recipes/search?${queryString}`;

  const query = useQuery<RecipesSearchResponse>({
    queryKey: [url], // uses your global getQueryFn -> fetch(url).json()
    enabled,
    // you can select/transform if needed:
    // select: (data) => data,
    staleTime: 1000 * 60 * 5, // 5 minutes cache for search results
  });

  return {
    ...query,
    url, // useful for debugging
    params: queryString,
  };
}
