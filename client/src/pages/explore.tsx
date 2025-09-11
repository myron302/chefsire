// client/src/pages/explore.tsx
import * as React from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { LayoutGrid, List, Filter, X } from "lucide-react";

/** -------------------------------
 * Types + demo data (replace later)
 * -------------------------------- */
type ViewMode = "grid" | "list";

type Post = {
  id: string;
  title: string;
  image: string;
  cuisine: string; // one of CUISINES
  isRecipe: boolean;
  author: string;
};

const CUISINES = [
  "Italian",
  "Healthy",
  "Desserts",
  "Quick",
  "Vegan",
  "Seafood",
  "Asian",
  "Mexican",
  "Mediterranean",
  "BBQ",
  "Breakfast",
  "Burgers",
  "Salads",
];

const DEMO_POSTS: Post[] = [
  { id: "1", title: "Margherita Pizza", image: "https://images.unsplash.com/photo-1548365328-8b84986da7b3?q=80&w=1200&auto=format&fit=crop", cuisine: "Italian", isRecipe: true, author: "Giulia" },
  { id: "2", title: "Rainbow Salad", image: "https://images.unsplash.com/photo-1490474418585-ba9bad8fd0ea?q=80&w=1200&auto=format&fit=crop", cuisine: "Healthy", isRecipe: false, author: "Ava" },
  { id: "3", title: "Choco Truffles", image: "https://images.unsplash.com/photo-1541781286675-09c7e9d404bc?q=80&w=1200&auto=format&fit=crop", cuisine: "Desserts", isRecipe: true, author: "Noah" },
  { id: "4", title: "Spicy Ramen", image: "https://images.unsplash.com/photo-1546549039-49cc4f5b3c89?q=80&w=1200&auto=format&fit=crop", cuisine: "Asian", isRecipe: true, author: "Rin" },
  { id: "5", title: "BBQ Brisket", image: "https://images.unsplash.com/photo-1544025162-d76694265947?q=80&w=1200&auto=format&fit=crop", cuisine: "BBQ", isRecipe: false, author: "Mason" },
  { id: "6", title: "Avocado Toast", image: "https://images.unsplash.com/photo-1504754524776-8f4f37790ca0?q=80&w=1200&auto=format&fit=crop", cuisine: "Breakfast", isRecipe: true, author: "Ivy" },
];

/** -------------------------------
 * Explore Page
 * -------------------------------- */
export default function Explore() {
  // state
  const [selectedCuisines, setSelectedCuisines] = React.useState<string[]>([]);
  const [onlyRecipes, setOnlyRecipes] = React.useState(false);
  const [viewMode, setViewMode] = React.useState<ViewMode>("grid");

  // TODO: swap DEMO_POSTS for your fetched data
  const posts = DEMO_POSTS;

  // filtering
  const filteredPosts = React.useMemo(() => {
    return posts.filter((p) => {
      const cuisineOK =
        selectedCuisines.length === 0 || selectedCuisines.includes(p.cuisine);
      const recipeOK = !onlyRecipes || p.isRecipe;
      return cuisineOK && recipeOK;
    });
  }, [posts, selectedCuisines, onlyRecipes]);

  function resetFilters() {
    setSelectedCuisines([]);
    setOnlyRecipes(false);
    setViewMode("grid");
  }

  return (
    <div className="mx-auto max-w-6xl md:grid md:grid-cols-[16rem_1fr] gap-6 px-4 md:px-6">
      {/* Desktop sidebar */}
      <DesktopFiltersSidebar
        selectedCuisines={selectedCuisines}
        setSelectedCuisines={setSelectedCuisines}
        onlyRecipes={onlyRecipes}
        setOnlyRecipes={setOnlyRecipes}
        onReset={resetFilters}
      />

      {/* Main content */}
      <main className="min-w-0">
        {/* Mobile controls */}
        <div className="md:hidden mb-3 flex items-center justify-between gap-2">
          <MobileFiltersSheet
            selectedCuisines={selectedCuisines}
            setSelectedCuisines={setSelectedCuisines}
            onlyRecipes={onlyRecipes}
            setOnlyRecipes={setOnlyRecipes}
            viewMode={viewMode}
            setViewMode={setViewMode}
            onReset={resetFilters}
          />
          <div className="flex gap-2">
            <Button
              variant={viewMode === "grid" ? "default" : "outline"}
              onClick={() => setViewMode("grid")}
              className="gap-2"
            >
              <LayoutGrid className="h-4 w-4" />
              Grid
            </Button>
            <Button
              variant={viewMode === "list" ? "default" : "outline"}
              onClick={() => setViewMode("list")}
              className="gap-2"
            >
              <List className="h-4 w-4" />
              List
            </Button>
          </div>
        </div>

        {/* Results */}
        {filteredPosts.length === 0 ? (
          <EmptyState onReset={resetFilters} />
        ) : viewMode === "grid" ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            {filteredPosts.map((p) => (
              <GridCard key={p.id} post={p} />
            ))}
          </div>
        ) : (
          <div className="space-y-3">
            {filteredPosts.map((p) => (
              <ListRow key={p.id} post={p} />
            ))}
          </div>
        )}
      </main>
    </div>
  );
}

