import * as React from "react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger, SheetClose } from "@/components/ui/sheet";
import { Filter, X } from "lucide-react";
import { useRecipesFilters } from "./useRecipesFilters";

export default function RecipesMobileFiltersSheet() {
  const f = useRecipesFilters();
  const [open, setOpen] = React.useState(false);

  const s = f.state;

  const activeCount =
    (s.q?.trim() ? 1 : 0) +
    (s.cuisines.length ? 1 : 0) +
    (s.mealTypes.length ? 1 : 0) +
    (s.dietary.length ? 1 : 0) +
    (s.ethnicities.length ? 1 : 0) +
    (s.allergens.length ? 1 : 0) +
    (s.difficulty ? 1 : 0) +
    (s.minSpoons != null ? 1 : 0) +
    (s.maxCookTime != null ? 1 : 0) +
    (s.onlyRecipes ? 1 : 0) +
    (s.sortBy !== "relevance" ? 1 : 0);

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

        {/* Simple mobile summary + jump to full filters page */}
        <div className="overflow-y-auto max-h-[calc(88dvh-56px-72px)] p-4 space-y-6">
          <div className="space-y-3">
            <SummaryRow label="Search" value={s.q || "—"} />
            <SummaryRow label="Cuisines" value={s.cuisines.join(", ") || "—"} />
            <SummaryRow label="Meal Types" value={s.mealTypes.join(", ") || "—"} />
            <SummaryRow label="Dietary" value={s.dietary.join(", ") || "—"} />
            <SummaryRow label="Ethnicities" value={s.ethnicities.join(", ") || "—"} />
            <SummaryRow label="Allergens" value={s.allergens.join(", ") || "—"} />
            <SummaryRow label="Difficulty" value={s.difficulty ? s.difficulty : "Any"} />
            <SummaryRow label="Max Cook Time" value={s.maxCookTime != null ? `${s.maxCookTime} min` : "Any"} />
            <SummaryRow label="Min Spoons" value={s.minSpoons != null ? String(s.minSpoons) : "Any"} />
            <SummaryRow label="Only Recipes" value={s.onlyRecipes ? "Yes" : "No"} />
            <SummaryRow label="Sort By" value={s.sortBy} />
          </div>

          <div className="pt-2">
            <Link href="/recipes/filters">
              <Button className="w-full" onClick={() => setOpen(false)}>
                Open Full Filters
              </Button>
            </Link>
          </div>
        </div>

        <div className="sticky bottom-0 border-t bg-background p-4">
          <div className="flex gap-2">
            <Button variant="secondary" onClick={() => f.reset()} className="flex-1">
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

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-right">{value}</span>
    </div>
  );
}
