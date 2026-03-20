import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useUser } from "@/contexts/UserContext";

export type CampaignRetrospectiveGoal = {
  id: string;
  goalType: string;
  targetValue: number;
  label: string | null;
  createdAt: string;
  updatedAt: string;
  currentValue: number;
  percentComplete: number;
  isComplete: boolean;
  metricLabel: string;
  metricNote: string | null;
};

export type CampaignRetrospectiveInsight = {
  kind: "win" | "miss" | "lesson";
  title: string;
  message: string;
  supportingSignals: string[];
};

export type CampaignRetrospectiveItem = {
  campaignId: string;
  slug: string;
  name: string;
  route: string;
  visibility: "public" | "followers" | "members";
  startsAt: string | null;
  endsAt: string | null;
  durationDays: number;
  endState: "completed" | "archived";
  followerGain: number;
  totalRsvpInterest: number;
  totalDropViews: number;
  totalDropClicks: number;
  linkedCollectionPurchases: number;
  linkedCollectionPurchasesNote: string | null;
  membershipConversions: number;
  membershipConversionsNote: string | null;
  milestonesReached: Array<{
    type: string;
    label: string;
    shortLabel: string;
    description: string;
    achieved: boolean;
    achievedAt: string | null;
    isPublic: boolean;
    currentValue: number | null;
    targetValue: number | null;
  }>;
  goals: {
    completed: CampaignRetrospectiveGoal[];
    incomplete: CampaignRetrospectiveGoal[];
  };
  bestPerformingAsset: {
    targetType: "drop" | "collection";
    targetId: string;
    title: string;
    route: string;
    score: number;
    metricLabel: string;
    metricValue: number;
    supportingSignals: string[];
  } | null;
  strongestVariant: {
    variantId: string;
    label: string;
    headline: string | null;
    ctaTargetType: "follow" | "rsvp" | "collection" | "membership" | "drop" | "challenge";
    score: number;
    metricLabel: string;
    metricValue: number;
    supportingSignals: string[];
    note: string | null;
  } | null;
  wins: CampaignRetrospectiveInsight[];
  misses: CampaignRetrospectiveInsight[];
  lessons: CampaignRetrospectiveInsight[];
  linkedCounts: {
    drops: number;
    collections: number;
    posts: number;
    promos: number;
    roadmap: number;
    challenges: number;
  };
  reuseCandidate: boolean;
  reuseReason: string | null;
};

type CampaignRetrospectivesResponse = {
  ok: boolean;
  userId: string;
  summary: {
    totalRetrospectives: number;
    completedCampaigns: number;
    archivedCampaigns: number;
    totalFollowerGain: number;
    totalRsvpInterest: number;
    totalApproximateConversions: number;
    reuseCandidates: number;
  };
  items: CampaignRetrospectiveItem[];
  attributionNotes: string[];
  generatedAt: string;
};

function formatDate(value: string | null) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat(undefined, { dateStyle: "medium" }).format(date);
}

function InsightBlock({ title, items }: { title: string; items: CampaignRetrospectiveInsight[] }) {
  return (
    <div className="rounded-md bg-muted/30 p-3">
      <p className="text-sm font-medium">{title}</p>
      {items.length ? (
        <ul className="mt-2 space-y-3 text-sm">
          {items.map((item) => (
            <li key={`${item.kind}-${item.title}`} className="space-y-1">
              <p className="font-medium text-foreground">{item.title}</p>
              <p className="text-muted-foreground">{item.message}</p>
              {item.supportingSignals.length ? (
                <div className="flex flex-wrap gap-2">
                  {item.supportingSignals.map((signal) => (
                    <span key={signal} className="rounded-full border px-2 py-0.5 text-xs text-muted-foreground">{signal}</span>
                  ))}
                </div>
              ) : null}
            </li>
          ))}
        </ul>
      ) : <p className="mt-2 text-sm text-muted-foreground">No {title.toLowerCase()} surfaced for this wrap-up yet.</p>}
    </div>
  );
}

