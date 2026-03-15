import { useCallback, useEffect, useState } from "react";
import { Link } from "wouter";
import { Sparkles } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { readRecentlyViewedDrinkSlugs } from "@/components/drinks/RecentlyViewedDrinks";
import {
  canonicalDrinkRecipeEntries,
  getCanonicalDrinkRecipeBySlug,
  type CanonicalDrinkRecipeEntry,
} from "@/data/drinks/canonical";

type TrendingDrink = {
  slug: string;
  name: string;
  image: string | null;
  sourceCategoryRoute?: string | null;
};

type TrendingApiResponse = {
  items?: TrendingDrink[];
};

type ForYouDrink = {
  slug: string;
  name: string;
  image: string | null;
  sourceTitle: string;
  reason: string;
};

type RankedDrinkCandidate = {
  entry: CanonicalDrinkRecipeEntry;
  score: number;
  reason: string;
};

const MAX_ITEMS = 6;
const DUPLICATE_TRENDING_CUTOFF = 6;

function recipeImage(entry: CanonicalDrinkRecipeEntry): string | null {
  const image = entry.recipe.image;
  if (typeof image === "string" && image.trim()) return image;

  const imageUrl = entry.recipe.imageUrl;
  if (typeof imageUrl === "string" && imageUrl.trim()) return imageUrl;

  return null;
}

function mapCanonical(entry: CanonicalDrinkRecipeEntry, reason: string): ForYouDrink {
  return {
    slug: entry.slug,
    name: entry.name,
    image: recipeImage(entry),
    sourceTitle: entry.sourceTitle,
    reason,
  };
}

function routeSection(route: string) {
  return route.split("/").filter(Boolean)[1] ?? "";
}

function tokenize(value: string): string[] {
  return value
    .split(/[^a-z0-9]+/i)
    .map((token) => token.trim().toLowerCase())
    .filter((token) => token.length >= 3);
}

function entryTokens(entry: CanonicalDrinkRecipeEntry): string[] {
  const tags = Array.isArray(entry.recipe.tags)
    ? entry.recipe.tags.map((tag) => String(tag).trim().toLowerCase()).filter(Boolean)
    : [];

  const titleTokens = tokenize(entry.name);
  const sourceTitleTokens = tokenize(entry.sourceTitle);

  return [...new Set([...tags, ...titleTokens, ...sourceTitleTokens])].slice(0, 20);
}

