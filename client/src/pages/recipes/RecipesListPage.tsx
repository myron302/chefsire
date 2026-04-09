// client/src/pages/recipes/RecipesListPage.tsx
import * as React from "react";
import { Link } from "wouter";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Loader2, LayoutGrid, List } from "lucide-react";
import { CONTENT_SOURCE_LABELS, type ContentSourceFilter } from "@shared/content-source";
import type { RecipeItem, SearchResponse } from "./lib/recipeList.types";
import { RecipeModal } from "./components/RecipeModal";
import { RecipesResults } from "./components/RecipesResults";
import { useInfiniteScrollSentinel } from "./hooks/useInfiniteScrollSentinel";

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

  // initial load: read ?q=, run search or random
  React.useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const urlQuery = params.get("q");
    const sourceFromUrl = params.get("source");
    if (sourceFromUrl === "chefsire" || sourceFromUrl === "external" || sourceFromUrl === "all") {
      setSourceFilter(sourceFromUrl);
    }
    if (urlQuery) {
      setQ(urlQuery);
      startNewSearch(urlQuery, (sourceFromUrl === "chefsire" || sourceFromUrl === "external" || sourceFromUrl === "all") ? sourceFromUrl : "all");
    } else {
      startRandom((sourceFromUrl === "chefsire" || sourceFromUrl === "external" || sourceFromUrl === "all") ? sourceFromUrl : "all"); // initial random
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ---- API helpers
  async function fetchRandom(count = 24, source: ContentSourceFilter = sourceFilter) {
    const params = new URLSearchParams();
    params.set("count", String(count));
    params.set("source", source);
    const res = await fetch(`/api/recipes/random?${params.toString()}`);
    const json = (await res.json()) as SearchResponse;
    if (!res.ok || !("ok" in json) || json.ok === false) {
      const msg = (json as any)?.error || (await res.text()) || `Request failed (${res.status})`;
      throw new Error(msg);
    }
    return json.items || [];
  }

  async function fetchSearch(term: string, pageOffset: number, pageSize = 24, source: ContentSourceFilter = sourceFilter) {
    const params = new URLSearchParams();
    params.set("q", term.trim());
    params.set("pageSize", String(pageSize));
    params.set("offset", String(pageOffset));
    params.set("source", source);
    const res = await fetch(`/api/recipes/search?${params.toString()}`);
    const json = (await res.json()) as SearchResponse;
    if (!res.ok || !("ok" in json) || json.ok === false) {
      const msg = (json as any)?.error || (await res.text()) || `Request failed (${res.status})`;
      throw new Error(msg);
    }
    return json.items || [];
  }

  // ---- mode runners
  async function startRandom(source: ContentSourceFilter = sourceFilter) {
    if (loading) return;
    setLoading(true);
    setErr(null);
    setItems([]);
    setHasMore(true);
    setOffset(0);
    try {
      const first = await fetchRandom(24, source);
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
      const first = await fetchSearch(term, 0, 24, source);
      setItems(first);
      setOffset(first.length);
      setHasMore(first.length === 24);
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
    if (!q.trim()) {
      try {
        setIsFetchingNext(true);
        const next = await fetchRandom(24, sourceFilter);
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
      const next = await fetchSearch(q, offset, 24, sourceFilter);
      setItems((prev) => [...prev, ...next]);
      setOffset((prev) => prev + next.length);
      setHasMore(next.length === 24);
    } catch (e: any) {
      setErr(e?.message || "Something went wrong");
    } finally {
      setIsFetchingNext(false);
    }
  }

  const sentinelRef = useInfiniteScrollSentinel(loadMore, [hasMore, loading, isFetchingNext, q, sourceFilter]);

  // ---- Handlers
  const handleSearchClick = () => {
    if (q.trim()) startNewSearch(q);
    else startRandom();
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

      <div className="mb-4 flex flex-col sm:flex-row items-start sm:items-center gap-2">
        <Input
          placeholder="Search recipes…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleSearchClick()}
          className="flex-1 max-w-md"
          aria-label="Search recipes"
        />
        <div className="flex items-center gap-2 flex-wrap">
          <Button onClick={handleSearchClick}>Search</Button>
          <Button variant="ghost" onClick={() => startRandom()}>Random</Button>
          <Link href="/recipes/filters">
            <Button variant="ghost" className="whitespace-nowrap">Advanced filters</Button>
          </Link>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm text-muted-foreground">Source:</span>
          {(["all", "chefsire", "external"] as ContentSourceFilter[]).map((source) => (
            <Button
              key={source}
              size="sm"
              variant={sourceFilter === source ? "default" : "outline"}
              onClick={() => {
                setSourceFilter(source);
                if (q.trim()) {
                  startNewSearch(q, source);
                } else {
                  startRandom(source);
                }
              }}
            >
              {CONTENT_SOURCE_LABELS[source]}
            </Button>
          ))}
        </div>
      </div>

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
      {!q.trim() ? null : !hasMore && items.length > 0 ? (
        <div className="text-center py-8 text-muted-foreground">No more recipes to load</div>
      ) : null}

      <RecipeModal r={selectedRecipe} isOpen={!!selectedRecipe} onClose={() => setSelectedRecipe(null)} />
    </div>
  );
}
