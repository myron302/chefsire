import * as React from "react";

export type Difficulty = "Easy" | "Medium" | "Hard" | "";
export type ViewMode = "grid" | "list";
export type SortBy = "newest" | "rating" | "likes";

type FiltersState = {
  onlyRecipes: boolean;
  cookFromPantry: boolean;
  maxMissing: number;

  selectedCuisines: string[];
  selectedMealTypes: string[];
  selectedDietary: string[];
  selectedEthnicities: string[];
  selectedPreparation: string[];
  excludedAllergens: string[];
  selectedDifficulty: Difficulty;
  maxCookTime: number;
  minRating: number;
  sortBy: SortBy;
  viewMode: ViewMode;
};

const DEFAULTS: FiltersState = {
  onlyRecipes: false,
  cookFromPantry: false,
  maxMissing: 2,

  selectedCuisines: [],
  selectedMealTypes: [],
  selectedDietary: [],
  selectedEthnicities: [],
  selectedPreparation: [],
  excludedAllergens: [],
  selectedDifficulty: "",
  maxCookTime: 60,
  minRating: 0,
  sortBy: "newest",
  viewMode: "grid",
};

const Ctx = React.createContext<{
  state: FiltersState;
  set: React.Dispatch<React.SetStateAction<FiltersState>>;
} | null>(null);

export function RecipesFiltersProvider({ children }: { children: React.ReactNode }) {
  const [state, set] = React.useState<FiltersState>(() => {
    try {
      const raw = localStorage.getItem("recipes:filters");
      return raw ? { ...DEFAULTS, ...JSON.parse(raw) } : DEFAULTS;
    } catch {
      return DEFAULTS;
    }
  });

  React.useEffect(() => {
    try {
      localStorage.setItem("recipes:filters", JSON.stringify(state));
    } catch {}
  }, [state]);

  return <Ctx.Provider value={{ state, set }}>{children}</Ctx.Provider>;
}

export function useRecipesFilters() {
  const ctx = React.useContext(Ctx);
  if (!ctx) throw new Error("useRecipesFilters must be used inside RecipesFiltersProvider");
  const { state, set } = ctx;

  const api = {
    ...state,
    setViewMode: (v: FiltersState["viewMode"]) => set((s) => ({ ...s, viewMode: v })),
    setSortBy: (v: FiltersState["sortBy"]) => set((s) => ({ ...s, sortBy: v })),
    setOnlyRecipes: (v: boolean) => set((s) => ({ ...s, onlyRecipes: v })),
    setCookFromPantry: (v: boolean) => set((s) => ({ ...s, cookFromPantry: v })),
    setMaxMissing: (n: number) => set((s) => ({ ...s, maxMissing: n })),
    setSelectedCuisines: (v: string[]) => set((s) => ({ ...s, selectedCuisines: v })),
    setSelectedMealTypes: (v: string[]) => set((s) => ({ ...s, selectedMealTypes: v })),
    setSelectedDietary: (v: string[]) => set((s) => ({ ...s, selectedDietary: v })),
    setSelectedEthnicities: (v: string[]) => set((s) => ({ ...s, selectedEthnicities: v })),
    setSelectedPreparation: (v: string[]) => set((s) => ({ ...s, selectedPreparation: v })),
    setExcludedAllergens: (v: string[]) => set((s) => ({ ...s, excludedAllergens: v })),
    setSelectedDifficulty: (v: FiltersState["selectedDifficulty"]) => set((s) => ({ ...s, selectedDifficulty: v })),
    setMaxCookTime: (n: number) => set((s) => ({ ...s, maxCookTime: n })),
    setMinRating: (n: number) => set((s) => ({ ...s, minRating: n })),
    resetFilters: () => set(DEFAULTS),
  };

  return api;
}
