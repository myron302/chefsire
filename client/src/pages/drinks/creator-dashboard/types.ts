import { type AcceptedCreatorCollaboration } from "@/components/drinks/CreatorCollaborationAttribution";
import { type CreatorDropItem } from "@/components/drinks/CreatorDropCard";
import { type CreatorPostItem } from "@/components/drinks/CreatorPostCard";
import { type CreatorRoadmapItem } from "@/components/drinks/CreatorRoadmapCard";

export interface CreatorDrinkMetricsItem {
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

export interface CreatorDrinkSummary {
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

export interface CreatorDrinkMetricsResponse {
  ok: boolean;
  userId: string;
  summary: CreatorDrinkSummary;
  items: CreatorDrinkMetricsItem[];
}

export type CreatorActivityType = "view" | "remix" | "grocery_add" | "follow";

export interface CreatorActivityItem {
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

export interface CreatorActivityResponse {
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

export interface CreatorBadge {
  id: string;
  title: string;
  description: string;
  icon: string;
  isPublic: boolean;
  isEarned: boolean;
  earnedAt: string | null;
  progress: { current: number; target: number; label: string } | null;
}

export interface CreatorCollectionItem {
  id: string;
  name?: string;
  isPublic: boolean;
  accessType: "public" | "premium_purchase" | "membership_only";
  isPremium: boolean;
  priceCents: number;
  acceptedCollaboration?: AcceptedCreatorCollaboration | null;
}

export interface CreatorPromotionItem {
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

export interface CreatorPromotionsResponse {
  ok: boolean;
  promotions: CreatorPromotionItem[];
}

export interface CreatorPostsResponse {
  ok: boolean;
  creatorUserId: string;
  count: number;
  items: CreatorPostItem[];
}

export interface CreatorDropsResponse {
  ok: boolean;
  creatorUserId: string;
  count: number;
  items: CreatorDropItem[];
}

export interface CreatorRoadmapResponse {
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

export interface CreatorCollaborationItem {
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

export interface CreatorCollaborationsResponse {
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

export interface CreatorMembershipPlan {
  id: string;
  name: string;
  description: string | null;
  priceCents: number;
  billingInterval: "monthly" | "yearly";
  isActive: boolean;
  benefits: string[];
}

export interface CreatorMembershipDashboardResponse {
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

export interface CreatorSalesCollectionItem {
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

export interface CreatorSalesReviewItem {
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

export interface CreatorSalesResponse {
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

export interface CreatorFinanceRecentSale {
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

export interface CreatorFinanceResponse {
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

export interface CreatorConversionCollectionItem {
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

export interface CreatorConversionsResponse {
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

export interface CreatorOrderItem {
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

export interface CreatorOrdersResponse {
  ok: boolean;
  userId: string;
  count: number;
  orders: CreatorOrderItem[];
  reportingNotes: string[];
}

export interface CreatorBadgesResponse {
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
