import { useEffect, useState } from "react";
import { Link, useRoute } from "wouter";

import DrinksPlatformNav from "@/components/drinks/DrinksPlatformNav";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type CollectionItem = {
  drinkSlug: string;
  addedAt: string;
  drink?: {
    slug: string;
    name: string;
    route: string;
    image?: string | null;
  } | null;
};

type Collection = {
  id: string;
  name: string;
  description?: string | null;
  isPublic: boolean;
  userId: string;
  itemsCount: number;
  items: CollectionItem[];
};

export default function DrinkCollectionDetailPage() {
  const [matched, params] = useRoute<{ id: string }>("/drinks/collections/:id");
  const collectionId = matched ? String(params.id ?? "") : "";
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [statusCode, setStatusCode] = useState<number | null>(null);
  const [collection, setCollection] = useState<Collection | null>(null);

  useEffect(() => {
    if (!collectionId) return;

    setLoading(true);
    setError("");
    setStatusCode(null);
    fetch(`/api/drinks/collections/${encodeURIComponent(collectionId)}`, { credentials: "include" })
      .then(async (res) => {
        if (!res.ok) {
          const payload = await res.json().catch(() => null);
          setStatusCode(res.status);
          throw new Error(payload?.error || `Failed to load collection (${res.status})`);
        }
        return res.json();
      })
      .then((payload) => setCollection(payload?.collection ?? null))
      .catch((err) => {
        setCollection(null);
        setError(err instanceof Error ? err.message : "Failed to load collection");
      })
      .finally(() => setLoading(false));
  }, [collectionId]);

  return (
    <div className="container mx-auto px-4 py-8 max-w-5xl space-y-6">
      <DrinksPlatformNav current="collections" />

      {loading ? <p className="text-muted-foreground">Loading collection…</p> : null}
      {!loading && error ? (
        <p className="text-destructive">
          {statusCode === 404 ? "Collection not found." : statusCode === 401 ? "Please sign in to view this collection." : statusCode === 403 ? "This collection is private." : error}
        </p>
      ) : null}
      {!loading && error && import.meta.env.DEV ? <p className="text-xs text-muted-foreground break-all">{error}</p> : null}

      {!loading && !error && collection ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-2xl flex flex-wrap items-center gap-2">
              {collection.name}
              <Badge variant="outline">{collection.isPublic ? "Public" : "Private"}</Badge>
              <Badge variant="secondary">{collection.itemsCount} drinks</Badge>
            </CardTitle>
            {collection.description ? <p className="text-sm text-muted-foreground">{collection.description}</p> : null}
          </CardHeader>
          <CardContent className="space-y-3">
            {collection.items.length === 0 ? <p className="text-sm text-muted-foreground">No drinks in this collection yet.</p> : null}
            {collection.items.map((item) => (
              <div key={`${collection.id}-${item.drinkSlug}`} className="border rounded-md p-3">
                <Link href={item.drink?.route ?? `/drinks/recipe/${encodeURIComponent(item.drinkSlug)}`} className="font-medium underline underline-offset-2">
                  {item.drink?.name ?? item.drinkSlug}
                </Link>
                <p className="text-xs text-muted-foreground">Added {new Date(item.addedAt).toLocaleDateString()}</p>
              </div>
            ))}
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
