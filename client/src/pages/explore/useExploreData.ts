import { useInfiniteQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { useExploreFilters } from "./useExploreFilters";

export type ExplorePost = {
  id: string;
  title: string;
  image: string;
  cuisine: string;
  isRecipe: boolean;
  author: string;
  cookTime: number;
  difficulty: "Easy" | "Medium" | "Hard";
  rating: number;               // spoons (0..5)
  likes: number;
  mealType: "Breakfast" | "Lunch" | "Dinner" | "Snack" | "Dessert";
  dietary: string[];
  ethnicity?: string[];
  allergens?: string[];
  preparation?: string[];        // Halal/Kosher/Jain, etc.
  createdAt: string;             // ISO date
};

type Page = { items: ExplorePost[]; nextCursor?: string | null; total?: number };

const LIMIT = 24;

export function useExploreData() {
  const {
    // filters from state
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
    // Custom queryFn so we can append all filters + pagination to the URL
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
      if (!res.ok) {
        const text = (await res.text()) || res.statusText;
        throw new Error(`${res.status}: ${text}`);
      }
      return res.json();
    },
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
    staleTime: 30_000,
    keepPreviousData: true,
  });

  const items = useMemo(
    () => query.data?.pages.flatMap((p) => p.items) ?? [],
    [query.data]
  );
  const total = query.data?.pages?.[0]?.total ?? items.length;

  return {
    ...query,
    items,
    total,
  };
}
