import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useUser } from "@/contexts/UserContext";

interface DropAnalyticsResponse {
  ok: boolean;
  userId: string;
  summary: {
    totalDrops: number;
    upcomingDrops: number;
    liveDrops: number;
    archivedDrops: number;
    totalViews: number;
    totalRsvps: number;
    totalAlertsSent: number;
    totalLinkedClicks: number;
    totalPurchasesFromDrops: number;
    totalMembershipConversions: number;
  };
  attributionNotes: string[];
  items: Array<{
    dropId: string;
    title: string;
    status: "upcoming" | "live" | "archived";
    scheduledFor: string;
    liveAt: string | null;
    rsvpCount: number;
    viewCount: number;
    alertsSentCount: number;
    linkedClicksCount: number;
    purchaseCount: number;
    membershipConversionsCount: number;
    membershipConversionsNote: string | null;
    purchaseAttributionNote: string | null;
    conversionRate: number | null;
  }>;
}

function formatDate(value: string | null) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(date);
}

export default function DropLaunchAnalyticsSection() {
  const { user } = useUser();
  const query = useQuery<DropAnalyticsResponse>({
    queryKey: ["/api/drinks/creator-dashboard/drop-analytics", user?.id ?? ""],
    queryFn: async () => {
      const response = await fetch("/api/drinks/creator-dashboard/drop-analytics", { credentials: "include" });
      const payload = await response.json().catch(() => null);
      if (!response.ok) throw new Error(payload?.error || payload?.message || `Failed to load drop analytics (${response.status})`);
      return payload as DropAnalyticsResponse;
    },
    enabled: Boolean(user?.id),
  });

  const summary = query.data?.summary;

  return (
    <Card id="launch-analytics">
      <CardHeader>
        <CardTitle>Launch Analytics / Drop Funnel</CardTitle>
        <CardDescription>
          Understand how each release performs from announcement and RSVP to go-live clicks and linked purchase or membership conversion proxies.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid gap-2 sm:grid-cols-3 lg:grid-cols-5">
          <div className="rounded-md border p-3"><p className="text-xs uppercase tracking-wide text-muted-foreground">Drop views</p><p className="text-xl font-semibold">{summary?.totalViews ?? 0}</p></div>
          <div className="rounded-md border p-3"><p className="text-xs uppercase tracking-wide text-muted-foreground">RSVPs</p><p className="text-xl font-semibold">{summary?.totalRsvps ?? 0}</p></div>
          <div className="rounded-md border p-3"><p className="text-xs uppercase tracking-wide text-muted-foreground">Alerts sent</p><p className="text-xl font-semibold">{summary?.totalAlertsSent ?? 0}</p></div>
          <div className="rounded-md border p-3"><p className="text-xs uppercase tracking-wide text-muted-foreground">CTA clicks</p><p className="text-xl font-semibold">{summary?.totalLinkedClicks ?? 0}</p></div>
          <div className="rounded-md border p-3"><p className="text-xs uppercase tracking-wide text-muted-foreground">Purchases / memberships</p><p className="text-xl font-semibold">{(summary?.totalPurchasesFromDrops ?? 0) + (summary?.totalMembershipConversions ?? 0)}</p></div>
        </div>

        {query.isLoading ? <p className="text-sm text-muted-foreground">Loading launch analytics…</p> : null}
        {query.isError ? <p className="text-sm text-destructive">{query.error instanceof Error ? query.error.message : "Unable to load launch analytics right now."}</p> : null}

        {query.data?.attributionNotes?.length ? (
          <div className="rounded-md border border-dashed p-4 text-sm text-muted-foreground">
            <p className="font-medium text-foreground">Attribution notes</p>
            <ul className="mt-2 list-disc space-y-1 pl-5">
              {query.data.attributionNotes.map((note) => <li key={note}>{note}</li>)}
            </ul>
          </div>
        ) : null}

        {query.data?.items?.length ? (
          <div className="overflow-x-auto rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Drop</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Scheduled</TableHead>
                  <TableHead>Views</TableHead>
                  <TableHead>RSVPs</TableHead>
                  <TableHead>Alerts</TableHead>
                  <TableHead>Clicks</TableHead>
                  <TableHead>Purchases</TableHead>
                  <TableHead>Memberships</TableHead>
                  <TableHead>Conv. rate</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {query.data.items.map((item) => (
                  <TableRow key={item.dropId}>
                    <TableCell>
                      <div className="space-y-1">
                        <p className="font-medium">{item.title}</p>
                        <Link href={`/drinks/drops/${encodeURIComponent(item.dropId)}`} className="text-xs underline underline-offset-2">Open drop page</Link>
                      </div>
                    </TableCell>
                    <TableCell className="capitalize">{item.status}</TableCell>
                    <TableCell>{formatDate(item.scheduledFor)}</TableCell>
                    <TableCell>{item.viewCount}</TableCell>
                    <TableCell>{item.rsvpCount}</TableCell>
                    <TableCell>{item.alertsSentCount}</TableCell>
                    <TableCell>{item.linkedClicksCount}</TableCell>
                    <TableCell>
                      <div>
                        <p>{item.purchaseCount}</p>
                        {item.purchaseAttributionNote ? <p className="text-xs text-muted-foreground">proxy</p> : null}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div>
                        <p>{item.membershipConversionsCount}</p>
                        {item.membershipConversionsNote ? <p className="text-xs text-muted-foreground">proxy</p> : null}
                      </div>
                    </TableCell>
                    <TableCell>{item.conversionRate !== null ? `${item.conversionRate}%` : "—"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        ) : null}

        {!query.isLoading && !query.isError && !(query.data?.items?.length) ? (
          <Card>
            <CardContent className="p-4 text-sm text-muted-foreground">
              No creator drops yet. Schedule a launch to start collecting lightweight funnel metrics.
            </CardContent>
          </Card>
        ) : null}

        <div className="flex flex-wrap gap-2">
          <Link href="/drinks/drops"><Button variant="outline">Open drops calendar</Button></Link>
          <Link href="/drinks/discover"><Button variant="ghost">Discover hub</Button></Link>
        </div>
      </CardContent>
    </Card>
  );
}
