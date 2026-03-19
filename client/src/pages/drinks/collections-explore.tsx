import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";

import DrinksPlatformNav from "@/components/drinks/DrinksPlatformNav";
import CollectionRatingSummary from "@/components/drinks/CollectionRatingSummary";
import { useUser } from "@/contexts/UserContext";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

type CollectionAccessType = "public" | "premium_purchase" | "membership_only";

interface PublicCollectionItem {
  id: string;
  drinkSlug: string;
  drinkName: string;
  image: string | null;
  route: string;
  remixedFromSlug: string | null;
}

interface PromoPricing {
  promotionId: string;
  code: string;
  discountType: "percent" | "fixed";
  discountValue: number;
  originalAmountCents: number;
  discountAmountCents: number;
  finalAmountCents: number;
  currencyCode: string;
}

interface PublicCollection {
  id: string;
  name: string;
  description: string | null;
  isPublic: boolean;
  accessType: CollectionAccessType;
  isPremium: boolean;
  priceCents: number;
  userId: string;
  creatorUsername: string | null;
  creatorAvatar: string | null;
  itemsCount: number;
  coverImage: string | null;
  updatedAt: string;
  route: string;
  ownedByViewer?: boolean;
  viewerAccessGrants?: Array<"creator" | "direct_purchase" | "bundle" | "membership">;
  viewerPrimaryAccessGrant?: "creator" | "direct_purchase" | "bundle" | "membership" | null;
  isWishlisted?: boolean;
  wishlistCount?: number;
  averageRating?: number;
  reviewCount?: number;
  activePromoPricing?: PromoPricing | null;
  items: PublicCollectionItem[];
}

interface PublicCollectionsResponse {
  ok: boolean;
  collections: PublicCollection[];
}

interface PublicBundle {
  id: string;
  name: string;
  description: string | null;
  isPublic: boolean;
  isPremium: boolean;
  priceCents: number;
  userId: string;
  creatorUsername: string | null;
  itemsCount: number;
  route: string;
  ownedByViewer?: boolean;
}

function initials(value: string | null): string {
  if (!value) return "DR";
  return value.slice(0, 2).toUpperCase();
}

function formatCurrency(cents: number, currency = "USD") {
  return new Intl.NumberFormat(undefined, {
    style: "currency",
    currency,
  }).format(cents / 100);
}

function CollectionPromoNote({ collection }: { collection: PublicCollection }) {
  if (!collection.activePromoPricing) return null;

  return (
    <p className="text-xs text-emerald-700">
      Active promo {collection.activePromoPricing.code}: checkout price {formatCurrency(collection.activePromoPricing.finalAmountCents, collection.activePromoPricing.currencyCode)}.
    </p>
  );
}

function accessGrantLabel(grant?: PublicCollection["viewerPrimaryAccessGrant"]) {
  if (grant === "creator") return "Your collection";
  if (grant === "membership") return "Included with membership";
  if (grant === "bundle") return "Unlocked via bundle";
  if (grant === "direct_purchase") return "Owned via purchase";
  return "Owned";
}

function accessTypeBadge(collection: PublicCollection) {
  if (collection.accessType === "membership_only") return <Badge variant="secondary">Members Only</Badge>;
  if (collection.accessType === "premium_purchase") return <Badge>Premium Purchase · {formatCurrency(collection.priceCents)}</Badge>;
  return <Badge variant="outline">Public</Badge>;
}

