import { useEffect, useMemo, useState } from "react";
import { Link } from "wouter";
import { ArrowUpRight, Sparkles, TrendingUp, Users, GitBranchPlus, Star } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import DrinksPlatformNav from "@/components/drinks/DrinksPlatformNav";

type WhatsNewItemType =
  | "remix"
  | "trending_drink"
  | "trending_creator"
  | "followed_creator_post"
  | "most_remixed_highlight";

type WhatsNewItem = {
  type: WhatsNewItemType;
  createdAt: string;
  title: string;
  subtitle: string;
  image: string | null;
  route: string;
  relatedUserId: string | null;
  relatedUsername: string | null;
  relatedDrinkSlug: string | null;
};

type WhatsNewResponse = {
  ok?: boolean;
  count?: number;
  itemTypes?: WhatsNewItemType[];
  items?: WhatsNewItem[];
};

function formatWhen(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Recently";
  return new Intl.RelativeTimeFormat("en", { numeric: "auto" }).format(
    Math.round((date.getTime() - Date.now()) / (1000 * 60 * 60 * 24)),
    "day",
  );
}

function itemBadge(itemType: WhatsNewItemType) {
  switch (itemType) {
    case "remix":
      return { label: "New remix", icon: GitBranchPlus };
    case "trending_drink":
      return { label: "Trending drink", icon: TrendingUp };
    case "trending_creator":
      return { label: "Trending creator", icon: Users };
    case "followed_creator_post":
      return { label: "From creators you follow", icon: Sparkles };
    case "most_remixed_highlight":
      return { label: "Most remixed", icon: Star };
    default:
      return { label: "Update", icon: Sparkles };
  }
}

export default function DrinksWhatsNewPage() {
  const [items, setItems] = useState<WhatsNewItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");

  useEffect(() => {
    let active = true;

    const run = async () => {
      setLoading(true);
      setLoadError("");
      try {
        const response = await fetch("/api/drinks/whats-new");
        if (!response.ok) throw new Error("Unable to fetch what's new feed");
        const data = (await response.json()) as WhatsNewResponse;
        if (!active) return;
        setItems(Array.isArray(data.items) ? data.items : []);
      } catch (error) {
        if (active) {
          setItems([]);
          setLoadError(error instanceof Error ? error.message : "Unable to fetch the What's New feed right now.");
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

  const hasItems = useMemo(() => items.length > 0, [items.length]);

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="container mx-auto max-w-6xl px-4 py-8">
        <div className="mb-6">
          <h1 className="text-3xl font-bold">What&apos;s New in Drinks</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            A live blend of remixes, trending drinks, creator momentum, and followed-creator activity.
          </p>
        </div>

        <div className="mb-6">
          <DrinksPlatformNav current="whats-new" />
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Fresh activity</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? <p className="text-sm text-muted-foreground">Loading activity...</p> : null}
            {!loading && loadError ? (
              <p className="text-sm text-destructive">{loadError} You can continue from the navigation links above while this feed recovers.</p>
            ) : null}

            {!loading && !hasItems ? (
              <div className="rounded-md border border-dashed bg-white p-6 text-sm text-muted-foreground">
                No activity yet. Check back soon as new remixes and creator momentum come in.
              </div>
            ) : null}

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
              {items.map((item, idx) => {
                const badge = itemBadge(item.type);
                const BadgeIcon = badge.icon;
                return (
                  <Card key={`${item.type}-${item.route}-${idx}`} className="overflow-hidden border">
                    <div className="aspect-video bg-slate-100">
                      {item.image ? (
                        <img src={item.image} alt={item.title} className="h-full w-full object-cover" />
                      ) : (
                        <div className="flex h-full items-center justify-center text-xs text-muted-foreground">No image</div>
                      )}
                    </div>
                    <CardContent className="space-y-3 p-4">
                      <div className="flex items-center justify-between gap-2">
                        <Badge variant="secondary" className="gap-1"><BadgeIcon className="h-3 w-3" /> {badge.label}</Badge>
                        <span className="text-xs text-muted-foreground">{formatWhen(item.createdAt)}</span>
                      </div>

                      <h2 className="line-clamp-2 text-lg font-semibold">{item.title}</h2>
                      <p className="text-sm text-muted-foreground">{item.subtitle}</p>

                      <div className="flex items-center gap-2">
                        <Link href={item.route}>
                          <Button size="sm" className="gap-1">Open <ArrowUpRight className="h-3 w-3" /></Button>
                        </Link>
                        {item.relatedUsername && item.relatedUserId ? (
                          <Link href={`/drinks/creator/${encodeURIComponent(item.relatedUserId ?? "")}`}>
                            <Button size="sm" variant="outline">Creator</Button>
                          </Link>
                        ) : null}
                      </div>
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
