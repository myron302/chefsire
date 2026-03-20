import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useUser } from "@/contexts/UserContext";

type CampaignWeeklyDigestMilestone = {
  type: string;
  label: string;
  achievedAt: string;
  isPublic: boolean;
};

type CampaignWeeklyDigestGoal = {
  id: string;
  goalType: string;
  label: string;
  targetValue: number;
  completedAt: string | null;
  metricLabel: string;
  metricNote: string | null;
};

type CampaignWeeklyDigestItem = {
  campaignId: string;
  slug: string;
  name: string;
  route: string;
  visibility: "public" | "followers" | "members";
  state: "upcoming" | "active" | "past";
  wasActiveThisWeek: boolean;
  newFollowersThisWeek: number;
  newRsvpsThisWeek: number;
  dropViewsThisWeek: number;
  dropClicksThisWeek: number;
  purchasesFromLinkedCollectionsThisWeek: number;
  purchasesFromLinkedCollectionsThisWeekNote: string | null;
  membershipConversionsThisWeek: number;
  membershipConversionsThisWeekNote: string | null;
  milestonesReachedThisWeek: CampaignWeeklyDigestMilestone[];
  goalsCompletedThisWeek: CampaignWeeklyDigestGoal[];
};

interface CampaignWeeklyDigestResponse {
  ok: boolean;
  userId: string;
  generatedAt: string;
  window: {
    startsAt: string;
    endsAt: string;
    days: number;
  };
  summary: {
    campaignsIncluded: number;
    activeCampaignsThisWeek: number;
    newCampaignFollowersThisWeek: number;
    newRsvpsThisWeek: number;
    dropViewsThisWeek: number;
    dropClicksThisWeek: number;
    purchasesFromLinkedCollectionsThisWeek: number;
    membershipConversionsThisWeek: number;
    milestonesReachedThisWeek: number;
    goalsCompletedThisWeek: number;
  };
  attributionNotes: string[];
  items: CampaignWeeklyDigestItem[];
}

function formatDateTime(value: string | null) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(date);
}

function metricCard(label: string, value: number, sublabel?: string) {
  return (
    <div className="rounded-md border p-3">
      <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="text-xl font-semibold">{value}</p>
      {sublabel ? <p className="text-xs text-muted-foreground">{sublabel}</p> : null}
    </div>
  );
}

