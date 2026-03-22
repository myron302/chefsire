import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, CheckCircle2, Clock3, ExternalLink, ShieldAlert } from "lucide-react";
import { Link } from "wouter";

import { useUser } from "@/contexts/UserContext";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

type CampaignUnlockAlertState = "ready" | "warning" | "blocked";
type CampaignUnlockAudience = "public" | "followers" | "members";
type CampaignUnlockTimingWindow = "overdue" | "within_24h" | "within_48h";

type CampaignUnlockReadinessAlert = {
  campaignId: string;
  campaignName: string;
  campaignSlug: string;
  campaignRoute: string;
  currentAudience: CampaignUnlockAudience | null;
  upcomingAudience: CampaignUnlockAudience;
  unlockAt: string | null;
  alertState: CampaignUnlockAlertState;
  title: string;
  message: string;
  blockers: string[];
  warnings: string[];
  recommendedFixes: string[];
  hoursUntilUnlock: number | null;
  timingWindow: CampaignUnlockTimingWindow;
  readinessState: "ready" | "almost_ready" | "missing_key_items" | "blocked";
};

type CampaignUnlockReadinessResponse = {
  ok: boolean;
  userId: string;
  campaignId: string | null;
  summary: {
    totalAlerts: number;
    readyCount: number;
    warningCount: number;
    blockedCount: number;
    overdueCount: number;
    within24HoursCount: number;
    within48HoursCount: number;
  };
  items: CampaignUnlockReadinessAlert[];
  attributionNotes: string[];
  generatedAt: string;
};

function alertVariant(state: CampaignUnlockAlertState): "default" | "secondary" | "destructive" | "outline" {
  if (state === "ready") return "default";
  if (state === "warning") return "outline";
  return "destructive";
}

function alertLabel(state: CampaignUnlockAlertState) {
  if (state === "ready") return "Ready";
  if (state === "warning") return "Warning";
  return "Blocked";
}

function alertIcon(state: CampaignUnlockAlertState) {
  if (state === "ready") return <CheckCircle2 className="h-4 w-4" aria-hidden />;
  if (state === "warning") return <AlertTriangle className="h-4 w-4" aria-hidden />;
  return <ShieldAlert className="h-4 w-4" aria-hidden />;
}

function audienceLabel(value: CampaignUnlockAudience | null) {
  if (value === "members") return "Members";
  if (value === "followers") return "Followers";
  if (value === "public") return "Public";
  return "—";
}

function timingWindowLabel(value: CampaignUnlockTimingWindow) {
  if (value === "overdue") return "Overdue";
  if (value === "within_24h") return "Within 24h";
  return "Within 48h";
}

function formatUnlockAt(value: string | null) {
  if (!value) return "No unlock time set";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "No unlock time set";
  return new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(date);
}

