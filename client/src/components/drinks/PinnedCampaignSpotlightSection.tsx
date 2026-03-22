import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { Lightbulb, Pin, RefreshCw, TrendingUp } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useUser } from "@/contexts/UserContext";

type SpotlightCandidateItem = {
  campaignId: string;
  name: string;
  slug: string;
  route: string;
  visibility: "public" | "followers" | "members";
  state: "active" | "upcoming" | "past";
  followerMomentum: {
    recentFollowers: number;
    totalFollowers: number;
  };
  relativeClickPotential: {
    score: number;
    note: string;
  };
  relativeMembershipPurchasePotential: {
    score: number;
    totalPurchases: number;
    totalMemberships: number;
    note: string;
  };
  whyConsider: string[];
};

type SpotlightSuggestion = {
  key: string;
  headline: string;
  summary: string;
  severity: "success" | "info" | "warning";
  signals: string[];
  suggestedCampaignId: string | null;
};

type PinnedCampaignAnalyticsResponse = {
  ok: boolean;
  userId: string;
  generatedAt: string;
  attributionNotes: string[];
  pinnedCampaign: {
    campaignId: string;
    name: string;
    slug: string;
    route: string;
    visibility: "public" | "followers" | "members";
    state: "active" | "upcoming" | "past";
    spotlightViews: number;
    spotlightClicks: number;
    spotlightClickThroughRate: number;
    spotlightCtrLabel: string;
    followConversions: number;
    rsvpConversions: number;
    totalFollowers: number;
    totalDropClicks: number;
    totalDropViews: number;
    totalDropRsvps: number;
    approximatePurchases: number;
    approximateMemberships: number;
    spotlightSurfaces: string[];
  } | null;
  candidates: SpotlightCandidateItem[];
  rotationSuggestion: SpotlightSuggestion;
};

function severityVariant(severity: SpotlightSuggestion["severity"]) {
  switch (severity) {
    case "warning":
      return "secondary" as const;
    case "success":
      return "default" as const;
    case "info":
    default:
      return "outline" as const;
  }
}

