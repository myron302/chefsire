// client/src/pages/recipes/useRecipesFilters.tsx
import React, { createContext, useContext, useMemo, useState } from "react";
import type { ReactNode } from "react";

// ✅ import lists from the shared catalog file
import {
  CUISINES,
  MEAL_TYPES,
  DIETARY,
  DIFFICULTY,
  ALLERGENS,
  ETHNICITY_REGIONS,
  ETHNICITIES,
} from "./filters.catalog";

// 🔁 re-export them so components can import directly from here if they want
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
  // 🔎 NEW: free-text search used by the list page (and sent to /api/recipes/search as q)
  search: string;

  cuisines: string[];
  ethnicities: string[];
  dietary: string[];
  mealTypes: string[];
  difficulty: "" | "Easy" | "Medium" | "Hard";
  allergens: string[];
  maxCookTime: number;
  minSpoons: number; // rating in spoons
  onlyRecipes: boolean;
  sortBy: "newest" | "rating" | "likes";
}

interface RecipesFiltersContext {
  state: RecipesFiltersState;
  set: React.Dispatch<React.SetStateAction<RecipesFiltersState>>;
  reset: () => void;
}

const defaultState: RecipesFiltersState = {
  search: "",            // ← added
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
