// client/src/hooks/useRecipesData.ts
import * as React from "react";
import { useRecipesFilters } from "@/hooks/useRecipesFilters";
import {
  buildApiQuery,
  normalizeApiRecipe,
  passesLocalRules,
} from "@/lib/recipesApiAdapter";

export type RecipeCardData = {
  id: string;
  title: string;
  image?: string | null;
  cookTime?: number | null;
  servings?: number | null;
  cuisine?: string | null;
  mealType?: string | null;
  dietTags: string[];
  ratingSpoons?: number | null;
  likes?: number;
  createdAt?: string;
};

type ApiSearchResponse = {
  results: any[];
  total: number;
  source: "all" | "local" | "external";
};

export function useRecipesData() {
  const { state } = useRecipesFilters();
  const [recipes, setRecipes] = React.useState<RecipeCardData[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [err, setErr] = React.useState<string | null>(null);

  React.useEffect(() => {
    let cancelled = false;

    async function run() {
      setLoading(true);
      setErr(null);
      try {
        // Build API-facing query from current filter state
        const q = buildApiQuery(state);

        // Compose URLSearchParams for the server route `/api/recipes/search`
        const params = new URLSearchParams();
        if (q.q) params.set("q", q.q);
        if (q.cuisines?.length) params.set("cuisines", q.cuisines.join(","));
        if (q.diets?.length) params.set("diets", q.diets.join(","));
        if (q.mealTypes?.length) params.set("mealTypes", q.mealTypes.join(","));
        if (typeof q.maxReadyMinutes === "number")
          params.set("maxReadyMinutes", String(q.maxReadyMinutes));
        params.set("pageSize", String(q.pageSize ?? 24));
        params.set("offset", "0");
        params.set("source", "all");

        const res = await fetch(`/api/recipes/search?${params.toString()}`, {
          credentials: "include",
        });

        if (!res.ok) {
          const text = await res.text();
          throw new Error(`${res.status}: ${text}`);
        }

        const json: ApiSearchResponse = await res.json();

        // Normalize results to our card shape
        const normalized = (json.results || []).map((r) => normalizeApiRecipe(r));

        // Client-side enforcement for allergens/Halal/Kosher/etc.
        const afterRules = normalized.filter((r) => passesLocalRules(r, state));

        // Map to RecipeCardData for the UI grid
        let cards: RecipeCardData[] = afterRules.map((r) => ({
          id: r.id,
          title: r.recipe?.title ?? r.title ?? "Untitled",
          image: r.image || r.recipe?.image || null,
          cookTime: r.recipe?.cookTime ?? null,
          servings: r.recipe?.servings ?? null,
          cuisine: r.recipe?.cuisine ?? null,
          mealType: r.recipe?.mealType ?? null,
          dietTags: r.recipe?.dietTags ?? [],
          ratingSpoons: r.recipe?.ratingSpoons ?? null,
          likes: r.likes ?? 0,
          createdAt: r.createdAt ?? null,
        }));

        // Quick client-side search (title/keywords) if user typed in the mini search
        const quick = (state as any).search?.trim().toLowerCase();
        if (quick) {
          cards = cards.filter((c) =>
            c.title.toLowerCase().includes(quick)
          );
        }

        // Difficulty filter (if the provider didn’t filter it server-side)
        if (state.difficulty) {
          // If you later add difficulty in API, you can remove this
          // (We don't currently have canonical difficulty in card, so skip or keep heuristic)
        }

        // Min spoon rating
        if (typeof state.minSpoons === "number" && state.minSpoons > 0) {
          cards = cards.filter(
            (c) => (c.ratingSpoons ?? 0) >= state.minSpoons
          );
        }

        // Sort
        if (state.sortBy === "rating") {
          cards = cards.sort(
            (a, b) => (b.ratingSpoons ?? 0) - (a.ratingSpoons ?? 0)
          );
        } else if (state.sortBy === "likes") {
          cards = cards.sort((a, b) => (b.likes ?? 0) - (a.likes ?? 0));
        } else {
          // newest
          cards = cards.sort(
            (a, b) =>
              new Date(b.createdAt || 0).getTime() -
              new Date(a.createdAt || 0).getTime()
          );
        }

        if (!cancelled) setRecipes(cards);
      } catch (e: any) {
        if (!cancelled) setErr(e?.message || "Failed to load recipes.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    run();
    return () => {
      cancelled = true;
    };
  }, [
    // Re-fetch whenever these change
    state.cuisines.join(","),
    state.ethnicities.join(","), // contributes to cuisines via buildApiQuery
    state.dietary.join(","),
    state.mealTypes.join(","),
    state.difficulty,
    state.allergens.join(","),
    state.maxCookTime,
    state.minSpoons,
    state.onlyRecipes,
    state.sortBy,
    (state as any).search ?? "",
  ]);

  return { recipes, loading, err };
}
