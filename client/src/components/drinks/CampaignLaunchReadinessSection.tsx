import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, CheckCircle2, Clock3, ExternalLink, ShieldAlert, Sparkles } from "lucide-react";
import { Link } from "wouter";

import { useUser } from "@/contexts/UserContext";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

type CampaignLaunchReadinessCheckStatus = "pass" | "warning" | "fail";
type CampaignLaunchReadinessState = "ready" | "almost_ready" | "missing_key_items" | "blocked";
type CampaignPreflightKind = "launch" | "unlock";

type CampaignLaunchReadinessCheck = {
  key: string;
  label: string;
  status: CampaignLaunchReadinessCheckStatus;
  note: string;
};

type CampaignLaunchReadinessItem = {
  campaignId: string;
  campaignName: string;
  campaignSlug: string;
  campaignRoute: string;
  campaignState: "upcoming" | "active" | "past";
  readinessState: CampaignLaunchReadinessState;
  readinessScore: number;
  preflightKind: CampaignPreflightKind;
  preflightLabel: string;
  targetAt: string | null;
  currentAudience: "public" | "followers" | "members" | null;
  nextAudience: "public" | "followers" | "members" | null;
  checks: CampaignLaunchReadinessCheck[];
  blockers: string[];
  warnings: string[];
  recommendedFixes: string[];
  nextLaunchStep: string | null;
  linkedSummary: {
    drops: number;
    collections: number;
    promos: number;
    posts: number;
    roadmap: number;
    memberOnlyCollections: number;
    publicUpdates: number;
    recentUpdates: number;
  };
};

type CampaignLaunchReadinessResponse = {
  ok: boolean;
  userId: string;
  campaignId: string | null;
  summary: {
    totalCampaigns: number;
    readyCount: number;
    almostReadyCount: number;
    missingKeyItemsCount: number;
    blockedCount: number;
    launchCount: number;
    unlockCount: number;
    dueSoonCount: number;
  };
  items: CampaignLaunchReadinessItem[];
  attributionNotes: string[];
  generatedAt: string;
};

function readinessVariant(state: CampaignLaunchReadinessState): "default" | "secondary" | "destructive" | "outline" {
  switch (state) {
    case "ready":
      return "default";
    case "almost_ready":
      return "secondary";
    case "missing_key_items":
      return "outline";
    case "blocked":
    default:
      return "destructive";
  }
}

function readinessLabel(state: CampaignLaunchReadinessState) {
  switch (state) {
    case "ready":
      return "Ready to launch";
    case "almost_ready":
      return "Almost ready";
    case "missing_key_items":
      return "Missing key items";
    case "blocked":
    default:
      return "Blocked";
  }
}

function checkVariant(status: CampaignLaunchReadinessCheckStatus): "default" | "secondary" | "destructive" | "outline" {
  if (status === "pass") return "secondary";
  if (status === "warning") return "outline";
  return "destructive";
}

function audienceLabel(value: CampaignLaunchReadinessItem["nextAudience"] | CampaignLaunchReadinessItem["currentAudience"]) {
  if (value === "members") return "Members";
  if (value === "followers") return "Followers";
  if (value === "public") return "Public";
  return "—";
}

function formatDateTime(value: string | null) {
  if (!value) return "No exact time set";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "No exact time set";
  return new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(date);
}

function statusIcon(state: CampaignLaunchReadinessState) {
  switch (state) {
    case "ready":
      return <CheckCircle2 className="h-4 w-4" aria-hidden />;
    case "almost_ready":
      return <Sparkles className="h-4 w-4" aria-hidden />;
    case "missing_key_items":
      return <AlertTriangle className="h-4 w-4" aria-hidden />;
    case "blocked":
    default:
      return <ShieldAlert className="h-4 w-4" aria-hidden />;
  }
}

