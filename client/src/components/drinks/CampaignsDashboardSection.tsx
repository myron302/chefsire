import * as React from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "wouter";

import CreatorCampaignCard, { type CreatorCampaignItem } from "@/components/drinks/CreatorCampaignCard";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
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

type CampaignVariantTargetType = "follow" | "rsvp" | "collection" | "membership" | "drop" | "challenge";
type CampaignGoalType = "followers" | "rsvps" | "clicks" | "purchases" | "membership_conversions" | "linked_drop_views";

type CampaignVariantItem = {
  id: string;
  campaignId: string;
  label: string;
  headline: string | null;
  subheadline: string | null;
  ctaText: string;
  ctaTargetType: CampaignVariantTargetType;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  metrics: {
    views: number;
    clicks: number;
    follows: number;
    rsvps: number;
    approximatePurchases: number;
    approximateMemberships: number;
  };
};

type CampaignVariantsResponse = {
  ok: boolean;
  campaignId: string;
  count: number;
  items: CampaignVariantItem[];
  attributionNotes: string[];
};

type CampaignTemplateItem = {
  id: string;
  creatorUserId: string;
  sourceCampaignId: string | null;
  name: string;
  description: string | null;
  campaignName: string;
  campaignDescription: string | null;
  visibility: CreatorCampaignItem["visibility"];
  defaults: {
    resetDates: boolean;
    copyLinkedDrafts: boolean;
    copyCtaVariants: boolean;
  };
  counts: {
    linkedItems: number;
    drops: number;
    posts: number;
    roadmap: number;
    variants: number;
  };
  createdAt: string;
  updatedAt: string;
};

type CampaignTemplatesResponse = {
  ok: boolean;
  count: number;
  items: CampaignTemplateItem[];
  basedOnPastCampaigns: Array<{ id: string; name: string; slug: string; route: string }>;
};

type CampaignGoalItem = {
  id: string;
  campaignId: string;
  goalType: CampaignGoalType;
  targetValue: number;
  label: string | null;
  createdAt: string;
  updatedAt: string;
  currentValue: number;
  percentComplete: number;
  isComplete: boolean;
  metricLabel: string;
  metricNote: string | null;
};

type CampaignGoalsResponse = {
  ok: boolean;
  campaignId: string;
  count: number;
  items: CampaignGoalItem[];
  attributionNotes: string[];
};

const campaignGoalTypeOptions: Array<{ value: CampaignGoalType; label: string }> = [
  { value: "followers", label: "Campaign followers" },
  { value: "rsvps", label: "Linked drop RSVPs" },
  { value: "clicks", label: "Linked drop clicks" },
  { value: "linked_drop_views", label: "Linked drop views" },
  { value: "purchases", label: "Linked collection purchases" },
  { value: "membership_conversions", label: "Membership conversions" },
];

function readErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}

function toLocalInput(value: string | null) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
}

function campaignGoalTypeLabel(value: CampaignGoalType) {
  return campaignGoalTypeOptions.find((option) => option.value === value)?.label ?? value;
}

