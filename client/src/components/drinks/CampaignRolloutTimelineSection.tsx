import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, CheckCircle2, Clock3, ExternalLink, PauseCircle, PlayCircle, Rocket, Sparkles } from "lucide-react";
import { Link } from "wouter";

import { useUser } from "@/contexts/UserContext";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

type CampaignRolloutTimelineEventType =
  | "rollout_created"
  | "rollout_updated"
  | "rollout_paused"
  | "rollout_resumed"
  | "follower_unlock_delayed"
  | "public_unlock_delayed"
  | "follower_unlock_released_now"
  | "public_unlock_released_now"
  | "follower_stage_unlocked"
  | "public_stage_unlocked"
  | "rollout_completed"
  | "readiness_warning"
  | "readiness_blocked"
  | "important_drop_went_live";

type CampaignRolloutTimelineItem = {
  id: string;
  campaignId: string;
  campaignName?: string;
  campaignSlug?: string;
  campaignRoute?: string;
  eventType: CampaignRolloutTimelineEventType;
  occurredAt: string;
  title: string;
  message: string;
  audienceStage: "public" | "followers" | "members" | null;
  metadata: Record<string, unknown>;
  isDerived: boolean;
};

type CampaignRolloutTimelineResponse = {
  ok: boolean;
  userId: string;
  campaignId: string | null;
  count: number;
  generatedAt: string;
  items: CampaignRolloutTimelineItem[];
  campaigns?: Array<{
    campaignId: string;
    campaignName: string;
    campaignSlug: string;
    campaignRoute: string;
    count: number;
  }>;
};

function eventVariant(eventType: CampaignRolloutTimelineEventType): "default" | "secondary" | "destructive" | "outline" {
  if (eventType === "readiness_blocked") return "destructive";
  if (eventType === "readiness_warning") return "outline";
  if (eventType === "rollout_completed" || eventType === "public_stage_unlocked" || eventType === "follower_stage_unlocked") return "default";
  return "secondary";
}

function eventIcon(eventType: CampaignRolloutTimelineEventType) {
  if (eventType === "rollout_paused") return <PauseCircle className="h-4 w-4" aria-hidden />;
  if (eventType === "rollout_resumed") return <PlayCircle className="h-4 w-4" aria-hidden />;
  if (eventType === "readiness_blocked" || eventType === "readiness_warning") return <AlertTriangle className="h-4 w-4" aria-hidden />;
  if (eventType === "rollout_completed") return <CheckCircle2 className="h-4 w-4" aria-hidden />;
  if (eventType === "important_drop_went_live") return <Rocket className="h-4 w-4" aria-hidden />;
  return <Sparkles className="h-4 w-4" aria-hidden />;
}

function audienceLabel(audience: CampaignRolloutTimelineItem["audienceStage"]) {
  if (audience === "members") return "Members";
  if (audience === "followers") return "Followers";
  if (audience === "public") return "Public";
  return "Campaign";
}

function formatDateTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Unknown time";
  return new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(date);
}

export default function CampaignRolloutTimelineSection({
  campaignId,
  title = "Campaign Rollout Timeline + Activity Log",
  description = "Private rollout history only: unlock changes, pauses/resumes, releases, derived stage transitions, and major readiness/drop moments.",
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
  const query = useQuery<CampaignRolloutTimelineResponse>({
    queryKey: ["/api/drinks/creator-dashboard/campaign-rollout-timeline", campaignId ?? "all", user?.id ?? ""],
    queryFn: async () => {
      const search = campaignId ? `?campaignId=${encodeURIComponent(campaignId)}` : "";
      const response = await fetch(`/api/drinks/creator-dashboard/campaign-rollout-timeline${search}`, { credentials: "include" });
      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(payload?.error || payload?.message || `Failed to load campaign rollout timeline (${response.status})`);
      }
      return payload as CampaignRolloutTimelineResponse;
    },
    enabled: Boolean(user?.id),
  });

  const items = React.useMemo(() => {
    const source = query.data?.items ?? [];
    return typeof limit === "number" ? source.slice(0, limit) : source;
  }, [limit, query.data?.items]);

  return (
    <Card id={campaignId ? undefined : "campaign-rollout-timeline"}>
      <CardHeader>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="space-y-1">
            <CardTitle>{title}</CardTitle>
            <CardDescription>{description}</CardDescription>
          </div>
          {!compact ? (
            <div className="flex flex-wrap gap-2 text-sm">
              <Badge variant="outline">{query.data?.count ?? 0} events</Badge>
              <Badge variant="outline">{(query.data?.items ?? []).filter((item) => item.isDerived).length} derived</Badge>
            </div>
          ) : null}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {query.isLoading ? <p className="text-sm text-muted-foreground">Loading rollout timeline…</p> : null}
        {query.isError ? <p className="text-sm text-destructive">{query.error instanceof Error ? query.error.message : "Unable to load rollout timeline right now."}</p> : null}

        {!query.isLoading && !query.isError && items.length === 0 ? (
          <div className="rounded-md border p-4 text-sm text-muted-foreground">
            No rollout history is available yet. Once a campaign rollout is configured, delayed, paused, resumed, released, or reaches major unlock moments, those updates will appear here.
          </div>
        ) : null}

        <div className="space-y-3">
          {items.map((item) => (
            <div key={item.id} className="rounded-lg border p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="space-y-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant={eventVariant(item.eventType)} className="gap-1">
                      {eventIcon(item.eventType)}
                      {item.title}
                    </Badge>
                    <Badge variant="outline">{audienceLabel(item.audienceStage)}</Badge>
                    {item.isDerived ? <Badge variant="outline">Derived</Badge> : null}
                  </div>
                  <div>
                    <h3 className="text-base font-semibold">{item.campaignName ?? item.title}</h3>
                    <p className="text-sm text-muted-foreground">{formatDateTime(item.occurredAt)}</p>
                  </div>
                  <p className="text-sm text-muted-foreground">{item.message}</p>
                </div>

                <div className="flex flex-wrap gap-2">
                  {item.campaignRoute ? (
                    <Link href={item.campaignRoute}>
                      <Button size="sm" variant={compact ? "outline" : "default"}>
                        Open campaign
                        <ExternalLink className="ml-2 h-4 w-4" aria-hidden />
                      </Button>
                    </Link>
                  ) : null}
                </div>
              </div>

              {Object.keys(item.metadata ?? {}).length > 0 ? (
                <div className="mt-3 rounded-md border border-dashed bg-muted/20 p-3">
                  <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                    {Object.entries(item.metadata).slice(0, 4).map(([key, value]) => (
                      <Badge key={key} variant="outline" className="whitespace-normal text-left">
                        {key}: {typeof value === "string" || typeof value === "number" || typeof value === "boolean" ? String(value) : "updated"}
                      </Badge>
                    ))}
                  </div>
                </div>
              ) : null}
            </div>
          ))}
        </div>

        {query.data?.generatedAt ? (
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Clock3 className="h-3.5 w-3.5" aria-hidden />
            Generated {formatDateTime(query.data.generatedAt)}.
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
