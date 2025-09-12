import * as React from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger, SheetClose } from "@/components/ui/sheet";
import { Filter, X } from "lucide-react";
import RecipesFiltersPanel from "./RecipesFiltersPanel";
import { useRecipesFilters } from "./useRecipesFilters";

export default function RecipesMobileFiltersSheet() {
  const f = useRecipesFilters();
  const [open, setOpen] = React.useState(false);

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
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="outline" className="gap-2">
          <Filter className="h-4 w-4" />
          Filters
          {activeCount > 0 && <Badge variant="secondary" className="ml-2">{activeCount}</Badge>}
        </Button>
      </SheetTrigger>

      <SheetContent side="bottom" className="h-[88dvh] p-0">
        <SheetHeader className="p-4 border-b">
          <div className="flex items-center justify-between">
            <SheetTitle>Filters</SheetTitle>
            <Button variant="ghost" size="icon" onClick={() => setOpen(false)} aria-label="Close">
              <X className="h-5 w-5" />
            </Button>
          </div>
        </SheetHeader>

        {/* Use the same panel content; container provides scroll */}
        <div className="overflow-y-auto max-h-[calc(88dvh-56px-72px)] p-4 space-y-6">
          <RecipesFiltersPanel />
        </div>

        <div className="sticky bottom-0 border-t bg-background p-4">
          <div className="flex gap-2">
            <Button variant="secondary" onClick={() => f.resetFilters()} className="flex-1">
              Reset
            </Button>
            <SheetClose asChild>
              <Button className="flex-1">Apply</Button>
            </SheetClose>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
