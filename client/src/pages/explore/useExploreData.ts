// client/src/pages/explore/useExploreData.ts
import { useInfiniteQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { useExploreFilters } from "./useExploreFilters";


export type ExplorePost = {
  id: string | number;
  title?: string;
  caption?: string;
  image?: string | null;
  imageUrl?: string | null; // backend variant
  photoUrl?: string | null; // backend variant
  cuisine?: string;
  category?: string; // backend variant
  isRecipe?: boolean;
  author?: string;
  user?: { displayName?: string; username?: string }; // backend variant
  cookTime?: number;
  rating?: number;
  likes?: number;
  difficulty?: "Easy" | "Medium" | "Hard" | string;
  mealType?: "Breakfast" | "Lunch" | "Dinner" | "Snack" | "Dessert" | string;
  dietary?: string[];
  createdAt?: string;
};

/* ---------------- Helpers ---------------- */
const LIMIT = 24;

function isPostLike(x: any): x is ExplorePost {
  return x && typeof x === "object" && ("id" in x);
}

// Apply the same client-side filtering logic you had earlier
function applyClientFilters(all: ExplorePost[], f: ReturnType<typeof useExploreFilters> & Record<string, any>) {
  const {
    onlyRecipes,
    selectedCuisines,
    selectedMealTypes,
    selectedDietary,
    selectedDifficulty,
    maxCookTime,
    minRating,
  } = f;

  const filtered = all.filter((p) => {
    // normalize fields for filtering
    const cuisine = p.cuisine ?? p.category;
    const meal = p.mealType;
    const diets = Array.isArray(p.dietary) ? p.dietary : [];

    if (onlyRecipes && !p.isRecipe) return false;
    if (selectedCuisines.length && (!cuisine || !selectedCuisines.includes(cuisine))) return false;
    if (selectedMealTypes.length && (!meal || !selectedMealTypes.includes(meal as any))) return false;
    if (selectedDietary.length && !selectedDietary.every((d: string) => diets.includes(d))) return false;
    if (selectedDifficulty && p.difficulty !== selectedDifficulty) return false;
    if (maxCookTime && typeof p.cookTime === "number" && p.cookTime > maxCookTime) return false;
    if (minRating && typeof p.rating === "number" && p.rating < minRating) return false;

    return true;
  });

  switch (f.sortBy) {
    case "rating":
      return [...filtered].sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0));
    case "likes":
      return [...filtered].sort((a, b) => (b.likes ?? 0) - (a.likes ?? 0));
    default:
      return [...filtered].sort(
        (a, b) =>
          new Date(b.createdAt ?? 0).getTime() - new Date(a.createdAt ?? 0).getTime()
      );
  }
}

/* ---------------- Hook ---------------- */
type Page = { items: ExplorePost[]; nextCursor?: number | null; total?: number };

// Choose which source to use inside the queryFn
async function fetchServerPage(params: URLSearchParams): Promise<Page> {
  const res = await fetch(`/api/posts/explore?${params.toString()}`, { credentials: "include" });
  if (!res.ok) {
    const text = (await res.text()) || res.statusText;
    throw new Error(`${res.status}: ${text}`);
  }
  const data = await res.json();
  // Expecting shape { items, nextCursor, total }; be defensive:
  const items = Array.isArray(data?.items) ? data.items.filter(isPostLike) : [];
  return { items, nextCursor: data?.nextCursor ?? null, total: data?.total ?? items.length };
}

export function useExploreData() {
  const f = useExploreFilters();

  const query = useInfiniteQuery<Page>({
    queryKey: [
      "explore-data",
      {
        // Put every filter knob here so the cache key updates properly
        onlyRecipes: f.onlyRecipes,
        sortBy: f.sortBy,
        selectedCuisines: f.selectedCuisines,
        selectedMealTypes: f.selectedMealTypes,
        selectedDietary: f.selectedDietary,
        selectedDifficulty: f.selectedDifficulty,
        maxCookTime: f.maxCookTime,
        minRating: f.minRating,
        selectedEthnicities: f.selectedEthnicities,
        excludedAllergens: f.excludedAllergens,
        selectedPreparation: f.selectedPreparation,
      },
    ],
    queryFn: async ({ pageParam }) => {
      const params = new URLSearchParams();
      params.set("limit", String(LIMIT));
      params.set("sort", f.sortBy);
      if (pageParam != null) params.set("cursor", String(pageParam));
      if (f.onlyRecipes) params.set("is_recipe", "1");
      if (f.selectedDifficulty) params.set("difficulty", f.selectedDifficulty);
      if (f.maxCookTime) params.set("max_cook", String(f.maxCookTime));
      if (f.minRating) params.set("min_rating", String(f.minRating));

      (f.selectedCuisines as string[]).forEach((v) => params.append("cuisine", v));
      (f.selectedMealTypes as string[]).forEach((v) => params.append("meal", v));
      (f.selectedDietary as string[]).forEach((v) => params.append("diet", v));
      (f.selectedEthnicities as string[]).forEach((v) => params.append("ethnicity", v));
      (f.excludedAllergens as string[]).forEach((v) => params.append("exclude_allergen", v));
      (f.selectedPreparation as string[]).forEach((v) => params.append("preparation", v));
      const page = await fetchServerPage(params);
      return {
        items: applyClientFilters(page.items, f),
        nextCursor: page.nextCursor,
        total: page.total ?? page.items.length,
      };
    },
    getNextPageParam: (last) => (last?.nextCursor ?? null) as any,
    staleTime: 30_000,
    keepPreviousData: true,
  });

  // Flatten pages safely
  const items = useMemo<ExplorePost[]>(
    () =>
      query.data?.pages?.flatMap((p) => (Array.isArray(p?.items) ? p.items : []))?.filter(isPostLike) ??
      [],
    [query.data]
  );

  const total = query.data?.pages?.[0]?.total ?? items.length;

  return {
    ...query,
    items,
    total,
  };
}
