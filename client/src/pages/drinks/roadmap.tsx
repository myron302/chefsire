import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";

import CreatorDropCard, { type CreatorDropItem } from "@/components/drinks/CreatorDropCard";
import CreatorRoadmapCard, { type CreatorRoadmapItem } from "@/components/drinks/CreatorRoadmapCard";
import DrinksPlatformNav from "@/components/drinks/DrinksPlatformNav";
import { useUser } from "@/contexts/UserContext";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

type RoadmapFeedResponse = {
  ok: boolean;
  signedIn: boolean;
  count: number;
  visibility: {
    public: boolean;
    followers: boolean;
    members: boolean;
  };
  counts: {
    upcoming: number;
    live: number;
    archived: number;
  };
  items: CreatorRoadmapItem[];
};

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

export default function DrinkRoadmapPage() {
  const { user, loading: userLoading } = useUser();

  const roadmapQuery = useQuery<RoadmapFeedResponse>({
    queryKey: ["/api/drinks/roadmap/feed", user?.id ?? "guest"],
    queryFn: async () => {
      const response = await fetch("/api/drinks/roadmap/feed", { credentials: "include" });
      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(payload?.error || payload?.message || `Failed to load roadmap (${response.status})`);
      }
      return payload as RoadmapFeedResponse;
    },
  });

  const dropsQuery = useQuery<DropsFeedResponse>({
    queryKey: ["/api/drinks/drops/feed", user?.id ?? "guest"],
    queryFn: async () => {
      const response = await fetch("/api/drinks/drops/feed", { credentials: "include" });
      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(payload?.error || payload?.message || `Failed to load drops (${response.status})`);
      }
      return payload as DropsFeedResponse;
    },
  });

  if (userLoading) {
    return <div className="container mx-auto max-w-6xl px-4 py-8">Loading roadmap…</div>;
  }

  const items = roadmapQuery.data?.items ?? [];
  const dropItems = dropsQuery.data?.items ?? [];
  const upcoming = items.filter((item) => item.status === "upcoming");
  const live = items.filter((item) => item.status === "live");
  const archived = items.filter((item) => item.status === "archived");
  const liveDrops = dropItems.filter((drop) => drop.status === "live");
  const archivedDrops = dropItems.filter((drop) => drop.status === "archived");
  const sections: Array<{ title: string; items: CreatorRoadmapItem[]; description: string }> = [
    { title: "Upcoming", items: upcoming, description: "What creators are signaling next." },
    { title: "Live Now", items: live, description: "Recent launches, active perks, and currently highlighted beats." },
    { title: "Archive / Past Releases", items: archived, description: "Past launches, previous member drops, completed promos, and finished challenge moments." },
  ];

  return (
    <div className="container mx-auto max-w-6xl space-y-6 px-4 py-8" data-testid="drinks-roadmap-page">
      <DrinksPlatformNav current="roadmap" />

      <section className="space-y-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="space-y-2">
            <h1 className="text-3xl font-bold">Creator Roadmap + Archive</h1>
            <p className="max-w-3xl text-sm text-muted-foreground">
              Browse what creators are teasing next, what just went live, and what has already shipped across roadmap notes plus dedicated drop pages and release replays.
            </p>
            <div className="flex flex-wrap gap-2">
              <Badge variant="outline">Upcoming + live + archive</Badge>
              <Badge variant="outline">Dedicated drop pages</Badge>
              <Badge variant="outline">Follower + member visibility respected</Badge>
              <Badge variant="outline">Lightweight storytelling layer</Badge>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link href="/drinks/discover"><Button variant="outline">Discover hub</Button></Link>
            <Link href="/drinks/feed"><Button variant="outline">Creator feed</Button></Link>
            <Link href="/drinks/drops"><Button variant="outline">Drops calendar</Button></Link>
            <Link href="/drinks/creator-dashboard#roadmap"><Button variant="outline">Manage roadmap</Button></Link>
            {!user ? <Link href="/auth/login"><Button>Sign in for full visibility</Button></Link> : null}
          </div>
        </div>

        {!user ? (
          <Card>
            <CardHeader>
              <CardTitle>Public roadmap preview</CardTitle>
              <CardDescription>
                Signed-out visitors see public roadmap items and public drop replays only. Sign in to unlock follower-only and member-only creator storytelling where you already have access.
              </CardDescription>
            </CardHeader>
          </Card>
        ) : null}
      </section>

      {roadmapQuery.isSuccess ? (
        <div className="grid gap-3 md:grid-cols-4">
          <div className="rounded-md border p-3">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Visible items</p>
            <p className="text-2xl font-semibold">{items.length}</p>
          </div>
          <div className="rounded-md border p-3">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Upcoming</p>
            <p className="text-2xl font-semibold">{upcoming.length}</p>
          </div>
          <div className="rounded-md border p-3">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Live now</p>
            <p className="text-2xl font-semibold">{live.length}</p>
          </div>
          <div className="rounded-md border p-3">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Archive</p>
            <p className="text-2xl font-semibold">{archived.length}</p>
          </div>
        </div>
      ) : null}

      {roadmapQuery.isLoading ? (
        <Card>
          <CardContent className="p-6 text-sm text-muted-foreground">Loading roadmap + archive…</CardContent>
        </Card>
      ) : null}

      {roadmapQuery.isError ? (
        <Card>
          <CardContent className="p-6 text-sm text-destructive">
            {readErrorMessage(roadmapQuery.error, "Unable to load creator roadmap right now.")}
          </CardContent>
        </Card>
      ) : null}

      {roadmapQuery.isSuccess && items.length === 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>No roadmap items yet</CardTitle>
            <CardDescription>
              {user
                ? "Follow creators or join memberships so more roadmap and archive stories appear here over time."
                : "Creators have not published any public roadmap items yet."}
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            <Link href="/drinks/creators/trending"><Button>Browse creators</Button></Link>
            <Link href="/drinks/discover"><Button variant="outline">Open discover hub</Button></Link>
          </CardContent>
        </Card>
      ) : null}

      {sections.map((section) => (
        <section key={section.title} className="space-y-3">
          <div className="flex items-baseline justify-between gap-2">
            <div>
              <h2 className="text-xl font-semibold">{section.title}</h2>
              <p className="text-sm text-muted-foreground">{section.description}</p>
            </div>
            <span className="text-sm text-muted-foreground">{section.items.length} item{section.items.length === 1 ? "" : "s"}</span>
          </div>
          {section.items.length === 0 ? (
            <Card>
              <CardContent className="p-4 text-sm text-muted-foreground">Nothing visible in this section right now.</CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {section.items.map((item) => (
                <CreatorRoadmapCard key={item.id} item={item} />
              ))}
            </div>
          )}
        </section>
      ))}

      {liveDrops.length > 0 ? (
        <section className="space-y-3">
          <div className="flex items-baseline justify-between gap-2">
            <div>
              <h2 className="text-xl font-semibold">Live drop pages</h2>
              <p className="text-sm text-muted-foreground">Dedicated launch pages that are active right now.</p>
            </div>
            <Link href="/drinks/drops" className="text-sm underline underline-offset-2">Open drops calendar</Link>
          </div>
          <div className="space-y-3">
            {liveDrops.map((drop) => (
              <CreatorDropCard key={drop.id} drop={drop} />
            ))}
          </div>
        </section>
      ) : null}

      {archivedDrops.length > 0 ? (
        <section className="space-y-3">
          <div className="flex items-baseline justify-between gap-2">
            <div>
              <h2 className="text-xl font-semibold">Drop replays</h2>
              <p className="text-sm text-muted-foreground">Recent replay pages keep release notes and links attached to the original drop story.</p>
            </div>
            <Link href="/drinks/drops" className="text-sm underline underline-offset-2">Open all drops</Link>
          </div>
          <div className="space-y-3">
            {archivedDrops.map((drop) => (
              <CreatorDropCard key={drop.id} drop={drop} />
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}
