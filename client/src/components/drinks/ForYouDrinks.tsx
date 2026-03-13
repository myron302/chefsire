import { useEffect, useState } from "react";
import { Link } from "wouter";
import { Sparkles } from "lucide-react";
import { Badge } from "@/components/ui/badge";
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

const MAX_ITEMS = 6;

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

export default function ForYouDrinks() {
  const [items, setItems] = useState<ForYouDrink[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;

    const load = async () => {
      setLoading(true);
      const recentSlugs = readRecentlyViewedDrinkSlugs();

      // ensure canonical index is hydrated
      getCanonicalDrinkRecipeBySlug("__init__");

      const viewedSet = new Set(recentSlugs);
      const recentEntries = recentSlugs
        .map((slug) => getCanonicalDrinkRecipeBySlug(slug))
        .filter((entry): entry is CanonicalDrinkRecipeEntry => Boolean(entry));

      const selected = new Map<string, ForYouDrink>();

      const sectionCounts = new Map<string, number>();
      const sourceRouteCounts = new Map<string, number>();
      const recipeTypeCounts = new Map<string, number>();

      const bump = (map: Map<string, number>, key: string | null | undefined) => {
        const normalized = String(key ?? "").trim().toLowerCase();
        if (!normalized) return;
        map.set(normalized, (map.get(normalized) ?? 0) + 1);
      };

      const routeSection = (route: string) => route.split("/").filter(Boolean)[1] ?? "";

      const entryRecipeTypes = (entry: CanonicalDrinkRecipeEntry): string[] => {
        const tags = Array.isArray(entry.recipe.tags)
          ? entry.recipe.tags.map((tag) => String(tag).trim())
          : [];

        const fromSourceTitle = entry.sourceTitle
          .split(/[^a-z0-9]+/i)
          .map((part) => part.trim())
          .filter((part) => part.length >= 4);

        return [...tags, ...fromSourceTitle].slice(0, 12);
      };

      for (const entry of recentEntries) {
        bump(sectionCounts, routeSection(entry.sourceRoute));
        bump(sourceRouteCounts, entry.sourceRoute);
        for (const recipeType of entryRecipeTypes(entry)) bump(recipeTypeCounts, recipeType);
      }

      const orderedSections = [...sectionCounts.entries()].sort((a, b) => b[1] - a[1]).map(([key]) => key);
      const orderedSourceRoutes = [...sourceRouteCounts.entries()].sort((a, b) => b[1] - a[1]).map(([key]) => key);
      const recipeTypes = new Set([...recipeTypeCounts.entries()].sort((a, b) => b[1] - a[1]).map(([key]) => key));

      if (selected.size < MAX_ITEMS) {
        for (const section of orderedSections) {
          for (const entry of canonicalDrinkRecipeEntries) {
            if (routeSection(entry.sourceRoute) !== section) continue;
            if (viewedSet.has(entry.slug) || selected.has(entry.slug)) continue;
            selected.set(entry.slug, mapCanonical(entry, `Because you browse ${section} drinks`));
            if (selected.size >= MAX_ITEMS) break;
          }
          if (selected.size >= MAX_ITEMS) break;
        }
      }

      if (selected.size < MAX_ITEMS && recipeTypes.size > 0) {
        for (const entry of canonicalDrinkRecipeEntries) {
          if (viewedSet.has(entry.slug) || selected.has(entry.slug)) continue;
          const hasRelatedType = entryRecipeTypes(entry).some((type) => recipeTypes.has(type.toLowerCase()));
          if (!hasRelatedType) continue;
          selected.set(entry.slug, mapCanonical(entry, "Similar recipe type"));
          if (selected.size >= MAX_ITEMS) break;
        }
      }

      if (selected.size < MAX_ITEMS) {
        for (const sourceRoute of orderedSourceRoutes) {
          for (const entry of canonicalDrinkRecipeEntries) {
            if (entry.sourceRoute !== sourceRoute) continue;
            if (viewedSet.has(entry.slug) || selected.has(entry.slug)) continue;
            selected.set(entry.slug, mapCanonical(entry, `More from ${entry.sourceTitle}`));
            if (selected.size >= MAX_ITEMS) break;
          }
          if (selected.size >= MAX_ITEMS) break;
        }
      }

      if (selected.size < MAX_ITEMS) {
        try {
          const response = await fetch("/api/drinks/trending");
          if (response.ok) {
            const payload = (await response.json()) as TrendingApiResponse;
            for (const trend of payload.items ?? []) {
              if (!trend.slug || viewedSet.has(trend.slug) || selected.has(trend.slug)) continue;
              const canonical = getCanonicalDrinkRecipeBySlug(trend.slug);
              if (canonical) {
                selected.set(
                  canonical.slug,
                  mapCanonical(canonical, "Trending now")
                );
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
        } catch {
          // graceful fallback handled by currently selected items
        }
      }

      if (active) {
        setItems(Array.from(selected.values()).slice(0, MAX_ITEMS));
        setLoading(false);
      }
    };

    load();

    return () => {
      active = false;
    };
  }, []);

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
                  <Link href={canonicalRoute} className="block">
                    <div className="flex gap-3 items-start">
                      <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-md bg-muted">
                        {item.image ? (
                          <img src={item.image} alt={item.name} className="h-full w-full object-cover" loading="lazy" />
                        ) : (
                          <div className="h-full w-full flex items-center justify-center text-xs text-muted-foreground">No image</div>
                        )}
                      </div>

                      <div className="min-w-0 flex-1">
                        <p className="font-semibold leading-tight line-clamp-2">{item.name}</p>
                        <div className="mt-2 flex items-center gap-2">
                          <Badge variant="outline" className="text-[10px]">{item.sourceTitle}</Badge>
                          <span className="text-[10px] text-muted-foreground">{item.reason}</span>
                        </div>
                      </div>
                    </div>
                  </Link>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
