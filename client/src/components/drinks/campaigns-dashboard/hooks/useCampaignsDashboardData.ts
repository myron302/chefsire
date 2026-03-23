import { useQuery } from "@tanstack/react-query";

import { type CreatorCampaignItem } from "@/components/drinks/CreatorCampaignCard";
import {
  type CampaignTargetType,
  type CampaignTemplatesResponse,
  type CampaignsResponse,
} from "@/components/drinks/campaigns-dashboard/types";

type ContentOption = { id: string; label: string };

type ContentOptionsByType = Record<CampaignTargetType, ContentOption[]>;

export function useCampaignsDashboardData(userId: string | undefined) {
  const campaignsQuery = useQuery<CampaignsResponse>({
    queryKey: ["/api/drinks/campaigns/creator", userId ?? ""],
    queryFn: async () => {
      const response = await fetch(`/api/drinks/campaigns/creator/${encodeURIComponent(userId ?? "")}`, { credentials: "include" });
      const payload = await response.json().catch(() => null);
      if (!response.ok) throw new Error(payload?.error || payload?.message || `Failed to load campaigns (${response.status})`);
      return payload as CampaignsResponse;
    },
    enabled: Boolean(userId),
  });

  const pinnedCampaignQuery = useQuery<{ ok: boolean; campaign: CreatorCampaignItem | null }>({
    queryKey: ["/api/drinks/creator-dashboard/pinned-campaign", userId ?? ""],
    queryFn: async () => {
      const response = await fetch("/api/drinks/creator-dashboard/pinned-campaign", { credentials: "include" });
      const payload = await response.json().catch(() => null);
      if (!response.ok) throw new Error(payload?.error || payload?.message || `Failed to load pinned campaign (${response.status})`);
      return payload as { ok: boolean; campaign: CreatorCampaignItem | null };
    },
    enabled: Boolean(userId),
  });

  const templatesQuery = useQuery<CampaignTemplatesResponse>({
    queryKey: ["/api/drinks/campaign-templates", userId ?? ""],
    queryFn: async () => {
      const response = await fetch("/api/drinks/campaign-templates", { credentials: "include" });
      const payload = await response.json().catch(() => null);
      if (!response.ok) throw new Error(payload?.error || payload?.message || `Failed to load campaign templates (${response.status})`);
      return payload as CampaignTemplatesResponse;
    },
    enabled: Boolean(userId),
  });

  const collectionsQuery = useQuery<{ items: ContentOption[] }>({
    queryKey: ["/api/drinks/collections/mine", userId ?? ""],
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
    enabled: Boolean(userId),
  });

  const dropsQuery = useQuery<{ items: ContentOption[] }>({
    queryKey: ["/api/drinks/drops/creator", userId ?? ""],
    queryFn: async () => {
      const response = await fetch(`/api/drinks/drops/creator/${encodeURIComponent(userId ?? "")}`, { credentials: "include" });
      const payload = await response.json().catch(() => null);
      if (!response.ok) throw new Error(payload?.error || payload?.message || `Failed to load drops (${response.status})`);
      return {
        items: Array.isArray(payload?.items)
          ? payload.items.map((item: any) => ({ id: String(item.id), label: String(item.title ?? "Drop") }))
          : [],
      };
    },
    enabled: Boolean(userId),
  });

  const postsQuery = useQuery<{ items: ContentOption[] }>({
    queryKey: ["/api/drinks/creator-posts/creator", userId ?? ""],
    queryFn: async () => {
      const response = await fetch(`/api/drinks/creator-posts/creator/${encodeURIComponent(userId ?? "")}`, { credentials: "include" });
      const payload = await response.json().catch(() => null);
      if (!response.ok) throw new Error(payload?.error || payload?.message || `Failed to load posts (${response.status})`);
      return {
        items: Array.isArray(payload?.items)
          ? payload.items.map((item: any) => ({ id: String(item.id), label: String(item.title ?? "Post") }))
          : [],
      };
    },
    enabled: Boolean(userId),
  });

  const roadmapQuery = useQuery<{ items: ContentOption[] }>({
    queryKey: ["/api/drinks/roadmap/creator", userId ?? ""],
    queryFn: async () => {
      const response = await fetch(`/api/drinks/roadmap/creator/${encodeURIComponent(userId ?? "")}`, { credentials: "include" });
      const payload = await response.json().catch(() => null);
      if (!response.ok) throw new Error(payload?.error || payload?.message || `Failed to load roadmap (${response.status})`);
      return {
        items: Array.isArray(payload?.items)
          ? payload.items.map((item: any) => ({ id: String(item.id), label: String(item.title ?? "Roadmap note") }))
          : [],
      };
    },
    enabled: Boolean(userId),
  });

  const promotionsQuery = useQuery<{ items: ContentOption[] }>({
    queryKey: ["/api/drinks/creator-dashboard/promotions", userId ?? ""],
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
    enabled: Boolean(userId),
  });

  const challengesQuery = useQuery<{ items: ContentOption[] }>({
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

  const contentOptions: ContentOptionsByType = {
    collection: collectionsQuery.data?.items ?? [],
    drop: dropsQuery.data?.items ?? [],
    promo: promotionsQuery.data?.items ?? [],
    challenge: challengesQuery.data?.items ?? [],
    post: postsQuery.data?.items ?? [],
    roadmap: roadmapQuery.data?.items ?? [],
  };

  return {
    campaignsQuery,
    pinnedCampaignQuery,
    templatesQuery,
    contentOptions,
  };
}

export type { ContentOption, ContentOptionsByType };
