import * as React from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Slider } from "@/components/ui/slider";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { useRecipesFilters } from "./useRecipesFilters";
import { SpoonIcon } from "./RecipesShared";

const CUISINES = [
  "American","Asian","BBQ","Breakfast","Burgers","Californian","Caribbean","Desserts","Healthy",
  "Italian","Mediterranean","Mexican","Salads","Seafood","Vegan",
].sort();

const MEAL_TYPES = ["Breakfast","Lunch","Dinner","Snack","Dessert"] as const;

const DIETARY = [
  "Vegetarian","Vegan","Pescatarian","Keto","Paleo","Mediterranean","Whole30","Flexitarian",
  "High-Protein","High-Fiber","Low-Carb","Low-Fat","Low-Calorie",
  "Diabetic-Friendly","Heart-Healthy","Low-Sodium","Low-Sugar","Low-FODMAP",
  "Gluten-Free","Lactose-Free","Dairy-Free","Egg-Free","Nut-Free","Soy-Free","Shellfish-Free",
  "Halal","Kosher",
].sort();

const DIFFICULTY: Array<"Easy"|"Medium"|"Hard"> = ["Easy","Medium","Hard"];

export default function RecipesFiltersPage() {
  const { state, set, reset } = useRecipesFilters();

  const toggle = <T extends string>(arr: T[], value: T) =>
    arr.includes(value) ? arr.filter((x) => x !== value) : [...arr, value];

  return (
    <div className="mx-auto max-w-3xl px-4 md:px-6 py-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Recipe Filters</h1>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Badge variant="outline">Cuisines: {state.cuisines.length}</Badge>
          <Badge variant="outline">Meal Types: {state.mealTypes.length}</Badge>
          <Badge variant="outline">Dietary: {state.dietary.length}</Badge>
          {state.difficulty && <Badge variant="outline">Difficulty: {state.difficulty}</Badge>}
          {state.onlyRecipes && <Badge variant="outline">Recipe-only</Badge>}
          <Badge variant="outline">
            <SpoonIcon className="h-3 w-3 mr-1" /> {state.minSpoons}+
          </Badge>
        </div>
      </div>

      {/* Cuisines */}
      <section>
        <h4 className="mb-2 text-base font-semibold">Cuisines</h4>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {CUISINES.map((c) => (
            <label key={c} className="flex items-center gap-2 rounded-md border p-2">
              <Checkbox
                checked={state.cuisines.includes(c)}
                onCheckedChange={() => set({ cuisines: toggle(state.cuisines, c) })}
              />
              <span className="text-sm">{c}</span>
            </label>
          ))}
        </div>
      </section>

      {/* Meal Types */}
      <section>
        <h4 className="mb-2 text-base font-semibold">Meal Type</h4>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {MEAL_TYPES.map((m) => (
            <label key={m} className="flex items-center gap-2 rounded-md border p-2">
              <Checkbox
                checked={state.mealTypes.includes(m)}
                onCheckedChange={() => set({ mealTypes: toggle(state.mealTypes, m) })}
              />
              <span className="text-sm">{m}</span>
            </label>
          ))}
        </div>
      </section>

      {/* Dietary */}
      <section>
        <h4 className="mb-2 text-base font-semibold">Dietary</h4>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {DIETARY.map((d) => (
            <label key={d} className="flex items-center gap-2 rounded-md border p-2">
              <Checkbox
                checked={state.dietary.includes(d)}
                onCheckedChange={() => set({ dietary: toggle(state.dietary, d) })}
              />
              <span className="text-sm">{d}</span>
            </label>
          ))}
        </div>
      </section>

      {/* Difficulty */}
      <section>
        <h4 className="mb-2 text-base font-semibold">Difficulty</h4>
        <div className="flex flex-wrap gap-2">
          {DIFFICULTY.map((d) => (
            <Button
              key={d}
              size="sm"
              variant={state.difficulty === d ? "default" : "outline"}
              onClick={() => set({ difficulty: state.difficulty === d ? "" : d })}
            >
              {d}
            </Button>
          ))}
        </div>
      </section>

      {/* Max cook time */}
      <section>
        <div className="flex items-center justify-between">
          <h4 className="mb-2 text-base font-semibold">Max Cook Time</h4>
          <Label className="text-sm">{state.maxCookTime} min</Label>
        </div>
        <Slider
          value={[state.maxCookTime]}
          min={5}
          max={240}
          step={5}
          onValueChange={(v) => set({ maxCookTime: v[0] ?? state.maxCookTime })}
        />
      </section>

      {/* Min spoons */}
      <section>
        <div className="flex items-center justify-between">
          <h4 className="mb-2 text-base font-semibold">Min Rating (spoons)</h4>
          <div className="flex items-center gap-1 text-sm">
            <SpoonIcon className="h-4 w-4" /> {state.minSpoons || 0}+
          </div>
        </div>
        <div className="flex items-center gap-1">
          {[1,2,3,4,5].map((n) => (
            <button
              key={n}
              type="button"
              className="p-1"
              aria-label={`${n} spoons & up`}
              onClick={() => set({ minSpoons: state.minSpoons === n ? 0 : n })}
            >
              <SpoonIcon className={`h-6 w-6 ${state.minSpoons >= n ? "" : "opacity-30"}`} />
            </button>
          ))}
          <Button size="sm" variant="ghost" className="ml-1 h-7 px-2" onClick={() => set({ minSpoons: 0 })}>
            Clear
          </Button>
        </div>
      </section>

      {/* More */}
      <section className="space-y-2">
        <h4 className="text-base font-semibold">More</h4>
        <label className="flex items-center gap-2">
          <Checkbox
            checked={state.onlyRecipes}
            onCheckedChange={(v) => set({ onlyRecipes: Boolean(v) })}
          />
          <span className="text-sm">Show recipe posts only</span>
        </label>

        <div className="mt-3 flex flex-wrap gap-2">
          {(["newest","rating","likes"] as const).map((s) => (
            <Button
              key={s}
              size="sm"
              variant={state.sortBy === s ? "default" : "outline"}
              onClick={() => set({ sortBy: s })}
            >
              {s === "newest" ? "Newest" : s === "rating" ? "Top Rated" : "Most Liked"}
            </Button>
          ))}
        </div>
      </section>

      <div className="pt-2 flex gap-2">
        <Button variant="secondary" onClick={reset} className="flex-1">
          Reset
        </Button>
        <Button onClick={() => history.back()} className="flex-1">
          Apply
        </Button>
      </div>
    </div>
  );
}