function CollectionGrid({ title, description, collections, user }: { title: string; description: string; collections: PublicCollection[]; user: unknown }) {
  return (
    <section className="space-y-3">
      <div className="flex items-baseline justify-between gap-2">
        <div>
          <h2 className="text-xl font-semibold">{title}</h2>
          <p className="text-sm text-muted-foreground">{description}</p>
        </div>
        <span className="text-sm text-muted-foreground">{collections.length}</span>
      </div>

      {collections.length === 0 ? (
        <Card>
          <CardContent className="p-4 text-sm text-muted-foreground">Nothing here yet.</CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {collections.map((collection) => (
            <Card key={collection.id}>
              <CardHeader className="pb-2">
                <CardTitle className="text-lg">
                  <Link href={collection.route} className="underline underline-offset-2">{collection.name}</Link>
                </CardTitle>
                <CardDescription>{collection.description || "No description provided."}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="flex items-center gap-2">
                  <Avatar className="h-6 w-6">
                    <AvatarImage src={collection.creatorAvatar ?? undefined} alt={collection.creatorUsername ?? "creator"} />
                    <AvatarFallback>{initials(collection.creatorUsername)}</AvatarFallback>
                  </Avatar>
                  <span className="text-sm text-muted-foreground">by {collection.creatorUsername ? `@${collection.creatorUsername}` : "a creator"}</span>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Badge variant="secondary">{collection.itemsCount} drinks</Badge>
                  {accessTypeBadge(collection)}
                  {collection.ownedByViewer ? <Badge variant="secondary">{accessGrantLabel(collection.viewerPrimaryAccessGrant)}</Badge> : null}
                  {user && collection.isWishlisted ? <Badge variant="outline">Wishlisted</Badge> : null}
                  {collection.activePromoPricing ? <Badge variant="secondary">Promo {collection.activePromoPricing.code}</Badge> : null}
                </div>
                {collection.accessType === "membership_only" ? (
                  <p className="text-xs text-muted-foreground">Discoverable publicly, but full access comes from an active creator membership.</p>
                ) : null}
                <p className="text-xs text-muted-foreground">{collection.wishlistCount ?? 0} wishlists</p>
                <CollectionRatingSummary averageRating={collection.averageRating} reviewCount={collection.reviewCount} />
                <CollectionPromoNote collection={collection} />
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </section>
  );
}

export default function DrinkCollectionsExplorePage() {
  const { user } = useUser();

  const featuredQuery = useQuery<PublicCollectionsResponse>({
    queryKey: ["/api/drinks/collections/featured"],
    queryFn: async () => {
      const response = await fetch("/api/drinks/collections/featured", { credentials: "include" });
      if (!response.ok) throw new Error("Failed to load featured collections");
      return response.json();
    },
  });

  const exploreQuery = useQuery<PublicCollectionsResponse>({
    queryKey: ["/api/drinks/collections/explore"],
    queryFn: async () => {
      const response = await fetch("/api/drinks/collections/explore", { credentials: "include" });
      if (!response.ok) throw new Error("Failed to load public collections");
      return response.json();
    },
  });

  const bundlesQuery = useQuery<{ ok: boolean; bundles: PublicBundle[] }>({
    queryKey: ["/api/drinks/bundles/explore"],
    queryFn: async () => {
      const response = await fetch("/api/drinks/bundles/explore", { credentials: "include" });
      if (!response.ok) throw new Error("Failed to load public bundles");
      return response.json();
    },
  });

  const featuredCollections = featuredQuery.data?.collections ?? [];
  const exploreCollections = exploreQuery.data?.collections ?? [];
  const exploreBundles = bundlesQuery.data?.bundles ?? [];
  const publicCollections = exploreCollections.filter((collection) => collection.accessType === "public");
  const premiumCollections = exploreCollections.filter((collection) => collection.accessType === "premium_purchase");
  const memberOnlyCollections = exploreCollections.filter((collection) => collection.accessType === "membership_only");

  return (
    <div className="container mx-auto max-w-6xl space-y-6 px-4 py-8">
      <DrinksPlatformNav current="collections" />

      <section className="space-y-2">
        <h1 className="text-3xl font-bold">Explore Public Collections</h1>
        <p className="text-sm text-muted-foreground">Browse public discovery, one-off premium purchases, and member-only collection value from creators.</p>
        <div className="flex flex-wrap gap-2 pt-1">
          <Link href="/drinks/discover" className="text-sm underline underline-offset-2">Back to discover</Link>
          <span className="text-muted-foreground">·</span>
          <Link href="/drinks/alerts" className="text-sm underline underline-offset-2">Alerts</Link>
          <span className="text-muted-foreground">·</span>
          <Link href="/drinks/collections/purchased" className="text-sm underline underline-offset-2">My purchased collections</Link>
          <span className="text-muted-foreground">·</span>
          <Link href="/drinks/memberships" className="text-sm underline underline-offset-2">My memberships</Link>
        </div>
      </section>

      {featuredQuery.isLoading ? <p className="text-sm text-muted-foreground">Loading featured collections…</p> : null}
      {featuredQuery.isError ? <p className="text-sm text-destructive">Could not load featured collections right now.</p> : null}
      {featuredCollections.length > 0 ? (
        <CollectionGrid title="Featured Collections" description="A mix of public, premium purchase, and members-only collections." collections={featuredCollections} user={user} />
      ) : null}

      {exploreQuery.isLoading ? <p className="text-sm text-muted-foreground">Loading public collections…</p> : null}
      {exploreQuery.isError ? <p className="text-sm text-destructive">Could not load public collections right now.</p> : null}

      <CollectionGrid title="Members Only Collections" description="Publicly discoverable member perks that unlock through an active creator membership." collections={memberOnlyCollections} user={user} />
      <CollectionGrid title="Premium Purchase Collections" description="Collections that still use the one-off purchase, bundle, gift, and promo flow." collections={premiumCollections} user={user} />
      <CollectionGrid title="Free / Public Collections" description="Collections with no paywall and no membership lock." collections={publicCollections} user={user} />

      <section className="space-y-3">
        <div className="flex items-baseline justify-between gap-2">
          <h2 className="text-xl font-semibold">Premium Bundles</h2>
          <span className="text-sm text-muted-foreground">{exploreBundles.length} bundle offers</span>
        </div>

        {bundlesQuery.isLoading ? <p className="text-sm text-muted-foreground">Loading premium bundles…</p> : null}
        {bundlesQuery.isError ? <p className="text-sm text-destructive">Could not load bundle offers right now.</p> : null}
        {!bundlesQuery.isLoading && exploreBundles.length === 0 ? (
          <Card>
            <CardContent className="p-4 text-sm text-muted-foreground">No public bundle offers yet. Check back as creators package premium purchase collections together.</CardContent>
          </Card>
        ) : null}

        {exploreBundles.length > 0 ? (
          <div className="grid gap-4 md:grid-cols-2">
            {exploreBundles.map((bundle) => (
              <Card key={bundle.id}>
                <CardHeader className="pb-2">
                  <CardTitle className="text-lg">
                    <Link href={bundle.route} className="underline underline-offset-2">{bundle.name}</Link>
                  </CardTitle>
                  <CardDescription>{bundle.description || "Package multiple premium purchase collections together with one checkout."}</CardDescription>
                </CardHeader>
                <CardContent className="space-y-2">
                  <p className="text-sm text-muted-foreground">by {bundle.creatorUsername ? `@${bundle.creatorUsername}` : "a creator"}</p>
                  <div className="flex flex-wrap gap-2">
                    <Badge>Premium Bundle · {formatCurrency(bundle.priceCents)}</Badge>
                    <Badge variant="secondary">{bundle.itemsCount} collections</Badge>
                    {bundle.ownedByViewer ? <Badge variant="secondary">Owned</Badge> : null}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : null}
      </section>
    </div>
  );
}