export default function CampaignLaunchReadinessSection({
  campaignId,
  title = "Campaign Launch Readiness / Preflight",
  description = "Private readiness checks for the campaigns closest to launch or the next audience unlock. This stays separate from timing, rollout, action-center, and recovery layers.",
  compact = false,
  limit,
}: {
  campaignId?: string | null;
  title?: string;
  description?: string;
  compact?: boolean;
  limit?: number;
}) {
  const { user } = useUser();
  const query = useQuery<CampaignLaunchReadinessResponse>({
    queryKey: ["/api/drinks/creator-dashboard/campaign-launch-readiness", campaignId ?? "all", user?.id ?? ""],
    queryFn: async () => {
      const search = campaignId ? `?campaignId=${encodeURIComponent(campaignId)}` : "";
      const response = await fetch(`/api/drinks/creator-dashboard/campaign-launch-readiness${search}`, { credentials: "include" });
      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(payload?.error || payload?.message || `Failed to load campaign launch readiness (${response.status})`);
      }
      return payload as CampaignLaunchReadinessResponse;
    },
    enabled: Boolean(user?.id),
  });

  const items = React.useMemo(() => {
    const source = query.data?.items ?? [];
    return typeof limit === "number" ? source.slice(0, limit) : source;
  }, [limit, query.data?.items]);

  return (
    <Card id={campaignId ? undefined : "campaign-launch-readiness"}>
      <CardHeader>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="space-y-1">
            <CardTitle>{title}</CardTitle>
            <CardDescription>{description}</CardDescription>
          </div>
          {!compact && !campaignId ? (
            <div className="flex flex-wrap gap-2 text-sm">
              <Badge variant="outline">{query.data?.summary.launchCount ?? 0} launch checks</Badge>
              <Badge variant="outline">{query.data?.summary.unlockCount ?? 0} unlock checks</Badge>
              <Badge variant="outline">{query.data?.summary.dueSoonCount ?? 0} due soon</Badge>
            </div>
          ) : null}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {query.isLoading ? <p className="text-sm text-muted-foreground">Loading launch readiness…</p> : null}
        {query.isError ? <p className="text-sm text-destructive">{query.error instanceof Error ? query.error.message : "Unable to load campaign launch readiness right now."}</p> : null}

        {!query.isLoading && !query.isError && items.length === 0 ? (
          <div className="rounded-md border p-4 text-sm text-muted-foreground">
            No upcoming launch or unlock preflight items are queued right now. When a campaign gets close to launch, a staged unlock, or a scheduled drop beat, it will appear here automatically.
          </div>
        ) : null}

        {items.map((item) => (
          <div key={item.campaignId} className="rounded-lg border p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="space-y-2">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant={readinessVariant(item.readinessState)} className="gap-1">
                    {statusIcon(item.readinessState)}
                    {readinessLabel(item.readinessState)}
                  </Badge>
                  <Badge variant="outline">{item.preflightKind === "unlock" ? "Unlock preflight" : "Launch preflight"}</Badge>
                  <Badge variant="outline">{Math.max(0, Math.min(100, item.readinessScore))}% ready</Badge>
                  {item.nextAudience ? <Badge variant="outline">Next: {audienceLabel(item.nextAudience)}</Badge> : null}
                </div>
                <div>
                  <h3 className="text-lg font-semibold">{item.campaignName}</h3>
                  <p className="text-sm text-muted-foreground">
                    {item.preflightLabel} · {formatDateTime(item.targetAt)}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                  <span>{item.linkedSummary.drops} drops</span>
                  <span>{item.linkedSummary.collections} collections</span>
                  <span>{item.linkedSummary.promos} promos</span>
                  <span>{item.linkedSummary.posts} posts</span>
                  <span>{item.linkedSummary.memberOnlyCollections} member-only assets</span>
                </div>
              </div>

              <div className="flex flex-wrap gap-2">
                <Link href={item.campaignRoute}>
                  <Button size="sm" variant={compact ? "outline" : "default"}>
                    Open campaign
                    <ExternalLink className="ml-2 h-4 w-4" aria-hidden />
                  </Button>
                </Link>
                {!campaignId ? (
                  <Link href="/drinks/creator-dashboard#campaigns">
                    <Button size="sm" variant="outline">Manage campaign</Button>
                  </Link>
                ) : null}
              </div>
            </div>

            <div className={`mt-4 grid gap-4 ${compact ? "lg:grid-cols-[minmax(0,1fr),minmax(0,1.1fr)]" : "xl:grid-cols-[minmax(0,1fr),minmax(0,1.1fr)]"}`}>
              <div className="space-y-3">
                <div className="rounded-md border bg-muted/20 p-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <Clock3 className="h-4 w-4 text-muted-foreground" aria-hidden />
                    <p className="text-sm font-medium">{item.nextLaunchStep ?? "No next step suggested."}</p>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {item.blockers.length > 0
                      ? `${item.blockers.length} blocker${item.blockers.length === 1 ? "" : "s"} need attention before this campaign should move forward.`
                      : item.warnings.length > 0
                        ? `${item.warnings.length} warning${item.warnings.length === 1 ? "" : "s"} remain, but the campaign is close.`
                        : "No blocking readiness gaps are visible right now."}
                  </p>
                </div>

                {item.blockers.length > 0 ? (
                  <div className="space-y-2">
                    <p className="text-xs font-medium uppercase tracking-wide text-destructive">Blockers</p>
                    <div className="space-y-2">
                      {item.blockers.map((blocker) => (
                        <div key={blocker} className="rounded-md border border-destructive/40 bg-destructive/5 p-3 text-sm">
                          {blocker}
                        </div>
                      ))}
                    </div>
                  </div>
                ) : null}

                {item.recommendedFixes.length > 0 ? (
                  <div className="space-y-2">
                    <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Recommended fixes</p>
                    <div className="flex flex-wrap gap-2">
                      {item.recommendedFixes.map((fix) => (
                        <Badge key={fix} variant="outline" className="whitespace-normal text-left">
                          {fix}
                        </Badge>
                      ))}
                    </div>
                  </div>
                ) : null}
              </div>

              <div className="space-y-2">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Checklist</p>
                <div className="grid gap-2">
                  {item.checks.map((check) => (
                    <div key={check.key} className="rounded-md border p-3">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <p className="text-sm font-medium">{check.label}</p>
                        <Badge variant={checkVariant(check.status)}>
                          {check.status === "pass" ? "Pass" : check.status === "warning" ? "Warning" : "Fail"}
                        </Badge>
                      </div>
                      <p className="mt-1 text-sm text-muted-foreground">{check.note}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        ))}

        {!compact && query.data?.attributionNotes?.length ? (
          <div className="space-y-2 rounded-md border border-dashed p-3 text-xs text-muted-foreground">
            {query.data.attributionNotes.map((note) => <p key={note}>{note}</p>)}
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