function CampaignVariantManager({
  campaign,
  onChanged,
}: {
  campaign: CreatorCampaignItem | null;
  onChanged: () => Promise<unknown>;
}) {
  const queryClient = useQueryClient();
  const [message, setMessage] = React.useState("");
  const [error, setError] = React.useState("");
  const [form, setForm] = React.useState({
    id: "",
    label: "",
    headline: "",
    subheadline: "",
    ctaText: "",
    ctaTargetType: "follow" as CampaignVariantTargetType,
    isActive: false,
  });

  React.useEffect(() => {
    setMessage("");
    setError("");
    setForm({ id: "", label: "", headline: "", subheadline: "", ctaText: "", ctaTargetType: "follow", isActive: false });
  }, [campaign?.id]);

  const variantsQuery = useQuery<CampaignVariantsResponse>({
    queryKey: ["/api/drinks/campaigns/variants", campaign?.id ?? ""],
    queryFn: async () => {
      const response = await fetch(`/api/drinks/campaigns/${encodeURIComponent(campaign?.id ?? "")}/variants`, { credentials: "include" });
      const payload = await response.json().catch(() => null);
      if (!response.ok) throw new Error(payload?.error || payload?.message || `Failed to load CTA variants (${response.status})`);
      return payload as CampaignVariantsResponse;
    },
    enabled: Boolean(campaign?.id),
  });

  const refresh = React.useCallback(async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["/api/drinks/campaigns/variants", campaign?.id ?? ""] }),
      onChanged(),
    ]);
  }, [campaign?.id, onChanged, queryClient]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch(
        form.id
          ? `/api/drinks/campaigns/${encodeURIComponent(campaign?.id ?? "")}/variants/${encodeURIComponent(form.id)}`
          : `/api/drinks/campaigns/${encodeURIComponent(campaign?.id ?? "")}/variants`,
        {
          method: form.id ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({
            label: form.label.trim(),
            headline: form.headline.trim() || null,
            subheadline: form.subheadline.trim() || null,
            ctaText: form.ctaText.trim(),
            ctaTargetType: form.ctaTargetType,
            isActive: form.isActive,
          }),
        },
      );
      const payload = await response.json().catch(() => null);
      if (!response.ok) throw new Error(payload?.error || payload?.message || `Failed to save CTA variant (${response.status})`);
      return payload;
    },
    onSuccess: async () => {
      setMessage(form.id ? "CTA variant updated." : "CTA variant created.");
      setError("");
      setForm({ id: "", label: "", headline: "", subheadline: "", ctaText: "", ctaTargetType: "follow", isActive: false });
      await refresh();
    },
    onError: (mutationError) => {
      setError(readErrorMessage(mutationError, "Unable to save CTA variant right now."));
      setMessage("");
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (variantId: string) => {
      const response = await fetch(`/api/drinks/campaigns/${encodeURIComponent(campaign?.id ?? "")}/variants/${encodeURIComponent(variantId)}`, {
        method: "DELETE",
        credentials: "include",
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok) throw new Error(payload?.error || payload?.message || `Failed to delete CTA variant (${response.status})`);
      return payload;
    },
    onSuccess: async () => {
      setMessage("CTA variant deleted.");
      setError("");
      setForm({ id: "", label: "", headline: "", subheadline: "", ctaText: "", ctaTargetType: "follow", isActive: false });
      await refresh();
    },
    onError: (mutationError) => {
      setError(readErrorMessage(mutationError, "Unable to delete CTA variant right now."));
      setMessage("");
    },
  });

  const activateMutation = useMutation({
    mutationFn: async (item: CampaignVariantItem) => {
      const response = await fetch(`/api/drinks/campaigns/${encodeURIComponent(campaign?.id ?? "")}/variants/${encodeURIComponent(item.id)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ isActive: true }),
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok) throw new Error(payload?.error || payload?.message || `Failed to activate CTA variant (${response.status})`);
      return payload;
    },
    onSuccess: async () => {
      setMessage("CTA variant activated.");
      setError("");
      await refresh();
    },
    onError: (mutationError) => {
      setError(readErrorMessage(mutationError, "Unable to activate CTA variant right now."));
      setMessage("");
    },
  });

  if (!campaign) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>CTA optimization</CardTitle>
          <CardDescription>Select a campaign first, then create a few lightweight CTA frames to test different follow, RSVP, collection, or membership hooks.</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  const variants = variantsQuery.data?.items ?? [];

  return (
    <Card>
      <CardHeader>
        <CardTitle>CTA optimization · {campaign.name}</CardTitle>
        <CardDescription>
          Version one stays intentionally lightweight: a small set of creator-managed CTA variants with one active variant at a time.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="variant-label">Label</Label>
            <Input id="variant-label" value={form.label} onChange={(event) => setForm((current) => ({ ...current, label: event.target.value }))} placeholder="Follow frame" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="variant-target">CTA target</Label>
            <select id="variant-target" className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" value={form.ctaTargetType} onChange={(event) => setForm((current) => ({ ...current, ctaTargetType: event.target.value as CampaignVariantTargetType }))}>
              <option value="follow">Follow</option>
              <option value="rsvp">RSVP</option>
              <option value="collection">Collection</option>
              <option value="membership">Membership</option>
              <option value="drop">Drop</option>
              <option value="challenge">Challenge</option>
            </select>
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="variant-headline">Headline</Label>
          <Input id="variant-headline" value={form.headline} onChange={(event) => setForm((current) => ({ ...current, headline: event.target.value }))} placeholder="Follow this series" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="variant-subheadline">Subheadline</Label>
          <Textarea id="variant-subheadline" value={form.subheadline} onChange={(event) => setForm((current) => ({ ...current, subheadline: event.target.value }))} className="min-h-[90px]" placeholder="Keep this honest and native to the campaign. Example: Get notified as new release notes, drops, and launch recaps land." />
        </div>
        <div className="grid gap-4 md:grid-cols-[minmax(0,1fr),auto]">
          <div className="space-y-2">
            <Label htmlFor="variant-cta-text">CTA text</Label>
            <Input id="variant-cta-text" value={form.ctaText} onChange={(event) => setForm((current) => ({ ...current, ctaText: event.target.value }))} placeholder="Follow this series" />
          </div>
          <label className="flex items-end gap-2 text-sm">
            <input type="checkbox" checked={form.isActive} onChange={(event) => setForm((current) => ({ ...current, isActive: event.target.checked }))} />
            Make active
          </label>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button onClick={() => { setMessage(""); setError(""); saveMutation.mutate(); }} disabled={saveMutation.isPending || !form.label.trim() || !form.ctaText.trim()}>
            {saveMutation.isPending ? "Saving…" : form.id ? "Update CTA variant" : "Create CTA variant"}
          </Button>
          <Button variant="outline" onClick={() => setForm({ id: "", label: "", headline: "", subheadline: "", ctaText: "", ctaTargetType: "follow", isActive: false })}>
            Reset
          </Button>
        </div>

        {message ? <p className="text-sm text-emerald-600">{message}</p> : null}
        {error ? <p className="text-sm text-destructive">{error}</p> : null}
        {variantsQuery.isLoading ? <p className="text-sm text-muted-foreground">Loading CTA variants…</p> : null}
        {variantsQuery.isError ? <p className="text-sm text-destructive">{readErrorMessage(variantsQuery.error, "Unable to load CTA variants right now.")}</p> : null}

        <div className="space-y-3">
          {variants.map((item) => (
            <div key={item.id} className="rounded-md border p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="space-y-1">
                  <div className="flex flex-wrap gap-2">
                    <span className="rounded-full border px-2 py-0.5 text-xs text-muted-foreground">{item.label}</span>
                    <span className="rounded-full border px-2 py-0.5 text-xs text-muted-foreground">{item.ctaTargetType}</span>
                    {item.isActive ? <span className="rounded-full bg-primary px-2 py-0.5 text-xs text-primary-foreground">Active</span> : null}
                  </div>
                  <p className="font-medium">{item.headline ?? item.ctaText}</p>
                  {item.subheadline ? <p className="text-sm text-muted-foreground">{item.subheadline}</p> : null}
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button size="sm" variant="outline" onClick={() => setForm({
                    id: item.id,
                    label: item.label,
                    headline: item.headline ?? "",
                    subheadline: item.subheadline ?? "",
                    ctaText: item.ctaText,
                    ctaTargetType: item.ctaTargetType,
                    isActive: item.isActive,
                  })}>Edit</Button>
                  {!item.isActive ? (
                    <Button size="sm" variant="outline" onClick={() => activateMutation.mutate(item)} disabled={activateMutation.isPending}>
                      {activateMutation.isPending ? "Activating…" : "Activate"}
                    </Button>
                  ) : null}
                  <Button size="sm" variant="ghost" onClick={() => deleteMutation.mutate(item.id)} disabled={deleteMutation.isPending}>
                    {deleteMutation.isPending ? "Deleting…" : "Delete"}
                  </Button>
                </div>
              </div>
              <div className="mt-3 grid gap-2 sm:grid-cols-3 lg:grid-cols-6">
                <div className="rounded-md border p-2 text-sm"><p className="text-xs text-muted-foreground">Views</p><p className="font-semibold">{item.metrics.views}</p></div>
                <div className="rounded-md border p-2 text-sm"><p className="text-xs text-muted-foreground">CTA clicks</p><p className="font-semibold">{item.metrics.clicks}</p></div>
                <div className="rounded-md border p-2 text-sm"><p className="text-xs text-muted-foreground">Follows</p><p className="font-semibold">{item.metrics.follows}</p></div>
                <div className="rounded-md border p-2 text-sm"><p className="text-xs text-muted-foreground">RSVPs</p><p className="font-semibold">{item.metrics.rsvps}</p></div>
                <div className="rounded-md border p-2 text-sm"><p className="text-xs text-muted-foreground">Purchases (approx.)</p><p className="font-semibold">{item.metrics.approximatePurchases}</p></div>
                <div className="rounded-md border p-2 text-sm"><p className="text-xs text-muted-foreground">Memberships (approx.)</p><p className="font-semibold">{item.metrics.approximateMemberships}</p></div>
              </div>
            </div>
          ))}
          {!variantsQuery.isLoading && !variants.length ? (
            <p className="text-sm text-muted-foreground">No CTA variants yet. Start with one clear frame, then add another lightweight copy angle to compare over time.</p>
          ) : null}
        </div>

        {variantsQuery.data?.attributionNotes?.length ? (
          <div className="rounded-md border border-dashed p-3 text-sm text-muted-foreground">
            <p className="font-medium text-foreground">Attribution notes</p>
            <ul className="mt-2 list-disc space-y-1 pl-5">
              {variantsQuery.data.attributionNotes.map((note) => <li key={note}>{note}</li>)}
            </ul>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}

function CampaignGoalsManager({
  campaign,
  onChanged,
}: {
  campaign: CreatorCampaignItem | null;
  onChanged: () => Promise<unknown>;
}) {
  const queryClient = useQueryClient();
  const [message, setMessage] = React.useState("");
  const [error, setError] = React.useState("");
  const [form, setForm] = React.useState({
    id: "",
    goalType: "followers" as CampaignGoalType,
    targetValue: "100",
    label: "",
  });

  React.useEffect(() => {
    setMessage("");
    setError("");
    setForm({ id: "", goalType: "followers", targetValue: "100", label: "" });
  }, [campaign?.id]);

  const goalsQuery = useQuery<CampaignGoalsResponse>({
    queryKey: ["/api/drinks/campaigns/goals", campaign?.id ?? ""],
    queryFn: async () => {
      const response = await fetch(`/api/drinks/campaigns/${encodeURIComponent(campaign?.id ?? "")}/goals`, { credentials: "include" });
      const payload = await response.json().catch(() => null);
      if (!response.ok) throw new Error(payload?.error || payload?.message || `Failed to load campaign goals (${response.status})`);
      return payload as CampaignGoalsResponse;
    },
    enabled: Boolean(campaign?.id),
  });

  const refresh = React.useCallback(async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["/api/drinks/campaigns/goals", campaign?.id ?? ""] }),
      onChanged(),
    ]);
  }, [campaign?.id, onChanged, queryClient]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch(
        form.id
          ? `/api/drinks/campaigns/${encodeURIComponent(campaign?.id ?? "")}/goals/${encodeURIComponent(form.id)}`
          : `/api/drinks/campaigns/${encodeURIComponent(campaign?.id ?? "")}/goals`,
        {
          method: form.id ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({
            goalType: form.goalType,
            targetValue: Number(form.targetValue),
            label: form.label.trim() || null,
          }),
        },
      );
      const payload = await response.json().catch(() => null);
      if (!response.ok) throw new Error(payload?.error || payload?.message || `Failed to save campaign goal (${response.status})`);
      return payload;
    },
    onSuccess: async () => {
      setMessage(form.id ? "Goal updated." : "Goal created.");
      setError("");
      setForm({ id: "", goalType: "followers", targetValue: "100", label: "" });
      await refresh();
    },
    onError: (mutationError) => {
      setError(readErrorMessage(mutationError, "Unable to save campaign goal right now."));
      setMessage("");
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (goalId: string) => {
      const response = await fetch(`/api/drinks/campaigns/${encodeURIComponent(campaign?.id ?? "")}/goals/${encodeURIComponent(goalId)}`, {
        method: "DELETE",
        credentials: "include",
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok) throw new Error(payload?.error || payload?.message || `Failed to delete campaign goal (${response.status})`);
      return payload;
    },
    onSuccess: async () => {
      setMessage("Goal deleted.");
      setError("");
      setForm({ id: "", goalType: "followers", targetValue: "100", label: "" });
      await refresh();
    },
    onError: (mutationError) => {
      setError(readErrorMessage(mutationError, "Unable to delete campaign goal right now."));
      setMessage("");
    },
  });

  if (!campaign) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Goals / progress</CardTitle>
          <CardDescription>Select a campaign first, then set one or two concrete targets to keep the story arc accountable without turning it into an OKR suite.</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  const goals = goalsQuery.data?.items ?? [];

  return (
    <Card>
      <CardHeader>
        <CardTitle>Goals / progress · {campaign.name}</CardTitle>
        <CardDescription>
          Creator-set targets stay separate from system milestones. Progress is computed from existing campaign analytics, not manually entered.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="grid gap-4 md:grid-cols-[minmax(0,1fr),160px,160px]">
          <div className="space-y-2">
            <Label htmlFor="goal-label">Label</Label>
            <Input id="goal-label" value={form.label} onChange={(event) => setForm((current) => ({ ...current, label: event.target.value }))} placeholder="Summer push follower target" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="goal-type">Goal type</Label>
            <select id="goal-type" className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" value={form.goalType} onChange={(event) => setForm((current) => ({ ...current, goalType: event.target.value as CampaignGoalType }))}>
              {campaignGoalTypeOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
            </select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="goal-target">Target</Label>
            <Input id="goal-target" type="number" min={1} step={1} value={form.targetValue} onChange={(event) => setForm((current) => ({ ...current, targetValue: event.target.value }))} />
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button onClick={() => { setMessage(""); setError(""); saveMutation.mutate(); }} disabled={saveMutation.isPending || Number(form.targetValue) <= 0}>
            {saveMutation.isPending ? "Saving…" : form.id ? "Update goal" : "Add goal"}
          </Button>
          <Button variant="outline" onClick={() => setForm({ id: "", goalType: "followers", targetValue: "100", label: "" })}>Reset</Button>
        </div>

        {message ? <p className="text-sm text-emerald-600">{message}</p> : null}
        {error ? <p className="text-sm text-destructive">{error}</p> : null}
        {goalsQuery.isLoading ? <p className="text-sm text-muted-foreground">Loading goals…</p> : null}
        {goalsQuery.isError ? <p className="text-sm text-destructive">{readErrorMessage(goalsQuery.error, "Unable to load campaign goals right now.")}</p> : null}

        <div className="grid gap-3 xl:grid-cols-2">
          {goals.map((goal) => (
            <div key={goal.id} className="rounded-md border p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="space-y-1">
                  <div className="flex flex-wrap gap-2">
                    <span className="rounded-full border px-2 py-0.5 text-xs text-muted-foreground">{campaignGoalTypeLabel(goal.goalType)}</span>
                    {goal.isComplete ? <span className="rounded-full bg-primary px-2 py-0.5 text-xs text-primary-foreground">Complete</span> : null}
                  </div>
                  <p className="font-medium">{goal.label?.trim() || campaignGoalTypeLabel(goal.goalType)}</p>
                  <p className="text-sm text-muted-foreground">{goal.metricLabel}</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button size="sm" variant="outline" onClick={() => setForm({
                    id: goal.id,
                    goalType: goal.goalType,
                    targetValue: String(goal.targetValue),
                    label: goal.label ?? "",
                  })}>Edit</Button>
                  <Button size="sm" variant="ghost" onClick={() => deleteMutation.mutate(goal.id)} disabled={deleteMutation.isPending}>
                    {deleteMutation.isPending ? "Deleting…" : "Delete"}
                  </Button>
                </div>
              </div>
              <div className="mt-4 space-y-2">
                <div className="flex items-center justify-between gap-3 text-sm">
                  <span>{goal.currentValue} / {goal.targetValue}</span>
                  <span className="text-muted-foreground">{goal.percentComplete}%</span>
                </div>
                <Progress value={goal.percentComplete} className="h-2" />
                <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
                  <span>Updated from campaign analytics</span>
                  {goal.metricNote ? <span>{goal.metricNote}</span> : null}
                </div>
              </div>
            </div>
          ))}
        </div>

        {!goalsQuery.isLoading && !goals.length ? (
          <p className="text-sm text-muted-foreground">No goals yet. Start with a follower, RSVP, click, or conversion target that matches how this campaign is supposed to win.</p>
        ) : null}

        {goalsQuery.data?.attributionNotes?.length ? (
          <div className="rounded-md border border-dashed p-3 text-sm text-muted-foreground">
            <p className="font-medium text-foreground">Progress notes</p>
            <ul className="mt-2 list-disc space-y-1 pl-5">
              {goalsQuery.data.attributionNotes.map((note) => <li key={note}>{note}</li>)}
            </ul>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
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
  const [selectedCampaignId, setSelectedCampaignId] = React.useState("");

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

  const templatesQuery = useQuery<CampaignTemplatesResponse>({
    queryKey: ["/api/drinks/campaign-templates", user?.id ?? ""],
    queryFn: async () => {
      const response = await fetch("/api/drinks/campaign-templates", { credentials: "include" });
      const payload = await response.json().catch(() => null);
      if (!response.ok) throw new Error(payload?.error || payload?.message || `Failed to load campaign templates (${response.status})`);
      return payload as CampaignTemplatesResponse;
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

  const contentOptions: Record<CampaignTargetType, Array<{ id: string; label: string }>> = {
    collection: collectionsQuery.data?.items ?? [],
    drop: dropsQuery.data?.items ?? [],
    promo: promotionsQuery.data?.items ?? [],
    challenge: challengesQuery.data?.items ?? [],
    post: postsQuery.data?.items ?? [],
    roadmap: roadmapQuery.data?.items ?? [],
  };

  const campaigns = campaignsQuery.data?.items ?? [];
  const templates = templatesQuery.data?.items ?? [];
  const selectedCampaign = campaigns.find((campaign) => campaign.id === selectedCampaignId) ?? campaigns[0] ?? null;

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
                    <div className="flex items-center rounded-md border px-3 text-xs text-muted-foreground">
                      {campaign.followerCount} following
                    </div>
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
