import React, { createContext, useContext, useMemo, useState } from "react";
import {
  CUISINES,
  DIETARY,
  MEAL_TYPES,
  ALLERGENS,
  ETHNICITY_REGIONS,
} from "./filters.catalog";

/** === TYPES === */
export type RecipesFiltersState = {
  /** free-text search (added so pages with a search box won’t break) */
  q: string;

  /** simple multi-selects */
  cuisines: string[];
  ethnicities: string[]; // store as "Region — Name" labels
  dietary: string[];     // Vegan, Vegetarian, Halal, Kosher, Gluten-Free, etc.
  allergens: string[];   // Dairy, Eggs, Tree Nuts, Sesame, etc.
  mealTypes: string[];   // Breakfast, Lunch, Dinner, Snack, Dessert...

  /** scalars */
  difficulty: "" | "easy" | "medium" | "hard";
  maxCookTime?: number | null;
  minSpoons?: number | null; // rating 0–5

  /** flags / sort */
  onlyRecipes: boolean;
  sortBy: "relevance" | "rating" | "time" | "newest" | "popularity";
};

export type RecipesFiltersContextType = {
  /** raw state + basic ops */
  state: RecipesFiltersState;
  setState: React.Dispatch<React.SetStateAction<RecipesFiltersState>>;
  reset: () => void;

  /** friendly toggles / setters */
  toggle: (
    key:
      | "cuisines"
      | "ethnicities"
      | "dietary"
      | "allergens"
      | "mealTypes",
    value: string
  ) => void;
  setQ: (q: string) => void;
  setDifficulty: (d: RecipesFiltersState["difficulty"]) => void;
  setMaxCookTime: (n: number | null | undefined) => void;
  setMinSpoons: (n: number | null | undefined) => void;
  setOnlyRecipes: (b: boolean) => void;
  setSortBy: (s: RecipesFiltersState["sortBy"]) => void;

  /** catalogs for UIs */
  catalogs: {
    CUISINES: string[];
    DIETARY: string[];
    MEAL_TYPES: readonly string[];
    ALLERGENS: string[];
    ETHNICITY_REGIONS: Record<string, string[]>;
    ETHNICITY_LABELS: string[]; // flattened "Region — Name"
  };

  /** build API params compatible with /api/recipes/search */
  getQueryParams: () => URLSearchParams;
};

const defaultState: RecipesFiltersState = {
  q: "",
  cuisines: [],
  ethnicities: [],
  dietary: [],
  allergens: [],
  mealTypes: [],
  difficulty: "",
  maxCookTime: null,
  minSpoons: null,
  onlyRecipes: true,
  sortBy: "relevance",
};

/** helpers */
function buildEthnicityLabels(): string[] {
  const labels: string[] = [];
  Object.entries(ETHNICITY_REGIONS || {}).forEach(([region, arr]) => {
    (arr || []).forEach((name) => labels.push(`${region} — ${name}`));
  });
  return labels;
}
function toggleIn(list: string[], value: string) {
  return list.includes(value) ? list.filter((x) => x !== value) : [...list, value];
}

/** === CONTEXT === */
const Ctx = createContext<RecipesFiltersContextType | undefined>(undefined);

