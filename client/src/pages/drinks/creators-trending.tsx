import { useEffect, useMemo, useState } from "react";
import { Link } from "wouter";
import { ArrowUpRight, Flame, GlassWater, TrendingUp, UserRound, Users } from "lucide-react";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import DrinksPlatformNav from "@/components/drinks/DrinksPlatformNav";
import CreatorFollowButton from "@/components/drinks/CreatorFollowButton";
import { useUser } from "@/contexts/UserContext";

type TrendingCreatorItem = {
  userId: string;
  username: string | null;
  avatar: string | null;
  followerCount?: number;
  creatorScore: number;
  totalCreated: number;
  recentCreatedCount: number;
  totalViews7d: number;
  totalRemixesReceived: number;
  totalGroceryAdds: number;
  publicRoute: string;
  topDrink: {
    slug: string;
    name: string;
    image: string | null;
    route: string;
    score: number;
  } | null;
};

type TrendingCreatorsResponse = {
  ok?: boolean;
  creators?: TrendingCreatorItem[];
  count?: number;
  rankingFormula?: string;
};

function metricNumber(value: number): string {
  return new Intl.NumberFormat().format(value);
}

function initials(username: string | null): string {
  if (!username) return "CR";
  return username.slice(0, 2).toUpperCase();
}

export default function TrendingCreatorsPage() {
  const { user } = useUser();
  const [items, setItems] = useState<TrendingCreatorItem[]>([]);
  const [rankingFormula, setRankingFormula] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");

  useEffect(() => {
    let active = true;

    const load = async () => {
      setLoadError("");
      try {
        const response = await fetch("/api/drinks/creators/trending?limit=30");
        if (!response.ok) throw new Error("Unable to load trending creators");

        const data = (await response.json()) as TrendingCreatorsResponse;
        if (!active) return;

        setItems(Array.isArray(data.creators) ? data.creators : []);
        setRankingFormula(data.rankingFormula ?? "");
      } catch (error) {
        if (active) {
          setItems([]);
          setRankingFormula("");
          setLoadError(error instanceof Error ? error.message : "Unable to load trending creators right now.");
        }
      } finally {
        if (active) setLoading(false);
      }
    };

    void load();
    return () => {
      active = false;
    };
  }, []);

  const creators = useMemo(() => items, [items]);

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="container mx-auto max-w-6xl px-4 py-8">
        <div className="mb-6">
          <h1 className="text-3xl font-bold">Trending Creators</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Discover drink creators with the strongest recent momentum.
          </p>
        </div>

        <div className="mb-6">
          <DrinksPlatformNav current="trending-creators" />
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><TrendingUp className="h-5 w-5 text-orange-500" /> Public creator leaderboard</CardTitle>
            <CardDescription>
              Ranked using recent views, remixes received, grocery adds, and new drinks/remixes created in the last 7 days.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {loading ? <p className="text-sm text-muted-foreground">Loading trending creators...</p> : null}
            {!loading && loadError ? <p className="text-sm text-destructive">{loadError}</p> : null}
            {!loading && creators.length === 0 ? (
              <p className="text-sm text-muted-foreground">No creators are trending yet. Publish a drink remix to get on the board.</p>
            ) : null}

            <div className="space-y-3">
              {creators.map((creator, index) => (
                <Card key={creator.userId}>
                  <CardContent className="p-4">
                    <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                      <div className="flex items-start gap-3">
                        <Avatar className="h-10 w-10">
                          <AvatarImage src={creator.avatar ?? undefined} alt={creator.username ?? "Creator"} />
                          <AvatarFallback>{initials(creator.username)}</AvatarFallback>
                        </Avatar>

                        <div className="space-y-2">
                          <div className="flex flex-wrap items-center gap-2">
                            <Badge variant="secondary">#{index + 1}</Badge>
                            <Link href={creator.publicRoute} className="font-semibold underline underline-offset-2 hover:text-primary">
                              {creator.username ?? "Unnamed creator"}
                            </Link>
                            <Badge className="gap-1 bg-orange-100 text-orange-900 hover:bg-orange-100"><Flame className="h-3 w-3" /> Score {metricNumber(Math.round(creator.creatorScore))}</Badge>
                          </div>

                          <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
                            <span>{metricNumber(creator.totalViews7d)} views this week</span>
                            <span>{metricNumber(creator.totalRemixesReceived)} remixes received</span>
                            <span>{metricNumber(creator.recentCreatedCount)} created this week</span>
                            <span>{metricNumber(creator.totalGroceryAdds)} grocery adds</span>
                            <span>{metricNumber(creator.followerCount ?? 0)} followers</span>
                          </div>

                          {creator.topDrink ? (
                            <p className="text-sm text-muted-foreground">
                              Top drink right now:{" "}
                              <Link href={creator.topDrink.route} className="underline underline-offset-2">
                                {creator.topDrink.name}
                              </Link>
                            </p>
                          ) : null}
                        </div>
                      </div>

                      <div className="flex flex-wrap items-start gap-2">
                        <Link href={creator.publicRoute}>
                          <Button size="sm" variant="outline" className="gap-1"><UserRound className="h-4 w-4" />Creator page</Button>
                        </Link>
                        {creator.topDrink ? (
                          <Link href={creator.topDrink.route}>
                            <Button size="sm" className="gap-1">Top drink <ArrowUpRight className="h-3 w-3" /></Button>
                          </Link>
                        ) : null}
                        {user?.id !== creator.userId ? <CreatorFollowButton creatorId={creator.userId} showNudge /> : null}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </CardContent>
        </Card>

        <div className="mt-4 text-xs text-muted-foreground">
          Formula: {rankingFormula || "score = totalViews7d*1 + totalRemixesReceived*4 + totalGroceryAdds*2 + recentCreatedCount*1"}
        </div>

        <div className="mt-6 flex flex-wrap gap-2">
          <Link href="/drinks/remixes"><Button variant="outline" size="sm" className="gap-1"><Users className="h-4 w-4" />Discover remixes</Button></Link>
          <Link href="/drinks/most-remixed"><Button variant="outline" size="sm" className="gap-1"><GlassWater className="h-4 w-4" />Most remixed drinks</Button></Link>
        </div>
      </div>
    </div>
  );
}
