import { useEffect, useMemo, useState } from "react";
import { Link } from "wouter";
import { Flame, TrendingUp } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

type TrendingDrinkByCategoryItem = {
  slug: string;
  name: string;
  image: string | null;
  route?: string;
  sourceCategoryRoute?: string | null;
  score?: number;
  views7d?: number;
  views24h?: number;
};

type TrendingByCategoryApiResponse = {
  ok?: boolean;
  sourceCategoryRoute?: string;
  items?: TrendingDrinkByCategoryItem[];
};

type TrendingDrinksByCategoryProps = {
  sourceCategoryRoute: string;
  title?: string;
};

function getCanonicalRoute(slug: string) {
  return `/drinks/recipe/${slug}`;
}

export default function TrendingDrinksByCategory({
  sourceCategoryRoute,
  title = "Trending in this category",
}: TrendingDrinksByCategoryProps) {
  const [items, setItems] = useState<TrendingDrinkByCategoryItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;

    const loadCategoryTrending = async () => {
      try {
        setLoading(true);
        const params = new URLSearchParams({ sourceCategoryRoute });
        const response = await fetch(`/api/drinks/trending/by-category?${params.toString()}`);
        if (!response.ok) throw new Error("Unable to fetch category trending drinks");

        const data = (await response.json()) as TrendingByCategoryApiResponse;
        if (!active) return;

        setItems(Array.isArray(data.items) ? data.items : []);
      } catch {
        if (active) setItems([]);
      } finally {
        if (active) setLoading(false);
      }
    };

    loadCategoryTrending();

    return () => {
      active = false;
    };
  }, [sourceCategoryRoute]);

  const topItems = useMemo(() => items.slice(0, 6), [items]);

  return (
    <Card className="border-orange-200 bg-gradient-to-br from-white to-orange-50/40">
      <CardHeader className="pb-3">
        <CardTitle className="text-xl flex items-center gap-2">
          <TrendingUp className="h-5 w-5 text-orange-500" />
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {Array.from({ length: 3 }).map((_, idx) => (
              <div key={idx} className="h-24 rounded-lg border bg-muted/30 animate-pulse" />
            ))}
          </div>
        ) : topItems.length === 0 ? (
          <div className="rounded-lg border border-dashed bg-muted/30 px-4 py-6 text-center text-sm text-muted-foreground">
            No trending drinks in this category yet.
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {topItems.map((drink, index) => {
              const metricText = drink.views7d
                ? `${drink.views7d.toLocaleString()} views in last 7 days`
                : "Trending now";

              return (
                <Link
                  key={drink.slug}
                  href={drink.route || getCanonicalRoute(drink.slug)}
                  className="block rounded-xl border bg-white/90 p-3 transition hover:shadow-md hover:-translate-y-0.5"
                >
                  <div className="flex gap-3 items-start">
                    <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-md bg-muted">
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
                      </div>
                      <p className="font-semibold leading-tight line-clamp-2">{drink.name}</p>
                      <p className="mt-1 text-xs text-muted-foreground flex items-center gap-1">
                        <Flame className="h-3 w-3 text-orange-500" />
                        {metricText}
                      </p>
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
