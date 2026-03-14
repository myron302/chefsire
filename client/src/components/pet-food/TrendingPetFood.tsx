import { useEffect, useMemo, useState } from "react";
import TrendingRecipesWidget from "@/components/engagement/TrendingRecipesWidget";

type TrendingPetFoodItem = {
  slug: string;
  name: string;
  image: string | null;
  route?: string;
  sourceCategoryRoute?: string | null;
  score?: number;
  views24h?: number;
  views7d?: number;
};

type TrendingPetFoodApiResponse = {
  ok?: boolean;
  items?: TrendingPetFoodItem[];
};

function getCanonicalRoute(slug: string) {
  return `/pet-food/recipe/${slug}`;
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
    <TrendingRecipesWidget
      title="Trending Pet Food"
      loading={loading}
      items={topItems}
      emptyMessage="No trending pet food recipes yet. Check back soon for the hottest recipes."
      getCanonicalRoute={(item) => getCanonicalRoute(item.slug)}
      renderStats={(petFood) => {
        const viewsToday = Number(petFood.views24h ?? 0);
        const views7d = Number(petFood.views7d ?? 0);
        return (
          <>
            <p className="mt-1 text-xs text-muted-foreground">👀 {viewsToday.toLocaleString()} views today</p>
            <p className="mt-1 text-xs text-muted-foreground">📈 {views7d.toLocaleString()} views this week</p>
          </>
        );
      }}
    />
  );
}
