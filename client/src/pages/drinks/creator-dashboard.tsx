import * as React from "react";
import { Link } from "wouter";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { useUser } from "@/contexts/UserContext";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import DrinksPlatformNav from "@/components/drinks/DrinksPlatformNav";
import CollectionRatingSummary from "@/components/drinks/CollectionRatingSummary";
import RemixStreakBadge from "@/components/drinks/RemixStreakBadge";
import CreatorBundlesSection from "@/components/drinks/CreatorBundlesSection";
import CampaignsDashboardSection from "@/components/drinks/CampaignsDashboardSection";
import CampaignRetrospectivesSection from "@/components/drinks/CampaignRetrospectivesSection";
import CampaignRecommendationsSection from "@/components/drinks/CampaignRecommendationsSection";
import CampaignLifecycleSuggestionsSection from "@/components/drinks/CampaignLifecycleSuggestionsSection";
import CampaignWeeklyDigestSection from "@/components/drinks/CampaignWeeklyDigestSection";
import CampaignHealthSection from "@/components/drinks/CampaignHealthSection";
import CampaignRecoveryPlansSection from "@/components/drinks/CampaignRecoveryPlansSection";
import CampaignAnalyticsSection from "@/components/drinks/CampaignAnalyticsSection";
import CampaignBenchmarksSection from "@/components/drinks/CampaignBenchmarksSection";
import DropLaunchAnalyticsSection from "@/components/drinks/DropLaunchAnalyticsSection";
import { type AcceptedCreatorCollaboration } from "@/components/drinks/CreatorCollaborationAttribution";
import CreatorDropCard, { type CreatorDropItem } from "@/components/drinks/CreatorDropCard";
import CreatorPostCard, { type CreatorPostItem } from "@/components/drinks/CreatorPostCard";
import CreatorRoadmapCard, { type CreatorRoadmapItem } from "@/components/drinks/CreatorRoadmapCard";

interface CreatorDrinkMetricsItem {
  id: string;
  slug: string;
  name: string;
  image: string | null;
  createdAt: string;
  remixedFromSlug: string | null;
  views7d: number;
  views24h: number;
  remixesCount: number;
  groceryAdds: number;
  score: number;
}

interface CreatorDrinkSummary {
  creatorRank: number | null;
  creatorScore: number;
  totalCreated: number;
  totalRemixesCreated: number;
  totalViews7d: number;
  totalRemixesReceived: number;
  totalGroceryAdds: number;
  topPerformingDrink: {
    id: string;
    slug: string;
    name: string;
    image: string | null;
    score: number;
  } | null;
  mostRemixedDrink: {
    id: string;
    slug: string;
    name: string;
    image: string | null;
    remixesCount: number;
  } | null;
  followerCount?: number;
  isFollowing?: boolean;
}

interface CreatorDrinkMetricsResponse {
  ok: boolean;
  userId: string;
  summary: CreatorDrinkSummary;
  items: CreatorDrinkMetricsItem[];
}

type CreatorActivityType = "view" | "remix" | "grocery_add" | "follow";

interface CreatorActivityItem {
  type: CreatorActivityType;
  createdAt: string;
  actorUserId: string | null;
  actorUsername: string | null;
  targetDrinkSlug: string | null;
  targetDrinkName: string | null;
  route: string | null;
  message: string;
  count?: number;
  uniqueActors?: number;
}

interface CreatorActivityResponse {
  ok: boolean;
  userId: string;
  generatedAt: string;
  items: CreatorActivityItem[];
  summary: {
    totalItems: number;
    typeCounts: Record<CreatorActivityType, number>;
    windowDays: number;
    summarized: string[];
  };
}

interface CreatorBadge {
  id: string;
  title: string;
  description: string;
  icon: string;
  isPublic: boolean;
  isEarned: boolean;
  earnedAt: string | null;
  progress: { current: number; target: number; label: string } | null;
}

interface CreatorCollectionItem {
  id: string;
  name?: string;
  isPublic: boolean;
  accessType: "public" | "premium_purchase" | "membership_only";
  isPremium: boolean;
  priceCents: number;
  acceptedCollaboration?: AcceptedCreatorCollaboration | null;
}

interface CreatorPromotionItem {
  id: string;
  collectionId: string;
  collectionName: string;
  code: string;
  discountType: "percent" | "fixed";
  discountValue: number;
  startsAt: string | null;
  endsAt: string | null;
  isActive: boolean;
  maxRedemptions: number | null;
  redemptionCount: number;
  createdAt: string;
  updatedAt: string;
}

interface CreatorPromotionsResponse {
  ok: boolean;
  promotions: CreatorPromotionItem[];
}

interface CreatorPostsResponse {
  ok: boolean;
  creatorUserId: string;
  count: number;
  items: CreatorPostItem[];
}

interface CreatorDropsResponse {
  ok: boolean;
  creatorUserId: string;
  count: number;
  items: CreatorDropItem[];
}

interface CreatorRoadmapResponse {
  ok: boolean;
  creatorUserId: string;
  count: number;
  counts: {
    upcoming: number;
    live: number;
    archived: number;
  };
  items: CreatorRoadmapItem[];
}

interface CreatorCollaborationItem {
  id: string;
  ownerCreatorUserId: string;
  collaboratorUserId: string;
  collaborationType: "collection" | "drop" | "post" | "roadmap";
  targetId: string;
  status: "pending" | "accepted" | "declined" | "revoked";
  createdAt: string;
  updatedAt: string;
  ownerCreator: {
    userId: string;
    username: string | null;
    avatar: string | null;
    route: string;
  } | null;
  collaborator: {
    userId: string;
    username: string | null;
    avatar: string | null;
    route: string;
  } | null;
  target: {
    id: string;
    title: string;
    route: string | null;
  } | null;
}

interface CreatorCollaborationsResponse {
  ok: boolean;
  userId: string;
  counts: {
    total: number;
    incomingPending: number;
    outgoingPending: number;
    accepted: number;
  };
  incoming: CreatorCollaborationItem[];
  outgoing: CreatorCollaborationItem[];
}

interface CreatorMembershipPlan {
  id: string;
  name: string;
  description: string | null;
  priceCents: number;
  billingInterval: "monthly" | "yearly";
  isActive: boolean;
  benefits: string[];
}

interface CreatorMembershipDashboardResponse {
  ok: boolean;
  userId: string;
  plan: CreatorMembershipPlan | null;
  stats: {
    activeMembers: number;
    canceledMembers: number;
    expiredMembers: number;
    totalMembers: number;
    grossRevenueCents: number;
  };
  reportingNotes: string[];
}

interface CreatorSalesCollectionItem {
  id: string;
  name: string;
  description: string | null;
  isPublic: boolean;
  priceCents: number;
  purchases: number;
  grossRevenueCents: number;
  refundedSalesCount: number;
  refundedRevenueCents: number;
  wishlistCount: number;
  averageRating: number;
  reviewCount: number;
  lastPurchasedAt: string | null;
  updatedAt: string;
  route: string;
  coverImage: string | null;
}

interface CreatorSalesReviewItem {
  id: string;
  collectionId: string;
  collectionName: string;
  collectionRoute: string;
  rating: number;
  title: string | null;
  body: string | null;
  createdAt: string;
  isVerifiedPurchase: boolean;
  user: {
    username: string | null;
    displayName: string | null;
    avatar: string | null;
  };
}

interface CreatorSalesResponse {
  ok: boolean;
  userId: string;
  totals: {
    premiumCollections: number;
    purchases: number;
    grossRevenueCents: number;
    refundedSalesCount: number;
    refundedRevenueCents: number;
    totalWishlistInterest: number;
  };
  reviewInsights: {
    averageRating: number;
    totalReviews: number;
    recentReviews: CreatorSalesReviewItem[];
  };
  collections: CreatorSalesCollectionItem[];
  reportingNotes: string[];
}

interface CreatorFinanceRecentSale {
  id: string;
  collectionId: string;
  collectionName: string;
  purchaseId: string | null;
  checkoutSessionId: string | null;
  promotionCode?: string | null;
  originalAmountCents?: number | null;
  discountAmountCents?: number | null;
  grossAmountCents: number;
  platformFeeCents: number;
  creatorShareCents: number;
  currencyCode: string;
  status: string;
  statusReason: string | null;
  refundedAt: string | null;
  createdAt: string;
  route: string;
}

interface CreatorFinanceResponse {
  ok: boolean;
  userId: string;
  summary: {
    grossSalesCents: number;
    platformFeesCents: number;
    estimatedCreatorShareCents: number;
    totalPremiumSalesCount: number;
    refundedSalesCount: number;
    refundedSalesCents: number;
    premiumCollectionsCount: number;
    estimates: {
      usesEstimatedShareFormula: boolean;
      platformFeeBps: number;
      creatorShareBps: number;
    };
  };
  recentSales: CreatorFinanceRecentSale[];
  reportingNotes: string[];
}

interface CreatorConversionCollectionItem {
  collectionId: string;
  collectionName: string;
  isPremium: boolean;
  priceCents: number;
  viewsCount: number;
  checkoutStartsCount: number;
  completedPurchasesCount: number;
  refundedCount: number;
  grossSalesCents: number;
  wishlistCount: number;
  conversionRate: number | null;
  route: string;
  isPublic: boolean;
}

interface CreatorConversionsResponse {
  ok: boolean;
  userId: string;
  summary: {
    premiumCollectionsCount: number;
    totalCollectionViews: number;
    totalCheckoutStarts: number;
    totalCompletedPurchases: number;
    totalRefundedPurchases: number;
    grossSalesCents: number;
    totalWishlistInterest: number;
    overallConversionRate: number | null;
  };
  collections: CreatorConversionCollectionItem[];
  reportingNotes: string[];
}

interface CreatorOrderItem {
  orderId: string;
  purchaseId: string | null;
  checkoutSessionId: string | null;
  collectionId: string;
  collectionName: string;
  collectionRoute: string;
  promotionCode?: string | null;
  originalAmountCents?: number | null;
  discountAmountCents?: number | null;
  grossAmountCents: number;
  currency: string;
  status: string;
  statusReason: string | null;
  purchasedAt: string;
  refundedAt: string | null;
  buyerLabel: string;
  buyerVisibility: "private";
}

interface CreatorOrdersResponse {
  ok: boolean;
  userId: string;
  count: number;
  orders: CreatorOrderItem[];
  reportingNotes: string[];
}

interface CreatorBadgesResponse {
  ok: boolean;
  userId: string;
  visibility: "private" | "public";
  badges: CreatorBadge[];
  earnedCount: number;
  totalCount: number;
  nextMilestones: Array<{
    id: string;
    title: string;
    icon: string;
    description: string;
    progress: { current: number; target: number; label: string } | null;
  }>;
}

function formatDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat(undefined, { dateStyle: "medium" }).format(date);
}

function metricNumber(value: number | null | undefined): string {
  return new Intl.NumberFormat().format(Number(value ?? 0));
}

function formatCurrency(cents: number | null | undefined, currency = "USD"): string {
  return new Intl.NumberFormat(undefined, {
    style: "currency",
    currency: currency || "USD",
  }).format(Number(cents ?? 0) / 100);
}

function formatDateTime(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(date);
}

function formatPercent(value: number | null | undefined): string {
  if (value === null || value === undefined || Number.isNaN(Number(value))) return "—";
  return `${Number(value).toFixed(1)}%`;
}

function formatPromotionDiscount(discountType: "percent" | "fixed", discountValue: number): string {
  if (discountType === "percent") return `${metricNumber(discountValue)}% off`;
  return `${formatCurrency(discountValue)} off`;
}

function saleStatusLabel(status: string): string {
  switch (status) {
    case "refunded":
      return "Refunded sale";
    case "refunded_pending":
      return "Pending refund";
    case "revoked":
      return "Revoked access";
    case "pending":
      return "Pending";
    case "completed":
    default:
      return "Completed sale";
  }
}

function saleStatusVariant(status: string): "default" | "secondary" | "outline" {
  switch (status) {
    case "completed":
      return "secondary";
    case "refunded":
    case "refunded_pending":
    case "revoked":
    default:
      return "outline";
  }
}

function activityBadgeLabel(type: CreatorActivityType): string {
  switch (type) {
    case "remix":
      return "Remix";
    case "follow":
      return "Follower";
    case "grocery_add":
      return "Grocery Add";
    case "view":
    default:
      return "View";
  }
}

function readErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message.trim()) return error.message;
  return fallback;
}

function collaborationTypeLabel(type: CreatorCollaborationItem["collaborationType"]) {
  switch (type) {
    case "collection":
      return "Collection";
    case "drop":
      return "Drop";
    case "post":
      return "Post";
    case "roadmap":
      return "Roadmap";
    default:
      return "Collaboration";
  }
}

function collaborationStatusLabel(status: CreatorCollaborationItem["status"]) {
  switch (status) {
    case "pending":
      return "Pending";
    case "accepted":
      return "Accepted";
    case "declined":
      return "Declined";
    case "revoked":
      return "Revoked";
    default:
      return status;
  }
}

