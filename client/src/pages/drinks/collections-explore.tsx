import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";

import DrinksPlatformNav from "@/components/drinks/DrinksPlatformNav";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

interface PublicCollectionItem {
  id: string;
  drinkSlug: string;
  drinkName: string;
  image: string | null;
  route: string;
  remixedFromSlug: string | null;
}

interface PublicCollection {
  id: string;
  name: string;
  description: string | null;
  isPublic: boolean;
  isPremium: boolean;
  priceCents: number;
  userId: string;
  creatorUsername: string | null;
  creatorAvatar: string | null;
  itemsCount: number;
  coverImage: string | null;
  updatedAt: string;
  route: string;
  items: PublicCollectionItem[];
}

interface PublicCollectionsResponse {
  ok: boolean;
  collections: PublicCollection[];
}

function initials(value: string | null): string {
  if (!value) return "DR";
  return value.slice(0, 2).toUpperCase();
}

export default function DrinkCollectionsExplorePage() {
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

  const featuredCollections = featuredQuery.data?.collections ?? [];
  const exploreCollections = exploreQuery.data?.collections ?? [];

  const featuredCountLabel = featuredQuery.isSuccess ? `${featuredCollections.length} featured` : "—";
  const exploreCountLabel = exploreQuery.isSuccess ? `${exploreCollections.length} collections` : "—";
  const premiumCollections = exploreCollections.filter((collection) => collection.isPremium);

  return (
    <div className="container mx-auto max-w-6xl space-y-6 px-4 py-8">
      <DrinksPlatformNav current="collections" />

      <section className="space-y-2">
        <h1 className="text-3xl font-bold">Explore Public Collections</h1>
        <p className="text-sm text-muted-foreground">Discover featured collection picks and browse what creators are curating publicly.</p>
      </section>

      <section className="space-y-3">
        <div className="flex items-baseline justify-between gap-2">
          <h2 className="text-xl font-semibold">Featured Collections</h2>
          <span className="text-sm text-muted-foreground">{featuredCountLabel}</span>
        </div>

        {featuredQuery.isLoading ? <p className="text-sm text-muted-foreground">Loading featured collections…</p> : null}

        {featuredQuery.isError ? <p className="text-sm text-destructive">Could not load featured collections right now.</p> : null}

        {featuredQuery.isSuccess && featuredCollections.length === 0 ? (
          <Card>
            <CardContent className="p-4 text-sm text-muted-foreground">No featured public collections yet.</CardContent>
          </Card>
        ) : null}

        {featuredQuery.isSuccess && featuredCollections.length > 0 ? (
          <div className="grid gap-4 md:grid-cols-2">
            {featuredCollections.map((collection) => (
              <Card key={`featured-${collection.id}`}>
                <CardHeader className="pb-3">
                  <CardTitle>
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
                    <span className="text-sm text-muted-foreground">
                      by {collection.creatorUsername ? `@${collection.creatorUsername}` : "a creator"}
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Badge variant="secondary">{collection.itemsCount} drinks</Badge>
                    {collection.isPremium ? <Badge>Premium · ${(collection.priceCents / 100).toFixed(2)}</Badge> : null}
                    <Badge variant="outline">Updated {new Date(collection.updatedAt).toLocaleDateString()}</Badge>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : null}
      </section>


      <section className="space-y-3">
        <div className="flex items-baseline justify-between gap-2">
          <h2 className="text-xl font-semibold">Premium Collections</h2>
          <span className="text-sm text-muted-foreground">{premiumCollections.length} premium</span>
        </div>

        {exploreQuery.isLoading ? <p className="text-sm text-muted-foreground">Loading premium collections…</p> : null}
        {exploreQuery.isSuccess && premiumCollections.length === 0 ? (
          <Card>
            <CardContent className="p-4 text-sm text-muted-foreground">No premium collections yet. Check back as creators publish more.</CardContent>
          </Card>
        ) : null}

        {premiumCollections.length > 0 ? (
          <div className="grid gap-4 md:grid-cols-2">
            {premiumCollections.slice(0, 6).map((collection) => (
              <Card key={`premium-${collection.id}`}>
                <CardHeader className="pb-2">
                  <CardTitle className="text-lg">
                    <Link href={collection.route} className="underline underline-offset-2">{collection.name}</Link>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  <p className="text-sm text-muted-foreground">by {collection.creatorUsername ? `@${collection.creatorUsername}` : "a creator"}</p>
                  <Badge>Premium Collection · ${(collection.priceCents / 100).toFixed(2)}</Badge>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : null}
      </section>

      <section className="space-y-3">
        <div className="flex items-baseline justify-between gap-2">
          <h2 className="text-xl font-semibold">All Public Collections</h2>
          <span className="text-sm text-muted-foreground">{exploreCountLabel}</span>
        </div>

        {exploreQuery.isLoading ? <p className="text-sm text-muted-foreground">Loading public collections…</p> : null}
        {exploreQuery.isError ? <p className="text-sm text-destructive">Could not load public collections right now.</p> : null}
        {exploreQuery.isSuccess && exploreCollections.length === 0 ? (
          <Card>
            <CardContent className="p-4 text-sm text-muted-foreground">No public collections published yet.</CardContent>
          </Card>
        ) : null}

        {exploreQuery.isSuccess && exploreCollections.length > 0 ? (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {exploreCollections.map((collection) => (
              <Card key={collection.id}>
                <CardHeader className="pb-2">
                  <CardTitle className="text-lg">
                    <Link href={collection.route} className="underline underline-offset-2">{collection.name}</Link>
                  </CardTitle>
                  <CardDescription>{collection.description || "No description provided."}</CardDescription>
                </CardHeader>
                <CardContent className="space-y-2">
                  <p className="text-xs text-muted-foreground">Creator: {collection.creatorUsername ? `@${collection.creatorUsername}` : "Unknown"}</p>
                  <Badge variant="secondary">{collection.itemsCount} drinks</Badge>
                    {collection.isPremium ? <Badge>Premium · ${(collection.priceCents / 100).toFixed(2)}</Badge> : null}
                </CardContent>
              </Card>
            ))}
          </div>
        ) : null}
      </section>
    </div>
  );
}
