import * as React from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "wouter";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";


type CreatorCollection = {
  id: string;
  name: string;
  isPublic: boolean;
  isPremium: boolean;
  priceCents: number;
};

type BundleCollection = {
  id: string;
  name: string;
  route: string;
  priceCents: number;
};

type CreatorBundle = {
  id: string;
  slug: string;
  name: string;
  description?: string | null;
  isPublic: boolean;
  isPremium: boolean;
  priceCents: number;
  route: string;
  itemsCount: number;
  includedCollections: BundleCollection[];
};

function formatCurrency(cents: number) {
  return new Intl.NumberFormat(undefined, { style: "currency", currency: "USD" }).format(cents / 100);
}

async function parseJson(response: Response) {
  const payload = await response.json().catch(() => null);
  if (!response.ok) throw new Error(payload?.error || `Request failed (${response.status})`);
  return payload;
}

export default function CreatorBundlesSection() {
  const queryClient = useQueryClient();
  const [name, setName] = React.useState("");
  const [description, setDescription] = React.useState("");
  const [price, setPrice] = React.useState("14.99");
  const [isPublic, setIsPublic] = React.useState(false);
  const [itemSelections, setItemSelections] = React.useState<Record<string, string>>( {} );

  const bundlesQuery = useQuery<{ ok: boolean; bundles: CreatorBundle[] }>({
    queryKey: ["/api/drinks/bundles/mine"],
    queryFn: async () => parseJson(await fetch("/api/drinks/bundles/mine", { credentials: "include" })),
  });

  const collectionsQuery = useQuery<{ ok: boolean; collections: CreatorCollection[] }>({
    queryKey: ["/api/drinks/collections/mine", "bundle-picker"],
    queryFn: async () => parseJson(await fetch("/api/drinks/collections/mine", { credentials: "include" })),
  });

  const refresh = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["/api/drinks/bundles/mine"] }),
      queryClient.invalidateQueries({ queryKey: ["/api/drinks/bundles/explore"] }),
      queryClient.invalidateQueries({ queryKey: ["/api/drinks/collections/explore"] }),
    ]);
  };

  const createBundleMutation = useMutation({
    mutationFn: async () => parseJson(await fetch("/api/drinks/bundles", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({
        name: name.trim(),
        description: description.trim() || null,
        isPublic,
        isPremium: true,
        priceCents: Math.max(100, Math.round(Number(price || 0) * 100)),
      }),
    })),
    onSuccess: async () => {
      setName("");
      setDescription("");
      setPrice("14.99");
      setIsPublic(false);
      await refresh();
    },
  });

  const patchBundleMutation = useMutation({
    mutationFn: async ({ bundleId, body }: { bundleId: string; body: Record<string, unknown> }) => parseJson(await fetch(`/api/drinks/bundles/${encodeURIComponent(bundleId)}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify(body),
    })),
    onSuccess: refresh,
  });

  const deleteBundleMutation = useMutation({
    mutationFn: async (bundleId: string) => parseJson(await fetch(`/api/drinks/bundles/${encodeURIComponent(bundleId)}`, {
      method: "DELETE",
      credentials: "include",
    })),
    onSuccess: refresh,
  });

  const addItemMutation = useMutation({
    mutationFn: async ({ bundleId, collectionId }: { bundleId: string; collectionId: string }) => parseJson(await fetch(`/api/drinks/bundles/${encodeURIComponent(bundleId)}/items`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ collectionId }),
    })),
    onSuccess: async () => {
      setItemSelections({});
      await refresh();
    },
  });

  const removeItemMutation = useMutation({
    mutationFn: async ({ bundleId, collectionId }: { bundleId: string; collectionId: string }) => parseJson(await fetch(`/api/drinks/bundles/${encodeURIComponent(bundleId)}/items/${encodeURIComponent(collectionId)}`, {
      method: "DELETE",
      credentials: "include",
    })),
    onSuccess: refresh,
  });

  const premiumCollections = (collectionsQuery.data?.collections ?? []).filter((collection) => collection.isPremium);
  const bundles = bundlesQuery.data?.bundles ?? [];

  return (
    <Card id="bundles">
      <CardHeader>
        <CardTitle>Bundles</CardTitle>
        <CardDescription>Create premium bundle offers that package multiple premium collections into one Square checkout.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid gap-3 rounded-lg border p-4 md:grid-cols-2">
          <div className="space-y-2 md:col-span-2">
            <Label htmlFor="bundle-name">Bundle name</Label>
            <Input id="bundle-name" value={name} onChange={(event) => setName(event.target.value)} placeholder="Weekend cocktail starter pack" />
          </div>
          <div className="space-y-2 md:col-span-2">
            <Label htmlFor="bundle-description">Description</Label>
            <Input id="bundle-description" value={description} onChange={(event) => setDescription(event.target.value)} placeholder="Package related premium collections together in one offer." />
          </div>
          <div className="space-y-2">
            <Label htmlFor="bundle-price">Bundle price (USD)</Label>
            <Input id="bundle-price" type="number" min="1" step="0.01" value={price} onChange={(event) => setPrice(event.target.value)} />
          </div>
          <div className="flex items-center justify-between rounded-md border p-3">
            <div>
              <p className="text-sm font-medium">Public bundle</p>
              <p className="text-xs text-muted-foreground">Show this bundle on creator and discovery surfaces.</p>
            </div>
            <Switch checked={isPublic} onCheckedChange={setIsPublic} />
          </div>
          <div className="md:col-span-2">
            <Button disabled={createBundleMutation.isPending || !name.trim()} onClick={() => createBundleMutation.mutate()}>
              {createBundleMutation.isPending ? "Creating…" : "Create bundle"}
            </Button>
            {createBundleMutation.error ? <p className="mt-2 text-sm text-destructive">{createBundleMutation.error instanceof Error ? createBundleMutation.error.message : "Failed to create bundle."}</p> : null}
          </div>
        </div>

        {bundlesQuery.isLoading ? <p className="text-sm text-muted-foreground">Loading bundles…</p> : null}
        {bundlesQuery.error ? <p className="text-sm text-destructive">{bundlesQuery.error instanceof Error ? bundlesQuery.error.message : "Failed to load bundles."}</p> : null}
        {!bundlesQuery.isLoading && bundles.length === 0 ? <p className="text-sm text-muted-foreground">No bundles yet. Create one to package your premium collections together.</p> : null}

        <div className="space-y-4">
          {bundles.map((bundle) => {
            const availableCollections = premiumCollections.filter((collection) => !bundle.includedCollections.some((item) => item.id === collection.id));
            return (
              <Card key={bundle.id}>
                <CardHeader>
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <CardTitle className="text-lg">
                        <Link href={bundle.route} className="underline underline-offset-2">{bundle.name}</Link>
                      </CardTitle>
                      <CardDescription>{bundle.description || "No description provided."}</CardDescription>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Badge>Premium Bundle</Badge>
                      <Badge variant="secondary">{formatCurrency(bundle.priceCents)}</Badge>
                      <Badge variant="outline">{bundle.itemsCount} collections</Badge>
                      <Badge variant="outline">{bundle.isPublic ? "Public" : "Private"}</Badge>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex flex-wrap gap-2">
                    <Button variant="outline" size="sm" onClick={() => patchBundleMutation.mutate({ bundleId: bundle.id, body: { isPublic: !bundle.isPublic } })}>
                      {bundle.isPublic ? "Make private" : "Publish bundle"}
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => patchBundleMutation.mutate({ bundleId: bundle.id, body: { priceCents: Math.max(100, bundle.priceCents) } })}>
                      Keep premium pricing
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => deleteBundleMutation.mutate(bundle.id)}>
                      Delete
                    </Button>
                  </div>

                  <div className="grid gap-2 md:grid-cols-[1fr_auto] md:items-end">
                    <div className="space-y-2">
                      <Label htmlFor={`bundle-item-${bundle.id}`}>Add premium collection</Label>
                      <select
                        id={`bundle-item-${bundle.id}`}
                        className="h-10 w-full rounded-md border bg-background px-3 text-sm"
                        value={itemSelections[bundle.id] ?? ""}
                        onChange={(event) => setItemSelections((current) => ({ ...current, [bundle.id]: event.target.value }))}
                      >
                        <option value="">Select a premium collection</option>
                        {availableCollections.map((collection) => (
                          <option key={collection.id} value={collection.id}>{collection.name} · {formatCurrency(collection.priceCents)}</option>
                        ))}
                      </select>
                    </div>
                    <Button disabled={!itemSelections[bundle.id]} onClick={() => addItemMutation.mutate({ bundleId: bundle.id, collectionId: itemSelections[bundle.id] })}>Add to bundle</Button>
                  </div>

                  {bundle.includedCollections.length === 0 ? <p className="text-sm text-muted-foreground">No collections in this bundle yet.</p> : null}
                  <div className="space-y-2">
                    {bundle.includedCollections.map((collection) => (
                      <div key={`${bundle.id}-${collection.id}`} className="flex flex-wrap items-center justify-between gap-2 rounded-md border p-3 text-sm">
                        <div>
                          <Link href={collection.route} className="font-medium underline underline-offset-2">{collection.name}</Link>
                          <p className="text-muted-foreground">Standalone price: {formatCurrency(collection.priceCents)}</p>
                        </div>
                        <Button variant="ghost" size="sm" onClick={() => removeItemMutation.mutate({ bundleId: bundle.id, collectionId: collection.id })}>Remove</Button>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
