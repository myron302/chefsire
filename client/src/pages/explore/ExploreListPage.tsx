import * as React from "react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { LayoutGrid, List, Filter, RefreshCw } from "lucide-react";
import { useExploreFilters } from "./useExploreFilters";
import { SpoonIcon } from "./ExploreShared";
import { useExploreData } from "./useExploreData";

function GridSkeleton() {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
      {Array.from({ length: 8 }).map((_, i) => (
        <div key={i} className="overflow-hidden rounded-lg border bg-card animate-pulse">
          <div className="aspect-square bg-muted" />
          <div className="p-3 space-y-2">
            <div className="h-4 w-3/4 bg-muted rounded" />
            <div className="h-3 w-1/2 bg-muted rounded" />
          </div>
        </div>
      ))}
    </div>
  );
}

type CardPost = {
  id: string;
  title: string;
  image: string;
  cuisine: string;
  isRecipe: boolean;
  author: string;
  cookTime: number;
  rating: number;
  difficulty: string;
  mealType: string;
  dietary: string[];
};

const GridCard = React.memo(function GridCard({ post }: { post: CardPost }) {
  return (
    <article className="overflow-hidden rounded-lg border bg-card">
      <div className="aspect-square overflow-hidden">
        <img src={post.image} alt={post.title} className="h-full w-full object-cover" loading="lazy" />
      </div>
      <div className="p-3">
        <h3 className="line-clamp-1 text-sm font-semibold">{post.title}</h3>
        <div className="mt-1 flex items-center justify-between">
          <span className="text-xs text-muted-foreground">{post.author}</span>
          <Badge variant="outline" className="text-xs">
            {post.cuisine}
          </Badge>
        </div>
        <div className="mt-1 flex items-center justify-between text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-1">
            <SpoonIcon className="h-3.5 w-3.5" /> {post.rating.toFixed(1)}
          </span>
          <span>{post.cookTime} min</span>
        </div>
        {post.isRecipe && (
          <span className="mt-2 inline-block text-[10px] uppercase tracking-wide text-emerald-600">
            Recipe
          </span>
        )}
      </div>
    </article>
  );
});

const ListRow = React.memo(function ListRow({ post }: { post: CardPost }) {
  return (
    <article className="flex gap-3 rounded-lg border bg-card p-2">
      <div className="h-20 w-20 shrink-0 overflow-hidden rounded-md">
        <img src={post.image} alt={post.title} className="h-full w-full object-cover" loading="lazy" />
      </div>
      <div className="min-w-0 flex-1">
        <h3 className="line-clamp-1 text-sm font-semibold">{post.title}</h3>
        <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          <span>by {post.author}</span>
          <span>• {post.cuisine}</span>
          <span>• {post.mealType}</span>
          {post.dietary.length > 0 && <span>• {post.dietary.join(", ")}</span>}
        </div>
        <div className="mt-1 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-1">
            <SpoonIcon className="h-3.5 w-3.5" /> {post.rating.toFixed(1)}
          </span>
          <span>{post.cookTime} min</span>
          <span>{post.difficulty}</span>
          {post.isRecipe && <span className="text-emerald-600">Recipe</span>}
        </div>
      </div>
    </article>
  );
});

