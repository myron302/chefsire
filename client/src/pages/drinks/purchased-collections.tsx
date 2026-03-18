import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";

import { useUser } from "@/contexts/UserContext";
import DrinksPlatformNav from "@/components/drinks/DrinksPlatformNav";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

type PurchasedCollection = {
  purchaseId: string;
  collectionId: string;
  status: "completed" | "refunded_pending" | "refunded" | "revoked";
  statusReason: string | null;
  accessRevokedAt: string | null;
  name: string;
  description: string | null;
  isPublic: boolean;
  isPremium: boolean;
  priceCents: number;
  purchasedAt: string;
  updatedAt: string;
  userId: string;
  creatorUsername: string | null;
  creatorAvatar: string | null;
  coverImage: string | null;
  route: string;
};

type PurchasedCollectionsResponse = {
  ok: boolean;
  count: number;
  collections: PurchasedCollection[];
};

function formatDate(value?: string | null) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat(undefined, { dateStyle: "medium" }).format(date);
}

function formatPrice(priceCents?: number | null) {
  const cents = Number(priceCents ?? 0);
  return new Intl.NumberFormat(undefined, {
    style: "currency",
    currency: "USD",
  }).format(cents / 100);
}

function initials(value?: string | null) {
  if (!value) return "DR";
  return value.slice(0, 2).toUpperCase();
}

function purchaseStatusBadge(status: PurchasedCollection["status"]) {
  switch (status) {
    case "refunded":
      return { label: "Refunded", variant: "outline" as const };
    case "refunded_pending":
      return { label: "Refund pending", variant: "outline" as const };
    case "revoked":
      return { label: "Access revoked", variant: "outline" as const };
    case "completed":
    default:
      return { label: "Owned", variant: "default" as const };
  }
}

export default function PurchasedCollectionsPage() {
  const { user, loading: userLoading } = useUser();

  const purchasedQuery = useQuery<PurchasedCollectionsResponse>({
    queryKey: ["/api/drinks/collections/purchased", user?.id ?? ""],
    queryFn: async () => {
      const response = await fetch("/api/drinks/collections/purchased", { credentials: "include" });
      const payload = await response.json().catch(() => null);

      if (!response.ok) {
        const message = payload?.error || payload?.message || `Failed to load purchased collections (${response.status})`;
        throw new Error(String(message));
      }

      return payload as PurchasedCollectionsResponse;
    },
    enabled: Boolean(user?.id),
  });

  if (userLoading) {
    return <div className="container mx-auto max-w-6xl px-4 py-8">Loading your collections…</div>;
  }

  if (!user) {
    return (
      <div className="container mx-auto max-w-6xl space-y-4 px-4 py-8">
        <DrinksPlatformNav current="purchased" />
        <Card>
          <CardHeader>
            <CardTitle>My Purchased Collections</CardTitle>
            <CardDescription>Sign in to view premium drink collections you own.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            <Link href="/auth/login">
              <Button>Sign in</Button>
            </Link>
            <Link href="/drinks/collections/explore">
              <Button variant="outline">Browse premium collections</Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  const purchasedCollections = purchasedQuery.data?.collections ?? [];

  return (
    <div className="container mx-auto max-w-6xl space-y-6 px-4 py-8">
      <DrinksPlatformNav current="purchased" />

      <section className="space-y-2">
        <h1 className="text-3xl font-bold">My Purchased Collections</h1>
        <p className="text-sm text-muted-foreground">
          Revisit premium drink collections you&apos;ve unlocked. Gross creator payouts are not shown here—this page is ownership only.
        </p>
        <div className="flex flex-wrap gap-2 pt-1">
          <Link href="/drinks/orders" className="text-sm underline underline-offset-2">View order history</Link>
          <span className="text-muted-foreground">·</span>
          <Link href="/drinks/gifts" className="text-sm underline underline-offset-2">Gift history</Link>
          <span className="text-muted-foreground">·</span>
          <Link href="/drinks/collections/explore" className="text-sm underline underline-offset-2">Browse premium collections</Link>
          <span className="text-muted-foreground">·</span>
          <Link href="/drinks/discover" className="text-sm underline underline-offset-2">Back to discover</Link>
        </div>
      </section>

      {purchasedQuery.isLoading ? <p className="text-sm text-muted-foreground">Loading owned collections…</p> : null}
      {purchasedQuery.isError ? <p className="text-sm text-destructive">{purchasedQuery.error instanceof Error ? purchasedQuery.error.message : "Unable to load your purchased collections right now."}</p> : null}

      {purchasedQuery.isSuccess && purchasedCollections.length === 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>No purchased collections yet</CardTitle>
            <CardDescription>
              Once you unlock a premium collection, it will appear here for easy access.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            <Link href="/drinks/orders">
              <Button variant="outline">View order history</Button>
            </Link>
            <Link href="/drinks/collections/explore">
              <Button>Browse premium collections</Button>
            </Link>
            <Link href="/drinks/discover">
              <Button variant="outline">Return to discover</Button>
            </Link>
          </CardContent>
        </Card>
      ) : null}

      {purchasedCollections.length > 0 ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {purchasedCollections.map((collection) => (
            <Card key={collection.purchaseId} className="overflow-hidden">
              {collection.coverImage ? (
                <div className="aspect-[16/9] w-full overflow-hidden bg-muted">
                  <img
                    src={collection.coverImage}
                    alt={collection.name}
                    className="h-full w-full object-cover"
                    loading="lazy"
                  />
                </div>
              ) : null}
              <CardHeader className="space-y-3">
                <div className="flex flex-wrap gap-2">
                  <Badge variant={purchaseStatusBadge(collection.status).variant}>{purchaseStatusBadge(collection.status).label}</Badge>
                  {collection.isPremium ? <Badge variant="secondary">{formatPrice(collection.priceCents)}</Badge> : null}
                  <Badge variant="outline">Purchased {formatDate(collection.purchasedAt)}</Badge>
                  {collection.accessRevokedAt ? <Badge variant="outline">Updated {formatDate(collection.accessRevokedAt)}</Badge> : null}
                </div>
                <div>
                  <CardTitle className="text-xl">
                    <Link href={collection.route} className="underline underline-offset-2">
                      {collection.name}
                    </Link>
                  </CardTitle>
                  <CardDescription>{collection.description || "No description provided."}</CardDescription>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center gap-2">
                  <Avatar className="h-7 w-7">
                    <AvatarImage src={collection.creatorAvatar ?? undefined} alt={collection.creatorUsername ?? "creator"} />
                    <AvatarFallback>{initials(collection.creatorUsername)}</AvatarFallback>
                  </Avatar>
                  <div className="text-sm text-muted-foreground">
                    Created by {collection.creatorUsername ? `@${collection.creatorUsername}` : "a creator"}
                  </div>
                </div>
                <div className="grid gap-2 text-sm text-muted-foreground">
                  <div>Owned since: {formatDate(collection.purchasedAt)}</div>
                  <div>Latest collection update: {formatDate(collection.updatedAt)}</div>
                  {collection.status !== "completed" ? (
                    <div>
                      Access status: {purchaseStatusBadge(collection.status).label}.
                      {collection.statusReason ? ` ${collection.statusReason}` : ""}
                    </div>
                  ) : null}
                </div>
                <Link href={collection.route}>
                  <Button className="w-full" variant={collection.status === "completed" ? "default" : "outline"}>
                    {collection.status === "completed" ? "Open collection" : "View collection status"}
                  </Button>
                </Link>
                <Link href="/drinks/orders">
                  <Button className="w-full" variant="ghost">Open order history</Button>
                </Link>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : null}
    </div>
  );
}
