import { useEffect, useMemo, useState } from "react";
import { Link } from "wouter";
import { Sparkles } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { readRecentlyViewedDrinkSlugs } from "@/components/drinks/RecentlyViewedDrinks";

type RecommendedDrink = {
  slug: string;
  name: string;
  image: string | null;
  route: string;
  sourceCategoryRoute: string;
};

type RecommendedResponse = {
  ok: boolean;
  items?: RecommendedDrink[];
};

function sourceLabelFromRoute(route: string): string {
  const cleaned = String(route || "").replace(/^\/+|\/+$/g, "");
  if (!cleaned) return "Recommended";

  const lastSegment = cleaned.split("/").pop() || cleaned;
  return lastSegment
    .split("-")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export default function RecommendedDrinks() {
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<RecommendedDrink[]>([]);

  const recentSlugs = useMemo(() => readRecentlyViewedDrinkSlugs(), []);

  useEffect(() => {
    const controller = new AbortController();

    async function loadRecommendations() {
      setLoading(true);
      try {
        const query = recentSlugs.length > 0
          ? `?recent=${encodeURIComponent(recentSlugs.join(","))}`
          : "";
        const response = await fetch(`/api/drinks/recommended${query}`, {
          method: "GET",
          signal: controller.signal,
        });

        if (!response.ok) {
          setItems([]);
          return;
        }

        const payload = (await response.json()) as RecommendedResponse;
        setItems(Array.isArray(payload.items) ? payload.items : []);
      } catch {
        setItems([]);
      } finally {
        setLoading(false);
      }
    }

    loadRecommendations();

    return () => controller.abort();
  }, [recentSlugs]);

  return (
    <Card className="mb-12 border-purple-200 bg-gradient-to-br from-white to-purple-50/40">
      <CardHeader className="pb-3">
        <CardTitle className="text-2xl flex items-center gap-2">
          <Sparkles className="h-6 w-6 text-purple-500" />
          Recommended For You
        </CardTitle>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="rounded-lg border border-dashed bg-muted/30 px-4 py-8 text-center text-sm text-muted-foreground">
            Finding drinks you might like...
          </div>
        ) : items.length === 0 ? (
          <div className="rounded-lg border border-dashed bg-muted/30 px-4 py-8 text-center text-sm text-muted-foreground">
            No recommendations available right now. Check out trending drinks and come back soon.
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {items.map((item) => {
              const canonicalRoute = `/drinks/recipe/${item.slug}`;

              return (
              <div
                key={item.slug}
                className="rounded-xl border bg-white/90 p-3 transition hover:shadow-md hover:-translate-y-0.5"
              >
                <Link
                  href={item.route || canonicalRoute}
                  className="block"
                >
                <div className="flex gap-3 items-start">
                  <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-md bg-muted">
                    {item.image ? (
                      <img
                        src={item.image}
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
                        {sourceLabelFromRoute(item.sourceCategoryRoute)}
                      </Badge>
                    </div>
                  </div>
                </div>
                </Link>
                <div className="mt-3 flex gap-2">
                  <Link href={canonicalRoute} className="text-xs underline underline-offset-2 text-muted-foreground hover:text-foreground">
                    Canonical recipe
                  </Link>
                  <span className="text-muted-foreground text-xs">•</span>
                  <Link href={`/drinks/submit?remix=${encodeURIComponent(item.slug)}`} className="text-xs underline underline-offset-2 text-muted-foreground hover:text-foreground">
                    Remix
                  </Link>
                </div>
              </div>
            );})}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