export default function CampaignUnlockReadinessAlertsSection({
  campaignId,
  title = "Unlock Readiness Alerts",
  description = "Private, lightweight warnings for follower/public unlocks that are about to happen. This stays separate from launch readiness, timing advice, and rollout strategy.",
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
  const query = useQuery<CampaignUnlockReadinessResponse>({
    queryKey: ["/api/drinks/creator-dashboard/campaign-unlock-alerts", campaignId ?? "all", user?.id ?? ""],
    queryFn: async () => {
      const search = campaignId ? `?campaignId=${encodeURIComponent(campaignId)}` : "";
      const response = await fetch(`/api/drinks/creator-dashboard/campaign-unlock-alerts${search}`, { credentials: "include" });
      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(payload?.error || payload?.message || `Failed to load campaign unlock alerts (${response.status})`);
      }
      return payload as CampaignUnlockReadinessResponse;
    },
    enabled: Boolean(user?.id),
  });

  const items = React.useMemo(() => {
    const source = query.data?.items ?? [];
    return typeof limit === "number" ? source.slice(0, limit) : source;
  }, [limit, query.data?.items]);

  return (
    <Card id={campaignId ? undefined : "campaign-unlock-readiness-alerts"}>
      <CardHeader>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="space-y-1">
            <CardTitle>{title}</CardTitle>
            <CardDescription>{description}</CardDescription>
          </div>
          {!compact && !campaignId ? (
            <div className="flex flex-wrap gap-2 text-sm">
              <Badge variant="outline">{query.data?.summary.blockedCount ?? 0} blocked</Badge>
              <Badge variant="outline">{query.data?.summary.warningCount ?? 0} warnings</Badge>
              <Badge variant="outline">{query.data?.summary.within24HoursCount ?? 0} within 24h</Badge>
            </div>
          ) : null}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {query.isLoading ? <p className="text-sm text-muted-foreground">Loading unlock alerts…</p> : null}
        {query.isError ? <p className="text-sm text-destructive">{query.error instanceof Error ? query.error.message : "Unable to load campaign unlock alerts right now."}</p> : null}

        {!query.isLoading && !query.isError && items.length === 0 ? (
          <div className="rounded-md border p-4 text-sm text-muted-foreground">
            No follower/public unlocks need attention in the next 48 hours right now. Upcoming staged unlocks will appear here automatically when they are close enough to matter.
          </div>
        ) : null}

        {items.map((item) => (
          <div key={item.campaignId} className="rounded-lg border p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="space-y-2">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant={alertVariant(item.alertState)} className="gap-1">
                    {alertIcon(item.alertState)}
                    {alertLabel(item.alertState)}
                  </Badge>
                  <Badge variant="outline">{audienceLabel(item.upcomingAudience)} unlock</Badge>
                  <Badge variant="outline">{timingWindowLabel(item.timingWindow)}</Badge>
                  {typeof item.hoursUntilUnlock === "number" ? (
                    <Badge variant="outline">{item.timingWindow === "overdue" ? "Due now" : `${item.hoursUntilUnlock}h left`}</Badge>
                  ) : null}
                </div>
                <div>
                  <h3 className="text-lg font-semibold">{item.title}</h3>
                  <p className="text-sm text-muted-foreground">{item.campaignName} · {formatUnlockAt(item.unlockAt)}</p>
                </div>
                <p className="text-sm text-muted-foreground">{item.message}</p>
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
                    <Button size="sm" variant="outline">Manage rollout</Button>
                  </Link>
                ) : null}
              </div>
            </div>

            <div className={`mt-4 grid gap-4 ${compact ? "lg:grid-cols-[minmax(0,1.1fr),minmax(0,0.9fr)]" : "xl:grid-cols-[minmax(0,1.1fr),minmax(0,0.9fr)]"}`}>
              <div className="space-y-3">
                <div className="rounded-md border bg-muted/20 p-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <Clock3 className="h-4 w-4 text-muted-foreground" aria-hidden />
                    <p className="text-sm font-medium">{item.upcomingAudience === "followers" ? "Follower unlock" : "Public unlock"} is next from {audienceLabel(item.currentAudience)}.</p>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {item.blockers.length > 0
                      ? `${item.blockers.length} blocker${item.blockers.length === 1 ? "" : "s"} should be fixed before this unlock widens access.`
                      : item.warnings.length > 0
                        ? `${item.warnings.length} warning${item.warnings.length === 1 ? "" : "s"} are worth cleaning up before the unlock.`
                        : "Unlock looks ready based on the rollout + readiness signals already stored in the platform."}
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

                {item.warnings.length > 0 ? (
                  <div className="space-y-2">
                    <p className="text-xs font-medium uppercase tracking-wide text-amber-700">Warnings</p>
                    <div className="space-y-2">
                      {item.warnings.map((warning) => (
                        <div key={warning} className="rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-900/50 dark:bg-amber-950/20 dark:text-amber-100">
                          {warning}
                        </div>
                      ))}
                    </div>
                  </div>
                ) : null}
              </div>

              <div className="space-y-3">
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

                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="rounded-md border p-3 text-sm">
                    <p className="font-medium">Current audience</p>
                    <p className="text-muted-foreground">{audienceLabel(item.currentAudience)}</p>
                  </div>
                  <div className="rounded-md border p-3 text-sm">
                    <p className="font-medium">Readiness layer</p>
                    <p className="text-muted-foreground">{item.readinessState.replaceAll("_", " ")}</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
