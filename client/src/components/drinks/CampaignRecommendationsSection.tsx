import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import { BarChart3, CircleDot, Copy, Megaphone, PartyPopper, Rocket, Sparkles, Users } from "lucide-react";
import { Link } from "wouter";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useUser } from "@/contexts/UserContext";

type CampaignRecommendationType =
  | "add_drop"
  | "publish_update"
  | "improve_cta"
  | "promote_membership"
  | "add_member_only_collection"
  | "launch_promo"
  | "push_rsvp"
  | "clone_successful_campaign"
  | "refresh_archived_campaign"
  | "celebrate_milestone";

type CampaignRecommendationPriority = "high" | "medium" | "low";

type CampaignRecommendationItem = {
  campaignId: string;
  campaignName: string;
  campaignSlug: string;
  campaignRoute: string;
  campaignState: "upcoming" | "active" | "past";
  recommendationType: CampaignRecommendationType;
  priority: CampaignRecommendationPriority;
  title: string;
  message: string;
  suggestedAction: string | null;
  suggestedRoute: string | null;
  supportingSignals: string[];
};

type CampaignRecommendationsResponse = {
  ok: boolean;
  userId: string;
  summary: {
    totalCampaigns: number;
    campaignsWithRecommendations: number;
    totalRecommendations: number;
  };
  items: CampaignRecommendationItem[];
  attributionNotes: string[];
  generatedAt: string;
};

function recommendationIcon(type: CampaignRecommendationType) {
  switch (type) {
    case "add_drop":
      return <Rocket className="h-4 w-4" />;
    case "clone_successful_campaign":
      return <Copy className="h-4 w-4" />;
    case "launch_promo":
    case "publish_update":
      return <Megaphone className="h-4 w-4" />;
    case "promote_membership":
    case "push_rsvp":
      return <Users className="h-4 w-4" />;
    case "celebrate_milestone":
      return <PartyPopper className="h-4 w-4" />;
    case "improve_cta":
    case "refresh_archived_campaign":
      return <BarChart3 className="h-4 w-4" />;
    case "add_member_only_collection":
    default:
      return <Sparkles className="h-4 w-4" />;
  }
}

function priorityVariant(priority: CampaignRecommendationPriority): "default" | "secondary" | "outline" {
  switch (priority) {
    case "high":
      return "default";
    case "medium":
      return "secondary";
    case "low":
    default:
      return "outline";
  }
}

function priorityLabel(priority: CampaignRecommendationPriority) {
  switch (priority) {
    case "high":
      return "High signal";
    case "medium":
      return "Worth considering";
    case "low":
    default:
      return "Light suggestion";
  }
}

export default function CampaignRecommendationsSection() {
  const { user } = useUser();

  const query = useQuery<CampaignRecommendationsResponse>({
    queryKey: ["/api/drinks/creator-dashboard/campaign-recommendations", user?.id ?? ""],
    queryFn: async () => {
      const response = await fetch("/api/drinks/creator-dashboard/campaign-recommendations", { credentials: "include" });
      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(payload?.error || payload?.message || `Failed to load campaign recommendations (${response.status})`);
      }
      return payload as CampaignRecommendationsResponse;
    },
    enabled: Boolean(user?.id),
  });

  const grouped = React.useMemo(() => {
    const map = new Map<string, { campaignName: string; campaignRoute: string; items: CampaignRecommendationItem[] }>();
    for (const item of query.data?.items ?? []) {
      const current = map.get(item.campaignId) ?? {
        campaignName: item.campaignName,
        campaignRoute: item.campaignRoute,
        items: [],
      };
      current.items.push(item);
      map.set(item.campaignId, current);
    }
    return [...map.entries()].map(([campaignId, value]) => ({ campaignId, ...value }));
  }, [query.data?.items]);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Campaign Playbooks / Recommendations</CardTitle>
        <CardDescription>
          Lightweight guidance based on current campaign signals. These suggestions are optional and stay distinct from creator-set goals and system milestones.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        {query.isLoading ? <p className="text-sm text-muted-foreground">Loading campaign recommendations…</p> : null}
        {query.isError ? <p className="text-sm text-destructive">{query.error instanceof Error ? query.error.message : "Unable to load campaign recommendations right now."}</p> : null}

        {query.data ? (
          <div className="grid gap-3 md:grid-cols-3">
            <div className="rounded-md border p-4">
              <p className="text-xs text-muted-foreground">Campaigns reviewed</p>
              <p className="text-2xl font-semibold">{query.data.summary.totalCampaigns}</p>
            </div>
            <div className="rounded-md border p-4">
              <p className="text-xs text-muted-foreground">Campaigns with suggestions</p>
              <p className="text-2xl font-semibold">{query.data.summary.campaignsWithRecommendations}</p>
            </div>
            <div className="rounded-md border p-4">
              <p className="text-xs text-muted-foreground">Top recommendations surfaced</p>
              <p className="text-2xl font-semibold">{query.data.summary.totalRecommendations}</p>
            </div>
          </div>
        ) : null}

        {!query.isLoading && query.data && query.data.items.length === 0 ? (
          <div className="rounded-md border border-dashed p-5 text-sm text-muted-foreground">
            No campaign recommendations right now. As campaigns pick up followers, RSVPs, clicks, goals, and milestones, this playbook layer will surface lightweight next-step ideas here.
          </div>
        ) : null}

        <div className="space-y-4">
          {grouped.map((group) => (
            <div key={group.campaignId} className="rounded-lg border p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-sm text-muted-foreground">Campaign</p>
                  <h3 className="text-lg font-semibold">{group.campaignName}</h3>
                </div>
                <Link href={group.campaignRoute}><Button variant="outline" size="sm">Open campaign</Button></Link>
              </div>

              <div className="mt-4 space-y-3">
                {group.items.slice(0, 3).map((item) => (
                  <div key={`${item.campaignId}-${item.recommendationType}`} className="rounded-md bg-muted/30 p-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="space-y-2">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="inline-flex items-center gap-2 text-sm font-medium">
                            {recommendationIcon(item.recommendationType)}
                            {item.title}
                          </span>
                          <Badge variant={priorityVariant(item.priority)}>{priorityLabel(item.priority)}</Badge>
                        </div>
                        <p className="text-sm text-muted-foreground">{item.message}</p>
                      </div>
                    </div>

                    {item.supportingSignals.length ? (
                      <div className="mt-3 flex flex-wrap gap-2">
                        {item.supportingSignals.map((signal) => (
                          <span key={signal} className="inline-flex items-center gap-1 rounded-full border px-2 py-1 text-xs text-muted-foreground">
                            <CircleDot className="h-3 w-3" />
                            {signal}
                          </span>
                        ))}
                      </div>
                    ) : null}

                    <div className="mt-4 flex flex-wrap gap-2">
                      <Link href={item.campaignRoute}><Button size="sm">View campaign</Button></Link>
                      {item.suggestedRoute ? (
                        <Link href={item.suggestedRoute}><Button size="sm" variant="outline">{item.suggestedAction ?? "Open suggested action"}</Button></Link>
                      ) : item.suggestedAction ? (
                        <span className="text-sm text-muted-foreground">Suggested next move: {item.suggestedAction}</span>
                      ) : null}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        {query.data?.attributionNotes?.length ? (
          <div className="rounded-md border border-dashed p-4 text-xs text-muted-foreground">
            <p className="font-medium text-foreground">How this stays lightweight</p>
            <ul className="mt-2 list-disc space-y-1 pl-4">
              {query.data.attributionNotes.map((note) => <li key={note}>{note}</li>)}
            </ul>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
