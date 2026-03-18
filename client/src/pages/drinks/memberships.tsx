import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "wouter";

import { useUser } from "@/contexts/UserContext";
import DrinksPlatformNav from "@/components/drinks/DrinksPlatformNav";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

type MembershipRecord = {
  id: string;
  status: "active" | "canceled" | "expired" | "past_due";
  startedAt: string;
  endsAt: string | null;
  accessActive: boolean;
};

type MembershipPlan = {
  id: string;
  name: string;
  description: string | null;
  priceCents: number;
  billingInterval: "monthly" | "yearly";
  benefits: string[];
};

type MembershipEntry = {
  membership: MembershipRecord;
  plan: MembershipPlan | null;
  creator: {
    userId: string;
    username: string | null;
    avatar: string | null;
    route: string;
  };
  accessibleCollections: Array<{
    id: string;
    name: string;
    route: string;
    priceCents: number;
    isPublic: boolean;
  }>;
};

type MembershipsResponse = {
  ok: boolean;
  memberships: MembershipEntry[];
  count: number;
  reportingNotes: string[];
};

function formatDate(value?: string | null) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat(undefined, { dateStyle: "medium" }).format(date);
}

function formatPrice(priceCents = 0, interval: "monthly" | "yearly" = "monthly") {
  const amount = new Intl.NumberFormat(undefined, { style: "currency", currency: "USD" }).format(priceCents / 100);
  return `${amount}/${interval === "yearly" ? "year" : "month"}`;
}

function initials(value?: string | null) {
  return value?.slice(0, 2).toUpperCase() || "MB";
}

export default function DrinkMembershipsPage() {
  const { user, loading: userLoading } = useUser();
  const queryClient = useQueryClient();

  const membershipsQuery = useQuery<MembershipsResponse>({
    queryKey: ["/api/drinks/memberships/mine", user?.id ?? ""],
    queryFn: async () => {
      const response = await fetch("/api/drinks/memberships/mine", { credentials: "include" });
      const payload = await response.json().catch(() => null);
      if (!response.ok) throw new Error(payload?.error || `Failed to load memberships (${response.status})`);
      return payload as MembershipsResponse;
    },
    enabled: Boolean(user?.id),
  });

  const cancelMutation = useMutation({
    mutationFn: async (membershipId: string) => {
      const response = await fetch(`/api/drinks/memberships/${encodeURIComponent(membershipId)}/cancel`, {
        method: "POST",
        credentials: "include",
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok) throw new Error(payload?.error || `Failed to cancel membership (${response.status})`);
      return payload;
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["/api/drinks/memberships/mine", user?.id ?? ""] });
    },
  });

  if (userLoading) {
    return <div className="container mx-auto max-w-6xl px-4 py-8">Loading memberships…</div>;
  }

  if (!user) {
    return (
      <div className="container mx-auto max-w-6xl space-y-4 px-4 py-8">
        <DrinksPlatformNav current="memberships" />
        <Card>
          <CardHeader>
            <CardTitle>Creator Memberships</CardTitle>
            <CardDescription>Sign in to see the creators you support through memberships.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            <Link href="/auth/login"><Button>Sign in</Button></Link>
            <Link href="/drinks/creators/trending"><Button variant="outline">Browse creators</Button></Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  const memberships = membershipsQuery.data?.memberships ?? [];

  return (
    <div className="container mx-auto max-w-6xl space-y-6 px-4 py-8">
      <DrinksPlatformNav current="memberships" />
      <section className="space-y-2">
        <h1 className="text-3xl font-bold">My Creator Memberships</h1>
        <p className="text-sm text-muted-foreground">
          Memberships unlock supported creators&apos; premium collections for the current paid term without replacing free drink discovery.
        </p>
        <div className="flex flex-wrap gap-2 pt-1 text-sm">
          <Link href="/drinks/collections/purchased" className="underline underline-offset-2">Purchased collections</Link>
          <span className="text-muted-foreground">·</span>
          <Link href="/drinks/orders" className="underline underline-offset-2">Order history</Link>
          <span className="text-muted-foreground">·</span>
          <Link href="/drinks/creators/trending" className="underline underline-offset-2">Discover creators</Link>
        </div>
      </section>

      {membershipsQuery.isLoading ? <p className="text-sm text-muted-foreground">Loading memberships…</p> : null}
      {membershipsQuery.isError ? <p className="text-sm text-destructive">{membershipsQuery.error instanceof Error ? membershipsQuery.error.message : "Unable to load memberships right now."}</p> : null}

      {membershipsQuery.isSuccess && memberships.length === 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>No memberships yet</CardTitle>
            <CardDescription>Join a creator membership from a public creator page to unlock ongoing premium collection access.</CardDescription>
          </CardHeader>
          <CardContent>
            <Link href="/drinks/creators/trending"><Button>Browse creators</Button></Link>
          </CardContent>
        </Card>
      ) : null}

      <div className="grid gap-4 md:grid-cols-2">
        {memberships.map((entry) => (
          <Card key={entry.membership.id}>
            <CardHeader className="space-y-3">
              <div className="flex items-center gap-3">
                <Avatar className="h-10 w-10">
                  <AvatarImage src={entry.creator.avatar ?? undefined} alt={entry.creator.username ?? "creator"} />
                  <AvatarFallback>{initials(entry.creator.username)}</AvatarFallback>
                </Avatar>
                <div>
                  <CardTitle className="text-xl">{entry.plan?.name ?? "Creator membership"}</CardTitle>
                  <CardDescription>
                    Supporting <Link href={entry.creator.route} className="underline underline-offset-2">{entry.creator.username ? `@${entry.creator.username}` : "this creator"}</Link>
                  </CardDescription>
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                <Badge variant={entry.membership.accessActive ? "default" : "outline"}>{entry.membership.accessActive ? "Active access" : entry.membership.status}</Badge>
                {entry.plan ? <Badge variant="secondary">{formatPrice(entry.plan.priceCents, entry.plan.billingInterval)}</Badge> : null}
                <Badge variant="outline">Started {formatDate(entry.membership.startedAt)}</Badge>
                <Badge variant="outline">Ends {formatDate(entry.membership.endsAt)}</Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {entry.plan?.description ? <p className="text-sm text-muted-foreground">{entry.plan.description}</p> : null}
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Unlocked premium collections</p>
                {entry.accessibleCollections.length === 0 ? (
                  <p className="mt-2 text-sm text-muted-foreground">This creator has not published premium collections yet.</p>
                ) : (
                  <div className="mt-2 flex flex-wrap gap-2">
                    {entry.accessibleCollections.slice(0, 6).map((collection) => (
                      <Link key={collection.id} href={collection.route} className="rounded-full border px-3 py-1 text-xs underline-offset-2 hover:underline">
                        {collection.name}
                      </Link>
                    ))}
                  </div>
                )}
              </div>
              <div className="flex flex-wrap gap-2">
                <Link href={entry.creator.route}><Button variant="outline">Open creator page</Button></Link>
                {entry.membership.accessActive ? (
                  <Button variant="ghost" onClick={() => cancelMutation.mutate(entry.membership.id)} disabled={cancelMutation.isPending}>
                    {cancelMutation.isPending ? "Updating…" : "Cancel membership"}
                  </Button>
                ) : null}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {membershipsQuery.data?.reportingNotes?.length ? (
        <Card>
          <CardHeader>
            <CardTitle>Reporting notes</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm text-muted-foreground">
            {membershipsQuery.data.reportingNotes.map((note) => <p key={note}>• {note}</p>)}
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
