// client/src/pages/recipes/RecipesListPage.tsx
import * as React from "react";
import { Link } from "wouter";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, Clock, Users, ExternalLink, LayoutGrid, List } from "lucide-react";
import { SpoonRating } from "@/components/SpoonRating";

/** Very permissive shape — we'll normalize on the client */
type RecipeItem = {
  id: string;
  title: string;

  // images (varies by mapper)
  image?: string | null;
  imageUrl?: string | null;
  thumbnail?: string | null;

  // categorization
  cuisine?: string | null;
  mealType?: string | null;
  dietTags?: string[];

  // meta
  ratingSpoons?: number | null;
  cookTime?: number | null;
  servings?: number | null;

  // instructions (many possible shapes)
  instructions?: string | string[] | null;
  instruction?: string | string[] | null;
  steps?: string[] | { step?: string }[] | null;
  analyzedInstructions?: { steps?: { step?: string }[] }[] | null;
  strInstructions?: string | null; // raw MealDB sometimes leaks through

  // source links (varies by mapper)
  sourceUrl?: string | null;
  sourceURL?: string | null;
  source_link?: string | null;
  url?: string | null;
  source?: string | null; // sometimes a URL, sometimes just a label
};

type SearchOk = { ok: true; total?: number; source?: string; items: RecipeItem[]; hasMore?: boolean };
type SearchErr = { ok: false; error: string };
type SearchResponse = SearchOk | SearchErr;

// Removed old bland SVG spoon - now using emoji spoons from @/components/SpoonRating

/** Try hard to extract a readable instruction string - FIXED VERSION */
function extractInstructions(r: RecipeItem): string | null {
  if (r.strInstructions && typeof r.strInstructions === "string") {
    const cleaned = r.strInstructions.replace(/\s+/g, " ").trim();
    if (cleaned) return cleaned;
  }
  const direct = r.instructions ?? r.instruction ?? null;
  if (direct) {
    const s = Array.isArray(direct) ? direct.filter(Boolean).join(" ") : String(direct);
    const cleaned = s.replace(/\s+/g, " ").trim();
    if (cleaned) return cleaned;
  }
  if (Array.isArray(r.steps) && r.steps.length) {
    const got = r.steps
      .map((s: any) => (typeof s === "string" ? s : s?.step ?? ""))
      .filter(Boolean)
      .join(" ");
    const cleaned = got.replace(/\s+/g, " ").trim();
    if (cleaned) return cleaned;
  }
  if (Array.isArray(r.analyzedInstructions) && r.analyzedInstructions.length) {
    const parts: string[] = [];
    for (const blk of r.analyzedInstructions) {
      if (Array.isArray(blk.steps)) {
        for (const st of blk.steps) {
          if (st?.step) parts.push(st.step);
        }
      }
    }
    const cleaned = parts.join(" ").replace(/\s+/g, " ").trim();
    if (cleaned) return cleaned;
  }
  return null;
}

/** Trim instruction text for card preview */
function getInstructionPreview(r: RecipeItem, maxLen = 220): string | null {
  let text = extractInstructions(r);
  if (!text) return null;
  text = text.replace(/(?:^\d+\.\s*)+/g, "").trim();
  if (text.length > maxLen) text = text.slice(0, maxLen - 1).trimEnd() + "…";
  return text;
}

/** Choose best image field */
function getImage(r: RecipeItem): string | null {
  return r.image || r.imageUrl || r.thumbnail || null;
}

/** Choose best source URL; fallback to a Google search by title */
function getSourceUrl(r: RecipeItem): string | null {
  const candidates = [
    r.sourceUrl,
    r.sourceURL,
    r.source_link,
    r.url,
    r.source && /^https?:\/\//i.test(r.source) ? r.source : null,
  ].filter(Boolean) as string[];
  if (candidates.length) return candidates[0];
  if (r.title) {
    const q = encodeURIComponent(`${r.title} recipe`);
    return `https://www.google.com/search?q=${q}`;
  }
  return null;
}

