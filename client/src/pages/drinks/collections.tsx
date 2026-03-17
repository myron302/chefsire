import { useEffect, useState } from "react";
import { Link } from "wouter";

import DrinksPlatformNav from "@/components/drinks/DrinksPlatformNav";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";

type CollectionItem = {
  drinkSlug: string;
  addedAt: string;
  drink?: {
    slug: string;
    name: string;
    route: string;
  } | null;
};

type Collection = {
  id: string;
  name: string;
  description?: string | null;
  isPublic: boolean;
  isPremium: boolean;
  priceCents: number;
  itemsCount: number;
  items: CollectionItem[];
};

function isAuthFailureStatus(status: number): boolean {
  return status === 401 || status === 403;
}

export default function DrinkCollectionsPage() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [isAuthRequired, setIsAuthRequired] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [backendUnavailable, setBackendUnavailable] = useState(false);
  const [saving, setSaving] = useState(false);
  const [collections, setCollections] = useState<Collection[]>([]);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [isPremium, setIsPremium] = useState(false);
  const [price, setPrice] = useState("4.99");

  const loadCollections = async () => {
    setLoading(true);
    setIsAuthRequired(false);
    setLoadError("");
    setBackendUnavailable(false);
    try {
      const res = await fetch("/api/drinks/collections/mine", { credentials: "include" });
      if (!res.ok) {
        const payload = await res.json().catch(() => null);
        if (isAuthFailureStatus(res.status)) {
          setIsAuthRequired(true);
          setCollections([]);
          return;
        }

        const code = payload?.code as string | undefined;
        if (code === "DB_UNAVAILABLE" || code === "COLLECTIONS_TABLE_MISSING" || code === "COLLECTIONS_SCHEMA_MISMATCH") {
          setBackendUnavailable(true);
        }
        throw new Error(payload?.error || `Failed to load collections (${res.status})`);
      }
      const payload = await res.json();
      if (payload?.ok === false) {
        throw new Error(payload?.error || "Failed to load collections");
      }

      if (import.meta.env.DEV && !Array.isArray(payload?.collections)) {
        console.warn("[drinks/collections] Unexpected collections payload shape", payload);
      }

      setCollections(Array.isArray(payload?.collections) ? payload.collections : []);
    } catch (error) {
      setCollections([]);
      setLoadError("Could not load collections right now.");
      if (import.meta.env.DEV) {
        console.error("[drinks/collections] Failed to load collections", error);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadCollections();
  }, []);

  const createCollection = async () => {
    if (!name.trim()) return;
    setSaving(true);
    try {
      const res = await fetch("/api/drinks/collections", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          name: name.trim(),
          description: description.trim() || null,
          isPublic: false,
          isPremium,
          priceCents: isPremium ? Math.max(1, Math.round(Number(price || 0) * 100)) : 0,
        }),
      });

      if (!res.ok) {
        if (isAuthFailureStatus(res.status)) {
          setIsAuthRequired(true);
          toast({ title: "Sign in required", description: "Please sign in to create collections." });
          return;
        }
        const payload = await res.json().catch(() => null);
        throw new Error(payload?.error || "Failed to create");
      }
      setName("");
      setDescription("");
      setIsPremium(false);
      setPrice("4.99");
      await loadCollections();
      toast({ title: "Collection created" });
    } catch (error) {
      toast({ title: "Could not create collection", description: import.meta.env.DEV ? (error instanceof Error ? error.message : "Unknown error") : undefined, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };


  const togglePremium = async (collection: Collection) => {
    try {
      const nextIsPremium = !collection.isPremium;
      const res = await fetch(`/api/drinks/collections/${encodeURIComponent(collection.id)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          isPremium: nextIsPremium,
          priceCents: nextIsPremium ? Math.max(1, collection.priceCents || 499) : 0,
        }),
      });

      if (!res.ok) throw new Error("Failed to update premium settings");
      await loadCollections();
      toast({ title: nextIsPremium ? "Collection marked premium" : "Collection set to free" });
    } catch {
      toast({ title: "Could not update premium settings", variant: "destructive" });
    }
  };

  const removeDrink = async (collectionId: string, slug: string) => {
    try {
      const res = await fetch(`/api/drinks/collections/${encodeURIComponent(collectionId)}/items/${encodeURIComponent(slug)}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!res.ok) {
        if (isAuthFailureStatus(res.status)) {
          setIsAuthRequired(true);
          toast({ title: "Sign in required", description: "Please sign in to remove drinks from collections." });
          return;
        }
        throw new Error("Failed remove");
      }
      await loadCollections();
    } catch (error) {
      toast({ title: "Could not remove drink", variant: "destructive" });
    }
  };

  return (
    <div className="container mx-auto px-4 py-8 max-w-5xl space-y-6">
      <DrinksPlatformNav current="collections" />

      {!isAuthRequired ? (
        <Card>
          <CardHeader>
            <CardTitle>Create Collection</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-2">
              <Label htmlFor="name">Name</Label>
              <Input id="name" value={name} onChange={(event) => setName(event.target.value)} placeholder="My favorite remixes" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="description">Description (optional)</Label>
              <Input id="description" value={description} onChange={(event) => setDescription(event.target.value)} placeholder="What this collection is for" />
            </div>
            <div className="flex items-center justify-between rounded-md border p-3">
              <div>
                <p className="text-sm font-medium">Premium collection</p>
                <p className="text-xs text-muted-foreground">Add a subtle premium badge and price on public pages.</p>
              </div>
              <Switch checked={isPremium} onCheckedChange={setIsPremium} />
            </div>
            {isPremium ? (
              <div className="space-y-2">
                <Label htmlFor="price">Price (USD)</Label>
                <Input id="price" type="number" min="0.5" step="0.5" value={price} onChange={(event) => setPrice(event.target.value)} />
              </div>
            ) : null}
            <Button onClick={createCollection} disabled={saving || !name.trim() || backendUnavailable}>
              Create collection
            </Button>
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>Your Collections ({collections.length})</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {loading ? <p className="text-sm text-muted-foreground">Loading collections…</p> : null}
          {!loading && isAuthRequired ? <p className="text-sm text-muted-foreground">Sign in to view and manage your collections.</p> : null}
          {!loading && !isAuthRequired && loadError ? <p className="text-sm text-destructive">{loadError}</p> : null}
          {!loading && !isAuthRequired && backendUnavailable ? <p className="text-sm text-muted-foreground">Collections are temporarily unavailable on this server.</p> : null}
          {!loading && !isAuthRequired && !loadError && collections.length === 0 ? <p className="text-sm text-muted-foreground">No collections yet.</p> : null}

          {collections.map((collection) => (
            <Card key={collection.id}>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Link href={`/drinks/collections/${encodeURIComponent(collection.id)}`} className="underline underline-offset-2">
                    {collection.name}
                  </Link>
                  <Badge variant="secondary">{collection.itemsCount} drinks</Badge>
                  <Badge variant="outline">{collection.isPublic ? "Public" : "Private"}</Badge>
                  {collection.isPremium ? <Badge>Premium Collection · ${(collection.priceCents / 100).toFixed(2)}</Badge> : null}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {collection.description ? <p className="text-sm text-muted-foreground">{collection.description}</p> : null}
                <div className="flex items-center gap-2">
                  <Button variant="outline" size="sm" onClick={() => void togglePremium(collection)}>
                    {collection.isPremium ? "Mark as free" : "Mark as premium"}
                  </Button>
                </div>
                {collection.items.length === 0 ? <p className="text-sm text-muted-foreground">No drinks in this collection yet.</p> : null}
                {collection.items.slice(0, 4).map((item) => (
                  <div key={`${collection.id}-${item.drinkSlug}`} className="flex items-center justify-between gap-2 text-sm">
                    <Link href={item.drink?.route ?? `/drinks/recipe/${encodeURIComponent(item.drinkSlug)}`} className="underline underline-offset-2">
                      {item.drink?.name ?? item.drinkSlug}
                    </Link>
                    <Button variant="ghost" size="sm" onClick={() => void removeDrink(collection.id, item.drinkSlug)}>
                      Remove
                    </Button>
                  </div>
                ))}
              </CardContent>
            </Card>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
