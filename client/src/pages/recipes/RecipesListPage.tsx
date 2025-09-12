import * as React from "react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { LayoutGrid, List, Filter, RefreshCw } from "lucide-react";
import { useRecipesFilters } from "./useRecipesFilters";
import { RecipeTile, NonRecipeTile, EmptyState, SpoonIcon } from "./RecipesShared";

type DemoPost = {
  id: string;
  isRecipe?: boolean;
  image: string;
  title?: string;
  likes?: number;
  comments?: number;
  user?: { displayName?: string; avatar?: string };
  createdAt?: string;
  recipe?: {
    title: string;
    cookTime?: number;
    servings?: number;
    difficulty?: "Easy" | "Medium" | "Hard";
    cuisine?: string;
    mealType?: "Breakfast" | "Lunch" | "Dinner" | "Snack" | "Dessert";
    ingredients: string[];
    instructions: string[];
    ratingSpoons?: number;
    dietTags?: string[];
    allergens?: string[];   // ← used for exclusion
    ethnicities?: string[]; // ← intersection with selected ethnicities
  };
};

const DEMO: DemoPost[] = [
  {
    id: "r1",
    isRecipe: true,
    createdAt: "2025-09-08T12:00:00Z",
    image:
      "https://images.unsplash.com/photo-1548365328-8b84986da7b3?q=80&w=1200&auto=format&fit=crop",
    user: { displayName: "Giulia" },
    recipe: {
      title: "Margherita Pizza",
      cookTime: 25,
      servings: 2,
      difficulty: "Easy",
      cuisine: "Italian",
      mealType: "Dinner",
      ingredients: ["Pizza dough", "Tomato sauce", "Mozzarella", "Basil", "Olive oil", "Salt"],
      instructions: ["Preheat", "Assemble", "Bake"],
      ratingSpoons: 5,
      dietTags: ["Vegetarian", "Kosher"],
      allergens: ["Gluten", "Dairy"],
      ethnicities: ["Italian"],
    },
    likes: 223,
    comments: 18,
  },
  {
    id: "n1",
    isRecipe: false,
    createdAt: "2025-09-09T14:45:00Z",
    image:
      "https://images.unsplash.com/photo-1604154692294-165459c8c9b5?q=80&w=1200&auto=format&fit=crop",
    title: "Street Food Reel",
    likes: 412,
    comments: 34,
    user: { displayName: "Diego" },
  },
  {
    id: "r2",
    isRecipe: true,
    createdAt: "2025-09-05T18:30:00Z",
    image:
      "https://images.unsplash.com/photo-1541781286675-09c7e9d404bc?q=80&w=1200&auto=format&fit=crop",
    user: { displayName: "Noah" },
    recipe: {
      title: "Choco Truffles",
      cookTime: 45,
      servings: 6,
      difficulty: "Medium",
      cuisine: "Desserts",
      mealType: "Dessert",
      ingredients: ["Dark chocolate", "Cream", "Butter", "Cocoa", "Salt"],
      instructions: ["Heat cream", "Mix", "Chill & roll"],
      ratingSpoons: 5,
      dietTags: ["Vegetarian", "Halal"],
      allergens: ["Dairy"],
      ethnicities: ["French", "European (General)"],
    },
    likes: 512,
    comments: 61,
  },
  {
    id: "r3",
    isRecipe: true,
    createdAt: "2025-09-10T08:05:00Z",
    image:
      "https://images.unsplash.com/photo-1504754524776-8f4f37790ca0?q=80&w=1200&auto=format&fit=crop",
    user: { displayName: "Ivy" },
    recipe: {
      title: "Avocado Toast",
      cookTime: 8,
      servings: 1,
      difficulty: "Easy",
      cuisine: "Breakfast",
      mealType: "Breakfast",
      ingredients: ["Bread", "Avocado", "Lemon", "Chili flakes", "Salt", "Olive oil"],
      instructions: ["Toast bread", "Mash avocado with lemon", "Assemble and season"],
      ratingSpoons: 4,
      dietTags: ["Vegetarian"],
      allergens: ["Gluten"],
      ethnicities: ["Californian", "American (General)"],
    },
    likes: 77,
    comments: 4,
  },
  {
    id: "r4",
    isRecipe: true,
    createdAt: "2025-09-11T11:30:00Z",
    image:
      "https://images.unsplash.com/photo-1552332386-f8dd00dc2f85?q=80&w=1200&auto=format&fit=crop",
    user: { displayName: "Louis" },
    recipe: {
      title: "Shrimp Creole",
      cookTime: 35,
      servings: 4,
      difficulty: "Medium",
      cuisine: "Creole",
      mealType: "Dinner",
      ingredients: ["Shrimp","Tomatoes","Celery","Bell pepper","Onion","Spices","Rice"],
      instructions: ["Sauté trinity","Add tomatoes & spices","Simmer","Add shrimp","Serve over rice"],
      ratingSpoons: 5,
      dietTags: [],
      allergens: ["Shellfish"],
      ethnicities: ["Creole","Cajun","Southern / Soul Food"],
    },
    likes: 260,
    comments: 22,
  },
];

