// client/src/pages/recipes/useRecipesFilters.tsx
import React, { createContext, useContext, useState, useMemo } from "react";

/**
 * The filter state shape used across Recipes pages
 */
export interface RecipesFiltersState {
  cuisines: string[];
  ethnicities: string[];
  dietary: string[];
  mealTypes: string[];
  difficulty: "" | "Easy" | "Medium" | "Hard";
  allergens: string[];
  maxCookTime: number;
  minSpoons: number; // ⭐ actually “spoons” rating
  onlyRecipes: boolean;
  sortBy: "newest" | "rating" | "likes";
}

interface RecipesFiltersContext {
  state: RecipesFiltersState;
  set: React.Dispatch<React.SetStateAction<RecipesFiltersState>>;
}

const defaultState: RecipesFiltersState = {
  cuisines: [],
  ethnicities: [],
  dietary: [],
  mealTypes: [],
  difficulty: "",
  allergens: [],
  maxCookTime: 60,
  minSpoons: 0,
  onlyRecipes: false,
  sortBy: "newest",
};

const Ctx = createContext<RecipesFiltersContext | undefined>(undefined);

export function RecipesFiltersProvider({ children }: { children: React.ReactNode }) {
  const [state, set] = useState<RecipesFiltersState>(defaultState);

  const value = useMemo(() => ({ state, set }), [state]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useRecipesFilters() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useRecipesFilters must be used within RecipesFiltersProvider");
  return ctx;
}