export default function CreatorDashboardPage() {
  const { user, loading: userLoading } = useUser();
  const queryClient = useQueryClient();
  const [promotionForm, setPromotionForm] = React.useState({
    collectionId: "",
    code: "",
    discountType: "percent" as "percent" | "fixed",
    discountValue: "10",
    startsAt: "",
    endsAt: "",
    maxRedemptions: "",
  });
  const [promotionMessage, setPromotionMessage] = React.useState("");
  const [promotionError, setPromotionError] = React.useState("");
  const [membershipPlanForm, setMembershipPlanForm] = React.useState({
    name: "Creator Membership",
    description: "Unlock my member-only drink collections while your membership is active.",
    priceCents: "1200",
    billingInterval: "monthly" as "monthly" | "yearly",
    isActive: true,
  });
  const [membershipPlanMessage, setMembershipPlanMessage] = React.useState("");
  const [membershipPlanError, setMembershipPlanError] = React.useState("");
  const [postForm, setPostForm] = React.useState({
    id: "",
    title: "",
    body: "",
    postType: "update" as CreatorPostItem["postType"],
    visibility: "public" as CreatorPostItem["visibility"],
    linkedCollectionId: "",
    linkedChallengeId: "",
  });
  const [postMessage, setPostMessage] = React.useState("");
  const [postError, setPostError] = React.useState("");
  const [dropForm, setDropForm] = React.useState({
    id: "",
    title: "",
    description: "",
    recapNotes: "",
    dropType: "collection_launch" as CreatorDropItem["dropType"],
    visibility: "public" as CreatorDropItem["visibility"],
    scheduledFor: "",
    linkedCollectionId: "",
    linkedChallengeId: "",
    linkedPromotionId: "",
    isPublished: true,
  });
  const [dropMessage, setDropMessage] = React.useState("");
  const [dropError, setDropError] = React.useState("");
  const [roadmapForm, setRoadmapForm] = React.useState({
    id: "",
    title: "",
    description: "",
    itemType: "roadmap" as CreatorRoadmapItem["itemType"],
    visibility: "public" as CreatorRoadmapItem["visibility"],
    linkedCollectionId: "",
    linkedChallengeId: "",
    scheduledFor: "",
    releasedAt: "",
    status: "upcoming" as CreatorRoadmapItem["status"],
  });
  const [roadmapMessage, setRoadmapMessage] = React.useState("");
  const [roadmapError, setRoadmapError] = React.useState("");
  const [collaborationForm, setCollaborationForm] = React.useState({
    collaboratorUserId: "",
    collaborationType: "collection" as CreatorCollaborationItem["collaborationType"],
    targetId: "",
  });
  const [collaborationMessage, setCollaborationMessage] = React.useState("");
  const [collaborationError, setCollaborationError] = React.useState("");

  const query = useQuery<CreatorDrinkMetricsResponse>({
    queryKey: ["/api/drinks/creator", user?.id ?? ""],
    queryFn: async () => {
      const response = await fetch(`/api/drinks/creator/${encodeURIComponent(user?.id ?? "")}`, {
        credentials: "include",
      });

      const payload = await response.json().catch(() => null);

      if (!response.ok) {
        const message = payload?.error || payload?.message || `Failed to load creator dashboard (${response.status})`;
        throw new Error(String(message));
      }

      return payload as CreatorDrinkMetricsResponse;
    },
    enabled: Boolean(user?.id),
  });

  const activityQuery = useQuery<CreatorActivityResponse>({
    queryKey: ["/api/drinks/creator/activity", user?.id ?? ""],
    queryFn: async () => {
      const response = await fetch(`/api/drinks/creator/${encodeURIComponent(user?.id ?? "")}/activity`, {
        credentials: "include",
      });

      const payload = await response.json().catch(() => null);

      if (!response.ok) {
        const message = payload?.error || payload?.message || `Failed to load creator activity (${response.status})`;
        throw new Error(String(message));
      }

      return payload as CreatorActivityResponse;
    },
    enabled: Boolean(user?.id),
  });

  const badgesQuery = useQuery<CreatorBadgesResponse>({
    queryKey: ["/api/drinks/creator/badges", user?.id ?? ""],
    queryFn: async () => {
      const response = await fetch(`/api/drinks/creator/${encodeURIComponent(user?.id ?? "")}/badges`, {
        credentials: "include",
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        const message = payload?.error || payload?.message || `Failed to load creator badges (${response.status})`;
        throw new Error(String(message));
      }
      return payload as CreatorBadgesResponse;
    },
    enabled: Boolean(user?.id),
  });


  const collectionsQuery = useQuery<{ ok: boolean; collections: CreatorCollectionItem[] }>({
    queryKey: ["/api/drinks/collections/mine", user?.id ?? ""],
    queryFn: async () => {
      const response = await fetch(`/api/drinks/collections/mine`, { credentials: "include" });
      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        const message = payload?.error || payload?.message || `Failed to load collections (${response.status})`;
        throw new Error(String(message));
      }
      return payload as { ok: boolean; collections: CreatorCollectionItem[] };
    },
    enabled: Boolean(user?.id),
  });

  const salesQuery = useQuery<CreatorSalesResponse>({
    queryKey: ["/api/drinks/creator-dashboard/sales", user?.id ?? ""],
    queryFn: async () => {
      const response = await fetch("/api/drinks/creator-dashboard/sales", { credentials: "include" });
      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        const message = payload?.error || payload?.message || `Failed to load creator sales (${response.status})`;
        throw new Error(String(message));
      }
      return payload as CreatorSalesResponse;
    },
    enabled: Boolean(user?.id),
  });

  const financeQuery = useQuery<CreatorFinanceResponse>({
    queryKey: ["/api/drinks/creator-dashboard/finance", user?.id ?? ""],
    queryFn: async () => {
      const response = await fetch("/api/drinks/creator-dashboard/finance", { credentials: "include" });
      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        const message = payload?.error || payload?.message || `Failed to load creator finance (${response.status})`;
        throw new Error(String(message));
      }
      return payload as CreatorFinanceResponse;
    },
    enabled: Boolean(user?.id),
  });

  const membershipDashboardQuery = useQuery<CreatorMembershipDashboardResponse>({
    queryKey: ["/api/drinks/creator-dashboard/membership", user?.id ?? ""],
    queryFn: async () => {
      const response = await fetch("/api/drinks/creator-dashboard/membership", { credentials: "include" });
      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        const message = payload?.error || payload?.message || `Failed to load membership dashboard (${response.status})`;
        throw new Error(String(message));
      }
      return payload as CreatorMembershipDashboardResponse;
    },
    enabled: Boolean(user?.id),
  });

  const conversionsQuery = useQuery<CreatorConversionsResponse>({
    queryKey: ["/api/drinks/creator-dashboard/conversions", user?.id ?? ""],
    queryFn: async () => {
      const response = await fetch("/api/drinks/creator-dashboard/conversions", { credentials: "include" });
      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        const message = payload?.error || payload?.message || `Failed to load creator conversion analytics (${response.status})`;
        throw new Error(String(message));
      }
      return payload as CreatorConversionsResponse;
    },
    enabled: Boolean(user?.id),
  });

  const ordersQuery = useQuery<CreatorOrdersResponse>({
    queryKey: ["/api/drinks/creator-dashboard/orders", user?.id ?? ""],
    queryFn: async () => {
      const response = await fetch("/api/drinks/creator-dashboard/orders", { credentials: "include" });
      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        const message = payload?.error || payload?.message || `Failed to load creator order history (${response.status})`;
        throw new Error(String(message));
      }
      return payload as CreatorOrdersResponse;
    },
    enabled: Boolean(user?.id),
  });

  const promotionsQuery = useQuery<CreatorPromotionsResponse>({
    queryKey: ["/api/drinks/creator-dashboard/promotions", user?.id ?? ""],
    queryFn: async () => {
      const response = await fetch("/api/drinks/creator-dashboard/promotions", { credentials: "include" });
      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        const message = payload?.error || payload?.message || `Failed to load promotions (${response.status})`;
        throw new Error(String(message));
      }
      return payload as CreatorPromotionsResponse;
    },
    enabled: Boolean(user?.id),
  });

  const creatorPostsQuery = useQuery<CreatorPostsResponse>({
    queryKey: ["/api/drinks/creator-posts/creator", user?.id ?? ""],
    queryFn: async () => {
      const response = await fetch(`/api/drinks/creator-posts/creator/${encodeURIComponent(user?.id ?? "")}`, {
        credentials: "include",
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(payload?.error || payload?.message || `Failed to load creator posts (${response.status})`);
      }
      return payload as CreatorPostsResponse;
    },
    enabled: Boolean(user?.id),
  });

  const creatorDropsQuery = useQuery<CreatorDropsResponse>({
    queryKey: ["/api/drinks/drops/creator", user?.id ?? ""],
    queryFn: async () => {
      const response = await fetch(`/api/drinks/drops/creator/${encodeURIComponent(user?.id ?? "")}`, {
        credentials: "include",
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(payload?.error || payload?.message || `Failed to load creator drops (${response.status})`);
      }
      return payload as CreatorDropsResponse;
    },
    enabled: Boolean(user?.id),
  });

  const creatorRoadmapQuery = useQuery<CreatorRoadmapResponse>({
    queryKey: ["/api/drinks/roadmap/creator", user?.id ?? ""],
    queryFn: async () => {
      const response = await fetch(`/api/drinks/roadmap/creator/${encodeURIComponent(user?.id ?? "")}`, {
        credentials: "include",
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(payload?.error || payload?.message || `Failed to load creator roadmap (${response.status})`);
      }
      return payload as CreatorRoadmapResponse;
    },
    enabled: Boolean(user?.id),
  });

  const challengesQuery = useQuery<{ ok: boolean; challenges: Array<{ id: string; slug: string; title: string }> }>({
    queryKey: ["/api/drinks/challenges"],
    queryFn: async () => {
      const response = await fetch("/api/drinks/challenges", { credentials: "include" });
      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(payload?.error || payload?.message || `Failed to load challenges (${response.status})`);
      }
      const sourceItems = Array.isArray(payload?.items) ? payload.items : payload?.challenges;
      const challenges = Array.isArray(sourceItems)
        ? sourceItems.map((challenge: any) => ({
          id: String(challenge.id ?? ""),
          slug: String(challenge.slug ?? ""),
          title: String(challenge.title ?? challenge.slug ?? "Challenge"),
        }))
        : [];
      return { ok: true, challenges };
    },
    enabled: Boolean(user?.id),
  });

  const collaborationsQuery = useQuery<CreatorCollaborationsResponse>({
    queryKey: ["/api/drinks/collaborations/mine", user?.id ?? ""],
    queryFn: async () => {
      const response = await fetch("/api/drinks/collaborations/mine", { credentials: "include" });
      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(payload?.error || payload?.message || `Failed to load collaborations (${response.status})`);
      }
      return payload as CreatorCollaborationsResponse;
    },
    enabled: Boolean(user?.id),
  });

  React.useEffect(() => {
    const plan = membershipDashboardQuery.data?.plan;
    if (!plan) return;
    setMembershipPlanForm({
      name: plan.name,
      description: plan.description ?? "",
      priceCents: String(plan.priceCents ?? ""),
      billingInterval: plan.billingInterval,
      isActive: plan.isActive,
    });
  }, [membershipDashboardQuery.data?.plan?.id]);

  React.useEffect(() => {
    const targetOptionsByType: Record<CreatorCollaborationItem["collaborationType"], string[]> = {
      collection: (collectionsQuery.data?.collections ?? []).map((collection) => collection.id),
      post: (creatorPostsQuery.data?.items ?? []).map((post) => post.id),
      drop: (creatorDropsQuery.data?.items ?? []).map((drop) => drop.id),
      roadmap: (creatorRoadmapQuery.data?.items ?? []).map((item) => item.id),
    };

    const currentOptions = targetOptionsByType[collaborationForm.collaborationType] ?? [];
    if (currentOptions.length === 0) return;
    if (collaborationForm.targetId && currentOptions.includes(collaborationForm.targetId)) return;

    setCollaborationForm((current) => ({
      ...current,
      targetId: currentOptions[0] ?? "",
    }));
  }, [
    collaborationForm.collaborationType,
    collaborationForm.targetId,
    collectionsQuery.data?.collections,
    creatorPostsQuery.data?.items,
    creatorDropsQuery.data?.items,
    creatorRoadmapQuery.data?.items,
  ]);

  const saveMembershipPlanMutation = useMutation({
    mutationFn: async (payload: { name: string; description: string; priceCents: number; billingInterval: "monthly" | "yearly"; isActive: boolean }) => {
      const response = await fetch("/api/drinks/creator-dashboard/membership-plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(payload),
      });
      const data = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(data?.error || `Failed to save membership plan (${response.status})`);
      }
      return data;
    },
    onSuccess: async () => {
      setMembershipPlanMessage("Membership plan saved.");
      setMembershipPlanError("");
      await queryClient.invalidateQueries({ queryKey: ["/api/drinks/creator-dashboard/membership", user?.id ?? ""] });
    },
    onError: (error) => {
      setMembershipPlanError(readErrorMessage(error, "Unable to save membership plan right now."));
      setMembershipPlanMessage("");
    },
  });

  const createPromotionMutation = useMutation({
    mutationFn: async (payloadBody: {
      collectionId: string;
      code: string;
      discountType: "percent" | "fixed";
      discountValue: number;
      startsAt: string | null;
      endsAt: string | null;
      maxRedemptions: number | null;
    }) => {
      const response = await fetch("/api/drinks/creator-dashboard/promotions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ ...payloadBody, isActive: true }),
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(payload?.error || `Failed to create promotion (${response.status})`);
      }
      return payload;
    },
    onSuccess: async () => {
      setPromotionMessage("Promotion created.");
      setPromotionError("");
      setPromotionForm((current) => ({ ...current, code: "", discountValue: current.discountType === "percent" ? "10" : "", startsAt: "", endsAt: "", maxRedemptions: "" }));
      await queryClient.invalidateQueries({ queryKey: ["/api/drinks/creator-dashboard/promotions", user?.id ?? ""] });
    },
    onError: (error) => {
      setPromotionError(readErrorMessage(error, "Unable to create promotion right now."));
      setPromotionMessage("");
    },
  });

  const togglePromotionMutation = useMutation({
    mutationFn: async ({ id, isActive }: { id: string; isActive: boolean }) => {
      const response = await fetch(`/api/drinks/creator-dashboard/promotions/${encodeURIComponent(id)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ isActive }),
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(payload?.error || `Failed to update promotion (${response.status})`);
      }
      return payload;
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["/api/drinks/creator-dashboard/promotions", user?.id ?? ""] });
    },
  });

  const savePostMutation = useMutation({
    mutationFn: async (payloadBody: {
      id?: string;
      title: string;
      body: string;
      postType: CreatorPostItem["postType"];
      visibility: CreatorPostItem["visibility"];
      linkedCollectionId?: string | null;
      linkedChallengeId?: string | null;
    }) => {
      const isEditing = Boolean(payloadBody.id);
      const response = await fetch(
        isEditing
          ? `/api/drinks/creator-posts/${encodeURIComponent(payloadBody.id!)}`
          : "/api/drinks/creator-posts",
        {
          method: isEditing ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({
            title: payloadBody.title,
            body: payloadBody.body,
            postType: payloadBody.postType,
            visibility: payloadBody.postType === "member_only" ? "members" : payloadBody.visibility,
            linkedCollectionId: payloadBody.linkedCollectionId || null,
            linkedChallengeId: payloadBody.linkedChallengeId || null,
          }),
        },
      );
      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(payload?.error || `Failed to save creator post (${response.status})`);
      }
      return payload;
    },
    onSuccess: async (_, variables) => {
      setPostMessage(variables.id ? "Creator post updated." : "Creator post published.");
      setPostError("");
      setPostForm({
        id: "",
        title: "",
        body: "",
        postType: "update",
        visibility: "public",
        linkedCollectionId: "",
        linkedChallengeId: "",
      });
      await queryClient.invalidateQueries({ queryKey: ["/api/drinks/creator-posts/creator", user?.id ?? ""] });
      await queryClient.invalidateQueries({ queryKey: ["/api/drinks/creator-posts/feed", user?.id ?? ""] });
    },
    onError: (error) => {
      setPostError(readErrorMessage(error, "Unable to save creator post right now."));
      setPostMessage("");
    },
  });

  const deletePostMutation = useMutation({
    mutationFn: async (postId: string) => {
      const response = await fetch(`/api/drinks/creator-posts/${encodeURIComponent(postId)}`, {
        method: "DELETE",
        credentials: "include",
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(payload?.error || `Failed to delete creator post (${response.status})`);
      }
      return payload;
    },
    onSuccess: async (payload: { deletedId?: string }) => {
      if (payload?.deletedId && postForm.id === payload.deletedId) {
        setPostForm({
          id: "",
          title: "",
          body: "",
          postType: "update",
          visibility: "public",
          linkedCollectionId: "",
          linkedChallengeId: "",
        });
      }
      setPostMessage("Creator post deleted.");
      setPostError("");
      await queryClient.invalidateQueries({ queryKey: ["/api/drinks/creator-posts/creator", user?.id ?? ""] });
      await queryClient.invalidateQueries({ queryKey: ["/api/drinks/creator-posts/feed", user?.id ?? ""] });
    },
    onError: (error) => {
      setPostError(readErrorMessage(error, "Unable to delete creator post right now."));
      setPostMessage("");
    },
  });

  const saveDropMutation = useMutation({
    mutationFn: async (payloadBody: {
      id?: string;
      title: string;
      description?: string | null;
      recapNotes?: string | null;
      dropType: CreatorDropItem["dropType"];
      visibility: CreatorDropItem["visibility"];
      scheduledFor?: string;
      linkedCollectionId?: string | null;
      linkedChallengeId?: string | null;
      linkedPromotionId?: string | null;
      isPublished: boolean;
    }) => {
      const isEditing = Boolean(payloadBody.id);
      const response = await fetch(
        isEditing
          ? `/api/drinks/drops/${encodeURIComponent(payloadBody.id!)}`
          : "/api/drinks/drops",
        {
          method: isEditing ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({
            title: payloadBody.title,
            description: payloadBody.description || null,
            recapNotes: payloadBody.recapNotes || null,
            dropType: payloadBody.dropType,
            visibility: payloadBody.dropType === "member_drop" ? "members" : payloadBody.visibility,
            ...(payloadBody.scheduledFor ? { scheduledFor: new Date(payloadBody.scheduledFor).toISOString() } : {}),
            linkedCollectionId: payloadBody.linkedCollectionId || null,
            linkedChallengeId: payloadBody.linkedChallengeId || null,
            linkedPromotionId: payloadBody.linkedPromotionId || null,
            isPublished: payloadBody.isPublished,
          }),
        },
      );
      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(payload?.error || `Failed to save scheduled drop (${response.status})`);
      }
      return payload;
    },
    onSuccess: async (_, variables) => {
      setDropMessage(variables.id ? "Scheduled drop updated." : "Scheduled drop created.");
      setDropError("");
      setDropForm({
        id: "",
        title: "",
        description: "",
        recapNotes: "",
        dropType: "collection_launch",
        visibility: "public",
        scheduledFor: "",
        linkedCollectionId: "",
        linkedChallengeId: "",
        linkedPromotionId: "",
        isPublished: true,
      });
      await queryClient.invalidateQueries({ queryKey: ["/api/drinks/drops/creator", user?.id ?? ""] });
      await queryClient.invalidateQueries({ queryKey: ["/api/drinks/drops/feed", user?.id ?? ""] });
    },
    onError: (error) => {
      setDropError(readErrorMessage(error, "Unable to save scheduled drop right now."));
      setDropMessage("");
    },
  });

  const deleteDropMutation = useMutation({
    mutationFn: async (dropId: string) => {
      const response = await fetch(`/api/drinks/drops/${encodeURIComponent(dropId)}`, {
        method: "DELETE",
        credentials: "include",
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(payload?.error || `Failed to delete scheduled drop (${response.status})`);
      }
      return payload;
    },
    onSuccess: async (payload: { deletedId?: string }) => {
      if (payload?.deletedId && dropForm.id === payload.deletedId) {
        setDropForm({
          id: "",
          title: "",
          description: "",
          recapNotes: "",
          dropType: "collection_launch",
          visibility: "public",
          scheduledFor: "",
          linkedCollectionId: "",
          linkedChallengeId: "",
          linkedPromotionId: "",
          isPublished: true,
        });
      }
      setDropMessage("Scheduled drop deleted.");
      setDropError("");
      await queryClient.invalidateQueries({ queryKey: ["/api/drinks/drops/creator", user?.id ?? ""] });
      await queryClient.invalidateQueries({ queryKey: ["/api/drinks/drops/feed", user?.id ?? ""] });
    },
    onError: (error) => {
      setDropError(readErrorMessage(error, "Unable to delete scheduled drop right now."));
      setDropMessage("");
    },
  });

  const saveRoadmapMutation = useMutation({
    mutationFn: async (payloadBody: {
      id?: string;
      title: string;
      description?: string | null;
      itemType: CreatorRoadmapItem["itemType"];
      visibility: CreatorRoadmapItem["visibility"];
      linkedCollectionId?: string | null;
      linkedChallengeId?: string | null;
      scheduledFor?: string | null;
      releasedAt?: string | null;
      status: CreatorRoadmapItem["status"];
    }) => {
      const isEditing = Boolean(payloadBody.id);
      const response = await fetch(
        isEditing
          ? `/api/drinks/roadmap/${encodeURIComponent(payloadBody.id!)}`
          : "/api/drinks/roadmap",
        {
          method: isEditing ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({
            title: payloadBody.title,
            description: payloadBody.description || null,
            itemType: payloadBody.itemType,
            visibility: payloadBody.itemType === "member_drop" ? "members" : payloadBody.visibility,
            linkedCollectionId: payloadBody.linkedCollectionId || null,
            linkedChallengeId: payloadBody.linkedChallengeId || null,
            scheduledFor: payloadBody.scheduledFor ? new Date(payloadBody.scheduledFor).toISOString() : null,
            releasedAt: payloadBody.releasedAt ? new Date(payloadBody.releasedAt).toISOString() : null,
            status: payloadBody.status,
          }),
        },
      );
      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(payload?.error || `Failed to save roadmap item (${response.status})`);
      }
      return payload;
    },
    onSuccess: async (_, variables) => {
      setRoadmapMessage(variables.id ? "Roadmap item updated." : "Roadmap item created.");
      setRoadmapError("");
      setRoadmapForm({
        id: "",
        title: "",
        description: "",
        itemType: "roadmap",
        visibility: "public",
        linkedCollectionId: "",
        linkedChallengeId: "",
        scheduledFor: "",
        releasedAt: "",
        status: "upcoming",
      });
      await queryClient.invalidateQueries({ queryKey: ["/api/drinks/roadmap/creator", user?.id ?? ""] });
      await queryClient.invalidateQueries({ queryKey: ["/api/drinks/roadmap/feed", user?.id ?? ""] });
    },
    onError: (error) => {
      setRoadmapError(readErrorMessage(error, "Unable to save roadmap item right now."));
      setRoadmapMessage("");
    },
  });

  const deleteRoadmapMutation = useMutation({
    mutationFn: async (roadmapId: string) => {
      const response = await fetch(`/api/drinks/roadmap/${encodeURIComponent(roadmapId)}`, {
        method: "DELETE",
        credentials: "include",
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(payload?.error || `Failed to delete roadmap item (${response.status})`);
      }
      return payload;
    },
    onSuccess: async (payload: { deletedId?: string }) => {
      if (payload?.deletedId && roadmapForm.id === payload.deletedId) {
        setRoadmapForm({
          id: "",
          title: "",
          description: "",
          itemType: "roadmap",
          visibility: "public",
          linkedCollectionId: "",
          linkedChallengeId: "",
          scheduledFor: "",
          releasedAt: "",
          status: "upcoming",
        });
      }
      setRoadmapMessage("Roadmap item deleted.");
      setRoadmapError("");
      await queryClient.invalidateQueries({ queryKey: ["/api/drinks/roadmap/creator", user?.id ?? ""] });
      await queryClient.invalidateQueries({ queryKey: ["/api/drinks/roadmap/feed", user?.id ?? ""] });
    },
    onError: (error) => {
      setRoadmapError(readErrorMessage(error, "Unable to delete roadmap item right now."));
      setRoadmapMessage("");
    },
  });

  const inviteCollaborationMutation = useMutation({
    mutationFn: async (payloadBody: {
      collaboratorUserId: string;
      collaborationType: CreatorCollaborationItem["collaborationType"];
      targetId: string;
    }) => {
      const response = await fetch("/api/drinks/collaborations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(payloadBody),
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(payload?.error || `Failed to invite collaborator (${response.status})`);
      }
      return payload;
    },
    onSuccess: async () => {
      setCollaborationMessage("Collaboration invite sent.");
      setCollaborationError("");
      setCollaborationForm((current) => ({ ...current, collaboratorUserId: "" }));
      await queryClient.invalidateQueries({ queryKey: ["/api/drinks/collaborations/mine", user?.id ?? ""] });
      await queryClient.invalidateQueries({ queryKey: ["/api/drinks/collections/mine", user?.id ?? ""] });
      await queryClient.invalidateQueries({ queryKey: ["/api/drinks/creator-posts/creator", user?.id ?? ""] });
      await queryClient.invalidateQueries({ queryKey: ["/api/drinks/drops/creator", user?.id ?? ""] });
      await queryClient.invalidateQueries({ queryKey: ["/api/drinks/roadmap/creator", user?.id ?? ""] });
    },
    onError: (error) => {
      setCollaborationError(readErrorMessage(error, "Unable to invite collaborator right now."));
      setCollaborationMessage("");
    },
  });

  const respondToCollaborationMutation = useMutation({
    mutationFn: async ({ id, action }: { id: string; action: "accept" | "decline" }) => {
      const response = await fetch(`/api/drinks/collaborations/${encodeURIComponent(id)}/${action}`, {
        method: "POST",
        credentials: "include",
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(payload?.error || `Failed to ${action} collaboration (${response.status})`);
      }
      return payload;
    },
    onSuccess: async (_, variables) => {
      setCollaborationMessage(variables.action === "accept" ? "Collaboration accepted." : "Collaboration declined.");
      setCollaborationError("");
      await queryClient.invalidateQueries({ queryKey: ["/api/drinks/collaborations/mine", user?.id ?? ""] });
      await queryClient.invalidateQueries({ queryKey: ["/api/drinks/collections/mine", user?.id ?? ""] });
      await queryClient.invalidateQueries({ queryKey: ["/api/drinks/creator-posts/creator", user?.id ?? ""] });
      await queryClient.invalidateQueries({ queryKey: ["/api/drinks/drops/creator", user?.id ?? ""] });
      await queryClient.invalidateQueries({ queryKey: ["/api/drinks/roadmap/creator", user?.id ?? ""] });
    },
    onError: (error) => {
      setCollaborationError(readErrorMessage(error, "Unable to update collaboration invite right now."));
      setCollaborationMessage("");
    },
  });

  const revokeCollaborationMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await fetch(`/api/drinks/collaborations/${encodeURIComponent(id)}`, {
        method: "DELETE",
        credentials: "include",
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(payload?.error || `Failed to revoke collaboration (${response.status})`);
      }
      return payload;
    },
    onSuccess: async () => {
      setCollaborationMessage("Collaboration revoked.");
      setCollaborationError("");
      await queryClient.invalidateQueries({ queryKey: ["/api/drinks/collaborations/mine", user?.id ?? ""] });
      await queryClient.invalidateQueries({ queryKey: ["/api/drinks/collections/mine", user?.id ?? ""] });
      await queryClient.invalidateQueries({ queryKey: ["/api/drinks/creator-posts/creator", user?.id ?? ""] });
      await queryClient.invalidateQueries({ queryKey: ["/api/drinks/drops/creator", user?.id ?? ""] });
      await queryClient.invalidateQueries({ queryKey: ["/api/drinks/roadmap/creator", user?.id ?? ""] });
    },
    onError: (error) => {
      setCollaborationError(readErrorMessage(error, "Unable to revoke collaboration right now."));
      setCollaborationMessage("");
    },
  });

  if (userLoading) {
    return <div className="container mx-auto p-6">Loading dashboard...</div>;
  }

  if (!user) {
    return (
      <div className="container mx-auto p-6 space-y-3">
        <h1 className="text-2xl font-bold">Drink Creator Dashboard</h1>
        <p className="text-muted-foreground">Please sign in to view your creator metrics.</p>
        <DrinksPlatformNav current="dashboard" />
      </div>
    );
  }

  if (query.isLoading) {
    return <div className="container mx-auto p-6">Loading creator metrics...</div>;
  }

  const queryErrorMessage = query.isError ? readErrorMessage(query.error, "Unknown creator dashboard error") : "";

  if (query.isError || !query.data) {
    return (
      <div className="container mx-auto p-6 space-y-3">
        <h1 className="text-2xl font-bold">Drink Creator Dashboard</h1>
        <p className="text-destructive">Unable to load your dashboard right now.</p>
        {import.meta.env.DEV ? <p className="text-xs text-muted-foreground break-all">{queryErrorMessage}</p> : null}
        <DrinksPlatformNav current="dashboard" />
      </div>
    );
  }

  const { summary, items } = query.data;

  const safeSummary: CreatorDrinkSummary = {
    creatorRank: summary?.creatorRank ?? null,
    creatorScore: Number(summary?.creatorScore ?? 0),
    totalCreated: Number(summary?.totalCreated ?? 0),
    totalRemixesCreated: Number(summary?.totalRemixesCreated ?? 0),
    totalViews7d: Number(summary?.totalViews7d ?? 0),
    totalRemixesReceived: Number(summary?.totalRemixesReceived ?? 0),
    totalGroceryAdds: Number(summary?.totalGroceryAdds ?? 0),
    topPerformingDrink: summary?.topPerformingDrink ?? null,
    mostRemixedDrink: summary?.mostRemixedDrink ?? null,
    followerCount: Number(summary?.followerCount ?? 0),
    isFollowing: Boolean(summary?.isFollowing ?? false),
  };
  const safeItems = Array.isArray(items) ? items : [];
  const creatorCollections = collectionsQuery.data?.collections ?? [];
  const publicCollectionsCount = creatorCollections.filter((collection) => collection.isPublic).length;
  const premiumPurchaseCollections = creatorCollections.filter((collection) => collection.accessType === "premium_purchase");
  const memberOnlyCollections = creatorCollections.filter((collection) => collection.accessType === "membership_only");
  const freeCollectionsCount = creatorCollections.filter((collection) => collection.accessType === "public").length;
  const salesTotals = salesQuery.data?.totals ?? {
    premiumCollections: premiumPurchaseCollections.length,
    purchases: 0,
    grossRevenueCents: 0,
    refundedSalesCount: 0,
    refundedRevenueCents: 0,
    totalWishlistInterest: 0,
  };
  const salesCollections = salesQuery.data?.collections ?? [];
  const reviewInsights = salesQuery.data?.reviewInsights ?? {
    averageRating: 0,
    totalReviews: 0,
    recentReviews: [] as CreatorSalesReviewItem[],
  };
  const financeSummary = financeQuery.data?.summary ?? {
    grossSalesCents: salesTotals.grossRevenueCents,
    platformFeesCents: 0,
    estimatedCreatorShareCents: 0,
    totalPremiumSalesCount: salesTotals.purchases,
    refundedSalesCount: salesTotals.refundedSalesCount,
    refundedSalesCents: salesTotals.refundedRevenueCents,
    premiumCollectionsCount: salesTotals.premiumCollections,
    estimates: {
      usesEstimatedShareFormula: false,
      platformFeeBps: 0,
      creatorShareBps: 0,
    },
  };
  const recentFinanceSales = financeQuery.data?.recentSales ?? [];
  const membershipDashboard = membershipDashboardQuery.data ?? {
    ok: true,
    userId: user?.id ?? "",
    plan: null,
    stats: {
      activeMembers: 0,
      canceledMembers: 0,
      expiredMembers: 0,
      totalMembers: 0,
      grossRevenueCents: 0,
    },
    reportingNotes: [] as string[],
  };
  const conversionSummary = conversionsQuery.data?.summary ?? {
    premiumCollectionsCount: premiumPurchaseCollections.length,
    totalCollectionViews: 0,
    totalCheckoutStarts: 0,
    totalCompletedPurchases: salesTotals.purchases,
    totalRefundedPurchases: salesTotals.refundedSalesCount,
    grossSalesCents: salesTotals.grossRevenueCents,
    totalWishlistInterest: salesTotals.totalWishlistInterest,
    overallConversionRate: null,
  };
  const conversionCollections = conversionsQuery.data?.collections ?? [];
  const recentCreatorOrders = ordersQuery.data?.orders ?? [];
  const creatorPromotions = promotionsQuery.data?.promotions ?? [];
  const creatorPosts = creatorPostsQuery.data?.items ?? [];
  const creatorDrops = creatorDropsQuery.data?.items ?? [];
  const creatorDropsUpcomingCount = creatorDrops.filter((drop) => drop.status === "upcoming").length;
  const creatorDropsLiveCount = creatorDrops.filter((drop) => drop.status === "live").length;
  const creatorDropsArchivedCount = creatorDrops.filter((drop) => drop.status === "archived").length;
  const creatorRoadmap = creatorRoadmapQuery.data?.items ?? [];
  const collaborationIncoming = collaborationsQuery.data?.incoming ?? [];
  const collaborationOutgoing = collaborationsQuery.data?.outgoing ?? [];
  const collaborationPendingIncoming = collaborationIncoming.filter((item) => item.status === "pending");
  const collaborationAccepted = [...collaborationIncoming, ...collaborationOutgoing]
    .filter((item) => item.status === "accepted")
    .filter((item, index, all) => all.findIndex((entry) => entry.id === item.id) === index);
  const roadmapUpcoming = creatorRoadmap.filter((item) => item.status === "upcoming");
  const roadmapLive = creatorRoadmap.filter((item) => item.status === "live");
  const roadmapArchived = creatorRoadmap.filter((item) => item.status === "archived");
  const challengeOptions = challengesQuery.data?.challenges ?? [];
  const premiumCollectionOptions = premiumPurchaseCollections.map((collection) => ({
    id: collection.id,
    name: collection.name ?? `Collection ${collection.id.slice(0, 8)}`,
    priceCents: collection.priceCents,
  }));
  const creatorCollectionOptions = creatorCollections.map((collection) => ({
    id: collection.id,
    name: collection.name ?? `Collection ${collection.id.slice(0, 8)}`,
  }));
  const postCollectionOptions = creatorCollectionOptions;
  const collaborationTargetsByType: Record<CreatorCollaborationItem["collaborationType"], Array<{ id: string; label: string }>> = {
    collection: creatorCollectionOptions.map((collection) => ({ id: collection.id, label: collection.name })),
    post: creatorPosts.map((post) => ({ id: post.id, label: post.title })),
    drop: creatorDrops.map((drop) => ({ id: drop.id, label: drop.title })),
    roadmap: creatorRoadmap.map((item) => ({ id: item.id, label: item.title })),
  };
  const collaborationTargetOptions = collaborationTargetsByType[collaborationForm.collaborationType] ?? [];
  const selectedCollaborationTargetId = collaborationForm.targetId || collaborationTargetOptions[0]?.id || "";
  const selectedPromotionCollectionId = promotionForm.collectionId || premiumCollectionOptions[0]?.id || "";
  const selectedDropType = dropForm.dropType;
  const selectedDropCollectionId = dropForm.linkedCollectionId;
  const editingDrop = creatorDrops.find((drop) => drop.id === dropForm.id) ?? null;
  const isEditingNonUpcomingDrop = Boolean(editingDrop && editingDrop.status !== "upcoming");
  const availableDropPromotions = creatorPromotions.filter((promotion) => !selectedDropCollectionId || promotion.collectionId === selectedDropCollectionId);

  return (
    <div className="container mx-auto p-6 space-y-6" data-testid="drinks-creator-dashboard">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold">Drink Creator Dashboard</h1>
        <p className="text-muted-foreground">Track how your submitted drinks and remixes are performing.</p>
        <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
          <span>{metricNumber(safeSummary.followerCount ?? 0)} followers</span>
          <Badge variant="secondary">Your creator profile</Badge>
        </div>
        <div className="pt-1">
          <RemixStreakBadge />
        </div>
        <div className="flex flex-wrap gap-2 pt-1">
          <Link href="/drinks">
            <Button variant="outline" size="sm">Back to Drinks Hub</Button>
          </Link>
          <Link href="/drinks/submit">
            <Button size="sm">Submit a Drink Recipe</Button>
          </Link>
          <Link href="/drinks/notifications">
            <Button variant="outline" size="sm">Notifications Center</Button>
          </Link>
          <Link href="/drinks/feed">
            <Button variant="outline" size="sm">Creator Feed</Button>
          </Link>
          <Link href="/drinks/drops">
            <Button variant="outline" size="sm">Drops Calendar</Button>
          </Link>
          <Link href="/drinks/roadmap">
            <Button variant="outline" size="sm">Roadmap + Archive</Button>
          </Link>
        </div>
      </div>

      <DrinksPlatformNav current="dashboard" />

      <CreatorBundlesSection />

      <Card>
        <CardHeader>
          <CardTitle>Creator Milestones & Badges</CardTitle>
          <CardDescription>
            {badgesQuery.data
              ? `${metricNumber(badgesQuery.data.earnedCount)} earned badges`
              : "Progress markers for your creator journey."}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {badgesQuery.isLoading ? <p className="text-sm text-muted-foreground">Loading badges…</p> : null}
          {badgesQuery.isError ? <p className="text-sm text-destructive">Unable to load badges right now.</p> : null}
          {badgesQuery.data ? (
            <>
              {badgesQuery.data.badges.filter((badge) => badge.isEarned).length === 0 ? (
                <p className="text-sm text-muted-foreground">No badges earned yet. Publish and remix drinks to unlock your first milestone.</p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {badgesQuery.data.badges.filter((badge) => badge.isEarned).map((badge) => (
                    <Badge key={badge.id} variant="secondary" className="py-1">
                      <span className="mr-1" aria-hidden>{badge.icon}</span>{badge.title}
                    </Badge>
                  ))}
                </div>
              )}

              {badgesQuery.data.nextMilestones.length > 0 ? (
                <div className="space-y-2">
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Next milestones</p>
                  <div className="grid gap-2 sm:grid-cols-2">
                    {badgesQuery.data.nextMilestones.map((badge) => (
                      <div key={badge.id} className="rounded-md border p-2 text-sm">
                        <div className="font-medium"><span className="mr-1">{badge.icon}</span>{badge.title}</div>
                        {badge.progress ? <div className="text-xs text-muted-foreground mt-1">{metricNumber(badge.progress.current)} / {metricNumber(badge.progress.target)} {badge.progress.label.toLowerCase()}</div> : null}
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}
            </>
          ) : null}
        </CardContent>
      </Card>


      <Card>
        <CardHeader>
          <CardTitle>Creator Storefront Summary</CardTitle>
          <CardDescription>Your collections storefront and lightweight monetization setup.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-6">
            <div className="rounded-md border p-3">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Public collections</p>
              <p className="text-xl font-semibold">{metricNumber(publicCollectionsCount)}</p>
            </div>
            <div className="rounded-md border p-3">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Premium purchase</p>
              <p className="text-xl font-semibold">{metricNumber(premiumPurchaseCollections.length)}</p>
            </div>
            <div className="rounded-md border p-3">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Members only</p>
              <p className="text-xl font-semibold">{metricNumber(memberOnlyCollections.length)}</p>
            </div>
            <div className="rounded-md border p-3">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Free collections</p>
              <p className="text-xl font-semibold">{metricNumber(freeCollectionsCount)}</p>
            </div>
            <div className="rounded-md border p-3">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Wishlist interest</p>
              <p className="text-xl font-semibold">{metricNumber(salesTotals.totalWishlistInterest)}</p>
            </div>
          </div>
          {premiumPurchaseCollections.length > 0 || memberOnlyCollections.length > 0 ? (
            <p className="text-sm text-muted-foreground">
              {metricNumber(premiumPurchaseCollections.length)} premium purchase collections and {metricNumber(memberOnlyCollections.length)} members-only collections live.
              Your public creator page now highlights one-off purchase value separately from membership perks.
            </p>
          ) : (
            <p className="text-sm text-muted-foreground">No monetized collections yet. Mark a collection as Premium Purchase or Members Only to add a support path without blocking browsing.</p>
          )}
          <div className="flex flex-wrap gap-2">
            <Link href="/drinks/collections">
              <Button variant="outline" size="sm">Manage collections</Button>
            </Link>
            <Link href={`/drinks/creator/${encodeURIComponent(user?.id ?? "")}`}>
              <Button variant="outline" size="sm">View creator storefront</Button>
            </Link>
            <Link href="/drinks/collections/explore">
              <Button size="sm">Browse premium collections</Button>
            </Link>
          </div>
        </CardContent>
      </Card>

      <Card id="collaborations">
        <CardHeader>
          <CardTitle>Collaborations</CardTitle>
          <CardDescription>
            Invite one other creator onto a collection, drop, post, or roadmap item. Version one keeps this social-first for attribution and discovery, not payout splitting.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid gap-2 sm:grid-cols-4">
            <div className="rounded-md border p-3">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Accepted</p>
              <p className="text-xl font-semibold">{metricNumber(collaborationAccepted.length)}</p>
            </div>
            <div className="rounded-md border p-3">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Incoming pending</p>
              <p className="text-xl font-semibold">{metricNumber(collaborationPendingIncoming.length)}</p>
            </div>
            <div className="rounded-md border p-3">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Outgoing pending</p>
              <p className="text-xl font-semibold">{metricNumber(collaborationOutgoing.filter((item) => item.status === "pending").length)}</p>
            </div>
            <div className="rounded-md border p-3">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Supported targets</p>
              <p className="text-xl font-semibold">4</p>
            </div>
          </div>

          <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr),minmax(0,1.2fr)]">
            <div className="space-y-4 rounded-lg border p-4">
              <div className="space-y-1">
                <h3 className="font-semibold">Invite a collaborator</h3>
                <p className="text-sm text-muted-foreground">
                  Use a creator&apos;s user id for now to keep this lightweight. Accepted collabs show as public attribution across supported surfaces.
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="collaboration-user-id">Collaborator user id</Label>
                <Input
                  id="collaboration-user-id"
                  value={collaborationForm.collaboratorUserId}
                  onChange={(event) => setCollaborationForm((current) => ({ ...current, collaboratorUserId: event.target.value }))}
                  placeholder="creator user id"
                />
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="collaboration-type">Target type</Label>
                  <select
                    id="collaboration-type"
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    value={collaborationForm.collaborationType}
                    onChange={(event) => {
                      const nextType = event.target.value as CreatorCollaborationItem["collaborationType"];
                      const nextOptions = collaborationTargetsByType[nextType] ?? [];
                      setCollaborationForm((current) => ({
                        ...current,
                        collaborationType: nextType,
                        targetId: nextOptions[0]?.id ?? "",
                      }));
                    }}
                  >
                    <option value="collection">Collection</option>
                    <option value="post">Post</option>
                    <option value="drop">Drop</option>
                    <option value="roadmap">Roadmap</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="collaboration-target">Target</Label>
                  <select
                    id="collaboration-target"
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    value={selectedCollaborationTargetId}
                    onChange={(event) => setCollaborationForm((current) => ({ ...current, targetId: event.target.value }))}
                  >
                    {collaborationTargetOptions.length === 0 ? <option value="">No eligible targets yet</option> : null}
                    {collaborationTargetOptions.map((target) => (
                      <option key={target.id} value={target.id}>{target.label}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="rounded-md border border-dashed p-3 text-xs text-muted-foreground">
                Collaborations stay lightweight in version one: one extra collaborator per supported target, explicit invite acceptance, and no automatic revenue sharing.
              </div>

              <div className="flex flex-wrap gap-2">
                <Button
                  onClick={() => {
                    setCollaborationMessage("");
                    setCollaborationError("");
                    inviteCollaborationMutation.mutate({
                      collaboratorUserId: collaborationForm.collaboratorUserId.trim(),
                      collaborationType: collaborationForm.collaborationType,
                      targetId: selectedCollaborationTargetId,
                    });
                  }}
                  disabled={inviteCollaborationMutation.isPending || !collaborationForm.collaboratorUserId.trim() || !selectedCollaborationTargetId}
                >
                  {inviteCollaborationMutation.isPending ? "Sending invite…" : "Send invite"}
                </Button>
                <Button
                  variant="outline"
                  onClick={() => {
                    setCollaborationMessage("");
                    setCollaborationError("");
                    setCollaborationForm({
                      collaboratorUserId: "",
                      collaborationType: "collection",
                      targetId: collaborationTargetsByType.collection[0]?.id ?? "",
                    });
                  }}
                >
                  Reset
                </Button>
              </div>

              {collaborationMessage ? <p className="text-sm text-emerald-600">{collaborationMessage}</p> : null}
              {collaborationError ? <p className="text-sm text-destructive">{collaborationError}</p> : null}
            </div>

            <div className="space-y-4">
              {collaborationsQuery.isLoading ? <p className="text-sm text-muted-foreground">Loading collaborations…</p> : null}
              {collaborationsQuery.isError ? <p className="text-sm text-destructive">{readErrorMessage(collaborationsQuery.error, "Unable to load collaborations right now.")}</p> : null}

              <div className="space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <h3 className="font-semibold">Incoming invites</h3>
                  <span className="text-xs text-muted-foreground">{metricNumber(collaborationIncoming.length)} total</span>
                </div>
                {collaborationIncoming.length === 0 ? (
                  <Card>
                    <CardContent className="p-4 text-sm text-muted-foreground">No incoming collaboration invites right now.</CardContent>
                  </Card>
                ) : (
                  collaborationIncoming.map((item) => (
                    <Card key={item.id}>
                      <CardContent className="space-y-3 p-4">
                        <div className="flex flex-wrap items-center gap-2">
                          <Badge variant="secondary">{collaborationTypeLabel(item.collaborationType)}</Badge>
                          <Badge variant={item.status === "accepted" ? "secondary" : item.status === "pending" ? "outline" : "default"}>{collaborationStatusLabel(item.status)}</Badge>
                        </div>
                        <div className="space-y-1">
                          <p className="font-medium">{item.target?.title ?? "Untitled target"}</p>
                          <p className="text-sm text-muted-foreground">
                            Invite from {item.ownerCreator?.username ? `@${item.ownerCreator.username}` : "creator"}.
                          </p>
                          {item.target?.route ? <Link href={item.target.route} className="text-xs underline underline-offset-2">Open target</Link> : null}
                        </div>
                        {item.status === "pending" ? (
                          <div className="flex flex-wrap gap-2">
                            <Button size="sm" onClick={() => respondToCollaborationMutation.mutate({ id: item.id, action: "accept" })} disabled={respondToCollaborationMutation.isPending}>
                              Accept
                            </Button>
                            <Button size="sm" variant="outline" onClick={() => respondToCollaborationMutation.mutate({ id: item.id, action: "decline" })} disabled={respondToCollaborationMutation.isPending}>
                              Decline
                            </Button>
                          </div>
                        ) : null}
                      </CardContent>
                    </Card>
                  ))
                )}
              </div>

              <div className="space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <h3 className="font-semibold">Outgoing + active</h3>
                  <span className="text-xs text-muted-foreground">{metricNumber(collaborationOutgoing.length)} total</span>
                </div>
                {collaborationOutgoing.length === 0 ? (
                  <Card>
                    <CardContent className="p-4 text-sm text-muted-foreground">No outgoing collaboration invites yet.</CardContent>
                  </Card>
                ) : (
                  collaborationOutgoing.map((item) => (
                    <Card key={item.id}>
                      <CardContent className="space-y-3 p-4">
                        <div className="flex flex-wrap items-center gap-2">
                          <Badge variant="secondary">{collaborationTypeLabel(item.collaborationType)}</Badge>
                          <Badge variant={item.status === "accepted" ? "secondary" : item.status === "pending" ? "outline" : "default"}>{collaborationStatusLabel(item.status)}</Badge>
                        </div>
                        <div className="space-y-1">
                          <p className="font-medium">{item.target?.title ?? "Untitled target"}</p>
                          <p className="text-sm text-muted-foreground">
                            With {item.collaborator?.username ? `@${item.collaborator.username}` : "creator"}.
                          </p>
                          {item.target?.route ? <Link href={item.target.route} className="text-xs underline underline-offset-2">Open target</Link> : null}
                        </div>
                        {(item.status === "pending" || item.status === "accepted") ? (
                          <div className="flex flex-wrap gap-2">
                            <Button size="sm" variant="outline" onClick={() => revokeCollaborationMutation.mutate(item.id)} disabled={revokeCollaborationMutation.isPending}>
                              {revokeCollaborationMutation.isPending ? "Updating…" : item.status === "accepted" ? "Revoke collab" : "Cancel invite"}
                            </Button>
                          </div>
                        ) : null}
                      </CardContent>
                    </Card>
                  ))
                )}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card id="posts">
        <CardHeader>
          <CardTitle>Posts</CardTitle>
          <CardDescription>
            Publish lightweight creator posts for launches, member updates, promos, and challenge notes without rebuilding the drinks platform into a full social network.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid gap-2 sm:grid-cols-4">
            <div className="rounded-md border p-3">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Total posts</p>
              <p className="text-xl font-semibold">{metricNumber(creatorPosts.length)}</p>
            </div>
            <div className="rounded-md border p-3">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Public</p>
              <p className="text-xl font-semibold">{metricNumber(creatorPosts.filter((post) => post.visibility === "public").length)}</p>
            </div>
            <div className="rounded-md border p-3">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Followers</p>
              <p className="text-xl font-semibold">{metricNumber(creatorPosts.filter((post) => post.visibility === "followers").length)}</p>
            </div>
            <div className="rounded-md border p-3">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Members</p>
              <p className="text-xl font-semibold">{metricNumber(creatorPosts.filter((post) => post.visibility === "members").length)}</p>
            </div>
          </div>

          <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr),minmax(0,1.2fr)]">
            <div className="space-y-4 rounded-lg border p-4">
              <div className="space-y-1">
                <h3 className="font-semibold">{postForm.id ? "Edit post" : "New creator post"}</h3>
                <p className="text-sm text-muted-foreground">
                  Keep it concise. Version one supports text plus optional collection or challenge links.
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="post-title">Title</Label>
                <Input id="post-title" value={postForm.title} onChange={(event) => setPostForm((current) => ({ ...current, title: event.target.value }))} placeholder="Spring membership update" />
              </div>

              <div className="space-y-2">
                <Label htmlFor="post-body">Body</Label>
                <Textarea id="post-body" value={postForm.body} onChange={(event) => setPostForm((current) => ({ ...current, body: event.target.value }))} placeholder="Tell followers or members what changed, launched, or is now available." className="min-h-[140px]" />
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="post-type">Post type</Label>
                  <select
                    id="post-type"
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    value={postForm.postType}
                    onChange={(event) => {
                      const nextType = event.target.value as CreatorPostItem["postType"];
                      setPostForm((current) => ({
                        ...current,
                        postType: nextType,
                        visibility: nextType === "member_only" ? "members" : current.visibility,
                      }));
                    }}
                  >
                    <option value="update">Update</option>
                    <option value="promo">Promo</option>
                    <option value="collection_launch">Collection launch</option>
                    <option value="challenge">Challenge</option>
                    <option value="member_only">Member-only update</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="post-visibility">Visibility</Label>
                  <select
                    id="post-visibility"
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    value={postForm.postType === "member_only" ? "members" : postForm.visibility}
                    onChange={(event) => setPostForm((current) => ({ ...current, visibility: event.target.value as CreatorPostItem["visibility"] }))}
                    disabled={postForm.postType === "member_only"}
                  >
                    <option value="public">Public</option>
                    <option value="followers">Followers</option>
                    <option value="members">Members</option>
                  </select>
                  <p className="text-xs text-muted-foreground">
                    Public → anyone. Followers → followed users and you. Members → active members and you.
                  </p>
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="post-linked-collection">Linked collection</Label>
                  <select
                    id="post-linked-collection"
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    value={postForm.linkedCollectionId}
                    onChange={(event) => setPostForm((current) => ({ ...current, linkedCollectionId: event.target.value }))}
                  >
                    <option value="">No linked collection</option>
                    {postCollectionOptions.map((collection) => (
                      <option key={collection.id} value={collection.id}>{collection.name}</option>
                    ))}
                  </select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="post-linked-challenge">Linked challenge</Label>
                  <select
                    id="post-linked-challenge"
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    value={postForm.linkedChallengeId}
                    onChange={(event) => setPostForm((current) => ({ ...current, linkedChallengeId: event.target.value }))}
                  >
                    <option value="">No linked challenge</option>
                    {challengeOptions.map((challenge) => (
                      <option key={challenge.id} value={challenge.id}>{challenge.title}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="flex flex-wrap gap-2">
                <Button
                  onClick={() => {
                    setPostMessage("");
                    setPostError("");
                    savePostMutation.mutate({
                      id: postForm.id || undefined,
                      title: postForm.title.trim(),
                      body: postForm.body.trim(),
                      postType: postForm.postType,
                      visibility: postForm.postType === "member_only" ? "members" : postForm.visibility,
                      linkedCollectionId: postForm.linkedCollectionId || null,
                      linkedChallengeId: postForm.linkedChallengeId || null,
                    });
                  }}
                  disabled={savePostMutation.isPending || !postForm.title.trim() || !postForm.body.trim()}
                >
                  {savePostMutation.isPending ? "Saving post…" : postForm.id ? "Update post" : "Publish post"}
                </Button>
                <Button
                  variant="outline"
                  onClick={() => {
                    setPostMessage("");
                    setPostError("");
                    setPostForm({
                      id: "",
                      title: "",
                      body: "",
                      postType: "update",
                      visibility: "public",
                      linkedCollectionId: "",
                      linkedChallengeId: "",
                    });
                  }}
                >
                  Reset
                </Button>
                <Link href="/drinks/feed"><Button variant="ghost">Open creator feed</Button></Link>
              </div>

              {postMessage ? <p className="text-sm text-emerald-600">{postMessage}</p> : null}
              {postError ? <p className="text-sm text-destructive">{postError}</p> : null}
            </div>

            <div className="space-y-3">
              {creatorPostsQuery.isLoading ? <p className="text-sm text-muted-foreground">Loading creator posts…</p> : null}
              {creatorPostsQuery.isError ? <p className="text-sm text-destructive">{readErrorMessage(creatorPostsQuery.error, "Unable to load creator posts right now.")}</p> : null}
              {!creatorPostsQuery.isLoading && !creatorPostsQuery.isError && creatorPosts.length === 0 ? (
                <Card>
                  <CardContent className="p-4 text-sm text-muted-foreground">
                    No creator posts yet. Start with a public update, a follower-facing announcement, or a member-only note tied to a collection or challenge.
                  </CardContent>
                </Card>
              ) : null}
              {creatorPosts.map((post) => (
                <CreatorPostCard
                  key={post.id}
                  post={post}
                  showCreator={false}
                  actions={(
                    <>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          setPostMessage("");
                          setPostError("");
                          setPostForm({
                            id: post.id,
                            title: post.title,
                            body: post.body,
                            postType: post.postType,
                            visibility: post.visibility,
                            linkedCollectionId: post.linkedCollection?.id ?? "",
                            linkedChallengeId: post.linkedChallenge?.id ?? "",
                          });
                          window.location.hash = "posts";
                        }}
                      >
                        Edit
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          setPostMessage("");
                          setPostError("");
                          deletePostMutation.mutate(post.id);
                        }}
                        disabled={deletePostMutation.isPending}
                      >
                        {deletePostMutation.isPending ? "Deleting…" : "Delete"}
                      </Button>
                    </>
                  )}
                />
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      <Card id="drops">
        <CardHeader>
          <CardTitle>Scheduled Drops</CardTitle>
          <CardDescription>
            Schedule lightweight collection launches, promos, member drops, and challenge announcements so followers know what is coming, then add simple replay notes once the release has gone live.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid gap-2 sm:grid-cols-4">
            <div className="rounded-md border p-3">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Upcoming</p>
              <p className="text-xl font-semibold">{metricNumber(creatorDropsUpcomingCount)}</p>
            </div>
            <div className="rounded-md border p-3">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Live now</p>
              <p className="text-xl font-semibold">{metricNumber(creatorDropsLiveCount)}</p>
            </div>
            <div className="rounded-md border p-3">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Archived</p>
              <p className="text-xl font-semibold">{metricNumber(creatorDropsArchivedCount)}</p>
            </div>
            <div className="rounded-md border p-3">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Member visibility</p>
              <p className="text-xl font-semibold">{metricNumber(creatorDrops.filter((drop) => drop.visibility === "members").length)}</p>
            </div>
          </div>

          <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr),minmax(0,1.2fr)]">
            <div className="space-y-4 rounded-lg border p-4">
              <div className="space-y-1">
                <h3 className="font-semibold">{dropForm.id ? "Edit drop page" : "New scheduled drop"}</h3>
                <p className="text-sm text-muted-foreground">
                  Version one stays simple: title, timing, visibility, linked entities, and lightweight recap notes that can be added once the launch is live or past.
                </p>
              </div>

              {editingDrop ? (
                <div className="rounded-md border bg-muted/30 p-3 text-sm">
                  <p className="font-medium">Current lifecycle state: {editingDrop.status === "upcoming" ? "Upcoming" : editingDrop.status === "live" ? "Live now" : "Archived / replay"}</p>
                  <p className="text-muted-foreground">
                    {editingDrop.status === "upcoming"
                      ? "Upcoming drops can still be rescheduled or fully edited before launch."
                      : editingDrop.status === "live"
                        ? "Live drops keep their original launch time locked so you can add highlight text without breaking go-live behavior."
                        : "Archived drops stay editable for recap notes and linked release context, while the original launch time remains fixed."}
                  </p>
                </div>
              ) : null}

              <div className="space-y-2">
                <Label htmlFor="drop-title">Title</Label>
                <Input id="drop-title" value={dropForm.title} onChange={(event) => setDropForm((current) => ({ ...current, title: event.target.value }))} placeholder="Summer spritz collection launches Friday" />
              </div>

              <div className="space-y-2">
                <Label htmlFor="drop-description">Description</Label>
                <Textarea id="drop-description" value={dropForm.description} onChange={(event) => setDropForm((current) => ({ ...current, description: event.target.value }))} placeholder="Optional context for what is dropping and who should care." className="min-h-[120px]" />
              </div>

              <div className="space-y-2">
                <Label htmlFor="drop-recap-notes">Launch recap / release notes</Label>
                <Textarea
                  id="drop-recap-notes"
                  value={dropForm.recapNotes}
                  onChange={(event) => setDropForm((current) => ({ ...current, recapNotes: event.target.value }))}
                  placeholder="Add lightweight recap notes, launch highlights, or release context once this drop is live or archived."
                  className="min-h-[120px]"
                />
                <p className="text-xs text-muted-foreground">Simple text only for version one. This shows on the replay page and can also act as a live launch highlight.</p>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="drop-type">Drop type</Label>
                  <select
                    id="drop-type"
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    value={dropForm.dropType}
                    onChange={(event) => {
                      const nextType = event.target.value as CreatorDropItem["dropType"];
                      setDropForm((current) => ({
                        ...current,
                        dropType: nextType,
                        visibility: nextType === "member_drop" ? "members" : current.visibility,
                        linkedPromotionId: nextType === "promo_launch" ? current.linkedPromotionId : "",
                      }));
                    }}
                  >
                    <option value="collection_launch">Collection launch</option>
                    <option value="promo_launch">Promo launch</option>
                    <option value="member_drop">Member drop</option>
                    <option value="challenge_launch">Challenge launch</option>
                    <option value="update">Update</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="drop-scheduled-for">Scheduled for</Label>
                  <Input
                    id="drop-scheduled-for"
                    type="datetime-local"
                    value={dropForm.scheduledFor}
                    onChange={(event) => setDropForm((current) => ({ ...current, scheduledFor: event.target.value }))}
                    disabled={isEditingNonUpcomingDrop}
                  />
                  {isEditingNonUpcomingDrop ? <p className="text-xs text-muted-foreground">Launch timing is locked after go-live so recap updates do not break lifecycle automation.</p> : null}
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="drop-visibility">Visibility</Label>
                  <select
                    id="drop-visibility"
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    value={dropForm.dropType === "member_drop" ? "members" : dropForm.visibility}
                    onChange={(event) => setDropForm((current) => ({ ...current, visibility: event.target.value as CreatorDropItem["visibility"] }))}
                    disabled={dropForm.dropType === "member_drop"}
                  >
                    <option value="public">Public</option>
                    <option value="followers">Followers</option>
                    <option value="members">Members</option>
                  </select>
                  <p className="text-xs text-muted-foreground">Public → anyone. Followers → followed users + you. Members → active members + you.</p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="drop-published">Publishing</Label>
                  <select
                    id="drop-published"
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    value={dropForm.isPublished ? "published" : "draft"}
                    onChange={(event) => setDropForm((current) => ({ ...current, isPublished: event.target.value === "published" }))}
                  >
                    <option value="published">Published in drops feed</option>
                    <option value="draft">Draft only for me</option>
                  </select>
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="drop-linked-collection">Linked collection</Label>
                  <select
                    id="drop-linked-collection"
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    value={dropForm.linkedCollectionId}
                    onChange={(event) => setDropForm((current) => ({ ...current, linkedCollectionId: event.target.value, linkedPromotionId: current.linkedPromotionId && event.target.value !== current.linkedCollectionId ? "" : current.linkedPromotionId }))}
                  >
                    <option value="">No linked collection</option>
                    {creatorCollectionOptions.map((collection) => (
                      <option key={collection.id} value={collection.id}>{collection.name}</option>
                    ))}
                  </select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="drop-linked-challenge">Linked challenge</Label>
                  <select
                    id="drop-linked-challenge"
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    value={dropForm.linkedChallengeId}
                    onChange={(event) => setDropForm((current) => ({ ...current, linkedChallengeId: event.target.value }))}
                  >
                    <option value="">No linked challenge</option>
                    {challengeOptions.map((challenge) => (
                      <option key={challenge.id} value={challenge.id}>{challenge.title}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="drop-linked-promotion">Linked promo</Label>
                <select
                  id="drop-linked-promotion"
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  value={dropForm.linkedPromotionId}
                  onChange={(event) => setDropForm((current) => ({ ...current, linkedPromotionId: event.target.value }))}
                  disabled={selectedDropType !== "promo_launch"}
                >
                  <option value="">{selectedDropType === "promo_launch" ? "Select a promo" : "Promo links are only for promo launches"}</option>
                  {availableDropPromotions.map((promotion) => (
                    <option key={promotion.id} value={promotion.id}>{promotion.collectionName} · {promotion.code}</option>
                  ))}
                </select>
                <p className="text-xs text-muted-foreground">Promo launches can point at an active or upcoming collection promo code.</p>
              </div>

              <div className="flex flex-wrap gap-2">
                <Button
                  onClick={() => {
                    setDropMessage("");
                    setDropError("");
                    saveDropMutation.mutate({
                      id: dropForm.id || undefined,
                      title: dropForm.title.trim(),
                      description: dropForm.description.trim(),
                      recapNotes: dropForm.recapNotes.trim(),
                      dropType: dropForm.dropType,
                      visibility: dropForm.dropType === "member_drop" ? "members" : dropForm.visibility,
                      scheduledFor: isEditingNonUpcomingDrop ? undefined : dropForm.scheduledFor,
                      linkedCollectionId: dropForm.linkedCollectionId || null,
                      linkedChallengeId: dropForm.linkedChallengeId || null,
                      linkedPromotionId: dropForm.linkedPromotionId || null,
                      isPublished: dropForm.isPublished,
                    });
                  }}
                  disabled={saveDropMutation.isPending || !dropForm.title.trim() || !dropForm.scheduledFor}
                >
                  {saveDropMutation.isPending ? "Saving drop…" : dropForm.id ? "Update drop" : "Create drop"}
                </Button>
                <Button
                  variant="outline"
                  onClick={() => {
                    setDropMessage("");
                    setDropError("");
                    setDropForm({
                      id: "",
                      title: "",
                      description: "",
                      recapNotes: "",
                      dropType: "collection_launch",
                      visibility: "public",
                      scheduledFor: "",
                      linkedCollectionId: "",
                      linkedChallengeId: "",
                      linkedPromotionId: "",
                      isPublished: true,
                    });
                  }}
                >
                  Reset
                </Button>
                <Link href="/drinks/drops"><Button variant="ghost">Open drops page</Button></Link>
              </div>

              {dropMessage ? <p className="text-sm text-emerald-600">{dropMessage}</p> : null}
              {dropError ? <p className="text-sm text-destructive">{dropError}</p> : null}
            </div>

            <div className="space-y-3">
              {creatorDropsQuery.isLoading ? <p className="text-sm text-muted-foreground">Loading scheduled drops…</p> : null}
              {creatorDropsQuery.isError ? <p className="text-sm text-destructive">{readErrorMessage(creatorDropsQuery.error, "Unable to load scheduled drops right now.")}</p> : null}
              {!creatorDropsQuery.isLoading && !creatorDropsQuery.isError && creatorDrops.length === 0 ? (
                <Card>
                  <CardContent className="p-4 text-sm text-muted-foreground">
                    No drops yet. Schedule a public launch, a follower-only teaser, or a member drop tied to a collection, promo, or challenge, and the dashboard will label each one as upcoming, live, or archived automatically.
                  </CardContent>
                </Card>
              ) : null}
              {creatorDrops.map((drop) => (
                <CreatorDropCard
                  key={drop.id}
                  drop={drop}
                  showCreator={false}
                  actions={(
                    <>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          setDropMessage("");
                          setDropError("");
                          const scheduledDate = new Date(drop.scheduledFor);
                          const localValue = Number.isNaN(scheduledDate.getTime()) ? "" : new Date(scheduledDate.getTime() - scheduledDate.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
                          setDropForm({
                            id: drop.id,
                            title: drop.title,
                            description: drop.description ?? "",
                            recapNotes: drop.recapNotes ?? "",
                            dropType: drop.dropType,
                            visibility: drop.visibility,
                            scheduledFor: localValue,
                            linkedCollectionId: drop.linkedCollection?.id ?? "",
                            linkedChallengeId: drop.linkedChallenge?.id ?? "",
                            linkedPromotionId: drop.linkedPromotion?.id ?? "",
                            isPublished: drop.isPublished,
                          });
                          window.location.hash = "drops";
                        }}
                      >
                        {drop.status === "upcoming" ? "Edit" : drop.recapNotes ? "Edit recap" : "Add recap"}
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          setDropMessage("");
                          setDropError("");
                          deleteDropMutation.mutate(drop.id);
                        }}
                        disabled={deleteDropMutation.isPending}
                      >
                        {deleteDropMutation.isPending ? "Deleting…" : "Delete"}
                      </Button>
                    </>
                  )}
                />
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      <CampaignsDashboardSection />
      <CampaignRetrospectivesSection />
      <CampaignBenchmarksSection />
      <CampaignWeeklyDigestSection />
      <CampaignHealthSection />
      <CampaignRecoveryPlansSection />
      <CampaignLifecycleSuggestionsSection />
      <CampaignRecommendationsSection />

      <CampaignAnalyticsSection />

      <DropLaunchAnalyticsSection />

      <Card id="roadmap">
        <CardHeader>
          <CardTitle>Roadmap + Archive</CardTitle>
          <CardDescription>
            Tell an ongoing creator story without replacing posts or drops: what is coming next, what is live now, and what already shipped for followers and members.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid gap-2 sm:grid-cols-4">
            <div className="rounded-md border p-3">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Roadmap items</p>
              <p className="text-xl font-semibold">{metricNumber(creatorRoadmap.length)}</p>
            </div>
            <div className="rounded-md border p-3">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Upcoming</p>
              <p className="text-xl font-semibold">{metricNumber(roadmapUpcoming.length)}</p>
            </div>
            <div className="rounded-md border p-3">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Live now</p>
              <p className="text-xl font-semibold">{metricNumber(roadmapLive.length)}</p>
            </div>
            <div className="rounded-md border p-3">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Archive</p>
              <p className="text-xl font-semibold">{metricNumber(roadmapArchived.length)}</p>
            </div>
          </div>

          <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr),minmax(0,1.2fr)]">
            <div className="space-y-4 rounded-lg border p-4">
              <div className="space-y-1">
                <h3 className="font-semibold">{roadmapForm.id ? "Edit roadmap item" : "New roadmap item"}</h3>
                <p className="text-sm text-muted-foreground">
                  Keep this lightweight: a short title, quick context, visibility, status, and optional links back to a collection or challenge.
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="roadmap-title">Title</Label>
                <Input id="roadmap-title" value={roadmapForm.title} onChange={(event) => setRoadmapForm((current) => ({ ...current, title: event.target.value }))} placeholder="Members get early access to the citrus flight next week" />
              </div>

              <div className="space-y-2">
                <Label htmlFor="roadmap-description">Description</Label>
                <Textarea id="roadmap-description" value={roadmapForm.description} onChange={(event) => setRoadmapForm((current) => ({ ...current, description: event.target.value }))} placeholder="A few lines of context about what is changing, who it is for, or why it mattered." className="min-h-[120px]" />
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="roadmap-item-type">Item type</Label>
                  <select
                    id="roadmap-item-type"
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    value={roadmapForm.itemType}
                    onChange={(event) => {
                      const nextType = event.target.value as CreatorRoadmapItem["itemType"];
                      setRoadmapForm((current) => ({
                        ...current,
                        itemType: nextType,
                        visibility: nextType === "member_drop" ? "members" : current.visibility,
                      }));
                    }}
                  >
                    <option value="roadmap">Roadmap note</option>
                    <option value="collection">Collection</option>
                    <option value="promo">Promo</option>
                    <option value="challenge">Challenge</option>
                    <option value="member_drop">Member drop</option>
                    <option value="update">Update</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="roadmap-status">Status</Label>
                  <select
                    id="roadmap-status"
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    value={roadmapForm.status}
                    onChange={(event) => setRoadmapForm((current) => ({ ...current, status: event.target.value as CreatorRoadmapItem["status"] }))}
                  >
                    <option value="upcoming">Upcoming</option>
                    <option value="live">Live now</option>
                    <option value="archived">Archive / past</option>
                  </select>
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="roadmap-visibility">Visibility</Label>
                  <select
                    id="roadmap-visibility"
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    value={roadmapForm.itemType === "member_drop" ? "members" : roadmapForm.visibility}
                    onChange={(event) => setRoadmapForm((current) => ({ ...current, visibility: event.target.value as CreatorRoadmapItem["visibility"] }))}
                    disabled={roadmapForm.itemType === "member_drop"}
                  >
                    <option value="public">Public</option>
                    <option value="followers">Followers</option>
                    <option value="members">Members</option>
                  </select>
                  <p className="text-xs text-muted-foreground">Public → anyone. Followers → followed users + you. Members → active members + you.</p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="roadmap-scheduled-for">Scheduled for</Label>
                  <Input id="roadmap-scheduled-for" type="datetime-local" value={roadmapForm.scheduledFor} onChange={(event) => setRoadmapForm((current) => ({ ...current, scheduledFor: event.target.value }))} />
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="roadmap-released-at">Released at</Label>
                  <Input id="roadmap-released-at" type="datetime-local" value={roadmapForm.releasedAt} onChange={(event) => setRoadmapForm((current) => ({ ...current, releasedAt: event.target.value }))} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="roadmap-linked-collection">Linked collection</Label>
                  <select
                    id="roadmap-linked-collection"
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    value={roadmapForm.linkedCollectionId}
                    onChange={(event) => setRoadmapForm((current) => ({ ...current, linkedCollectionId: event.target.value }))}
                  >
                    <option value="">No linked collection</option>
                    {creatorCollectionOptions.map((collection) => (
                      <option key={collection.id} value={collection.id}>{collection.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="roadmap-linked-challenge">Linked challenge</Label>
                <select
                  id="roadmap-linked-challenge"
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  value={roadmapForm.linkedChallengeId}
                  onChange={(event) => setRoadmapForm((current) => ({ ...current, linkedChallengeId: event.target.value }))}
                >
                  <option value="">No linked challenge</option>
                  {challengeOptions.map((challenge) => (
                    <option key={challenge.id} value={challenge.id}>{challenge.title}</option>
                  ))}
                </select>
              </div>

              <div className="flex flex-wrap gap-2">
                <Button
                  onClick={() => {
                    setRoadmapMessage("");
                    setRoadmapError("");
                    saveRoadmapMutation.mutate({
                      id: roadmapForm.id || undefined,
                      title: roadmapForm.title.trim(),
                      description: roadmapForm.description.trim(),
                      itemType: roadmapForm.itemType,
                      visibility: roadmapForm.itemType === "member_drop" ? "members" : roadmapForm.visibility,
                      linkedCollectionId: roadmapForm.linkedCollectionId || null,
                      linkedChallengeId: roadmapForm.linkedChallengeId || null,
                      scheduledFor: roadmapForm.scheduledFor || null,
                      releasedAt: roadmapForm.releasedAt || null,
                      status: roadmapForm.status,
                    });
                  }}
                  disabled={saveRoadmapMutation.isPending || !roadmapForm.title.trim()}
                >
                  {saveRoadmapMutation.isPending ? "Saving roadmap…" : roadmapForm.id ? "Update roadmap item" : "Create roadmap item"}
                </Button>
                <Button
                  variant="outline"
                  onClick={() => {
                    setRoadmapMessage("");
                    setRoadmapError("");
                    setRoadmapForm({
                      id: "",
                      title: "",
                      description: "",
                      itemType: "roadmap",
                      visibility: "public",
                      linkedCollectionId: "",
                      linkedChallengeId: "",
                      scheduledFor: "",
                      releasedAt: "",
                      status: "upcoming",
                    });
                  }}
                >
                  Reset
                </Button>
                <Link href={`/drinks/creator/${encodeURIComponent(user.id)}#creator-roadmap`}><Button variant="ghost">Preview roadmap on page</Button></Link>
              </div>

              {roadmapMessage ? <p className="text-sm text-emerald-600">{roadmapMessage}</p> : null}
              {roadmapError ? <p className="text-sm text-destructive">{roadmapError}</p> : null}
            </div>

            <div className="space-y-4">
              {creatorRoadmapQuery.isLoading ? <p className="text-sm text-muted-foreground">Loading roadmap + archive…</p> : null}
              {creatorRoadmapQuery.isError ? <p className="text-sm text-destructive">{readErrorMessage(creatorRoadmapQuery.error, "Unable to load roadmap right now.")}</p> : null}
              {!creatorRoadmapQuery.isLoading && !creatorRoadmapQuery.isError && creatorRoadmap.length === 0 ? (
                <Card>
                  <CardContent className="p-4 text-sm text-muted-foreground">
                    No roadmap items yet. Add upcoming plans, live launch notes, or archived highlights to show how your creator story is progressing over time.
                  </CardContent>
                </Card>
              ) : null}

              {[
                ["Upcoming", roadmapUpcoming],
                ["Live Now", roadmapLive],
                ["Archive / Past Releases", roadmapArchived],
              ].map(([title, group]) => (
                <div key={title as string} className="space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <h3 className="font-semibold">{title}</h3>
                    <span className="text-sm text-muted-foreground">{(group as CreatorRoadmapItem[]).length} item{(group as CreatorRoadmapItem[]).length === 1 ? "" : "s"}</span>
                  </div>
                  {(group as CreatorRoadmapItem[]).length > 0 ? (
                    <div className="space-y-3">
                      {(group as CreatorRoadmapItem[]).map((item) => (
                        <CreatorRoadmapCard
                          key={item.id}
                          item={item}
                          showCreator={false}
                          actions={(
                            <>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => {
                                  setRoadmapMessage("");
                                  setRoadmapError("");
                                  const scheduledDate = item.scheduledFor ? new Date(item.scheduledFor) : null;
                                  const releasedDate = item.releasedAt ? new Date(item.releasedAt) : null;
                                  const scheduledValue = scheduledDate && !Number.isNaN(scheduledDate.getTime())
                                    ? new Date(scheduledDate.getTime() - scheduledDate.getTimezoneOffset() * 60000).toISOString().slice(0, 16)
                                    : "";
                                  const releasedValue = releasedDate && !Number.isNaN(releasedDate.getTime())
                                    ? new Date(releasedDate.getTime() - releasedDate.getTimezoneOffset() * 60000).toISOString().slice(0, 16)
                                    : "";
                                  setRoadmapForm({
                                    id: item.id,
                                    title: item.title,
                                    description: item.description ?? "",
                                    itemType: item.itemType,
                                    visibility: item.visibility,
                                    linkedCollectionId: item.linkedCollection?.id ?? "",
                                    linkedChallengeId: item.linkedChallenge?.id ?? "",
                                    scheduledFor: scheduledValue,
                                    releasedAt: releasedValue,
                                    status: item.status,
                                  });
                                  window.location.hash = "roadmap";
                                }}
                              >
                                Edit
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => {
                                  setRoadmapMessage("");
                                  setRoadmapError("");
                                  deleteRoadmapMutation.mutate(item.id);
                                }}
                                disabled={deleteRoadmapMutation.isPending}
                              >
                                {deleteRoadmapMutation.isPending ? "Deleting…" : "Delete"}
                              </Button>
                            </>
                          )}
                        />
                      ))}
                    </div>
                  ) : (
                    <Card>
                      <CardContent className="p-4 text-sm text-muted-foreground">Nothing in this section yet.</CardContent>
                    </Card>
                  )}
                </div>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      <Card id="membership">
        <CardHeader>
          <CardTitle>Creator Membership</CardTitle>
          <CardDescription>
            Offer a lightweight monthly or yearly membership that unlocks your member-only collections while the paid term is active.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
            <div className="rounded-md border p-3">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Active members</p>
              <p className="text-xl font-semibold">{metricNumber(membershipDashboard.stats.activeMembers)}</p>
            </div>
            <div className="rounded-md border p-3">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Canceled members</p>
              <p className="text-xl font-semibold">{metricNumber(membershipDashboard.stats.canceledMembers)}</p>
            </div>
            <div className="rounded-md border p-3">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Expired members</p>
              <p className="text-xl font-semibold">{metricNumber(membershipDashboard.stats.expiredMembers)}</p>
            </div>
            <div className="rounded-md border p-3">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Total members</p>
              <p className="text-xl font-semibold">{metricNumber(membershipDashboard.stats.totalMembers)}</p>
            </div>
            <div className="rounded-md border p-3">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Gross membership revenue</p>
              <p className="text-xl font-semibold">{formatCurrency(membershipDashboard.stats.grossRevenueCents)}</p>
            </div>
          </div>

          <div className="rounded-md border border-dashed p-4 space-y-3">
            <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-5">
              <div className="space-y-1 lg:col-span-2">
                <Label htmlFor="membership-plan-name">Plan name</Label>
                <Input id="membership-plan-name" value={membershipPlanForm.name} onChange={(event) => setMembershipPlanForm((current) => ({ ...current, name: event.target.value }))} placeholder="Creator Membership" />
              </div>
              <div className="space-y-1 lg:col-span-2">
                <Label htmlFor="membership-plan-description">Description</Label>
                <Input id="membership-plan-description" value={membershipPlanForm.description} onChange={(event) => setMembershipPlanForm((current) => ({ ...current, description: event.target.value }))} placeholder="Unlock my member-only collections." />
              </div>
              <div className="space-y-1">
                <Label htmlFor="membership-plan-price">Price cents</Label>
                <Input id="membership-plan-price" type="number" min={100} value={membershipPlanForm.priceCents} onChange={(event) => setMembershipPlanForm((current) => ({ ...current, priceCents: event.target.value }))} />
              </div>
              <div className="space-y-1">
                <Label htmlFor="membership-plan-interval">Billing interval</Label>
                <select
                  id="membership-plan-interval"
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  value={membershipPlanForm.billingInterval}
                  onChange={(event) => setMembershipPlanForm((current) => ({ ...current, billingInterval: event.target.value as "monthly" | "yearly" }))}
                >
                  <option value="monthly">Monthly</option>
                  <option value="yearly">Yearly</option>
                </select>
              </div>
              <div className="space-y-1">
                <Label htmlFor="membership-plan-active">Plan status</Label>
                <select
                  id="membership-plan-active"
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  value={membershipPlanForm.isActive ? "active" : "inactive"}
                  onChange={(event) => setMembershipPlanForm((current) => ({ ...current, isActive: event.target.value === "active" }))}
                >
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                </select>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Button
                type="button"
                onClick={() => {
                  setMembershipPlanMessage("");
                  setMembershipPlanError("");
                  saveMembershipPlanMutation.mutate({
                    name: membershipPlanForm.name.trim(),
                    description: membershipPlanForm.description.trim(),
                    priceCents: Number(membershipPlanForm.priceCents),
                    billingInterval: membershipPlanForm.billingInterval,
                    isActive: membershipPlanForm.isActive,
                  });
                }}
                disabled={saveMembershipPlanMutation.isPending || !membershipPlanForm.name.trim() || !membershipPlanForm.priceCents}
              >
                {saveMembershipPlanMutation.isPending ? "Saving plan…" : membershipDashboard.plan ? "Update membership plan" : "Create membership plan"}
              </Button>
              <Link href={`/drinks/creator/${encodeURIComponent(user?.id ?? "")}`}>
                <Button variant="outline">Preview creator page</Button>
              </Link>
              <p className="text-xs text-muted-foreground">Version one keeps renewals manual so revenue and access remain explicit.</p>
            </div>
            {membershipPlanMessage ? <p className="text-sm text-emerald-600">{membershipPlanMessage}</p> : null}
            {membershipPlanError ? <p className="text-sm text-destructive">{membershipPlanError}</p> : null}
          </div>

          {membershipDashboard.plan ? (
            <div className="rounded-md border bg-muted/20 p-4 text-sm text-muted-foreground space-y-2">
              <p className="font-medium text-foreground">Current plan: {membershipDashboard.plan.name}</p>
              <p>{formatCurrency(membershipDashboard.plan.priceCents)} per {membershipDashboard.plan.billingInterval === "yearly" ? "year" : "month"} · {membershipDashboard.plan.isActive ? "Active" : "Inactive"}</p>
              {membershipDashboard.plan.description ? <p>{membershipDashboard.plan.description}</p> : null}
            </div>
          ) : (
            <div className="rounded-md border p-4 text-sm text-muted-foreground">
              No membership plan yet. Create one to add a creator support path that complements one-off collection sales.
            </div>
          )}

          {membershipDashboardQuery.isLoading ? <p className="text-sm text-muted-foreground">Loading membership reporting…</p> : null}
          {membershipDashboardQuery.isError ? <p className="text-sm text-destructive">{readErrorMessage(membershipDashboardQuery.error, "Unable to load membership reporting right now.")}</p> : null}
          {membershipDashboard.reportingNotes.length ? (
            <div className="space-y-1 text-xs text-muted-foreground">
              {membershipDashboard.reportingNotes.map((note) => <p key={note}>• {note}</p>)}
            </div>
          ) : null}
        </CardContent>
      </Card>

      <Card id="promotions">
        <CardHeader>
          <CardTitle>Promotions</CardTitle>
          <CardDescription>
            Lightweight promo codes for premium collections. Discounts affect the actual Square checkout amount and revenue reporting.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
            <div className="rounded-md border p-3">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Active promos</p>
              <p className="text-xl font-semibold">{metricNumber(creatorPromotions.filter((promo) => promo.isActive).length)}</p>
            </div>
            <div className="rounded-md border p-3">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Total promos</p>
              <p className="text-xl font-semibold">{metricNumber(creatorPromotions.length)}</p>
            </div>
            <div className="rounded-md border p-3">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Redeemed uses</p>
              <p className="text-xl font-semibold">{metricNumber(creatorPromotions.reduce((sum, promo) => sum + Number(promo.redemptionCount ?? 0), 0))}</p>
            </div>
            <div className="rounded-md border p-3">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Premium purchase collections</p>
              <p className="text-xl font-semibold">{metricNumber(premiumPurchaseCollections.length)}</p>
            </div>
            <div className="rounded-md border p-3">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Wishlist interest</p>
              <p className="text-xl font-semibold">{metricNumber(salesTotals.totalWishlistInterest)}</p>
            </div>
          </div>

          {premiumCollectionOptions.length === 0 ? (
            <div className="rounded-md border p-4 text-sm text-muted-foreground">
              Create a premium collection first, then add creator-managed promo codes here.
            </div>
          ) : (
            <div className="rounded-md border border-dashed p-4 space-y-3">
              <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
                <div className="space-y-1">
                  <Label htmlFor="promo-collection">Premium collection</Label>
                  <select
                    id="promo-collection"
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    value={selectedPromotionCollectionId}
                    onChange={(event) => setPromotionForm((current) => ({ ...current, collectionId: event.target.value }))}
                  >
                    {premiumCollectionOptions.map((collection) => (
                      <option key={collection.id} value={collection.id}>
                        {collection.name} · {formatCurrency(collection.priceCents)}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1">
                  <Label htmlFor="promo-code">Code</Label>
                  <Input id="promo-code" value={promotionForm.code} onChange={(event) => setPromotionForm((current) => ({ ...current, collectionId: selectedPromotionCollectionId, code: event.target.value.toUpperCase() }))} placeholder="SPRING15" />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="promo-discount-type">Discount type</Label>
                  <select
                    id="promo-discount-type"
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    value={promotionForm.discountType}
                    onChange={(event) => setPromotionForm((current) => ({ ...current, collectionId: selectedPromotionCollectionId, discountType: event.target.value as "percent" | "fixed", discountValue: event.target.value === "percent" && !current.discountValue ? "10" : current.discountValue }))}
                  >
                    <option value="percent">Percent off</option>
                    <option value="fixed">Fixed amount off</option>
                  </select>
                </div>
                <div className="space-y-1">
                  <Label htmlFor="promo-discount-value">{promotionForm.discountType === "percent" ? "Percent" : "Amount cents"}</Label>
                  <Input id="promo-discount-value" type="number" min={1} value={promotionForm.discountValue} onChange={(event) => setPromotionForm((current) => ({ ...current, collectionId: selectedPromotionCollectionId, discountValue: event.target.value }))} placeholder={promotionForm.discountType === "percent" ? "20" : "500"} />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="promo-starts-at">Starts at</Label>
                  <Input id="promo-starts-at" type="datetime-local" value={promotionForm.startsAt} onChange={(event) => setPromotionForm((current) => ({ ...current, collectionId: selectedPromotionCollectionId, startsAt: event.target.value }))} />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="promo-ends-at">Ends at</Label>
                  <Input id="promo-ends-at" type="datetime-local" value={promotionForm.endsAt} onChange={(event) => setPromotionForm((current) => ({ ...current, collectionId: selectedPromotionCollectionId, endsAt: event.target.value }))} />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="promo-max-redemptions">Max redemptions</Label>
                  <Input id="promo-max-redemptions" type="number" min={1} value={promotionForm.maxRedemptions} onChange={(event) => setPromotionForm((current) => ({ ...current, collectionId: selectedPromotionCollectionId, maxRedemptions: event.target.value }))} placeholder="Optional" />
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  type="button"
                  onClick={() => {
                    setPromotionError("");
                    setPromotionMessage("");
                    createPromotionMutation.mutate({
                      collectionId: selectedPromotionCollectionId,
                      code: promotionForm.code.trim().toUpperCase(),
                      discountType: promotionForm.discountType,
                      discountValue: Number(promotionForm.discountValue),
                      startsAt: promotionForm.startsAt ? new Date(promotionForm.startsAt).toISOString() : null,
                      endsAt: promotionForm.endsAt ? new Date(promotionForm.endsAt).toISOString() : null,
                      maxRedemptions: promotionForm.maxRedemptions ? Number(promotionForm.maxRedemptions) : null,
                    });
                  }}
                  disabled={createPromotionMutation.isPending || !selectedPromotionCollectionId || !promotionForm.code.trim() || !promotionForm.discountValue}
                >
                  {createPromotionMutation.isPending ? "Creating promo…" : "Create promo"}
                </Button>
                <p className="text-xs text-muted-foreground">Keep promos lightweight: one collection, one code, one discount. Promo alerts are scaffolded for up to {metricNumber(salesTotals.totalWishlistInterest)} wishlisted saves later.</p>
              </div>
              {promotionMessage ? <p className="text-sm text-emerald-600">{promotionMessage}</p> : null}
              {promotionError ? <p className="text-sm text-destructive">{promotionError}</p> : null}
            </div>
          )}

          {promotionsQuery.isLoading ? <p className="text-sm text-muted-foreground">Loading creator promos…</p> : null}
          {promotionsQuery.isError ? <p className="text-sm text-destructive">{readErrorMessage(promotionsQuery.error, "Unable to load promotions right now.")}</p> : null}

          {creatorPromotions.length === 0 ? (
            <div className="rounded-md border p-4 text-sm text-muted-foreground">
              No promo codes yet. Add a code when you want to run a limited offer on a premium collection.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Code</TableHead>
                  <TableHead>Collection</TableHead>
                  <TableHead>Discount</TableHead>
                  <TableHead>Dates</TableHead>
                  <TableHead className="text-right">Redemptions</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {creatorPromotions.map((promo) => (
                  <TableRow key={promo.id}>
                    <TableCell className="font-medium">{promo.code}</TableCell>
                    <TableCell>{promo.collectionName}</TableCell>
                    <TableCell>{formatPromotionDiscount(promo.discountType, promo.discountValue)}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {promo.startsAt ? formatDateTime(promo.startsAt) : "Starts immediately"}
                      <br />
                      {promo.endsAt ? `Ends ${formatDateTime(promo.endsAt)}` : "No end date"}
                    </TableCell>
                    <TableCell className="text-right">
                      {metricNumber(promo.redemptionCount)}
                      {promo.maxRedemptions ? <span className="text-xs text-muted-foreground"> / {metricNumber(promo.maxRedemptions)}</span> : null}
                    </TableCell>
                    <TableCell>
                      <Badge variant={promo.isActive ? "secondary" : "outline"}>{promo.isActive ? "Active" : "Disabled"}</Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => togglePromotionMutation.mutate({ id: promo.id, isActive: !promo.isActive })}
                        disabled={togglePromotionMutation.isPending}
                      >
                        {promo.isActive ? "Disable" : "Enable"}
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Card id="conversions">
        <CardHeader>
          <CardTitle>Conversion Analytics</CardTitle>
          <CardDescription>
            Discovery-to-purchase reporting for your Premium Purchase drink collections.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-6">
            <div className="rounded-md border p-3">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Premium purchase collections</p>
              <p className="text-xl font-semibold">{metricNumber(conversionSummary.premiumCollectionsCount)}</p>
            </div>
            <div className="rounded-md border p-3">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Collection views</p>
              <p className="text-xl font-semibold">{metricNumber(conversionSummary.totalCollectionViews)}</p>
            </div>
            <div className="rounded-md border p-3">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Checkout starts</p>
              <p className="text-xl font-semibold">{metricNumber(conversionSummary.totalCheckoutStarts)}</p>
            </div>
            <div className="rounded-md border p-3">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Completed purchases</p>
              <p className="text-xl font-semibold">{metricNumber(conversionSummary.totalCompletedPurchases)}</p>
            </div>
            <div className="rounded-md border p-3">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Conversion rate</p>
              <p className="text-xl font-semibold">{formatPercent(conversionSummary.overallConversionRate)}</p>
              <p className="mt-1 text-xs text-muted-foreground">Purchases ÷ views</p>
            </div>
            <div className="rounded-md border p-3">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Gross sales</p>
              <p className="text-xl font-semibold">{formatCurrency(conversionSummary.grossSalesCents)}</p>
              <p className="mt-1 text-xs text-muted-foreground">{metricNumber(conversionSummary.totalRefundedPurchases)} refunded / revoked</p>
            </div>
            <div className="rounded-md border p-3">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Wishlist interest</p>
              <p className="text-xl font-semibold">{metricNumber(conversionSummary.totalWishlistInterest)}</p>
              <p className="mt-1 text-xs text-muted-foreground">Tracked separately from purchases</p>
            </div>
          </div>

          {conversionsQuery.isLoading ? <p className="text-sm text-muted-foreground">Loading conversion analytics…</p> : null}
          {conversionsQuery.isError ? <p className="text-sm text-destructive">{readErrorMessage(conversionsQuery.error, "Unable to load conversion analytics right now.")}</p> : null}

          {conversionsQuery.data?.reportingNotes?.length ? (
            <div className="rounded-md border border-dashed p-3 text-sm text-muted-foreground">
              <ul className="list-disc space-y-1 pl-5">
                {conversionsQuery.data.reportingNotes.map((note) => (
                  <li key={note}>{note}</li>
                ))}
              </ul>
            </div>
          ) : null}

          {conversionCollections.length === 0 ? (
            <div className="rounded-md border p-4 text-sm text-muted-foreground">
              No premium collection conversion activity yet. Once shoppers view a premium collection or start Square checkout, funnel reporting will show up here.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Collection</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Price</TableHead>
                  <TableHead className="text-right">Views</TableHead>
                  <TableHead className="text-right">Checkout starts</TableHead>
                  <TableHead className="text-right">Completed purchases</TableHead>
                  <TableHead className="text-right">Conversion rate</TableHead>
                  <TableHead className="text-right">Gross sales</TableHead>
                  <TableHead className="text-right">Wishlists</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {conversionCollections.map((collection) => (
                  <TableRow key={collection.collectionId}>
                    <TableCell>
                      <div className="space-y-1">
                        <Link href={collection.route} className="font-medium underline underline-offset-2">
                          {collection.collectionName}
                        </Link>
                        <p className="text-xs text-muted-foreground">
                          {collection.refundedCount > 0
                            ? `${metricNumber(collection.refundedCount)} refunded / revoked lifecycle events`
                            : "No refunds or access revocations recorded."}
                        </p>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant={collection.isPublic ? "secondary" : "outline"}>
                        {collection.isPublic ? "Public" : "Private"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">{formatCurrency(collection.priceCents)}</TableCell>
                    <TableCell className="text-right">{metricNumber(collection.viewsCount)}</TableCell>
                    <TableCell className="text-right">{metricNumber(collection.checkoutStartsCount)}</TableCell>
                    <TableCell className="text-right">{metricNumber(collection.completedPurchasesCount)}</TableCell>
                    <TableCell className="text-right">{formatPercent(collection.conversionRate)}</TableCell>
                    <TableCell className="text-right">{formatCurrency(collection.grossSalesCents)}</TableCell>
                    <TableCell className="text-right">{metricNumber(collection.wishlistCount)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Card id="sales">
        <CardHeader>
          <CardTitle>Finance · Premium Collections</CardTitle>
          <CardDescription>
            Sales tracking and payout readiness only. No payouts sent yet.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
            <div className="rounded-md border p-3">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Gross sales</p>
              <p className="text-xl font-semibold">{formatCurrency(financeSummary.grossSalesCents)}</p>
            </div>
            <div className="rounded-md border p-3">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Sales count</p>
              <p className="text-xl font-semibold">{metricNumber(financeSummary.totalPremiumSalesCount)}</p>
            </div>
            <div className="rounded-md border p-3">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Premium purchase collections</p>
              <p className="text-xl font-semibold">{metricNumber(financeSummary.premiumCollectionsCount)}</p>
            </div>
            <div className="rounded-md border p-3">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Estimated creator share</p>
              <p className="text-xl font-semibold">{formatCurrency(financeSummary.estimatedCreatorShareCents)}</p>
            </div>
            <div className="rounded-md border p-3">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Refunded / revoked</p>
              <p className="text-xl font-semibold">{metricNumber(financeSummary.refundedSalesCount)}</p>
              <p className="mt-1 text-xs text-muted-foreground">{formatCurrency(financeSummary.refundedSalesCents)} separated</p>
            </div>
          </div>

          <div className="grid gap-2 sm:grid-cols-2">
            <div className="rounded-md border p-3">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Estimated platform fees</p>
              <p className="text-lg font-semibold">{formatCurrency(financeSummary.platformFeesCents)}</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Based on the current internal reporting estimate, not on transferred funds.
              </p>
            </div>
            <div className="rounded-md border border-dashed p-3">
              <p className="text-sm font-medium">Payout readiness</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Square checkout sales are tracked here so creator payouts can be added later, but payout automation is not implemented yet.
              </p>
              {financeSummary.estimates.usesEstimatedShareFormula ? (
                <p className="mt-2 text-xs text-muted-foreground">
                  Estimated split: {financeSummary.estimates.creatorShareBps / 100}% creator share / {financeSummary.estimates.platformFeeBps / 100}% platform fee.
                </p>
              ) : null}
            </div>
          </div>

          {financeQuery.isLoading ? <p className="text-sm text-muted-foreground">Loading finance reporting…</p> : null}
          {financeQuery.isError ? <p className="text-sm text-destructive">{readErrorMessage(financeQuery.error, "Unable to load finance reporting right now.")}</p> : null}

          {financeQuery.data?.reportingNotes?.length ? (
            <div className="rounded-md border border-dashed p-3 text-sm text-muted-foreground">
              <ul className="list-disc space-y-1 pl-5">
                {financeQuery.data.reportingNotes.map((note) => (
                  <li key={note}>{note}</li>
                ))}
              </ul>
            </div>
          ) : null}

          <div className="space-y-2">
            <div>
              <p className="text-sm font-medium">Recent premium sales activity</p>
              <p className="text-xs text-muted-foreground">Completed sales stay in revenue totals at the actual paid amount; list price and promo deltas are shown separately when available.</p>
            </div>

            {recentFinanceSales.length === 0 ? (
              <div className="rounded-md border p-4 text-sm text-muted-foreground">
                No completed premium sales tracked yet.
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Collection</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Paid</TableHead>
                    <TableHead className="text-right">Estimated creator share</TableHead>
                    <TableHead className="text-right">Date</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {recentFinanceSales.map((sale) => (
                    <TableRow key={sale.id}>
                      <TableCell>
                        <div className="space-y-1">
                          <Link href={sale.route} className="font-medium underline underline-offset-2">
                            {sale.collectionName}
                          </Link>
                          {sale.originalAmountCents && sale.originalAmountCents > sale.grossAmountCents ? (
                            <p className="text-xs text-muted-foreground">
                              List {formatCurrency(sale.originalAmountCents)} · Discount {formatCurrency(sale.discountAmountCents ?? 0)}
                              {sale.promotionCode ? ` · ${sale.promotionCode}` : ""}
                            </p>
                          ) : null}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="space-y-1">
                          <Badge variant={saleStatusVariant(sale.status)}>{saleStatusLabel(sale.status)}</Badge>
                          {sale.status !== "completed" && sale.statusReason ? (
                            <p className="max-w-xs text-xs text-muted-foreground">{sale.statusReason}</p>
                          ) : null}
                        </div>
                      </TableCell>
                      <TableCell className="text-right">{formatCurrency(sale.grossAmountCents)}</TableCell>
                      <TableCell className="text-right">{formatCurrency(sale.creatorShareCents)}</TableCell>
                      <TableCell className="text-right">{formatDateTime(sale.refundedAt ?? sale.createdAt)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </div>

          <div className="flex flex-wrap gap-2">
            <Link href="/drinks/creator-dashboard#orders">
              <Button variant="outline" size="sm">Jump to order history</Button>
            </Link>
          </div>
        </CardContent>
      </Card>

      <Card id="orders">
        <CardHeader>
          <CardTitle>Orders · Sales Activity</CardTitle>
          <CardDescription>
            Recent premium collection order history with privacy-safe buyer records and lifecycle-aware statuses.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-6">
            <div className="rounded-md border p-3">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Recent orders</p>
              <p className="text-xl font-semibold">{metricNumber(recentCreatorOrders.length)}</p>
            </div>
            <div className="rounded-md border p-3">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Completed sale</p>
              <p className="text-xl font-semibold">{metricNumber(recentCreatorOrders.filter((order) => order.status === "completed").length)}</p>
            </div>
            <div className="rounded-md border p-3">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Refunded / revoked</p>
              <p className="text-xl font-semibold">{metricNumber(recentCreatorOrders.filter((order) => order.status === "refunded" || order.status === "refunded_pending" || order.status === "revoked").length)}</p>
            </div>
            <div className="rounded-md border p-3">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Gross tracked</p>
              <p className="text-xl font-semibold">{formatCurrency(recentCreatorOrders.reduce((sum, order) => sum + Number(order.grossAmountCents ?? 0), 0))}</p>
            </div>
          </div>

          {ordersQuery.isLoading ? <p className="text-sm text-muted-foreground">Loading order history…</p> : null}
          {ordersQuery.isError ? <p className="text-sm text-destructive">{readErrorMessage(ordersQuery.error, "Unable to load order history right now.")}</p> : null}

          {ordersQuery.data?.reportingNotes?.length ? (
            <div className="rounded-md border border-dashed p-3 text-sm text-muted-foreground">
              <ul className="list-disc space-y-1 pl-5">
                {ordersQuery.data.reportingNotes.map((note) => (
                  <li key={note}>{note}</li>
                ))}
              </ul>
            </div>
          ) : null}

          {recentCreatorOrders.length === 0 ? (
            <div className="rounded-md border p-4 text-sm text-muted-foreground">
              No premium collection order activity yet. Completed, refunded, or revoked sales will appear here as they happen.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Collection</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Buyer</TableHead>
                  <TableHead className="text-right">Paid</TableHead>
                  <TableHead className="text-right">Purchased</TableHead>
                  <TableHead className="text-right">Updated</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {recentCreatorOrders.map((order) => (
                  <TableRow key={order.orderId}>
                    <TableCell>
                      <div className="space-y-1">
                        <Link href={order.collectionRoute} className="font-medium underline underline-offset-2">
                          {order.collectionName}
                        </Link>
                        <p className="text-xs text-muted-foreground">
                          Order {order.orderId}
                          {order.purchaseId ? ` · Purchase ${order.purchaseId}` : ""}
                        </p>
                        {order.originalAmountCents && order.originalAmountCents > order.grossAmountCents ? (
                          <p className="text-xs text-muted-foreground">
                            List {formatCurrency(order.originalAmountCents, order.currency)} · Discount {formatCurrency(order.discountAmountCents ?? 0, order.currency)}
                            {order.promotionCode ? ` · ${order.promotionCode}` : ""}
                          </p>
                        ) : null}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="space-y-1">
                        <Badge variant={saleStatusVariant(order.status)}>{saleStatusLabel(order.status)}</Badge>
                        {order.statusReason ? <p className="max-w-xs text-xs text-muted-foreground">{order.statusReason}</p> : null}
                      </div>
                    </TableCell>
                    <TableCell>{order.buyerLabel}</TableCell>
                    <TableCell className="text-right">{formatCurrency(order.grossAmountCents, order.currency)}</TableCell>
                    <TableCell className="text-right">{formatDateTime(order.purchasedAt)}</TableCell>
                    <TableCell className="text-right">{formatDateTime(order.refundedAt ?? order.purchasedAt)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}

          <div className="flex flex-wrap gap-2">
            <Link href="/drinks/creator-dashboard#sales">
              <Button variant="outline" size="sm">Back to finance</Button>
            </Link>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Sales · Premium Collections</CardTitle>
          <CardDescription>
            Reporting only. Gross sales reflect completed Premium Purchase collection checkouts at the actual paid amount, not the undiscounted list price.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-6">
            <div className="rounded-md border p-3">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Premium purchase collections</p>
              <p className="text-xl font-semibold">{metricNumber(salesTotals.premiumCollections)}</p>
            </div>
            <div className="rounded-md border p-3">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Purchases</p>
              <p className="text-xl font-semibold">{metricNumber(salesTotals.purchases)}</p>
            </div>
            <div className="rounded-md border p-3">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Gross sales</p>
              <p className="text-xl font-semibold">{formatCurrency(salesTotals.grossRevenueCents)}</p>
            </div>
            <div className="rounded-md border p-3">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Refunded / revoked</p>
              <p className="text-xl font-semibold">{metricNumber(salesTotals.refundedSalesCount)}</p>
              <p className="mt-1 text-xs text-muted-foreground">{formatCurrency(salesTotals.refundedRevenueCents)} removed from completed totals</p>
            </div>
            <div className="rounded-md border p-3">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Avg rating</p>
              <p className="text-xl font-semibold">{reviewInsights.totalReviews > 0 ? reviewInsights.averageRating.toFixed(1) : "—"}</p>
              <p className="mt-1 text-xs text-muted-foreground">Across verified buyer reviews</p>
            </div>
            <div className="rounded-md border p-3">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Total reviews</p>
              <p className="text-xl font-semibold">{metricNumber(reviewInsights.totalReviews)}</p>
              <p className="mt-1 text-xs text-muted-foreground">Social proof only</p>
            </div>
          </div>

          {salesQuery.isLoading ? <p className="text-sm text-muted-foreground">Loading premium collections sales…</p> : null}
          {salesQuery.isError ? <p className="text-sm text-destructive">{readErrorMessage(salesQuery.error, "Unable to load sales reporting right now.")}</p> : null}

          {salesQuery.data?.reportingNotes?.length ? (
            <div className="rounded-md border border-dashed p-3 text-sm text-muted-foreground">
              <ul className="list-disc space-y-1 pl-5">
                {salesQuery.data.reportingNotes.map((note) => (
                  <li key={note}>{note}</li>
                ))}
              </ul>
            </div>
          ) : null}

          {reviewInsights.totalReviews > 0 ? (
            <div className="space-y-3 rounded-md border p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="text-sm font-medium">Recent buyer reviews</p>
                  <CollectionRatingSummary averageRating={reviewInsights.averageRating} reviewCount={reviewInsights.totalReviews} />
                </div>
                <p className="text-xs text-muted-foreground">Lightweight insight for messaging and pricing, not a CRM.</p>
              </div>
              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                {reviewInsights.recentReviews.map((review) => (
                  <div key={review.id} className="rounded-md border bg-muted/20 p-3 text-sm">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <Link href={review.collectionRoute} className="font-medium underline underline-offset-2">{review.collectionName}</Link>
                        <p className="text-xs text-muted-foreground">
                          {review.user.displayName || review.user.username || "Verified buyer"} · {formatDate(review.createdAt)}
                        </p>
                      </div>
                      <span className="text-sm font-medium">{review.rating.toFixed(1)}★</span>
                    </div>
                    {review.title ? <p className="mt-2 font-medium">{review.title}</p> : null}
                    {review.body ? <p className="mt-1 text-muted-foreground">{review.body}</p> : null}
                    {review.isVerifiedPurchase ? <p className="mt-2 text-xs text-emerald-700">Verified purchase</p> : null}
                  </div>
                ))}
              </div>
            </div>
          ) : salesQuery.isSuccess ? (
            <div className="rounded-md border p-4 text-sm text-muted-foreground">
              No buyer reviews yet. Once verified owners leave ratings, they will show up here as lightweight social-proof insight.
            </div>
          ) : null}

          {salesCollections.length === 0 ? (
            <div className="rounded-md border p-4 text-sm text-muted-foreground">
              No premium collection sales yet. Publish a premium collection to start seeing purchase reporting here.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Collection</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Price</TableHead>
                  <TableHead className="text-right">Purchases</TableHead>
                  <TableHead className="text-right">Gross sales</TableHead>
                  <TableHead className="text-right">Refunded / revoked</TableHead>
                  <TableHead className="text-right">Last purchase</TableHead>
                  <TableHead className="text-right">Rating</TableHead>
                  <TableHead className="text-right">Reviews</TableHead>
                  <TableHead className="text-right">Wishlists</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {salesCollections.map((collection) => (
                  <TableRow key={collection.id}>
                    <TableCell>
                      <div className="space-y-1">
                        <Link href={collection.route} className="font-medium underline underline-offset-2">
                          {collection.name}
                        </Link>
                        <p className="text-xs text-muted-foreground">
                          {collection.description || "Premium collection performance summary."}
                        </p>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant={collection.isPublic ? "secondary" : "outline"}>
                        {collection.isPublic ? "Public" : "Private"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">{formatCurrency(collection.priceCents)}</TableCell>
                    <TableCell className="text-right">{metricNumber(collection.purchases)}</TableCell>
                    <TableCell className="text-right">{formatCurrency(collection.grossRevenueCents)}</TableCell>
                    <TableCell className="text-right">
                      {collection.refundedSalesCount > 0
                        ? `${metricNumber(collection.refundedSalesCount)} · ${formatCurrency(collection.refundedRevenueCents)}`
                        : "—"}
                    </TableCell>
                    <TableCell className="text-right">{collection.lastPurchasedAt ? formatDate(collection.lastPurchasedAt) : "—"}</TableCell>
                    <TableCell className="text-right">{collection.reviewCount > 0 ? `${collection.averageRating.toFixed(1)}★` : "—"}</TableCell>
                    <TableCell className="text-right">{metricNumber(collection.reviewCount)}</TableCell>
                    <TableCell className="text-right">{metricNumber(collection.wishlistCount)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}

          <div className="flex flex-wrap gap-2">
            <Link href="/drinks/collections">
              <Button variant="outline" size="sm">Manage premium collections</Button>
            </Link>
            <Link href="/drinks/creator-dashboard#orders">
              <Button variant="outline" size="sm">View order history</Button>
            </Link>
            <Link href="/drinks/collections/explore">
              <Button variant="outline" size="sm">Browse premium collections</Button>
            </Link>
            <Link href="/drinks/collections/purchased">
              <Button size="sm">View buyer ownership page</Button>
            </Link>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Creator Momentum</CardTitle>
          <CardDescription>Lightweight reward signals based on views and remixes.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          {(safeSummary.totalRemixesReceived > 0 || safeSummary.totalViews7d >= 100) ? (
            <>
              <p className="text-sm font-medium">🔥 Your drink is gaining traction</p>
              {safeSummary.totalRemixesReceived > 0 ? (
                <p className="text-sm text-muted-foreground">🎉 {metricNumber(safeSummary.totalRemixesReceived)} people remixed your drink</p>
              ) : null}
              {safeSummary.totalViews7d >= 100 ? (
                <p className="text-sm text-muted-foreground">{metricNumber(safeSummary.totalViews7d)} views in the last 7 days</p>
              ) : null}
            </>
          ) : (
            <p className="text-sm text-muted-foreground">Publish and share your drinks to unlock traction signals.</p>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-6">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Creator Rank</CardDescription>
            <CardTitle>{safeSummary.creatorRank ? `#${metricNumber(safeSummary.creatorRank)}` : "—"}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Total Created</CardDescription>
            <CardTitle>{metricNumber(safeSummary.totalCreated)}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Remixes Created</CardDescription>
            <CardTitle>{metricNumber(safeSummary.totalRemixesCreated)}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Views (7d)</CardDescription>
            <CardTitle>{metricNumber(safeSummary.totalViews7d)}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Remixes Received</CardDescription>
            <CardTitle>{metricNumber(safeSummary.totalRemixesReceived)}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Grocery Adds</CardDescription>
            <CardTitle>{metricNumber(safeSummary.totalGroceryAdds)}</CardTitle>
          </CardHeader>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Top Performing Drink</CardTitle>
          <CardDescription>
            {safeSummary.topPerformingDrink
              ? `${safeSummary.topPerformingDrink.name} • Score ${metricNumber(safeSummary.topPerformingDrink.score)} • Creator Score ${metricNumber(Math.round(safeSummary.creatorScore))}`
              : "No drinks with performance data yet."}
          </CardDescription>
        </CardHeader>
        {safeSummary.topPerformingDrink ? (
          <CardContent>
            <Link href={`/drinks/recipe/${encodeURIComponent(safeSummary.topPerformingDrink.slug)}`} className="underline underline-offset-2 text-sm">
              View {safeSummary.topPerformingDrink.name}
            </Link>
          </CardContent>
        ) : null}
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Most Remixed Drink</CardTitle>
          <CardDescription>
            {safeSummary.mostRemixedDrink
              ? `${safeSummary.mostRemixedDrink.name} • ${metricNumber(safeSummary.mostRemixedDrink.remixesCount)} remixes received`
              : "No remixes received yet."}
          </CardDescription>
        </CardHeader>
        {safeSummary.mostRemixedDrink ? (
          <CardContent>
            <Link href={`/drinks/recipe/${encodeURIComponent(safeSummary.mostRemixedDrink.slug)}`} className="underline underline-offset-2 text-sm">
              Open remix leader
            </Link>
          </CardContent>
        ) : null}
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Your Drinks</CardTitle>
          <CardDescription>
            Each row shows performance over the last 7 days, plus remix lineage.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {safeItems.length === 0 ? (
            <div className="text-sm text-muted-foreground">
              You have not submitted any drinks yet. <Link href="/drinks/submit" className="underline">Submit your first drink</Link>.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Drink</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead className="text-right">Views 24h</TableHead>
                  <TableHead className="text-right">Views 7d</TableHead>
                  <TableHead className="text-right">Remixes</TableHead>
                  <TableHead className="text-right">Grocery Adds</TableHead>
                  <TableHead className="text-right">Score</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {safeItems.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell>
                      <div className="space-y-1">
                        <Link href={`/drinks/recipe/${encodeURIComponent(item.slug)}`} className="font-medium underline underline-offset-2">
                          {item.name}
                        </Link>
                        <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                          <Badge variant="secondary">{item.slug}</Badge>
                          {item.remixedFromSlug ? (
                            <Badge variant="outline">
                              Remix of {" "}
                              <Link
                                href={`/drinks/recipe/${encodeURIComponent(item.remixedFromSlug)}`}
                                className="underline underline-offset-2"
                              >
                                {item.remixedFromSlug}
                              </Link>
                            </Badge>
                          ) : null}
                          {item.remixesCount > 0 ? (
                            <Badge variant="outline">{metricNumber(item.remixesCount)} remixes received</Badge>
                          ) : null}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>{formatDate(item.createdAt)}</TableCell>
                    <TableCell className="text-right">{metricNumber(item.views24h)}</TableCell>
                    <TableCell className="text-right">{metricNumber(item.views7d)}</TableCell>
                    <TableCell className="text-right">{metricNumber(item.remixesCount)}</TableCell>
                    <TableCell className="text-right">{metricNumber(item.groceryAdds)}</TableCell>
                    <TableCell className="text-right font-medium">{metricNumber(item.score)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Recent Activity</CardTitle>
          <CardDescription>
            Notifications from the last {metricNumber(activityQuery.data?.summary.windowDays ?? 30)} days across views, remixes, grocery adds, and follows.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {activityQuery.isLoading ? (
            <p className="text-sm text-muted-foreground">Loading activity…</p>
          ) : null}

          {activityQuery.isError ? (
            <div className="space-y-1">
              <p className="text-sm text-destructive">Unable to load activity right now.</p>
              {import.meta.env.DEV ? (
                <p className="text-xs text-muted-foreground break-all">{readErrorMessage(activityQuery.error, "Unknown activity error")}</p>
              ) : null}
            </div>
          ) : null}

          {activityQuery.data ? (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                <Badge variant="outline">Remixes {metricNumber(activityQuery.data.summary.typeCounts.remix ?? 0)}</Badge>
                <Badge variant="outline">Follows {metricNumber(activityQuery.data.summary.typeCounts.follow ?? 0)}</Badge>
                <Badge variant="outline">Views {metricNumber(activityQuery.data.summary.typeCounts.view ?? 0)}</Badge>
                <Badge variant="outline">Grocery Adds {metricNumber(activityQuery.data.summary.typeCounts.grocery_add ?? 0)}</Badge>
              </div>

              {activityQuery.data.items.length === 0 ? (
                <div className="text-sm text-muted-foreground">
                  No activity yet. Share your drink pages and publish remixes to start receiving notifications.
                </div>
              ) : (
                <div className="space-y-3">
                  {activityQuery.data.items.map((item, index) => (
                    <div
                      key={`${item.type}-${item.createdAt}-${index}`}
                      className="rounded-lg border p-3 flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between"
                    >
                      <div className="space-y-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <Badge variant={item.type === "remix" || item.type === "follow" ? "default" : "secondary"}>
                            {activityBadgeLabel(item.type)}
                          </Badge>
                          {item.count && item.count > 1 ? (
                            <span className="text-xs text-muted-foreground">{metricNumber(item.count)} events</span>
                          ) : null}
                        </div>
                        <p className="text-sm">{item.message}</p>
                        {item.route ? (
                          <Link href={item.route} className="text-xs underline underline-offset-2 text-muted-foreground hover:text-foreground">
                            Open related page
                          </Link>
                        ) : null}
                      </div>
                      <div className="text-xs text-muted-foreground">{formatDateTime(item.createdAt)}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}
