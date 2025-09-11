import * as React from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Checkbox } from "@/components/ui/checkbox";
import { X } from "lucide-react";
import { useExploreFilters, Difficulty, MealType } from "./useExploreFilters";
import {
  FilterSection,
  SpoonSelect,
  SearchableGroup,
  CUISINES,
  DIETARY,
  ALLERGENS,
  ETHNICITY_GROUPS,
} from "./ExploreShared";

const MEAL_TYPES: MealType[] = ["Breakfast", "Lunch", "Dinner", "Snack", "Dessert"];
const DIFFICULTY: Difficulty[] = ["Easy", "Medium", "Hard"];

export default function ExploreFiltersPage() {
  const [, setLocation] = useLocation();
  const {
    onlyRecipes, setOnlyRecipes,
    sortBy, setSortBy,
    selectedCuisines, setSelectedCuisines,
    selectedMealTypes, setSelectedMealTypes,
    selectedDietary, setSelectedDietary,
    selectedDifficulty, setSelectedDifficulty,
    maxCookTime, setMaxCookTime,
    minRating, setMinRating,
    selectedEthnicities, setSelectedEthnicities,
    excludedAllergens, setExcludedAllergens,
    selectedPreparation, setSelectedPreparation,
    dietQuery, setDietQuery,
    resetFilters,
  } = useExploreFilters();

  const filteredDietOptions = React.useMemo(() => {
    const s = dietQuery.trim().toLowerCase();
    if (!s) return DIETARY;
    return DIETARY.filter((d) => d.toLowerCase().includes(s));
  }, [dietQuery]);

  const toggleFromArray = <T extends string>(arr: T[], setArr: (v: T[]) => void, value: T) => {
    setArr(arr.includes(value) ? arr.filter((x) => x !== value) : [...arr, value]);
  };

  return (
    <div className="mx-auto max-w-4xl px-4 md:px-6 py-4">
      {/* Header */}
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-2xl font-bold">Filters</h1>
        <Button variant="ghost" size="icon" onClick={() => setLocation("/explore")} aria-label="Close">
          <X className="h-5 w-5" />
        </Button>
      </div>

      {/* Body */}
      <div className="space-y-6">
        {/* Cuisines */}
        <FilterSection title="Cuisines">
          <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
            {CUISINES.map((c) => (
              <label key={c} className="flex items-center gap-2 rounded-md border p-2">
                <Checkbox
                  checked={selectedCuisines.includes(c)}
                  onCheckedChange={() => toggleFromArray(selectedCuisines, setSelectedCuisines, c)}
                />
                <span className="text-sm">{c}</span>
              </label>
            ))}
          </div>
        </FilterSection>

        {/* Ethnicity / Cultural Origin (grouped + searchable, bold region headers) */}
        <FilterSection title="Ethnicity / Cultural Origin">
          <div className="space-y-6">
            {ETHNICITY_GROUPS.map((group) => (
              <SearchableGroup
                key={group.label}
                label={group.label}
                options={group.options}
                selected={selectedEthnicities}
                onToggle={(value) =>
                  setSelectedEthnicities((arr) =>
                    arr.includes(value) ? arr.filter((x) => x !== value) : [...arr, value]
                  )
                }
                columns={2}
              />
            ))}
          </div>
        </FilterSection>

        {/* Meal Type */}
        <FilterSection title="Meal Type">
          <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
            {MEAL_TYPES.map((m) => (
              <label key={m} className="flex items-center gap-2 rounded-md border p-2">
                <Checkbox
                  checked={selectedMealTypes.includes(m)}
                  onCheckedChange={() => toggleFromArray(selectedMealTypes, setSelectedMealTypes, m)}
                />
                <span className="text-sm">{m}</span>
              </label>
            ))}
          </div>
        </FilterSection>

        {/* Dietary (searchable) */}
        <FilterSection title="Dietary">
          <input
            value={dietQuery}
            onChange={(e) => setDietQuery(e.target.value)}
            placeholder="Search diets…"
            className="mb-2 h-8 w-full rounded-md border bg-background px-2 text-sm"
          />
          <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
            {filteredDietOptions.map((d) => (
              <label key={d} className="flex items-center gap-2 rounded-md border p-2">
                <Checkbox
                  checked={selectedDietary.includes(d)}
                  onCheckedChange={() => toggleFromArray(selectedDietary, setSelectedDietary, d)}
                />
                <span className="text-sm">{d}</span>
              </label>
            ))}
          </div>
        </FilterSection>

        {/* Exclude Allergens */}
        <FilterSection title="Exclude Allergens">
          <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
            {ALLERGENS.map((a) => (
              <label key={a} className="flex items-center gap-2 rounded-md border p-2">
                <Checkbox
                  checked={excludedAllergens.includes(a)}
                  onCheckedChange={() => toggleFromArray(excludedAllergens, setExcludedAllergens, a)}
                />
                <span className="text-sm">{a}</span>
              </label>
            ))}
          </div>
        </FilterSection>

        {/* Preparation / Religious Standards */}
        <FilterSection title="Preparation / Religious Standards">
          <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
            {["Halal", "Kosher", "Jain"].map((p) => (
              <label key={p} className="flex items-center gap-2 rounded-md border p-2">
                <Checkbox
                  checked={selectedPreparation.includes(p)}
                  onCheckedChange={() => toggleFromArray(selectedPreparation, setSelectedPreparation, p)}
                />
                <span className="text-sm">{p}</span>
              </label>
            ))}
          </div>
        </FilterSection>

        {/* Difficulty */}
        <FilterSection title="Difficulty">
          <div className="flex flex-wrap gap-2">
            {(["Easy", "Medium", "Hard"] as const).map((d) => (
              <Button
                key={d}
                size="sm"
                variant={selectedDifficulty === d ? "default" : "outline"}
                onClick={() => setSelectedDifficulty(selectedDifficulty === d ? "" : d)}
              >
                {d}
              </Button>
            ))}
          </div>
        </FilterSection>

        {/* Max cook time */}
        <FilterSection title={`Max Cook Time: ${maxCookTime} min`}>
          <Slider
            value={[maxCookTime]}
            min={5}
            max={240}
            step={5}
            onValueChange={(v) => setMaxCookTime(v[0] ?? 60)}
          />
        </FilterSection>

        {/* Min spoons (rating) */}
        <FilterSection title={`Min Spoons: ${minRating || 0}`}>
          <SpoonSelect value={minRating} onChange={setMinRating} />
        </FilterSection>

        {/* More flags + sort */}
        <FilterSection title="More">
          <label className="flex items-center gap-2">
            <Checkbox checked={onlyRecipes} onCheckedChange={(v) => setOnlyRecipes(Boolean(v))} />
            <span className="text-sm">Show recipe posts only</span>
          </label>

          <div className="mt-3 flex flex-wrap gap-2">
            {(["newest", "rating", "likes"] as const).map((s) => (
              <Button
                key={s}
                size="sm"
                variant={sortBy === s ? "default" : "outline"}
                onClick={() => setSortBy(s)}
              >
                {s === "newest" ? "Newest" : s === "rating" ? "Top Spoons" : "Most Liked"}
              </Button>
            ))}
          </div>
        </FilterSection>
      </div>

      {/* Footer */}
      <div className="sticky bottom-0 mt-6 border-t bg-background py-4">
        <div className="flex gap-2">
          <Button variant="secondary" onClick={resetFilters} className="flex-1">
            Reset
          </Button>
          <Button className="flex-1" onClick={() => setLocation("/explore")}>
            Apply
          </Button>
        </div>
      </div>
    </div>
  );
}
