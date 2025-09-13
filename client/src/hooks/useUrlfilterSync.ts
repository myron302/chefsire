import * as React from "react";
import { useRecipesFilters } from "@/hooks/useRecipesFilters";
import useDebouncedValue from "@/hooks/useDebouncedValue";

export type RecipeCardData = {
  id: string;
  title: string;
  image?: string | null;
  cookTime?: number | null;
  servings?: number | null;
  cuisine?: string | null;
  mealType?: string | null;
  ratingSpoons?: number | null; // 0–5
  dietTags?: string[];
};

type ApiRecipe = {
  id: string | number;
  title: string;
  image?: string;
  readyInMinutes?: number;
  totalTime?: number;
  servings?: number;
  cuisine?: string;
  mealType?: string;
  rating?: number;
  diets?: string[];
  tags?: string[];
};

export function useRecipesData() {
  const { state } = useRecipesFilters();

  // ✅ debounce only the free-text search
  // (if you don’t have `search` in your filter state yet, add: search: "" in defaultState)
  const debouncedSearch = useDebouncedValue(state.search ?? "", 350);

  const [recipes, setRecipes] = React.useState<RecipeCardData[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [err, setErr] = React.useState<string | null>(null);

  React.useEffect(() => {
    let cancelled = false;

    async function run() {
      setLoading(true);
      setErr(null);

      // Build query params (only include non-empty filters)
      const params = new URLSearchParams();
      if (debouncedSearch) params.set("q", debouncedSearch);

      if ((state.cuisines || []).length)
        params.set("cuisines", state.cuisines.join(","));
      if ((state.dietary || []).length)
        params.set("diets", state.dietary.join(","));
      if ((state.mealTypes || []).length)
        params.set("mealTypes", state.mealTypes.join(","));
      if (state.maxCookTime && Number.isFinite(state.maxCookTime))
        params.set("maxReadyMinutes", String(state.maxCookTime));

      // pull from both local + external
      params.set("source", "all");
      params.set("pageSize", "24");
      params.set("offset", "0");

      try {
        const res = await fetch(`/api/recipes/search?${params.toString()}`, {
          credentials: "include",
        });
        if (!res.ok) {
          const text = await res.text();
          throw new Error(text || `HTTP ${res.status}`);
        }
        const json = await res.json();

        if (cancelled) return;

        const list: RecipeCardData[] = (json.results || []).map((r: ApiRecipe) => ({
          id: String(r.id),
          title: r.title,
          image: r.image ?? null,
          cookTime:
            typeof r.readyInMinutes === "number"
              ? r.readyInMinutes
              : (r.totalTime as number | undefined) ?? null,
          servings: r.servings ?? null,
          cuisine: r.cuisine ?? null,
          mealType: r.mealType ?? null,
          ratingSpoons:
            typeof r.rating === "number" ? r.rating : null,
          dietTags: (r.diets || r.tags || []).map((t) => String(t)),
        }));

        setRecipes(list);
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
  }, [
    debouncedSearch,
    state.cuisines,
    state.dietary,
    state.mealTypes,
    state.maxCookTime,
    // you can add more deps when you start sending them to the API
  ]);

  return { recipes, loading, err };
}