function intersects(a: string[] | undefined, b: string[]): boolean {
  if (!b.length) return true;
  if (!a || a.length === 0) return false;
  return b.some((x) => a.includes(x));
}
function includesAll(haystack: string[] | undefined, needles: string[]): boolean {
  if (!needles.length) return true;
  if (!haystack || haystack.length === 0) return false;
  return needles.every((n) => haystack.includes(n));
}
function excludesAny(haystack: string[] | undefined, disallow: string[]): boolean {
  if (!disallow.length) return true;
  if (!haystack || haystack.length === 0) return true;
  return !disallow.some((bad) => haystack.includes(bad));
}

export default function RecipesListPage() {
  const { state, reset } = useRecipesFilters();
  const [view, setView] = React.useState<"grid" | "list">("grid");

  const filtered = React.useMemo(() => {
    const items = DEMO.filter((p) => {
      if (state.onlyRecipes && !p.isRecipe) return false;
      const r = p.recipe;

      // Ethnicities: at least one must match
      if (!intersects(r?.ethnicities, state.ethnicities)) return false;

      // Cuisines exact
      if (state.cuisines.length && (!r?.cuisine || !state.cuisines.includes(r.cuisine))) return false;

      // Meal type
      if (state.mealTypes.length && (!r?.mealType || !state.mealTypes.includes(r.mealType))) return false;

      // Dietary: include ALL selected
      if (!includesAll(r?.dietTags || [], state.dietary)) return false;

      // Allergens: EXCLUDE any recipe that contains one of the selected allergens
      if (!excludesAny(r?.allergens || [], state.allergens)) return false;

      // Difficulty
      if (state.difficulty && r?.difficulty !== state.difficulty) return false;

      // Max cook
      if (r?.cookTime != null && state.maxCookTime && r.cookTime > state.maxCookTime) return false;

      // Min spoons
      if ((r?.ratingSpoons ?? 0) < (state.minSpoons || 0)) return false;

      return true;
    });

    switch (state.sortBy) {
      case "rating":
        return [...items].sort((a, b) => (b.recipe?.ratingSpoons ?? 0) - (a.recipe?.ratingSpoons ?? 0));
      case "likes":
        return [...items].sort((a, b) => (b.likes ?? 0) - (a.likes ?? 0));
      default:
        return [...items].sort(
          (a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime()
        );
    }
  }, [state]);

  const activeCount =
    (state.ethnicities.length ? 1 : 0) +
    (state.allergens.length ? 1 : 0) +
    (state.cuisines.length ? 1 : 0) +
    (state.mealTypes.length ? 1 : 0) +
    (state.dietary.length ? 1 : 0) +
    (state.difficulty ? 1 : 0) +
    (state.onlyRecipes ? 1 : 0) +
    (state.minSpoons ? 1 : 0) +
    (state.maxCookTime !== 60 ? 1 : 0) +
    (state.sortBy !== "newest" ? 1 : 0);

  return (
    <div className="mx-auto max-w-6xl px-4 md:px-6 py-4 space-y-4">
      <div className="flex items-center gap-2">
        <h1 className="text-2xl font-bold">Recipes</h1>

        {/* Active filters summary */}
        <div className="ml-2 flex flex-wrap items-center gap-1 text-xs text-muted-foreground">
          {state.ethnicities.length > 0 && <Badge variant="outline">Ethnicities: {state.ethnicities.length}</Badge>}
          {state.allergens.length > 0 && <Badge variant="outline">Allergens: {state.allergens.length} excluded</Badge>}
          {state.cuisines.length > 0 && <Badge variant="outline">Cuisines: {state.cuisines.length}</Badge>}
          {state.mealTypes.length > 0 && <Badge variant="outline">Meals: {state.mealTypes.length}</Badge>}
          {state.dietary.length > 0 && <Badge variant="outline">Dietary: {state.dietary.length}</Badge>}
          {state.difficulty && <Badge variant="outline">{state.difficulty}</Badge>}
          {state.onlyRecipes && <Badge variant="outline">Recipe-only</Badge>}
          {state.minSpoons > 0 && (
            <Badge variant="outline" className="inline-flex items-center gap-1">
              <SpoonIcon className="h-3 w-3" /> {state.minSpoons}+
            </Badge>
          )}
          {state.maxCookTime !== 60 && <Badge variant="outline">≤ {state.maxCookTime} min</Badge>}
        </div>

        {/* Right-side controls */}
        <div className="ml-auto flex gap-2">
          <Link href="/recipes/filters">
            <Button variant="outline" className="gap-2">
              <Filter className="h-4 w-4" />
              Filters
              {activeCount > 0 && (
                <Badge variant="secondary" className="ml-1">
                  {activeCount}
                </Badge>
              )}
            </Button>
          </Link>
          <Button
            variant={view === "grid" ? "default" : "outline"}
            onClick={() => setView("grid")}
            className="gap-2"
            title="Grid view"
          >
            <LayoutGrid className="h-4 w-4" /> Grid
          </Button>
          <Button
            variant={view === "list" ? "default" : "outline"}
            onClick={() => setView("list")}
            className="gap-2"
            title="List view"
          >
            <List className="h-4 w-4" /> List
          </Button>
          <Button variant="ghost" size="icon" title="Reset filters" onClick={reset}>
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Results */}
      {filtered.length === 0 ? (
        <EmptyState />
      ) : view === "grid" ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          {filtered.map((p) => (p.isRecipe ? <RecipeTile key={p.id} post={p} /> : <NonRecipeTile key={p.id} post={p} />))}
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((p) => (p.isRecipe ? <RecipeTile key={p.id} post={p} /> : <NonRecipeTile key={p.id} post={p} />))}
        </div>
      )}
    </div>
  );
}
