// client/src/pages/recipes/useRecipesFilters.tsx
import React, { createContext, useContext, useMemo, useState } from "react";
import type { ReactNode } from "react";
import {
  CUISINES,
  MEAL_TYPES,
  DIETARY,
  DIFFICULTY,
  ALLERGENS,
  ETHNICITY_REGIONS,
  ETHNICITIES,
} from "./filters.catalog";

/** Re-export lists so other components can import from one place if they prefer */
export {
  CUISINES,
  MEAL_TYPES,
  DIETARY,
  DIFFICULTY,
  ALLERGENS,
  ETHNICITY_REGIONS,
  ETHNICITIES,
};

export interface RecipesFiltersState {
  cuisines: string[];
  ethnicities: string[];
  dietary: string[];
  mealTypes: string[];
  difficulty: "" | "Easy" | "Medium" | "Hard";
  allergens: string[];
  maxCookTime: number;
  minSpoons: number; // your rating metric (0–5 spoons)
  onlyRecipes: boolean;
  sortBy: "newest" | "rating" | "likes";
}

interface RecipesFiltersContext {
  state: RecipesFiltersState;
  set: React.Dispatch<React.SetStateAction<RecipesFiltersState>>;
  reset: () => void;
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

export function RecipesFiltersProvider({ children }: { children: ReactNode }) {
  const [state, set] = useState<RecipesFiltersState>(defaultState);

  const reset = () => set(defaultState);

  const value = useMemo(() => ({ state, set, reset }), [state]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useRecipesFilters() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useRecipesFilters must be used within RecipesFiltersProvider");
  return ctx;
}
