import * as React from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "wouter";

import CreatorCampaignCard, { type CreatorCampaignItem } from "@/components/drinks/CreatorCampaignCard";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useUser } from "@/contexts/UserContext";

type CampaignTargetType = "collection" | "drop" | "promo" | "challenge" | "post" | "roadmap";

type CampaignLinkForm = {
  targetType: CampaignTargetType;
  targetId: string;
};

type CampaignsResponse = {
  ok: boolean;
  creatorUserId: string;
  count: number;
  items: CreatorCampaignItem[];
};

function readErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}

function toLocalInput(value: string | null) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
}

export default function CampaignsDashboardSection() {
  const { user } = useUser();
  const queryClient = useQueryClient();
  const [message, setMessage] = React.useState("");
  const [error, setError] = React.useState("");
  const [form, setForm] = React.useState({
    id: "",
    slug: "",
    name: "",
    description: "",
    visibility: "public" as CreatorCampaignItem["visibility"],
    startsAt: "",
    endsAt: "",
    isActive: true,
    links: [] as CampaignLinkForm[],
  });

  const campaignsQuery = useQuery<CampaignsResponse>({
    queryKey: ["/api/drinks/campaigns/creator", user?.id ?? ""],
    queryFn: async () => {
      const response = await fetch(`/api/drinks/campaigns/creator/${encodeURIComponent(user?.id ?? "")}`, { credentials: "include" });
      const payload = await response.json().catch(() => null);
      if (!response.ok) throw new Error(payload?.error || payload?.message || `Failed to load campaigns (${response.status})`);
      return payload as CampaignsResponse;
    },
    enabled: Boolean(user?.id),
  });

  const collectionsQuery = useQuery<{ items: Array<{ id: string; label: string }> }>({
    queryKey: ["/api/drinks/collections/mine", user?.id ?? ""],
    queryFn: async () => {
      const response = await fetch("/api/drinks/collections/mine", { credentials: "include" });
      const payload = await response.json().catch(() => null);
      if (!response.ok) throw new Error(payload?.error || payload?.message || `Failed to load collections (${response.status})`);
      return {
        items: Array.isArray(payload?.collections)
          ? payload.collections.map((item: any) => ({ id: String(item.id), label: String(item.name ?? "Collection") }))
          : [],
      };
    },
    enabled: Boolean(user?.id),
  });

  const dropsQuery = useQuery<{ items: Array<{ id: string; label: string }> }>({
    queryKey: ["/api/drinks/drops/creator", user?.id ?? ""],
    queryFn: async () => {
      const response = await fetch(`/api/drinks/drops/creator/${encodeURIComponent(user?.id ?? "")}`, { credentials: "include" });
      const payload = await response.json().catch(() => null);
      if (!response.ok) throw new Error(payload?.error || payload?.message || `Failed to load drops (${response.status})`);
      return {
        items: Array.isArray(payload?.items)
          ? payload.items.map((item: any) => ({ id: String(item.id), label: String(item.title ?? "Drop") }))
          : [],
      };
    },
    enabled: Boolean(user?.id),
  });

  const postsQuery = useQuery<{ items: Array<{ id: string; label: string }> }>({
    queryKey: ["/api/drinks/creator-posts/creator", user?.id ?? ""],
    queryFn: async () => {
      const response = await fetch(`/api/drinks/creator-posts/creator/${encodeURIComponent(user?.id ?? "")}`, { credentials: "include" });
      const payload = await response.json().catch(() => null);
      if (!response.ok) throw new Error(payload?.error || payload?.message || `Failed to load posts (${response.status})`);
      return {
        items: Array.isArray(payload?.items)
          ? payload.items.map((item: any) => ({ id: String(item.id), label: String(item.title ?? "Post") }))
          : [],
      };
    },
    enabled: Boolean(user?.id),
  });

  const roadmapQuery = useQuery<{ items: Array<{ id: string; label: string }> }>({
    queryKey: ["/api/drinks/roadmap/creator", user?.id ?? ""],
    queryFn: async () => {
      const response = await fetch(`/api/drinks/roadmap/creator/${encodeURIComponent(user?.id ?? "")}`, { credentials: "include" });
      const payload = await response.json().catch(() => null);
      if (!response.ok) throw new Error(payload?.error || payload?.message || `Failed to load roadmap (${response.status})`);
      return {
        items: Array.isArray(payload?.items)
          ? payload.items.map((item: any) => ({ id: String(item.id), label: String(item.title ?? "Roadmap note") }))
          : [],
      };
    },
    enabled: Boolean(user?.id),
  });

  const promotionsQuery = useQuery<{ items: Array<{ id: string; label: string }> }>({
    queryKey: ["/api/drinks/creator-dashboard/promotions", user?.id ?? ""],
    queryFn: async () => {
      const response = await fetch("/api/drinks/creator-dashboard/promotions", { credentials: "include" });
      const payload = await response.json().catch(() => null);
      if (!response.ok) throw new Error(payload?.error || payload?.message || `Failed to load promotions (${response.status})`);
      return {
        items: Array.isArray(payload?.promotions)
          ? payload.promotions.map((item: any) => ({ id: String(item.id), label: `${String(item.code ?? "PROMO")} · ${String(item.collectionName ?? "Collection")}` }))
          : [],
      };
    },
    enabled: Boolean(user?.id),
  });

  const challengesQuery = useQuery<{ items: Array<{ id: string; label: string }> }>({
    queryKey: ["/api/drinks/challenges"],
    queryFn: async () => {
      const response = await fetch("/api/drinks/challenges", { credentials: "include" });
      const payload = await response.json().catch(() => null);
      if (!response.ok) throw new Error(payload?.error || payload?.message || `Failed to load challenges (${response.status})`);
      const sourceItems = Array.isArray(payload?.items) ? payload.items : payload?.challenges;
      return {
        items: Array.isArray(sourceItems)
          ? sourceItems.map((item: any) => ({ id: String(item.id), label: String(item.title ?? item.slug ?? "Challenge") }))
          : [],
      };
    },
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch(
        form.id ? `/api/drinks/campaigns/${encodeURIComponent(form.id)}` : "/api/drinks/campaigns",
        {
          method: form.id ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({
            slug: form.slug.trim(),
            name: form.name.trim(),
            description: form.description.trim() || null,
            visibility: form.visibility,
            startsAt: form.startsAt ? new Date(form.startsAt).toISOString() : null,
            endsAt: form.endsAt ? new Date(form.endsAt).toISOString() : null,
            isActive: form.isActive,
            links: form.links.filter((link) => link.targetId).map((link, index) => ({ ...link, sortOrder: index })),
          }),
        },
      );
      const payload = await response.json().catch(() => null);
      if (!response.ok) throw new Error(payload?.error || payload?.message || `Failed to save campaign (${response.status})`);
      return payload;
    },
    onSuccess: async () => {
      setMessage(form.id ? "Campaign updated." : "Campaign created.");
      setError("");
      setForm({ id: "", slug: "", name: "", description: "", visibility: "public", startsAt: "", endsAt: "", isActive: true, links: [] });
      await queryClient.invalidateQueries({ queryKey: ["/api/drinks/campaigns/creator", user?.id ?? ""] });
      await queryClient.invalidateQueries({ queryKey: ["/api/drinks/campaigns"] });
    },
    onError: (mutationError) => {
      setError(readErrorMessage(mutationError, "Unable to save campaign right now."));
      setMessage("");
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await fetch(`/api/drinks/campaigns/${encodeURIComponent(id)}`, { method: "DELETE", credentials: "include" });
      const payload = await response.json().catch(() => null);
      if (!response.ok) throw new Error(payload?.error || payload?.message || `Failed to delete campaign (${response.status})`);
      return payload;
    },
    onSuccess: async () => {
      setMessage("Campaign deleted.");
      setError("");
      setForm({ id: "", slug: "", name: "", description: "", visibility: "public", startsAt: "", endsAt: "", isActive: true, links: [] });
      await queryClient.invalidateQueries({ queryKey: ["/api/drinks/campaigns/creator", user?.id ?? ""] });
      await queryClient.invalidateQueries({ queryKey: ["/api/drinks/campaigns"] });
    },
    onError: (mutationError) => {
      setError(readErrorMessage(mutationError, "Unable to delete campaign right now."));
      setMessage("");
    },
  });

  const loadCampaignIntoForm = React.useCallback(async (campaign: CreatorCampaignItem) => {
    setMessage("");
    setError("");
    try {
      const response = await fetch(`/api/drinks/campaigns/${encodeURIComponent(campaign.slug)}`, { credentials: "include" });
      const payload = await response.json().catch(() => null);
      if (!response.ok) throw new Error(payload?.error || payload?.message || `Failed to load campaign (${response.status})`);
      const linkedContent = (payload?.linkedContent ?? {}) as Record<string, any[]>;
      const links: CampaignLinkForm[] = [
        ...(Array.isArray(linkedContent.collections) ? linkedContent.collections.map((item) => ({ targetType: "collection" as const, targetId: String(item.id ?? "") })) : []),
        ...(Array.isArray(linkedContent.drops) ? linkedContent.drops.map((item) => ({ targetType: "drop" as const, targetId: String(item.id ?? "") })) : []),
        ...(Array.isArray(linkedContent.promos) ? linkedContent.promos.map((item) => ({ targetType: "promo" as const, targetId: String(item.id ?? "") })) : []),
        ...(Array.isArray(linkedContent.challenges) ? linkedContent.challenges.map((item) => ({ targetType: "challenge" as const, targetId: String(item.id ?? "") })) : []),
        ...(Array.isArray(linkedContent.posts) ? linkedContent.posts.map((item) => ({ targetType: "post" as const, targetId: String(item.id ?? "") })) : []),
        ...(Array.isArray(linkedContent.roadmap) ? linkedContent.roadmap.map((item) => ({ targetType: "roadmap" as const, targetId: String(item.id ?? "") })) : []),
      ].filter((entry) => entry.targetId);

      setForm({
        id: campaign.id,
        slug: campaign.slug,
        name: campaign.name,
        description: campaign.description ?? "",
        visibility: campaign.visibility,
        startsAt: toLocalInput(campaign.startsAt),
        endsAt: toLocalInput(campaign.endsAt),
        isActive: campaign.isActive,
        links,
      });
      window.location.hash = "campaigns";
    } catch (loadError) {
      setError(readErrorMessage(loadError, "Unable to load campaign details right now."));
    }
  }, []);

  const contentOptions: Record<CampaignTargetType, Array<{ id: string; label: string }>> = {
    collection: collectionsQuery.data?.items ?? [],
    drop: dropsQuery.data?.items ?? [],
    promo: promotionsQuery.data?.items ?? [],
    challenge: challengesQuery.data?.items ?? [],
    post: postsQuery.data?.items ?? [],
    roadmap: roadmapQuery.data?.items ?? [],
  };

  const campaigns = campaignsQuery.data?.items ?? [];

  return (
    <Card id="campaigns">
      <CardHeader>
        <CardTitle>Campaigns / Seasons</CardTitle>
        <CardDescription>
          Group related drops, collections, promos, roadmap notes, and creator posts into lightweight themed arcs like a summer cocktail run, a zero-proof month, or wedding-season specials.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid gap-2 sm:grid-cols-4">
          <div className="rounded-md border p-3"><p className="text-xs uppercase tracking-wide text-muted-foreground">Campaigns</p><p className="text-xl font-semibold">{campaigns.length}</p></div>
          <div className="rounded-md border p-3"><p className="text-xs uppercase tracking-wide text-muted-foreground">Active</p><p className="text-xl font-semibold">{campaigns.filter((item) => item.state === "active").length}</p></div>
          <div className="rounded-md border p-3"><p className="text-xs uppercase tracking-wide text-muted-foreground">Upcoming</p><p className="text-xl font-semibold">{campaigns.filter((item) => item.state === "upcoming").length}</p></div>
          <div className="rounded-md border p-3"><p className="text-xs uppercase tracking-wide text-muted-foreground">Past</p><p className="text-xl font-semibold">{campaigns.filter((item) => item.state === "past").length}</p></div>
        </div>

        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr),minmax(0,1.2fr)]">
          <div className="space-y-4 rounded-lg border p-4">
            <div className="space-y-1">
              <h3 className="font-semibold">{form.id ? "Edit campaign" : "New campaign"}</h3>
              <p className="text-sm text-muted-foreground">Keep it story-first: a name, short context, access level, dates if useful, and a few linked surfaces.</p>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2"><Label htmlFor="campaign-name">Name</Label><Input id="campaign-name" value={form.name} onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))} placeholder="Summer Cocktail Series" /></div>
              <div className="space-y-2"><Label htmlFor="campaign-slug">Slug</Label><Input id="campaign-slug" value={form.slug} onChange={(event) => setForm((current) => ({ ...current, slug: event.target.value.toLowerCase().replace(/[^a-z0-9-]+/g, "-") }))} placeholder="summer-cocktail-series" /></div>
            </div>

            <div className="space-y-2"><Label htmlFor="campaign-description">Description</Label><Textarea id="campaign-description" value={form.description} onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))} className="min-h-[110px]" placeholder="A short narrative for the arc: what ties these drops, collections, and posts together?" /></div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="campaign-visibility">Visibility</Label>
                <select id="campaign-visibility" className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" value={form.visibility} onChange={(event) => setForm((current) => ({ ...current, visibility: event.target.value as CreatorCampaignItem["visibility"] }))}>
                  <option value="public">Public</option>
                  <option value="followers">Followers</option>
                  <option value="members">Members</option>
                </select>
                <p className="text-xs text-muted-foreground">Public → anyone. Followers → followed users + you. Members → active members + you.</p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="campaign-active">Status</Label>
                <select id="campaign-active" className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" value={form.isActive ? "active" : "inactive"} onChange={(event) => setForm((current) => ({ ...current, isActive: event.target.value === "active" }))}>
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                </select>
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2"><Label htmlFor="campaign-starts">Starts at</Label><Input id="campaign-starts" type="datetime-local" value={form.startsAt} onChange={(event) => setForm((current) => ({ ...current, startsAt: event.target.value }))} /></div>
              <div className="space-y-2"><Label htmlFor="campaign-ends">Ends at</Label><Input id="campaign-ends" type="datetime-local" value={form.endsAt} onChange={(event) => setForm((current) => ({ ...current, endsAt: event.target.value }))} /></div>
            </div>

            <div className="space-y-3 rounded-md border border-dashed p-3">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <p className="font-medium">Linked content</p>
                  <p className="text-sm text-muted-foreground">Add only the surfaces that reinforce the story arc.</p>
                </div>
                <Button type="button" variant="outline" size="sm" onClick={() => setForm((current) => ({ ...current, links: [...current.links, { targetType: "drop", targetId: "" }] }))}>Add link</Button>
              </div>
              {form.links.length === 0 ? <p className="text-sm text-muted-foreground">No linked content yet.</p> : null}
              {form.links.map((link, index) => (
                <div key={`${link.targetType}-${index}`} className="grid gap-3 md:grid-cols-[160px,minmax(0,1fr),auto]">
                  <select className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" value={link.targetType} onChange={(event) => setForm((current) => ({ ...current, links: current.links.map((entry, entryIndex) => entryIndex === index ? { targetType: event.target.value as CampaignTargetType, targetId: "" } : entry) }))}>
                    <option value="collection">Collection</option>
                    <option value="drop">Drop</option>
                    <option value="promo">Promo</option>
                    <option value="challenge">Challenge</option>
                    <option value="post">Post</option>
                    <option value="roadmap">Roadmap</option>
                  </select>
                  <select className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" value={link.targetId} onChange={(event) => setForm((current) => ({ ...current, links: current.links.map((entry, entryIndex) => entryIndex === index ? { ...entry, targetId: event.target.value } : entry) }))}>
                    <option value="">Select linked content</option>
                    {contentOptions[link.targetType].map((option) => <option key={option.id} value={option.id}>{option.label}</option>)}
                  </select>
                  <Button type="button" variant="ghost" size="sm" onClick={() => setForm((current) => ({ ...current, links: current.links.filter((_, entryIndex) => entryIndex !== index) }))}>Remove</Button>
                </div>
              ))}
            </div>

            <div className="flex flex-wrap gap-2">
              <Button onClick={() => { setMessage(""); setError(""); saveMutation.mutate(); }} disabled={saveMutation.isPending || !form.name.trim() || !form.slug.trim()}>{saveMutation.isPending ? "Saving…" : form.id ? "Update campaign" : "Create campaign"}</Button>
              <Button variant="outline" onClick={() => { setMessage(""); setError(""); setForm({ id: "", slug: "", name: "", description: "", visibility: "public", startsAt: "", endsAt: "", isActive: true, links: [] }); }}>Reset</Button>
              <Link href="/drinks/discover"><Button variant="ghost">Discover hub</Button></Link>
            </div>

            {message ? <p className="text-sm text-emerald-600">{message}</p> : null}
            {error ? <p className="text-sm text-destructive">{error}</p> : null}
          </div>

          <div className="space-y-4">
            {campaignsQuery.isLoading ? <p className="text-sm text-muted-foreground">Loading campaigns…</p> : null}
            {campaignsQuery.isError ? <p className="text-sm text-destructive">{readErrorMessage(campaignsQuery.error, "Unable to load campaigns right now.")}</p> : null}
            {!campaignsQuery.isLoading && !campaignsQuery.isError && campaigns.length === 0 ? (
              <Card><CardContent className="p-4 text-sm text-muted-foreground">No campaigns yet. Create a themed arc to bundle launches, promos, roadmap notes, and story posts together without turning your dashboard into project management software.</CardContent></Card>
            ) : null}
            {campaigns.map((campaign) => (
              <CreatorCampaignCard
                key={campaign.id}
                campaign={campaign}
                showCreator={false}
                actions={(
                  <>
                    <Button size="sm" variant="outline" onClick={() => { void loadCampaignIntoForm(campaign); }}>Edit</Button>
                    <Button size="sm" variant="outline" onClick={() => deleteMutation.mutate(campaign.id)} disabled={deleteMutation.isPending}>{deleteMutation.isPending ? "Deleting…" : "Delete"}</Button>
                  </>
                )}
              />
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
