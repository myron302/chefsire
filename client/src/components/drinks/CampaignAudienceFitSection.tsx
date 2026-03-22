import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useUser } from "@/contexts/UserContext";

type AudienceSegment = "public" | "followers" | "members";
type AudienceFitConfidence = "high" | "medium" | "low" | "none";

type CampaignAudienceFitSegmentSummary = {
  audience: AudienceSegment;
  campaignFollows: number;
  dropRsvps: number;
  dropViews: number;
  dropClicks: number;
  purchases: number;
  memberships: number;
  weightedScore: number;
  weightedScoreNote: string;
};

type CampaignAudienceFitItem = {
  campaignId: string;
  slug: string;
  name: string;
  route: string;
  visibility: AudienceSegment;
  state: "upcoming" | "active" | "past";
  bestAudienceFit: AudienceSegment | null;
  bestAudienceFitConfidence: AudienceFitConfidence;
  bestAudienceFitReason: string | null;
  audienceSegments: CampaignAudienceFitSegmentSummary[];
  topSignals: string[];
  notes: string[];
};

type CampaignAudienceFitLeader = {
  campaignId: string;
  name: string;
  slug: string;
  route: string;
  weightedScore: number;
};

type CampaignAudienceFitResponse = {
  ok: boolean;
  userId: string;
  summary: {
    totalCampaigns: number;
    activeCampaigns: number;
    publicBestFitCount: number;
    followerBestFitCount: number;
    memberBestFitCount: number;
    noClearFitCount: number;
    bestPublicCampaign: CampaignAudienceFitLeader | null;
    bestFollowerCampaign: CampaignAudienceFitLeader | null;
    bestMemberCampaign: CampaignAudienceFitLeader | null;
  };
  items: CampaignAudienceFitItem[];
  attributionNotes: string[];
  generatedAt: string;
};

function formatGeneratedAt(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "just now";
  return new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(date);
}

function audienceLabel(value: AudienceSegment | null) {
  switch (value) {
    case "followers":
      return "Follower fit";
    case "members":
      return "Member fit";
    case "public":
      return "Public fit";
    default:
      return "No clear fit";
  }
}

function confidenceLabel(value: AudienceFitConfidence) {
  switch (value) {
    case "high":
      return "high confidence";
    case "medium":
      return "medium confidence";
    case "low":
      return "low confidence";
    case "none":
    default:
      return "not enough signal";
  }
}

function fitBadgeVariant(value: AudienceSegment | null) {
  return value ? "secondary" : "outline";
}

function LeaderCard({
  title,
  item,
}: {
  title: string;
  item: CampaignAudienceFitLeader | null;
}) {
  return (
    <div className="rounded-md border p-3">
      <p className="text-xs uppercase tracking-wide text-muted-foreground">{title}</p>
      {item ? (
        <div className="mt-2 space-y-1">
          <p className="font-medium">{item.name}</p>
          <p className="text-sm text-muted-foreground">Score {item.weightedScore}</p>
          <Link href={item.route} className="text-xs underline underline-offset-2">Open campaign</Link>
        </div>
      ) : <p className="mt-2 text-sm text-muted-foreground">No segment leader yet.</p>}
    </div>
  );
}