// Modal component for full recipe view
function RecipeModal({ r, isOpen, onClose }: { r: RecipeItem | null; isOpen: boolean; onClose: () => void }) {
  if (!isOpen || !r) return null;
  const fullInstructions = extractInstructions(r);
  const img = getImage(r);
  const sourceHref = getSourceUrl(r);
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-white rounded-lg max-w-4xl max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="p-6">
          <div className="flex justify-between items-start mb-4">
            <h2 className="text-2xl font-bold">{r.title}</h2>
            <Button variant="ghost" onClick={onClose} className="text-gray-500 hover:text-gray-700">
              ✕
            </Button>
          </div>
          {img && <img src={img} alt={r.title} className="w-full h-64 object-cover rounded-lg mb-4" />}
          <div className="flex items-center gap-4 mb-4">
            <SpoonRating value={r.ratingSpoons ?? null} />
            {r.cookTime && (
              <span className="inline-flex items-center gap-1 text-sm text-gray-600">
                <Clock className="w-4 h-4" />
                {r.cookTime} min
              </span>
            )}
            {r.servings && (
              <span className="inline-flex items-center gap-1 text-sm text-gray-600">
                <Users className="w-4 h-4" />
                {r.servings} servings
              </span>
            )}
          </div>
          <div className="flex flex-wrap gap-2 mb-4">
            {r.cuisine && <Badge variant="secondary">{r.cuisine}</Badge>}
            {r.mealType && <Badge variant="outline">{r.mealType}</Badge>}
            {(r.dietTags || []).map((t) => (
              <Badge key={t} variant="outline" className="capitalize">
                {t}
              </Badge>
            ))}
          </div>
          {fullInstructions && (
            <div className="mb-4">
              <h3 className="font-semibold mb-2">Instructions:</h3>
              <p className="text-gray-700 whitespace-pre-wrap leading-relaxed">{fullInstructions}</p>
            </div>
          )}
          {sourceHref && (
            <a href={sourceHref} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 text-blue-600 hover:underline">
              View Original Source <ExternalLink className="w-4 h-4" />
            </a>
          )}
        </div>
      </div>
    </div>
  );
}

