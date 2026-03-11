import { useEffect, useMemo, useState } from "react";
import { Link } from "wouter";
import { Flame, TrendingUp } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

type TrendingDrink = {
  slug: string;
  name: string;
  image: string | null;
  route?: string;
  sourceCategoryRoute?: string | null;
  score?: number;
  views7d?: number;
  views24h?: number;
  remixes?: number;
  groceryAdds?: number;
};

type TrendingApiResponse = {
  ok?: boolean;
  items?: TrendingDrink[];
};

function getCanonicalRoute(slug: string) {
  return `/drinks/recipe/${slug}`;
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

export default function TrendingDrinks() {
  const [items, setItems] = useState<TrendingDrink[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;

    const loadTrendingDrinks = async () => {
      try {
        const response = await fetch("/api/drinks/trending");
        if (!response.ok) throw new Error("Unable to fetch trending drinks");

        const data = (await response.json()) as TrendingApiResponse;
        if (!active) return;

        setItems(Array.isArray(data.items) ? data.items : []);
      } catch {
        if (active) setItems([]);
      } finally {
        if (active) setLoading(false);
      }
    };

    loadTrendingDrinks();
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
          Trending Drinks
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
            No trending drinks yet. Check back soon for the hottest recipes.
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {topItems.map((drink, index) => {
              const sourceLabel = sourceRouteToLabel(drink.sourceCategoryRoute);
              const viewsToday = Number(drink.views24h ?? 0);
              const remixes = Number(drink.remixes ?? 0);

              return (
                <div
                  key={drink.slug}
                  className="rounded-xl border bg-white/90 p-3 transition hover:shadow-md hover:-translate-y-0.5"
                >
                  <Link href={getCanonicalRoute(drink.slug)} className="block">
                    <div className="flex gap-3 items-start">
                      <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-md bg-muted">
                        {drink.image ? (
                          <img
                            src={drink.image}
                            alt={drink.name}
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
                        <p className="font-semibold leading-tight line-clamp-2">{drink.name}</p>
                        <p className="mt-1 text-xs text-muted-foreground flex items-center gap-1">
                          <Flame className="h-3 w-3 text-orange-500" />
                          🔥 Trending now
                        </p>
                        <p className="mt-1 text-xs text-muted-foreground">👀 {viewsToday.toLocaleString()} views today</p>
                        <p className="mt-1 text-xs text-muted-foreground">🔁 {remixes.toLocaleString()} remixes</p>
                      </div>
                    </div>
                  </Link>
                  <div className="mt-3 flex gap-2">
                    <Link href={getCanonicalRoute(drink.slug)} className="text-xs underline underline-offset-2 text-muted-foreground hover:text-foreground">
                      Open canonical recipe page
                    </Link>
                    <span className="text-muted-foreground text-xs">•</span>
                    <Link href={`/drinks/submit?remix=${encodeURIComponent(drink.slug)}`} className="text-xs underline underline-offset-2 text-muted-foreground hover:text-foreground">
                      Remix
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
