import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useUser } from "@/contexts/UserContext";

type CampaignBenchmarkSummaryItem = {
  campaignId: string;
  name: string;
  slug: string;
  route: string;
  value: number;
  label: string;
  note: string | null;
};

type CampaignBenchmarkStrongestVariant = {
  variantId: string;
  label: string;
  headline: string | null;
  ctaTargetType: "follow" | "rsvp" | "collection" | "membership" | "drop" | "challenge";
  metricLabel: string;
  metricValue: number;
  score: number;
  note: string | null;
};

type CampaignBenchmarkItem = {
  campaignId: string;
  slug: string;
  name: string;
  route: string;
  visibility: "public" | "followers" | "members";
  state: "upcoming" | "active" | "past";
  followerCount: number;
  followerGain: number;
  totalDropRsvps: number;
  totalDropViews: number;
  totalDropClicks: number;
  purchasesFromLinkedCollections: number;
  purchasesFromLinkedCollectionsNote: string | null;
  membershipsFromCampaign: number;
  membershipsFromCampaignNote: string | null;
  strongestCtaVariant: CampaignBenchmarkStrongestVariant | null;
  milestonesReachedCount: number;
  goalsCompletedCount: number;
  campaignDurationDays: number;
  engagementScore: number;
  engagementScoreNote: string;
  linkedDropsCount: number;
  linkedCollectionsCount: number;
  linkedPostsCount: number;
  memberFocused: boolean;
  benchmarkLabels: string[];
  reusableTemplateCandidate: boolean;
  reusableTemplateReason: string | null;
};

type CampaignBenchmarksResponse = {
  ok: boolean;
  userId: string;
  summary: {
    totalCampaigns: number;
    campaignsWithDrops: number;
    memberFocusedCampaigns: number;
    bestCampaignByFollowers: CampaignBenchmarkSummaryItem | null;
    bestCampaignByRsvpInterest: CampaignBenchmarkSummaryItem | null;
    bestCampaignByClickThroughs: CampaignBenchmarkSummaryItem | null;
    bestCampaignByPurchases: CampaignBenchmarkSummaryItem | null;
    bestCampaignByMemberships: CampaignBenchmarkSummaryItem | null;
    bestCampaignByGoalCompletion: CampaignBenchmarkSummaryItem | null;
    mostReusableCampaignCandidate: CampaignBenchmarkSummaryItem | null;
  };
  items: CampaignBenchmarkItem[];
  insights: string[];
  attributionNotes: string[];
  generatedAt: string;
};

function formatGeneratedAt(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "just now";
  return new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(date);
}

function SummaryCard({ title, item }: { title: string; item: CampaignBenchmarkSummaryItem | null }) {
  return (
    <div className="rounded-md border p-3">
      <p className="text-xs uppercase tracking-wide text-muted-foreground">{title}</p>
      {item ? (
        <div className="mt-2 space-y-1">
          <p className="font-medium">{item.name}</p>
          <p className="text-sm text-muted-foreground">{item.value} {item.label}</p>
          {item.note ? <p className="text-xs text-muted-foreground">{item.note}</p> : null}
        </div>
      ) : <p className="mt-2 text-sm text-muted-foreground">No clear leader yet.</p>}
    </div>
  );
}

