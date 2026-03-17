import { useEffect, useMemo, useState } from "react";
import { Link } from "wouter";
import { Compass } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  canonicalDrinkRecipeEntries,
  getCanonicalDrinkRecipeBySlug,
  type CanonicalDrinkRecipeEntry,
} from "@/data/drinks/canonical";
import { hasRecentDrinkActivity, readDrinkActivityState } from "@/lib/drinks-activity";

type RecommendedResponse = { items?: Array<{ slug?: string | null }> };

type ActivityItem = {
  slug: string;
  name: string;
  sourceTitle: string;
  image: string | null;
  reason: string;
};

function toImage(entry: CanonicalDrinkRecipeEntry): string | null {
  const image = entry.recipe.image;
  if (typeof image === "string" && image.trim()) return image;
  if (typeof entry.recipe.imageUrl === "string" && entry.recipe.imageUrl.trim()) return entry.recipe.imageUrl;
  return null;
}

function categoryFromRoute(route: string): string {
  return route.replace(/^\/drinks\/?/, "").split("/")[0]?.trim().toLowerCase() ?? "";
}

export default function BecauseOfYourActivity() {
  const [items, setItems] = useState<ActivityItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [enabled, setEnabled] = useState(false);

  const signals = useMemo(() => readDrinkActivityState(), []);

  useEffect(() => {
    const active = hasRecentDrinkActivity();
    setEnabled(active);

    if (!active) {
      setItems([]);
      setLoading(false);
      return;
    }

    const run = async () => {
      setLoading(true);
      const recentSeeds = [...signals.recentViewedSlugs, ...signals.recentRemixedSlugs].slice(0, 8);
      const backendOrder: string[] = [];

      try {
        const query = recentSeeds.length ? `?recent=${encodeURIComponent(recentSeeds.join(","))}` : "";
        const response = await fetch(`/api/drinks/recommended${query}`);
        if (response.ok) {
          const payload = (await response.json()) as RecommendedResponse;
          for (const entry of payload.items ?? []) {
            const slug = String(entry?.slug ?? "").trim();
            if (slug) backendOrder.push(slug);
          }
        }
      } catch {
        // graceful fallback to local ranking
      }

      const creatorSet = new Set(signals.recentViewedCreators.map((value) => value.toLowerCase()));
      const categorySet = new Set(signals.recentViewedCategories.map((value) => value.toLowerCase()));
      const remixSet = new Set(signals.recentRemixedSlugs);
      const seen = new Set<string>(signals.recentViewedSlugs);

      const selected: ActivityItem[] = [];
      for (const slug of backendOrder) {
        if (selected.length >= 6) break;
        if (seen.has(slug)) continue;

        const canonical = getCanonicalDrinkRecipeBySlug(slug);
        if (!canonical) continue;

        selected.push({
          slug: canonical.slug,
          name: canonical.name,
          sourceTitle: canonical.sourceTitle,
          image: toImage(canonical),
          reason: "Inspired by your recent activity",
        });
        seen.add(slug);
      }

      for (const entry of canonicalDrinkRecipeEntries) {
        if (selected.length >= 6) break;
        if (seen.has(entry.slug)) continue;

        const routeCategory = categoryFromRoute(entry.sourceRoute);
        const categoryMatch = routeCategory && categorySet.has(routeCategory);
        const creatorMatch = creatorSet.has(entry.sourceTitle.toLowerCase());
        const remixedMatch = remixSet.has(entry.slug);
        if (!categoryMatch && !creatorMatch && !remixedMatch) continue;

        selected.push({
          slug: entry.slug,
          name: entry.name,
          sourceTitle: entry.sourceTitle,
          image: toImage(entry),
          reason: remixedMatch
            ? "Because you remixed this recently"
            : categoryMatch
              ? `Because you browse ${routeCategory} drinks`
              : "Because you viewed this creator",
        });
        seen.add(entry.slug);
      }

      setItems(selected);
      setLoading(false);
    };

    void run();
  }, [signals]);

  if (!enabled) return null;

  return (
    <Card className="mb-8 border-indigo-200 bg-gradient-to-br from-white to-indigo-50/40">
      <CardHeader className="pb-3">
        <CardTitle className="text-2xl flex items-center gap-2">
          <Compass className="h-6 w-6 text-indigo-500" />
          Because of your activity
        </CardTitle>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="rounded-lg border border-dashed bg-muted/30 px-4 py-8 text-center text-sm text-muted-foreground">
            Personalizing drinks based on your recent activity...
          </div>
        ) : items.length === 0 ? (
          <div className="rounded-lg border border-dashed bg-muted/30 px-4 py-8 text-center text-sm text-muted-foreground">
            Keep exploring or remixing drinks to unlock personalized picks here.
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {items.map((item) => (
              <div key={item.slug} className="rounded-xl border bg-white/90 p-3 transition hover:shadow-md hover:-translate-y-0.5">
                <div className="flex gap-3 items-start">
                  <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-md bg-muted">
                    {item.image ? <img src={item.image} alt={item.name} className="h-full w-full object-cover" loading="lazy" /> : null}
                  </div>
                  <div className="min-w-0 flex-1">
                    <Link href={`/drinks/recipe/${item.slug}`} className="font-semibold leading-tight line-clamp-2 underline underline-offset-2 hover:text-foreground">
                      {item.name}
                    </Link>
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      <Badge variant="outline" className="text-[10px]">{item.sourceTitle}</Badge>
                      <span className="text-[10px] text-muted-foreground">{item.reason}</span>
                    </div>
                  </div>
                </div>
                <div className="mt-3 flex gap-2">
                  <Link href={`/drinks/recipe/${item.slug}`}><Button size="sm" variant="outline">View</Button></Link>
                  <Link href={`/drinks/submit?remix=${encodeURIComponent(item.slug)}`}><Button size="sm" variant="ghost">Remix</Button></Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
