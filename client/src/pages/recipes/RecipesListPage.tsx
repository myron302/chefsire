import * as React from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { LayoutGrid, List } from "lucide-react";
import { useRecipesFilters } from "./useRecipesFilters";
import { RecipeTile, NonRecipeTile, EmptyState } from "./RecipesShared";

type DemoPost = {
  id: string;
  isRecipe?: boolean;
  image: string;
  title?: string;
  likes?: number;
  comments?: number;
  user?: { displayName?: string; avatar?: string };
  recipe?: {
    title: string;
    cookTime?: number;
    servings?: number;
    difficulty?: "Easy" | "Medium" | "Hard";
    cuisine?: string;
    ingredients: string[];
    instructions: string[];
    ratingSpoons?: number;
    dietTags?: string[];
    allergens?: string[];
  };
};

const DEMO: DemoPost[] = [
  {
    id: "r1",
    isRecipe: true,
    image: "https://images.unsplash.com/photo-1548365328-8b84986da7b3?q=80&w=1200&auto=format&fit=crop",
    user: { displayName: "Giulia" },
    recipe: {
      title: "Margherita Pizza",
      cookTime: 25,
      servings: 2,
      difficulty: "Easy",
      cuisine: "Italian",
      ingredients: ["Pizza dough","Tomato sauce","Mozzarella","Basil","Olive oil","Salt"],
      instructions: ["Preheat","Assemble","Bake"],
      ratingSpoons: 5,
      dietTags: ["Vegetarian"],
      allergens: ["Gluten","Dairy"],
    },
  },
  {
    id: "n1",
    isRecipe: false,
    image: "https://images.unsplash.com/photo-1604154692294-165459c8c9b5?q=80&w=1200&auto=format&fit=crop",
    title: "Street Food Reel",
    likes: 412,
    comments: 34,
    user: { displayName: "Diego" },
  },
  {
    id: "r2",
    isRecipe: true,
    image: "https://images.unsplash.com/photo-1541781286675-09c7e9d404bc?q=80&w=1200&auto=format&fit=crop",
    user: { displayName: "Noah" },
    recipe: {
      title: "Choco Truffles",
      cookTime: 45,
      servings: 6,
      difficulty: "Medium",
      cuisine: "Desserts",
      ingredients: ["Dark chocolate","Cream","Butter","Cocoa","Salt"],
      instructions: ["Heat cream","Mix","Chill & roll"],
      ratingSpoons: 5,
      dietTags: ["Vegetarian"],
      allergens: ["Dairy"],
    },
  },
];

export default function RecipesListPage() {
  const { state } = useRecipesFilters();
  const [view, setView] = React.useState<"grid" | "list">("grid");

  // In the future replace DEMO with react-query using `state`
  const items = React.useMemo(() => DEMO, [state]);

  return (
    <div className="mx-auto max-w-6xl px-4 md:px-6 py-4 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Recipes</h1>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Badge variant="outline">Cuisines: {state.cuisines.length}</Badge>
          <Badge variant="outline">Meal Types: {state.mealTypes.length}</Badge>
          <Badge variant="outline">Dietary: {state.dietary.length}</Badge>
          {state.difficulty && <Badge variant="outline">Difficulty: {state.difficulty}</Badge>}
        </div>
        <div className="ml-auto flex gap-2">
          <Button variant={view === "grid" ? "default" : "outline"} onClick={() => setView("grid")} className="gap-2">
            <LayoutGrid className="h-4 w-4" /> Grid
          </Button>
          <Button variant={view === "list" ? "default" : "outline"} onClick={() => setView("list")} className="gap-2">
            <List className="h-4 w-4" /> List
          </Button>
        </div>
      </div>

      {items.length === 0 ? (
        <EmptyState />
      ) : view === "grid" ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          {items.map((p) =>
            p.isRecipe ? <RecipeTile key={p.id} post={p} /> : <NonRecipeTile key={p.id} post={p} />
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {items.map((p) =>
            p.isRecipe ? <RecipeTile key={p.id} post={p} /> : <NonRecipeTile key={p.id} post={p} />
          )}
        </div>
      )}
    </div>
  );
}
