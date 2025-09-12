// client/src/pages/explore/ExploreListPage.tsx
import * as React from "react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { LayoutGrid, List, Filter, RefreshCw } from "lucide-react";
import { useExploreFilters } from "./useExploreFilters";
import { SpoonIcon } from "./ExploreShared";
import { useExploreData } from "./useExploreData";

/* ---------- tiny helper to move the longest badge to row 2 on mobile ---------- */
function MobileRowBalancer({
  badges,
}: {
  badges: { key: string; node: React.ReactNode; labelForLength: string }[];
}) {
  if (badges.length <= 3) {
    return (
      <div className="mb-3 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
        {badges.map((b) => (
          <React.Fragment key={b.key}>{b.node}</React.Fragment>
        ))}
      </div>
    );
  }

  const longest = badges.reduce((acc, cur) =>
    cur.labelForLength.length > acc.labelForLength.length ? cur : acc
  );

  const firstRow = badges.filter((b) => b !== longest);
  const secondRow = [longest]; // put the single longest first on row 2

  return (
    <div className="mb-3 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
      {/* Row 1 (mobile) */}
      {firstRow.map((b) => (
        <React.Fragment key={b.key}>{b.node}</React.Fragment>
      ))}
      {/* force line break only on small screens */}
      <div className="basis-full sm:hidden" />
      {/* Row 2 (mobile); on desktop they all just flow inline */}
      {secondRow.map((b) => (
        <React.Fragment key={b.key}>{b.node}</React.Fragment>
      ))}
    </div>
  );
}
/* ----------------------------------------------------------------------------- */

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
  id: string | number;
  title?: string;
  image?: string | null;
  cuisine?: string;
  isRecipe?: boolean;
  author?: string;
  cookTime?: number;
  rating?: number;
  difficulty?: string;
  mealType?: string;
  dietary?: string[];
};

const PLACEHOLDER_IMG = "data:image/gif;base64,R0lGODlhAQABAAAAACw=";

/* Normalize any backend post shape → UI CardPost
   - handles imageUrl/photoUrl
   - handles author under user.displayName/username
   - provides safe fallbacks so cards never crash
*/
function toCardPost(p: any): CardPost {
  return {
    id: p?.id != null ? String(p.id) : "",
    title: p?.title ?? p?.caption ?? "Untitled",
    image: p?.image ?? p?.imageUrl ?? p?.photoUrl ?? null,
    cuisine: p?.cuisine ?? p?.category ?? "—",
    isRecipe: Boolean(p?.isRecipe),
    author: p?.author ?? p?.user?.displayName ?? p?.user?.username ?? "Unknown",
    cookTime: typeof p?.cookTime === "number" ? p.cookTime : 0,
    rating: typeof p?.rating === "number" ? p.rating : 0,
    difficulty: p?.difficulty ?? "—",
    mealType: p?.mealType ?? "—",
    dietary: Array.isArray(p?.dietary) ? p.dietary : [],
  };
}

