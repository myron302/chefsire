import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "wouter";

import DrinksPlatformNav from "@/components/drinks/DrinksPlatformNav";
import { useUser } from "@/contexts/UserContext";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

type PromoPricing = {
  promotionId: string;
  code: string;
  discountType: "percent" | "fixed";
  discountValue: number;
  originalAmountCents: number;
  discountAmountCents: number;
  finalAmountCents: number;
  currencyCode: string;
  startsAt: string | null;
  endsAt: string | null;
  maxRedemptions: number | null;
  redemptionCount: number;
};

type WishlistedCollection = {
  wishlistId: string;
  wishlistedAt: string;
  collectionId: string;
  name: string;
  description: string | null;
  isPublic: boolean;
  isPremium: boolean;
  priceCents: number;
  updatedAt: string;
  userId: string;
  creatorUsername: string | null;
  creatorAvatar: string | null;
  coverImage: string | null;
  route: string;
  isWishlisted: boolean;
  ownedByViewer: boolean;
  wishlistCount: number;
  activePromoPricing: PromoPricing | null;
  promoAlertReady: boolean;
};

type WishlistResponse = {
  ok: boolean;
  count: number;
  collections: WishlistedCollection[];
  promoAlertReadiness?: {
    scaffolded: boolean;
    activelySurfacedCollections: number;
  };
};

function initials(value?: string | null) {
  if (!value) return "DR";
  return value.slice(0, 2).toUpperCase();
}

function formatDate(value?: string | null) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat(undefined, { dateStyle: "medium" }).format(date);
}

function formatCurrency(cents?: number | null, currency = "USD") {
  return new Intl.NumberFormat(undefined, {
    style: "currency",
    currency,
  }).format(Number(cents ?? 0) / 100);
}

function promoLabel(promo: PromoPricing) {
  if (promo.discountType === "percent") return `${promo.discountValue}% off`;
  return `${formatCurrency(promo.discountAmountCents, promo.currencyCode)} off`;
}

