import React, { createContext, useContext, useMemo, useState } from "react";

/** === TYPES === */
export type RecipesFiltersState = {
  cuisines: string[];
  ethnicities: string[];
  dietary: string[];        // Vegan, Vegetarian, Halal, Kosher, Gluten-Free, etc.
  allergens: string[];      // Dairy, Eggs, Tree Nuts, Sesame, etc.
  mealTypes: string[];      // Breakfast, Lunch, Dinner, Snack, Dessert...
  difficulty: "" | "easy" | "medium" | "hard";
  maxCookTime?: number | null;
  minSpoons?: number | null; // rating 0-5
  onlyRecipes: boolean;
  sortBy: "relevance" | "rating" | "time" | "newest" | "popularity";
};

export type RecipesFiltersContextType = {
  state: RecipesFiltersState;
  setState: React.Dispatch<React.SetStateAction<RecipesFiltersState>>;
  reset: () => void;
};

const defaultState: RecipesFiltersState = {
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

/** === CONTEXT === */
const Ctx = createContext<RecipesFiltersContextType | undefined>(undefined);

export function RecipesFiltersProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<RecipesFiltersState>(defaultState);
  const value = useMemo(
    () => ({
      state,
      setState,
      reset: () => setState(defaultState),
    }),
    [state]
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

/**
 * Safe hook: instead of crashing, it logs a warning and returns a local,
 * temporary context so the page keeps rendering while you fix route wiring.
 * This avoids "white screen" in production.
 */
export function useRecipesFilters(): RecipesFiltersContextType {
  const ctx = useContext(Ctx);
  if (!ctx) {
    // Soft guard – keeps UI alive if a component renders outside the provider.
    console.warn("useRecipesFilters used outside of RecipesFiltersProvider. Rendering with temp state.");
    const [state, setState] = useState<RecipesFiltersState>(defaultState);
    const temp = useMemo(
      () => ({
        state,
        setState,
        reset: () => setState(defaultState),
      }),
      [state]
    );
    return temp;
  }
  return ctx;
}
