// pages/explore/useExploreData.ts
import { useInfiniteQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { useExploreFilters } from "./useExploreFilters";

export type ExplorePost = {
  id: string | number;
  title?: string;
  image?: string;
  cuisine?: string;
  isRecipe?: boolean;
  author?: string;
  cookTime?: number;
  difficulty?: "Easy" | "Medium" | "Hard" | string;
  rating?: number;
  likes?: number;
  mealType?: "Breakfast" | "Lunch" | "Dinner" | "Snack" | "Dessert" | string;
  dietary?: string[];
  ethnicity?: string[];
  allergens?: string[];
  preparation?: string[];
  createdAt?: string;
};

type Page = { items: unknown[]; nextCursor?: string | null; total?: number };

const LIMIT = 24;

function isPostLike(x: any): x is ExplorePost {
  return x && typeof x === "object" && ("id" in x);
}

export function useExploreData() {
  const {
    onlyRecipes,
    sortBy,
    selectedCuisines,
    selectedMealTypes,
    selectedDietary,
    selectedDifficulty,
    maxCookTime,
    minRating,
    selectedEthnicities,
    excludedAllergens,
    selectedPreparation,
  } = useExploreFilters();

  const query = useInfiniteQuery<Page>({
    queryKey: [
      "explore-data",
      {
        onlyRecipes,
        sortBy,
        selectedCuisines,
        selectedMealTypes,
        selectedDietary,
        selectedDifficulty,
        maxCookTime,
        minRating,
        selectedEthnicities,
        excludedAllergens,
        selectedPreparation,
      },
    ],
    queryFn: async ({ pageParam, queryKey }) => {
      const [, filters] = queryKey as [string, Record<string, any>];

      const params = new URLSearchParams();
      params.set("limit", String(LIMIT));
      params.set("sort", filters.sortBy);
      if (pageParam) params.set("cursor", String(pageParam));
      if (filters.onlyRecipes) params.set("is_recipe", "1");
      if (filters.selectedDifficulty) params.set("difficulty", filters.selectedDifficulty);
      if (filters.maxCookTime) params.set("max_cook", String(filters.maxCookTime));
      if (filters.minRating) params.set("min_rating", String(filters.minRating));

      (filters.selectedCuisines as string[]).forEach((v) => params.append("cuisine", v));
      (filters.selectedMealTypes as string[]).forEach((v) => params.append("meal", v));
      (filters.selectedDietary as string[]).forEach((v) => params.append("diet", v));
      (filters.selectedEthnicities as string[]).forEach((v) => params.append("ethnicity", v));
      (filters.excludedAllergens as string[]).forEach((v) => params.append("exclude_allergen", v));
      (filters.selectedPreparation as string[]).forEach((v) => params.append("preparation", v));

      const res = await fetch(`/api/posts/explore?${params.toString()}`, {
        credentials: "include",
      });

      // If backend returns 503/5xx, throw so the UI shows the error state
      if (!res.ok) {
        const text = (await res.text()) || res.statusText;
        throw new Error(`${res.status}: ${text}`);
      }

      return res.json();
    },
    getNextPageParam: (lastPage) => lastPage?.nextCursor ?? undefined,
    staleTime: 30_000,
    keepPreviousData: true,
  });

  const items = useMemo(() => {
    const flat = query.data?.pages?.flatMap((p) =>
      Array.isArray(p?.items) ? p.items : []
    ) ?? [];
    // Remove null/undefined and anything without an id
    return flat.filter(isPostLike);
  }, [query.data]);

  const total = query.data?.pages?.[0]?.total ?? items.length;

  return {
    ...query,
    items,
    total,
  };
}
