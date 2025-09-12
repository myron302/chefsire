// client/src/pages/explore/useExploreData.ts
import { useInfiniteQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { useExploreFilters } from "./useExploreFilters";

/**
 * Toggle this to false when your backend endpoint is ready.
 * While true, we serve filtered/sorted DEMO posts through react-query.
 */
const USE_DEMO_DATA = true;

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

/* ---------------- Demo data (images + fields match your earlier samples) ---------------- */
const DEMO_POSTS: ExplorePost[] = [
  {
    id: "1",
    title: "Margherita Pizza",
    image: "https://images.unsplash.com/photo-1548365328-8b84986da7b3?q=80&w=1200&auto=format&fit=crop",
    cuisine: "Italian",
    isRecipe: true,
    author: "Giulia",
    cookTime: 25,
    difficulty: "Easy",
    rating: 4.7,
    likes: 223,
    mealType: "Dinner",
    dietary: ["Vegetarian"],
    createdAt: "2025-09-08T12:00:00Z",
  },
  {
    id: "2",
    title: "Rainbow Salad",
    image: "https://images.unsplash.com/photo-1490474418585-ba9bad8fd0ea?q=80&w=1200&auto=format&fit=crop",
    cuisine: "Healthy",
    isRecipe: false,
    author: "Ava",
    cookTime: 10,
    difficulty: "Easy",
    rating: 4.2,
    likes: 150,
    mealType: "Lunch",
    dietary: ["Vegan", "Gluten-Free"],
    createdAt: "2025-09-07T10:00:00Z",
  },
  {
    id: "3",
    title: "Choco Truffles",
    image: "https://images.unsplash.com/photo-1541781286675-09c7e9d404bc?q=80&w=1200&auto=format&fit=crop",
    cuisine: "Desserts",
    isRecipe: true,
    author: "Noah",
    cookTime: 45,
    difficulty: "Medium",
    rating: 4.9,
    likes: 512,
    mealType: "Dessert",
    dietary: ["Vegetarian"],
    createdAt: "2025-09-05T18:30:00Z",
  },
  {
    id: "4",
    title: "Spicy Ramen",
    image: "https://images.unsplash.com/photo-1546549039-49cc4f5b3c89?q=80&w=1200&auto=format&fit=crop",
    cuisine: "Asian",
    isRecipe: true,
    author: "Rin",
    cookTime: 30,
    difficulty: "Medium",
    rating: 4.5,
    likes: 340,
    mealType: "Dinner",
    dietary: [],
    createdAt: "2025-09-03T21:15:00Z",
  },
  {
    id: "5",
    title: "BBQ Brisket",
    image: "https://images.unsplash.com/photo-1544025162-d76694265947?q=80&w=1200&auto=format&fit=crop",
    cuisine: "BBQ",
    isRecipe: false,
    author: "Mason",
    cookTime: 240,
    difficulty: "Hard",
    rating: 4.1,
    likes: 98,
    mealType: "Dinner",
    dietary: [],
    createdAt: "2025-09-09T14:45:00Z",
  },
  {
    id: "6",
    title: "Avocado Toast",
    image: "https://images.unsplash.com/photo-1504754524776-8f4f37790ca0?q=80&w=1200&auto=format&fit=crop",
    cuisine: "Breakfast",
    isRecipe: true,
    author: "Ivy",
    cookTime: 8,
    difficulty: "Easy",
    rating: 4.0,
    likes: 77,
    mealType: "Breakfast",
    dietary: ["Vegetarian"],
    createdAt: "2025-09-10T08:05:00Z",
  },
];

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
      // DEMO MODE: build paginated results fully on the client
      if (USE_DEMO_DATA) {
        const filtered = applyClientFilters(DEMO_POSTS, f);
        const page = typeof pageParam === "number" ? pageParam : 0;
        const start = page * LIMIT;
        const end = start + LIMIT;
        const items = filtered.slice(start, end);
        const nextCursor = end < filtered.length ? page + 1 : null;
        return { items, nextCursor, total: filtered.length };
      }

      // API MODE
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

      try {
        const page = await fetchServerPage(params);
        // If server returns nothing, transparently fall back to client demo so UI still shows content
        if (!page.items.length) {
          const filtered = applyClientFilters(DEMO_POSTS, f);
          return { items: filtered.slice(0, LIMIT), nextCursor: null, total: filtered.length };
        }
        return page;
      } catch (e) {
        // On any error, fall back to demo results (non-crashy)
        const filtered = applyClientFilters(DEMO_POSTS, f);
        return { items: filtered.slice(0, LIMIT), nextCursor: null, total: filtered.length };
      }
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