export default function PinnedCampaignSpotlightSection() {
  const { user } = useUser();
  const query = useQuery<PinnedCampaignAnalyticsResponse>({
    queryKey: ["/api/drinks/creator-dashboard/pinned-campaign-analytics", user?.id ?? ""],
    queryFn: async () => {
      const response = await fetch("/api/drinks/creator-dashboard/pinned-campaign-analytics", { credentials: "include" });
      const payload = await response.json().catch(() => null);
      if (!response.ok) throw new Error(payload?.error || payload?.message || `Failed to load pinned spotlight analytics (${response.status})`);
      return payload as PinnedCampaignAnalyticsResponse;
    },
    enabled: Boolean(user?.id),
  });

  const pinned = query.data?.pinnedCampaign ?? null;
  const suggestion = query.data?.rotationSuggestion ?? null;
  const candidates = query.data?.candidates ?? [];

  return (
    <Card id="campaign-spotlight-performance">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Pin className="h-5 w-5 text-blue-600" />
          Spotlight / Pinned Campaign Performance
        </CardTitle>
        <CardDescription>
          Measure the pinned slot itself: views, clicks, and lightweight conversion proxies so you can decide whether to keep the current spotlight or rotate it.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {query.isLoading ? <p className="text-sm text-muted-foreground">Loading pinned spotlight analytics…</p> : null}
        {query.isError ? <p className="text-sm text-destructive">{query.error instanceof Error ? query.error.message : "Unable to load pinned spotlight analytics right now."}</p> : null}

        {suggestion ? (
          <div className="rounded-md border bg-muted/20 p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Lightbulb className="h-4 w-4 text-amber-500" />
                  <p className="font-medium">{suggestion.headline}</p>
                </div>
                <p className="text-sm text-muted-foreground">{suggestion.summary}</p>
              </div>
              <Badge variant={severityVariant(suggestion.severity)}>{suggestion.key.replaceAll("_", " ")}</Badge>
            </div>
            {suggestion.signals.length ? (
              <div className="mt-3 flex flex-wrap gap-2">
                {suggestion.signals.map((signal) => (
                  <Badge key={signal} variant="outline">{signal}</Badge>
                ))}
              </div>
            ) : null}
          </div>
        ) : null}

        {pinned ? (
          <div className="space-y-4 rounded-md border p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-sm text-muted-foreground">Current pinned campaign</p>
                <h3 className="text-xl font-semibold">{pinned.name}</h3>
                <div className="mt-2 flex flex-wrap gap-2">
                  <Badge variant="secondary">{pinned.state}</Badge>
                  <Badge variant="outline">{pinned.visibility}</Badge>
                  {pinned.spotlightSurfaces.map((surface) => (
                    <Badge key={surface} variant="outline">{surface.replaceAll("_", " ")}</Badge>
                  ))}
                </div>
              </div>
              <Link href={pinned.route}>
                <Button variant="outline">Open campaign</Button>
              </Link>
            </div>

            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-6">
              <div className="rounded-md border p-3"><p className="text-xs uppercase tracking-wide text-muted-foreground">Spotlight views</p><p className="text-xl font-semibold">{pinned.spotlightViews}</p></div>
              <div className="rounded-md border p-3"><p className="text-xs uppercase tracking-wide text-muted-foreground">Spotlight clicks</p><p className="text-xl font-semibold">{pinned.spotlightClicks}</p></div>
              <div className="rounded-md border p-3"><p className="text-xs uppercase tracking-wide text-muted-foreground">CTR</p><p className="text-xl font-semibold">{pinned.spotlightCtrLabel}</p></div>
              <div className="rounded-md border p-3"><p className="text-xs uppercase tracking-wide text-muted-foreground">Follow conversions</p><p className="text-xl font-semibold">{pinned.followConversions}</p></div>
              <div className="rounded-md border p-3"><p className="text-xs uppercase tracking-wide text-muted-foreground">RSVP conversions</p><p className="text-xl font-semibold">{pinned.rsvpConversions}</p></div>
              <div className="rounded-md border p-3"><p className="text-xs uppercase tracking-wide text-muted-foreground">Approx. conversions</p><p className="text-xl font-semibold">{pinned.approximatePurchases + pinned.approximateMemberships}</p></div>
            </div>

            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
              <div className="rounded-md border p-3 text-sm text-muted-foreground"><p className="font-medium text-foreground">Campaign followers</p><p>{pinned.totalFollowers}</p></div>
              <div className="rounded-md border p-3 text-sm text-muted-foreground"><p className="font-medium text-foreground">Linked drop views</p><p>{pinned.totalDropViews}</p></div>
              <div className="rounded-md border p-3 text-sm text-muted-foreground"><p className="font-medium text-foreground">Linked drop clicks</p><p>{pinned.totalDropClicks}</p></div>
              <div className="rounded-md border p-3 text-sm text-muted-foreground"><p className="font-medium text-foreground">Linked RSVPs</p><p>{pinned.totalDropRsvps}</p></div>
              <div className="rounded-md border p-3 text-sm text-muted-foreground"><p className="font-medium text-foreground">Approx. memberships</p><p>{pinned.approximateMemberships}</p></div>
            </div>
          </div>
        ) : (
          !query.isLoading && !query.isError ? (
            <div className="rounded-md border border-dashed p-4 text-sm text-muted-foreground">
              No pinned campaign yet. Pin one from your campaigns list and this spotlight layer will start measuring the slot.
            </div>
          ) : null
        )}

        {candidates.length ? (
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-emerald-600" />
              <p className="font-medium">Consider pinning instead</p>
            </div>
            <div className="grid gap-3 lg:grid-cols-3">
              {candidates.map((candidate) => (
                <div key={candidate.campaignId} className="rounded-md border p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="font-medium">{candidate.name}</p>
                      <div className="mt-2 flex flex-wrap gap-2">
                        <Badge variant="outline">{candidate.state}</Badge>
                        <Badge variant="outline">{candidate.visibility}</Badge>
                      </div>
                    </div>
                    <Link href={candidate.route}>
                      <Button size="sm" variant="ghost">Open</Button>
                    </Link>
                  </div>

                  <div className="mt-4 space-y-2 text-sm">
                    <div className="flex items-center justify-between gap-3"><span className="text-muted-foreground">Follower momentum</span><span className="font-medium">{candidate.followerMomentum.recentFollowers} recent</span></div>
                    <div className="flex items-center justify-between gap-3"><span className="text-muted-foreground">Click potential</span><span className="font-medium">{candidate.relativeClickPotential.score}</span></div>
                    <div className="flex items-center justify-between gap-3"><span className="text-muted-foreground">Membership / purchase potential</span><span className="font-medium">{candidate.relativeMembershipPurchasePotential.score}</span></div>
                  </div>

                  {candidate.whyConsider.length ? (
                    <div className="mt-3 flex flex-wrap gap-2">
                      {candidate.whyConsider.map((signal) => (
                        <Badge key={signal} variant="secondary">{signal}</Badge>
                      ))}
                    </div>
                  ) : (
                    <p className="mt-3 text-xs text-muted-foreground">No strong recent momentum signal yet, but this campaign still ranks as a viable spotlight candidate.</p>
                  )}
                </div>
              ))}
            </div>
          </div>
        ) : null}

        {query.data?.attributionNotes?.length ? (
          <div className="rounded-md border border-dashed p-4 text-sm text-muted-foreground">
            <div className="mb-2 flex items-center gap-2 font-medium text-foreground">
              <RefreshCw className="h-4 w-4" />
              Notes on how this works
            </div>
            <ul className="list-disc space-y-1 pl-5">
              {query.data.attributionNotes.map((note) => <li key={note}>{note}</li>)}
            </ul>
          </div>
        ) : null}

        <div className="flex flex-wrap gap-2">
          <Link href="/drinks/creator-dashboard#campaigns"><Button variant="outline">Manage pinned campaigns</Button></Link>
          <Link href="/drinks/campaigns"><Button variant="ghost">Browse campaigns</Button></Link>
        </div>
      </CardContent>
    </Card>
  );
}
