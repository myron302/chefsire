// client/src/pages/recipes/useRecipesData.ts
import { useEffect, useMemo, useState } from "react";
import { useRecipesFilters } from "./useRecipesFilters";

export type RecipeCardData = {
  id: string;
  title: string;
  image: string | null;
  author?: string | null;
  cookTime?: number | null;
  servings?: number | null;
  cuisine?: string | null;
  dietTags?: string[];
  mealType?: string | null;
  ratingSpoons?: number | null; // 0–5
};

type ApiResponse = {
  results: Array<{
    id: string;
    title: string;
    image: string | null;
    author?: string | null;
    readyInMinutes?: number | null;
    servings?: number | null;
    cuisines?: string[];
    diets?: string[];
    mealType?: string | null;
    rating?: number | null;
  }>;
  total: number;
  source: "all" | "external" | "local";
};

export function useRecipesData() {
  const { state } = useRecipesFilters();
  const [recipes, setRecipes] = useState<RecipeCardData[]>([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const qs = useMemo(() => {
    const params = new URLSearchParams();

    // Optional free-text search (you may add an input later)
    if (state.search && state.search.trim()) {
      params.set("q", state.search.trim());
    }

    // We’ll send cuisines & diets as CSV (server expects CSV)
    if (state.cuisines.length) {
      params.set("cuisines", state.cuisines.join(","));
    }
    if (state.ethnicities.length) {
      // Ethnicities map server-side to cuisines; for now we include directly
      // so your server adapters can translate them if needed.
      const combined = [...state.cuisines, ...state.ethnicities];
      params.set("cuisines", Array.from(new Set(combined)).join(","));
    }

    if (state.dietary.length) {
      params.set("diets", state.dietary.join(","));
    }

    if (state.mealTypes.length) {
      params.set("mealTypes", state.mealTypes.join(","));
    }

    if (state.maxCookTime) {
      params.set("maxReadyMinutes", String(state.maxCookTime));
    }

    params.set("pageSize", "24");
    params.set("offset", "0");
    params.set("source", "all"); // local + external

    return params.toString();
  }, [
    state.search,
    state.cuisines,
    state.ethnicities,
    state.dietary,
    state.mealTypes,
    state.maxCookTime,
  ]);

  useEffect(() => {
    let cancelled = false;
    async function run() {
      setLoading(true);
      setErr(null);
      try {
        const res = await fetch(`/api/recipes/search?${qs}`, {
          credentials: "include",
        });
        if (!res.ok) {
          const text = await res.text();
          throw new Error(text || `HTTP ${res.status}`);
        }
        const data: ApiResponse = await res.json();

        if (cancelled) return;

        const mapped: RecipeCardData[] = (data.results || []).map((r) => ({
          id: r.id,
          title: r.title,
          image: r.image || null,
          author: r.author || null,
          cookTime: r.readyInMinutes ?? null,
          servings: r.servings ?? null,
          cuisine: (r.cuisines && r.cuisines[0]) || null,
          dietTags: r.diets || [],
          mealType: r.mealType || null,
          ratingSpoons: r.rating ?? null,
        }));

        setRecipes(mapped);
      } catch (e: any) {
        if (!cancelled) setErr(e?.message || "Failed to load recipes");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    run();
    return () => {
      cancelled = true;
    };
  }, [qs]);

  return { recipes, loading, err };
}
