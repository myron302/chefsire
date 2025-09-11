import * as React from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { LayoutGrid, List, Filter } from "lucide-react";
import { useExploreFilters, ViewMode, MealType, Difficulty } from "./useExploreFilters";
import { SpoonIcon } from "./ExploreShared";

/* Demo post type & data; swap to your data source */
type Post = {
  id: string;
  title: string;
  image: string;
  cuisine: string;
  isRecipe: boolean;
  author: string;
  cookTime: number;
  difficulty: Difficulty;
  rating: number;
  likes: number;
  mealType: MealType;
  dietary: string[];
  ethnicity: string[];
  allergens: string[];
  preparation?: string[];
  createdAt: string;
};

const DEMO_POSTS: Post[] = [
  // ... same demo data you had before ...
];

const GridCard = React.memo(function GridCard({ post }: { post: Post }) {
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

const ListRow = React.memo(function ListRow({ post }: { post: Post }) {
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
  const nav = useNavigate();
  const {
    viewMode, setViewMode,
    onlyRecipes, setOnlyRecipes,
    sortBy, setSortBy,
    selectedCuisines, selectedMealTypes, selectedDietary,
    selectedDifficulty, maxCookTime, minRating,
    selectedEthnicities, excludedAllergens, selectedPreparation,
    resetFilters,
  } = useExploreFilters();

  const posts = DEMO_POSTS;

  const filteredPosts = React.useMemo(() => {
    const filtered = posts.filter((p) => {
      if (onlyRecipes && !p.isRecipe) return false;
      if (selectedCuisines.length && !selectedCuisines.includes(p.cuisine)) return false;
      if (selectedMealTypes.length && !selectedMealTypes.includes(p.mealType)) return false;
      if (selectedDietary.length && !selectedDietary.every((d) => p.dietary.includes(d))) return false;
      if (selectedDifficulty && p.difficulty !== selectedDifficulty) return false;
      if (maxCookTime && p.cookTime > maxCookTime) return false;
      if (minRating && p.rating < minRating) return false;
      if (selectedEthnicities.length) {
        if (!p.ethnicity?.some((e) => selectedEthnicities.includes(e))) return false;
      }
      if (excludedAllergens.length) {
        if (p.allergens?.some((a) => excludedAllergens.includes(a))) return false;
      }
      if (selectedPreparation.length) {
        if (!selectedPreparation.every((tag) => p.preparation?.includes(tag))) return false;
      }
      return true;
    });

    switch (sortBy) {
      case "rating": return [...filtered].sort((a, b) => b.rating - a.rating);
      case "likes":  return [...filtered].sort((a, b) => b.likes - a.likes);
      default:       return [...filtered].sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt));
    }
  }, [
    posts, onlyRecipes, selectedCuisines, selectedMealTypes, selectedDietary,
    selectedDifficulty, maxCookTime, minRating, sortBy,
    selectedEthnicities, excludedAllergens, selectedPreparation,
  ]);

  return (
    <div className="mx-auto max-w-6xl px-4 md:px-6">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-2xl font-bold">Explore</h1>
        <div className="flex gap-2">
          <Button variant="outline" className="gap-2" onClick={() => nav("/explore/filters")}>
            <Filter className="h-4 w-4" />
            Filters
          </Button>
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
          <span className="inline-flex items-center gap-1"><SpoonIcon className="h-3.5 w-3.5" /> {minRating}+</span>
        </Badge>
        <Badge variant="outline">Sort: {sortBy}</Badge>
        <Button size="sm" variant="ghost" className="h-7 px-2" onClick={resetFilters}>
          Reset
        </Button>
      </div>

      {/* Results */}
      {filteredPosts.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-lg border py-16 text-center">
          <p className="text-sm text-muted-foreground">No posts match these filters.</p>
          <Button className="mt-3" variant="secondary" onClick={resetFilters}>
            Reset filters
          </Button>
        </div>
      ) : viewMode === "grid" ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          {filteredPosts.map((p) => <GridCard key={p.id} post={p} />)}
        </div>
      ) : (
        <div className="space-y-3">
          {filteredPosts.map((p) => <ListRow key={p.id} post={p} />)}
        </div>
      )}
    </div>
  );
}
