import { useEffect, useMemo, useState } from "react";
import { Link } from "wouter";
import { History } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  canonicalDrinkRecipeBySlug,
  type CanonicalDrinkRecipeEntry,
} from "@/data/drinks/canonical";

export const RECENTLY_VIEWED_DRINKS_STORAGE_KEY = "chefsire:drinks:recently-viewed";
const MAX_RECENTLY_VIEWED_DRINKS = 10;

export function readRecentlyViewedDrinkSlugs(): string[] {
  if (typeof window === "undefined") return [];

  try {
    const raw = window.localStorage.getItem(RECENTLY_VIEWED_DRINKS_STORAGE_KEY);
    if (!raw) return [];

    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];

    return parsed.filter((item): item is string => typeof item === "string" && item.length > 0);
  } catch {
    return [];
  }
}

export function addRecentlyViewedDrinkSlug(slug: string) {
  if (typeof window === "undefined") return;

  const normalizedSlug = String(slug || "").trim();
  if (!normalizedSlug) return;

  const existing = readRecentlyViewedDrinkSlugs();
  const deduped = [normalizedSlug, ...existing.filter((item) => item !== normalizedSlug)];
  const limited = deduped.slice(0, MAX_RECENTLY_VIEWED_DRINKS);

  try {
    window.localStorage.setItem(RECENTLY_VIEWED_DRINKS_STORAGE_KEY, JSON.stringify(limited));
  } catch {
    // Ignore storage write failures.
  }
}

function recipeImage(entry: CanonicalDrinkRecipeEntry): string | null {
  const image = entry.recipe.image;
  if (typeof image === "string" && image.trim()) return image;

  const imageUrl = entry.recipe.imageUrl;
  if (typeof imageUrl === "string" && imageUrl.trim()) return imageUrl;

  return null;
}

export default function RecentlyViewedDrinks() {
  const [slugs, setSlugs] = useState<string[]>([]);

  useEffect(() => {
    setSlugs(readRecentlyViewedDrinkSlugs());
  }, []);

  const items = useMemo(
    () =>
      slugs
        .map((slug) => canonicalDrinkRecipeBySlug[slug])
        .filter((entry): entry is CanonicalDrinkRecipeEntry => Boolean(entry)),
    [slugs]
  );

  return (
    <Card className="mb-12 border-sky-200 bg-gradient-to-br from-white to-sky-50/40">
      <CardHeader className="pb-3">
        <CardTitle className="text-2xl flex items-center gap-2">
          <History className="h-6 w-6 text-sky-500" />
          Recently Viewed Drinks
        </CardTitle>
      </CardHeader>
      <CardContent>
        {items.length === 0 ? (
          <div className="rounded-lg border border-dashed bg-muted/30 px-4 py-8 text-center text-sm text-muted-foreground">
            No recently viewed drinks yet. Open any recipe to start building your history.
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {items.map((item) => {
              const image = recipeImage(item);

              return (
                <Link
                  key={item.slug}
                  href={`/drinks/recipe/${item.slug}`}
                  className="block rounded-xl border bg-white/90 p-3 transition hover:shadow-md hover:-translate-y-0.5"
                >
                  <div className="flex gap-3 items-start">
                    <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-md bg-muted">
                      {image ? (
                        <img
                          src={image}
                          alt={item.name}
                          className="h-full w-full object-cover"
                          loading="lazy"
                        />
                      ) : (
                        <div className="h-full w-full flex items-center justify-center text-xs text-muted-foreground">
                          No image
                        </div>
                      )}
                    </div>

                    <div className="min-w-0 flex-1">
                      <p className="font-semibold leading-tight line-clamp-2">{item.name}</p>
                      <div className="mt-2 flex items-center gap-2">
                        <Badge variant="outline" className="text-[10px]">
                          {item.sourceTitle}
                        </Badge>
                      </div>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
