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
        
        // Debug log raw API response for troubleshooting
        console.log("Raw API response:", json);

        // Ensure json.results is an array
        if (!json || !Array.isArray(json.results)) {
          console.warn("API response does not contain a valid results array:", json);
          if (!cancelled) setRecipes([]);
          return;
        }

        // Normalize results to our card shape with error handling
        const normalized = (json.results || []).map((r) => {
          try {
            return normalizeApiRecipe(r);
          } catch (err) {
            console.error("Error normalizing recipe:", r, err);
            // Return a basic fallback recipe to avoid breaking the entire list
            return {
              id: String(r?.id || Math.random().toString(36).slice(2)),
              isRecipe: true,
              createdAt: new Date().toISOString(),
              image: null,
              user: { displayName: "Unknown" },
              likes: 0,
              comments: 0,
              recipe: {
                title: r?.title || "Untitled Recipe",
                cookTime: null,
                servings: null,
                difficulty: "",
                cuisine: null,
                mealType: null,
                ingredients: [],
                instructions: [],
                ratingSpoons: null,
                dietTags: [],
                allergens: [],
                ethnicities: [],
              },
            };
          }
        });

        // Client-side enforcement for allergens/Halal/Kosher/etc.
        const afterRules = normalized.filter((r) => passesLocalRules(r, state));

        // Map to RecipeCardData for the UI grid with error handling
        let cards: RecipeCardData[] = afterRules.map((r) => {
          try {
            return {
              id: r.id,
              title: r.recipe?.title ?? r.title ?? "Untitled",
              image: r.image || r.recipe?.image || (r as any).imageUrl || r.recipe?.imageUrl || null,
              cookTime: r.recipe?.cookTime ?? null,
              servings: r.recipe?.servings ?? null,
              cuisine: r.recipe?.cuisine ?? null,
              mealType: r.recipe?.mealType ?? null,
              dietTags: r.recipe?.dietTags ?? [],
              ratingSpoons: r.recipe?.ratingSpoons ?? null,
              likes: r.likes ?? 0,
              createdAt: r.createdAt ?? null,
            };
          } catch (err) {
            console.error("Error creating recipe card:", r, err);
            // Return a safe fallback card
            return {
              id: r?.id || Math.random().toString(36).slice(2),
              title: "Error loading recipe",
              image: null,
              cookTime: null,
              servings: null,
              cuisine: null,
              mealType: null,
              dietTags: [],
              ratingSpoons: null,
              likes: 0,
              createdAt: null,
            };
          }
        });

        // Debug log to print the full array of normalized recipe cards for troubleshooting
        console.log("=== RECIPE CARDS DEBUG INFO ===");
        console.log("Total normalized recipe cards:", cards.length);
        console.log("Full normalized recipe cards array (copy/paste for troubleshooting):");
        console.table(cards); // Better formatting for arrays
        console.log("JSON stringify for copy/paste:", JSON.stringify(cards, null, 2));

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

        // Final safety check to ensure cards is always an array
        if (!Array.isArray(cards)) {
          console.error("Cards is not an array after processing:", cards);
          cards = [];
        }

        if (!cancelled) setRecipes(cards);
      } catch (e: any) {
        if (!cancelled) {
          setErr(e?.message || "Failed to load recipes.");
          setRecipes([]); // Ensure recipes is always an array even on error
        }
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