export default function CampaignBenchmarksSection() {
  const { user } = useUser();
  const query = useQuery<CampaignBenchmarksResponse>({
    queryKey: ["/api/drinks/creator-dashboard/campaign-benchmarks", user?.id ?? ""],
    queryFn: async () => {
      const response = await fetch("/api/drinks/creator-dashboard/campaign-benchmarks", { credentials: "include" });
      const payload = await response.json().catch(() => null);
      if (!response.ok) throw new Error(payload?.error || payload?.message || `Failed to load campaign benchmarks (${response.status})`);
      return payload as CampaignBenchmarksResponse;
    },
    enabled: Boolean(user?.id),
  });

  const summary = query.data?.summary;

  return (
    <Card id="campaign-benchmarks">
      <CardHeader>
        <CardTitle>Portfolio Benchmarks / Compare Campaigns</CardTitle>
        <CardDescription>
          Compare your campaigns against each other, not the whole platform, so you can see which arcs and themes are actually working inside your own drinks portfolio over time.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid gap-2 sm:grid-cols-3">
          <div className="rounded-md border p-3">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Campaigns compared</p>
            <p className="text-xl font-semibold">{summary?.totalCampaigns ?? 0}</p>
          </div>
          <div className="rounded-md border p-3">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">With drops</p>
            <p className="text-xl font-semibold">{summary?.campaignsWithDrops ?? 0}</p>
          </div>
          <div className="rounded-md border p-3">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Member-focused</p>
            <p className="text-xl font-semibold">{summary?.memberFocusedCampaigns ?? 0}</p>
          </div>
        </div>

        {query.isLoading ? <p className="text-sm text-muted-foreground">Loading campaign benchmarks…</p> : null}
        {query.isError ? <p className="text-sm text-destructive">{query.error instanceof Error ? query.error.message : "Unable to load campaign benchmarks right now."}</p> : null}

        {query.data ? (
          <div className="rounded-md border border-dashed p-4 text-sm text-muted-foreground">
            <p className="font-medium text-foreground">How to read this</p>
            <p className="mt-1">These labels are relative only to your own campaigns. Approximate purchase and membership rows stay marked so this remains a lightweight creator learning layer, not a full BI attribution system.</p>
            <p className="mt-1">Updated {formatGeneratedAt(query.data.generatedAt)}.</p>
          </div>
        ) : null}

        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <SummaryCard title="Top follower campaign" item={summary?.bestCampaignByFollowers ?? null} />
          <SummaryCard title="Best RSVP campaign" item={summary?.bestCampaignByRsvpInterest ?? null} />
          <SummaryCard title="Best click campaign" item={summary?.bestCampaignByClickThroughs ?? null} />
          <SummaryCard title="Best conversion campaign" item={summary?.bestCampaignByPurchases ?? null} />
          <SummaryCard title="Best member campaign" item={summary?.bestCampaignByMemberships ?? null} />
          <SummaryCard title="Best goal completion" item={summary?.bestCampaignByGoalCompletion ?? null} />
          <SummaryCard title="Reusable template candidate" item={summary?.mostReusableCampaignCandidate ?? null} />
        </div>

        {query.data?.insights?.length ? (
          <div className="space-y-3">
            <div>
              <p className="text-sm font-medium">Quick comparison insights</p>
              <p className="text-sm text-muted-foreground">Rules-based reads from your current portfolio patterns.</p>
            </div>
            <div className="grid gap-3 lg:grid-cols-2">
              {query.data.insights.map((insight) => (
                <div key={insight} className="rounded-md bg-muted/30 p-3 text-sm text-muted-foreground">
                  {insight}
                </div>
              ))}
            </div>
          </div>
        ) : null}

        {query.data?.items?.length ? (
          <div className="overflow-x-auto rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Campaign</TableHead>
                  <TableHead>Followers</TableHead>
                  <TableHead>RSVPs</TableHead>
                  <TableHead>Views</TableHead>
                  <TableHead>Clicks</TableHead>
                  <TableHead>Purchases</TableHead>
                  <TableHead>Members</TableHead>
                  <TableHead>CTA winner</TableHead>
                  <TableHead>Goals / milestones</TableHead>
                  <TableHead>Duration</TableHead>
                  <TableHead>Score</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {query.data.items.map((item) => (
                  <TableRow key={item.campaignId}>
                    <TableCell className="min-w-[240px] align-top">
                      <div className="space-y-2">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="font-medium">{item.name}</p>
                          <Badge variant="outline">{item.visibility}</Badge>
                          <Badge variant={item.state === "active" ? "default" : "secondary"}>{item.state}</Badge>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {item.benchmarkLabels.map((label) => <Badge key={label} variant="secondary">{label}</Badge>)}
                          {item.memberFocused ? <Badge variant="outline">Member-focused</Badge> : null}
                          {item.reusableTemplateCandidate ? <Badge variant="outline">Reuse candidate</Badge> : null}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {item.linkedDropsCount} drops · {item.linkedCollectionsCount} collections · {item.linkedPostsCount} posts
                        </div>
                        <Link href={item.route} className="text-xs underline underline-offset-2">Open campaign</Link>
                      </div>
                    </TableCell>
                    <TableCell className="align-top">
                      <div className="text-sm">
                        <p>{item.followerCount}</p>
                        <p className="text-xs text-muted-foreground">gain {item.followerGain}</p>
                      </div>
                    </TableCell>
                    <TableCell className="align-top">{item.totalDropRsvps}</TableCell>
                    <TableCell className="align-top">{item.totalDropViews}</TableCell>
                    <TableCell className="align-top">{item.totalDropClicks}</TableCell>
                    <TableCell className="align-top">
                      <div className="text-sm">
                        <p>{item.purchasesFromLinkedCollections}</p>
                        {item.purchasesFromLinkedCollectionsNote ? <p className="text-xs text-muted-foreground">approx.</p> : null}
                      </div>
                    </TableCell>
                    <TableCell className="align-top">
                      <div className="text-sm">
                        <p>{item.membershipsFromCampaign}</p>
                        {item.membershipsFromCampaignNote ? <p className="text-xs text-muted-foreground">approx.</p> : null}
                      </div>
                    </TableCell>
                    <TableCell className="min-w-[180px] align-top">
                      {item.strongestCtaVariant ? (
                        <div className="space-y-1 text-sm">
                          <p className="font-medium">{item.strongestCtaVariant.label}</p>
                          <p className="text-muted-foreground">{item.strongestCtaVariant.metricValue} {item.strongestCtaVariant.metricLabel}</p>
                          <p className="text-xs text-muted-foreground">{item.strongestCtaVariant.ctaTargetType} CTA</p>
                          {item.strongestCtaVariant.note ? <p className="text-xs text-muted-foreground">{item.strongestCtaVariant.note}</p> : null}
                        </div>
                      ) : <p className="text-sm text-muted-foreground">No CTA leader yet.</p>}
                    </TableCell>
                    <TableCell className="align-top">
                      <div className="text-sm">
                        <p>{item.goalsCompletedCount} goals</p>
                        <p className="text-xs text-muted-foreground">{item.milestonesReachedCount} milestones</p>
                      </div>
                    </TableCell>
                    <TableCell className="align-top">
                      <div className="text-sm">
                        <p>{item.campaignDurationDays} days</p>
                        {item.reusableTemplateReason ? <p className="text-xs text-muted-foreground">{item.reusableTemplateReason}</p> : null}
                      </div>
                    </TableCell>
                    <TableCell className="align-top">
                      <div className="text-sm">
                        <p>{item.engagementScore}</p>
                        <p className="text-xs text-muted-foreground">weighted portfolio score</p>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        ) : null}

        {query.data?.attributionNotes?.length ? (
          <div className="rounded-md border border-dashed p-4 text-sm text-muted-foreground">
            <p className="font-medium text-foreground">Attribution notes</p>
            <ul className="mt-2 list-disc space-y-1 pl-5">
              {query.data.attributionNotes.map((note) => <li key={note}>{note}</li>)}
            </ul>
          </div>
        ) : null}

        {!query.isLoading && !query.isError && !(query.data?.items?.length) ? (
          <div className="rounded-md border border-dashed p-5 text-sm text-muted-foreground">
            No campaigns to compare yet. Once you have a few arcs with follows, drops, or conversions, this section will benchmark them against each other.
          </div>
        ) : null}

        <div className="flex flex-wrap gap-2">
          <Link href="/drinks/campaigns"><Button size="sm" variant="outline">Browse campaigns</Button></Link>
          <Link href="/drinks/creator-dashboard#campaigns"><Button size="sm">Manage campaign arcs</Button></Link>
        </div>
      </CardContent>
    </Card>
  );
}