export default function DrinkCollectionsWishlistPage() {
  const { user, loading: userLoading } = useUser();
  const queryClient = useQueryClient();

  const wishlistQuery = useQuery<WishlistResponse>({
    queryKey: ["/api/drinks/collections/wishlist", user?.id ?? ""],
    queryFn: async () => {
      const response = await fetch("/api/drinks/collections/wishlist", { credentials: "include" });
      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        const message = payload?.error || payload?.message || `Failed to load wishlist (${response.status})`;
        throw new Error(String(message));
      }
      return payload as WishlistResponse;
    },
    enabled: Boolean(user?.id),
  });

  const removeWishlistMutation = useMutation({
    mutationFn: async (collectionId: string) => {
      const response = await fetch(`/api/drinks/collections/${encodeURIComponent(collectionId)}/wishlist`, {
        method: "DELETE",
        credentials: "include",
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(payload?.error || `Failed to remove wishlist item (${response.status})`);
      }
      return payload;
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["/api/drinks/collections/wishlist", user?.id ?? ""] });
    },
  });

  if (userLoading) {
    return <div className="container mx-auto max-w-6xl px-4 py-8">Loading wishlist…</div>;
  }

  if (!user) {
    return (
      <div className="container mx-auto max-w-6xl space-y-4 px-4 py-8">
        <DrinksPlatformNav current="wishlist" />
        <Card>
          <CardHeader>
            <CardTitle>Wishlist</CardTitle>
            <CardDescription>Sign in to save premium collections for later and watch for active promos.</CardDescription>
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

  const collections = wishlistQuery.data?.collections ?? [];
  const activePromoCount = collections.filter((collection) => Boolean(collection.activePromoPricing)).length;

  return (
    <div className="container mx-auto max-w-6xl space-y-6 px-4 py-8">
      <DrinksPlatformNav current="wishlist" />

      <section className="space-y-2">
        <h1 className="text-3xl font-bold">Wishlist</h1>
        <p className="text-sm text-muted-foreground">
          Save premium drink collections for later. Wishlist interest stays separate from Square checkout starts, purchases, and revenue reporting.
        </p>
        <div className="flex flex-wrap gap-2 pt-1">
          <Link href="/drinks/collections/explore" className="text-sm underline underline-offset-2">Browse premium collections</Link>
          <span className="text-muted-foreground">·</span>
          <Link href="/drinks/collections/purchased" className="text-sm underline underline-offset-2">My purchased collections</Link>
          <span className="text-muted-foreground">·</span>
          <Link href="/drinks/discover" className="text-sm underline underline-offset-2">Back to discover</Link>
        </div>
      </section>

      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-md border p-3">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Saved collections</p>
          <p className="text-xl font-semibold">{collections.length}</p>
        </div>
        <div className="rounded-md border p-3">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">With active promos</p>
          <p className="text-xl font-semibold">{activePromoCount}</p>
        </div>
        <div className="rounded-md border p-3">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Promo alert readiness</p>
          <p className="text-xl font-semibold">{wishlistQuery.data?.promoAlertReadiness?.scaffolded ? "Scaffolded" : "None"}</p>
        </div>
        <div className="rounded-md border p-3">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Latest save</p>
          <p className="text-sm font-medium">{collections[0] ? formatDate(collections[0].wishlistedAt) : "—"}</p>
        </div>
      </div>

      {wishlistQuery.isLoading ? <p className="text-sm text-muted-foreground">Loading your wishlist…</p> : null}
      {wishlistQuery.isError ? <p className="text-sm text-destructive">{wishlistQuery.error instanceof Error ? wishlistQuery.error.message : "Unable to load your wishlist right now."}</p> : null}

      {wishlistQuery.isSuccess && collections.length === 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>No wishlisted collections yet</CardTitle>
            <CardDescription>
              When a premium collection catches your eye, save it here so you can revisit it later and spot active promos quickly.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            <Link href="/drinks/collections/explore">
              <Button>Browse premium collections</Button>
            </Link>
            <Link href="/drinks/discover">
              <Button variant="outline">Return to discover</Button>
            </Link>
          </CardContent>
        </Card>
      ) : null}

      {collections.length > 0 ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {collections.map((collection) => {
            const activePromo = collection.activePromoPricing;
            return (
              <Card key={collection.wishlistId} className="overflow-hidden">
                {collection.coverImage ? (
                  <div className="aspect-[16/9] w-full overflow-hidden bg-muted">
                    <img src={collection.coverImage} alt={collection.name} className="h-full w-full object-cover" loading="lazy" />
                  </div>
                ) : null}
                <CardHeader className="space-y-3">
                  <div className="flex flex-wrap gap-2">
                    <Badge variant="secondary">Wishlisted</Badge>
                    <Badge>{formatCurrency(collection.priceCents)}</Badge>
                    {activePromo ? <Badge variant="secondary">Promo {activePromo.code}</Badge> : null}
                    <Badge variant="outline">Saved {formatDate(collection.wishlistedAt)}</Badge>
                  </div>
                  <div>
                    <CardTitle className="text-xl">
                      <Link href={collection.route} className="underline underline-offset-2">{collection.name}</Link>
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
                      By {collection.creatorUsername ? `@${collection.creatorUsername}` : "a creator"}
                    </div>
                  </div>

                  {activePromo ? (
                    <div className="rounded-md border border-emerald-200 bg-emerald-50/60 p-3 text-sm">
                      <p className="font-medium text-emerald-800">Active promo is live now</p>
                      <p className="text-emerald-700">
                        Use code <span className="font-semibold">{activePromo.code}</span> for {promoLabel(activePromo)}.
                      </p>
                      <p className="text-emerald-700">Current checkout price: {formatCurrency(activePromo.finalAmountCents, activePromo.currencyCode)}</p>
                    </div>
                  ) : (
                    <div className="rounded-md border border-dashed p-3 text-sm text-muted-foreground">
                      No active promo right now. This item is still saved so you can come back quickly later.
                    </div>
                  )}

                  <div className="grid gap-1 text-sm text-muted-foreground">
                    <div>List price: {formatCurrency(collection.priceCents)}</div>
                    <div>Wishlist interest: {collection.wishlistCount}</div>
                    <div>Last collection update: {formatDate(collection.updatedAt)}</div>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <Link href={collection.route}>
                      <Button className="flex-1">View collection</Button>
                    </Link>
                    <Button
                      variant="outline"
                      onClick={() => removeWishlistMutation.mutate(collection.collectionId)}
                      disabled={removeWishlistMutation.isPending}
                    >
                      {removeWishlistMutation.isPending ? "Removing…" : "Remove"}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
