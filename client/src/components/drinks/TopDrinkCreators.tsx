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
        <CardTitle className="flex items-center gap-2">
          <Trophy className="h-5 w-5 text-amber-500" />
          Top Drink Creators
        </CardTitle>
        <CardDescription>
          Rising creators ranked by 7-day views, remixes, grocery adds, and drink output.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {loading ? (
          <p className="text-sm text-muted-foreground">Loading top creators...</p>
        ) : leaderboard.length === 0 ? (
          <p className="text-sm text-muted-foreground">No creator leaderboard data yet.</p>
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
                      <span>{creator.username ?? "Unnamed creator"}</span>
                      <Badge variant="secondary">Score {metricNumber(Math.round(creator.creatorScore))}</Badge>
                    </div>

                    <p className="text-xs text-muted-foreground">
                      {metricNumber(creator.totalCreated)} drinks • {metricNumber(creator.totalViews7d)} views (7d) • {metricNumber(creator.totalRemixesReceived)} remixes • {metricNumber(creator.totalGroceryAdds)} grocery adds • {metricNumber(creator.followerCount ?? 0)} followers
                    </p>

                    {creator.topDrink ? (
                      <p className="text-xs text-muted-foreground">
                        Top drink: <Link className="underline" href={creator.topDrink.route}>{creator.topDrink.name}</Link>
                      </p>
                    ) : null}
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <CreatorFollowButton creatorId={creator.userId} />
                  <Link href={`/profile/${encodeURIComponent(creator.userId)}`}>
                    <Button variant="outline" size="sm" className="gap-1">
                      <Users className="h-4 w-4" />
                      Profile
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
