import { useEffect, useMemo, useState } from "react";
import { Link } from "wouter";

import DrinksPlatformNav from "@/components/drinks/DrinksPlatformNav";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";

type CollectionAccessType = "public" | "premium_purchase" | "membership_only";

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
  accessType: CollectionAccessType;
  isPremium: boolean;
  priceCents: number;
  itemsCount: number;
  items: CollectionItem[];
};

type CollectionSettingsMap = Record<string, { accessType: CollectionAccessType; price: string }>;

function isAuthFailureStatus(status: number): boolean {
  return status === 401 || status === 403;
}

function accessTypeLabel(accessType: CollectionAccessType) {
  if (accessType === "membership_only") return "Members Only";
  if (accessType === "premium_purchase") return "Premium Purchase";
  return "Public";
}

function accessTypeBadgeVariant(accessType: CollectionAccessType): "default" | "secondary" | "outline" {
  if (accessType === "membership_only") return "secondary";
  if (accessType === "premium_purchase") return "default";
  return "outline";
}

function formatPrice(priceCents: number) {
  return `$${(priceCents / 100).toFixed(2)}`;
}

export default function DrinkCollectionsPage() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [isAuthRequired, setIsAuthRequired] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [backendUnavailable, setBackendUnavailable] = useState(false);
  const [saving, setSaving] = useState(false);
  const [updatingCollectionId, setUpdatingCollectionId] = useState<string | null>(null);
  const [collections, setCollections] = useState<Collection[]>([]);
  const [collectionSettings, setCollectionSettings] = useState<CollectionSettingsMap>({});
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [accessType, setAccessType] = useState<CollectionAccessType>("public");
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
      const nextCollections = Array.isArray(payload?.collections) ? payload.collections as Collection[] : [];
      setCollections(nextCollections);
      setCollectionSettings(Object.fromEntries(nextCollections.map((collection) => [
        collection.id,
        {
          accessType: collection.accessType ?? (collection.isPremium ? "premium_purchase" : "public"),
          price: collection.priceCents ? (collection.priceCents / 100).toFixed(2) : "4.99",
        },
      ])));
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

  const collectionCounts = useMemo(() => ({
    public: collections.filter((collection) => collection.accessType === "public").length,
    premium_purchase: collections.filter((collection) => collection.accessType === "premium_purchase").length,
    membership_only: collections.filter((collection) => collection.accessType === "membership_only").length,
  }), [collections]);

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
          accessType,
          priceCents: accessType === "premium_purchase" ? Math.max(1, Math.round(Number(price || 0) * 100)) : 0,
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
      setAccessType("public");
      setPrice("4.99");
      await loadCollections();
      toast({ title: "Collection created" });
    } catch (error) {
      toast({
        title: "Could not create collection",
        description: import.meta.env.DEV ? (error instanceof Error ? error.message : "Unknown error") : undefined,
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const updateCollectionAccess = async (collection: Collection) => {
    const current = collectionSettings[collection.id];
    if (!current) return;

    setUpdatingCollectionId(collection.id);
    try {
      const res = await fetch(`/api/drinks/collections/${encodeURIComponent(collection.id)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          accessType: current.accessType,
          priceCents: current.accessType === "premium_purchase" ? Math.max(1, Math.round(Number(current.price || 0) * 100)) : 0,
        }),
      });

      const payload = await res.json().catch(() => null);
      if (!res.ok) {
        throw new Error(payload?.error || "Failed to update collection access");
      }

      await loadCollections();
      toast({ title: `${collection.name} updated`, description: `${accessTypeLabel(current.accessType)} access saved.` });
    } catch (error) {
      toast({
        title: "Could not update access",
        description: error instanceof Error ? error.message : "Unknown error",
        variant: "destructive",
      });
    } finally {
      setUpdatingCollectionId(null);
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
    } catch {
      toast({ title: "Could not remove drink", variant: "destructive" });
    }
  };

  return (
    <div className="container mx-auto max-w-5xl space-y-6 px-4 py-8">
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
            <div className="space-y-2 rounded-md border p-3">
              <Label htmlFor="collection-access-type">Collection access</Label>
              <select
                id="collection-access-type"
                value={accessType}
                onChange={(event) => setAccessType(event.target.value as CollectionAccessType)}
                className="w-full rounded-md border bg-background px-3 py-2 text-sm"
              >
                <option value="public">Public</option>
                <option value="premium_purchase">Premium Purchase</option>
                <option value="membership_only">Members Only</option>
              </select>
              <p className="text-xs text-muted-foreground">
                Public is open to everyone, Premium Purchase uses checkout, and Members Only is unlocked by an active creator membership.
              </p>
            </div>
            {accessType === "premium_purchase" ? (
              <div className="space-y-2">
                <Label htmlFor="price">Price (USD)</Label>
                <Input id="price" type="number" min="0.5" step="0.5" value={price} onChange={(event) => setPrice(event.target.value)} />
              </div>
            ) : (
              <div className="rounded-md border border-dashed p-3 text-xs text-muted-foreground">
                {accessType === "membership_only"
                  ? "Members Only collections do not show one-off collection pricing or direct checkout buttons."
                  : "Public collections are open without a paywall or membership lock."}
              </div>
            )}
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
          <div className="flex flex-wrap gap-2 text-sm text-muted-foreground">
            <span>{collectionCounts.public} public</span>
            <span>·</span>
            <span>{collectionCounts.premium_purchase} premium purchase</span>
            <span>·</span>
            <span>{collectionCounts.membership_only} members only</span>
          </div>
          {loading ? <p className="text-sm text-muted-foreground">Loading collections…</p> : null}
          {!loading && isAuthRequired ? <p className="text-sm text-muted-foreground">Sign in to view and manage your collections.</p> : null}
          {!loading && !isAuthRequired && loadError ? <p className="text-sm text-destructive">{loadError}</p> : null}
          {!loading && !isAuthRequired && backendUnavailable ? <p className="text-sm text-muted-foreground">Collections are temporarily unavailable on this server.</p> : null}
          {!loading && !isAuthRequired && !loadError && collections.length === 0 ? <p className="text-sm text-muted-foreground">No collections yet.</p> : null}

          {collections.map((collection) => {
            const current = collectionSettings[collection.id] ?? {
              accessType: collection.accessType,
              price: collection.priceCents ? (collection.priceCents / 100).toFixed(2) : "4.99",
            };

            return (
              <Card key={collection.id}>
                <CardHeader>
                  <CardTitle className="flex flex-wrap items-center gap-2 text-lg">
                    <Link href={`/drinks/collections/${encodeURIComponent(collection.id)}`} className="underline underline-offset-2">
                      {collection.name}
                    </Link>
                    <Badge variant="secondary">{collection.itemsCount} drinks</Badge>
                    <Badge variant="outline">{collection.isPublic ? "Public" : "Private"}</Badge>
                    <Badge variant={accessTypeBadgeVariant(collection.accessType)}>
                      {accessTypeLabel(collection.accessType)}
                      {collection.accessType === "premium_purchase" ? ` · ${formatPrice(collection.priceCents)}` : ""}
                    </Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {collection.description ? <p className="text-sm text-muted-foreground">{collection.description}</p> : null}
                  <div className="grid gap-3 rounded-md border p-3 md:grid-cols-[minmax(0,1fr)_180px_auto] md:items-end">
                    <div className="space-y-2">
                      <Label htmlFor={`access-type-${collection.id}`}>Access mode</Label>
                      <select
                        id={`access-type-${collection.id}`}
                        value={current.accessType}
                        onChange={(event) => setCollectionSettings((existing) => ({
                          ...existing,
                          [collection.id]: {
                            ...current,
                            accessType: event.target.value as CollectionAccessType,
                          },
                        }))}
                        className="w-full rounded-md border bg-background px-3 py-2 text-sm"
                      >
                        <option value="public">Public</option>
                        <option value="premium_purchase">Premium Purchase</option>
                        <option value="membership_only">Members Only</option>
                      </select>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor={`price-${collection.id}`}>Price</Label>
                      <Input
                        id={`price-${collection.id}`}
                        type="number"
                        min="0.5"
                        step="0.5"
                        value={current.price}
                        disabled={current.accessType !== "premium_purchase"}
                        onChange={(event) => setCollectionSettings((existing) => ({
                          ...existing,
                          [collection.id]: {
                            ...current,
                            price: event.target.value,
                          },
                        }))}
                      />
                    </div>
                    <Button variant="outline" size="sm" onClick={() => void updateCollectionAccess(collection)} disabled={updatingCollectionId === collection.id}>
                      {updatingCollectionId === collection.id ? "Saving…" : "Save access"}
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {current.accessType === "membership_only"
                      ? "Members Only hides one-off collection pricing and sends buyers toward the creator membership path."
                      : current.accessType === "premium_purchase"
                        ? "Premium Purchase keeps the one-off checkout flow active for this collection."
                        : "Public removes both the paywall and membership lock."}
                  </p>
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
            );
          })}
        </CardContent>
      </Card>
    </div>
  );
}
