import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Award, BarChart3, Calendar, Copy, Eye, Heart, ShoppingBag, Sparkles, Star, TrendingUp, Users } from "lucide-react";

type Count = number | null;

type CreatorAnalyticsData = {
  totals: {
    totalSales: number;
    totalRevenue: string;
    totalFollowers: number;
    totalPlanSaves: number;
    totalSharedWeekSaves: number;
    totalWeekCopies: Count;
    totalMarketplacePurchases: number;
    totalProfileViews: Count;
    totalPlanViews?: Count;
    plansPublished: number;
    sharedWeeksPublished: number;
  };
  weekly: {
    followersThisWeek: number;
    planSavesThisWeek: number;
    sharedWeekSavesThisWeek: number;
    copiesThisWeek: Count;
    purchasesThisWeek: number;
  };
  unavailableMetrics: Record<string, string>;
  topContent: {
    mostSavedPlans: Array<{ id: string; title: string; saveCount: number; purchaseCount: number; likeCount: number; reviewCount: number }>;
    mostSavedSharedWeeks: Array<{ token: string; weekAnchor: string; updatedAt: string | null; saveCount: number; likeCount: number; commentCount: number; copyCount: Count }>;
    mostViewedPlan: { id: string; title: string; view_count: number } | null;
    mostCopiedSharedWeek?: { token: string; week_anchor: string; copy_count: number } | null;
    highestConvertingPlan: { id: string; title: string; view_count: number; purchase_count: number } | null;
  };
  badges: Array<{ label: string; description: string }>;
  daily: Array<{ date: string; totalSales?: number; totalRevenueCents?: number }>;
};

function MetricValue({ value }: { value: Count }) {
  return value === null ? <span className="text-base font-semibold text-muted-foreground">Not tracked yet</span> : <>{Number(value || 0).toLocaleString()}</>;
}

function MetricCard({ title, value, help, icon: Icon }: { title: string; value: Count; help: string; icon: any }) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        <Icon className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold"><MetricValue value={value} /></div>
        <p className="mt-1 text-xs text-muted-foreground">{help}</p>
      </CardContent>
    </Card>
  );
}