function RecipeCard({ r, onCardClick }: { r: RecipeItem; onCardClick: (recipe: RecipeItem) => void }) {
  const img = getImage(r);
  const preview = getInstructionPreview(r);
  const ImageEl = img ? (
    <img
      src={img}
      alt={r.title}
      className="w-full h-48 object-cover cursor-pointer hover:opacity-90 transition-opacity"
      loading="lazy"
      onClick={() => onCardClick(r)}
    />
  ) : (
    <div
      className="w-full h-48 bg-muted flex items-center justify-center text-muted-foreground cursor-pointer hover:bg-gray-100 transition-colors"
      onClick={() => onCardClick(r)}
    >
      No image
    </div>
  );
  const TitleEl = (
    <h3 className="font-semibold leading-snug line-clamp-2 cursor-pointer hover:underline" onClick={() => onCardClick(r)}>
      {r.title}
    </h3>
  );
  return (
    <Card className="overflow-hidden bg-card border border-border hover:shadow-md transition-shadow">
      {ImageEl}
      <CardContent className="p-4 space-y-2">
        <div className="flex items-start justify-between gap-2">
          {TitleEl}
          <SpoonRating value={r.ratingSpoons ?? null} />
        </div>
        <div className="flex items-center gap-3 text-sm text-muted-foreground">
          {r.cookTime ? (
            <span className="inline-flex items-center gap-1">
              <Clock className="w-4 h-4" />
              {r.cookTime} min
            </span>
          ) : null}
          {r.servings ? (
            <span className="inline-flex items-center gap-1">
              <Users className="w-4 h-4" />
              {r.servings} servings
            </span>
          ) : null}
        </div>
        <div className="flex flex-wrap gap-1">
          {r.cuisine ? <Badge variant="secondary">{r.cuisine}</Badge> : null}
          {r.mealType ? <Badge variant="outline">{r.mealType}</Badge> : null}
          {(r.dietTags || []).slice(0, 3).map((t) => (
            <Badge key={t} variant="outline" className="capitalize">
              {t}
            </Badge>
          ))}
        </div>
        {preview && <p className="text-sm text-muted-foreground mt-2 line-clamp-4">{preview}</p>}
        <div className="pt-1">
          <Button variant="outline" size="sm" onClick={() => onCardClick(r)} className="w-full">
            View Full Recipe
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

export default function RecipesListPage() {
  const [q, setQ] = React.useState("");
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
    if (urlQuery) {
      setQ(urlQuery);
      startNewSearch(urlQuery);
    } else {
      startRandom(); // initial random
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ---- API helpers
  async function fetchRandom(count = 24) {
    const res = await fetch(`/api/recipes/random?count=${count}`, {
      headers: { "Cache-Control": "no-store" },
    });
    const json = (await res.json()) as SearchResponse;
    if (!res.ok || !("ok" in json) || json.ok === false) {
      const msg = (json as any)?.error || (await res.text()) || `Request failed (${res.status})`;
      throw new Error(msg);
    }
    return json.items || [];
  }

  async function fetchSearch(term: string, pageOffset: number, pageSize = 24) {
    const params = new URLSearchParams();
    params.set("q", term.trim());
    params.set("pageSize", String(pageSize));
    params.set("offset", String(pageOffset));
    const res = await fetch(`/api/recipes/search?${params.toString()}`);
    const json = (await res.json()) as SearchResponse;
    if (!res.ok || !("ok" in json) || json.ok === false) {
      const msg = (json as any)?.error || (await res.text()) || `Request failed (${res.status})`;
      throw new Error(msg);
    }
    return json.items || [];
  }

  // ---- mode runners
  async function startRandom() {
    if (loading) return;
    setLoading(true);
    setErr(null);
    setItems([]);
    setHasMore(true);
    setOffset(0);
    try {
      const first = await fetchRandom(24);
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

  async function startNewSearch(term: string) {
    if (loading) return;
    setLoading(true);
    setErr(null);
    setItems([]);
    setHasMore(true);
    setOffset(0);
    try {
      const first = await fetchSearch(term, 0, 24);
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
        const next = await fetchRandom(24);
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
      const next = await fetchSearch(q, offset, 24);
      setItems((prev) => [...prev, ...next]);
      setOffset((prev) => prev + next.length);
      setHasMore(next.length === 24);
    } catch (e: any) {
      setErr(e?.message || "Something went wrong");
    } finally {
      setIsFetchingNext(false);
    }
  }

  // ---- IntersectionObserver sentinel
  const sentinelRef = React.useRef<HTMLDivElement | null>(null);
  React.useEffect(() => {
    if (!sentinelRef.current) return;
    const node = sentinelRef.current;
    const obs = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (entry.isIntersecting) {
          // defer to next tick so layout settles after append
          Promise.resolve().then(loadMore);
        }
      },
      { root: null, rootMargin: "1200px 0px", threshold: 0 }
    );
    obs.observe(node);
    return () => obs.disconnect();
    // Include only flags that change the fetchability, not offset (random ignores offset)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasMore, loading, isFetchingNext, q]);

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
      </div>

      {loading && items.length === 0 ? (
        <div className="flex items-center gap-2 text-muted-foreground">
          <Loader2 className="w-4 h-4 animate-spin" />
          Loading recipes…
        </div>
      ) : err ? (
        <div className="text-destructive">Error: {err}</div>
      ) : items.length === 0 ? (
        <div className="text-muted-foreground">No recipes found. Try a different search or click Random.</div>
      ) : view === "grid" ? (
        <div className="grid gap-4 grid-cols-1 xs:grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
          {items.map((r) => (
            <RecipeCard key={r.id} r={r} onCardClick={setSelectedRecipe} />
          ))}
        </div>
      ) : (
        <div className="space-y-4">
          {items.map((r) => (
            <div key={r.id} className="w-full">
              <RecipeCard r={r} onCardClick={setSelectedRecipe} />
            </div>
          ))}
        </div>
      )}

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
