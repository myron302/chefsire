import { useEffect, useMemo, useState } from "react";
import { Link } from "wouter";
import { History } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { addRecentlyViewedSlug, readRecentlyViewedSlugs } from "@/lib/recently-viewed-storage";
import {
  canonicalPetFoodRecipeBySlug,
  type CanonicalPetFoodRecipeEntry,
} from "@/data/pet-food/canonical";

export const RECENTLY_VIEWED_PET_FOOD_STORAGE_KEY = "chefsire:pet-food:recently-viewed";
const MAX_RECENTLY_VIEWED_PET_FOOD = 10;

export function readRecentlyViewedPetFoodSlugs(): string[] {
  return readRecentlyViewedSlugs(RECENTLY_VIEWED_PET_FOOD_STORAGE_KEY);
}

export function addRecentlyViewedPetFoodSlug(slug: string) {
  addRecentlyViewedSlug(RECENTLY_VIEWED_PET_FOOD_STORAGE_KEY, slug, MAX_RECENTLY_VIEWED_PET_FOOD);
}

function recipeImage(entry: CanonicalPetFoodRecipeEntry): string | null {
  const image = entry.image;
  if (typeof image === "string" && image.trim()) return image;

  return null;
}

export default function RecentlyViewedPetFood() {
  const [slugs, setSlugs] = useState<string[]>([]);

  useEffect(() => {
    setSlugs(readRecentlyViewedPetFoodSlugs());
  }, []);

  const items = useMemo(
    () =>
      slugs
        .map((slug) => canonicalPetFoodRecipeBySlug[slug])
        .filter((entry): entry is CanonicalPetFoodRecipeEntry => Boolean(entry)),
    [slugs]
  );

  return (
    <Card className="mb-12 border-sky-200 bg-gradient-to-br from-white to-sky-50/40">
      <CardHeader className="pb-3">
        <CardTitle className="text-2xl flex items-center gap-2">
          <History className="h-6 w-6 text-sky-500" />
          Recently Viewed Pet Food Recipes
        </CardTitle>
      </CardHeader>
      <CardContent>
        {items.length === 0 ? (
          <div className="rounded-lg border border-dashed bg-muted/30 px-4 py-8 text-center text-sm text-muted-foreground">
            No recently viewed pet food recipes yet. Open any recipe to start building your history.
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {items.map((item) => {
              const image = recipeImage(item);
              const canonicalRoute = `/pet-food/recipe/${item.slug}`;

              return (
                <div
                  key={item.slug}
                  className="rounded-xl border bg-white/90 p-3 transition hover:shadow-md hover:-translate-y-0.5"
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
                        <Link href={canonicalRoute} className="font-semibold leading-tight line-clamp-2 underline underline-offset-2 hover:text-foreground">
                          {item.name}
                        </Link>
                        <div className="mt-2 flex items-center gap-2">
                          <Badge variant="outline" className="text-[10px]">
                            {item.sourceTitle}
                          </Badge>
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
