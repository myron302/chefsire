import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";

import CreatorDropCard, { type CreatorDropItem } from "@/components/drinks/CreatorDropCard";
import DrinksPlatformNav from "@/components/drinks/DrinksPlatformNav";
import { useUser } from "@/contexts/UserContext";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

type DropsFeedResponse = {
  ok: boolean;
  signedIn: boolean;
  count: number;
  visibility: {
    public: boolean;
    followers: boolean;
    members: boolean;
  };
  items: CreatorDropItem[];
};

function readErrorMessage(error: unknown, fallback: string) {
  if (error instanceof Error && error.message.trim()) return error.message;
  return fallback;
}

function dayKey(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Unknown date";
  return new Intl.DateTimeFormat(undefined, { weekday: "short", month: "short", day: "numeric", year: "numeric" }).format(date);
}

export default function DrinkDropsPage() {
  const { user, loading: userLoading } = useUser();

  const dropsQuery = useQuery<DropsFeedResponse>({
    queryKey: ["/api/drinks/drops/feed", user?.id ?? "guest"],
    queryFn: async () => {
      const response = await fetch("/api/drinks/drops/feed", { credentials: "include" });
      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(payload?.error || payload?.message || `Failed to load scheduled drops (${response.status})`);
      }
      return payload as DropsFeedResponse;
    },
  });

  if (userLoading) {
    return <div className="container mx-auto max-w-6xl px-4 py-8">Loading drops calendar…</div>;
  }

  const drops = dropsQuery.data?.items ?? [];
  const groupedDrops = drops.reduce<Record<string, CreatorDropItem[]>>((acc, drop) => {
    const key = dayKey(drop.scheduledFor);
    acc[key] = acc[key] ? [...acc[key], drop] : [drop];
    return acc;
  }, {});

  return (
    <div className="container mx-auto max-w-6xl space-y-6 px-4 py-8" data-testid="drinks-drops-page">
      <DrinksPlatformNav current="drops" />

      <section className="space-y-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="space-y-2">
            <h1 className="text-3xl font-bold">Scheduled Drops</h1>
            <p className="max-w-3xl text-sm text-muted-foreground">
              Browse upcoming collection launches, promo windows, member drops, and challenge announcements across the drinks platform in one lightweight calendar-style list.
            </p>
            <div className="flex flex-wrap gap-2">
              <Badge variant="outline">Upcoming only</Badge>
              <Badge variant="outline">Public for everyone</Badge>
              <Badge variant="outline">Follower + member visibility respected</Badge>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link href="/drinks/discover"><Button variant="outline">Discover hub</Button></Link>
            <Link href="/drinks/feed"><Button variant="outline">Creator feed</Button></Link>
            <Link href="/drinks/creator-dashboard#drops"><Button variant="outline">Schedule a drop</Button></Link>
            {!user ? <Link href="/auth/login"><Button>Sign in for personalized drops</Button></Link> : null}
          </div>
        </div>

        {!user ? (
          <Card>
            <CardHeader>
              <CardTitle>Public calendar preview</CardTitle>
              <CardDescription>
                Signed-out visitors see public drops only. Sign in to unlock follower-only and member-only drops from creators you already support.
              </CardDescription>
            </CardHeader>
          </Card>
        ) : null}
      </section>

      {dropsQuery.isSuccess ? (
        <div className="grid gap-3 md:grid-cols-3">
          <div className="rounded-md border p-3">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Visible upcoming drops</p>
            <p className="text-2xl font-semibold">{drops.length}</p>
          </div>
          <div className="rounded-md border p-3">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Signed in</p>
            <p className="text-sm font-medium">{user ? "Yes — personalized visibility" : "No — public only"}</p>
          </div>
          <div className="rounded-md border p-3">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Best for</p>
            <p className="text-sm font-medium">Launch planning, creator teasers, member perks, and promo timing</p>
          </div>
        </div>
      ) : null}

      {dropsQuery.isLoading ? (
        <Card>
          <CardContent className="p-6 text-sm text-muted-foreground">Loading upcoming drops…</CardContent>
        </Card>
      ) : null}

      {dropsQuery.isError ? (
        <Card>
          <CardContent className="p-6 text-sm text-destructive">
            {readErrorMessage(dropsQuery.error, "Unable to load the drops calendar right now.")}
          </CardContent>
        </Card>
      ) : null}

      {dropsQuery.isSuccess && drops.length === 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>No upcoming drops yet</CardTitle>
            <CardDescription>
              {user
                ? "Follow creators or join creator memberships so this calendar gets more signal as drops are scheduled."
                : "Creators have not published any public drops yet."}
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            <Link href="/drinks/creators/trending"><Button>Browse creators</Button></Link>
            <Link href="/drinks/discover"><Button variant="outline">Open discover hub</Button></Link>
          </CardContent>
        </Card>
      ) : null}

      {Object.entries(groupedDrops).map(([label, group]) => (
        <section key={label} className="space-y-3">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-xl font-semibold">{label}</h2>
            <span className="text-sm text-muted-foreground">{group.length} drop{group.length === 1 ? "" : "s"}</span>
          </div>
          <div className="space-y-3">
            {group.map((drop) => (
              <CreatorDropCard key={drop.id} drop={drop} />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