export function RecipesFiltersProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<RecipesFiltersState>(defaultState);

  const ETHNICITY_LABELS = useMemo(buildEthnicityLabels, []);

  const value = useMemo<RecipesFiltersContextType>(() => {
    const toggle = (
      key:
        | "cuisines"
        | "ethnicities"
        | "dietary"
        | "allergens"
        | "mealTypes",
      value: string
    ) => {
      setState((prev) => ({
        ...prev,
        [key]: toggleIn(prev[key] as string[], value),
      }));
    };

    const getQueryParams = () => {
      const params = new URLSearchParams();

      if (state.q && state.q.trim()) params.set("q", state.q.trim());
      if (state.cuisines.length) params.set("cuisines", state.cuisines.join(","));
      if (state.ethnicities.length) params.set("ethnicities", state.ethnicities.join(","));
      if (state.dietary.length) params.set("diets", state.dietary.join(","));
      if (state.mealTypes.length) params.set("mealTypes", state.mealTypes.join(","));
      if (state.allergens.length) params.set("allergens", state.allergens.join(","));
      if (state.difficulty) params.set("difficulty", state.difficulty);
      if (state.maxCookTime != null) params.set("maxCookTime", String(state.maxCookTime));
      if (state.minSpoons != null) params.set("minSpoons", String(state.minSpoons));
      if (state.onlyRecipes) params.set("onlyRecipes", "1"); // default true; send flag for clarity
      if (state.sortBy) params.set("sortBy", state.sortBy);

      // sensible defaults for paging
      if (!params.has("pageSize")) params.set("pageSize", "24");
      if (!params.has("offset")) params.set("offset", "0");

      return params;
    };

    return {
      state,
      setState,
      reset: () => setState(defaultState),
      toggle,
      setQ: (q) => setState((s) => ({ ...s, q })),
      setDifficulty: (difficulty) => setState((s) => ({ ...s, difficulty })),
      setMaxCookTime: (maxCookTime) => setState((s) => ({ ...s, maxCookTime: maxCookTime ?? null })),
      setMinSpoons: (minSpoons) => setState((s) => ({ ...s, minSpoons: minSpoons ?? null })),
      setOnlyRecipes: (onlyRecipes) => setState((s) => ({ ...s, onlyRecipes })),
      setSortBy: (sortBy) => setState((s) => ({ ...s, sortBy })),
      catalogs: {
        CUISINES,
        DIETARY,
        MEAL_TYPES,
        ALLERGENS,
        ETHNICITY_REGIONS,
        ETHNICITY_LABELS,
      },
      getQueryParams,
    };
  }, [state]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

/**
 * Safe hook: instead of crashing, it logs a warning and provides a temporary
 * in-memory context so the page keeps rendering while wiring gets fixed.
 * This avoids a "white page" in production.
 */
export function useRecipesFilters(): RecipesFiltersContextType {
  const ctx = useContext(Ctx);
  if (ctx) return ctx;

  console.warn(
    "useRecipesFilters used outside of <RecipesFiltersProvider>. Supplying a temporary, local state to keep UI alive."
  );

  // Local, temporary fallback so UI doesn’t crash if provider is missing
  const [state, setState] = useState<RecipesFiltersState>(defaultState);
  const ETHNICITY_LABELS = useMemo(buildEthnicityLabels, []);

  return useMemo<RecipesFiltersContextType>(() => {
    const toggle = (
      key:
        | "cuisines"
        | "ethnicities"
        | "dietary"
        | "allergens"
        | "mealTypes",
      value: string
    ) => setState((prev) => ({ ...prev, [key]: toggleIn(prev[key] as string[], value) }));

    const getQueryParams = () => {
      const params = new URLSearchParams();
      if (state.q && state.q.trim()) params.set("q", state.q.trim());
      if (state.cuisines.length) params.set("cuisines", state.cuisines.join(","));
      if (state.ethnicities.length) params.set("ethnicities", state.ethnicities.join(","));
      if (state.dietary.length) params.set("diets", state.dietary.join(","));
      if (state.mealTypes.length) params.set("mealTypes", state.mealTypes.join(","));
      if (state.allergens.length) params.set("allergens", state.allergens.join(","));
      if (state.difficulty) params.set("difficulty", state.difficulty);
      if (state.maxCookTime != null) params.set("maxCookTime", String(state.maxCookTime));
      if (state.minSpoons != null) params.set("minSpoons", String(state.minSpoons));
      if (state.onlyRecipes) params.set("onlyRecipes", "1");
      if (state.sortBy) params.set("sortBy", state.sortBy);
      params.set("pageSize", "24");
      params.set("offset", "0");
      return params;
    };

    return {
      state,
      setState,
      reset: () => setState(defaultState),
      toggle,
      setQ: (q) => setState((s) => ({ ...s, q })),
      setDifficulty: (difficulty) => setState((s) => ({ ...s, difficulty })),
      setMaxCookTime: (maxCookTime) => setState((s) => ({ ...s, maxCookTime: maxCookTime ?? null })),
      setMinSpoons: (minSpoons) => setState((s) => ({ ...s, minSpoons: minSpoons ?? null })),
      setOnlyRecipes: (onlyRecipes) => setState((s) => ({ ...s, onlyRecipes })),
      setSortBy: (sortBy) => setState((s) => ({ ...s, sortBy })),
      catalogs: {
        CUISINES,
        DIETARY,
        MEAL_TYPES,
        ALLERGENS,
        ETHNICITY_REGIONS,
        ETHNICITY_LABELS,
      },
      getQueryParams,
    };
  }, [state]);
}
