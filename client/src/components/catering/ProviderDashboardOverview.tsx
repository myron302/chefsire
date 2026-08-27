import { useQuery } from "@tanstack/react-query";
import { AlertCircle, CalendarDays, CheckCircle2, ClipboardList, Eye, Images, MessageSquare, Package, Star } from "lucide-react";
import type { CateringDashboardFacts, CateringDashboardSection } from "@shared/catering-dashboard";
import { cateringDashboardActions } from "@shared/catering-dashboard";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCateringCalendarDate } from "@shared/catering-availability";

type Summary = { facts: CateringDashboardFacts; availability: { minimumLeadDays: number; maximumAdvanceDays: number; timezone: string }; recentInquiries: Array<{ id: string; status: string | null; eventDate: string; eventType: string | null }> };

export const cateringDashboardKey = (providerId: string) => ["catering", "dashboard", providerId] as const;

export function ProviderDashboardOverview({ providerId, openSection }: { providerId: string; openSection: (section: CateringDashboardSection) => void }) {
  const query = useQuery({
    queryKey: cateringDashboardKey(providerId),
    queryFn: async (): Promise<Summary> => { const response = await fetch("/api/catering/dashboard", { credentials: "include" }); const body = await response.json().catch(() => ({})); if (!response.ok) throw new Error(body.message || "Dashboard could not be loaded"); return body; },
    staleTime: 60_000,
    refetchInterval: 5 * 60_000,
    refetchOnWindowFocus: true,
  });
  if (query.isLoading) return <div className="rounded-lg border p-8 text-center" role="status">Loading your business overview…</div>;
  if (query.isError || !query.data) return <Card><CardContent className="space-y-4 p-6" role="alert"><div className="flex gap-2"><AlertCircle className="h-5 w-5 text-destructive" /><p>We could not load dashboard totals. No unavailable metric has been shown as zero.</p></div><Button variant="outline" onClick={() => query.refetch()} disabled={query.isFetching}>Retry overview</Button></CardContent></Card>;
  const { facts, availability, recentInquiries } = query.data;
  const actions = cateringDashboardActions(facts);
  const metrics = [
    { title: "Listing visible", value: facts.listingEnabled ? "Yes" : "No", detail: facts.listingEnabled ? "Active in the marketplace" : "Hidden from customers", icon: Eye },
    { title: "Accepting inquiries", value: facts.acceptingInquiries ? "Yes" : "No", detail: facts.acceptingInquiries ? "New requests are open" : "New requests are paused", icon: MessageSquare },
    { title: "Pending inquiries", value: String(facts.inquiriesPending), detail: "Requests requiring a decision", icon: ClipboardList },
    { title: "Pending confirmations", value: String(facts.bookingsPendingConfirmation), detail: "Persisted agreements awaiting a party", icon: CalendarDays },
    { title: "Upcoming confirmed events", value: String(facts.bookingsUpcomingConfirmed), detail: "Confirmed, not paid or completed", icon: CheckCircle2 },
    { title: "Packages", value: `${facts.packagesActive} active`, detail: `${facts.packagesTotal} total`, icon: Package },
    { title: "Portfolio", value: String(facts.portfolioCount), detail: facts.portfolioCount ? "Published work samples" : "No work samples yet", icon: Images },
    { title: "Reviews", value: facts.reviewCount ? `${facts.averageRating?.toFixed(1)} / 5` : "No rating yet", detail: facts.reviewCount ? `${facts.reviewCount} review${facts.reviewCount === 1 ? "" : "s"}` : "No customer reviews yet", icon: Star },
  ];
  return <div className="space-y-6">
    <section aria-labelledby="business-status"><h2 id="business-status" className="mb-3 text-xl font-semibold">Business status</h2><div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">{metrics.map(({ title, value, detail, icon: Icon }) => <Card key={title} className="min-w-0"><CardContent className="flex gap-3 p-4"><Icon className="h-5 w-5 shrink-0 text-orange-700" aria-hidden="true" /><div className="min-w-0"><p className="text-sm text-muted-foreground">{title}</p><p className="break-words text-xl font-semibold">{value}</p><p className="break-words text-xs text-muted-foreground">{detail}</p></div></CardContent></Card>)}</div></section>
    <section aria-labelledby="next-steps"><Card><CardHeader><CardTitle id="next-steps">{actions.length ? "Action required" : "You’re up to date"}</CardTitle><CardDescription>Next steps derived from your saved catering information.</CardDescription></CardHeader><CardContent>{actions.length ? <ul className="space-y-3">{actions.map((action) => <li key={`${action.section}-${action.label}`} className="flex flex-col gap-3 rounded-lg border p-4 sm:flex-row sm:items-center sm:justify-between"><div className="min-w-0"><p className="font-medium">{action.label}</p><p className="break-words text-sm text-muted-foreground">{action.detail}</p></div><Button className="min-h-11 shrink-0" variant="outline" onClick={() => openSection(action.section)}>Open {action.section}</Button></li>)}</ul> : <p className="flex items-center gap-2 text-sm"><CheckCircle2 className="h-5 w-5 text-emerald-700" />No setup or response tasks need attention.</p>}</CardContent></Card></section>
    <div className="grid gap-6 lg:grid-cols-2">
      <Card><CardHeader><CardTitle>Availability snapshot</CardTitle><CardDescription>Availability controls inquiries; it does not confirm a booking.</CardDescription></CardHeader><CardContent className="space-y-3"><Status label="Listing visible" yes={facts.listingEnabled} /><Status label="Accepting inquiries" yes={facts.acceptingInquiries} /><Status label="Availability configured" yes={facts.availabilityConfigured} /><p className="text-sm text-muted-foreground">{availability.minimumLeadDays} day minimum lead · {availability.maximumAdvanceDays} day advance window · {availability.timezone}</p><Button variant="outline" onClick={() => openSection("availability")}>Manage availability</Button></CardContent></Card>
      <Card><CardHeader><CardTitle>Recent inquiries</CardTitle><CardDescription>Latest customer requests—not confirmed or paid bookings.</CardDescription></CardHeader><CardContent>{recentInquiries.length ? <ul className="space-y-3">{recentInquiries.map((item) => <li key={item.id} className="min-w-0 rounded-lg border p-3"><div className="flex flex-wrap items-center justify-between gap-2"><p className="break-words font-medium">{item.eventType || "Catering request"}</p><Badge variant="outline">{item.status || "pending"}</Badge></div><p className="mt-1 text-sm text-muted-foreground"><CalendarDays className="mr-1 inline h-4 w-4" />Event requested for {formatCateringCalendarDate(item.eventDate)}</p></li>)}</ul> : <p className="text-sm text-muted-foreground">No inquiries have been received yet.</p>}<Button className="mt-4" variant="outline" onClick={() => openSection("inquiries")}>Manage inquiries</Button></CardContent></Card>
    </div>
  </div>;
}

function Status({ label, yes }: { label: string; yes: boolean }) { return <div className="flex flex-wrap items-center justify-between gap-2"><span>{label}</span><Badge variant={yes ? "default" : "secondary"}>{yes ? "Yes" : "No"}</Badge></div>; }