export default function CreatorAnalytics() {
  const [, setLocation] = useLocation();
  const [data, setData] = useState<CreatorAnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    async function fetchAnalytics() {
      try {
        setLoading(true);
        const response = await fetch("/api/analytics", { credentials: "include" });
        if (!response.ok) throw new Error(`Failed to load analytics (${response.status})`);
        const analyticsData = await response.json();
        if (mounted) setData(analyticsData);
      } catch (err: any) {
        if (mounted) setError(err?.message || "Failed to fetch analytics");
      } finally {
        if (mounted) setLoading(false);
      }
    }
    fetchAnalytics();
    return () => { mounted = false; };
  }, []);

  if (loading) return <div className="mx-auto max-w-7xl p-6 text-center text-muted-foreground">Loading creator analytics…</div>;
  if (error || !data) return <div className="mx-auto max-w-3xl p-6"><Card><CardHeader><CardTitle>Analytics unavailable</CardTitle><CardDescription>{error || "No analytics data available."}</CardDescription></CardHeader></Card></div>;

  const hasAudienceActivity = data.totals.totalFollowers + data.totals.totalPlanSaves + data.totals.totalSharedWeekSaves + data.totals.totalMarketplacePurchases > 0;

  return (
    <div className="mx-auto max-w-7xl space-y-6 p-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-3xl font-bold"><TrendingUp className="h-8 w-8 text-blue-500" />Creator Analytics</h1>
          <p className="text-muted-foreground">Real engagement signals from your meal plans, shared weeks, storefront, and followers.</p>
        </div>
        <Button variant="outline" onClick={() => setLocation("/nutrition/create")}>Create a meal plan</Button>
      </div>

      {!hasAudienceActivity ? (
        <Card className="border-dashed">
          <CardContent className="p-6 text-center">
            <Sparkles className="mx-auto mb-3 h-8 w-8 text-muted-foreground" />
            <h2 className="text-lg font-semibold">Analytics will appear after users interact with your meal plans.</h2>
            <p className="mt-1 text-sm text-muted-foreground">No followers, saved plans, saved shared weeks, or marketplace purchases yet.</p>
          </CardContent>
        </Card>
      ) : null}

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <MetricCard title="Total followers" value={data.totals.totalFollowers} help={data.totals.totalFollowers ? "People following your creator profile" : "No followers yet"} icon={Users} />
        <MetricCard title="Total plan saves" value={data.totals.totalPlanSaves} help={data.totals.totalPlanSaves ? "Marketplace plans saved by users" : "No saved plans yet"} icon={Heart} />
        <MetricCard title="Shared week saves" value={data.totals.totalSharedWeekSaves} help={data.totals.totalSharedWeekSaves ? "Public weeks saved by users" : "No saved shared weeks yet"} icon={Calendar} />
        <MetricCard title="Week copies" value={data.totals.totalWeekCopies} help={data.totals.totalWeekCopies === 0 ? "No copied shared weeks yet" : "Successful shared-week copy actions"} icon={Copy} />
        <MetricCard title="Marketplace purchases" value={data.totals.totalMarketplacePurchases} help="Completed persisted meal plan purchases" icon={ShoppingBag} />
        <MetricCard title="Storefront views" value={data.totals.totalProfileViews} help={data.totals.totalProfileViews === 0 ? "No storefront views yet" : "Tracked storefront page opens"} icon={Eye} />
        <MetricCard title="Plan views" value={data.totals.totalPlanViews ?? null} help={(data.totals.totalPlanViews || 0) === 0 ? "No meal plan views yet" : "Tracked plan detail opens"} icon={Eye} />
        <MetricCard title="Published plans" value={data.totals.plansPublished} help="Currently published marketplace plans" icon={BarChart3} />
        <MetricCard title="Public shared weeks" value={data.totals.sharedWeeksPublished} help="Reusable public weekly planner snapshots" icon={Calendar} />
      </div>

      <div className="grid gap-4 md:grid-cols-5">
        <MetricCard title="Followers this week" value={data.weekly.followersThisWeek} help="Since the start of this week" icon={Users} />
        <MetricCard title="Plan saves this week" value={data.weekly.planSavesThisWeek} help="Timestamped saves this week" icon={Heart} />
        <MetricCard title="Week saves this week" value={data.weekly.sharedWeekSavesThisWeek} help="Timestamped shared week saves this week" icon={Calendar} />
        <MetricCard title="Copies this week" value={data.weekly.copiesThisWeek} help={data.weekly.copiesThisWeek === 0 ? "No copies since the start of this week" : "Successful copies this week"} icon={Copy} />
        <MetricCard title="Purchases this week" value={data.weekly.purchasesThisWeek} help="Completed purchases this week" icon={ShoppingBag} />
      </div>

      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2"><Award className="h-5 w-5" />Social proof badges</CardTitle><CardDescription>Deterministic badges earned from persisted audience data only.</CardDescription></CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          {data.badges.length === 0 ? <p className="text-sm text-muted-foreground">No badges earned yet. Keep publishing and sharing to unlock creator milestones.</p> : null}
          {data.badges.map((badge) => <Badge key={badge.label} className="gap-1"><Star className="h-3.5 w-3.5" />{badge.label}<span className="ml-1 opacity-80">• {badge.description}</span></Badge>)}
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <TopPlans plans={data.topContent.mostSavedPlans} onOpen={(id) => setLocation(`/nutrition/meal-plans/${id}`)} />
        <TopWeeks weeks={data.topContent.mostSavedSharedWeeks} onOpen={(token) => setLocation(`/meal-planner/shared/${token}`)} />
        <TopEventContent data={data} onPlan={(id) => setLocation(`/nutrition/meal-plans/${id}`)} onWeek={(token) => setLocation(`/meal-planner/shared/${token}`)} />
      </div>

      <Card>
        <CardHeader><CardTitle>Purchase history (last 30 tracked days)</CardTitle><CardDescription>Uses the existing creator analytics purchase rollup. Engagement metrics above use live persisted social data.</CardDescription></CardHeader>
        <CardContent className="space-y-2">
          {data.daily.length === 0 ? <p className="py-6 text-center text-sm text-muted-foreground">No recent marketplace purchases.</p> : null}
          {data.daily.map((day) => <div key={day.date} className="flex items-center justify-between rounded border p-3 text-sm"><span>{day.date}</span><span>{Number(day.totalSales || 0)} purchases • ${((Number(day.totalRevenueCents || 0)) / 100).toFixed(2)}</span></div>)}
        </CardContent>
      </Card>
    </div>
  );
}

