import type { ReactNode } from "react";
import { Link } from "wouter";
import { Flame, TrendingUp } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export type BaseTrendingItem = {
  slug: string;
  name: string;
  image: string | null;
  sourceCategoryRoute?: string | null;
};

type Props<T extends BaseTrendingItem> = {
  title: string;
  loading: boolean;
  items: T[];
  emptyMessage: string;
  getCanonicalRoute: (item: T) => string;
  renderStats: (item: T) => ReactNode;
  renderFooter?: (item: T) => ReactNode;
};

export function sourceRouteToLabel(sourceCategoryRoute?: string | null) {
  if (!sourceCategoryRoute) return null;
  const segment = sourceCategoryRoute.split("/").filter(Boolean).pop();
  if (!segment) return null;

  return segment
    .split("-")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export default function TrendingRecipesWidget<T extends BaseTrendingItem>({
  title,
  loading,
  items,
  emptyMessage,
  getCanonicalRoute,
  renderStats,
  renderFooter,
}: Props<T>) {
  return (
    <Card className="mb-12 border-orange-200 bg-gradient-to-br from-white to-orange-50/40">
      <CardHeader className="pb-3">
        <CardTitle className="text-2xl flex items-center gap-2">
          <TrendingUp className="h-6 w-6 text-orange-500" />
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {Array.from({ length: 3 }).map((_, idx) => (
              <div key={idx} className="h-28 rounded-lg border bg-muted/30 animate-pulse" />
            ))}
          </div>
        ) : items.length === 0 ? (
          <div className="rounded-lg border border-dashed bg-muted/30 px-4 py-8 text-center text-sm text-muted-foreground">
            {emptyMessage}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {items.map((item, index) => {
              const sourceLabel = sourceRouteToLabel(item.sourceCategoryRoute);
              const canonicalRoute = getCanonicalRoute(item);

              return (
                <div key={item.slug} className="rounded-xl border bg-white/90 p-3 transition hover:shadow-md hover:-translate-y-0.5">
                  <div className="flex gap-3 items-start">
                      <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-md bg-muted">
                        {item.image ? (
                          <img src={item.image} alt={item.name} className="h-full w-full object-cover" loading="lazy" />
                        ) : (
                          <div className="h-full w-full flex items-center justify-center text-xs text-muted-foreground">No image</div>
                        )}
                      </div>

                      <div className="min-w-0 flex-1">
                        <div className="mb-1 flex items-center gap-2">
                          <Badge variant="secondary" className="text-[10px]">#{index + 1}</Badge>
                          {sourceLabel && <Badge variant="outline" className="text-[10px]">{sourceLabel}</Badge>}
                        </div>
                        <Link href={canonicalRoute} className="font-semibold leading-tight line-clamp-2 underline underline-offset-2 hover:text-foreground">
                          {item.name}
                        </Link>
                        <p className="mt-1 text-xs text-muted-foreground flex items-center gap-1">
                          <Flame className="h-3 w-3 text-orange-500" />
                          🔥 Trending
                        </p>
                        {renderStats(item)}
                      </div>
                    </div>
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    {renderFooter ? (
                      renderFooter(item)
                    ) : (
                      <Link href={canonicalRoute}>
                        <Button size="sm" variant="outline">View Recipe</Button>
                      </Link>
                    )}
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
