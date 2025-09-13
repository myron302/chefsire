import { useEffect, useMemo, useRef } from "react";
import { useRecipesFilters } from "@/pages/recipes/useRecipesFilters";

/**
 * Sync the Recipes filters with the URL query string and vice-versa.
 * - On first mount, it reads existing ?params and applies them to the filter state.
 * - Whenever filters change, it updates the URL (using replaceState; no nav).
 *
 * Keys synced (comma-separated lists where appropriate):
 *   cuisines, ethnicities, diets, mealTypes, allergens,
 *   difficulty, maxCookTime, minSpoons, sortBy, onlyRecipes
 */
export default function useUrlFilterSync() {
  const { state, set } = useRecipesFilters();

  // parse once on mount
  const initialParams = useMemo(() => {
    try {
      return new URLSearchParams(window.location.search);
    } catch {
      return new URLSearchParams();
    }
  }, []);

  const didHydrateFromUrl = useRef(false);

  // ---- 1) Hydrate filters from URL on first mount
  useEffect(() => {
    if (didHydrateFromUrl.current) return;

    const readList = (key: string): string[] => {
      const v = initialParams.get(key);
      if (!v) return [];
      return v
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
    };

    const readBool = (key: string): boolean => {
      const v = initialParams.get(key);
      if (!v) return false;
      return v === "1" || v.toLowerCase() === "true";
    };

    const readNum = (key: string): number | null => {
      const v = initialParams.get(key);
      if (v == null) return null;
      const n = Number(v);
      return Number.isFinite(n) ? n : null;
    };

    const next: Partial<typeof state> = {};

    const cuisines = readList("cuisines");
    if (cuisines.length) next.cuisines = cuisines;

    const ethnicities = readList("ethnicities");
    if (ethnicities.length) next.ethnicities = ethnicities;

    const dietary = readList("diets");
    if (dietary.length) next.dietary = dietary;

    const mealTypes = readList("mealTypes");
    if (mealTypes.length) next.mealTypes = mealTypes as any;

    const allergens = readList("allergens");
    if (allergens.length) next.allergens = allergens;

    const difficulty = initialParams.get("difficulty");
    if (difficulty) next.difficulty = difficulty as any;

    const maxCookTime = readNum("maxCookTime");
    if (maxCookTime !== null) next.maxCookTime = maxCookTime;

    const minSpoons = readNum("minSpoons");
    if (minSpoons !== null) next.minSpoons = minSpoons;

    const sortBy = initialParams.get("sortBy");
    if (sortBy) next.sortBy = sortBy as any;

    const onlyRecipes = readBool("onlyRecipes");
    if (initialParams.has("onlyRecipes")) next.onlyRecipes = onlyRecipes;

    if (Object.keys(next).length > 0) {
      set(next as any);
    }

    didHydrateFromUrl.current = true;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ---- 2) Push filter changes back into the URL
  useEffect(() => {
    if (!didHydrateFromUrl.current) return; // avoid overriding before first read

    const sp = new URLSearchParams(window.location.search);

    const writeList = (key: string, arr: string[]) => {
      if (arr && arr.length) sp.set(key, arr.join(","));
      else sp.delete(key);
    };

    writeList("cuisines", state.cuisines);
    writeList("ethnicities", state.ethnicities);
    writeList("diets", state.dietary);
    writeList("mealTypes", state.mealTypes as string[]);
    writeList("allergens", state.allergens);

    if (state.difficulty) sp.set("difficulty", state.difficulty);
    else sp.delete("difficulty");

    if (Number.isFinite(state.maxCookTime)) sp.set("maxCookTime", String(state.maxCookTime));
    else sp.delete("maxCookTime");

    if (Number.isFinite(state.minSpoons) && state.minSpoons > 0)
      sp.set("minSpoons", String(state.minSpoons));
    else sp.delete("minSpoons");

    if (state.sortBy) sp.set("sortBy", state.sortBy);
    else sp.delete("sortBy");

    if (state.onlyRecipes) sp.set("onlyRecipes", "1");
    else sp.delete("onlyRecipes");

    const newQuery = sp.toString();
    const nextUrl = `${window.location.pathname}${newQuery ? `?${newQuery}` : ""}`;
    if (nextUrl !== `${window.location.pathname}${window.location.search}`) {
      window.history.replaceState({}, "", nextUrl);
    }
  }, [state]);
}
