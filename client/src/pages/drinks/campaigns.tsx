import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";

import CreatorCampaignCard, { type CreatorCampaignItem } from "@/components/drinks/CreatorCampaignCard";
import DrinksPlatformNav from "@/components/drinks/DrinksPlatformNav";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useUser } from "@/contexts/UserContext";

interface CampaignsResponse {
  ok: boolean;
  count: number;
  items: CreatorCampaignItem[];
}

export default function DrinkCampaignsPage() {
  const { user } = useUser();
  const query = useQuery<CampaignsResponse>({
    queryKey: ["/api/drinks/campaigns", user?.id ?? "guest"],
    queryFn: async () => {
      const response = await fetch("/api/drinks/campaigns", { credentials: "include" });
      const payload = await response.json().catch(() => null);
      if (!response.ok) throw new Error(payload?.error || payload?.message || `Failed to load campaigns (${response.status})`);
      return payload as CampaignsResponse;
    },
  });

  return (
    <div className="container mx-auto max-w-6xl space-y-6 px-4 py-8">
      <DrinksPlatformNav current="creator" />

      <section className="space-y-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="space-y-2">
            <h1 className="text-3xl font-bold">Creator Campaigns / Seasons</h1>
            <p className="max-w-3xl text-sm text-muted-foreground">
              Browse themed creator arcs that group related drops, collections, promos, challenges, roadmap notes, and creator posts into one drinks-native release story.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link href="/drinks/discover"><Button variant="outline">Discover hub</Button></Link>
            <Link href="/drinks/creator-dashboard#campaigns"><Button>Manage my campaigns</Button></Link>
          </div>
        </div>
      </section>

      <Card>
        <CardHeader>
          <CardTitle>Why campaigns exist</CardTitle>
          <CardDescription>
            This is a storytelling and discovery layer, not a giant CMS. Campaign pages stay lightweight and simply connect the surfaces creators already use.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-3 text-sm text-muted-foreground">
          <div className="rounded-md border p-3">Examples: Summer Cocktail Series, Zero-Proof January, Holiday Entertaining, Wedding Season Specials.</div>
          <div className="rounded-md border p-3">Visibility still respects public, follower, and member access all the way down to the linked content.</div>
          <div className="rounded-md border p-3">Drops, promos, posts, and roadmap notes can now feel like one cohesive release wave.</div>
        </CardContent>
      </Card>

      {query.isLoading ? <Card><CardContent className="p-6 text-sm text-muted-foreground">Loading campaigns…</CardContent></Card> : null}
      {query.isError ? <Card><CardContent className="p-6 text-sm text-destructive">{query.error instanceof Error ? query.error.message : "Unable to load campaigns right now."}</CardContent></Card> : null}

      {!query.isLoading && !query.isError && (query.data?.items.length ?? 0) === 0 ? (
        <Card><CardContent className="p-6 text-sm text-muted-foreground">No visible campaigns yet. Follow creators or join memberships to see more campaign arcs as they launch.</CardContent></Card>
      ) : null}

      <div className="space-y-3">
        {(query.data?.items ?? []).map((campaign) => <CreatorCampaignCard key={campaign.id} campaign={campaign} />)}
      </div>
    </div>
  );
}
