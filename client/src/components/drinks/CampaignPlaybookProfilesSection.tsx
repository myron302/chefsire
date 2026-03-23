import * as React from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "wouter";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useUser } from "@/contexts/UserContext";

type CampaignRolloutMode = "public_first" | "followers_first" | "members_first" | "staged";
type CampaignAudience = "public" | "followers" | "members";
type PlaybookCtaDirection = "follow" | "rsvp" | "membership" | "purchase" | "drop" | "mixed";
type ExperimentType =
  | "strengthen_cta"
  | "launch_promo"
  | "add_drop"
  | "publish_update"
  | "push_rsvp"
  | "promote_membership"
  | "add_member_only_collection"
  | "shorten_unlock_delay"
  | "accelerate_public_unlock"
  | "spotlight_campaign";

type PlaybookProfileItem = {
  id: string;
  creatorUserId: string;
  parentPlaybookProfileId: string | null;
  sourceCampaignId: string | null;
  derivedFromType: "playbook" | "campaign" | null;
  versionLabel: string | null;
  name: string;
  description: string | null;
  visibilityStrategy: CampaignAudience | null;
  rolloutMode: CampaignRolloutMode;
  startsWithAudience: CampaignAudience | null;
  recommendedFollowerUnlockDelayHours: number | null;
  recommendedPublicUnlockDelayHours: number | null;
  preferredCtaDirection: PlaybookCtaDirection | null;
  preferredExperimentTypes: ExperimentType[];
  preferredAudienceFit: CampaignAudience | null;
  notes: string | null;
  childCount: number;
  basedOnLabel: string | null;
  parentPlaybook: { id: string; name: string; versionLabel: string | null } | null;
  sourceCampaign: { id: string; name: string; slug: string; route: string } | null;
  outcomeSnapshot?: {
    appliedCount: number;
    scorecardLabel: "strong" | "promising" | "mixed" | "weak";
    outcomeLabel: string;
    confidenceNote: string | null;
  } | null;
  createdAt: string;
  updatedAt: string;
};

type PlaybookProfilesResponse = {
  ok: boolean;
  count: number;
  items: PlaybookProfileItem[];
  availableCampaigns: Array<{ id: string; name: string; slug: string; route: string }>;
  attributionNotes: string[];
};

type PlaybookLineageResponse = {
  ok: boolean;
  count: number;
  items: PlaybookProfileItem[];
  attributionNotes: string[];
};

const experimentOptions: Array<{ value: ExperimentType; label: string }> = [
  { value: "strengthen_cta", label: "Strengthen CTA" },
  { value: "launch_promo", label: "Launch promo" },
  { value: "add_drop", label: "Add drop" },
  { value: "publish_update", label: "Publish update" },
  { value: "push_rsvp", label: "Push RSVP" },
  { value: "promote_membership", label: "Promote membership" },
  { value: "add_member_only_collection", label: "Add member-only collection" },
  { value: "shorten_unlock_delay", label: "Shorten unlock delay" },
  { value: "accelerate_public_unlock", label: "Accelerate public unlock" },
  { value: "spotlight_campaign", label: "Spotlight campaign" },
];

const emptyForm = {
  id: "",
  name: "",
  description: "",
  visibilityStrategy: "public" as CampaignAudience,
  rolloutMode: "public_first" as CampaignRolloutMode,
  startsWithAudience: "members" as CampaignAudience,
  recommendedFollowerUnlockDelayHours: "24",
  recommendedPublicUnlockDelayHours: "72",
  preferredCtaDirection: "follow" as PlaybookCtaDirection,
  preferredAudienceFit: "public" as CampaignAudience,
  preferredExperimentTypes: [] as ExperimentType[],
  notes: "",
};

function readErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}

function rolloutModeLabel(value: CampaignRolloutMode) {
  switch (value) {
    case "followers_first":
      return "Followers first";
    case "members_first":
      return "Members first";
    case "staged":
      return "Staged";
    case "public_first":
    default:
      return "Public first";
  }
}

function audienceLabel(value: CampaignAudience | null) {
  if (value === "members") return "Members";
  if (value === "followers") return "Followers";
  if (value === "public") return "Public";
  return "—";
}

