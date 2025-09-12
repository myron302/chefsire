import * as React from "react";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Spoon, SPOON_SCALE, CUISINES, MEAL_TYPES, DIFFICULTY, DIETARY_WITH_RELIGIOUS, ALLERGENS, ETHNICITY_REGIONS } from "./RecipesShared";
import { useRecipesFilters } from "./useRecipesFilters";

export default function RecipesFiltersPanel() {
  const f = useRecipesFilters();

  const [cuisineQuery, setCuisineQuery] = React.useState("");
  const [dietQuery, setDietQuery] = React.useState("");

  const filteredCuisines = React.useMemo(() => {
    const q = cuisineQuery.trim().toLowerCase();
    return q ? CUISINES.filter((c) => c.toLowerCase().includes(q)) : CUISINES;
  }, [cuisineQuery]);

  const filteredDietary = React.useMemo(() => {
    const q = dietQuery.trim().toLowerCase();
    return q ? DIETARY_WITH_RELIGIOUS.filter((d) => d.toLowerCase().includes(q)) : DIETARY_WITH_RELIGIOUS;
  }, [dietQuery]);

  const toggleFromArray = <T extends string>(arr: T[], setArr: (v: T[]) => void, value: T) => {
    setArr(arr.includes(value) ? arr.filter((x) => x !== value) : [...arr, value]);
  };

  const activeCount =
    (f.selectedCuisines.length ? 1 : 0) +
    (f.selectedMealTypes.length ? 1 : 0) +
    (f.selectedDietary.length ? 1 : 0) +
    (f.selectedEthnicities.length ? 1 : 0) +
    (f.selectedPreparation.length ? 1 : 0) +
    (f.excludedAllergens.length ? 1 : 0) +
    (f.selectedDifficulty ? 1 : 0) +
    (f.minRating ? 1 : 0) +
    (f.maxCookTime !== 60 ? 1 : 0) +
    (f.onlyRecipes ? 1 : 0) +
    (f.cookFromPantry ? 1 : 0) +
    (f.sortBy !== "newest" ? 1 : 0);

  return (
    <aside className="hidden lg:block w-80 shrink-0">
      <div className="sticky top-20 space-y-6">
        <div className="flex items-center justify-between">
          <h3 className="text-base font-semibold">Filters</h3>
          {activeCount > 0 && <Badge variant="secondary">{activeCount}</Badge>}
        </div>

        {/* Pantry mode */}
        <section>
          <h4 className="mb-2 text-sm font-medium">Pantry & Discovery</h4>
          <label className="flex items-center gap-2">
            <Checkbox checked={f.onlyRecipes} onCheckedChange={(v) => f.setOnlyRecipes(Boolean(v))} />
            <span className="text-sm">Recipe posts only</span>
          </label>
          <label className="mt-2 flex items-center gap-2">
            <Checkbox checked={f.cookFromPantry} onCheckedChange={(v) => f.setCookFromPantry(Boolean(v))} />
            <span className="text-sm">Cook from my pantry</span>
          </label>
          {f.cookFromPantry && (
            <div className="mt-3">
              <Label className="text-xs">Max missing ingredients: {f.maxMissing}</Label>
              <Slider value={[f.maxMissing]} min={0} max={10} step={1} onValueChange={(v) => f.setMaxMissing(v[0] ?? 2)} />
            </div>
          )}
        </section>

        {/* Cuisine (searchable) */}
        <section>
          <h4 className="mb-2 text-sm font-medium">Cuisine</h4>
          <Input
            value={cuisineQuery}
            onChange={(e) => setCuisineQuery(e.target.value)}
            placeholder="Search cuisine…"
            className="mb-2 h-8 text-sm"
          />
          <div className="grid grid-cols-1 gap-2 max-h-[18rem] overflow-y-auto pr-1">
            {filteredCuisines.map((c) => (
              <label key={c} className="flex items-center gap-2">
                <Checkbox
                  checked={f.selectedCuisines.includes(c)}
                  onCheckedChange={() => toggleFromArray(f.selectedCuisines, f.setSelectedCuisines, c)}
                />
                <span className="text-sm">{c}</span>
              </label>
            ))}
          </div>
        </section>

        {/* Meal Type */}
        <section>
          <h4 className="mb-2 text-sm font-medium">Meal Type</h4>
          <div className="grid grid-cols-2 gap-2">
            {Array.from(new Set(["Breakfast","Brunch","Lunch","Dinner","Snack","Dessert"])).map((m) => (
              <label key={m} className="flex items-center gap-2">
                <Checkbox
                  checked={f.selectedMealTypes.includes(m)}
                  onCheckedChange={() => toggleFromArray(f.selectedMealTypes, f.setSelectedMealTypes, m)}
                />
                <span className="text-sm">{m}</span>
              </label>
            ))}
          </div>
        </section>

        {/* Diet (with Halal/Kosher) + search */}
        <section>
          <h4 className="mb-2 text-sm font-medium">Diet & Restrictions</h4>
          <Input
            value={dietQuery}
            onChange={(e) => setDietQuery(e.target.value)}
            placeholder="Search diets…"
            className="mb-2 h-8 text-sm"
          />
          <div className="grid grid-cols-2 gap-2 max-h-[14rem] overflow-y-auto pr-1">
            {filteredDietary.map((d) => (
              <label key={d} className="flex items-center gap-2">
                <Checkbox
                  checked={f.selectedDietary.includes(d)}
                  onCheckedChange={() => toggleFromArray(f.selectedDietary, f.setSelectedDietary, d)}
                />
                <span className="text-sm">{d}</span>
              </label>
            ))}
          </div>
        </section>

        {/* Ethnicities grouped */}
        <section>
          <h4 className="mb-2 text-sm font-medium">Ethnicity / Cultural Origin</h4>
          <div className="space-y-4 max-h-[22rem] overflow-y-auto pr-1">
            {Object.entries(ETHNICITY_REGIONS).map(([key, group]) => (
              <div key={key}>
                <div className="mb-1 text-[0.9rem] font-semibold text-foreground">{group.label}</div>
                <div className="grid grid-cols-1 gap-2">
                  {group.items.map((e) => (
                    <label key={e} className="flex items-center gap-2">
                      <Checkbox
                        checked={f.selectedEthnicities.includes(e)}
                        onCheckedChange={() => toggleFromArray(f.selectedEthnicities, f.setSelectedEthnicities, e)}
                      />
                      <span className="text-sm">{e}</span>
                    </label>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Allergens (exclude) */}
        <section>
          <h4 className="mb-2 text-sm font-medium">Exclude Allergens</h4>
          <div className="grid grid-cols-2 gap-2">
            {["Dairy","Eggs","Fish","Gluten","Mustard","Peanuts","Sesame","Shellfish","Soy","Tree Nuts"].map((a) => (
              <label key={a} className="flex items-center gap-2">
                <Checkbox
                  checked={f.excludedAllergens.includes(a)}
                  onCheckedChange={() => toggleFromArray(f.excludedAllergens, f.setExcludedAllergens, a)}
                />
                <span className="text-sm">{a}</span>
              </label>
            ))}
          </div>
        </section>

        {/* Difficulty */}
        <section>
          <h4 className="mb-2 text-sm font-medium">Difficulty</h4>
          <div className="flex flex-wrap gap-2">
            {["Easy","Medium","Hard"].map((d) => (
              <Button
                key={d}
                size="sm"
                variant={f.selectedDifficulty === d ? "default" : "outline"}
                onClick={() => f.setSelectedDifficulty(f.selectedDifficulty === (d as any) ? "" : (d as any))}
              >
                {d}
              </Button>
            ))}
          </div>
        </section>

        {/* Time & Spoons */}
        <section>
          <h4 className="mb-2 text-sm font-medium">Max Cook Time</h4>
          <Label className="text-xs">Up to {f.maxCookTime} min</Label>
          <Slider value={[f.maxCookTime]} min={5} max={240} step={5} onValueChange={(v) => f.setMaxCookTime(v[0] ?? 60)} />
        </section>

        <section>
          <h4 className="mb-2 text-sm font-medium">Min Spoons</h4>
          <div className="flex items-center gap-1">
            {SPOON_SCALE.map((n) => (
              <button
                key={n}
                type="button"
                className="p-1"
                aria-label={`${n} spoons & up`}
                onClick={() => f.setMinRating(f.minRating === n ? 0 : n)}
              >
                <Spoon faded={f.minRating < n} />
              </button>
            ))}
            <Button size="sm" variant="ghost" className="ml-1 h-7 px-2" onClick={() => f.setMinRating(0)}>
              Clear
            </Button>
          </div>
        </section>

        {/* Sort & Reset */}
        <section>
          <h4 className="mb-2 text-sm font-medium">Sort</h4>
          <div className="flex flex-wrap gap-2">
            {(["newest","rating","likes"] as const).map((s) => (
              <Button
                key={s}
                size="sm"
                variant={f.sortBy === s ? "default" : "outline"}
                onClick={() => f.setSortBy(s)}
              >
                {s === "newest" ? "Newest" : s === "rating" ? "Top Rated" : "Most Liked"}
              </Button>
            ))}
          </div>
        </section>

        <div className="pt-2">
          <Button variant="secondary" onClick={f.resetFilters} className="w-full">
            Reset filters
          </Button>
        </div>
      </div>
    </aside>
  );
}