export function CampaignWrapUpPanel({ item, compact = false }: { item: CampaignRetrospectiveItem; compact?: boolean }) {
  return (
    <div className="rounded-lg border p-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-lg font-semibold">{item.name}</h3>
            <Badge variant={item.endState === "completed" ? "default" : "secondary"}>{item.endState}</Badge>
            <Badge variant="outline">{item.visibility}</Badge>
            {item.reuseCandidate ? <Badge variant="outline">Reuse candidate</Badge> : null}
          </div>
          <p className="text-sm text-muted-foreground">
            {formatDate(item.startsAt)} to {formatDate(item.endsAt)} · {item.durationDays} day{item.durationDays === 1 ? "" : "s"}
          </p>
          <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
            <span>{item.followerGain} follower gain</span>
            <span>{item.totalRsvpInterest} RSVPs</span>
            <span>{item.totalDropViews} views</span>
            <span>{item.totalDropClicks} clicks</span>
            <span>{item.linkedCollectionPurchases} purchases{item.linkedCollectionPurchasesNote ? " (approx.)" : ""}</span>
            <span>{item.membershipConversions} memberships{item.membershipConversionsNote ? " (approx.)" : ""}</span>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <Link href={item.route}><Button size="sm">Open campaign</Button></Link>
          <Link href="/drinks/creator-dashboard#campaigns"><Button size="sm" variant="outline">Reuse from dashboard</Button></Link>
        </div>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-md border p-3"><p className="text-xs uppercase tracking-wide text-muted-foreground">Milestones hit</p><p className="text-xl font-semibold">{item.milestonesReached.length}</p></div>
        <div className="rounded-md border p-3"><p className="text-xs uppercase tracking-wide text-muted-foreground">Goals done</p><p className="text-xl font-semibold">{item.goals.completed.length}</p><p className="text-xs text-muted-foreground">{item.goals.incomplete.length} still open</p></div>
        <div className="rounded-md border p-3"><p className="text-xs uppercase tracking-wide text-muted-foreground">Best asset</p><p className="text-sm font-semibold">{item.bestPerformingAsset?.title ?? "No asset signal yet"}</p><p className="text-xs text-muted-foreground">{item.bestPerformingAsset ? `${item.bestPerformingAsset.metricValue} ${item.bestPerformingAsset.metricLabel}` : "Waiting on measurable linked asset response"}</p></div>
        <div className="rounded-md border p-3"><p className="text-xs uppercase tracking-wide text-muted-foreground">Strongest CTA</p><p className="text-sm font-semibold">{item.strongestVariant?.label ?? "No CTA signal yet"}</p><p className="text-xs text-muted-foreground">{item.strongestVariant ? `${item.strongestVariant.metricValue} ${item.strongestVariant.metricLabel}` : "No winning variant surfaced"}</p></div>
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-3">
        <InsightBlock title="Wins" items={item.wins} />
        <InsightBlock title="Misses" items={item.misses} />
        <InsightBlock title="Lessons" items={item.lessons} />
      </div>

      {!compact ? (
        <div className="mt-4 grid gap-4 lg:grid-cols-2">
          <div className="rounded-md border border-dashed p-3 text-sm">
            <p className="font-medium">Wrap-up details</p>
            <ul className="mt-2 space-y-1 text-muted-foreground">
              <li>{item.linkedCounts.drops} linked drops · {item.linkedCounts.collections} collections · {item.linkedCounts.posts} posts</li>
              <li>{item.linkedCounts.promos} promos · {item.linkedCounts.roadmap} roadmap notes · {item.linkedCounts.challenges} challenges</li>
              <li>{item.reuseReason ?? "Reuse is not strongly recommended yet."}</li>
            </ul>
          </div>
          <div className="rounded-md border border-dashed p-3 text-sm">
            <p className="font-medium">Goals + milestones</p>
            <ul className="mt-2 space-y-1 text-muted-foreground">
              {item.goals.completed.slice(0, 2).map((goal) => <li key={goal.id}>Completed: {goal.label?.trim() || goal.metricLabel}</li>)}
              {item.goals.incomplete.slice(0, 2).map((goal) => <li key={goal.id}>Still open: {goal.label?.trim() || goal.metricLabel} ({goal.percentComplete}%)</li>)}
              {!item.goals.completed.length && !item.goals.incomplete.length ? <li>No creator-set goals were attached to this campaign.</li> : null}
              {item.milestonesReached.slice(0, 2).map((milestone) => <li key={milestone.type}>Milestone: {milestone.shortLabel}</li>)}
            </ul>
          </div>
        </div>
      ) : null}
    </div>
  );
}