/** -------------------------------
 * Components used on the page
 * -------------------------------- */

// Desktop sidebar with real scroll (no dropdowns)
function DesktopFiltersSidebar({
  selectedCuisines,
  setSelectedCuisines,
  onlyRecipes,
  setOnlyRecipes,
  onReset,
}: {
  selectedCuisines: string[];
  setSelectedCuisines: (v: string[]) => void;
  onlyRecipes: boolean;
  setOnlyRecipes: (v: boolean) => void;
  onReset: () => void;
}) {
  function toggleCuisine(c: string) {
    setSelectedCuisines(
      selectedCuisines.includes(c)
        ? selectedCuisines.filter((x) => x !== c)
        : [...selectedCuisines, c]
    );
  }

  return (
    <aside className="hidden md:block w-64 shrink-0">
      <div className="sticky top-20 space-y-4">
        <div className="space-y-2">
          <p className="text-sm font-medium">Cuisines</p>
          <div
            className="grid grid-cols-1 gap-2 max-h-[60vh] overflow-y-auto pr-1"
            style={{ WebkitOverflowScrolling: "touch" as any }}
          >
            {CUISINES.map((c) => (
              <label key={c} className="flex items-center gap-2">
                <Checkbox
                  checked={selectedCuisines.includes(c)}
                  onCheckedChange={() => toggleCuisine(c)}
                />
                <span className="text-sm">{c}</span>
              </label>
            ))}
          </div>
        </div>

        <label className="flex items-center gap-2">
          <Checkbox
            checked={onlyRecipes}
            onCheckedChange={(v) => setOnlyRecipes(Boolean(v))}
          />
          <span className="text-sm">Show recipe posts only</span>
        </label>

        <Button variant="secondary" onClick={onReset}>
          Reset filters
        </Button>
      </div>
    </aside>
  );
}