export default function ForYouDrinks() {
  const [items, setItems] = useState<ForYouDrink[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);

    const recentSlugs = readRecentlyViewedDrinkSlugs();

    // ensure canonical index is hydrated
    getCanonicalDrinkRecipeBySlug("__init__");

    const viewedSet = new Set(recentSlugs);
    const recentEntries = recentSlugs
      .map((slug) => getCanonicalDrinkRecipeBySlug(slug))
      .filter((entry): entry is CanonicalDrinkRecipeEntry => Boolean(entry));

    let trendingItems: TrendingDrink[] = [];
    try {
      const response = await fetch("/api/drinks/trending");
      if (response.ok) {
        const payload = (await response.json()) as TrendingApiResponse;
        trendingItems = Array.isArray(payload.items) ? payload.items : [];
      }
    } catch {
      trendingItems = [];
    }

    const excludedSlugs = new Set(viewedSet);
    for (const trend of trendingItems.slice(0, DUPLICATE_TRENDING_CUTOFF)) {
      if (trend.slug) excludedSlugs.add(trend.slug);
    }

    const sectionWeights = new Map<string, number>();
    const tokenWeights = new Map<string, number>();
    const sourceRouteWeights = new Map<string, number>();

    const bump = (map: Map<string, number>, key: string, weight: number) => {
      const normalized = key.trim().toLowerCase();
      if (!normalized) return;
      map.set(normalized, (map.get(normalized) ?? 0) + weight);
    };

    recentEntries.forEach((entry, index) => {
      const recencyWeight = Math.max(recentEntries.length - index, 1);
      bump(sectionWeights, routeSection(entry.sourceRoute), recencyWeight);
      bump(sourceRouteWeights, entry.sourceRoute, recencyWeight);
      for (const token of entryTokens(entry)) bump(tokenWeights, token, recencyWeight);
    });

    const rankedCandidates: RankedDrinkCandidate[] = [];
    for (const entry of canonicalDrinkRecipeEntries) {
      if (excludedSlugs.has(entry.slug)) continue;

      const sectionScore = (sectionWeights.get(routeSection(entry.sourceRoute)) ?? 0) * 14;
      const sourceRouteScore = (sourceRouteWeights.get(entry.sourceRoute.toLowerCase()) ?? 0) * 5;
      const tokenScore = entryTokens(entry).reduce((total, token) => total + (tokenWeights.get(token) ?? 0), 0) * 8;
      const recencyBias = recentEntries.length > 0 ? 2 : 0;
      const score = sectionScore + tokenScore + sourceRouteScore + recencyBias;
      if (score <= 0) continue;

      let reason = "Recommended for your tastes";
      if (sectionScore > 0 && sectionScore >= tokenScore && sectionScore >= sourceRouteScore) {
        reason = `Because you browse ${routeSection(entry.sourceRoute)} drinks`;
      } else if (tokenScore > 0 && tokenScore >= sourceRouteScore) {
        reason = "Similar recipe type";
      } else if (sourceRouteScore > 0) {
        reason = `More from ${entry.sourceTitle}`;
      }

      rankedCandidates.push({ entry, score, reason });
    }

    rankedCandidates.sort((a, b) => b.score - a.score || a.entry.name.localeCompare(b.entry.name));

    const selected = new Map<string, ForYouDrink>();
    for (const candidate of rankedCandidates) {
      if (selected.size >= MAX_ITEMS) break;
      selected.set(candidate.entry.slug, mapCanonical(candidate.entry, candidate.reason));
    }

    if (selected.size < MAX_ITEMS) {
      for (const trend of trendingItems) {
        if (!trend.slug || excludedSlugs.has(trend.slug) || selected.has(trend.slug)) continue;

        const canonical = getCanonicalDrinkRecipeBySlug(trend.slug);
        if (canonical) {
          selected.set(canonical.slug, mapCanonical(canonical, "Trending now"));
        } else {
          selected.set(trend.slug, {
            slug: trend.slug,
            name: trend.name,
            image: trend.image,
            sourceTitle: "Trending",
            reason: "Trending now",
          });
        }

        if (selected.size >= MAX_ITEMS) break;
      }
    }

    if (selected.size < MAX_ITEMS) {
      for (const entry of canonicalDrinkRecipeEntries) {
        if (viewedSet.has(entry.slug) || selected.has(entry.slug)) continue;
        selected.set(entry.slug, mapCanonical(entry, "Explore more drinks"));
        if (selected.size >= MAX_ITEMS) break;
      }
    }

    setItems(Array.from(selected.values()).slice(0, MAX_ITEMS));
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();

    const handleFocus = () => {
      void load();
    };

    const handleVisibility = () => {
      if (document.visibilityState === "visible") {
        void load();
      }
    };

    window.addEventListener("focus", handleFocus);
    document.addEventListener("visibilitychange", handleVisibility);

    return () => {
      window.removeEventListener("focus", handleFocus);
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, [load]);

  return (
    <Card className="mb-12 border-purple-200 bg-gradient-to-br from-white to-purple-50/40">
      <CardHeader className="pb-3">
        <CardTitle className="text-2xl flex items-center gap-2">
          <Sparkles className="h-6 w-6 text-purple-500" />
          For You Drinks
        </CardTitle>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="rounded-lg border border-dashed bg-muted/30 px-4 py-8 text-center text-sm text-muted-foreground">
            Finding drink recommendations for you...
          </div>
        ) : items.length === 0 ? (
          <div className="rounded-lg border border-dashed bg-muted/30 px-4 py-8 text-center text-sm text-muted-foreground">
            No recommendations yet. Browse a few drinks or check trending to personalize this section.
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {items.map((item) => {
              const canonicalRoute = `/drinks/recipe/${item.slug}`;

              return (
                <div
                  key={item.slug}
                  className="rounded-xl border bg-white/90 p-3 transition hover:shadow-md hover:-translate-y-0.5"
                >
                  <div className="flex gap-3 items-start">
                      <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-md bg-muted">
                        {item.image ? (
                          <img src={item.image} alt={item.name} className="h-full w-full object-cover" loading="lazy" />
                        ) : (
                          <div className="h-full w-full flex items-center justify-center text-xs text-muted-foreground">No image</div>
                        )}
                      </div>

                      <div className="min-w-0 flex-1">
                        <Link href={canonicalRoute} className="font-semibold leading-tight line-clamp-2 underline underline-offset-2 hover:text-foreground">
                          {item.name}
                        </Link>
                        <div className="mt-2 flex items-center gap-2">
                          <Badge variant="outline" className="text-[10px]">{item.sourceTitle}</Badge>
                          <span className="text-[10px] text-muted-foreground">{item.reason}</span>
                        </div>
                      </div>
                    </div>
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <Link href={canonicalRoute}>
                      <Button size="sm" variant="outline">View Recipe</Button>
                    </Link>
                    <Link href={`/drinks/submit?remix=${encodeURIComponent(item.slug)}`}>
                      <Button size="sm" variant="ghost">Create Remix</Button>
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