export default function CampaignRetrospectivesSection() {
  const { user } = useUser();
  const query = useQuery<CampaignRetrospectivesResponse>({
    queryKey: ["/api/drinks/creator-dashboard/campaign-retrospectives", user?.id ?? ""],
    queryFn: async () => {
      const response = await fetch("/api/drinks/creator-dashboard/campaign-retrospectives", { credentials: "include" });
      const payload = await response.json().catch(() => null);
      if (!response.ok) throw new Error(payload?.error || payload?.message || `Failed to load campaign retrospectives (${response.status})`);
      return payload as CampaignRetrospectivesResponse;
    },
    enabled: Boolean(user?.id),
  });

  const summary = query.data?.summary;

  return (
    <Card id="campaign-retrospectives">
      <CardHeader>
        <CardTitle>Campaign Retrospectives / Wrap-Up</CardTitle>
        <CardDescription>
          End-of-campaign summaries for archived and completed campaigns. This stays separate from ongoing analytics, weekly digest snapshots, goals, milestones, and playbook recommendations.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-md border p-3"><p className="text-xs uppercase tracking-wide text-muted-foreground">Wrap-ups</p><p className="text-xl font-semibold">{summary?.totalRetrospectives ?? 0}</p></div>
          <div className="rounded-md border p-3"><p className="text-xs uppercase tracking-wide text-muted-foreground">Follower gain</p><p className="text-xl font-semibold">{summary?.totalFollowerGain ?? 0}</p><p className="text-xs text-muted-foreground">Direct campaign follows</p></div>
          <div className="rounded-md border p-3"><p className="text-xs uppercase tracking-wide text-muted-foreground">RSVP interest</p><p className="text-xl font-semibold">{summary?.totalRsvpInterest ?? 0}</p><p className="text-xs text-muted-foreground">Lifetime campaign window</p></div>
          <div className="rounded-md border p-3"><p className="text-xs uppercase tracking-wide text-muted-foreground">Reuse candidates</p><p className="text-xl font-semibold">{summary?.reuseCandidates ?? 0}</p><p className="text-xs text-muted-foreground">Archived campaigns worth cloning</p></div>
        </div>

        {query.isLoading ? <p className="text-sm text-muted-foreground">Loading campaign retrospectives…</p> : null}
        {query.isError ? <p className="text-sm text-destructive">{query.error instanceof Error ? query.error.message : "Unable to load campaign retrospectives right now."}</p> : null}

        {query.data?.attributionNotes?.length ? (
          <div className="rounded-md border border-dashed p-4 text-sm text-muted-foreground">
            <p className="font-medium text-foreground">What this wrap-up uses</p>
            <ul className="mt-2 list-disc space-y-1 pl-5">
              {query.data.attributionNotes.map((note) => <li key={note}>{note}</li>)}
            </ul>
          </div>
        ) : null}

        {query.data?.items?.length ? (
          <div className="space-y-4">
            {query.data.items.map((item) => <CampaignWrapUpPanel key={item.campaignId} item={item} />)}
          </div>
        ) : null}

        {!query.isLoading && !query.isError && !(query.data?.items?.length) ? (
          <Card>
            <CardContent className="p-4 text-sm text-muted-foreground">
              No ended campaigns yet. Once a campaign is completed or archived, its wrap-up will appear here with measurable wins, misses, and reusable lessons.
            </CardContent>
          </Card>
        ) : null}
      </CardContent>
    </Card>
  );
}
