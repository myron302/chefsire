import { useEffect, useMemo, useState } from "react";
import { Link } from "wouter";
import { Trophy, Users } from "lucide-react";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import CreatorFollowButton from "@/components/drinks/CreatorFollowButton";

type CreatorLeaderboardItem = {
  userId: string;
  username: string | null;
  avatar: string | null;
  creatorScore: number;
  totalCreated: number;
  totalViews7d: number;
  totalRemixesReceived: number;
  totalGroceryAdds: number;
  followerCount?: number;
  topDrink: {
    slug: string;
    name: string;
    image: string | null;
    route: string;
    score: number;
    remixesCount: number;
  } | null;
};

type CreatorLeaderboardResponse = {
  ok?: boolean;
  leaderboard?: CreatorLeaderboardItem[];
};

function metricNumber(value: number): string {
  return new Intl.NumberFormat().format(value);
}

function initials(username: string | null): string {
  if (!username) return "CR";
  return username.slice(0, 2).toUpperCase();
}

export default function TopDrinkCreators() {
  const [items, setItems] = useState<CreatorLeaderboardItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;

    const loadTopCreators = async () => {
      try {
        const response = await fetch("/api/drinks/creators/leaderboard?limit=6");
        if (!response.ok) throw new Error("Unable to fetch top drink creators");

        const data = (await response.json()) as CreatorLeaderboardResponse;
        if (!active) return;
        setItems(Array.isArray(data.leaderboard) ? data.leaderboard : []);
      } catch {
        if (active) setItems([]);
      } finally {
        if (active) setLoading(false);
      }
    };

    loadTopCreators();
    return () => {
      active = false;
    };
  }, []);

  const leaderboard = useMemo(() => items.slice(0, 6), [items]);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between gap-3">
          <CardTitle className="flex items-center gap-2">
          <Trophy className="h-5 w-5 text-amber-500" />
          Top Drink Creators
          </CardTitle>
          <Link href="/drinks/creators/trending">
            <Button size="sm" variant="outline">View trending creators</Button>
          </Link>
        </div>
        <CardDescription>
          Rising creators ranked by 7-day views, remixes, grocery adds, and drink output.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {loading ? (
          <p className="text-sm text-muted-foreground">Loading top creators...</p>
        ) : leaderboard.length === 0 ? (
          <div className="space-y-3 rounded-lg border border-dashed p-4">
            <p className="text-sm font-medium">Top creators will appear here soon.</p>
            <p className="text-sm text-muted-foreground">
              No leaderboard data is available yet. Be one of the first to publish drinks and build momentum.
            </p>
            <div className="flex flex-wrap gap-2">
              <Link href="/drinks/submit">
                <Button size="sm">Submit a Drink Recipe</Button>
              </Link>
              <Link href="/drinks/creator-dashboard">
                <Button size="sm" variant="outline">Open Creator Dashboard</Button>
              </Link>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            {leaderboard.map((creator, index) => (
              <div key={creator.userId} className="flex items-start justify-between gap-4 rounded-lg border p-3">
                <div className="flex items-start gap-3">
                  <Avatar className="h-9 w-9">
                    <AvatarImage src={creator.avatar ?? undefined} alt={creator.username ?? "Creator"} />
                    <AvatarFallback>{initials(creator.username)}</AvatarFallback>
                  </Avatar>

                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">#{index + 1}</span>
                      <Link href={`/drinks/creator/${encodeURIComponent(creator.userId)}`} className="underline underline-offset-2 hover:text-primary">{creator.username ?? "Unnamed creator"}</Link>
                      <Badge variant="secondary">Score {metricNumber(Math.round(creator.creatorScore))}</Badge>
                    </div>

                    <p className="text-xs text-muted-foreground">
                      {metricNumber(creator.totalCreated)} drinks • {metricNumber(creator.totalViews7d)} views (7d) • {metricNumber(creator.totalRemixesReceived)} remixes • {metricNumber(creator.totalGroceryAdds)} grocery adds • {metricNumber(creator.followerCount ?? 0)} followers
                    </p>

                    {creator.topDrink ? (
                      <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                        <span>
                          Top drink: <Link className="underline" href={creator.topDrink.route}>{creator.topDrink.name}</Link>
                        </span>
                        <Badge variant="secondary">🔥 {metricNumber(creator.topDrink.remixesCount)} remixes</Badge>
                      </div>
                    ) : null}
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <CreatorFollowButton creatorId={creator.userId} />
                  <Link href={`/drinks/creator/${encodeURIComponent(creator.userId)}`}>
                    <Button variant="outline" size="sm" className="gap-1">
                      <Users className="h-4 w-4" />
                      Creator
                    </Button>
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
