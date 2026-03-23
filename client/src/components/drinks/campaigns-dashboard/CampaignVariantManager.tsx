import * as React from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { type CreatorCampaignItem } from "@/components/drinks/CreatorCampaignCard";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

import { readErrorMessage } from "./utils";
import { type CampaignVariantTargetType, type CampaignVariantsResponse } from "./types";

export default function CampaignVariantManager({
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
