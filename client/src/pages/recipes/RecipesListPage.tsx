// client/src/pages/recipes/RecipesListPage.tsx
import * as React from "react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Loader2, LayoutGrid, List } from "lucide-react";
import type { ContentSourceFilter } from "@shared/content-source";
import type { RecipeItem } from "./lib/recipeList.types";
import { RecipeModal } from "./components/RecipeModal";
import { RecipesResults } from "./components/RecipesResults";
import { RecipesToolbar } from "./components/RecipesToolbar";
import { useInfiniteScrollSentinel } from "./hooks/useInfiniteScrollSentinel";
import { useRecipesFilters } from "./useRecipesFilters";
import {
  DEFAULT_PAGE_SIZE,
  getQueryTermFromUrlSearch,
  fetchRandomRecipes,
  fetchSearchRecipes,
  getSourceFilterFromUrlParam,
  hasRecipeSearchFilters,
} from "./lib/recipeSearchApi";

export default function RecipesListPage() {
  const [q, setQ] = React.useState("");
  const [sourceFilter, setSourceFilter] = React.useState<ContentSourceFilter>("all");
  const [loading, setLoading] = React.useState(false);
  const [isFetchingNext, setIsFetchingNext] = React.useState(false);
  const [err, setErr] = React.useState<string | null>(null);
  const [items, setItems] = React.useState<RecipeItem[]>([]);
  const [selectedRecipe, setSelectedRecipe] = React.useState<RecipeItem | null>(null);
  const [view, setView] = React.useState<"grid" | "list">("grid");
  const [hasMore, setHasMore] = React.useState(true);
  const [offset, setOffset] = React.useState(0); // used only for q-mode
  const { state: filterState, setQ: setFilterQuery } = useRecipesFilters();

  const activeFilters = React.useMemo(
    () => ({
      cuisines: filterState.cuisines,
      ethnicities: filterState.ethnicities,
      dietary: filterState.dietary,
      mealTypes: filterState.mealTypes,
    }),
    [filterState.cuisines, filterState.ethnicities, filterState.dietary, filterState.mealTypes]
  );

  const hasStructuredFilters = hasRecipeSearchFilters(activeFilters);

  // initial load: read ?q=, run search or random
  React.useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const urlQuery = getQueryTermFromUrlSearch(window.location.search);
    const source = getSourceFilterFromUrlParam(params.get("source"));

    setSourceFilter(source);

    if (urlQuery) {
      setQ(urlQuery);
      setFilterQuery(urlQuery);
      startNewSearch(urlQuery, source);
    } else if (hasStructuredFilters) {
      startNewSearch("", source);
    } else {
      startRandom(source); // initial random
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // when advanced filters change on /recipes/filters and user comes back, re-run current mode safely
  React.useEffect(() => {
    // avoid override during initial load
    if (loading) return;

    if (q.trim() || hasStructuredFilters) {
      startNewSearch(q, sourceFilter);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasStructuredFilters, filterState.cuisines, filterState.ethnicities, filterState.dietary, filterState.mealTypes]);

  // ---- mode runners
  async function startRandom(source: ContentSourceFilter = sourceFilter) {
    if (loading) return;
    setLoading(true);
    setErr(null);
    setItems([]);
    setHasMore(true);
    setOffset(0);
    try {
      const first = await fetchRandomRecipes({ count: DEFAULT_PAGE_SIZE, source });
      setItems(first);
      // always allow more in random mode (you can cap if you want)
      setHasMore(true);
    } catch (e: any) {
      setErr(e?.message || "Something went wrong");
      setItems([]);
      setHasMore(false);
    } finally {
      setLoading(false);
    }
  }

  async function startNewSearch(term: string, source: ContentSourceFilter = sourceFilter) {
    if (loading) return;
    setLoading(true);
    setErr(null);
    setItems([]);
    setHasMore(true);
    setOffset(0);
    try {
      const first = await fetchSearchRecipes({
        term,
        pageOffset: 0,
        pageSize: DEFAULT_PAGE_SIZE,
        source,
        filters: activeFilters,
      });
      setItems(first);
      setOffset(first.length);
      setHasMore(first.length === DEFAULT_PAGE_SIZE);
    } catch (e: any) {
      setErr(e?.message || "Something went wrong");
      setItems([]);
      setHasMore(false);
    } finally {
      setLoading(false);
    }
  }

  async function loadMore() {
    if (isFetchingNext || loading || !hasMore) return;
    // RANDOM mode (no q) => just fetch another random page, append
    if (!q.trim() && !hasStructuredFilters) {
      try {
        setIsFetchingNext(true);
        const next = await fetchRandomRecipes({ count: DEFAULT_PAGE_SIZE, source: sourceFilter });
        setItems((prev) => [...prev, ...next]);
        // keep hasMore true for endless random; cap if desired
      } catch (e: any) {
        setErr(e?.message || "Something went wrong");
      } finally {
        setIsFetchingNext(false);
      }
      return;
    }

    // SEARCH mode => use offset pagination
    try {
      setIsFetchingNext(true);
      const next = await fetchSearchRecipes({
        term: q,
        pageOffset: offset,
        pageSize: DEFAULT_PAGE_SIZE,
        source: sourceFilter,
        filters: activeFilters,
      });
      setItems((prev) => [...prev, ...next]);
      setOffset((prev) => prev + next.length);
      setHasMore(next.length === DEFAULT_PAGE_SIZE);
    } catch (e: any) {
      setErr(e?.message || "Something went wrong");
    } finally {
      setIsFetchingNext(false);
    }
  }

  const sentinelRef = useInfiniteScrollSentinel(loadMore, [hasMore, loading, isFetchingNext, q, sourceFilter]);

  // ---- Handlers
  const handleSearchClick = () => {
    setFilterQuery(q);
    if (q.trim()) startNewSearch(q);
    else if (hasStructuredFilters) startNewSearch("");
    else startRandom();
  };

  const handleSourceChange = (source: ContentSourceFilter) => {
    setSourceFilter(source);
    if (q.trim() || hasStructuredFilters) {
      startNewSearch(q, source);
    } else {
      startRandom(source);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 py-6">
      <div className="flex items-center justify-between gap-3 mb-4">
        <h1 className="text-2xl font-bold">Recipes</h1>
        <div className="flex gap-2">
          <Button variant={view === "grid" ? "default" : "outline"} onClick={() => setView("grid")} className="gap-2">
            <LayoutGrid className="h-4 w-4" />
            Grid
          </Button>
          <Button variant={view === "list" ? "default" : "outline"} onClick={() => setView("list")} className="gap-2">
            <List className="h-4 w-4" />
            List
          </Button>
          <Link href="/recipes/filters">
            <Button variant="outline">Filters</Button>
          </Link>
        </div>
      </div>

      <RecipesToolbar
        q={q}
        sourceFilter={sourceFilter}
        onQueryChange={(nextQ) => {
          setQ(nextQ);
          setFilterQuery(nextQ);
        }}
        onSearch={handleSearchClick}
        onRandom={() => startRandom()}
        onSourceChange={handleSourceChange}
      />

      <RecipesResults
        loading={loading}
        err={err}
        items={items}
        view={view}
        onCardClick={setSelectedRecipe}
      />

      {/* Sentinel for infinite scroll */}
      <div ref={sentinelRef} className="h-10" />

      {/* Loading more indicator */}
      {(loading && items.length > 0) || isFetchingNext ? (
        <div className="flex items-center justify-center py-6 text-sm text-muted-foreground">
          <Loader2 className="w-4 h-4 animate-spin mr-2" /> Loading more…
        </div>
      ) : null}

      {/* No more results (for search mode) */}
      {!q.trim() && !hasStructuredFilters ? null : !hasMore && items.length > 0 ? (
        <div className="text-center py-8 text-muted-foreground">No more recipes to load</div>
      ) : null}

      <RecipeModal r={selectedRecipe} isOpen={!!selectedRecipe} onClose={() => setSelectedRecipe(null)} />
    </div>
  );
}
