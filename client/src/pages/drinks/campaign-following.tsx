import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";

import CreatorCampaignCard, { type CreatorCampaignItem } from "@/components/drinks/CreatorCampaignCard";
import DrinksPlatformNav from "@/components/drinks/DrinksPlatformNav";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useUser } from "@/contexts/UserContext";

type CampaignUpdateItem = {
  id: string;
  targetType: "drop" | "post" | "roadmap" | "promo";
  label: string;
  title: string;
  description: string | null;
  timestamp: string | null;
  route: string;
};

type FollowedCampaignItem = {
  campaign: CreatorCampaignItem;
  recentUpdates: CampaignUpdateItem[];
  linkedCounts: CreatorCampaignItem["counts"];
};

type FollowedCampaignsResponse = {
  ok: boolean;
  count: number;
  items: FollowedCampaignItem[];
};

function formatDateTime(value: string | null) {
  if (!value) return "Recent";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Recent";
  return new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(date);
}

export default function DrinkCampaignFollowingPage() {
  const { user, loading: userLoading } = useUser();

  const query = useQuery<FollowedCampaignsResponse>({
    queryKey: ["/api/drinks/campaigns/following", user?.id ?? ""],
    queryFn: async () => {
      const response = await fetch("/api/drinks/campaigns/following", { credentials: "include" });
      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(payload?.error || payload?.message || `Failed to load followed campaigns (${response.status})`);
      }
      return payload as FollowedCampaignsResponse;
    },
    enabled: Boolean(user?.id),
  });

  if (userLoading) {
    return <div className="container mx-auto max-w-6xl px-4 py-8">Loading campaign follows…</div>;
  }

  if (!user) {
    return (
      <div className="container mx-auto max-w-6xl space-y-4 px-4 py-8">
        <DrinksPlatformNav current="campaigns" />
        <Card>
          <CardHeader>
            <CardTitle>Follow campaign arcs</CardTitle>
            <CardDescription>Sign in to follow creator seasons/campaigns and keep their themed updates in one cleaner lane.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            <Link href="/auth/login"><Button>Sign in</Button></Link>
            <Link href="/drinks/campaigns"><Button variant="outline">Browse campaigns</Button></Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  const items = query.data?.items ?? [];

  return (
    <div className="container mx-auto max-w-6xl space-y-6 px-4 py-8">
      <DrinksPlatformNav current="campaigns" />

      <section className="space-y-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="space-y-2">
            <h1 className="text-3xl font-bold">Followed Campaigns</h1>
            <p className="max-w-3xl text-sm text-muted-foreground">
              A lightweight stream of campaign arcs you chose to follow, with the newest linked drops, posts, promo starts, and roadmap moments.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link href="/drinks/feed"><Button variant="outline">Creator feed</Button></Link>
            <Link href="/drinks/campaigns"><Button>Browse campaigns</Button></Link>
          </div>
        </div>
      </section>

      {query.isLoading ? <Card><CardContent className="p-6 text-sm text-muted-foreground">Loading followed campaigns…</CardContent></Card> : null}
      {query.isError ? <Card><CardContent className="p-6 text-sm text-destructive">{query.error instanceof Error ? query.error.message : "Unable to load followed campaigns right now."}</CardContent></Card> : null}

      {query.isSuccess ? (
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="rounded-md border p-3">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Campaigns followed</p>
            <p className="text-2xl font-semibold">{items.length}</p>
          </div>
          <div className="rounded-md border p-3">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Freshest lane</p>
            <p className="text-sm font-medium">Followed arcs surface without replacing the main creator feed.</p>
          </div>
          <div className="rounded-md border p-3">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Access rules</p>
            <p className="text-sm font-medium">Follower/member content still respects its original visibility.</p>
          </div>
        </div>
      ) : null}

      {query.isSuccess && items.length === 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>No followed campaigns yet</CardTitle>
            <CardDescription>Follow a campaign from its detail page to keep tabs on a specific season, launch arc, or release story.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            <Link href="/drinks/campaigns"><Button>Browse campaigns</Button></Link>
            <Link href="/drinks/discover"><Button variant="outline">Discover creators</Button></Link>
          </CardContent>
        </Card>
      ) : null}

      <div className="space-y-4">
        {items.map((item) => (
          <Card key={item.campaign.id}>
            <CardContent className="space-y-4 p-4">
              <CreatorCampaignCard campaign={item.campaign} showCreator />
              <div className="space-y-3 rounded-lg border bg-muted/20 p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <h2 className="font-semibold">Recent campaign updates</h2>
                    <p className="text-sm text-muted-foreground">Latest linked movement from this arc. Access rules still apply per item.</p>
                  </div>
                  <Link href={item.campaign.route}><Button size="sm" variant="outline">Open campaign</Button></Link>
                </div>

                {item.recentUpdates.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No visible updates yet. This campaign stays followed and will feel more alive as linked content lands.</p>
                ) : (
                  <div className="space-y-3">
                    {item.recentUpdates.map((update) => (
                      <Link key={update.id} href={update.route}>
                        <div className="rounded-md border bg-background p-3 transition-colors hover:border-primary/40">
                          <div className="flex flex-wrap items-center gap-2">
                            <Badge variant="outline">{update.label}</Badge>
                            <Badge variant="secondary">{formatDateTime(update.timestamp)}</Badge>
                          </div>
                          <p className="mt-2 font-medium">{update.title}</p>
                          {update.description ? <p className="mt-1 line-clamp-3 text-sm text-muted-foreground">{update.description}</p> : null}
                        </div>
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
