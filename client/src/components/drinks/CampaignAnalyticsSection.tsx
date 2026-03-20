import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useUser } from "@/contexts/UserContext";

type CampaignAnalyticsItem = {
  campaignId: string;
  slug: string;
  name: string;
  visibility: "public" | "followers" | "members";
  isActive: boolean;
  startsAt: string | null;
  endsAt: string | null;
  followerCount: number;
  linkedDropsCount: number;
  linkedPostsCount: number;
  linkedCollectionsCount: number;
  linkedChallengesCount: number;
  totalDropRsvps: number;
  totalDropViews: number;
  totalDropClicks: number;
  purchasesFromLinkedCollections: number;
  purchasesFromLinkedCollectionsNote: string | null;
  membershipsFromCampaign: number;
  membershipsFromCampaignNote: string | null;
  campaignEngagementScore: number;
  campaignEngagementScoreNote: string;
};

interface CampaignAnalyticsResponse {
  ok: boolean;
  userId: string;
  generatedAt: string;
  summary: {
    totalCampaigns: number;
    activeCampaigns: number;
    totalCampaignFollowers: number;
    totalCampaignDropRsvps: number;
    totalCampaignClicks: number;
    totalCampaignPurchases: number;
    totalCampaignMembershipConversions: number;
  };
  attributionNotes: string[];
  items: CampaignAnalyticsItem[];
}

function formatDate(value: string | null) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat(undefined, { dateStyle: "medium" }).format(date);
}

export default function CampaignAnalyticsSection() {
  const { user } = useUser();
  const query = useQuery<CampaignAnalyticsResponse>({
    queryKey: ["/api/drinks/creator-dashboard/campaign-analytics", user?.id ?? ""],
    queryFn: async () => {
      const response = await fetch("/api/drinks/creator-dashboard/campaign-analytics", { credentials: "include" });
      const payload = await response.json().catch(() => null);
      if (!response.ok) throw new Error(payload?.error || payload?.message || `Failed to load campaign analytics (${response.status})`);
      return payload as CampaignAnalyticsResponse;
    },
    enabled: Boolean(user?.id),
  });

  const summary = query.data?.summary;

  return (
    <Card id="campaign-analytics">
      <CardHeader>
        <CardTitle>Campaign Analytics</CardTitle>
        <CardDescription>
          A lightweight read on how each campaign or season is performing across campaign follows, linked drops, linked posts, click-throughs, and approximate conversion proxies.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid gap-2 sm:grid-cols-3 lg:grid-cols-6">
          <div className="rounded-md border p-3"><p className="text-xs uppercase tracking-wide text-muted-foreground">Campaigns</p><p className="text-xl font-semibold">{summary?.totalCampaigns ?? 0}</p></div>
          <div className="rounded-md border p-3"><p className="text-xs uppercase tracking-wide text-muted-foreground">Active</p><p className="text-xl font-semibold">{summary?.activeCampaigns ?? 0}</p></div>
          <div className="rounded-md border p-3"><p className="text-xs uppercase tracking-wide text-muted-foreground">Campaign followers</p><p className="text-xl font-semibold">{summary?.totalCampaignFollowers ?? 0}</p></div>
          <div className="rounded-md border p-3"><p className="text-xs uppercase tracking-wide text-muted-foreground">RSVP interest</p><p className="text-xl font-semibold">{summary?.totalCampaignDropRsvps ?? 0}</p></div>
          <div className="rounded-md border p-3"><p className="text-xs uppercase tracking-wide text-muted-foreground">Click-throughs</p><p className="text-xl font-semibold">{summary?.totalCampaignClicks ?? 0}</p></div>
          <div className="rounded-md border p-3"><p className="text-xs uppercase tracking-wide text-muted-foreground">Approx. conversions</p><p className="text-xl font-semibold">{(summary?.totalCampaignPurchases ?? 0) + (summary?.totalCampaignMembershipConversions ?? 0)}</p></div>
        </div>

        {query.isLoading ? <p className="text-sm text-muted-foreground">Loading campaign analytics…</p> : null}
        {query.isError ? <p className="text-sm text-destructive">{query.error instanceof Error ? query.error.message : "Unable to load campaign analytics right now."}</p> : null}

        {query.data?.attributionNotes?.length ? (
          <div className="rounded-md border border-dashed p-4 text-sm text-muted-foreground">
            <p className="font-medium text-foreground">Attribution notes</p>
            <ul className="mt-2 list-disc space-y-1 pl-5">
              {query.data.attributionNotes.map((note) => <li key={note}>{note}</li>)}
            </ul>
          </div>
        ) : null}

        {query.data?.items?.length ? (
          <div className="overflow-x-auto rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Campaign</TableHead>
                  <TableHead>Window</TableHead>
                  <TableHead>Followers</TableHead>
                  <TableHead>Linked</TableHead>
                  <TableHead>RSVPs</TableHead>
                  <TableHead>Views</TableHead>
                  <TableHead>Clicks</TableHead>
                  <TableHead>Purchases</TableHead>
                  <TableHead>Memberships</TableHead>
                  <TableHead>Score</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {query.data.items.map((item) => (
                  <TableRow key={item.campaignId}>
                    <TableCell>
                      <div className="space-y-1">
                        <p className="font-medium">{item.name}</p>
                        <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                          <span>{item.visibility}</span>
                          <span>{item.isActive ? "active" : "inactive"}</span>
                        </div>
                        <Link href={`/drinks/campaigns/${encodeURIComponent(item.slug)}`} className="text-xs underline underline-offset-2">Open campaign</Link>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="text-sm text-muted-foreground">
                        <p>{formatDate(item.startsAt)}</p>
                        <p>{formatDate(item.endsAt)}</p>
                      </div>
                    </TableCell>
                    <TableCell>{item.followerCount}</TableCell>
                    <TableCell>
                      <div className="text-sm text-muted-foreground">
                        <p>{item.linkedDropsCount} drops</p>
                        <p>{item.linkedPostsCount} posts</p>
                        <p>{item.linkedCollectionsCount} collections</p>
                        <p>{item.linkedChallengesCount} challenges</p>
                      </div>
                    </TableCell>
                    <TableCell>{item.totalDropRsvps}</TableCell>
                    <TableCell>{item.totalDropViews}</TableCell>
                    <TableCell>{item.totalDropClicks}</TableCell>
                    <TableCell>
                      <div>
                        <p>{item.purchasesFromLinkedCollections}</p>
                        {item.purchasesFromLinkedCollectionsNote ? <p className="text-xs text-muted-foreground">approximate</p> : null}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div>
                        <p>{item.membershipsFromCampaign}</p>
                        {item.membershipsFromCampaignNote ? <p className="text-xs text-muted-foreground">approximate</p> : null}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div>
                        <p>{item.campaignEngagementScore}</p>
                        <p className="text-xs text-muted-foreground">weighted</p>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        ) : null}

        {!query.isLoading && !query.isError && !(query.data?.items?.length) ? (
          <Card>
            <CardContent className="p-4 text-sm text-muted-foreground">
              No campaigns yet. Create a season or launch arc first, then linked follows and drop activity will start showing up here.
            </CardContent>
          </Card>
        ) : null}

        <div className="flex flex-wrap gap-2">
          <Link href="/drinks/creator-dashboard#campaigns"><Button variant="outline">Manage campaigns</Button></Link>
          <Link href="/drinks/campaigns"><Button variant="ghost">Browse campaigns</Button></Link>
        </div>
      </CardContent>
    </Card>
  );
}
