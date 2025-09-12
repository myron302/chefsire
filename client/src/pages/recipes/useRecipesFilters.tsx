import * as React from "react";

export type Difficulty = "Easy" | "Medium" | "Hard";
export type SortBy = "newest" | "rating" | "likes";

export interface RecipesFiltersState {
  cuisines: string[];
  mealTypes: string[];
  dietary: string[];
  difficulty: Difficulty | "";
  maxCookTime: number;
  minSpoons: number;
  onlyRecipes: boolean;
  sortBy: SortBy;
}

type RecipesFiltersContextValue = {
  state: RecipesFiltersState;
  set: (patch: Partial<RecipesFiltersState> | ((prev: RecipesFiltersState) => RecipesFiltersState)) => void;
  reset: () => void;
};

const STORAGE_KEY = "recipes:filters:v1";

const DEFAULT_STATE: RecipesFiltersState = {
  cuisines: [],
  mealTypes: [],
  dietary: [],
  difficulty: "",
  maxCookTime: 60,
  minSpoons: 0,
  onlyRecipes: false,
  sortBy: "newest",
};

const Ctx = React.createContext<RecipesFiltersContextValue | null>(null);

export function RecipesFiltersProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = React.useState<RecipesFiltersState>(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) return { ...DEFAULT_STATE, ...(JSON.parse(raw) as RecipesFiltersState) };
    } catch {}
    return DEFAULT_STATE;
  });

  React.useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {}
  }, [state]);

  const set = React.useCallback<RecipesFiltersContextValue["set"]>((patch) => {
    setState((prev) => (typeof patch === "function" ? patch(prev) : { ...prev, ...patch }));
  }, []);

  const reset = React.useCallback(() => setState(DEFAULT_STATE), []);

  return <Ctx.Provider value={{ state, set, reset }}>{children}</Ctx.Provider>;
}

export function useRecipesFilters() {
  const ctx = React.useContext(Ctx);
  if (!ctx) throw new Error("useRecipesFilters must be used within a RecipesFiltersProvider");
  return ctx;
}