export default function CampaignWeeklyDigestSection() {
  const { user } = useUser();
  const query = useQuery<CampaignWeeklyDigestResponse>({
    queryKey: ["/api/drinks/creator-dashboard/campaign-weekly-digest", user?.id ?? ""],
    queryFn: async () => {
      const response = await fetch("/api/drinks/creator-dashboard/campaign-weekly-digest", { credentials: "include" });
      const payload = await response.json().catch(() => null);
      if (!response.ok) throw new Error(payload?.error || payload?.message || `Failed to load campaign weekly digest (${response.status})`);
      return payload as CampaignWeeklyDigestResponse;
    },
    enabled: Boolean(user?.id),
  });

  const summary = query.data?.summary;
  const window = query.data?.window;

  return (
    <Card id="campaign-weekly-digest">
      <CardHeader>
        <CardTitle>Campaign Weekly Digest</CardTitle>
        <CardDescription>
          Lightweight last-7-days reporting for campaign momentum across follows, RSVP interest, linked drop traffic, approximate conversions, milestones, and goal wins.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
          {metricCard("Active this week", summary?.activeCampaignsThisWeek ?? 0, `${summary?.campaignsIncluded ?? 0} campaigns surfaced`) }
          {metricCard("New followers", summary?.newCampaignFollowersThisWeek ?? 0, "Direct campaign follows")}
          {metricCard("New RSVPs", summary?.newRsvpsThisWeek ?? 0, "Linked drop RSVP activity")}
          {metricCard("Views / clicks", (summary?.dropViewsThisWeek ?? 0) + (summary?.dropClicksThisWeek ?? 0), `${summary?.dropViewsThisWeek ?? 0} views · ${summary?.dropClicksThisWeek ?? 0} clicks`) }
          {metricCard("Wins", (summary?.milestonesReachedThisWeek ?? 0) + (summary?.goalsCompletedThisWeek ?? 0), `${summary?.milestonesReachedThisWeek ?? 0} milestones · ${summary?.goalsCompletedThisWeek ?? 0} goals`) }
        </div>

        {query.isLoading ? <p className="text-sm text-muted-foreground">Loading weekly digest…</p> : null}
        {query.isError ? <p className="text-sm text-destructive">{query.error instanceof Error ? query.error.message : "Unable to load campaign weekly digest right now."}</p> : null}

        {window ? (
          <div className="rounded-md border border-dashed p-4 text-sm text-muted-foreground">
            <p className="font-medium text-foreground">Digest window</p>
            <p className="mt-1">{formatDateTime(window.startsAt)} to {formatDateTime(window.endsAt)}.</p>
            <p className="mt-1">Approximate purchases and memberships stay clearly labeled so this remains a native dashboard summary instead of a separate attribution platform.</p>
          </div>
        ) : null}

        {query.data?.attributionNotes?.length ? (
          <div className="rounded-md border border-dashed p-4 text-sm text-muted-foreground">
            <p className="font-medium text-foreground">What is direct vs. approximate</p>
            <ul className="mt-2 list-disc space-y-1 pl-5">
              {query.data.attributionNotes.map((note) => <li key={note}>{note}</li>)}
            </ul>
          </div>
        ) : null}

        {query.data?.items?.length ? (
          <div className="space-y-4">
            {query.data.items.map((item) => (
              <div key={item.campaignId} className="rounded-lg border p-4">
                <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                  <div className="space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-lg font-semibold">{item.name}</h3>
                      <Badge variant={item.wasActiveThisWeek ? "default" : "outline"}>{item.wasActiveThisWeek ? "Active this week" : item.state}</Badge>
                      <Badge variant="outline">{item.visibility}</Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {item.newFollowersThisWeek} new followers · {item.newRsvpsThisWeek} RSVPs · {item.dropViewsThisWeek} views · {item.dropClicksThisWeek} clicks
                    </p>
                    <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
                      <span>
                        {item.purchasesFromLinkedCollectionsThisWeek} purchases
                        {item.purchasesFromLinkedCollectionsThisWeekNote ? " (approx.)" : ""}
                      </span>
                      <span>
                        {item.membershipConversionsThisWeek} memberships
                        {item.membershipConversionsThisWeekNote ? " (approx.)" : ""}
                      </span>
                    </div>
                  </div>
                  <Link href={item.route}><Button variant="outline" size="sm">Open campaign</Button></Link>
                </div>

                <div className="mt-4 grid gap-4 lg:grid-cols-2">
                  <div className="rounded-md bg-muted/30 p-3">
                    <p className="text-sm font-medium">Milestones reached this week</p>
                    {item.milestonesReachedThisWeek.length ? (
                      <ul className="mt-2 space-y-2 text-sm text-muted-foreground">
                        {item.milestonesReachedThisWeek.map((milestone) => (
                          <li key={`${item.campaignId}-${milestone.type}`}>
                            <span className="font-medium text-foreground">{milestone.label}</span>
                            <span> · {formatDateTime(milestone.achievedAt)}</span>
                            {!milestone.isPublic ? <span> · internal</span> : null}
                          </li>
                        ))}
                      </ul>
                    ) : <p className="mt-2 text-sm text-muted-foreground">No new milestones reached in this window.</p>}
                  </div>

                  <div className="rounded-md bg-muted/30 p-3">
                    <p className="text-sm font-medium">Goals completed this week</p>
                    {item.goalsCompletedThisWeek.length ? (
                      <ul className="mt-2 space-y-2 text-sm text-muted-foreground">
                        {item.goalsCompletedThisWeek.map((goal) => (
                          <li key={goal.id}>
                            <span className="font-medium text-foreground">{goal.label}</span>
                            <span> · target {goal.targetValue}</span>
                            {goal.completedAt ? <span> · {formatDateTime(goal.completedAt)}</span> : null}
                            <div className="text-xs text-muted-foreground">
                              {goal.metricLabel}{goal.metricNote ? ` — ${goal.metricNote}` : ""}
                            </div>
                          </li>
                        ))}
                      </ul>
                    ) : <p className="mt-2 text-sm text-muted-foreground">No goal thresholds crossed in this window.</p>}
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : null}

        {!query.isLoading && !query.isError && !(query.data?.items?.length) ? (
          <Card>
            <CardContent className="p-4 text-sm text-muted-foreground">
              No weekly campaign activity yet. Once follows, RSVP interest, linked drop traffic, milestones, or goal completions happen, they will show up here automatically.
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