export default function ExploreListPage() {
  const {
    viewMode, setViewMode,
    onlyRecipes, sortBy,
    selectedCuisines, selectedMealTypes, selectedDietary,
    selectedDifficulty, maxCookTime, minRating,
    selectedEthnicities, excludedAllergens, selectedPreparation,
    resetFilters,
  } = useExploreFilters();

  const {
    items: posts,
    total,
    isLoading,
    isFetching,
    isError,
    error,
    refetch,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useExploreData();

  return (
    <div className="mx-auto max-w-6xl px-4 md:px-6">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-2xl font-bold">Explore</h1>
        <div className="flex gap-2">
          <Link href="/explore/filters">
            <Button variant="outline" className="gap-2">
              <Filter className="h-4 w-4" />
              Filters
            </Button>
          </Link>
          <Button
            variant={viewMode === "grid" ? "default" : "outline"}
            onClick={() => setViewMode("grid")}
            className="gap-2"
          >
            <LayoutGrid className="h-4 w-4" /> Grid
          </Button>
          <Button
            variant={viewMode === "list" ? "default" : "outline"}
            onClick={() => setViewMode("list")}
            className="gap-2"
          >
            <List className="h-4 w-4" /> List
          </Button>
        </div>
      </div>

      {/* Active filter summary */}
      <div className="mb-3 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
        <Badge variant="outline">Cuisines: {selectedCuisines.length}</Badge>
        <Badge variant="outline">Meal Types: {selectedMealTypes.length}</Badge>
        <Badge variant="outline">Dietary: {selectedDietary.length}</Badge>
        <Badge variant="outline">Ethnicity: {selectedEthnicities.length}</Badge>
        <Badge variant="outline">Standards: {selectedPreparation.length}</Badge>
        <Badge variant="outline">No {excludedAllergens.length ? excludedAllergens.join(", ") : "—"}</Badge>
        {selectedDifficulty && <Badge variant="outline">Difficulty: {selectedDifficulty}</Badge>}
        {onlyRecipes && <Badge variant="outline">Recipe-only</Badge>}
        <Badge variant="outline">≤ {maxCookTime} min</Badge>
        <Badge variant="outline">
          <span className="inline-flex items-center gap-1">
            <SpoonIcon className="h-3.5 w-3.5" /> {minRating}+
          </span>
        </Badge>
        <Badge variant="outline">Sort: {sortBy}</Badge>
        <Button size="sm" variant="ghost" className="h-7 px-2" onClick={resetFilters}>
          Reset
        </Button>
      </div>

      {/* Loading / Error / Content */}
      {isLoading ? (
        <GridSkeleton />
      ) : isError ? (
        <div className="flex flex-col items-center justify-center rounded-lg border py-16 text-center">
          <p className="mb-3 text-sm text-destructive">
            {(error as Error)?.message || "Failed to load posts."}
          </p>
          <Button onClick={() => refetch()} variant="outline" className="gap-2">
            <RefreshCw className="h-4 w-4" /> Try again
          </Button>
        </div>
      ) : posts.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-lg border py-16 text-center">
          <p className="text-sm text-muted-foreground">No posts match these filters.</p>
          <Button className="mt-3" variant="secondary" onClick={resetFilters}>
            Reset filters
          </Button>
        </div>
      ) : viewMode === "grid" ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          {posts.map((p) => (
            <GridCard
              key={p.id}
              post={{
                id: p.id,
                title: p.title,
                image: p.image,
                cuisine: p.cuisine,
                isRecipe: p.isRecipe,
                author: p.author,
                cookTime: p.cookTime,
                rating: p.rating,
                difficulty: p.difficulty,
                mealType: p.mealType,
                dietary: p.dietary,
              }}
            />
          ))}
        </div>
      ) : (
        <div className="space-y-3">
          {posts.map((p) => (
            <ListRow
              key={p.id}
              post={{
                id: p.id,
                title: p.title,
                image: p.image,
                cuisine: p.cuisine,
                isRecipe: p.isRecipe,
                author: p.author,
                cookTime: p.cookTime,
                rating: p.rating,
                difficulty: p.difficulty,
                mealType: p.mealType,
                dietary: p.dietary,
              }}
            />
          ))}
        </div>
      )}

      {/* Load more */}
      {posts.length > 0 && (
        <div className="flex justify-center my-6">
          {hasNextPage ? (
            <Button onClick={() => fetchNextPage()} disabled={isFetchingNextPage} variant="outline">
              {isFetchingNextPage ? "Loading…" : "Load more"}
            </Button>
          ) : (
            <p className="text-sm text-muted-foreground">
              {isFetching ? "Loading…" : "You’re all caught up."}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
