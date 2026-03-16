import { useEffect, useMemo, useState } from "react";
import { Link } from "wouter";
import { ArrowUpRight, Clock3, Flame, GitBranchPlus, UserRound } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import DrinksPlatformNav from "@/components/drinks/DrinksPlatformNav";

type RemixSort = "recent" | "popular";

type RemixDiscoveryItem = {
  id: string;
  slug: string;
  name: string;
  image: string | null;
  createdAt: string;
  userId: string | null;
  creatorUsername: string | null;
  creatorAvatar: string | null;
  remixedFromSlug: string | null;
  route: string;
  sourceRoute: string | null;
  views7d?: number;
  remixesCount?: number;
};

type RemixDiscoveryResponse = {
  ok?: boolean;
  sort?: RemixSort;
  count?: number;
  items?: RemixDiscoveryItem[];
  data?: RemixDiscoveryItem[];
};

function metricNumber(value: number | null | undefined): string {
  return new Intl.NumberFormat().format(Number(value ?? 0));
}

function formatWhen(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Recently";
  return new Intl.RelativeTimeFormat("en", { numeric: "auto" }).format(
    Math.round((date.getTime() - Date.now()) / (1000 * 60 * 60 * 24)),
    "day"
  );
}

export default function DrinksRemixDiscoveryPage() {
  const [items, setItems] = useState<RemixDiscoveryItem[]>([]);
  const [sort, setSort] = useState<RemixSort>("recent");
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");

  useEffect(() => {
    let active = true;

    const run = async () => {
      setLoading(true);
      setLoadError("");
      try {
        const response = await fetch(`/api/drinks/remixes?sort=${sort}`);
        const data = (await response.json().catch(() => null)) as RemixDiscoveryResponse | null;
        if (!response.ok) {
          throw new Error(String(data && typeof data === "object" && "error" in data ? (data as any).error : "Unable to fetch remixes"));
        }
        if (!active) return;
        const nextItems = Array.isArray(data?.items) ? data.items : Array.isArray(data?.data) ? data.data : [];
        setItems(nextItems);
      } catch (error) {
        if (active) {
          setItems([]);
          setLoadError(error instanceof Error ? error.message : "Unable to fetch remixes right now.");
        }
      } finally {
        if (active) setLoading(false);
      }
    };

    void run();

    return () => {
      active = false;
    };
  }, [sort]);

  const title = useMemo(() => (sort === "popular" ? "Popular remixes" : "Recent remixes"), [sort]);

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="container mx-auto max-w-6xl px-4 py-8">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold">Drink Remix Discovery</h1>
            <p className="mt-1 text-sm text-muted-foreground">Browse public drink remixes across the platform.</p>
          </div>

          <div className="flex items-center gap-2">
            <Button variant={sort === "recent" ? "default" : "outline"} size="sm" onClick={() => setSort("recent")}>
              <Clock3 className="mr-1 h-4 w-4" /> Recent
            </Button>
            <Button variant={sort === "popular" ? "default" : "outline"} size="sm" onClick={() => setSort("popular")}>
              <Flame className="mr-1 h-4 w-4" /> Popular
            </Button>
          </div>
        </div>

        <div className="mb-6">
          <DrinksPlatformNav current="remixes" />
        </div>

        <Card className="mb-6">
          <CardHeader>
            <CardTitle>{title}</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? <p className="text-sm text-muted-foreground">Loading remixes...</p> : null}
            {!loading && loadError ? (
              <p className="text-sm text-destructive">{loadError} Try refreshing or explore related drinks pages below.</p>
            ) : null}
            {!loading && items.length === 0 ? (
              <p className="text-sm text-muted-foreground">No public remixes yet. Be the first to remix a drink.</p>
            ) : null}

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
              {items.map((item) => (
                <Card key={item.id} className="overflow-hidden border">
                  <div className="aspect-video bg-slate-100">
                    {item.image ? (
                      <img src={item.image} alt={item.name} className="h-full w-full object-cover" />
                    ) : (
                      <div className="flex h-full items-center justify-center text-xs text-muted-foreground">No image</div>
                    )}
                  </div>
                  <CardContent className="space-y-3 p-4">
                    <div className="flex items-center justify-between gap-2">
                      <Badge variant="secondary" className="gap-1"><GitBranchPlus className="h-3 w-3" /> Remix</Badge>
                      <span className="text-xs text-muted-foreground">{formatWhen(item.createdAt)}</span>
                    </div>

                    <h2 className="line-clamp-2 text-lg font-semibold">{item.name}</h2>

                    <p className="text-sm text-muted-foreground">
                      <UserRound className="mr-1 inline h-3 w-3" />
                      by {item.creatorUsername ? `@${item.creatorUsername}` : "ChefSire creator"}
                    </p>

                    {item.remixedFromSlug ? (
                      <p className="text-sm text-muted-foreground">
                        Remix of{" "}
                        {item.sourceRoute ? (
                          <Link href={item.sourceRoute} className="underline underline-offset-2">
                            {item.remixedFromSlug}
                          </Link>
                        ) : (
                          <span>{item.remixedFromSlug}</span>
                        )}
                      </p>
                    ) : null}

                    <div className="flex items-center gap-3 text-xs text-muted-foreground">
                      <span>{metricNumber(item.views7d)} views (7d)</span>
                      <Badge variant="secondary">🔥 {metricNumber(item.remixesCount)} remixes</Badge>
                    </div>

                    <div className="flex items-center gap-2">
                      <Link href={item.route}>
                        <Button size="sm" className="gap-1">View remix <ArrowUpRight className="h-3 w-3" /></Button>
                      </Link>
                      {item.sourceRoute ? (
                        <Link href={item.sourceRoute}>
                          <Button size="sm" variant="outline">Original drink</Button>
                        </Link>
                      ) : null}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </CardContent>
        </Card>

        <div className="text-sm text-muted-foreground">
          Want to publish your own twist? <Link href="/drinks/submit" className="underline underline-offset-2">Submit a drink remix</Link>.
        </div>
      </div>
    </div>
  );
}
