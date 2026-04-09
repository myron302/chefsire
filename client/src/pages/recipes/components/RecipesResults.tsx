import { Loader2 } from "lucide-react";
import type { RecipeItem } from "../lib/recipeList.types";
import { RecipeCard } from "./RecipeCard";

export function RecipesResults({
  loading,
  err,
  items,
  view,
  onCardClick,
}: {
  loading: boolean;
  err: string | null;
  items: RecipeItem[];
  view: "grid" | "list";
  onCardClick: (recipe: RecipeItem) => void;
}) {
  if (loading && items.length === 0) {
    return (
      <div className="flex items-center gap-2 text-muted-foreground">
        <Loader2 className="w-4 h-4 animate-spin" />
        Loading recipes…
      </div>
    );
  }

  if (err) {
    return <div className="text-destructive">Error: {err}</div>;
  }

  if (items.length === 0) {
    return <div className="text-muted-foreground">No recipes found. Try a different search or click Random.</div>;
  }

  if (view === "grid") {
    return (
      <div className="grid gap-4 grid-cols-1 xs:grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
        {items.map((r) => (
          <RecipeCard key={r.id} r={r} onCardClick={onCardClick} />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {items.map((r) => (
        <div key={r.id} className="w-full">
          <RecipeCard r={r} onCardClick={onCardClick} />
        </div>
      ))}
    </div>
  );
}
