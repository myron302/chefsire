import { useEffect, useMemo, useState } from "react";
import { Link } from "wouter";
import TrendingRecipesWidget from "@/components/engagement/TrendingRecipesWidget";
import { Button } from "@/components/ui/button";
import DrinkSocialSignals from "@/components/drinks/DrinkSocialSignals";

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
  remixesCount?: number;
  groceryAdds?: number;
};

type TrendingApiResponse = {
  ok?: boolean;
  items?: TrendingDrink[];
};

function getCanonicalRoute(slug: string) {
  return `/drinks/recipe/${slug}`;
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
    <TrendingRecipesWidget
      title="Trending Drinks"
      loading={loading}
      items={topItems}
      emptyMessage="No trending drinks yet. Check back soon for the hottest recipes."
      getCanonicalRoute={(item) => getCanonicalRoute(item.slug)}
      renderStats={(drink) => {
        const viewsToday = Number(drink.views24h ?? 0);
        const views7d = Number(drink.views7d ?? 0);
        const remixes = Number(drink.remixesCount ?? drink.remixes ?? 0);
        const activityHint = viewsToday >= 20 ? "Active now" : views7d > 0 ? "Recently popular" : "New";
        return (
          <>
            <p className="mt-1 text-[11px] text-muted-foreground">{activityHint}</p>
            <DrinkSocialSignals
              className="mt-2"
              isTrending
              remixesCount={remixes}
              views7d={views7d}
            />
          </>
        );
      }}
      renderFooter={(drink) => (
        <>
          <Link href={getCanonicalRoute(drink.slug)}>
            <Button size="sm" variant="outline">View Recipe</Button>
          </Link>
          <Link href={`/drinks/submit?remix=${encodeURIComponent(drink.slug)}`}>
            <Button size="sm" variant="ghost">Create Remix</Button>
          </Link>
        </>
      )}
    />
  );
}
