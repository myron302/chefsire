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
  rating: number;
  likes: number;
  mealType: "Breakfast" | "Lunch" | "Dinner" | "Snack" | "Dessert";
  dietary: string[];
  ethnicity?: string[];
  allergens?: string[];
  preparation?: string[]; // Halal/Kosher/Jain, etc.
  createdAt: string;
};

type Page = { items: ExplorePost[]; nextCursor?: string | null; total?: number };

const LIMIT = 24;

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
      "/api/posts/explore",
      {
        limit: LIMIT,
        sort: sortBy,
        onlyRecipes,
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
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
    staleTime: 30_000, // can override per-query if needed
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
