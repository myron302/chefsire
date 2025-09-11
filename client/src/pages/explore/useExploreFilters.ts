import * as React from "react";

// simple localStorage hook
function useLS<T>(key: string, init: T) {
  const [v, setV] = React.useState<T>(() => {
    try {
      const raw = localStorage.getItem(key);
      return raw ? (JSON.parse(raw) as T) : init;
    } catch {
      return init;
    }
  });
  React.useEffect(() => {
    try {
      localStorage.setItem(key, JSON.stringify(v));
    } catch {}
  }, [key, v]);
  return [v, setV] as const;
}

export type ViewMode = "grid" | "list";
export type Difficulty = "Easy" | "Medium" | "Hard";
export type MealType = "Breakfast" | "Lunch" | "Dinner" | "Snack" | "Dessert";

export function useExploreFilters() {
  // view + flags
  const [viewMode, setViewMode] = useLS<ViewMode>("explore:view", "grid");
  const [onlyRecipes, setOnlyRecipes] = useLS<boolean>("explore:onlyRecipes", false);
  const [sortBy, setSortBy] = useLS<"newest" | "rating" | "likes">("explore:sort", "newest");

  // core filters
  const [selectedCuisines, setSelectedCuisines] = useLS<string[]>("explore:cuisines", []);
  const [selectedMealTypes, setSelectedMealTypes] = useLS<MealType[]>("explore:meals", []);
  const [selectedDietary, setSelectedDietary] = useLS<string[]>("explore:diets", []);
  const [selectedDifficulty, setSelectedDifficulty] = useLS<Difficulty | "">("explore:difficulty", "");
  const [maxCookTime, setMaxCookTime] = useLS<number>("explore:maxCook", 60);
  const [minRating, setMinRating] = useLS<number>("explore:minRating", 0);

  // new filters
  const [selectedEthnicities, setSelectedEthnicities] = useLS<string[]>("explore:ethnicities", []);
  const [excludedAllergens, setExcludedAllergens] = useLS<string[]>("explore:allergens", []);
  const [selectedPreparation, setSelectedPreparation] = useLS<string[]>("explore:prep", []);

  // search helpers for menus
  const [dietQuery, setDietQuery] = useLS<string>("explore:dietQuery", "");

  const resetFilters = () => {
    setSelectedCuisines([]);
    setSelectedMealTypes([]);
    setSelectedDietary([]);
    setSelectedDifficulty("");
    setMaxCookTime(60);
    setMinRating(0);
    setOnlyRecipes(false);
    setSortBy("newest");
    setSelectedEthnicities([]);
    setExcludedAllergens([]);
    setSelectedPreparation([]);
    setDietQuery("");
  };

  return {
    // view
    viewMode, setViewMode,
    onlyRecipes, setOnlyRecipes,
    sortBy, setSortBy,

    // filters
    selectedCuisines, setSelectedCuisines,
    selectedMealTypes, setSelectedMealTypes,
    selectedDietary, setSelectedDietary,
    selectedDifficulty, setSelectedDifficulty,
    maxCookTime, setMaxCookTime,
    minRating, setMinRating,

    // new
    selectedEthnicities, setSelectedEthnicities,
    excludedAllergens, setExcludedAllergens,
    selectedPreparation, setSelectedPreparation,

    // search helpers
    dietQuery, setDietQuery,

    resetFilters,
  };
}
