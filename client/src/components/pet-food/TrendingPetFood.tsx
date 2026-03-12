import { useEffect, useMemo, useState } from "react";
import { Link } from "wouter";
import { Flame, TrendingUp } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

type TrendingPetFoodItem = {
  slug: string;
  name: string;
  image: string | null;
  route?: string;
  sourceCategoryRoute?: string | null;
  score?: number;
  views7d?: number;
};

type TrendingPetFoodApiResponse = {
  ok?: boolean;
  items?: TrendingPetFoodItem[];
};

function getCanonicalRoute(slug: string) {
  return `/pet-food/recipe/${slug}`;
}

function sourceRouteToLabel(sourceCategoryRoute?: string | null) {
  if (!sourceCategoryRoute) return null;
  const segment = sourceCategoryRoute.split("/").filter(Boolean).pop();
  if (!segment) return null;

  return segment
    .split("-")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export default function TrendingPetFood() {
  const [items, setItems] = useState<TrendingPetFoodItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;

    const loadTrendingPetFood = async () => {
      try {
        const response = await fetch("/api/pet-food/trending");
        if (!response.ok) throw new Error("Unable to fetch trending pet food");

        const data = (await response.json()) as TrendingPetFoodApiResponse;
        if (!active) return;

        setItems(Array.isArray(data.items) ? data.items : []);
      } catch {
        if (active) setItems([]);
      } finally {
        if (active) setLoading(false);
      }
    };

    loadTrendingPetFood();

    return () => {
      active = false;
    };
  }, []);

  const topItems = useMemo(() => items.slice(0, 6), [items]);

  return (
    <Card className="mb-12 border-orange-200 bg-gradient-to-br from-white to-orange-50/40">
      <CardHeader className="pb-3">
        <CardTitle className="text-2xl flex items-center gap-2">
          <TrendingUp className="h-6 w-6 text-orange-500" />
          Trending Pet Food
        </CardTitle>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {Array.from({ length: 3 }).map((_, idx) => (
              <div key={idx} className="h-28 rounded-lg border bg-muted/30 animate-pulse" />
            ))}
          </div>
        ) : topItems.length === 0 ? (
          <div className="rounded-lg border border-dashed bg-muted/30 px-4 py-8 text-center text-sm text-muted-foreground">
            No trending pet food recipes yet. Check back soon for the hottest recipes.
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {topItems.map((petFood, index) => {
              const sourceLabel = sourceRouteToLabel(petFood.sourceCategoryRoute);
              const views7d = Number(petFood.views7d ?? 0);

              return (
                <div
                  key={petFood.slug}
                  className="rounded-xl border bg-white/90 p-3 transition hover:shadow-md hover:-translate-y-0.5"
                >
                  <Link href={getCanonicalRoute(petFood.slug)} className="block">
                    <div className="flex gap-3 items-start">
                      <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-md bg-muted">
                        {petFood.image ? (
                          <img
                            src={petFood.image}
                            alt={petFood.name}
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
                        <div className="mb-1 flex items-center gap-2">
                          <Badge variant="secondary" className="text-[10px]">#{index + 1}</Badge>
                          {sourceLabel && <Badge variant="outline" className="text-[10px]">{sourceLabel}</Badge>}
                        </div>
                        <p className="font-semibold leading-tight line-clamp-2">{petFood.name}</p>
                        <p className="mt-1 text-xs text-muted-foreground flex items-center gap-1">
                          <Flame className="h-3 w-3 text-orange-500" />
                          🔥 Trending now
                        </p>
                        <p className="mt-1 text-xs text-muted-foreground">👀 {views7d.toLocaleString()} views this week</p>
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
