import * as React from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { LayoutGrid, List } from "lucide-react";
import { useRecipesFilters } from "./useRecipesFilters";
import { useRecipesData } from "./useRecipesData";
import RecipesFiltersPanel from "./RecipesFiltersPanel";
import RecipesMobileFiltersSheet from "./RecipesMobileFiltersSheet";
import RecipeCard from "@/components/recipe-card"; // uses your improved RecipeCard

export default function RecipesListPage() {
  const f = useRecipesFilters();
  const { items } = useRecipesData();

  // keep top row neat on mobile by wrapping chips; move long ones to next row automatically
  return (
    <div className="mx-auto max-w-6xl px-4 md:px-6 lg:grid lg:grid-cols-[1fr_20rem] gap-8">
      {/* MAIN */}
      <main className="min-w-0">
        {/* Mobile controls: Filters + View toggle */}
        <div className="lg:hidden mb-3 flex items-center justify-between gap-2">
          <RecipesMobileFiltersSheet />
          <div className="flex gap-2">
            <Button
              variant={f.viewMode === "grid" ? "default" : "outline"}
              onClick={() => f.setViewMode("grid")}
              className="gap-2"
            >
              <LayoutGrid className="h-4 w-4" />
              Grid
            </Button>
            <Button
              variant={f.viewMode === "list" ? "default" : "outline"}
              onClick={() => f.setViewMode("list")}
              className="gap-2"
            >
              <List className="h-4 w-4" />
              List
            </Button>
          </div>
        </div>

        {/* Active filter summary (chips) */}
        <div className="mb-3 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          {f.selectedCuisines.length > 0 && <Badge variant="outline">Cuisines: {f.selectedCuisines.length}</Badge>}
          {f.selectedMealTypes.length > 0 && <Badge variant="outline">Meals: {f.selectedMealTypes.length}</Badge>}
          {f.selectedDietary.length > 0 && <Badge variant="outline">Diet: {f.selectedDietary.length}</Badge>}
          {f.selectedEthnicities.length > 0 && <Badge variant="outline">Ethnicity: {f.selectedEthnicities.length}</Badge>}
          {f.excludedAllergens.length > 0 && <Badge variant="outline">No: {f.excludedAllergens.join(", ")}</Badge>}
          {f.selectedDifficulty && <Badge variant="outline">Difficulty: {f.selectedDifficulty}</Badge>}
          {f.onlyRecipes && <Badge variant="outline">Recipe-only</Badge>}
          {f.cookFromPantry && <Badge variant="outline">Pantry mode ≤ {f.maxMissing} missing</Badge>}
          <Badge variant="outline">≤ {f.maxCookTime} min</Badge>
          {f.minRating ? <Badge variant="outline">Spoons {f.minRating}+</Badge> : null}
          <Badge variant="outline">Sort: {f.sortBy}</Badge>
          {(f.selectedCuisines.length ||
            f.selectedMealTypes.length ||
            f.selectedDietary.length ||
            f.selectedEthnicities.length ||
            f.excludedAllergens.length ||
            f.selectedDifficulty ||
            f.onlyRecipes ||
            f.cookFromPantry ||
            f.minRating ||
            f.maxCookTime !== 60 ||
            f.sortBy !== "newest") && (
            <Button size="sm" variant="ghost" className="h-7 px-2" onClick={f.resetFilters}>
              Reset
            </Button>
          )}
        </div>

        {/* RESULTS */}
        {items.length === 0 ? (
          <EmptyState onReset={f.resetFilters} />
        ) : f.viewMode === "grid" ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-2 gap-4">
            {items.map((p: any) => (
              <RecipeCard
                key={p.id}
                post={p as any}
                matchInfo={p._match}
                onSuggestSubs={() => {/* hook to your substitutions drawer */}}
              />
            ))}
          </div>
        ) : (
          <div className="space-y-4">
            {items.map((p: any) => (
              <RecipeCard
                key={p.id}
                post={p as any}
                matchInfo={p._match}
                onSuggestSubs={() => {/* hook to your substitutions drawer */}}
              />
            ))}
          </div>
        )}
      </main>

      {/* RIGHT SIDEBAR (desktop) */}
      <div className="hidden lg:block">
        <RecipesFiltersPanel />
      </div>
    </div>
  );
}

function EmptyState({ onReset }: { onReset: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-lg border py-16 text-center">
      <p className="text-sm text-muted-foreground">No recipes match these filters.</p>
      <Button className="mt-3" variant="secondary" onClick={onReset}>
        Reset filters
      </Button>
    </div>
  );
}
