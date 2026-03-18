import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";

import DrinksPlatformNav from "@/components/drinks/DrinksPlatformNav";
import { useUser } from "@/contexts/UserContext";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

type GiftEntry = {
  id: string;
  giftCode: string;
  status: "pending" | "completed" | "revoked";
  targetType: "collection" | "bundle";
  targetId: string;
  targetName: string;
  targetRoute: string;
  claimUrl: string;
  recipientUserId: string | null;
  claimedAt: string | null;
  completedAt: string | null;
  revokedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

type GiftsResponse = {
  ok: boolean;
  userId: string;
  purchased: GiftEntry[];
  received: GiftEntry[];
};

function formatDateTime(value?: string | null) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(date);
}

function statusBadge(status: GiftEntry["status"]) {
  switch (status) {
    case "completed":
      return { label: "Claimed", variant: "default" as const };
    case "revoked":
      return { label: "Revoked", variant: "outline" as const };
    case "pending":
    default:
      return { label: "Pending claim", variant: "secondary" as const };
  }
}

export default function DrinkGiftsPage() {
  const { user, loading: userLoading } = useUser();

  const giftsQuery = useQuery<GiftsResponse>({
    queryKey: ["/api/drinks/gifts", user?.id ?? ""],
    queryFn: async () => {
      const response = await fetch("/api/drinks/gifts", { credentials: "include" });
      const payload = await response.json().catch(() => null);
      if (!response.ok) throw new Error(payload?.error || `Failed to load gifts (${response.status})`);
      return payload as GiftsResponse;
    },
    enabled: Boolean(user?.id),
  });

  if (userLoading) {
    return <div className="container mx-auto max-w-6xl px-4 py-8">Loading gifts…</div>;
  }

  if (!user) {
    return (
      <div className="container mx-auto max-w-6xl space-y-4 px-4 py-8">
        <DrinksPlatformNav current="gifts" />
        <Card>
          <CardHeader>
            <CardTitle>Premium gifts</CardTitle>
            <CardDescription>Sign in to manage premium collection and bundle gifts.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            <Link href="/auth/login"><Button>Sign in</Button></Link>
            <Link href="/drinks/collections/explore"><Button variant="outline">Browse premium drinks</Button></Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  const purchased = giftsQuery.data?.purchased ?? [];
  const received = giftsQuery.data?.received ?? [];

  return (
    <div className="container mx-auto max-w-6xl space-y-6 px-4 py-8">
      <DrinksPlatformNav current="gifts" />

      <section className="space-y-2">
        <h1 className="text-3xl font-bold">Premium Gifts</h1>
        <p className="text-sm text-muted-foreground">
          Track every premium collection or bundle you bought as a gift, plus gifts you’ve claimed for yourself.
        </p>
      </section>

      {giftsQuery.isLoading ? <p className="text-sm text-muted-foreground">Loading gift history…</p> : null}
      {giftsQuery.isError ? <p className="text-sm text-destructive">{giftsQuery.error instanceof Error ? giftsQuery.error.message : "Unable to load gifts right now."}</p> : null}

      <section className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Purchased gifts</CardTitle>
            <CardDescription>Share claim links after Square verifies payment. Ownership stays with the recipient.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {purchased.length === 0 ? <p className="text-sm text-muted-foreground">No gift purchases yet.</p> : null}
            {purchased.map((gift) => (
              <div key={gift.id} className="rounded-md border p-3 text-sm">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant={statusBadge(gift.status).variant}>{statusBadge(gift.status).label}</Badge>
                  <Badge variant="outline">{gift.targetType === "bundle" ? "Bundle" : "Collection"}</Badge>
                </div>
                <p className="mt-2 font-medium"><Link href={gift.targetRoute} className="underline underline-offset-2">{gift.targetName}</Link></p>
                <p className="text-xs text-muted-foreground">Purchased {formatDateTime(gift.createdAt)}</p>
                <p className="mt-2 break-all text-xs text-muted-foreground">{gift.claimUrl}</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  <Button type="button" variant="outline" size="sm" onClick={() => void navigator.clipboard.writeText(gift.claimUrl)}>
                    Copy claim link
                  </Button>
                  <Link href={`/drinks/gifts/${gift.giftCode}`}><Button size="sm" variant="ghost">Open claim page</Button></Link>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Received gifts</CardTitle>
            <CardDescription>Claimed gifts use the same ownership model as direct premium purchases.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {received.length === 0 ? <p className="text-sm text-muted-foreground">No received gifts yet.</p> : null}
            {received.map((gift) => (
              <div key={gift.id} className="rounded-md border p-3 text-sm">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant={statusBadge(gift.status).variant}>{statusBadge(gift.status).label}</Badge>
                  <Badge variant="outline">{gift.targetType === "bundle" ? "Bundle" : "Collection"}</Badge>
                </div>
                <p className="mt-2 font-medium"><Link href={gift.targetRoute} className="underline underline-offset-2">{gift.targetName}</Link></p>
                <p className="text-xs text-muted-foreground">
                  Claimed {formatDateTime(gift.claimedAt || gift.completedAt)} · Last updated {formatDateTime(gift.updatedAt)}
                </p>
                <div className="mt-2 flex flex-wrap gap-2">
                  <Link href={gift.targetRoute}><Button size="sm">Open content</Button></Link>
                  <Link href={`/drinks/gifts/${gift.giftCode}`}><Button size="sm" variant="outline">View gift record</Button></Link>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
