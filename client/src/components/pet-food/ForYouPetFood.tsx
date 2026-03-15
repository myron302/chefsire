import { useCallback, useEffect, useState } from "react";
import { Link } from "wouter";
import { Sparkles } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { readRecentlyViewedPetFoodSlugs } from "@/components/pet-food/RecentlyViewedPetFood";
import {
  canonicalPetFoodRecipeEntries,
  getCanonicalPetFoodRecipeBySlug,
  type CanonicalPetFoodRecipeEntry,
} from "@/data/pet-food/canonical";

type TrendingPetFood = {
  slug: string;
  name: string;
  image: string | null;
};

type TrendingPetFoodApiResponse = {
  items?: TrendingPetFood[];
};

type ForYouPetFoodItem = {
  slug: string;
  name: string;
  image: string | null;
  sourceTitle: string;
  reason: string;
};

type RankedPetFoodCandidate = {
  entry: CanonicalPetFoodRecipeEntry;
  score: number;
  reason: string;
};

const MAX_ITEMS = 6;
const DUPLICATE_TRENDING_CUTOFF = 6;

function mapCanonical(entry: CanonicalPetFoodRecipeEntry, reason: string): ForYouPetFoodItem {
  return {
    slug: entry.slug,
    name: entry.name,
    image: entry.image ?? null,
    sourceTitle: entry.sourceTitle,
    reason,
  };
}

function animalCategory(route: string) {
  return route.split("/").filter(Boolean)[1] ?? "";
}

export default function ForYouPetFood() {
  const [items, setItems] = useState<ForYouPetFoodItem[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);

    const recentSlugs = readRecentlyViewedPetFoodSlugs();

    // ensure canonical index is hydrated
    getCanonicalPetFoodRecipeBySlug("__init__");

    const viewedSet = new Set(recentSlugs);
    const recentEntries = recentSlugs
      .map((slug) => getCanonicalPetFoodRecipeBySlug(slug))
      .filter((entry): entry is CanonicalPetFoodRecipeEntry => Boolean(entry));

    let trendingItems: TrendingPetFood[] = [];
    try {
      const response = await fetch("/api/pet-food/trending");
      if (response.ok) {
        const payload = (await response.json()) as TrendingPetFoodApiResponse;
        trendingItems = Array.isArray(payload.items) ? payload.items : [];
      }
    } catch {
      trendingItems = [];
    }

    const excludedSlugs = new Set(viewedSet);
    for (const trend of trendingItems.slice(0, DUPLICATE_TRENDING_CUTOFF)) {
      if (trend.slug) excludedSlugs.add(trend.slug);
    }

    const animalWeights = new Map<string, number>();
    const sourceRouteWeights = new Map<string, number>();

    const bump = (map: Map<string, number>, key: string, weight: number) => {
      const normalized = key.trim().toLowerCase();
      if (!normalized) return;
      map.set(normalized, (map.get(normalized) ?? 0) + weight);
    };

    recentEntries.forEach((entry, index) => {
      const recencyWeight = Math.max(recentEntries.length - index, 1);
      bump(animalWeights, animalCategory(entry.sourceRoute), recencyWeight);
      bump(sourceRouteWeights, entry.sourceRoute, recencyWeight);
    });

    const rankedCandidates: RankedPetFoodCandidate[] = [];
    for (const entry of canonicalPetFoodRecipeEntries) {
      if (excludedSlugs.has(entry.slug)) continue;

      const animalScore = (animalWeights.get(animalCategory(entry.sourceRoute)) ?? 0) * 14;
      const sourceRouteScore = (sourceRouteWeights.get(entry.sourceRoute.toLowerCase()) ?? 0) * 7;
      const recencyBias = recentEntries.length > 0 ? 2 : 0;
      const score = animalScore + sourceRouteScore + recencyBias;
      if (score <= 0) continue;

      let reason = "Recommended for your pets";
      if (animalScore > 0 && animalScore >= sourceRouteScore) {
        reason = `Because you browse ${animalCategory(entry.sourceRoute)} recipes`;
      } else if (sourceRouteScore > 0) {
        reason = `More from ${entry.sourceTitle}`;
      }

      rankedCandidates.push({ entry, score, reason });
    }

    rankedCandidates.sort((a, b) => b.score - a.score || a.entry.name.localeCompare(b.entry.name));

    const selected = new Map<string, ForYouPetFoodItem>();
    for (const candidate of rankedCandidates) {
      if (selected.size >= MAX_ITEMS) break;
      selected.set(candidate.entry.slug, mapCanonical(candidate.entry, candidate.reason));
    }

    if (selected.size < MAX_ITEMS) {
      for (const trend of trendingItems) {
        if (!trend.slug || excludedSlugs.has(trend.slug) || selected.has(trend.slug)) continue;

        const canonical = getCanonicalPetFoodRecipeBySlug(trend.slug);
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
      for (const entry of canonicalPetFoodRecipeEntries) {
        if (viewedSet.has(entry.slug) || selected.has(entry.slug)) continue;
        selected.set(entry.slug, mapCanonical(entry, "Explore more recipes"));
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
          For You Pet Food
        </CardTitle>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="rounded-lg border border-dashed bg-muted/30 px-4 py-8 text-center text-sm text-muted-foreground">
            Finding pet food recommendations for you...
          </div>
        ) : items.length === 0 ? (
          <div className="rounded-lg border border-dashed bg-muted/30 px-4 py-8 text-center text-sm text-muted-foreground">
            No recommendations yet. Browse a few recipes or check trending to personalize this section.
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {items.map((item) => {
              const canonicalRoute = `/pet-food/recipe/${item.slug}`;

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
