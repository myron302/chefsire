import { useEffect, useState } from "react";
import { Link } from "wouter";
import { ArrowUpRight, Flame, Eye } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import DrinksPlatformNav from "@/components/drinks/DrinksPlatformNav";

type MostRemixedDrinkItem = {
  slug: string;
  name: string;
  image: string | null;
  route: string;
  sourceCategoryRoute: string | null;
  remixCount?: number;
  remixesCount?: number;
  views7d?: number;
};

type MostRemixedResponse = {
  ok?: boolean;
  count?: number;
  items?: MostRemixedDrinkItem[];
};

function metricNumber(value: number | null | undefined): string {
  return new Intl.NumberFormat().format(Number(value ?? 0));
}

export default function MostRemixedDrinksPage() {
  const [items, setItems] = useState<MostRemixedDrinkItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");

  useEffect(() => {
    let active = true;

    const run = async () => {
      setLoading(true);
      setLoadError("");
      try {
        const response = await fetch("/api/drinks/most-remixed");
        if (!response.ok) throw new Error("Unable to fetch most remixed drinks");
        const data = (await response.json()) as MostRemixedResponse;
        if (!active) return;
        setItems(Array.isArray(data.items) ? data.items : []);
      } catch (error) {
        if (active) {
          setItems([]);
          setLoadError(error instanceof Error ? error.message : "Unable to fetch most remixed drinks right now.");
        }
      } finally {
        if (active) setLoading(false);
      }
    };

    void run();

    return () => {
      active = false;
    };
  }, []);

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="container mx-auto max-w-6xl px-4 py-8">
        <div className="mb-6">
          <h1 className="text-3xl font-bold">Most Remixed Drinks</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Canonical drinks inspiring the most remix activity across ChefSire.
          </p>
        </div>

        <div className="mb-6">
          <DrinksPlatformNav current="most-remixed" />
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Top original drinks by remix count</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? <p className="text-sm text-muted-foreground">Loading most remixed drinks...</p> : null}
            {!loading && loadError ? (
              <p className="text-sm text-destructive">{loadError} You can still use the platform links above to continue exploring.</p>
            ) : null}
            {!loading && items.length === 0 ? (
              <p className="text-sm text-muted-foreground">No remix activity yet.</p>
            ) : null}

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
              {items.map((item, index) => {
                const remixCount = Number(item.remixCount ?? item.remixesCount ?? 0);
                const views7d = Number(item.views7d ?? 0);
                return (
                <Card key={item.slug} className="overflow-hidden border">
                  <div className="aspect-video bg-slate-100">
                    {item.image ? (
                      <img src={item.image} alt={item.name} className="h-full w-full object-cover" />
                    ) : (
                      <div className="flex h-full items-center justify-center text-xs text-muted-foreground">No image</div>
                    )}
                  </div>
                  <CardContent className="space-y-3 p-4">
                    <div className="flex items-center justify-between gap-2">
                      <Badge variant="secondary">#{index + 1}</Badge>
                      <Badge className="gap-1"><Flame className="h-3 w-3" /> {metricNumber(remixCount)} remixes</Badge>
                    </div>

                    <h2 className="line-clamp-2 text-lg font-semibold">{item.name}</h2>

                    <div className="flex items-center gap-3 text-xs text-muted-foreground">
                      <span>{item.slug}</span>
                      <span className="inline-flex items-center gap-1"><Eye className="h-3 w-3" /> {metricNumber(views7d)} views (7d)</span>
                    </div>

                    <div className="flex items-center gap-2">
                      <Link href={item.route}>
                        <Button size="sm" className="gap-1">View canonical <ArrowUpRight className="h-3 w-3" /></Button>
                      </Link>
                      <Link href={`/drinks/submit?remix=${encodeURIComponent(item.slug)}`}>
                        <Button size="sm" variant="outline">Remix this</Button>
                      </Link>
                    </div>

                    {item.sourceCategoryRoute ? (
                      <div className="text-xs text-muted-foreground">
                        Category: <Link href={item.sourceCategoryRoute} className="underline underline-offset-2">Browse source category</Link>
                      </div>
                    ) : null}
                  </CardContent>
                </Card>
                );
              })}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