function TopPlans({ plans, onOpen }: { plans: CreatorAnalyticsData["topContent"]["mostSavedPlans"]; onOpen: (id: string) => void }) {
  return <Card><CardHeader><CardTitle>Most saved plans</CardTitle><CardDescription>Ranked by real plan save records.</CardDescription></CardHeader><CardContent className="space-y-3">{plans.length === 0 ? <p className="text-sm text-muted-foreground">No saved plans yet.</p> : null}{plans.map((plan) => <div key={plan.id} className="flex items-center justify-between gap-3 rounded-lg border p-3"><div><div className="font-medium">{plan.title}</div><div className="text-xs text-muted-foreground">{plan.saveCount} saves • {plan.purchaseCount} purchases • {plan.likeCount} likes</div></div><Button size="sm" variant="outline" onClick={() => onOpen(plan.id)}>View</Button></div>)}</CardContent></Card>;
}

function TopWeeks({ weeks, onOpen }: { weeks: CreatorAnalyticsData["topContent"]["mostSavedSharedWeeks"]; onOpen: (token: string) => void }) {
  return <Card><CardHeader><CardTitle>Most saved shared weeks</CardTitle><CardDescription>Ranked by tracked copies, then saves.</CardDescription></CardHeader><CardContent className="space-y-3">{weeks.length === 0 ? <p className="text-sm text-muted-foreground">No copied or saved shared weeks yet.</p> : null}{weeks.map((week) => <div key={week.token} className="flex items-center justify-between gap-3 rounded-lg border p-3"><div><div className="font-medium">Week of {week.weekAnchor}</div><div className="text-xs text-muted-foreground">{week.saveCount} saves • {Number(week.copyCount || 0)} copies • {week.likeCount} likes</div></div><Button size="sm" variant="outline" onClick={() => onOpen(week.token)}>View</Button></div>)}</CardContent></Card>;
}


function TopEventContent({ data, onPlan, onWeek }: { data: CreatorAnalyticsData; onPlan: (id: string) => void; onWeek: (token: string) => void }) {
  const plan = data.topContent.mostViewedPlan;
  const week = data.topContent.mostCopiedSharedWeek;
  const converting = data.topContent.highestConvertingPlan;
  return <Card><CardHeader><CardTitle>Tracked view and copy leaders</CardTitle><CardDescription>Aggregated analytics events only; viewer identities stay private.</CardDescription></CardHeader><CardContent className="space-y-3">
    {!plan && !week && !converting ? <p className="text-sm text-muted-foreground">Not tracked yet. Views and copies will appear after audience activity.</p> : null}
    {plan ? <div className="flex items-center justify-between rounded-lg border p-3"><div><div className="font-medium">Most viewed plan: {plan.title}</div><div className="text-xs text-muted-foreground">{Number(plan.view_count || 0)} views</div></div><Button size="sm" variant="outline" onClick={() => onPlan(plan.id)}>View</Button></div> : null}
    {week ? <div className="flex items-center justify-between rounded-lg border p-3"><div><div className="font-medium">Most copied shared week: Week of {week.week_anchor || "shared week"}</div><div className="text-xs text-muted-foreground">{Number(week.copy_count || 0)} copies</div></div><Button size="sm" variant="outline" onClick={() => onWeek(week.token)}>View</Button></div> : null}
    {converting ? <div className="rounded-lg border p-3"><div className="font-medium">Highest view-to-purchase plan: {converting.title}</div><div className="text-xs text-muted-foreground">{Number(converting.purchase_count || 0)} purchases from {Number(converting.view_count || 0)} tracked views</div></div> : null}
  </CardContent></Card>;
}