export default function CampaignAudienceFitSection() {
  const { user } = useUser();
  const query = useQuery<CampaignAudienceFitResponse>({
    queryKey: ["/api/drinks/creator-dashboard/campaign-audience-fit", user?.id ?? ""],
    queryFn: async () => {
      const response = await fetch("/api/drinks/creator-dashboard/campaign-audience-fit", { credentials: "include" });
      const payload = await response.json().catch(() => null);
      if (!response.ok) throw new Error(payload?.error || payload?.message || `Failed to load campaign audience fit (${response.status})`);
      return payload as CampaignAudienceFitResponse;
    },
    enabled: Boolean(user?.id),
  });

  const summary = query.data?.summary;

  return (
    <Card id="campaign-audience-fit">
      <CardHeader>
        <CardTitle>Campaign Audience Segments / Best Audience Fit</CardTitle>
        <CardDescription>
          See which campaigns are landing best with public audiences, follower audiences, or member audiences using only the audience relationships that already exist in the drinks platform.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-md border p-3">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Campaigns scored</p>
            <p className="text-xl font-semibold">{summary?.totalCampaigns ?? 0}</p>
          </div>
          <div className="rounded-md border p-3">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Public-fit leaders</p>
            <p className="text-xl font-semibold">{summary?.publicBestFitCount ?? 0}</p>
          </div>
          <div className="rounded-md border p-3">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Follower-fit leaders</p>
            <p className="text-xl font-semibold">{summary?.followerBestFitCount ?? 0}</p>
          </div>
          <div className="rounded-md border p-3">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Member-fit leaders</p>
            <p className="text-xl font-semibold">{summary?.memberBestFitCount ?? 0}</p>
          </div>
        </div>

        {query.isLoading ? <p className="text-sm text-muted-foreground">Loading campaign audience fit…</p> : null}
        {query.isError ? <p className="text-sm text-destructive">{query.error instanceof Error ? query.error.message : "Unable to load campaign audience fit right now."}</p> : null}

        {query.data ? (
          <div className="rounded-md border border-dashed p-4 text-sm text-muted-foreground">
            <p className="font-medium text-foreground">How to read this</p>
            <p className="mt-1">This is a creator insight layer, not a hidden segmentation engine. Public means anonymous or not currently connected. Followers means the viewer had a creator-follow relationship ChefSire could infer. Members means the viewer had active creator membership access ChefSire could infer for that moment.</p>
            <p className="mt-1">Updated {formatGeneratedAt(query.data.generatedAt)}.</p>
          </div>
        ) : null}

        <div className="grid gap-3 md:grid-cols-3">
          <LeaderCard title="Best public campaign" item={summary?.bestPublicCampaign ?? null} />
          <LeaderCard title="Best follower campaign" item={summary?.bestFollowerCampaign ?? null} />
          <LeaderCard title="Best member campaign" item={summary?.bestMemberCampaign ?? null} />
        </div>

        {query.data?.items?.length ? (
          <div className="overflow-x-auto rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Campaign</TableHead>
                  <TableHead>Best fit</TableHead>
                  <TableHead>Public</TableHead>
                  <TableHead>Followers</TableHead>
                  <TableHead>Members</TableHead>
                  <TableHead>Why it fits</TableHead>
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
                        <Link href={item.route} className="text-xs underline underline-offset-2">Open campaign</Link>
                        {item.topSignals.length ? (
                          <div className="flex flex-wrap gap-2">
                            {item.topSignals.map((signal) => <Badge key={signal} variant="secondary">{signal}</Badge>)}
                          </div>
                        ) : null}
                      </div>
                    </TableCell>
                    <TableCell className="min-w-[170px] align-top">
                      <div className="space-y-2 text-sm">
                        <Badge variant={fitBadgeVariant(item.bestAudienceFit)}>{audienceLabel(item.bestAudienceFit)}</Badge>
                        <p className="text-muted-foreground">{confidenceLabel(item.bestAudienceFitConfidence)}</p>
                      </div>
                    </TableCell>
                    {(["public", "followers", "members"] as const).map((audience) => {
                      const segment = item.audienceSegments.find((entry) => entry.audience === audience);
                      return (
                        <TableCell key={audience} className="min-w-[150px] align-top">
                          <div className="space-y-1 text-sm">
                            <p className="font-medium">Score {segment?.weightedScore ?? 0}</p>
                            <p className="text-xs text-muted-foreground">
                              {segment?.campaignFollows ?? 0} follows · {segment?.dropRsvps ?? 0} RSVPs · {segment?.dropClicks ?? 0} clicks
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {segment?.purchases ?? 0} purchases · {segment?.memberships ?? 0} memberships · {segment?.dropViews ?? 0} views
                            </p>
                          </div>
                        </TableCell>
                      );
                    })}
                    <TableCell className="min-w-[280px] align-top">
                      <div className="space-y-2 text-sm text-muted-foreground">
                        <p>{item.bestAudienceFitReason ?? "No clear audience winner yet."}</p>
                        {item.notes.slice(0, 2).map((note) => <p key={note} className="text-xs">{note}</p>)}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        ) : null}

        {query.data?.attributionNotes?.length ? (
          <div className="space-y-2">
            <p className="text-sm font-medium">Attribution notes</p>
            <ul className="space-y-2 text-sm text-muted-foreground">
              {query.data.attributionNotes.map((note) => <li key={note}>• {note}</li>)}
            </ul>
          </div>
        ) : null}

        <div className="flex flex-wrap gap-2">
          <Link href="/drinks/creator-dashboard#campaigns"><Button variant="outline">Manage campaigns</Button></Link>
          <Link href="/drinks/campaigns"><Button variant="ghost">Browse campaigns</Button></Link>
        </div>
      </CardContent>
    </Card>
  );
}