// Mobile sheet: scrollable, touch-friendly
function MobileFiltersSheet({
  selectedCuisines,
  setSelectedCuisines,
  onlyRecipes,
  setOnlyRecipes,
  viewMode,
  setViewMode,
  onReset,
}: {
  selectedCuisines: string[];
  setSelectedCuisines: (v: string[]) => void;
  onlyRecipes: boolean;
  setOnlyRecipes: (v: boolean) => void;
  viewMode: ViewMode;
  setViewMode: (v: ViewMode) => void;
  onReset: () => void;
}) {
  const [open, setOpen] = React.useState(false);

  function toggleCuisine(c: string) {
    setSelectedCuisines(
      selectedCuisines.includes(c)
        ? selectedCuisines.filter((x) => x !== c)
        : [...selectedCuisines, c]
    );
  }

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="outline" className="gap-2">
          <Filter className="h-4 w-4" />
          Filters
          {selectedCuisines.length > 0 && (
            <Badge variant="secondary" className="ml-2">
              {selectedCuisines.length}
            </Badge>
          )}
        </Button>
      </SheetTrigger>

      <SheetContent side="bottom" className="h-[88dvh] p-0">
        <SheetHeader className="p-4 border-b">
          <div className="flex items-center justify-between">
            <SheetTitle>Filters</SheetTitle>
            <Button variant="ghost" size="icon" onClick={() => setOpen(false)}>
              <X className="h-5 w-5" />
            </Button>
          </div>
        </SheetHeader>

        {/* Scrollable body */}
        <div
          className="
            overflow-y-auto
            max-h-[calc(88dvh-56px-72px)]
            p-4
            touch-pan-y
            overscroll-contain
          "
          style={{ WebkitOverflowScrolling: "touch" as any }}
        >
          {/* Top quick toggles */}
          <div className="mb-4 flex items-center gap-2">
            <Button
              variant={viewMode === "grid" ? "default" : "outline"}
              onClick={() => setViewMode("grid")}
              className="gap-2"
            >
              <LayoutGrid className="h-4 w-4" />
              Grid
            </Button>
            <Button
              variant={viewMode === "list" ? "default" : "outline"}
              onClick={() => setViewMode("list")}
              className="gap-2"
            >
              <List className="h-4 w-4" />
              List
            </Button>
            <Button variant="ghost" onClick={onReset} className="ml-auto">
              Reset filters
            </Button>
          </div>

          {/* Multi-select as checkboxes */}
          <div className="space-y-3">
            <p className="text-sm font-medium">Cuisines</p>
            <div className="grid grid-cols-2 gap-2">
              {CUISINES.map((c) => (
                <label
                  key={c}
                  className="flex items-center gap-2 rounded-md border p-2 active:scale-[.995] transition"
                >
                  <Checkbox
                    checked={selectedCuisines.includes(c)}
                    onCheckedChange={() => toggleCuisine(c)}
                  />
                  <span className="text-sm">{c}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Recipe-only filter */}
          <div className="mt-6">
            <label className="flex items-center gap-2">
              <Checkbox
                checked={onlyRecipes}
                onCheckedChange={(v) => setOnlyRecipes(Boolean(v))}
              />
              <span className="text-sm">Show recipe posts only</span>
            </label>
          </div>
        </div>

        {/* Sticky footer */}
        <div className="sticky bottom-0 border-t bg-background p-4">
          <div className="flex gap-2">
            <Button
              variant={viewMode === "grid" ? "default" : "outline"}
              onClick={() => setViewMode("grid")}
              className="flex-1 gap-2"
            >
              <LayoutGrid className="h-4 w-4" />
              Grid
            </Button>
            <Button
              variant={viewMode === "list" ? "default" : "outline"}
              onClick={() => setViewMode("list")}
              className="flex-1 gap-2"
            >
              <List className="h-4 w-4" />
              List
            </Button>
          </div>
          <div className="mt-3 flex gap-2">
            <Button variant="secondary" onClick={onReset} className="flex-1">
              Reset
            </Button>
            <Button onClick={() => setOpen(false)} className="flex-1">
              Apply
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}

// Grid card + List row
function GridCard({ post }: { post: Post }) {
  return (
    <article className="overflow-hidden rounded-lg border bg-card">
      <div className="aspect-square overflow-hidden">
        <img
          src={post.image}
          alt={post.title}
          className="h-full w-full object-cover"
          loading="lazy"
        />
      </div>
      <div className="p-3">
        <h3 className="line-clamp-1 text-sm font-semibold">{post.title}</h3>
        <div className="mt-1 flex items-center justify-between">
          <span className="text-xs text-muted-foreground">{post.author}</span>
          <Badge variant="outline" className="text-xs">{post.cuisine}</Badge>
        </div>
        {post.isRecipe && (
          <span className="mt-2 inline-block text-[10px] uppercase tracking-wide text-emerald-600">
            Recipe
          </span>
        )}
      </div>
    </article>
  );
}

function ListRow({ post }: { post: Post }) {
  return (
    <article className="flex gap-3 rounded-lg border bg-card p-2">
      <div className="h-20 w-20 shrink-0 overflow-hidden rounded-md">
        <img
          src={post.image}
          alt={post.title}
          className="h-full w-full object-cover"
          loading="lazy"
        />
      </div>
      <div className="min-w-0 flex-1">
        <h3 className="line-clamp-1 text-sm font-semibold">{post.title}</h3>
        <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          <span>by {post.author}</span>
          <span>•</span>
          <span>{post.cuisine}</span>
          {post.isRecipe && (
            <>
              <span>•</span>
              <span className="text-emerald-600">Recipe</span>
            </>
          )}
        </div>
      </div>
    </article>
  );
}

// Empty state
function EmptyState({ onReset }: { onReset: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-lg border py-16 text-center">
      <p className="text-sm text-muted-foreground">No posts match these filters.</p>
      <Button className="mt-3" variant="secondary" onClick={onReset}>
        Reset filters
      </Button>
    </div>
  );
}
