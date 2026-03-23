import * as React from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Link } from "wouter";

import CreatorCampaignCard, { type CreatorCampaignItem } from "@/components/drinks/CreatorCampaignCard";
import CampaignPinButton from "@/components/drinks/CampaignPinButton";
import CampaignUnlockControls from "@/components/drinks/CampaignUnlockControls";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Textarea } from "@/components/ui/textarea";
import { useUser } from "@/contexts/UserContext";

import {
  campaignGoalTypeLabel,
  readErrorMessage,
  rolloutAudienceLabel,
  rolloutModeLabel,
  rolloutStateLabel,
  toLocalInput,
} from "@/components/drinks/campaigns-dashboard/utils";
import {
  type CampaignGoalItem,
  type CampaignGoalType,
  type CampaignGoalsResponse,
  type CampaignLinkForm,
  type CampaignRolloutAudience,
  type CampaignRolloutMode,
  type CampaignRolloutResponse,
  type CampaignRolloutState,
  type CampaignTargetType,
  type CampaignTemplateItem,
  type CampaignVariantItem,
  type CampaignVariantTargetType,
  type CampaignVariantsResponse,
} from "@/components/drinks/campaigns-dashboard/types";

import { useCampaignsDashboardData } from "@/components/drinks/campaigns-dashboard/hooks/useCampaignsDashboardData";
import CampaignGoalsManager from "@/components/drinks/campaigns-dashboard/CampaignGoalsManager";
import CampaignRolloutManager from "@/components/drinks/campaigns-dashboard/CampaignRolloutManager";
import CampaignVariantManager from "@/components/drinks/campaigns-dashboard/CampaignVariantManager";
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
  const [selectedCampaignId, setSelectedCampaignId] = React.useState("");

  const {
    campaignsQuery,
    pinnedCampaignQuery,
    templatesQuery,
    contentOptions,
  } = useCampaignsDashboardData(user?.id);

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

  const cloneMutation = useMutation({
    mutationFn: async (campaign: CreatorCampaignItem) => {
      const response = await fetch(`/api/drinks/campaigns/${encodeURIComponent(campaign.id)}/clone`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          newName: `${campaign.name} Copy`,
          resetDates: true,
          copyLinkedDrafts: true,
          copyCtaVariants: true,
        }),
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok) throw new Error(payload?.error || payload?.message || `Failed to clone campaign (${response.status})`);
      return payload;
    },
    onSuccess: async (payload) => {
      setMessage(`Campaign cloned into "${payload?.campaign?.name ?? "draft"}". Followers, analytics, and purchases were not copied.`);
      setError("");
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["/api/drinks/campaigns/creator", user?.id ?? ""] }),
        queryClient.invalidateQueries({ queryKey: ["/api/drinks/campaigns"] }),
        queryClient.invalidateQueries({ queryKey: ["/api/drinks/campaign-templates", user?.id ?? ""] }),
      ]);
      if (payload?.campaign?.id) {
        setSelectedCampaignId(String(payload.campaign.id));
      }
    },
    onError: (mutationError) => {
      setError(readErrorMessage(mutationError, "Unable to clone campaign right now."));
      setMessage("");
    },
  });

  const saveTemplateMutation = useMutation({
    mutationFn: async (campaign: CreatorCampaignItem) => {
      const response = await fetch(`/api/drinks/campaigns/${encodeURIComponent(campaign.id)}/save-template`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          templateName: `${campaign.name} Template`,
        }),
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok) throw new Error(payload?.error || payload?.message || `Failed to save template (${response.status})`);
      return payload;
    },
    onSuccess: async (payload) => {
      setMessage(`Saved template "${payload?.item?.name ?? "template"}".`);
      setError("");
      await queryClient.invalidateQueries({ queryKey: ["/api/drinks/campaign-templates", user?.id ?? ""] });
    },
    onError: (mutationError) => {
      setError(readErrorMessage(mutationError, "Unable to save template right now."));
      setMessage("");
    },
  });

  const useTemplateMutation = useMutation({
    mutationFn: async (template: CampaignTemplateItem) => {
      const response = await fetch(`/api/drinks/campaign-templates/${encodeURIComponent(template.id)}/create-campaign`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          newName: `${template.campaignName} Draft`,
          resetDates: template.defaults.resetDates,
          copyLinkedDrafts: template.defaults.copyLinkedDrafts,
          copyCtaVariants: template.defaults.copyCtaVariants,
        }),
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok) throw new Error(payload?.error || payload?.message || `Failed to use template (${response.status})`);
      return payload;
    },
    onSuccess: async (payload) => {
      setMessage(`Created draft campaign "${payload?.campaign?.name ?? "campaign"}" from template.`);
      setError("");
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["/api/drinks/campaigns/creator", user?.id ?? ""] }),
        queryClient.invalidateQueries({ queryKey: ["/api/drinks/campaigns"] }),
        queryClient.invalidateQueries({ queryKey: ["/api/drinks/campaign-templates", user?.id ?? ""] }),
      ]);
      if (payload?.campaign?.id) {
        setSelectedCampaignId(String(payload.campaign.id));
      }
    },
    onError: (mutationError) => {
      setError(readErrorMessage(mutationError, "Unable to create a campaign from this template right now."));
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

  const campaigns = campaignsQuery.data?.items ?? [];
  const templates = templatesQuery.data?.items ?? [];
  const selectedCampaign = campaigns.find((campaign) => campaign.id === selectedCampaignId) ?? campaigns[0] ?? null;
  const pinnedCampaign = pinnedCampaignQuery.data?.campaign ?? campaignsQuery.data?.pinnedCampaign ?? campaigns.find((campaign) => campaign.isPinned) ?? null;

  React.useEffect(() => {
    if (!campaigns.length) {
      if (selectedCampaignId) setSelectedCampaignId("");
      return;
    }
    if (!selectedCampaignId || !campaigns.some((campaign) => campaign.id === selectedCampaignId)) {
      setSelectedCampaignId(campaigns[0].id);
    }
  }, [campaigns, selectedCampaignId]);

  const refreshCampaigns = React.useCallback(async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["/api/drinks/campaigns/creator", user?.id ?? ""] }),
      queryClient.invalidateQueries({ queryKey: ["/api/drinks/campaigns"] }),
    ]);
  }, [queryClient, user?.id]);

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
          <div className="rounded-md border p-3"><p className="text-xs uppercase tracking-wide text-muted-foreground">Interest</p><p className="text-xl font-semibold">{campaigns.reduce((sum, item) => sum + item.followerCount, 0)}</p></div>
        </div>

        <div className="rounded-lg border bg-muted/20 p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="space-y-1">
              <h3 className="font-semibold">Pinned creator spotlight</h3>
              <p className="text-sm text-muted-foreground">
                Keep one campaign pinned at a time so your creator page and lightweight discovery surfaces show the arc you most want visitors to land on right now.
              </p>
            </div>
            {pinnedCampaign ? <Link href={pinnedCampaign.route}><Button size="sm" variant="outline">Preview pinned campaign</Button></Link> : null}
          </div>
          <div className="mt-3 text-sm text-muted-foreground">
            {pinnedCampaign
              ? <>Currently pinned: <span className="font-medium text-foreground">{pinnedCampaign.name}</span>. Pinning another campaign replaces this one automatically.</>
              : "No pinned campaign yet. Pick one active or upcoming arc when you want a clear creator spotlight."}
          </div>
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
            <Card>
              <CardHeader>
                <CardTitle>Templates / Reuse</CardTitle>
                <CardDescription>
                  Save a campaign as a reusable arc, or spin up a draft from a past launch without carrying over followers, analytics, purchases, or anything live.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {templatesQuery.isLoading ? <p className="text-sm text-muted-foreground">Loading templates…</p> : null}
                {templatesQuery.isError ? <p className="text-sm text-destructive">{readErrorMessage(templatesQuery.error, "Unable to load templates right now.")}</p> : null}
                {templatesQuery.data?.basedOnPastCampaigns?.length ? (
                  <div className="rounded-md border border-dashed p-3 text-sm">
                    <p className="font-medium">Based on your past campaigns</p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {templatesQuery.data.basedOnPastCampaigns.map((item) => (
                        <Button
                          key={item.id}
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            const campaign = campaigns.find((entry) => entry.id === item.id);
                            if (campaign) cloneMutation.mutate(campaign);
                          }}
                          disabled={cloneMutation.isPending}
                        >
                          Clone {item.name}
                        </Button>
                      ))}
                    </div>
                  </div>
                ) : null}
                {!templatesQuery.isLoading && !templates.length ? (
                  <p className="text-sm text-muted-foreground">No saved templates yet. Save a strong launch arc like Summer Cocktail Series or Zero-Proof January once, then reuse it next season.</p>
                ) : null}
                <div className="space-y-3">
                  {templates.map((template) => (
                    <div key={template.id} className="rounded-md border p-3">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="space-y-1">
                          <p className="font-medium">{template.name}</p>
                          <p className="text-sm text-muted-foreground">{template.description ?? `Reusable starting point for ${template.campaignName}.`}</p>
                          <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                            <span>{template.counts.linkedItems} linked items</span>
                            <span>{template.counts.variants} CTA variants</span>
                            <span>{template.visibility}</span>
                            <span>{template.defaults.resetDates ? "resets dates" : "keeps dates"}</span>
                          </div>
                        </div>
                        <Button size="sm" onClick={() => useTemplateMutation.mutate(template)} disabled={useTemplateMutation.isPending}>
                          {useTemplateMutation.isPending ? "Creating…" : "Use Template"}
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
            <CampaignRolloutManager campaign={selectedCampaign} onChanged={refreshCampaigns} />
            <CampaignGoalsManager campaign={selectedCampaign} onChanged={refreshCampaigns} />
            <CampaignVariantManager campaign={selectedCampaign} onChanged={refreshCampaigns} />
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
                    {campaign.rollout ? (
                      <div className="flex items-center rounded-md border px-3 text-xs text-muted-foreground">
                        {rolloutModeLabel(campaign.rollout.rolloutMode)} · {rolloutStateLabel(campaign.rollout.state)}
                      </div>
                    ) : null}
                    <div className="flex items-center rounded-md border px-3 text-xs text-muted-foreground">
                      {campaign.followerCount} following
                    </div>
                    <CampaignPinButton
                      campaignId={campaign.id}
                      isPinned={campaign.isPinned}
                      onSuccess={(nextMessage) => { setMessage(nextMessage); setError(""); }}
                      onError={(nextError) => { setError(nextError); setMessage(""); }}
                    />
                    <Button size="sm" variant={selectedCampaignId === campaign.id ? "default" : "outline"} onClick={() => setSelectedCampaignId(campaign.id)}>Goals / CTA</Button>
                    <Button size="sm" variant="outline" onClick={() => { void loadCampaignIntoForm(campaign); }}>Edit</Button>
                    <Button size="sm" variant="outline" onClick={() => cloneMutation.mutate(campaign)} disabled={cloneMutation.isPending}>{cloneMutation.isPending ? "Cloning…" : "Clone Campaign"}</Button>
                    <Button size="sm" variant="outline" onClick={() => saveTemplateMutation.mutate(campaign)} disabled={saveTemplateMutation.isPending}>{saveTemplateMutation.isPending ? "Saving…" : "Save as Template"}</Button>
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
