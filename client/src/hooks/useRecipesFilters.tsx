// client/src/hooks/useRecipesFilters.tsx
import React, { createContext, useContext, useMemo, useState } from "react";
import type { ReactNode } from "react";

// ✅ Corrected import path (catalog stays in pages/recipes)
import {
  CUISINES,
  MEAL_TYPES,
  DIETARY,
  DIFFICULTY,
  ALLERGENS,
  ETHNICITY_REGIONS,
  ETHNICITIES,
} from "@/pages/recipes/filters.catalog";

// 🔁 Re-export so components can import all from this hook if desired
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
  minSpoons: number; // 0–5 spoons
  onlyRecipes: boolean;
  sortBy: "newest" | "rating" | "likes";
  /** optional quick search term (client-side filter) */
  search?: string;
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
  search: "",
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