const GridCard = React.memo(function GridCard({ post }: { post: CardPost }) {
  const title = post.title ?? "Untitled";
  const image = post.image ?? PLACEHOLDER_IMG;
  const cuisine = post.cuisine ?? "—";
  const author = post.author ?? "Unknown";
  const cookTime = typeof post.cookTime === "number" ? post.cookTime : 0;
  const rating = typeof post.rating === "number" ? post.rating : 0;

  return (
    <article className="overflow-hidden rounded-lg border bg-card">
      <div className="aspect-square overflow-hidden">
        <img src={image} alt={title} className="h-full w-full object-cover" loading="lazy" />
      </div>
      <div className="p-3">
        <h3 className="line-clamp-1 text-sm font-semibold">{title}</h3>
        <div className="mt-1 flex items-center justify-between">
          <span className="text-xs text-muted-foreground">{author}</span>
          <Badge variant="outline" className="text-xs">
            {cuisine}
          </Badge>
        </div>
        <div className="mt-1 flex items-center justify-between text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-1">
            <SpoonIcon className="h-3.5 w-3.5" /> {rating.toFixed(1)}
          </span>
          <span>{cookTime} min</span>
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
  const title = post.title ?? "Untitled";
  const image = post.image ?? PLACEHOLDER_IMG;
  const cuisine = post.cuisine ?? "—";
  const author = post.author ?? "Unknown";
  const cookTime = typeof post.cookTime === "number" ? post.cookTime : 0;
  const rating = typeof post.rating === "number" ? post.rating : 0;
  const difficulty = post.difficulty ?? "—";
  const mealType = post.mealType ?? "—";
  const dietary = Array.isArray(post.dietary) ? post.dietary : [];

  return (
    <article className="flex gap-3 rounded-lg border bg-card p-2">
      <div className="h-20 w-20 shrink-0 overflow-hidden rounded-md">
        <img src={image} alt={title} className="h-full w-full object-cover" loading="lazy" />
      </div>
      <div className="min-w-0 flex-1">
        <h3 className="line-clamp-1 text-sm font-semibold">{title}</h3>
        <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          <span>by {author}</span>
          <span>• {cuisine}</span>
          <span>• {mealType}</span>
          {dietary.length > 0 && <span>• {dietary.join(", ")}</span>}
        </div>
        <div className="mt-1 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-1">
            <SpoonIcon className="h-3.5 w-3.5" /> {rating.toFixed(1)}
          </span>
          <span>{cookTime} min</span>
          <span>{difficulty}</span>
          {post.isRecipe && <span className="text-emerald-600">Recipe</span>}
        </div>
      </div>
    </article>
  );
});

export default function ExploreListPage() {
  const {
    viewMode,
    setViewMode,
    onlyRecipes,
    sortBy,
    selectedCuisines,
    selectedMealTypes,
    selectedDietary,
    selectedDifficulty,
    maxCookTime,
    minRating,
    selectedEthnicities,
    excludedAllergens,
    selectedPreparation,
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

  // Build the badge list once, so MobileRowBalancer can move the longest to row 2
  const badges = React.useMemo(
    () => [
      {
        key: "cuisines",
        node: <Badge variant="outline">Cuisines: {selectedCuisines.length}</Badge>,
        labelForLength: "Cuisines",
      },
      {
        key: "meals",
        node: <Badge variant="outline">Meal Types: {selectedMealTypes.length}</Badge>,
        labelForLength: "Meal Types",
      },
      {
        key: "diets",
        node: <Badge variant="outline">Dietary: {selectedDietary.length}</Badge>,
        labelForLength: "Dietary",
      },
      {
        key: "eth",
        node: <Badge variant="outline">Ethnicity: {selectedEthnicities.length}</Badge>,
        labelForLength: "Ethnicity",
      },
      {
        key: "std",
        node: <Badge variant="outline">Standards: {selectedPreparation.length}</Badge>,
        labelForLength: "Standards",
      },
      {
        key: "all",
        node: (
          <Badge variant="outline">
            No {excludedAllergens.length ? excludedAllergens.join(", ") : "—"}
          </Badge>
        ),
        labelForLength: excludedAllergens.join(", ") || "None",
      },
      ...(selectedDifficulty
        ? [
            {
              key: "diff",
              node: <Badge variant="outline">Difficulty: {selectedDifficulty}</Badge>,
              labelForLength: selectedDifficulty,
            },
          ]
        : []),
      ...(onlyRecipes
        ? [
            {
              key: "recipe",
              node: <Badge variant="outline">Recipe-only</Badge>,
              labelForLength: "Recipe-only",
            },
          ]
        : []),
      {
        key: "time",
        node: <Badge variant="outline">≤ {maxCookTime} min</Badge>,
        labelForLength: `${maxCookTime} min`,
      },
      {
        key: "rating",
        node: (
          <Badge variant="outline">
            <span className="inline-flex items-center gap-1">
              <SpoonIcon className="h-3.5 w-3.5" /> {minRating}+
            </span>
          </Badge>
        ),
        labelForLength: `${minRating} spoons`,
      },
      {
        key: "sort",
        node: <Badge variant="outline">Sort: {sortBy}</Badge>,
        labelForLength: `Sort: ${sortBy}`,
      },
      {
        key: "reset",
        node: (
          <Button size="sm" variant="ghost" className="h-7 px-2" onClick={resetFilters}>
            Reset
          </Button>
        ),
        labelForLength: "Reset",
      },
    ],
    [
      selectedCuisines,
      selectedMealTypes,
      selectedDietary,
      selectedEthnicities,
      selectedPreparation,
      excludedAllergens,
      selectedDifficulty,
      onlyRecipes,
      maxCookTime,
      minRating,
      sortBy,
      resetFilters,
    ]
  );

  // Defensive rendering: ignore null/undefined and items without an id
  const safePosts = React.useMemo(
    () => (posts || []).filter((p: any) => p && p.id != null),
    [posts]
  );

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

      {/* Active filter summary — mobile rebalance to move the longest to row 2 */}
      <MobileRowBalancer badges={badges} />

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
      ) : safePosts.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-lg border py-16 text-center">
          <p className="text-sm text-muted-foreground">No posts match these filters.</p>
          <Button className="mt-3" variant="secondary" onClick={resetFilters}>
            Reset filters
          </Button>
        </div>
      ) : viewMode === "grid" ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          {safePosts.map((raw: any) => {
            const p = toCardPost(raw);
            return (
              <GridCard
                key={String(p.id)}
                post={{
                  ...p,
                  image: p.image ?? PLACEHOLDER_IMG,
                }}
              />
            );
          })}
        </div>
      ) : (
        <div className="space-y-3">
          {safePosts.map((raw: any) => {
            const p = toCardPost(raw);
            return (
              <ListRow
                key={String(p.id)}
                post={{
                  ...p,
                  image: p.image ?? PLACEHOLDER_IMG,
                }}
              />
            );
          })}
        </div>
      )}

      {/* Load more */}
      {safePosts.length > 0 && (
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
