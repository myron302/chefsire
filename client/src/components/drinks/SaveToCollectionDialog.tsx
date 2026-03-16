import { useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";

type CollectionItem = {
  id: string;
  name: string;
  description?: string | null;
  isPublic: boolean;
};

type Props = {
  drinkSlug: string;
};

export default function SaveToCollectionDialog({ drinkSlug }: Props) {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [collections, setCollections] = useState<CollectionItem[]>([]);
  const [selectedCollectionId, setSelectedCollectionId] = useState<string>("");
  const [newCollectionName, setNewCollectionName] = useState("");
  const [newCollectionDescription, setNewCollectionDescription] = useState("");
  const [newCollectionPublic, setNewCollectionPublic] = useState(false);

  const selectedCollection = useMemo(
    () => collections.find((collection) => collection.id === selectedCollectionId) ?? null,
    [collections, selectedCollectionId]
  );

  const loadCollections = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/drinks/collections/mine", { credentials: "include" });
      if (!res.ok) {
        throw new Error("Unable to load collections");
      }

      const payload = await res.json();
      const nextCollections = Array.isArray(payload?.collections) ? payload.collections : [];
      setCollections(nextCollections);
      setSelectedCollectionId((current) => (current ? current : nextCollections[0]?.id ?? ""));
    } catch (error) {
      setCollections([]);
      toast({ title: "Please sign in to save drinks", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const addToCollection = async (collectionId: string) => {
    const res = await fetch(`/api/drinks/collections/${encodeURIComponent(collectionId)}/items`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ drinkSlug }),
    });

    if (!res.ok) {
      throw new Error("Unable to save drink");
    }
  };

  const onSave = async () => {
    if (!selectedCollectionId) {
      toast({ title: "Choose a collection first", variant: "destructive" });
      return;
    }

    setLoading(true);
    try {
      await addToCollection(selectedCollectionId);
      toast({ title: `Saved to ${selectedCollection?.name ?? "collection"}` });
      setOpen(false);
    } catch (error) {
      toast({ title: "Could not save drink", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const createAndSave = async () => {
    if (!newCollectionName.trim()) {
      toast({ title: "Collection name is required", variant: "destructive" });
      return;
    }

    setLoading(true);
    try {
      const createRes = await fetch("/api/drinks/collections", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          name: newCollectionName.trim(),
          description: newCollectionDescription.trim() || null,
          isPublic: newCollectionPublic,
        }),
      });

      if (!createRes.ok) throw new Error("Unable to create collection");
      const createdPayload = await createRes.json();
      const createdId = createdPayload?.collection?.id as string | undefined;
      if (!createdId) throw new Error("No collection id returned");

      await addToCollection(createdId);
      toast({ title: "Collection created and drink saved" });
      setNewCollectionName("");
      setNewCollectionDescription("");
      setNewCollectionPublic(false);
      setOpen(false);
    } catch (error) {
      toast({ title: "Could not create collection", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        setOpen(nextOpen);
        if (nextOpen) {
          void loadCollections();
        }
      }}
    >
      <DialogTrigger asChild>
        <Button variant="outline">Save to Collection</Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Save to Collection</DialogTitle>
          <DialogDescription>Add this drink to one of your collections, or create a new one.</DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <p className="text-sm font-medium">Your collections</p>
          {loading ? <p className="text-sm text-muted-foreground">Loading collections…</p> : null}
          {!loading && collections.length === 0 ? (
            <p className="text-sm text-muted-foreground">No collections yet. Create your first one below.</p>
          ) : null}
          {collections.map((collection) => (
            <button
              key={collection.id}
              className={`w-full text-left border rounded-md p-3 ${selectedCollectionId === collection.id ? "border-primary" : "border-border"}`}
              onClick={() => setSelectedCollectionId(collection.id)}
              type="button"
            >
              <p className="font-medium">{collection.name}</p>
              {collection.description ? <p className="text-xs text-muted-foreground">{collection.description}</p> : null}
            </button>
          ))}
        </div>

        <DialogFooter className="sm:justify-between gap-2">
          <Button type="button" variant="secondary" onClick={onSave} disabled={loading || !selectedCollectionId}>
            Save to Selected
          </Button>
        </DialogFooter>

        <div className="space-y-3 border-t pt-4">
          <p className="text-sm font-medium">Create new collection</p>
          <div className="space-y-2">
            <Label htmlFor="collection-name">Name</Label>
            <Input
              id="collection-name"
              value={newCollectionName}
              onChange={(event) => setNewCollectionName(event.target.value)}
              placeholder="Favorites, Summer Drinks, Weekend Remixes…"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="collection-description">Description (optional)</Label>
            <Input
              id="collection-description"
              value={newCollectionDescription}
              onChange={(event) => setNewCollectionDescription(event.target.value)}
              placeholder="Short note about this collection"
            />
          </div>
          <label className="flex items-center gap-2 text-sm">
            <Checkbox checked={newCollectionPublic} onCheckedChange={(value) => setNewCollectionPublic(Boolean(value))} />
            Make this collection public
          </label>
          <Button type="button" onClick={createAndSave} disabled={loading || !newCollectionName.trim()}>
            Create + Save Drink
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