function ctaDirectionLabel(value: PlaybookCtaDirection | null) {
  if (!value) return "—";
  return value.replaceAll("_", " ").replace(/\b\w/g, (char) => char.toUpperCase());
}

export default function CampaignPlaybookProfilesSection() {
  const { user } = useUser();
  const queryClient = useQueryClient();
  const [message, setMessage] = React.useState("");
  const [error, setError] = React.useState("");
  const [form, setForm] = React.useState(emptyForm);
  const [saveFromCampaignId, setSaveFromCampaignId] = React.useState("");
  const [evolutionPlaybookId, setEvolutionPlaybookId] = React.useState("");
  const [applyCampaignIdByProfile, setApplyCampaignIdByProfile] = React.useState<Record<string, string>>({});

  const query = useQuery<PlaybookProfilesResponse>({
    queryKey: ["/api/drinks/creator-dashboard/campaign-playbook-profiles", user?.id ?? ""],
    queryFn: async () => {
      const response = await fetch("/api/drinks/creator-dashboard/campaign-playbook-profiles", { credentials: "include" });
      const payload = await response.json().catch(() => null);
      if (!response.ok) throw new Error(payload?.error || payload?.message || `Failed to load campaign playbook profiles (${response.status})`);
      return payload as PlaybookProfilesResponse;
    },
    enabled: Boolean(user?.id),
  });

  const lineageQuery = useQuery<PlaybookLineageResponse>({
    queryKey: ["/api/drinks/creator-dashboard/campaign-playbook-lineage", user?.id ?? ""],
    queryFn: async () => {
      const response = await fetch("/api/drinks/creator-dashboard/campaign-playbook-lineage", { credentials: "include" });
      const payload = await response.json().catch(() => null);
      if (!response.ok) throw new Error(payload?.error || payload?.message || `Failed to load campaign playbook lineage (${response.status})`);
      return payload as PlaybookLineageResponse;
    },
    enabled: Boolean(user?.id),
  });

  React.useEffect(() => {
    if (!saveFromCampaignId && query.data?.availableCampaigns?.[0]?.id) {
      setSaveFromCampaignId(query.data.availableCampaigns[0].id);
    }
  }, [query.data?.availableCampaigns, saveFromCampaignId]);

  React.useEffect(() => {
    if (!evolutionPlaybookId && query.data?.items?.[0]?.id) {
      setEvolutionPlaybookId(query.data.items[0].id);
    }
  }, [evolutionPlaybookId, query.data?.items]);

  const resetForm = React.useCallback(() => {
    setForm(emptyForm);
  }, []);

  const saveMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        name: form.name.trim(),
        description: form.description.trim() || null,
        visibilityStrategy: form.visibilityStrategy,
        rolloutMode: form.rolloutMode,
        startsWithAudience: form.startsWithAudience,
        recommendedFollowerUnlockDelayHours: form.recommendedFollowerUnlockDelayHours.trim() ? Number(form.recommendedFollowerUnlockDelayHours) : null,
        recommendedPublicUnlockDelayHours: form.recommendedPublicUnlockDelayHours.trim() ? Number(form.recommendedPublicUnlockDelayHours) : null,
        preferredCtaDirection: form.preferredCtaDirection,
        preferredExperimentTypes: form.preferredExperimentTypes,
        preferredAudienceFit: form.preferredAudienceFit,
        notes: form.notes.trim() || null,
      };
      const response = await fetch(
        form.id
          ? `/api/drinks/creator-dashboard/campaign-playbook-profiles/${encodeURIComponent(form.id)}`
          : "/api/drinks/creator-dashboard/campaign-playbook-profiles",
        {
          method: form.id ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify(payload),
        },
      );
      const body = await response.json().catch(() => null);
      if (!response.ok) throw new Error(body?.error || body?.message || `Failed to save playbook profile (${response.status})`);
      return body;
    },
    onSuccess: async (payload) => {
      setMessage(payload?.message || "Campaign playbook profile saved.");
      setError("");
      resetForm();
      await queryClient.invalidateQueries({ queryKey: ["/api/drinks/creator-dashboard/campaign-playbook-profiles"] });
    },
    onError: (mutationError) => {
      setMessage("");
      setError(readErrorMessage(mutationError, "Unable to save the campaign playbook profile right now."));
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await fetch(`/api/drinks/creator-dashboard/campaign-playbook-profiles/${encodeURIComponent(id)}`, {
        method: "DELETE",
        credentials: "include",
      });
      const body = await response.json().catch(() => null);
      if (!response.ok) throw new Error(body?.error || body?.message || `Failed to delete playbook profile (${response.status})`);
      return body;
    },
    onSuccess: async () => {
      setMessage("Campaign playbook profile deleted.");
      setError("");
      resetForm();
      await queryClient.invalidateQueries({ queryKey: ["/api/drinks/creator-dashboard/campaign-playbook-profiles"] });
    },
    onError: (mutationError) => {
      setMessage("");
      setError(readErrorMessage(mutationError, "Unable to delete the campaign playbook profile right now."));
    },
  });

  const updateFromCampaignMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch(`/api/drinks/campaigns/${encodeURIComponent(saveFromCampaignId)}/update-playbook-from-campaign`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          playbookProfileId: evolutionPlaybookId,
        }),
      });
      const body = await response.json().catch(() => null);
      if (!response.ok) throw new Error(body?.error || body?.message || `Failed to update playbook from campaign (${response.status})`);
      return body;
    },
    onSuccess: async (payload) => {
      setMessage(payload?.message || "Updated playbook from current campaign strategy.");
      setError("");
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["/api/drinks/creator-dashboard/campaign-playbook-profiles"] }),
        queryClient.invalidateQueries({ queryKey: ["/api/drinks/creator-dashboard/campaign-playbook-lineage"] }),
        queryClient.invalidateQueries({ queryKey: ["/api/drinks/creator-dashboard/campaign-playbook-drift"] }),
        saveFromCampaignId ? queryClient.invalidateQueries({ queryKey: [`/api/drinks/campaigns/${saveFromCampaignId}/playbook-drift`] }) : Promise.resolve(),
      ]);
    },
    onError: (mutationError) => {
      setMessage("");
      setError(readErrorMessage(mutationError, "Unable to update the selected playbook from this campaign right now."));
    },
  });

  const createForkMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch(`/api/drinks/campaigns/${encodeURIComponent(saveFromCampaignId)}/create-playbook-fork`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          parentPlaybookProfileId: evolutionPlaybookId || undefined,
        }),
      });
      const body = await response.json().catch(() => null);
      if (!response.ok) throw new Error(body?.error || body?.message || `Failed to create playbook fork (${response.status})`);
      return body;
    },
    onSuccess: async (payload) => {
      setMessage(payload?.message || "Created a new playbook from this campaign.");
      setError("");
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["/api/drinks/creator-dashboard/campaign-playbook-profiles"] }),
        queryClient.invalidateQueries({ queryKey: ["/api/drinks/creator-dashboard/campaign-playbook-lineage"] }),
        queryClient.invalidateQueries({ queryKey: ["/api/drinks/creator-dashboard/campaign-playbook-drift"] }),
      ]);
    },
    onError: (mutationError) => {
      setMessage("");
      setError(readErrorMessage(mutationError, "Unable to create a new playbook from this campaign right now."));
    },
  });

  const applyMutation = useMutation({
    mutationFn: async ({ profileId, campaignId }: { profileId: string; campaignId: string }) => {
      const response = await fetch(`/api/drinks/creator-dashboard/campaign-playbook-profiles/${encodeURIComponent(profileId)}/apply-to-campaign/${encodeURIComponent(campaignId)}`, {
        method: "POST",
        credentials: "include",
      });
      const body = await response.json().catch(() => null);
      if (!response.ok) throw new Error(body?.error || body?.message || `Failed to apply playbook profile (${response.status})`);
      return body;
    },
    onSuccess: async (payload, variables) => {
      setMessage(payload?.message || "Campaign playbook profile applied.");
      setError("");
      if (variables.campaignId && payload?.playbookOnboarding) {
        queryClient.setQueryData([`/api/drinks/campaigns/${variables.campaignId}/playbook-onboarding`, user?.id ?? ""], {
          ok: true,
          campaignId: variables.campaignId,
          item: payload.playbookOnboarding,
        });
      }
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["/api/drinks/creator-dashboard/campaign-playbook-profiles"] }),
        queryClient.invalidateQueries({ queryKey: ["/api/drinks/creator-dashboard/campaign-playbook-onboarding"] }),
        queryClient.invalidateQueries({ queryKey: ["/api/drinks/creator-dashboard/campaign-playbook-drift"] }),
        variables.campaignId ? queryClient.invalidateQueries({ queryKey: [`/api/drinks/campaigns/${variables.campaignId}/playbook-onboarding`] }) : Promise.resolve(),
        variables.campaignId ? queryClient.invalidateQueries({ queryKey: [`/api/drinks/campaigns/${variables.campaignId}/playbook-drift`] }) : Promise.resolve(),
        queryClient.invalidateQueries({ queryKey: ["/api/drinks/campaigns/creator"] }),
      ]);
    },
    onError: (mutationError) => {
      setMessage("");
      setError(readErrorMessage(mutationError, "Unable to apply this playbook profile right now."));
    },
  });

  const availableCampaigns = query.data?.availableCampaigns ?? [];

  return (
    <Card id="campaign-playbook-profiles">
      <CardHeader>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="space-y-1">
            <CardTitle>Campaign Playbook Profiles / Reusable Strategies</CardTitle>
            <CardDescription>
              Save lightweight strategy presets you want to intentionally reuse later. This stays separate from full campaign templates, cloning, analytics history, and CRM-style automation.
            </CardDescription>
          </div>
          <Link href="/drinks/creator-dashboard#campaign-rollout-advisor">
            <Button variant="outline" size="sm">Open advisor layers</Button>
          </Link>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid gap-3 md:grid-cols-4">
          <div className="rounded-lg border p-3">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Saved playbooks</p>
            <p className="mt-1 text-2xl font-semibold">{query.data?.count ?? 0}</p>
          </div>
          <div className="rounded-lg border p-3">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Reusable campaigns</p>
            <p className="mt-1 text-2xl font-semibold">{availableCampaigns.length}</p>
          </div>
          <div className="rounded-lg border p-3">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Strategy fields</p>
            <p className="mt-1 text-2xl font-semibold">8+</p>
          </div>
          <div className="rounded-lg border p-3">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Scope</p>
            <p className="mt-1 text-sm font-medium">Strategy only, not full clones</p>
          </div>
        </div>

        {query.isLoading ? <p className="text-sm text-muted-foreground">Loading playbook profiles…</p> : null}
        {query.isError ? <p className="text-sm text-destructive">{readErrorMessage(query.error, "Unable to load campaign playbook profiles right now.")}</p> : null}
        {message ? <p className="text-sm text-emerald-600">{message}</p> : null}
        {error ? <p className="text-sm text-destructive">{error}</p> : null}

        <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr),minmax(0,1.25fr)]">
          <div className="space-y-4 rounded-lg border p-4">
            <div className="space-y-1">
              <h3 className="font-semibold">Create or edit a reusable strategy</h3>
              <p className="text-sm text-muted-foreground">
                Save rollout, audience, timing, CTA, and experiment preferences without copying an entire old campaign.
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="playbook-name">Playbook name</Label>
              <Input id="playbook-name" value={form.name} onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))} placeholder="Member-first launch cadence" />
            </div>

            <div className="space-y-2">
              <Label htmlFor="playbook-description">Description</Label>
              <Textarea id="playbook-description" value={form.description} onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))} rows={3} placeholder="When this strategy tends to work best." />
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="playbook-visibility">Visibility strategy</Label>
                <select id="playbook-visibility" className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" value={form.visibilityStrategy} onChange={(event) => setForm((current) => ({ ...current, visibilityStrategy: event.target.value as CampaignAudience }))}>
                  <option value="public">Public</option>
                  <option value="followers">Followers</option>
                  <option value="members">Members</option>
                </select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="playbook-rollout-mode">Rollout mode</Label>
                <select id="playbook-rollout-mode" className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" value={form.rolloutMode} onChange={(event) => setForm((current) => ({ ...current, rolloutMode: event.target.value as CampaignRolloutMode }))}>
                  <option value="public_first">Public first</option>
                  <option value="followers_first">Followers first</option>
                  <option value="members_first">Members first</option>
                  <option value="staged">Staged</option>
                </select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="playbook-starts-audience">Starts with</Label>
                <select id="playbook-starts-audience" className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" value={form.startsWithAudience} onChange={(event) => setForm((current) => ({ ...current, startsWithAudience: event.target.value as CampaignAudience }))}>
                  <option value="members">Members</option>
                  <option value="followers">Followers</option>
                  <option value="public">Public</option>
                </select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="playbook-audience-fit">Preferred audience fit</Label>
                <select id="playbook-audience-fit" className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" value={form.preferredAudienceFit} onChange={(event) => setForm((current) => ({ ...current, preferredAudienceFit: event.target.value as CampaignAudience }))}>
                  <option value="public">Public</option>
                  <option value="followers">Followers</option>
                  <option value="members">Members</option>
                </select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="playbook-follower-delay">Follower unlock delay (hours)</Label>
                <Input id="playbook-follower-delay" type="number" min={1} max={504} value={form.recommendedFollowerUnlockDelayHours} onChange={(event) => setForm((current) => ({ ...current, recommendedFollowerUnlockDelayHours: event.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="playbook-public-delay">Public unlock delay (hours)</Label>
                <Input id="playbook-public-delay" type="number" min={1} max={720} value={form.recommendedPublicUnlockDelayHours} onChange={(event) => setForm((current) => ({ ...current, recommendedPublicUnlockDelayHours: event.target.value }))} />
              </div>
              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="playbook-cta-direction">Preferred CTA direction</Label>
                <select id="playbook-cta-direction" className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" value={form.preferredCtaDirection} onChange={(event) => setForm((current) => ({ ...current, preferredCtaDirection: event.target.value as PlaybookCtaDirection }))}>
                  <option value="follow">Follow</option>
                  <option value="rsvp">RSVP</option>
                  <option value="membership">Membership</option>
                  <option value="purchase">Purchase</option>
                  <option value="drop">Drop</option>
                  <option value="mixed">Mixed</option>
                </select>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Preferred experiment types</Label>
              <div className="flex flex-wrap gap-2 rounded-md border p-3">
                {experimentOptions.map((option) => {
                  const selected = form.preferredExperimentTypes.includes(option.value);
                  return (
                    <button
                      key={option.value}
                      type="button"
                      className={`rounded-full border px-3 py-1 text-xs ${selected ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground"}`}
                      onClick={() => setForm((current) => ({
                        ...current,
                        preferredExperimentTypes: selected
                          ? current.preferredExperimentTypes.filter((item) => item !== option.value)
                          : [...current.preferredExperimentTypes, option.value].slice(0, 5),
                      }))}
                    >
                      {option.label}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="playbook-notes">Notes / reusable focus</Label>
              <Textarea id="playbook-notes" value={form.notes} onChange={(event) => setForm((current) => ({ ...current, notes: event.target.value }))} rows={4} placeholder="What usually matters most when you reuse this strategy." />
            </div>

            <div className="flex flex-wrap gap-2">
              <Button onClick={() => { setMessage(""); setError(""); saveMutation.mutate(); }} disabled={saveMutation.isPending || !form.name.trim()}>
                {saveMutation.isPending ? "Saving…" : form.id ? "Update playbook" : "Save playbook"}
              </Button>
              <Button variant="outline" onClick={() => { setMessage(""); setError(""); resetForm(); }}>
                Reset
              </Button>
            </div>
          </div>

          <div className="space-y-4">
            <div className="rounded-lg border p-4">
              <div className="space-y-1">
                <h3 className="font-semibold">Evolve or fork from a campaign</h3>
                <p className="text-sm text-muted-foreground">
                  Choose whether to overwrite only the reusable strategy fields on an existing playbook or create a fresh variant. This copies strategic defaults only — never analytics history, followers, purchases, memberships, or action state.
                </p>
              </div>
              <div className="mt-4 grid gap-3 md:grid-cols-2">
                <select className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" value={saveFromCampaignId} onChange={(event) => setSaveFromCampaignId(event.target.value)}>
                  {availableCampaigns.length === 0 ? <option value="">No campaigns available</option> : null}
                  {availableCampaigns.map((campaign) => (
                    <option key={campaign.id} value={campaign.id}>{campaign.name}</option>
                  ))}
                </select>
                <select className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" value={evolutionPlaybookId} onChange={(event) => setEvolutionPlaybookId(event.target.value)}>
                  {query.data?.items?.length === 0 ? <option value="">No saved playbooks</option> : null}
                  {query.data?.items?.map((playbook) => (
                    <option key={`evolve-${playbook.id}`} value={playbook.id}>
                      {playbook.name}{playbook.versionLabel ? ` (${playbook.versionLabel})` : ""}
                    </option>
                  ))}
                </select>
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                <Button onClick={() => { setMessage(""); setError(""); updateFromCampaignMutation.mutate(); }} disabled={updateFromCampaignMutation.isPending || !saveFromCampaignId || !evolutionPlaybookId}>
                  {updateFromCampaignMutation.isPending ? "Updating…" : "Update playbook from campaign"}
                </Button>
                <Button variant="outline" onClick={() => { setMessage(""); setError(""); createForkMutation.mutate(); }} disabled={createForkMutation.isPending || !saveFromCampaignId}>
                  {createForkMutation.isPending ? "Creating…" : "Create new playbook from this campaign"}
                </Button>
              </div>
              <p className="mt-3 text-xs text-muted-foreground">
                Updating keeps the existing playbook id. Creating new makes a forked strategy variant with lineage back to the campaign and, when possible, the source playbook.
              </p>
            </div>

            <div className="rounded-lg border p-4">
              <div className="space-y-1">
                <h3 className="font-semibold">Playbook lineage</h3>
                <p className="text-sm text-muted-foreground">
                  Lightweight origin tracking only: “based on” and “forked from,” not a giant history graph.
                </p>
              </div>
              {lineageQuery.isLoading ? <p className="mt-4 text-sm text-muted-foreground">Loading playbook lineage…</p> : null}
              {lineageQuery.isError ? <p className="mt-4 text-sm text-destructive">{readErrorMessage(lineageQuery.error, "Unable to load playbook lineage right now.")}</p> : null}
              {!lineageQuery.isLoading && !lineageQuery.isError && !lineageQuery.data?.items?.length ? (
                <p className="mt-4 text-sm text-muted-foreground">No playbook lineage yet. Once you evolve or fork from a campaign, it will show up here.</p>
              ) : null}
              <div className="mt-4 space-y-3">
                {lineageQuery.data?.items?.slice(0, 6).map((item) => (
                  <div key={`lineage-${item.id}`} className="rounded-md border border-dashed p-3 text-sm">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-medium text-foreground">{item.name}</span>
                      {item.versionLabel ? <Badge variant="secondary">{item.versionLabel}</Badge> : null}
                      {item.childCount > 0 ? <Badge variant="outline">{item.childCount} fork{item.childCount === 1 ? "" : "s"}</Badge> : null}
                    </div>
                    {item.basedOnLabel ? <p className="mt-1 text-muted-foreground">{item.basedOnLabel}</p> : <p className="mt-1 text-muted-foreground">Original saved playbook.</p>}
                    {item.sourceCampaign ? (
                      <Link href={item.sourceCampaign.route} className="mt-2 inline-flex text-xs underline underline-offset-2">
                        Source campaign: {item.sourceCampaign.name}
                      </Link>
                    ) : null}
                  </div>
                ))}
              </div>
            </div>

            {query.data?.items?.length ? (
              query.data.items.map((item) => {
                const selectedCampaignId = applyCampaignIdByProfile[item.id] ?? availableCampaigns[0]?.id ?? "";
                return (
                  <div key={item.id} className="rounded-lg border p-4">
                    <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                      <div className="space-y-2">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="font-medium">{item.name}</p>
                          {item.versionLabel ? <Badge variant="secondary">{item.versionLabel}</Badge> : null}
                          <Badge variant="secondary">{rolloutModeLabel(item.rolloutMode)}</Badge>
                          {item.preferredAudienceFit ? <Badge variant="outline">Best fit: {audienceLabel(item.preferredAudienceFit)}</Badge> : null}
                          {item.preferredCtaDirection ? <Badge variant="outline">CTA: {ctaDirectionLabel(item.preferredCtaDirection)}</Badge> : null}
                          {item.outcomeSnapshot ? <Badge variant="outline">{item.outcomeSnapshot.outcomeLabel}</Badge> : null}
                        </div>
                        {item.description ? <p className="text-sm text-muted-foreground">{item.description}</p> : null}
                        {item.basedOnLabel ? <p className="text-xs text-muted-foreground">{item.basedOnLabel}</p> : null}
                        <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                          <span>Visibility: {audienceLabel(item.visibilityStrategy)}</span>
                          <span>Starts with: {audienceLabel(item.startsWithAudience)}</span>
                          {item.recommendedFollowerUnlockDelayHours ? <span>Follower delay: {item.recommendedFollowerUnlockDelayHours}h</span> : null}
                          {item.recommendedPublicUnlockDelayHours ? <span>Public delay: {item.recommendedPublicUnlockDelayHours}h</span> : null}
                          {item.outcomeSnapshot ? <span>Applied: {item.outcomeSnapshot.appliedCount}</span> : null}
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            setMessage("");
                            setError("");
                            setForm({
                              id: item.id,
                              name: item.name,
                              description: item.description ?? "",
                              visibilityStrategy: item.visibilityStrategy ?? "public",
                              rolloutMode: item.rolloutMode,
                              startsWithAudience: item.startsWithAudience ?? "members",
                              recommendedFollowerUnlockDelayHours: item.recommendedFollowerUnlockDelayHours ? String(item.recommendedFollowerUnlockDelayHours) : "",
                              recommendedPublicUnlockDelayHours: item.recommendedPublicUnlockDelayHours ? String(item.recommendedPublicUnlockDelayHours) : "",
                              preferredCtaDirection: item.preferredCtaDirection ?? "follow",
                              preferredAudienceFit: item.preferredAudienceFit ?? "public",
                              preferredExperimentTypes: item.preferredExperimentTypes,
                              notes: item.notes ?? "",
                            });
                          }}
                        >
                          Edit
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => deleteMutation.mutate(item.id)} disabled={deleteMutation.isPending}>
                          Delete
                        </Button>
                      </div>
                    </div>

                    {item.preferredExperimentTypes.length ? (
                      <div className="mt-3 flex flex-wrap gap-2">
                        {item.preferredExperimentTypes.map((type) => (
                          <Badge key={`${item.id}-${type}`} variant="secondary">{experimentOptions.find((option) => option.value === type)?.label ?? type}</Badge>
                        ))}
                      </div>
                    ) : null}

                    {item.outcomeSnapshot?.confidenceNote ? (
                      <p className="mt-3 rounded-md border border-dashed p-3 text-sm text-muted-foreground">{item.outcomeSnapshot.confidenceNote}</p>
                    ) : null}

                    {item.notes ? <p className="mt-3 rounded-md border border-dashed p-3 text-sm text-muted-foreground">{item.notes}</p> : null}

                    <div className="mt-4 grid gap-3 md:grid-cols-[minmax(0,1fr),auto,auto]">
                      <select
                        className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                        value={selectedCampaignId}
                        onChange={(event) => setApplyCampaignIdByProfile((current) => ({ ...current, [item.id]: event.target.value }))}
                      >
                        {availableCampaigns.length === 0 ? <option value="">No campaigns available</option> : null}
                        {availableCampaigns.map((campaign) => (
                          <option key={`${item.id}-${campaign.id}`} value={campaign.id}>{campaign.name}</option>
                        ))}
                      </select>
                      <Button onClick={() => applyMutation.mutate({ profileId: item.id, campaignId: selectedCampaignId })} disabled={applyMutation.isPending || !selectedCampaignId}>
                        {applyMutation.isPending ? "Applying…" : "Apply to campaign"}
                      </Button>
                      {selectedCampaignId ? (
                        <Link href={availableCampaigns.find((campaign) => campaign.id === selectedCampaignId)?.route ?? "/drinks/creator-dashboard#campaigns"}>
                          <Button variant="outline">Open campaign</Button>
                        </Link>
                      ) : null}
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="rounded-lg border border-dashed p-5 text-sm text-muted-foreground">
                No playbook profiles yet. Save a lightweight reusable strategy here when a launch sequence, audience order, CTA direction, or timing pattern works well enough to repeat.
              </div>
            )}

            {query.data?.attributionNotes?.length ? (
              <div className="rounded-md border border-dashed p-4 text-sm text-muted-foreground">
                <p className="font-medium text-foreground">How to read this layer</p>
                <ul className="mt-2 list-disc space-y-1 pl-5">
                  {query.data.attributionNotes.map((note) => <li key={note}>{note}</li>)}
                </ul>
              </div>
            ) : null}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
