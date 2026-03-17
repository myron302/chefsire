import { useEffect, useState } from "react";
import { Link } from "wouter";

import DrinksPlatformNav from "@/components/drinks/DrinksPlatformNav";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
  itemsCount: number;
  items: CollectionItem[];
};

export default function DrinkCollectionsPage() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [isAuthRequired, setIsAuthRequired] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [saving, setSaving] = useState(false);
  const [collections, setCollections] = useState<Collection[]>([]);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");

  const loadCollections = async () => {
    setLoading(true);
    setIsAuthRequired(false);
    setLoadError("");
    try {
      const res = await fetch("/api/drinks/collections/mine", { credentials: "include" });
      if (!res.ok) {
        if (res.status === 401) {
          setIsAuthRequired(true);
          setCollections([]);
          return;
        }
        throw new Error(`Failed to load collections (${res.status})`);
      }
      const payload = await res.json();
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
        body: JSON.stringify({ name: name.trim(), description: description.trim() || null, isPublic: false }),
      });

      if (!res.ok) {
        if (res.status === 401) {
          setIsAuthRequired(true);
          toast({ title: "Sign in required", description: "Please sign in to create collections." });
          return;
        }
        const payload = await res.json().catch(() => null);
        throw new Error(payload?.error || "Failed to create");
      }
      setName("");
      setDescription("");
      await loadCollections();
      toast({ title: "Collection created" });
    } catch (error) {
      toast({ title: "Could not create collection", description: import.meta.env.DEV ? (error instanceof Error ? error.message : "Unknown error") : undefined, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const removeDrink = async (collectionId: string, slug: string) => {
    try {
      const res = await fetch(`/api/drinks/collections/${encodeURIComponent(collectionId)}/items/${encodeURIComponent(slug)}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!res.ok) {
        if (res.status === 401) {
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
            <Button onClick={createCollection} disabled={saving || !name.trim()}>
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
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {collection.description ? <p className="text-sm text-muted-foreground">{collection.description}</p> : null}
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
