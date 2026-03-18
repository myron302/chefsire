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
import DrinksPlatformNav from "@/components/drinks/DrinksPlatformNav";
import CollectionRatingSummary from "@/components/drinks/CollectionRatingSummary";
import RemixStreakBadge from "@/components/drinks/RemixStreakBadge";
import CreatorBundlesSection from "@/components/drinks/CreatorBundlesSection";

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
  isPremium: boolean;
  priceCents: number;
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
  const premiumCollections = creatorCollections.filter((collection) => collection.isPremium);
  const freeCollectionsCount = creatorCollections.filter((collection) => collection.isPublic && !collection.isPremium).length;
  const salesTotals = salesQuery.data?.totals ?? {
    premiumCollections: premiumCollections.length,
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
  const conversionSummary = conversionsQuery.data?.summary ?? {
    premiumCollectionsCount: premiumCollections.length,
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
  const premiumCollectionOptions = premiumCollections.map((collection) => ({
    id: collection.id,
    name: collection.name ?? `Collection ${collection.id.slice(0, 8)}`,
    priceCents: collection.priceCents,
  }));
  const selectedPromotionCollectionId = promotionForm.collectionId || premiumCollectionOptions[0]?.id || "";

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
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Premium collections</p>
              <p className="text-xl font-semibold">{metricNumber(premiumCollections.length)}</p>
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
          {premiumCollections.length > 0 ? (
            <p className="text-sm text-muted-foreground">{metricNumber(premiumCollections.length)} premium collections live. Your public creator page now highlights paid vs free collections for storefront clarity.</p>
          ) : (
            <p className="text-sm text-muted-foreground">No premium collections yet. Mark a collection premium to add a support path without blocking browsing.</p>
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
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Premium collections</p>
              <p className="text-xl font-semibold">{metricNumber(premiumCollections.length)}</p>
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
            Discovery-to-purchase reporting for your premium drink collections.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-6">
            <div className="rounded-md border p-3">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Premium collections</p>
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
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Premium collections count</p>
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
            Reporting only. Gross sales reflect completed premium collection purchases at the actual paid amount, not the undiscounted list price.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-6">
            <div className="rounded-md border p-3">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Premium collections</p>
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
