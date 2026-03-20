// server/routes/drinks.ts
import { Router, type Request } from "express";
import { and, asc, desc, eq, gt, ilike, inArray, lte, or, sql } from "drizzle-orm";
import { listMeta, lookupDrink, randomDrink, searchDrinks } from "../services/drinks-service";
import { storage } from "../storage";
import { db } from "../db";
import { getCanonicalDrinkBySlug } from "../services/canonical-drinks-index";
import { 
  creatorMembershipCheckoutSessions,
  creatorCollaborations,
  creatorDrops,
  creatorDropRsvps,
  creatorMembershipPlans,
  creatorPosts,
  creatorRoadmapItems,
  creatorCampaigns,
  creatorCampaignLinks,
  creatorCampaignFollows,
  creatorDropEvents,
  creatorMembershipSalesLedger,
  creatorMemberships,
  drinkBundleCheckoutSessions,
  drinkBundleItems,
  drinkBundlePurchases,
  drinkBundleSquareWebhookEvents,
  drinkBundles,
  insertCustomDrinkSchema, 
  insertDrinkPhotoSchema,
  insertDrinkLikeSchema,
  insertDrinkSaveSchema,
  insertDrinkBundleSchema,
  drinkCollectionCheckoutSessions,
  drinkCollectionEvents,
  drinkCollectionPromotions,
  drinkCollectionSalesLedger,
  drinkCollectionSquareWebhookEvents,
  drinkCollectionItems,
  drinkCollectionPurchases,
  drinkCollectionReviews,
  drinkCollectionWishlists,
  drinkCollections,
  drinkGifts,
  drinkChallengeSubmissions,
  drinkChallenges,
  drinkEvents,
  drinkRecipes,
  follows,
  insertCreatorDropSchema,
  insertCreatorDropRsvpSchema,
  insertCreatorCollaborationSchema,
  insertCreatorRoadmapItemSchema,
  insertCreatorCampaignSchema,
  insertCreatorCampaignLinkSchema,
  insertCreatorCampaignFollowSchema,
  insertCreatorDropEventSchema,
  insertDrinkCollectionSchema,
  insertDrinkChallengeSchema,
  insertDrinkRecipeSchema,
  notifications,
  users,
} from "@shared/schema";
import { z } from "zod";
import { parseTrackedEventBody, resolveEngagementUserId } from "./engagement-events";
import { optionalAuth, requireAuth } from "../middleware";
import { WebhooksHelper } from "square";
import { getSquareClient, getSquareConfigError, requireWebhookKey, squareConfig } from "../lib/square";
import {
  DRINK_ALERT_TYPES,
  sendCreatorDropAlerts,
  sendFollowedCreatorCollectionLaunchAlerts,
  sendFollowedCreatorPromoAlerts,
  sendFollowedCampaignUpdateAlerts,
  sendRsvpedDropLiveAlerts,
  sendWishlistPriceDropAlerts,
  sendWishlistPromoAlerts,
} from "../services/notification-service";

const r = Router();

type EventType = "view" | "remix" | "grocery_add";

type DrinkCollectionPurchaseStatus = "completed" | "refunded_pending" | "refunded" | "revoked";
type DrinkCollectionCheckoutStatus = "pending" | "completed" | "failed" | "canceled" | "refunded_pending" | "refunded" | "revoked";
type DrinkCollectionSalesLedgerStatus = "completed" | "refunded_pending" | "refunded" | "revoked";
type DrinkBundlePurchaseStatus = "completed" | "refunded_pending" | "refunded" | "revoked";
type DrinkBundleCheckoutStatus = "pending" | "completed" | "failed" | "canceled" | "refunded_pending" | "refunded" | "revoked";
type DrinkGiftTargetType = "collection" | "bundle";
type DrinkGiftStatus = "pending" | "completed" | "revoked";
type DrinkPurchaseType = "self" | "gift";
type DrinkCollectionEventType = "view";
type DrinkCollectionPromotionDiscountType = "percent" | "fixed";
type CreatorMembershipBillingInterval = "monthly" | "yearly";
type CreatorMembershipStatus = "active" | "canceled" | "expired" | "past_due";
type CreatorMembershipCheckoutStatus = "pending" | "completed" | "failed" | "canceled";
type CreatorPostType = "update" | "promo" | "collection_launch" | "challenge" | "member_only";
type CreatorPostVisibility = "public" | "followers" | "members";
type CreatorDropType = "collection_launch" | "promo_launch" | "member_drop" | "challenge_launch" | "update";
type CreatorDropVisibility = "public" | "followers" | "members";
type CreatorDropStatus = "upcoming" | "live" | "archived";
type CreatorRoadmapItemType = "collection" | "promo" | "challenge" | "member_drop" | "update" | "roadmap";
type CreatorRoadmapVisibility = "public" | "followers" | "members";
type CreatorRoadmapStatus = "upcoming" | "live" | "archived";
type CreatorCampaignVisibility = "public" | "followers" | "members";
type CreatorCampaignTargetType = "collection" | "drop" | "promo" | "challenge" | "post" | "roadmap";
type CreatorCampaignState = "upcoming" | "active" | "past";
type CreatorCollaborationType = "collection" | "drop" | "post" | "roadmap";
type CreatorCollaborationStatus = "pending" | "accepted" | "declined" | "revoked";
type DrinkAlertType = typeof DRINK_ALERT_TYPES[keyof typeof DRINK_ALERT_TYPES];
type CreatorDropEventType = "view_drop" | "click_drop_target";

type DrinkCollectionCheckoutSessionRecord = typeof drinkCollectionCheckoutSessions.$inferSelect;
type DrinkCollectionPromotionRecord = typeof drinkCollectionPromotions.$inferSelect;
type DrinkBundleCheckoutSessionRecord = typeof drinkBundleCheckoutSessions.$inferSelect;
type DrinkGiftRecord = typeof drinkGifts.$inferSelect;
type CreatorMembershipPlanRecord = typeof creatorMembershipPlans.$inferSelect;
type CreatorDropRecord = typeof creatorDrops.$inferSelect;
type CreatorDropRsvpRecord = typeof creatorDropRsvps.$inferSelect;
type CreatorPostRecord = typeof creatorPosts.$inferSelect;
type CreatorRoadmapRecord = typeof creatorRoadmapItems.$inferSelect;
type CreatorCampaignRecord = typeof creatorCampaigns.$inferSelect;
type CreatorCampaignLinkRecord = typeof creatorCampaignLinks.$inferSelect;
type CreatorCampaignFollowRecord = typeof creatorCampaignFollows.$inferSelect;
type CreatorDropEventRecord = typeof creatorDropEvents.$inferSelect;
type CreatorCollaborationRecord = typeof creatorCollaborations.$inferSelect;
type CreatorMembershipRecord = typeof creatorMemberships.$inferSelect;
type CreatorMembershipCheckoutSessionRecord = typeof creatorMembershipCheckoutSessions.$inferSelect;
type CollectionAccessGrant = "creator" | "direct_purchase" | "bundle" | "membership";
type DrinkCollectionAccessType = "public" | "premium_purchase" | "membership_only";

const CREATOR_DROP_ARCHIVE_WINDOW_MS = 1000 * 60 * 60 * 24 * 7;

type ResolvedCollectionPurchaseContext = {
  collection: typeof drinkCollections.$inferSelect;
  isOwner: boolean;
  alreadyOwned: boolean;
  promoPricing: CollectionPromoPricingSnapshot | null;
};

type CollectionPromoPricingSnapshot = {
  promotionId: string;
  code: string;
  discountType: DrinkCollectionPromotionDiscountType;
  discountValue: number;
  originalAmountCents: number;
  discountAmountCents: number;
  finalAmountCents: number;
  currencyCode: string;
  startsAt: string | null;
  endsAt: string | null;
  maxRedemptions: number | null;
  redemptionCount: number;
};

type CollectionAccessStatusInput = {
  purchaseStatus: DrinkCollectionPurchaseStatus;
  checkoutStatus: DrinkCollectionCheckoutStatus;
  ledgerStatus: DrinkCollectionSalesLedgerStatus;
  reason?: string | null;
  squarePaymentId?: string | null;
  squareOrderId?: string | null;
  refundedAt?: Date | null;
};

type SquareCheckoutVerificationResult = {
  status: DrinkCollectionCheckoutStatus;
  owned: boolean;
  collectionId: string;
  checkoutSessionId: string;
  squareOrderId?: string | null;
  squarePaymentId?: string | null;
  failureReason?: string | null;
};

type ParsedSquareOrderStatus = {
  status: DrinkCollectionCheckoutStatus;
  squareOrderId?: string | null;
  squarePaymentId?: string | null;
  failureReason?: string | null;
};

type SquareOrderVerificationPayload = {
  order: any;
  payment: any | null;
  squareOrderId: string | null;
  squarePaymentId: string | null;
};

type CollectionCheckoutSnapshot = {
  checkoutSessionId: string;
  status: DrinkCollectionCheckoutStatus;
  purchaseType: DrinkPurchaseType;
  failureReason: string | null;
  updatedAt: string;
  verifiedAt: string | null;
  expiresAt: string | null;
  originalAmountCents?: number | null;
  discountAmountCents?: number | null;
  promotionCode?: string | null;
  gift?: GiftSummary | null;
};

type BundleCheckoutSnapshot = {
  checkoutSessionId: string;
  status: DrinkBundleCheckoutStatus;
  purchaseType: DrinkPurchaseType;
  failureReason: string | null;
  updatedAt: string;
  verifiedAt: string | null;
  expiresAt: string | null;
  gift?: GiftSummary | null;
};

type GiftSummary = {
  id: string;
  giftCode: string;
  status: DrinkGiftStatus;
  targetType: DrinkGiftTargetType;
  targetId: string;
  checkoutSessionId: string;
  purchaserUserId: string;
  recipientUserId: string | null;
  recipientIdentifier: string | null;
  claimUrl: string;
  claimedAt: string | null;
  completedAt: string | null;
  revokedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

type CollectionReviewSummary = {
  averageRating: number;
  reviewCount: number;
};

type HydratedDrinkCollectionReview = {
  id: string;
  userId: string;
  collectionId: string;
  rating: number;
  title: string | null;
  body: string | null;
  isVerifiedPurchase: boolean;
  createdAt: string;
  updatedAt: string;
  user: {
    username: string | null;
    displayName: string | null;
    avatar: string | null;
  };
};

type SquareWebhookEventBody = {
  event_id?: string;
  type?: string;
  created_at?: string;
  data?: {
    id?: string;
    type?: string;
    object?: Record<string, any> | null;
  } | null;
};

type DrinkDetails = {
  slug: string;
  name: string;
  image: string | null;
  route: string;
  remixedFromSlug?: string | null;
  sourceCategoryRoute: string;
  source: "chefsire";
  category: string;
  subcategory: string | null;
};

type DiscoveryDrinkCard = {
  slug: string;
  name: string;
  image: string | null;
  route: string;
  creatorUsername: string | null;
  remixesCount: number;
  views7d: number;
};

const DRINK_ALERT_TYPE_VALUES = Object.values(DRINK_ALERT_TYPES) as DrinkAlertType[];

const TRACKABLE_DRINK_EVENTS = new Set<EventType>(["view", "remix", "grocery_add"]);
const TRACKABLE_COLLECTION_EVENTS = new Set<DrinkCollectionEventType>(["view"]);
const PREMIUM_COLLECTION_PLATFORM_FEE_BPS = 1500;
const PREMIUM_COLLECTION_CREATOR_SHARE_BPS = 10000 - PREMIUM_COLLECTION_PLATFORM_FEE_BPS;

function slugifyDrinkRecipeName(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

function normalizeSlug(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const cleaned = value.trim().toLowerCase();
  return cleaned.length ? cleaned : undefined;
}

async function getUserRecipeBySlug(slug: string) {
  if (!db) return null;
  const rows = await db.select().from(drinkRecipes).where(eq(drinkRecipes.slug, slug)).limit(1);
  return rows[0] ?? null;
}

function toDrinkRoute(slug: string, community = false): string {
  return community ? `/drinks/recipe/${slug}?community=1` : `/drinks/recipe/${slug}`;
}

function toDiscoveryDrinkCard(input: {
  slug: string;
  name: string;
  image?: string | null;
  route?: string;
  creatorUsername?: string | null;
  remixesCount?: number;
  views7d?: number;
}): DiscoveryDrinkCard {
  return {
    slug: input.slug,
    name: input.name,
    image: input.image ?? null,
    route: input.route ?? toDrinkRoute(input.slug),
    creatorUsername: input.creatorUsername ?? null,
    remixesCount: Number(input.remixesCount ?? 0),
    views7d: Number(input.views7d ?? 0),
  };
}

function parseLimitOffset(
  query: Record<string, unknown>,
  defaults: { limit: number; maxLimit: number; offset?: number },
) {
  const limitValue = Number(query.limit);
  const limit = Number.isFinite(limitValue)
    ? Math.max(1, Math.min(limitValue, defaults.maxLimit))
    : defaults.limit;

  const offsetValue = Number(query.offset);
  const offset = Number.isFinite(offsetValue) ? Math.max(0, offsetValue) : (defaults.offset ?? 0);
  return { limit, offset };
}

async function resolveDrinkDetailsBySlug(slug: string): Promise<DrinkDetails | null> {
  const canonicalRecipe = getCanonicalDrinkBySlug(slug);
  if (canonicalRecipe) {
    return {
      slug: canonicalRecipe.slug,
      name: canonicalRecipe.name,
      image: canonicalRecipe.image ?? null,
      route: canonicalRecipe.route,
      sourceCategoryRoute: canonicalRecipe.sourceRoute,
      source: "chefsire" as const,
      category: canonicalRecipe.sourceRoute.replace("/drinks/", "").split("/")[0] ?? "",
      subcategory: canonicalRecipe.sourceRoute.replace("/drinks/", "").split("/")[1] ?? null,
    };
  }

  const userRecipe = await getUserRecipeBySlug(slug);
  if (!userRecipe) return null;

  return {
    slug: userRecipe.slug,
    name: userRecipe.name,
    image: userRecipe.image ?? null,
    route: `/drinks/recipe/${userRecipe.slug}`,
    sourceCategoryRoute: `/drinks/${userRecipe.category}${userRecipe.subcategory ? `/${userRecipe.subcategory}` : ""}`,
    source: "chefsire" as const,
    category: userRecipe.category,
    subcategory: userRecipe.subcategory ?? null,
  };
}

async function resolveDrinkDetailsMapBySlugs(slugs: string[]): Promise<Map<string, DrinkDetails>> {
  const uniqueSlugs = [...new Set(slugs.filter(Boolean))];
  if (uniqueSlugs.length === 0) return new Map();

  const detailsBySlug = new Map<string, DrinkDetails>();
  const unresolved: string[] = [];

  for (const slug of uniqueSlugs) {
    const canonical = getCanonicalDrinkBySlug(slug);
    if (canonical) {
      detailsBySlug.set(slug, {
        slug: canonical.slug,
        name: canonical.name,
        image: canonical.image ?? null,
        route: canonical.route,
        sourceCategoryRoute: canonical.sourceRoute,
        source: "chefsire",
        category: canonical.sourceRoute.replace("/drinks/", "").split("/")[0] ?? "",
        subcategory: canonical.sourceRoute.replace("/drinks/", "").split("/")[1] ?? null,
      });
    } else {
      unresolved.push(slug);
    }
  }

  if (!db || unresolved.length === 0) return detailsBySlug;

  const userRecipes = await db
    .select({
      slug: drinkRecipes.slug,
      name: drinkRecipes.name,
      image: drinkRecipes.image,
      remixedFromSlug: drinkRecipes.remixedFromSlug,
      category: drinkRecipes.category,
      subcategory: drinkRecipes.subcategory,
    })
    .from(drinkRecipes)
    .where(inArray(drinkRecipes.slug, unresolved));

  for (const recipe of userRecipes) {
    detailsBySlug.set(recipe.slug, {
      slug: recipe.slug,
      name: recipe.name,
      image: recipe.image ?? null,
      route: toDrinkRoute(recipe.slug),
      remixedFromSlug: recipe.remixedFromSlug ?? null,
      sourceCategoryRoute: `/drinks/${recipe.category}${recipe.subcategory ? `/${recipe.subcategory}` : ""}`,
      source: "chefsire",
      category: recipe.category,
      subcategory: recipe.subcategory ?? null,
    });
  }

  return detailsBySlug;
}

type RemixChainNode = {
  slug: string;
  name: string;
  image: string | null;
  route: string;
  isCanonical: boolean;
  remixedFromSlug: string | null;
  creatorId?: string | null;
  creatorUsername?: string | null;
};

function toRemixChainNodeFromCanonical(slug: string): RemixChainNode | null {
  const canonicalRecipe = getCanonicalDrinkBySlug(slug);
  if (!canonicalRecipe) return null;

  return {
    slug: canonicalRecipe.slug,
    name: canonicalRecipe.name,
    image: canonicalRecipe.image ?? null,
    route: canonicalRecipe.route,
    isCanonical: true,
    remixedFromSlug: null,
  };
}

function toRemixChainNodeFromUserRecipe(recipe: typeof drinkRecipes.$inferSelect): RemixChainNode {
  return {
    slug: recipe.slug,
    name: recipe.name,
    image: recipe.image ?? null,
    route: `/drinks/recipe/${recipe.slug}`,
    isCanonical: false,
    remixedFromSlug: recipe.remixedFromSlug ?? null,
    creatorId: recipe.userId ?? null,
  };
}

async function hydrateRemixNodeCreator(node: RemixChainNode): Promise<RemixChainNode> {
  if (!db || node.isCanonical || !node.creatorId) return node;

  const creator = await db
    .select({ username: users.username })
    .from(users)
    .where(eq(users.id, node.creatorId))
    .limit(1);

  return {
    ...node,
    creatorUsername: creator[0]?.username ?? null,
  };
}

async function resolveRemixChainNode(slug: string): Promise<RemixChainNode | null> {
  const canonicalNode = toRemixChainNodeFromCanonical(slug);
  if (canonicalNode) return canonicalNode;

  const userRecipe = await getUserRecipeBySlug(slug);
  if (!userRecipe) return null;
  return toRemixChainNodeFromUserRecipe(userRecipe);
}

type RemixDiscoverySort = "recent" | "popular";


const createDrinkCollectionItemBodySchema = z.object({
  drinkSlug: z.string().trim().min(1).max(200).transform((value) => value.toLowerCase()),
});

const promoCodeSchema = z.string().trim().min(1).max(64).transform((value) => value.toUpperCase());

const promotionDiscountTypeSchema = z.enum(["percent", "fixed"]);

const promotionInputSchema = z.object({
  collectionId: z.string().trim().min(1),
  code: promoCodeSchema,
  discountType: promotionDiscountTypeSchema,
  discountValue: z.number().int().positive(),
  startsAt: z.string().datetime().nullable().optional(),
  endsAt: z.string().datetime().nullable().optional(),
  isActive: z.boolean().optional(),
  maxRedemptions: z.number().int().positive().nullable().optional(),
}).superRefine((value, ctx) => {
  if (value.discountType === "percent" && value.discountValue >= 100) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["discountValue"], message: "Percent discounts must be between 1 and 99." });
  }

  if (value.startsAt && value.endsAt) {
    const startsAt = new Date(value.startsAt);
    const endsAt = new Date(value.endsAt);
    if (!Number.isNaN(startsAt.getTime()) && !Number.isNaN(endsAt.getTime()) && endsAt <= startsAt) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["endsAt"], message: "End date must be after the start date." });
    }
  }
});

const promotionUpdateSchema = z.object({
  code: promoCodeSchema.optional(),
  discountType: promotionDiscountTypeSchema.optional(),
  discountValue: z.number().int().positive().optional(),
  startsAt: z.string().datetime().nullable().optional(),
  endsAt: z.string().datetime().nullable().optional(),
  isActive: z.boolean().optional(),
  maxRedemptions: z.number().int().positive().nullable().optional(),
}).refine((value) => Object.values(value).some((entry) => entry !== undefined), {
  message: "At least one promotion field must be provided.",
}).superRefine((value, ctx) => {
  if (value.discountType === "percent" && value.discountValue !== undefined && value.discountValue >= 100) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["discountValue"], message: "Percent discounts must be between 1 and 99." });
  }

  if (value.startsAt && value.endsAt) {
    const startsAt = new Date(value.startsAt);
    const endsAt = new Date(value.endsAt);
    if (!Number.isNaN(startsAt.getTime()) && !Number.isNaN(endsAt.getTime()) && endsAt <= startsAt) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["endsAt"], message: "End date must be after the start date." });
    }
  }
});

const applyPromoBodySchema = z.object({
  code: promoCodeSchema,
});

const createCheckoutBodySchema = z.object({
  promoCode: promoCodeSchema.optional(),
  purchaseType: z.enum(["self", "gift"]).optional(),
});

const creatorMembershipIntervalSchema = z.enum(["monthly", "yearly"]);

const creatorMembershipPlanInputSchema = z.object({
  name: z.string().trim().min(2).max(160),
  description: z.string().trim().max(2000).nullable().optional(),
  priceCents: z.coerce.number().int().min(100).max(500000),
  billingInterval: creatorMembershipIntervalSchema.default("monthly"),
  isActive: z.boolean().optional(),
});

const creatorPostTypeSchema = z.enum(["update", "promo", "collection_launch", "challenge", "member_only"]);
const creatorPostVisibilitySchema = z.enum(["public", "followers", "members"]);
const creatorDropTypeSchema = z.enum(["collection_launch", "promo_launch", "member_drop", "challenge_launch", "update"]);
const creatorDropVisibilitySchema = z.enum(["public", "followers", "members"]);
const creatorRoadmapItemTypeSchema = z.enum(["collection", "promo", "challenge", "member_drop", "update", "roadmap"]);
const creatorRoadmapVisibilitySchema = z.enum(["public", "followers", "members"]);
const creatorRoadmapStatusSchema = z.enum(["upcoming", "live", "archived"]);
const creatorCampaignVisibilitySchema = z.enum(["public", "followers", "members"]);
const creatorCampaignTargetTypeSchema = z.enum(["collection", "drop", "promo", "challenge", "post", "roadmap"]);
const creatorCollaborationTypeSchema = z.enum(["collection", "drop", "post", "roadmap"]);
const creatorCollaborationStatusSchema = z.enum(["pending", "accepted", "declined", "revoked"]);

const creatorPostBodyBaseSchema = z.object({
  title: z.string().trim().min(2).max(160),
  body: z.string().trim().min(1).max(5000),
  postType: creatorPostTypeSchema.default("update"),
  visibility: creatorPostVisibilitySchema.default("public"),
  linkedCollectionId: z.string().trim().min(1).nullable().optional(),
  linkedChallengeId: z.string().trim().min(1).nullable().optional(),
});

const createCreatorPostBodySchema = creatorPostBodyBaseSchema.superRefine((value, ctx) => {
  if (value.postType === "collection_launch" && !value.linkedCollectionId) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["linkedCollectionId"], message: "Collection launch posts should link to a collection." });
  }
  if (value.postType === "challenge" && !value.linkedChallengeId) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["linkedChallengeId"], message: "Challenge posts should link to a challenge." });
  }
});

const updateCreatorPostBodySchema = creatorPostBodyBaseSchema.partial().refine((value) => Object.values(value).some((field) => field !== undefined), {
  message: "At least one field must be provided",
});

const creatorDropBodyBaseSchema = z.object({
  title: z.string().trim().min(2).max(160),
  description: z.string().trim().max(5000).nullable().optional(),
  dropType: creatorDropTypeSchema.default("collection_launch"),
  visibility: creatorDropVisibilitySchema.default("public"),
  scheduledFor: z.string().datetime({ offset: true }),
  linkedCollectionId: z.string().trim().min(1).nullable().optional(),
  linkedChallengeId: z.string().trim().min(1).nullable().optional(),
  linkedPromotionId: z.string().trim().min(1).nullable().optional(),
  recapNotes: z.string().trim().max(4000).nullable().optional(),
  isPublished: z.boolean().optional(),
});

const createCreatorDropBodySchema = creatorDropBodyBaseSchema.superRefine((value, ctx) => {
  const scheduledFor = new Date(value.scheduledFor);
  if (Number.isNaN(scheduledFor.getTime())) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["scheduledFor"], message: "Scheduled date is invalid." });
    return;
  }
  if (scheduledFor <= new Date()) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["scheduledFor"], message: "Drops must be scheduled for a future time." });
  }
  if (value.dropType === "collection_launch" && !value.linkedCollectionId) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["linkedCollectionId"], message: "Collection launch drops should link to a collection." });
  }
  if (value.dropType === "challenge_launch" && !value.linkedChallengeId) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["linkedChallengeId"], message: "Challenge launch drops should link to a challenge." });
  }
});

const updateCreatorDropBodySchema = creatorDropBodyBaseSchema.partial().refine((value) => Object.values(value).some((field) => field !== undefined), {
  message: "At least one field must be provided",
});

const creatorRoadmapBodyBaseSchema = z.object({
  title: z.string().trim().min(2).max(160),
  description: z.string().trim().max(5000).nullable().optional(),
  itemType: creatorRoadmapItemTypeSchema.default("roadmap"),
  visibility: creatorRoadmapVisibilitySchema.default("public"),
  linkedCollectionId: z.string().trim().min(1).nullable().optional(),
  linkedChallengeId: z.string().trim().min(1).nullable().optional(),
  scheduledFor: z.string().datetime({ offset: true }).nullable().optional(),
  releasedAt: z.string().datetime({ offset: true }).nullable().optional(),
  status: creatorRoadmapStatusSchema.default("upcoming"),
});

const creatorCampaignLinkBodySchema = z.object({
  targetType: creatorCampaignTargetTypeSchema,
  targetId: z.string().trim().min(1, "Linked content is required."),
  sortOrder: z.coerce.number().int().min(0).max(999).optional(),
});

const creatorCampaignBodyBaseObjectSchema = z.object({
  slug: z.string().trim().min(2, "Campaign slug is required.").max(160),
  name: z.string().trim().min(2, "Campaign name is required.").max(160),
  description: z.string().trim().max(2000).optional().nullable(),
  visibility: creatorCampaignVisibilitySchema.default("public"),
  startsAt: z.string().datetime().optional().nullable(),
  endsAt: z.string().datetime().optional().nullable(),
  isActive: z.boolean().optional().default(true),
  links: z.array(creatorCampaignLinkBodySchema).max(48).optional().default([]),
});

const validateCreatorCampaignDateRange = (
  value: { startsAt?: string | null; endsAt?: string | null },
  ctx: z.RefinementCtx,
) => {
  if (value.startsAt && value.endsAt) {
    const startsAt = new Date(value.startsAt);
    const endsAt = new Date(value.endsAt);
    if (Number.isNaN(startsAt.getTime()) || Number.isNaN(endsAt.getTime()) || endsAt < startsAt) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["endsAt"], message: "Campaign end date must be after the start date." });
    }
  }
};

const createCreatorCampaignBodySchema = creatorCampaignBodyBaseObjectSchema.superRefine(validateCreatorCampaignDateRange);
const updateCreatorCampaignBodySchema = creatorCampaignBodyBaseObjectSchema.partial().superRefine((value, ctx) => {
  validateCreatorCampaignDateRange(value, ctx);
  if (!Object.values(value).some((field) => field !== undefined)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Provide at least one campaign field to update.",
    });
  }
});

const createCreatorRoadmapBodySchema = creatorRoadmapBodyBaseSchema.superRefine((value, ctx) => {
  if (value.itemType === "collection" && !value.linkedCollectionId) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["linkedCollectionId"], message: "Collection roadmap items should link to a collection when possible." });
  }
  if (value.itemType === "challenge" && !value.linkedChallengeId) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["linkedChallengeId"], message: "Challenge roadmap items should link to a challenge when possible." });
  }
});

const updateCreatorRoadmapBodySchema = creatorRoadmapBodyBaseSchema.partial().refine((value) => Object.values(value).some((field) => field !== undefined), {
  message: "At least one field must be provided",
});

const createCreatorCollaborationBodySchema = z.object({
  collaboratorUserId: z.string().trim().min(1),
  collaborationType: creatorCollaborationTypeSchema,
  targetId: z.string().trim().min(1),
});

const collectionAccessTypeSchema = z.enum(["public", "premium_purchase", "membership_only"]);

const updateDrinkCollectionBodySchema = z.object({
  name: z.string().trim().min(1).max(160).optional(),
  description: z.string().trim().max(2000).nullable().optional(),
  isPublic: z.boolean().optional(),
  accessType: collectionAccessTypeSchema.optional(),
  isPremium: z.boolean().optional(),
  priceCents: z.number().int().min(0).max(500000).optional(),
}).refine((value) => value.name !== undefined || value.description !== undefined || value.isPublic !== undefined || value.accessType !== undefined || value.isPremium !== undefined || value.priceCents !== undefined, {
  message: "At least one field must be provided",
});

const bundleBaseSchema = z.object({
  name: z.string().trim().min(1).max(160),
  description: z.string().trim().max(2000).nullable().optional(),
  isPublic: z.boolean().optional(),
  isPremium: z.boolean().optional(),
  priceCents: z.coerce.number().int().min(1).max(500000),
});

const createDrinkBundleBodySchema = bundleBaseSchema.extend({
  slug: z.string().trim().min(1).max(200).optional(),
});

const updateDrinkBundleBodySchema = bundleBaseSchema.partial().extend({
  slug: z.string().trim().min(1).max(200).optional(),
}).refine((value) => Object.values(value).some((field) => field !== undefined), {
  message: "At least one field must be provided",
});

const createDrinkBundleItemBodySchema = z.object({
  collectionId: z.string().trim().min(1),
  sortOrder: z.coerce.number().int().min(0).max(10000).optional(),
});

function normalizeCollectionDescription(value: string | null | undefined): string | null {
  if (typeof value !== "string") return null;
  const cleaned = value.trim();
  return cleaned.length ? cleaned : null;
}

function normalizeCollectionAccessType(value: unknown, fallback: DrinkCollectionAccessType = "public"): DrinkCollectionAccessType {
  if (value === "membership_only" || value === "premium_purchase" || value === "public") return value;
  return fallback;
}

function deriveCollectionAccessType(input: {
  accessType?: unknown;
  isPremium?: unknown;
  fallback?: DrinkCollectionAccessType;
}): DrinkCollectionAccessType {
  if (input.accessType !== undefined) {
    return normalizeCollectionAccessType(input.accessType, input.fallback ?? "public");
  }
  if (input.isPremium === true) return "premium_purchase";
  if (input.isPremium === false) return "public";
  return input.fallback ?? "public";
}

function collectionAccessTypeForRow(collection: Pick<typeof drinkCollections.$inferSelect, "accessType" | "isPremium">): DrinkCollectionAccessType {
  return deriveCollectionAccessType({
    accessType: collection.accessType,
    isPremium: collection.isPremium,
    fallback: collection.isPremium ? "premium_purchase" : "public",
  });
}

function isCollectionPremiumPurchase(collection: Pick<typeof drinkCollections.$inferSelect, "accessType" | "isPremium">) {
  return collectionAccessTypeForRow(collection) === "premium_purchase";
}

function collectionPriceCentsForAccessType(accessType: DrinkCollectionAccessType, priceCents?: number | null) {
  return accessType === "premium_purchase" ? Math.max(0, Math.round(Number(priceCents ?? 0))) : 0;
}

function validateCollectionAccessPayload(accessType: DrinkCollectionAccessType, priceCents?: number | null) {
  const normalizedPrice = collectionPriceCentsForAccessType(accessType, priceCents);
  if (accessType === "premium_purchase" && normalizedPrice <= 0) {
    return { ok: false as const, error: "Premium Purchase collections require a positive price." };
  }
  return { ok: true as const, normalizedPrice };
}

function normalizeCollectionRowForResponse<T extends typeof drinkCollections.$inferSelect>(collection: T): T & {
  accessType: DrinkCollectionAccessType;
  isPremium: boolean;
  priceCents: number;
} {
  const accessType = collectionAccessTypeForRow(collection);
  return {
    ...collection,
    accessType,
    isPremium: accessType !== "public",
    priceCents: collectionPriceCentsForAccessType(accessType, Number(collection.priceCents ?? 0)),
  };
}

function normalizeCollectionRowsForResponse<T extends typeof drinkCollections.$inferSelect>(collections: T[]) {
  return collections.map((collection) => normalizeCollectionRowForResponse(collection));
}

function normalizePromotionCode(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const cleaned = value.trim().toUpperCase();
  return cleaned.length ? cleaned : null;
}

function normalizeBundleSlug(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const cleaned = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
  return cleaned.length ? cleaned.slice(0, 200) : null;
}

function normalizeMembershipPlanSlug(value: unknown, creatorUserId: string) {
  const base = typeof value === "string" ? value : "membership";
  const cleaned = base
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
  const prefix = creatorUserId.slice(0, 8).toLowerCase();
  return `${prefix}-${(cleaned || "membership").slice(0, 120)}`;
}

function normalizeMembershipBillingInterval(value: unknown): CreatorMembershipBillingInterval {
  return value === "yearly" ? "yearly" : "monthly";
}

function membershipEndsAt(startedAt: Date, billingInterval: CreatorMembershipBillingInterval) {
  const next = new Date(startedAt);
  if (billingInterval === "yearly") {
    next.setUTCFullYear(next.getUTCFullYear() + 1);
  } else {
    next.setUTCMonth(next.getUTCMonth() + 1);
  }
  return next;
}

async function ensureUniqueBundleSlug(baseValue: string, excludeBundleId?: string | null) {
  if (!db) throw new Error("Database unavailable");

  const baseSlug = normalizeBundleSlug(baseValue) || "premium-bundle";
  let attempt = 0;

  while (attempt < 25) {
    const slug = attempt === 0 ? baseSlug : `${baseSlug}-${attempt + 1}`;
    const rows = await db
      .select({ id: drinkBundles.id })
      .from(drinkBundles)
      .where(eq(drinkBundles.slug, slug))
      .limit(1);

    const existing = rows[0];
    if (!existing || existing.id === excludeBundleId) {
      return slug;
    }
    attempt += 1;
  }

  return `${baseSlug}-${crypto.randomUUID().slice(0, 8)}`;
}

function toNullableDate(value?: string | null) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function serializePromotionPricing(
  promotion: DrinkCollectionPromotionRecord,
  originalAmountCents: number,
  currencyCode: string,
): CollectionPromoPricingSnapshot {
  const safeOriginal = Math.max(0, Number(originalAmountCents ?? 0));
  const rawDiscountAmount = promotion.discountType === "percent"
    ? Math.round((safeOriginal * Number(promotion.discountValue ?? 0)) / 100)
    : Number(promotion.discountValue ?? 0);
  const discountAmountCents = Math.max(0, Math.min(safeOriginal - 1, rawDiscountAmount));
  const finalAmountCents = Math.max(0, safeOriginal - discountAmountCents);

  return {
    promotionId: promotion.id,
    code: promotion.code,
    discountType: promotion.discountType as DrinkCollectionPromotionDiscountType,
    discountValue: Number(promotion.discountValue ?? 0),
    originalAmountCents: safeOriginal,
    discountAmountCents,
    finalAmountCents,
    currencyCode: normalizeSquareCurrencyCode(currencyCode),
    startsAt: promotion.startsAt ? promotion.startsAt.toISOString() : null,
    endsAt: promotion.endsAt ? promotion.endsAt.toISOString() : null,
    maxRedemptions: promotion.maxRedemptions === null ? null : Number(promotion.maxRedemptions ?? 0),
    redemptionCount: Number(promotion.redemptionCount ?? 0),
  };
}

function isPromotionCurrentlyValid(promotion: DrinkCollectionPromotionRecord, now = new Date()) {
  if (!promotion.isActive) return false;
  if (promotion.startsAt && promotion.startsAt > now) return false;
  if (promotion.endsAt && promotion.endsAt < now) return false;
  if (promotion.maxRedemptions !== null && Number(promotion.redemptionCount ?? 0) >= Number(promotion.maxRedemptions ?? 0)) {
    return false;
  }
  return true;
}

function comparePromotionPriority(a: DrinkCollectionPromotionRecord, b: DrinkCollectionPromotionRecord) {
  const aStartsAt = a.startsAt?.getTime() ?? 0;
  const bStartsAt = b.startsAt?.getTime() ?? 0;
  if (aStartsAt !== bStartsAt) return bStartsAt - aStartsAt;

  const aUpdatedAt = a.updatedAt?.getTime() ?? 0;
  const bUpdatedAt = b.updatedAt?.getTime() ?? 0;
  if (aUpdatedAt !== bUpdatedAt) return bUpdatedAt - aUpdatedAt;

  return a.code.localeCompare(b.code);
}

async function loadActivePromotionPricingMap(collections: Array<typeof drinkCollections.$inferSelect>) {
  if (!db || collections.length === 0) return new Map<string, CollectionPromoPricingSnapshot>();

  const premiumCollections = normalizeCollectionRowsForResponse(collections).filter((collection) => collection.accessType === "premium_purchase");
  if (premiumCollections.length === 0) return new Map<string, CollectionPromoPricingSnapshot>();

  const collectionById = new Map(premiumCollections.map((collection) => [collection.id, collection]));
  const rows = await db
    .select()
    .from(drinkCollectionPromotions)
    .where(inArray(drinkCollectionPromotions.collectionId, premiumCollections.map((collection) => collection.id)));

  const now = new Date();
  const bestPromotionByCollectionId = new Map<string, DrinkCollectionPromotionRecord>();
  for (const row of rows) {
    if (!isPromotionCurrentlyValid(row, now)) continue;
    const current = bestPromotionByCollectionId.get(row.collectionId);
    if (!current || comparePromotionPriority(row, current) < 0) {
      bestPromotionByCollectionId.set(row.collectionId, row);
    }
  }

  return new Map(
    [...bestPromotionByCollectionId.entries()].flatMap(([collectionId, promotion]) => {
      const collection = collectionById.get(collectionId);
      if (!collection) return [];
      return [[collectionId, serializePromotionPricing(promotion, Number(collection.priceCents ?? 0), squareConfig.currency ?? "USD")]] as const;
    }),
  );
}

async function loadWishlistCountsForCollections(collectionIds: string[]) {
  if (!db || collectionIds.length === 0) return new Map<string, number>();

  const rows = await db
    .select({
      collectionId: drinkCollectionWishlists.collectionId,
      count: sql<number>`count(*)::int`,
    })
    .from(drinkCollectionWishlists)
    .where(inArray(drinkCollectionWishlists.collectionId, [...new Set(collectionIds)]))
    .groupBy(drinkCollectionWishlists.collectionId);

  return new Map(rows.map((row) => [row.collectionId, Number(row.count ?? 0)]));
}

function logWishlistPromoAlertReady(event: {
  collectionId: string;
  creatorUserId: string;
  promotionId: string;
  wishlistAudienceCount: number;
}) {
  console.info("[drinks/collections/promo-alert-ready] Wishlist promo alert audience snapshot prepared", event);
}

async function loadUserBasicProfile(userId: string) {
  if (!db) return null;

  const rows = await db
    .select({
      id: users.id,
      username: users.username,
      avatar: users.avatar,
    })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  return rows[0] ?? null;
}

function collaborationTargetRoute(collaborationType: CreatorCollaborationType, target: {
  id: string;
  linkedCollectionId?: string | null;
}) {
  switch (collaborationType) {
    case "collection":
      return `/drinks/collections/${encodeURIComponent(target.id)}`;
    case "drop":
      return target.linkedCollectionId
        ? `/drinks/collections/${encodeURIComponent(target.linkedCollectionId)}`
        : "/drinks/drops";
    case "post":
      return target.linkedCollectionId
        ? `/drinks/collections/${encodeURIComponent(target.linkedCollectionId)}`
        : "/drinks/feed";
    case "roadmap":
      return target.linkedCollectionId
        ? `/drinks/collections/${encodeURIComponent(target.linkedCollectionId)}`
        : "/drinks/roadmap";
    default:
      return "/drinks";
  }
}

async function userCanReceiveCreatorCollaboration(userId: string) {
  if (!db) return false;

  const [recipeRow, collectionRow, postRow, dropRow, roadmapRow] = await Promise.all([
    db.select({ id: drinkRecipes.id }).from(drinkRecipes).where(eq(drinkRecipes.userId, userId)).limit(1),
    db.select({ id: drinkCollections.id }).from(drinkCollections).where(eq(drinkCollections.userId, userId)).limit(1),
    db.select({ id: creatorPosts.id }).from(creatorPosts).where(eq(creatorPosts.creatorUserId, userId)).limit(1),
    db.select({ id: creatorDrops.id }).from(creatorDrops).where(eq(creatorDrops.creatorUserId, userId)).limit(1),
    db.select({ id: creatorRoadmapItems.id }).from(creatorRoadmapItems).where(eq(creatorRoadmapItems.creatorUserId, userId)).limit(1),
  ]);

  return Boolean(recipeRow[0] || collectionRow[0] || postRow[0] || dropRow[0] || roadmapRow[0]);
}

async function resolveCollaborationTargetForOwner(input: {
  ownerCreatorUserId: string;
  collaborationType: CreatorCollaborationType;
  targetId: string;
}) {
  if (!db) return null;

  switch (input.collaborationType) {
    case "collection": {
      const rows = await db
        .select({
          id: drinkCollections.id,
          title: drinkCollections.name,
          ownerCreatorUserId: drinkCollections.userId,
          linkedCollectionId: drinkCollections.id,
        })
        .from(drinkCollections)
        .where(and(eq(drinkCollections.id, input.targetId), eq(drinkCollections.userId, input.ownerCreatorUserId)))
        .limit(1);
      return rows[0]
        ? {
            ...rows[0],
            route: collaborationTargetRoute("collection", rows[0]),
          }
        : null;
    }
    case "drop": {
      const rows = await db
        .select({
          id: creatorDrops.id,
          title: creatorDrops.title,
          ownerCreatorUserId: creatorDrops.creatorUserId,
          linkedCollectionId: creatorDrops.linkedCollectionId,
        })
        .from(creatorDrops)
        .where(and(eq(creatorDrops.id, input.targetId), eq(creatorDrops.creatorUserId, input.ownerCreatorUserId)))
        .limit(1);
      return rows[0]
        ? {
            ...rows[0],
            route: collaborationTargetRoute("drop", rows[0]),
          }
        : null;
    }
    case "post": {
      const rows = await db
        .select({
          id: creatorPosts.id,
          title: creatorPosts.title,
          ownerCreatorUserId: creatorPosts.creatorUserId,
          linkedCollectionId: creatorPosts.linkedCollectionId,
        })
        .from(creatorPosts)
        .where(and(eq(creatorPosts.id, input.targetId), eq(creatorPosts.creatorUserId, input.ownerCreatorUserId)))
        .limit(1);
      return rows[0]
        ? {
            ...rows[0],
            route: collaborationTargetRoute("post", rows[0]),
          }
        : null;
    }
    case "roadmap": {
      const rows = await db
        .select({
          id: creatorRoadmapItems.id,
          title: creatorRoadmapItems.title,
          ownerCreatorUserId: creatorRoadmapItems.creatorUserId,
          linkedCollectionId: creatorRoadmapItems.linkedCollectionId,
        })
        .from(creatorRoadmapItems)
        .where(and(eq(creatorRoadmapItems.id, input.targetId), eq(creatorRoadmapItems.creatorUserId, input.ownerCreatorUserId)))
        .limit(1);
      return rows[0]
        ? {
            ...rows[0],
            route: collaborationTargetRoute("roadmap", rows[0]),
          }
        : null;
    }
    default:
      return null;
  }
}

async function loadAcceptedCollaborationsForTargets(input: Array<{
  collaborationType: CreatorCollaborationType;
  targetId: string;
}>) {
  if (!db || input.length === 0) return new Map<string, CreatorCollaborationRecord>();

  const filters = input.map((entry) =>
    and(
      eq(creatorCollaborations.collaborationType, entry.collaborationType),
      eq(creatorCollaborations.targetId, entry.targetId),
      eq(creatorCollaborations.status, "accepted"),
    ),
  );

  if (filters.length === 0) return new Map<string, CreatorCollaborationRecord>();

  const rows = await db
    .select()
    .from(creatorCollaborations)
    .where(or(...filters));

  return new Map(rows.map((row) => [`${row.collaborationType}:${row.targetId}`, row]));
}

async function loadAcceptedCollaborationsForCreator(userId: string) {
  if (!db) return [] as CreatorCollaborationRecord[];

  return db
    .select()
    .from(creatorCollaborations)
    .where(
      and(
        eq(creatorCollaborations.status, "accepted"),
        or(
          eq(creatorCollaborations.ownerCreatorUserId, userId),
          eq(creatorCollaborations.collaboratorUserId, userId),
        ),
      ),
    )
    .orderBy(desc(creatorCollaborations.updatedAt));
}

async function loadCreatorProfilesMap(userIds: string[]) {
  if (!db || userIds.length === 0) {
    return new Map<string, { id: string; username: string | null; avatar: string | null }>();
  }

  const uniqueIds = [...new Set(userIds.filter(Boolean))];
  if (uniqueIds.length === 0) {
    return new Map<string, { id: string; username: string | null; avatar: string | null }>();
  }

  const rows = await db
    .select({ id: users.id, username: users.username, avatar: users.avatar })
    .from(users)
    .where(inArray(users.id, uniqueIds));

  return new Map(rows.map((row) => [row.id, row]));
}

function serializeAcceptedCollaboration(
  collaboration: CreatorCollaborationRecord | null | undefined,
  profilesMap: Map<string, { id: string; username: string | null; avatar: string | null }>,
) {
  if (!collaboration || collaboration.status !== "accepted") return null;

  const owner = profilesMap.get(collaboration.ownerCreatorUserId) ?? null;
  const collaborator = profilesMap.get(collaboration.collaboratorUserId) ?? null;

  return {
    id: collaboration.id,
    collaborationType: collaboration.collaborationType as CreatorCollaborationType,
    status: collaboration.status as CreatorCollaborationStatus,
    ownerCreator: owner
      ? {
          userId: owner.id,
          username: owner.username ?? null,
          avatar: owner.avatar ?? null,
          route: `/drinks/creator/${encodeURIComponent(owner.id)}`,
        }
      : null,
    collaborator: collaborator
      ? {
          userId: collaborator.id,
          username: collaborator.username ?? null,
          avatar: collaborator.avatar ?? null,
          route: `/drinks/creator/${encodeURIComponent(collaborator.id)}`,
        }
      : null,
  };
}

async function loadAcceptedCollaborationProfileMapByRows(rows: CreatorCollaborationRecord[]) {
  return loadCreatorProfilesMap(rows.flatMap((row) => [row.ownerCreatorUserId, row.collaboratorUserId]));
}

async function loadCollaborationTargetsMap(rows: CreatorCollaborationRecord[]) {
  const map = new Map<string, { id: string; title: string; route: string | null }>();
  if (!db || rows.length === 0) return map;

  const collectionIds = rows.filter((row) => row.collaborationType === "collection").map((row) => row.targetId);
  const dropIds = rows.filter((row) => row.collaborationType === "drop").map((row) => row.targetId);
  const postIds = rows.filter((row) => row.collaborationType === "post").map((row) => row.targetId);
  const roadmapIds = rows.filter((row) => row.collaborationType === "roadmap").map((row) => row.targetId);

  const [collectionRows, dropRows, postRows, roadmapRows] = await Promise.all([
    collectionIds.length === 0
      ? Promise.resolve([] as Array<{ id: string; title: string }>)
      : db.select({ id: drinkCollections.id, title: drinkCollections.name }).from(drinkCollections).where(inArray(drinkCollections.id, collectionIds)),
    dropIds.length === 0
      ? Promise.resolve([] as Array<{ id: string; title: string; linkedCollectionId: string | null }>)
      : db.select({ id: creatorDrops.id, title: creatorDrops.title, linkedCollectionId: creatorDrops.linkedCollectionId }).from(creatorDrops).where(inArray(creatorDrops.id, dropIds)),
    postIds.length === 0
      ? Promise.resolve([] as Array<{ id: string; title: string; linkedCollectionId: string | null }>)
      : db.select({ id: creatorPosts.id, title: creatorPosts.title, linkedCollectionId: creatorPosts.linkedCollectionId }).from(creatorPosts).where(inArray(creatorPosts.id, postIds)),
    roadmapIds.length === 0
      ? Promise.resolve([] as Array<{ id: string; title: string; linkedCollectionId: string | null }>)
      : db.select({ id: creatorRoadmapItems.id, title: creatorRoadmapItems.title, linkedCollectionId: creatorRoadmapItems.linkedCollectionId }).from(creatorRoadmapItems).where(inArray(creatorRoadmapItems.id, roadmapIds)),
  ]);

  for (const row of collectionRows) {
    map.set(`collection:${row.id}`, {
      id: row.id,
      title: row.title,
      route: `/drinks/collections/${encodeURIComponent(row.id)}`,
    });
  }
  for (const row of dropRows) {
    map.set(`drop:${row.id}`, {
      id: row.id,
      title: row.title,
      route: collaborationTargetRoute("drop", row),
    });
  }
  for (const row of postRows) {
    map.set(`post:${row.id}`, {
      id: row.id,
      title: row.title,
      route: collaborationTargetRoute("post", row),
    });
  }
  for (const row of roadmapRows) {
    map.set(`roadmap:${row.id}`, {
      id: row.id,
      title: row.title,
      route: collaborationTargetRoute("roadmap", row),
    });
  }

  return map;
}

function serializeCreatorCollaborationRow(
  row: CreatorCollaborationRecord,
  profileMap: Map<string, { id: string; username: string | null; avatar: string | null }>,
  targetMap: Map<string, { id: string; title: string; route: string | null }>,
) {
  const owner = profileMap.get(row.ownerCreatorUserId) ?? null;
  const collaborator = profileMap.get(row.collaboratorUserId) ?? null;
  const target = targetMap.get(`${row.collaborationType}:${row.targetId}`) ?? null;

  return {
    id: row.id,
    ownerCreatorUserId: row.ownerCreatorUserId,
    collaboratorUserId: row.collaboratorUserId,
    collaborationType: row.collaborationType as CreatorCollaborationType,
    targetId: row.targetId,
    status: row.status as CreatorCollaborationStatus,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    ownerCreator: owner
      ? {
          userId: owner.id,
          username: owner.username ?? null,
          avatar: owner.avatar ?? null,
          route: `/drinks/creator/${encodeURIComponent(owner.id)}`,
        }
      : null,
    collaborator: collaborator
      ? {
          userId: collaborator.id,
          username: collaborator.username ?? null,
          avatar: collaborator.avatar ?? null,
          route: `/drinks/creator/${encodeURIComponent(collaborator.id)}`,
        }
      : null,
    target: target
      ? {
          id: target.id,
          title: target.title,
          route: target.route,
        }
      : null,
  };
}

function serializeDrinkAlert(notification: typeof notifications.$inferSelect) {
  const metadata = (notification.metadata ?? {}) as Record<string, any>;
  return {
    id: notification.id,
    userId: notification.userId,
    type: notification.type,
    collectionId: typeof metadata.collectionId === "string" ? metadata.collectionId : null,
    creatorUserId: typeof metadata.creatorUserId === "string" ? metadata.creatorUserId : null,
    title: notification.title,
    message: notification.message,
    isRead: Boolean(notification.read),
    createdAt: notification.createdAt ? notification.createdAt.toISOString() : new Date().toISOString(),
    readAt: notification.readAt ? notification.readAt.toISOString() : null,
    linkUrl: notification.linkUrl ?? null,
    imageUrl: notification.imageUrl ?? null,
    metadata,
  };
}

async function maybeNotifyFollowersAboutPublishedPremiumCollection(
  collection: typeof drinkCollections.$inferSelect,
  previousCollection?: typeof drinkCollections.$inferSelect | null,
) {
  if (!collection.isPublic || !collection.isPremium) return;

  const wasAlreadyPublished = previousCollection
    ? previousCollection.isPublic && previousCollection.isPremium
    : false;
  if (wasAlreadyPublished) return;

  const creator = await loadUserBasicProfile(collection.userId);
  await sendFollowedCreatorCollectionLaunchAlerts({
    collectionId: collection.id,
    collectionName: collection.name,
    creatorUserId: collection.userId,
    creatorUsername: creator?.username ?? null,
    creatorAvatar: creator?.avatar ?? null,
  });
}

async function maybeNotifyWishlistersAboutPriceDrop(input: {
  previousCollection: typeof drinkCollections.$inferSelect;
  nextCollection: typeof drinkCollections.$inferSelect;
}) {
  const { previousCollection, nextCollection } = input;
  if (!nextCollection.isPublic || !isCollectionPremiumPurchase(nextCollection)) return;

  const previousPrice = Number(previousCollection.priceCents ?? 0);
  const nextPrice = Number(nextCollection.priceCents ?? 0);
  if (nextPrice <= 0 || nextPrice >= previousPrice) return;

  const creator = await loadUserBasicProfile(nextCollection.userId);
  await sendWishlistPriceDropAlerts({
    collectionId: nextCollection.id,
    collectionName: nextCollection.name,
    creatorUserId: nextCollection.userId,
    creatorUsername: creator?.username ?? null,
    creatorAvatar: creator?.avatar ?? null,
    previousPriceCents: previousPrice,
    nextPriceCents: nextPrice,
    currencyCode: squareConfig.currency ?? "USD",
  });
}

async function maybeNotifyPromoActivation(input: {
  collection: typeof drinkCollections.$inferSelect;
  previousPromotion?: DrinkCollectionPromotionRecord | null;
  nextPromotion: DrinkCollectionPromotionRecord;
}) {
  const { collection, previousPromotion = null, nextPromotion } = input;
  if (!collection.isPublic || !isCollectionPremiumPurchase(collection)) return;

  const wasActive = previousPromotion ? isPromotionCurrentlyValid(previousPromotion) : false;
  const isActive = isPromotionCurrentlyValid(nextPromotion);
  if (!isActive || wasActive) return;

  const creator = await loadUserBasicProfile(collection.userId);

  await Promise.all([
    sendWishlistPromoAlerts({
      collectionId: collection.id,
      collectionName: collection.name,
      creatorUserId: collection.userId,
      creatorUsername: creator?.username ?? null,
      creatorAvatar: creator?.avatar ?? null,
      promotionId: nextPromotion.id,
      promotionCode: nextPromotion.code,
    }),
    sendFollowedCreatorPromoAlerts({
      collectionId: collection.id,
      collectionName: collection.name,
      creatorUserId: collection.userId,
      creatorUsername: creator?.username ?? null,
      creatorAvatar: creator?.avatar ?? null,
      promotionId: nextPromotion.id,
      promotionCode: nextPromotion.code,
    }),
  ]);

  await maybeSendCampaignLinkedContentAlerts({
    targetType: "promo",
    targetId: nextPromotion.id,
    contentVisibility: "public",
    title: "A campaign you follow has a live promo",
    message: `${creator?.username ? `@${creator.username}` : "A creator"} started promo code ${nextPromotion.code} inside a campaign you follow.`,
    creatorUserId: collection.userId,
    creatorUsername: creator?.username ?? null,
    creatorAvatar: creator?.avatar ?? null,
    metadata: {
      promotionId: nextPromotion.id,
      collectionId: collection.id,
      event: "promo_started",
    },
  });
}

function logCollectionRouteError(route: string, req: any, error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`[drinks/collections${route}] Request failed`, {
    method: req.method,
    path: req.originalUrl,
    userId: req.user?.id ?? null,
    params: req.params,
    query: req.query,
    message,
    error,
  });
  return message;
}

function logCollectionDbUnavailable(route: string, req: any) {
  console.error(`[drinks/collections${route}] Database unavailable`, {
    method: req.method,
    path: req.originalUrl,
    userId: req.user?.id ?? null,
  });
}

function collectionServerError(message: string, fallback: string) {
  return {
    ok: false,
    error: process.env.NODE_ENV === "production" ? fallback : `${fallback}: ${message}`,
  };
}

function collectionAuthRequired(res: any) {
  return res.status(401).json({ ok: false, error: "Authentication required", code: "AUTH_REQUIRED" });
}

type CollectionErrorDetails = {
  status: number;
  fallback: string;
  code: string;
  debug: string;
};

function classifyCollectionError(error: unknown, defaultFallback: string): CollectionErrorDetails {
  const message = error instanceof Error ? error.message : String(error);
  const pgCode = typeof error === "object" && error !== null && "code" in error ? String((error as { code: unknown }).code ?? "") : "";

  if (pgCode === "42P01") {
    return {
      status: 503,
      fallback: "Collections storage is not initialized",
      code: "COLLECTIONS_TABLE_MISSING",
      debug: message,
    };
  }

  if (pgCode === "42703") {
    return {
      status: 503,
      fallback: "Collections schema is out of date",
      code: "COLLECTIONS_SCHEMA_MISMATCH",
      debug: message,
    };
  }

  return {
    status: 500,
    fallback: defaultFallback,
    code: "COLLECTIONS_QUERY_FAILED",
    debug: message,
  };
}

function collectionDbErrorResponse(error: unknown, fallback: string) {
  const details = classifyCollectionError(error, fallback);
  return {
    ok: false,
    error: process.env.NODE_ENV === "production" ? details.fallback : `${details.fallback}: ${details.debug}`,
    code: details.code,
  };
}

let _drinkCollectionsSchemaReady: Promise<void> | null = null;

async function ensureDrinkCollectionsSchema() {
  if (_drinkCollectionsSchemaReady) return _drinkCollectionsSchemaReady;

  _drinkCollectionsSchemaReady = (async () => {
    if (!db) {
      throw new Error("Database is not configured (missing DATABASE_URL)");
    }

    await db.execute(sql`CREATE EXTENSION IF NOT EXISTS pgcrypto;`);

    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS drink_collections (
        id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id varchar NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        name varchar(160) NOT NULL,
        description text,
        is_public boolean NOT NULL DEFAULT false,
        access_type text NOT NULL DEFAULT 'public',
        is_premium boolean NOT NULL DEFAULT false,
        price_cents integer NOT NULL DEFAULT 0,
        created_at timestamp NOT NULL DEFAULT now(),
        updated_at timestamp NOT NULL DEFAULT now()
      );
    `);

    await db.execute(sql`
      ALTER TABLE drink_collections
      ADD COLUMN IF NOT EXISTS access_type text NOT NULL DEFAULT 'public';
    `);

    await db.execute(sql`
      ALTER TABLE drink_collections
      ADD COLUMN IF NOT EXISTS is_premium boolean NOT NULL DEFAULT false;
    `);

    await db.execute(sql`
      ALTER TABLE drink_collections
      ADD COLUMN IF NOT EXISTS price_cents integer NOT NULL DEFAULT 0;
    `);

    await db.execute(sql`
      UPDATE drink_collections
      SET access_type = CASE WHEN is_premium THEN 'premium_purchase' ELSE 'public' END
      WHERE access_type IS NULL OR access_type NOT IN ('public', 'premium_purchase', 'membership_only');
    `);

    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS drink_collection_items (
        collection_id varchar NOT NULL REFERENCES drink_collections(id) ON DELETE CASCADE,
        drink_slug varchar(200) NOT NULL,
        added_at timestamp NOT NULL DEFAULT now(),
        CONSTRAINT drink_collection_items_collection_drink_idx UNIQUE (collection_id, drink_slug)
      );
    `);

    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS drink_collection_purchases (
        id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id varchar NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        collection_id varchar NOT NULL REFERENCES drink_collections(id) ON DELETE CASCADE,
        status text NOT NULL DEFAULT 'completed',
        status_reason text,
        access_revoked_at timestamp,
        created_at timestamp NOT NULL DEFAULT now(),
        updated_at timestamp NOT NULL DEFAULT now(),
        CONSTRAINT drink_collection_purchases_user_collection_idx UNIQUE (user_id, collection_id)
      );
    `);

    await db.execute(sql`ALTER TABLE drink_collection_purchases ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'completed';`);
    await db.execute(sql`ALTER TABLE drink_collection_purchases ADD COLUMN IF NOT EXISTS status_reason text;`);
    await db.execute(sql`ALTER TABLE drink_collection_purchases ADD COLUMN IF NOT EXISTS access_revoked_at timestamp;`);
    await db.execute(sql`ALTER TABLE drink_collection_purchases ADD COLUMN IF NOT EXISTS updated_at timestamp NOT NULL DEFAULT now();`);

    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS drink_collection_wishlists (
        id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id varchar NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        collection_id varchar NOT NULL REFERENCES drink_collections(id) ON DELETE CASCADE,
        created_at timestamp NOT NULL DEFAULT now(),
        CONSTRAINT drink_collection_wishlists_user_collection_idx UNIQUE (user_id, collection_id)
      );
    `);

    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS drink_collection_reviews (
        id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id varchar NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        collection_id varchar NOT NULL REFERENCES drink_collections(id) ON DELETE CASCADE,
        rating integer NOT NULL,
        title varchar(160),
        body text,
        is_verified_purchase boolean NOT NULL DEFAULT true,
        created_at timestamp NOT NULL DEFAULT now(),
        updated_at timestamp NOT NULL DEFAULT now(),
        CONSTRAINT drink_collection_reviews_user_collection_idx UNIQUE (user_id, collection_id)
      );
    `);

    await db.execute(sql`ALTER TABLE drink_collection_reviews ADD COLUMN IF NOT EXISTS title varchar(160);`);
    await db.execute(sql`ALTER TABLE drink_collection_reviews ADD COLUMN IF NOT EXISTS body text;`);
    await db.execute(sql`ALTER TABLE drink_collection_reviews ADD COLUMN IF NOT EXISTS is_verified_purchase boolean NOT NULL DEFAULT true;`);
    await db.execute(sql`ALTER TABLE drink_collection_reviews ADD COLUMN IF NOT EXISTS updated_at timestamp NOT NULL DEFAULT now();`);

    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS drink_collection_checkout_sessions (
        id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id varchar NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        collection_id varchar NOT NULL REFERENCES drink_collections(id) ON DELETE CASCADE,
        provider text NOT NULL DEFAULT 'square',
        purchase_type text NOT NULL DEFAULT 'self',
        status text NOT NULL DEFAULT 'pending',
        promotion_id varchar,
        promotion_code text,
        original_amount_cents integer,
        discount_amount_cents integer,
        amount_cents integer NOT NULL,
        currency_code text NOT NULL DEFAULT 'USD',
        square_payment_link_id text,
        square_order_id text,
        square_payment_id text,
        provider_reference_id text NOT NULL UNIQUE,
        checkout_url text,
        last_verified_at timestamp,
        verified_at timestamp,
        refunded_at timestamp,
        access_revoked_at timestamp,
        failure_reason text,
        expires_at timestamp,
        created_at timestamp NOT NULL DEFAULT now(),
        updated_at timestamp NOT NULL DEFAULT now()
      );
    `);

    await db.execute(sql`ALTER TABLE drink_collection_checkout_sessions ADD COLUMN IF NOT EXISTS refunded_at timestamp;`);
    await db.execute(sql`ALTER TABLE drink_collection_checkout_sessions ADD COLUMN IF NOT EXISTS access_revoked_at timestamp;`);
    await db.execute(sql`ALTER TABLE drink_collection_checkout_sessions ADD COLUMN IF NOT EXISTS purchase_type text NOT NULL DEFAULT 'self';`);
    await db.execute(sql`ALTER TABLE drink_collection_checkout_sessions ADD COLUMN IF NOT EXISTS promotion_id varchar;`);
    await db.execute(sql`ALTER TABLE drink_collection_checkout_sessions ADD COLUMN IF NOT EXISTS promotion_code text;`);
    await db.execute(sql`ALTER TABLE drink_collection_checkout_sessions ADD COLUMN IF NOT EXISTS original_amount_cents integer;`);
    await db.execute(sql`ALTER TABLE drink_collection_checkout_sessions ADD COLUMN IF NOT EXISTS discount_amount_cents integer;`);

    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS drink_collection_square_webhook_events (
        id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
        event_id text NOT NULL UNIQUE,
        event_type text NOT NULL,
        object_type text,
        object_id text,
        checkout_session_id varchar REFERENCES drink_collection_checkout_sessions(id) ON DELETE SET NULL,
        status text NOT NULL DEFAULT 'processed',
        received_at timestamp NOT NULL DEFAULT now(),
        created_at timestamp
      );
    `);

    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS drink_gifts (
        id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
        purchaser_user_id varchar NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        recipient_user_id varchar REFERENCES users(id) ON DELETE SET NULL,
        recipient_identifier text,
        target_type text NOT NULL,
        target_id varchar(200) NOT NULL,
        checkout_session_id varchar(200) NOT NULL,
        provider text NOT NULL DEFAULT 'square',
        status text NOT NULL DEFAULT 'pending',
        gift_code varchar(120) NOT NULL UNIQUE,
        claimed_at timestamp,
        completed_at timestamp,
        revoked_at timestamp,
        created_at timestamp NOT NULL DEFAULT now(),
        updated_at timestamp NOT NULL DEFAULT now()
      );
    `);

    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS drink_collection_sales_ledger (
        id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id varchar NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        collection_id varchar NOT NULL REFERENCES drink_collections(id) ON DELETE CASCADE,
        purchase_id varchar REFERENCES drink_collection_purchases(id) ON DELETE SET NULL,
        checkout_session_id varchar REFERENCES drink_collection_checkout_sessions(id) ON DELETE SET NULL,
        promotion_id varchar,
        promotion_code text,
        original_amount_cents integer,
        discount_amount_cents integer,
        gross_amount_cents integer NOT NULL,
        platform_fee_cents integer,
        creator_share_cents integer,
        currency_code text NOT NULL DEFAULT 'USD',
        status text NOT NULL DEFAULT 'completed',
        status_reason text,
        refunded_at timestamp,
        created_at timestamp NOT NULL DEFAULT now(),
        updated_at timestamp NOT NULL DEFAULT now()
      );
    `);

    await db.execute(sql`ALTER TABLE drink_collection_sales_ledger ADD COLUMN IF NOT EXISTS status_reason text;`);
    await db.execute(sql`ALTER TABLE drink_collection_sales_ledger ADD COLUMN IF NOT EXISTS refunded_at timestamp;`);
    await db.execute(sql`ALTER TABLE drink_collection_sales_ledger ADD COLUMN IF NOT EXISTS promotion_id varchar;`);
    await db.execute(sql`ALTER TABLE drink_collection_sales_ledger ADD COLUMN IF NOT EXISTS promotion_code text;`);
    await db.execute(sql`ALTER TABLE drink_collection_sales_ledger ADD COLUMN IF NOT EXISTS original_amount_cents integer;`);
    await db.execute(sql`ALTER TABLE drink_collection_sales_ledger ADD COLUMN IF NOT EXISTS discount_amount_cents integer;`);

    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS drink_collection_promotions (
        id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
        creator_user_id varchar NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        collection_id varchar NOT NULL REFERENCES drink_collections(id) ON DELETE CASCADE,
        code varchar(64) NOT NULL,
        discount_type text NOT NULL,
        discount_value integer NOT NULL,
        starts_at timestamp,
        ends_at timestamp,
        is_active boolean NOT NULL DEFAULT true,
        max_redemptions integer,
        redemption_count integer NOT NULL DEFAULT 0,
        created_at timestamp NOT NULL DEFAULT now(),
        updated_at timestamp NOT NULL DEFAULT now(),
        CONSTRAINT drink_collection_promotions_collection_code_idx UNIQUE (collection_id, code)
      );
    `);

    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS drink_collection_events (
        id bigserial PRIMARY KEY,
        collection_id varchar NOT NULL REFERENCES drink_collections(id) ON DELETE CASCADE,
        event_type text NOT NULL,
        user_id varchar REFERENCES users(id) ON DELETE SET NULL,
        created_at timestamp NOT NULL DEFAULT now()
      );
    `);

    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS creator_membership_plans (
        id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
        creator_user_id varchar NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        slug varchar(160) NOT NULL,
        name varchar(160) NOT NULL,
        description text,
        price_cents integer NOT NULL,
        billing_interval text NOT NULL DEFAULT 'monthly',
        is_active boolean NOT NULL DEFAULT true,
        created_at timestamp NOT NULL DEFAULT now(),
        updated_at timestamp NOT NULL DEFAULT now(),
        CONSTRAINT creator_membership_plans_creator_idx UNIQUE (creator_user_id),
        CONSTRAINT creator_membership_plans_slug_idx UNIQUE (slug)
      );
    `);

    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS creator_memberships (
        id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id varchar NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        creator_user_id varchar NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        plan_id varchar NOT NULL REFERENCES creator_membership_plans(id) ON DELETE CASCADE,
        status text NOT NULL DEFAULT 'active',
        started_at timestamp NOT NULL DEFAULT now(),
        ends_at timestamp,
        canceled_at timestamp,
        square_subscription_id text,
        payment_reference text,
        created_at timestamp NOT NULL DEFAULT now(),
        updated_at timestamp NOT NULL DEFAULT now(),
        CONSTRAINT creator_memberships_user_creator_idx UNIQUE (user_id, creator_user_id)
      );
    `);

    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS creator_membership_checkout_sessions (
        id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id varchar NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        creator_user_id varchar NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        plan_id varchar NOT NULL REFERENCES creator_membership_plans(id) ON DELETE CASCADE,
        provider text NOT NULL DEFAULT 'square',
        status text NOT NULL DEFAULT 'pending',
        amount_cents integer NOT NULL,
        currency_code text NOT NULL DEFAULT 'USD',
        square_payment_link_id text,
        square_order_id text,
        square_payment_id text,
        provider_reference_id text NOT NULL UNIQUE,
        checkout_url text,
        last_verified_at timestamp,
        verified_at timestamp,
        failure_reason text,
        expires_at timestamp,
        created_at timestamp NOT NULL DEFAULT now(),
        updated_at timestamp NOT NULL DEFAULT now()
      );
    `);

    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS creator_membership_sales_ledger (
        id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id varchar NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        creator_user_id varchar NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        membership_id varchar REFERENCES creator_memberships(id) ON DELETE SET NULL,
        checkout_session_id varchar REFERENCES creator_membership_checkout_sessions(id) ON DELETE SET NULL,
        plan_id varchar REFERENCES creator_membership_plans(id) ON DELETE SET NULL,
        gross_amount_cents integer NOT NULL,
        currency_code text NOT NULL DEFAULT 'USD',
        status text NOT NULL DEFAULT 'completed',
        status_reason text,
        created_at timestamp NOT NULL DEFAULT now(),
        updated_at timestamp NOT NULL DEFAULT now()
      );
    `);

    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS creator_posts (
        id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
        creator_user_id varchar NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        title varchar(160) NOT NULL,
        body text NOT NULL,
        post_type text NOT NULL DEFAULT 'update',
        visibility text NOT NULL DEFAULT 'public',
        linked_collection_id varchar REFERENCES drink_collections(id) ON DELETE SET NULL,
        linked_challenge_id varchar REFERENCES drink_challenges(id) ON DELETE SET NULL,
        created_at timestamp NOT NULL DEFAULT now(),
        updated_at timestamp NOT NULL DEFAULT now()
      );
    `);

    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS creator_drops (
        id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
        creator_user_id varchar NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        title varchar(160) NOT NULL,
        description text,
        drop_type text NOT NULL DEFAULT 'collection_launch',
        visibility text NOT NULL DEFAULT 'public',
        scheduled_for timestamp NOT NULL,
        linked_collection_id varchar REFERENCES drink_collections(id) ON DELETE SET NULL,
        linked_challenge_id varchar REFERENCES drink_challenges(id) ON DELETE SET NULL,
        linked_promotion_id varchar REFERENCES drink_collection_promotions(id) ON DELETE SET NULL,
        recap_notes text,
        is_published boolean NOT NULL DEFAULT true,
        created_at timestamp NOT NULL DEFAULT now(),
        updated_at timestamp NOT NULL DEFAULT now()
      );
    `);

    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS creator_drop_rsvps (
        id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id varchar NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        drop_id varchar NOT NULL REFERENCES creator_drops(id) ON DELETE CASCADE,
        created_at timestamp NOT NULL DEFAULT now(),
        CONSTRAINT creator_drop_rsvps_user_drop_idx UNIQUE (user_id, drop_id)
      );
    `);

    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS creator_roadmap_items (
        id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
        creator_user_id varchar NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        title varchar(160) NOT NULL,
        description text,
        item_type text NOT NULL DEFAULT 'roadmap',
        visibility text NOT NULL DEFAULT 'public',
        linked_collection_id varchar REFERENCES drink_collections(id) ON DELETE SET NULL,
        linked_challenge_id varchar REFERENCES drink_challenges(id) ON DELETE SET NULL,
        scheduled_for timestamp,
        released_at timestamp,
        status text NOT NULL DEFAULT 'upcoming',
        created_at timestamp NOT NULL DEFAULT now(),
        updated_at timestamp NOT NULL DEFAULT now()
      );
    `);

    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS creator_campaigns (
        id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
        creator_user_id varchar NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        slug varchar(200) NOT NULL,
        name varchar(160) NOT NULL,
        description text,
        visibility text NOT NULL DEFAULT 'public',
        starts_at timestamp,
        ends_at timestamp,
        is_active boolean NOT NULL DEFAULT true,
        created_at timestamp NOT NULL DEFAULT now(),
        updated_at timestamp NOT NULL DEFAULT now()
      );
    `);

    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS creator_campaign_links (
        id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
        campaign_id varchar NOT NULL REFERENCES creator_campaigns(id) ON DELETE CASCADE,
        target_type text NOT NULL,
        target_id varchar(200) NOT NULL,
        sort_order integer NOT NULL DEFAULT 0,
        created_at timestamp NOT NULL DEFAULT now(),
        CONSTRAINT creator_campaign_links_campaign_target_idx UNIQUE (campaign_id, target_type, target_id)
      );
    `);

    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS creator_campaign_follows (
        id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id varchar NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        campaign_id varchar NOT NULL REFERENCES creator_campaigns(id) ON DELETE CASCADE,
        created_at timestamp NOT NULL DEFAULT now(),
        CONSTRAINT creator_campaign_follows_user_campaign_idx UNIQUE (user_id, campaign_id)
      );
    `);

    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS creator_drop_events (
        id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
        drop_id varchar NOT NULL REFERENCES creator_drops(id) ON DELETE CASCADE,
        event_type text NOT NULL,
        user_id varchar REFERENCES users(id) ON DELETE SET NULL,
        target_type text,
        target_id varchar(200),
        created_at timestamp NOT NULL DEFAULT now()
      );
    `);

    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS creator_collaborations (
        id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
        owner_creator_user_id varchar NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        collaborator_user_id varchar NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        collaboration_type text NOT NULL,
        target_id varchar(200) NOT NULL,
        status text NOT NULL DEFAULT 'pending',
        created_at timestamp NOT NULL DEFAULT now(),
        updated_at timestamp NOT NULL DEFAULT now(),
        CONSTRAINT creator_collaborations_owner_collaborator_target_idx UNIQUE (
          owner_creator_user_id,
          collaborator_user_id,
          collaboration_type,
          target_id
        )
      );
    `);

    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS drink_bundles (
        id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id varchar NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        slug varchar(200) NOT NULL UNIQUE,
        name varchar(160) NOT NULL,
        description text,
        is_public boolean NOT NULL DEFAULT false,
        is_premium boolean NOT NULL DEFAULT true,
        price_cents integer NOT NULL DEFAULT 0,
        created_at timestamp NOT NULL DEFAULT now(),
        updated_at timestamp NOT NULL DEFAULT now()
      );
    `);

    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS drink_bundle_items (
        bundle_id varchar NOT NULL REFERENCES drink_bundles(id) ON DELETE CASCADE,
        collection_id varchar NOT NULL REFERENCES drink_collections(id) ON DELETE CASCADE,
        added_at timestamp NOT NULL DEFAULT now(),
        sort_order integer NOT NULL DEFAULT 0,
        CONSTRAINT drink_bundle_items_bundle_collection_idx UNIQUE (bundle_id, collection_id)
      );
    `);

    await db.execute(sql`ALTER TABLE drink_bundle_items ADD COLUMN IF NOT EXISTS sort_order integer NOT NULL DEFAULT 0;`);

    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS drink_bundle_purchases (
        id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id varchar NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        bundle_id varchar NOT NULL REFERENCES drink_bundles(id) ON DELETE CASCADE,
        status text NOT NULL DEFAULT 'completed',
        status_reason text,
        access_revoked_at timestamp,
        created_at timestamp NOT NULL DEFAULT now(),
        updated_at timestamp NOT NULL DEFAULT now(),
        CONSTRAINT drink_bundle_purchases_user_bundle_idx UNIQUE (user_id, bundle_id)
      );
    `);

    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS drink_bundle_checkout_sessions (
        id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id varchar NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        bundle_id varchar NOT NULL REFERENCES drink_bundles(id) ON DELETE CASCADE,
        provider text NOT NULL DEFAULT 'square',
        purchase_type text NOT NULL DEFAULT 'self',
        status text NOT NULL DEFAULT 'pending',
        amount_cents integer NOT NULL,
        currency_code text NOT NULL DEFAULT 'USD',
        square_payment_link_id text,
        square_order_id text,
        square_payment_id text,
        provider_reference_id text NOT NULL UNIQUE,
        checkout_url text,
        last_verified_at timestamp,
        verified_at timestamp,
        refunded_at timestamp,
        access_revoked_at timestamp,
        failure_reason text,
        expires_at timestamp,
        created_at timestamp NOT NULL DEFAULT now(),
        updated_at timestamp NOT NULL DEFAULT now()
      );
    `);

    await db.execute(sql`ALTER TABLE drink_bundle_checkout_sessions ADD COLUMN IF NOT EXISTS purchase_type text NOT NULL DEFAULT 'self';`);

    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS drink_bundle_square_webhook_events (
        id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
        event_id text NOT NULL UNIQUE,
        event_type text NOT NULL,
        object_type text,
        object_id text,
        checkout_session_id varchar REFERENCES drink_bundle_checkout_sessions(id) ON DELETE SET NULL,
        status text NOT NULL DEFAULT 'processed',
        received_at timestamp NOT NULL DEFAULT now(),
        created_at timestamp
      );
    `);

    await db.execute(sql`CREATE INDEX IF NOT EXISTS drink_collections_user_idx ON drink_collections(user_id);`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS drink_collections_public_idx ON drink_collections(is_public);`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS drink_collections_user_updated_at_idx ON drink_collections(user_id, updated_at);`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS drink_collections_public_updated_at_idx ON drink_collections(is_public, updated_at);`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS drink_collection_items_slug_idx ON drink_collection_items(drink_slug);`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS drink_collection_purchases_user_idx ON drink_collection_purchases(user_id);`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS drink_collection_purchases_collection_idx ON drink_collection_purchases(collection_id);`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS drink_collection_wishlists_user_idx ON drink_collection_wishlists(user_id);`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS drink_collection_wishlists_collection_idx ON drink_collection_wishlists(collection_id);`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS drink_collection_wishlists_user_created_at_idx ON drink_collection_wishlists(user_id, created_at);`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS drink_collection_reviews_collection_idx ON drink_collection_reviews(collection_id);`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS drink_collection_reviews_user_idx ON drink_collection_reviews(user_id);`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS drink_collection_reviews_collection_created_at_idx ON drink_collection_reviews(collection_id, created_at);`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS drink_collection_checkout_sessions_user_idx ON drink_collection_checkout_sessions(user_id);`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS drink_collection_checkout_sessions_collection_idx ON drink_collection_checkout_sessions(collection_id);`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS drink_collection_checkout_sessions_status_idx ON drink_collection_checkout_sessions(status);`);
    await db.execute(sql`CREATE UNIQUE INDEX IF NOT EXISTS drink_collection_checkout_sessions_payment_link_idx ON drink_collection_checkout_sessions(square_payment_link_id) WHERE square_payment_link_id IS NOT NULL;`);
    await db.execute(sql`CREATE UNIQUE INDEX IF NOT EXISTS drink_collection_checkout_sessions_order_idx ON drink_collection_checkout_sessions(square_order_id) WHERE square_order_id IS NOT NULL;`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS drink_gifts_purchaser_user_idx ON drink_gifts(purchaser_user_id);`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS drink_gifts_recipient_user_idx ON drink_gifts(recipient_user_id);`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS drink_gifts_target_idx ON drink_gifts(target_type, target_id);`);
    await db.execute(sql`CREATE UNIQUE INDEX IF NOT EXISTS drink_gifts_checkout_session_idx ON drink_gifts(checkout_session_id);`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS drink_gifts_status_idx ON drink_gifts(status);`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS drink_collection_square_webhook_events_object_idx ON drink_collection_square_webhook_events(object_type, object_id);`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS drink_collection_square_webhook_events_checkout_session_idx ON drink_collection_square_webhook_events(checkout_session_id);`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS drink_collection_sales_ledger_user_idx ON drink_collection_sales_ledger(user_id);`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS drink_collection_sales_ledger_collection_idx ON drink_collection_sales_ledger(collection_id);`);
    await db.execute(sql`CREATE UNIQUE INDEX IF NOT EXISTS drink_collection_sales_ledger_purchase_idx ON drink_collection_sales_ledger(purchase_id) WHERE purchase_id IS NOT NULL;`);
    await db.execute(sql`CREATE UNIQUE INDEX IF NOT EXISTS drink_collection_sales_ledger_checkout_session_idx ON drink_collection_sales_ledger(checkout_session_id) WHERE checkout_session_id IS NOT NULL;`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS drink_collection_sales_ledger_status_created_at_idx ON drink_collection_sales_ledger(status, created_at);`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS drink_collection_promotions_creator_idx ON drink_collection_promotions(creator_user_id);`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS drink_collection_promotions_collection_idx ON drink_collection_promotions(collection_id);`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS drink_collection_promotions_active_idx ON drink_collection_promotions(is_active, starts_at, ends_at);`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS drink_collection_events_collection_idx ON drink_collection_events(collection_id);`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS drink_collection_events_event_type_idx ON drink_collection_events(event_type);`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS drink_collection_events_created_at_idx ON drink_collection_events(created_at);`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS drink_collection_events_collection_event_type_created_at_idx ON drink_collection_events(collection_id, event_type, created_at);`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS creator_membership_plans_active_idx ON creator_membership_plans(is_active);`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS creator_memberships_user_idx ON creator_memberships(user_id);`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS creator_memberships_creator_idx ON creator_memberships(creator_user_id);`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS creator_memberships_status_idx ON creator_memberships(status);`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS creator_posts_creator_idx ON creator_posts(creator_user_id);`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS creator_posts_visibility_idx ON creator_posts(visibility);`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS creator_posts_creator_created_at_idx ON creator_posts(creator_user_id, created_at);`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS creator_posts_visibility_created_at_idx ON creator_posts(visibility, created_at);`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS creator_drops_creator_idx ON creator_drops(creator_user_id);`);
    await db.execute(sql`ALTER TABLE creator_drops ADD COLUMN IF NOT EXISTS recap_notes text;`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS creator_drops_visibility_idx ON creator_drops(visibility);`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS creator_drops_scheduled_for_idx ON creator_drops(scheduled_for);`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS creator_drops_published_scheduled_idx ON creator_drops(is_published, scheduled_for);`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS creator_drops_creator_scheduled_idx ON creator_drops(creator_user_id, scheduled_for);`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS creator_drop_rsvps_user_idx ON creator_drop_rsvps(user_id);`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS creator_drop_rsvps_drop_idx ON creator_drop_rsvps(drop_id);`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS creator_drop_rsvps_drop_created_at_idx ON creator_drop_rsvps(drop_id, created_at);`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS creator_roadmap_items_creator_idx ON creator_roadmap_items(creator_user_id);`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS creator_roadmap_items_visibility_idx ON creator_roadmap_items(visibility);`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS creator_roadmap_items_status_idx ON creator_roadmap_items(status);`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS creator_roadmap_items_creator_status_idx ON creator_roadmap_items(creator_user_id, status);`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS creator_roadmap_items_scheduled_idx ON creator_roadmap_items(scheduled_for);`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS creator_roadmap_items_released_idx ON creator_roadmap_items(released_at);`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS creator_campaigns_creator_idx ON creator_campaigns(creator_user_id);`);
    await db.execute(sql`CREATE UNIQUE INDEX IF NOT EXISTS creator_campaigns_slug_idx ON creator_campaigns(slug);`);
    await db.execute(sql`CREATE UNIQUE INDEX IF NOT EXISTS creator_campaigns_creator_slug_idx ON creator_campaigns(creator_user_id, slug);`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS creator_campaigns_visibility_idx ON creator_campaigns(visibility);`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS creator_campaigns_active_idx ON creator_campaigns(is_active, starts_at, ends_at);`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS creator_campaigns_creator_updated_at_idx ON creator_campaigns(creator_user_id, updated_at);`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS creator_campaign_links_campaign_idx ON creator_campaign_links(campaign_id);`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS creator_campaign_links_target_idx ON creator_campaign_links(target_type, target_id);`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS creator_campaign_links_campaign_sort_idx ON creator_campaign_links(campaign_id, sort_order, created_at);`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS creator_campaign_follows_user_idx ON creator_campaign_follows(user_id);`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS creator_campaign_follows_campaign_idx ON creator_campaign_follows(campaign_id);`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS creator_campaign_follows_campaign_created_at_idx ON creator_campaign_follows(campaign_id, created_at);`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS creator_drop_events_drop_idx ON creator_drop_events(drop_id);`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS creator_drop_events_event_type_idx ON creator_drop_events(event_type);`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS creator_drop_events_drop_event_created_at_idx ON creator_drop_events(drop_id, event_type, created_at);`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS creator_drop_events_user_idx ON creator_drop_events(user_id);`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS creator_collaborations_owner_idx ON creator_collaborations(owner_creator_user_id);`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS creator_collaborations_collaborator_idx ON creator_collaborations(collaborator_user_id);`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS creator_collaborations_status_idx ON creator_collaborations(status);`);
    await db.execute(sql`CREATE UNIQUE INDEX IF NOT EXISTS creator_collaborations_target_idx ON creator_collaborations(collaboration_type, target_id);`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS creator_membership_checkout_sessions_user_idx ON creator_membership_checkout_sessions(user_id);`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS creator_membership_checkout_sessions_creator_idx ON creator_membership_checkout_sessions(creator_user_id);`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS creator_membership_checkout_sessions_plan_idx ON creator_membership_checkout_sessions(plan_id);`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS creator_membership_checkout_sessions_status_idx ON creator_membership_checkout_sessions(status);`);
    await db.execute(sql`CREATE UNIQUE INDEX IF NOT EXISTS creator_membership_checkout_sessions_payment_link_idx ON creator_membership_checkout_sessions(square_payment_link_id) WHERE square_payment_link_id IS NOT NULL;`);
    await db.execute(sql`CREATE UNIQUE INDEX IF NOT EXISTS creator_membership_checkout_sessions_order_idx ON creator_membership_checkout_sessions(square_order_id) WHERE square_order_id IS NOT NULL;`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS creator_membership_sales_ledger_user_idx ON creator_membership_sales_ledger(user_id);`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS creator_membership_sales_ledger_creator_idx ON creator_membership_sales_ledger(creator_user_id);`);
    await db.execute(sql`CREATE UNIQUE INDEX IF NOT EXISTS creator_membership_sales_ledger_membership_idx ON creator_membership_sales_ledger(membership_id) WHERE membership_id IS NOT NULL;`);
    await db.execute(sql`CREATE UNIQUE INDEX IF NOT EXISTS creator_membership_sales_ledger_checkout_idx ON creator_membership_sales_ledger(checkout_session_id) WHERE checkout_session_id IS NOT NULL;`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS creator_membership_sales_ledger_status_idx ON creator_membership_sales_ledger(status);`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS drink_bundles_user_idx ON drink_bundles(user_id);`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS drink_bundles_public_idx ON drink_bundles(is_public);`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS drink_bundles_user_updated_at_idx ON drink_bundles(user_id, updated_at);`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS drink_bundle_items_collection_idx ON drink_bundle_items(collection_id);`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS drink_bundle_items_bundle_sort_order_idx ON drink_bundle_items(bundle_id, sort_order);`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS drink_bundle_purchases_user_idx ON drink_bundle_purchases(user_id);`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS drink_bundle_purchases_bundle_idx ON drink_bundle_purchases(bundle_id);`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS drink_bundle_checkout_sessions_user_idx ON drink_bundle_checkout_sessions(user_id);`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS drink_bundle_checkout_sessions_bundle_idx ON drink_bundle_checkout_sessions(bundle_id);`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS drink_bundle_checkout_sessions_status_idx ON drink_bundle_checkout_sessions(status);`);
    await db.execute(sql`CREATE UNIQUE INDEX IF NOT EXISTS drink_bundle_checkout_sessions_payment_link_idx ON drink_bundle_checkout_sessions(square_payment_link_id) WHERE square_payment_link_id IS NOT NULL;`);
    await db.execute(sql`CREATE UNIQUE INDEX IF NOT EXISTS drink_bundle_checkout_sessions_order_idx ON drink_bundle_checkout_sessions(square_order_id) WHERE square_order_id IS NOT NULL;`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS drink_bundle_square_webhook_events_object_idx ON drink_bundle_square_webhook_events(object_type, object_id);`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS drink_bundle_square_webhook_events_checkout_session_idx ON drink_bundle_square_webhook_events(checkout_session_id);`);

    await backfillDrinkCollectionSalesLedger();
  })();

  return _drinkCollectionsSchemaReady;
}

function estimateCollectionFinanceBreakdown(grossAmountCents: number) {
  const safeGross = Math.max(0, Number(grossAmountCents ?? 0));
  const platformFeeCents = Math.round((safeGross * PREMIUM_COLLECTION_PLATFORM_FEE_BPS) / 10000);
  const creatorShareCents = Math.max(0, safeGross - platformFeeCents);
  return {
    grossAmountCents: safeGross,
    platformFeeCents,
    creatorShareCents,
  };
}

function isCollectionAccessActive(status?: string | null): boolean {
  return status === "completed";
}

function isRefundRelatedStatus(status?: string | null): boolean {
  return status === "refunded_pending" || status === "refunded";
}

function isCreatorMembershipActiveRecord(membership?: CreatorMembershipRecord | null, now = new Date()) {
  if (!membership) return false;
  if (membership.status !== "active" && membership.status !== "canceled") return false;
  if (membership.endsAt && membership.endsAt <= now) return false;
  return true;
}

async function loadCreatorMembershipPlanByCreatorId(creatorUserId: string) {
  if (!db) return null;
  const rows = await db
    .select()
    .from(creatorMembershipPlans)
    .where(eq(creatorMembershipPlans.creatorUserId, creatorUserId))
    .limit(1);
  return rows[0] ?? null;
}

async function loadActiveCreatorMembershipsForUser(userId?: string | null) {
  if (!db || !userId) return [] as CreatorMembershipRecord[];
  const rows = await db
    .select()
    .from(creatorMemberships)
    .where(inArray(creatorMemberships.status, ["active", "canceled"]));
  return rows.filter((row) => row.userId === userId && isCreatorMembershipActiveRecord(row));
}

async function loadMembershipGrantedCollectionIdsForUser(userId?: string | null): Promise<Set<string>> {
  if (!db || !userId) return new Set();
  const memberships = await loadActiveCreatorMembershipsForUser(userId);
  if (memberships.length === 0) return new Set();
  const creatorIds = [...new Set(memberships.map((membership) => membership.creatorUserId))];
  const collectionRows = normalizeCollectionRowsForResponse(await db
    .select()
    .from(drinkCollections)
    .where(inArray(drinkCollections.userId, creatorIds)))
    .filter((collection) => collection.accessType === "membership_only")
    .map((collection) => ({ id: collection.id }));
  return new Set(collectionRows.map((row) => row.id));
}

function addCollectionAccessGrant(
  accessMap: Map<string, Set<CollectionAccessGrant>>,
  collectionId: string,
  grant: CollectionAccessGrant,
) {
  const current = accessMap.get(collectionId) ?? new Set<CollectionAccessGrant>();
  current.add(grant);
  accessMap.set(collectionId, current);
}

function serializeCollectionAccessGrants(grants?: Set<CollectionAccessGrant>) {
  if (!grants || grants.size === 0) return [] as CollectionAccessGrant[];
  return ["creator", "membership", "bundle", "direct_purchase"].filter((grant) => grants.has(grant as CollectionAccessGrant)) as CollectionAccessGrant[];
}

async function loadCollectionAccessMapForUser(userId?: string | null) {
  const accessMap = new Map<string, Set<CollectionAccessGrant>>();
  if (!db || !userId) return accessMap;

  const [directCollectionIds, ownedBundleIds, membershipCollectionIds] = await Promise.all([
    loadDirectlyOwnedCollectionIdsForUser(userId),
    loadOwnedBundleIdsForUser(userId),
    loadMembershipGrantedCollectionIdsForUser(userId),
  ]);

  for (const collectionId of directCollectionIds) {
    addCollectionAccessGrant(accessMap, collectionId, "direct_purchase");
  }

  for (const collectionId of membershipCollectionIds) {
    addCollectionAccessGrant(accessMap, collectionId, "membership");
  }

  if (ownedBundleIds.size > 0) {
    const bundleRows = await db
      .select({ collectionId: drinkBundleItems.collectionId })
      .from(drinkBundleItems)
      .where(inArray(drinkBundleItems.bundleId, [...ownedBundleIds]));

    for (const row of bundleRows) {
      addCollectionAccessGrant(accessMap, row.collectionId, "bundle");
    }
  }

  return accessMap;
}

async function loadViewerMembershipForCreator(userId: string, creatorUserId: string) {
  if (!db) return null;
  const rows = await db
    .select()
    .from(creatorMemberships)
    .where(and(eq(creatorMemberships.userId, userId), eq(creatorMemberships.creatorUserId, creatorUserId)))
    .limit(1);
  return rows[0] ?? null;
}

function serializeMembershipPlan(plan?: CreatorMembershipPlanRecord | null) {
  if (!plan) return null;
  return {
    id: plan.id,
    creatorUserId: plan.creatorUserId,
    slug: plan.slug,
    name: plan.name,
    description: plan.description ?? null,
    priceCents: Number(plan.priceCents ?? 0),
    billingInterval: normalizeMembershipBillingInterval(plan.billingInterval),
    isActive: Boolean(plan.isActive),
    createdAt: plan.createdAt.toISOString(),
    updatedAt: plan.updatedAt.toISOString(),
    benefits: [
      "Unlock this creator’s Members Only collections while your membership access is active.",
      "Support this creator with ongoing monthly or yearly membership revenue.",
      "Membership perks are additive and do not block free drink discovery, remixing, or canonical drink pages.",
    ],
  };
}

function serializeMembershipRecord(membership?: CreatorMembershipRecord | null) {
  if (!membership) return null;
  return {
    id: membership.id,
    userId: membership.userId,
    creatorUserId: membership.creatorUserId,
    planId: membership.planId,
    status: membership.status as CreatorMembershipStatus,
    startedAt: membership.startedAt.toISOString(),
    endsAt: membership.endsAt ? membership.endsAt.toISOString() : null,
    canceledAt: membership.canceledAt ? membership.canceledAt.toISOString() : null,
    squareSubscriptionId: membership.squareSubscriptionId ?? null,
    paymentReference: membership.paymentReference ?? null,
    createdAt: membership.createdAt.toISOString(),
    updatedAt: membership.updatedAt.toISOString(),
    accessActive: isCreatorMembershipActiveRecord(membership),
  };
}

function normalizeNullableForeignId(value: unknown) {
  if (typeof value !== "string") return null;
  const cleaned = value.trim();
  return cleaned.length ? cleaned : null;
}

async function loadFollowedCreatorIdsForUser(userId?: string | null) {
  if (!db || !userId) return new Set<string>();
  const rows = await db
    .select({ creatorUserId: follows.followingId })
    .from(follows)
    .where(eq(follows.followerId, userId));
  return new Set(rows.map((row) => row.creatorUserId).filter(Boolean));
}

async function loadActiveMembershipCreatorIdsForUser(userId?: string | null) {
  const memberships = await loadActiveCreatorMembershipsForUser(userId);
  return new Set(memberships.map((membership) => membership.creatorUserId).filter(Boolean));
}

async function loadFollowedCampaignIdsForUser(userId?: string | null) {
  if (!db || !userId) return new Set<string>();
  const rows = await db
    .select({ campaignId: creatorCampaignFollows.campaignId })
    .from(creatorCampaignFollows)
    .where(eq(creatorCampaignFollows.userId, userId));
  return new Set(rows.map((row) => row.campaignId).filter(Boolean));
}

async function loadCampaignFollowerCountMap(campaignIds: string[]) {
  if (!db || campaignIds.length === 0) return new Map<string, number>();

  const rows = await db
    .select({
      campaignId: creatorCampaignFollows.campaignId,
      count: sql<number>`count(*)::int`,
    })
    .from(creatorCampaignFollows)
    .where(inArray(creatorCampaignFollows.campaignId, campaignIds))
    .groupBy(creatorCampaignFollows.campaignId);

  return new Map(rows.map((row) => [row.campaignId, Number(row.count ?? 0)]));
}

function canViewerSeeCreatorPost(input: {
  post: Pick<CreatorPostRecord, "creatorUserId" | "visibility">;
  viewerId?: string | null;
  followedCreatorIds?: Set<string>;
  memberCreatorIds?: Set<string>;
}) {
  const { post, viewerId, followedCreatorIds = new Set<string>(), memberCreatorIds = new Set<string>() } = input;
  if (viewerId && post.creatorUserId === viewerId) return true;
  if (post.visibility === "public") return true;
  if (!viewerId) return false;
  if (post.visibility === "followers") return followedCreatorIds.has(post.creatorUserId);
  if (post.visibility === "members") return memberCreatorIds.has(post.creatorUserId);
  return false;
}

function creatorPostAudienceLabel(post: Pick<CreatorPostRecord, "creatorUserId" | "visibility">, viewerId?: string | null) {
  if (viewerId && post.creatorUserId === viewerId) return "You";
  if (post.visibility === "members") return "Members";
  if (post.visibility === "followers") return "Followers";
  return "Public";
}

function creatorDropSortTime(drop: Pick<CreatorDropRecord, "scheduledFor">) {
  return drop.scheduledFor.getTime();
}

function getCreatorDropStatus(drop: Pick<CreatorDropRecord, "isPublished" | "scheduledFor">, now = new Date()): CreatorDropStatus {
  const scheduledTime = creatorDropSortTime(drop);
  const nowTime = now.getTime();

  if (!drop.isPublished || scheduledTime > nowTime) return "upcoming";
  if (scheduledTime <= nowTime - CREATOR_DROP_ARCHIVE_WINDOW_MS) return "archived";
  return "live";
}

function isCreatorDropVisibleForLifecycle(drop: Pick<CreatorDropRecord, "isPublished" | "scheduledFor">, options: {
  now?: Date;
  includeArchived?: boolean;
} = {}) {
  if (!drop.isPublished) return false;
  const status = getCreatorDropStatus(drop, options.now);
  return options.includeArchived ? true : status !== "archived";
}

function canViewerSeeCreatorDrop(input: {
  drop: Pick<CreatorDropRecord, "creatorUserId" | "visibility" | "isPublished" | "scheduledFor">;
  viewerId?: string | null;
  followedCreatorIds?: Set<string>;
  memberCreatorIds?: Set<string>;
  includeArchived?: boolean;
  now?: Date;
}) {
  const {
    drop,
    viewerId,
    followedCreatorIds = new Set<string>(),
    memberCreatorIds = new Set<string>(),
    includeArchived = false,
    now,
  } = input;
  if (viewerId && drop.creatorUserId === viewerId) return true;
  if (!isCreatorDropVisibleForLifecycle(drop, { now, includeArchived })) return false;
  if (drop.visibility === "public") return true;
  if (!viewerId) return false;
  if (drop.visibility === "followers") return followedCreatorIds.has(drop.creatorUserId);
  if (drop.visibility === "members") return memberCreatorIds.has(drop.creatorUserId);
  return false;
}

function creatorDropAudienceLabel(drop: Pick<CreatorDropRecord, "creatorUserId" | "visibility">, viewerId?: string | null) {
  if (viewerId && drop.creatorUserId === viewerId) return "You";
  if (drop.visibility === "members") return "Members";
  if (drop.visibility === "followers") return "Followers";
  return "Public";
}

async function loadCreatorDropForViewer(dropId: string, viewerId?: string | null) {
  if (!db || !dropId) return null;

  const rows = await db
    .select()
    .from(creatorDrops)
    .where(eq(creatorDrops.id, dropId))
    .limit(1);

  const drop = rows[0];
  if (!drop) return null;

  const [followedCreatorIds, memberCreatorIds] = await Promise.all([
    loadFollowedCreatorIdsForUser(viewerId),
    loadActiveMembershipCreatorIdsForUser(viewerId),
  ]);

  const isCreator = Boolean(viewerId && drop.creatorUserId === viewerId);
  const canView = canViewerSeeCreatorDrop({
    drop,
    viewerId,
    followedCreatorIds,
    memberCreatorIds,
    includeArchived: true,
  });

  if (!isCreator && !canView) return null;

  return {
    drop,
    viewerId: viewerId ?? null,
    isCreator,
    followedCreatorIds,
    memberCreatorIds,
  };
}

function canViewerSeeCreatorRoadmapItem(input: {
  item: Pick<CreatorRoadmapRecord, "creatorUserId" | "visibility">;
  viewerId?: string | null;
  followedCreatorIds?: Set<string>;
  memberCreatorIds?: Set<string>;
}) {
  const { item, viewerId, followedCreatorIds = new Set<string>(), memberCreatorIds = new Set<string>() } = input;
  if (viewerId && item.creatorUserId === viewerId) return true;
  if (item.visibility === "public") return true;
  if (!viewerId) return false;
  if (item.visibility === "followers") return followedCreatorIds.has(item.creatorUserId);
  if (item.visibility === "members") return memberCreatorIds.has(item.creatorUserId);
  return false;
}

function canViewerSeeCreatorCampaign(input: {
  campaign: Pick<CreatorCampaignRecord, "creatorUserId" | "visibility">;
  viewerId?: string | null;
  followedCreatorIds?: Set<string>;
  memberCreatorIds?: Set<string>;
}) {
  const { campaign, viewerId, followedCreatorIds = new Set<string>(), memberCreatorIds = new Set<string>() } = input;
  if (viewerId && campaign.creatorUserId === viewerId) return true;
  if (campaign.visibility === "public") return true;
  if (!viewerId) return false;
  if (campaign.visibility === "followers") return followedCreatorIds.has(campaign.creatorUserId);
  if (campaign.visibility === "members") return memberCreatorIds.has(campaign.creatorUserId);
  return false;
}

function creatorCampaignAudienceLabel(campaign: Pick<CreatorCampaignRecord, "creatorUserId" | "visibility">, viewerId?: string | null) {
  if (viewerId && campaign.creatorUserId === viewerId) return "You";
  if (campaign.visibility === "members") return "Members";
  if (campaign.visibility === "followers") return "Followers";
  return "Public";
}

function getCreatorCampaignState(campaign: Pick<CreatorCampaignRecord, "startsAt" | "endsAt" | "isActive">, now = new Date()): CreatorCampaignState {
  if (!campaign.isActive) {
    if (campaign.startsAt && campaign.startsAt > now) return "upcoming";
    return "past";
  }
  if (campaign.startsAt && campaign.startsAt > now) return "upcoming";
  if (campaign.endsAt && campaign.endsAt < now) return "past";
  return "active";
}

function serializeCreatorCampaign(
  campaign: CreatorCampaignRecord,
  options: {
    viewerId?: string | null;
    creator?: { id: string; username: string | null; avatar: string | null } | null;
    counts?: Partial<Record<CreatorCampaignTargetType, number>>;
    followerCount?: number;
    isFollowing?: boolean;
  } = {},
) {
  const counts = options.counts ?? {};
  const isOwner = Boolean(options.viewerId && campaign.creatorUserId === options.viewerId);
  return {
    id: campaign.id,
    creatorUserId: campaign.creatorUserId,
    slug: campaign.slug,
    name: campaign.name,
    description: campaign.description ?? null,
    visibility: campaign.visibility as CreatorCampaignVisibility,
    audienceLabel: creatorCampaignAudienceLabel(campaign, options.viewerId),
    startsAt: campaign.startsAt ? campaign.startsAt.toISOString() : null,
    endsAt: campaign.endsAt ? campaign.endsAt.toISOString() : null,
    isActive: Boolean(campaign.isActive),
    state: getCreatorCampaignState(campaign),
    route: `/drinks/campaigns/${encodeURIComponent(campaign.slug)}`,
    followerCount: Number(options.followerCount ?? 0),
    isFollowing: Boolean(options.isFollowing),
    isOwner,
    canFollow: Boolean(options.viewerId && !isOwner),
    counts: {
      collections: Number(counts.collection ?? 0),
      drops: Number(counts.drop ?? 0),
      promos: Number(counts.promo ?? 0),
      challenges: Number(counts.challenge ?? 0),
      posts: Number(counts.post ?? 0),
      roadmap: Number(counts.roadmap ?? 0),
      total: Number(
        (counts.collection ?? 0)
        + (counts.drop ?? 0)
        + (counts.promo ?? 0)
        + (counts.challenge ?? 0)
        + (counts.post ?? 0)
        + (counts.roadmap ?? 0)
      ),
    },
    createdAt: campaign.createdAt.toISOString(),
    updatedAt: campaign.updatedAt.toISOString(),
    creator: options.creator
      ? {
        userId: options.creator.id,
        username: options.creator.username ?? null,
        avatar: options.creator.avatar ?? null,
        route: `/drinks/creator/${encodeURIComponent(options.creator.id)}`,
      }
      : null,
  };
}

async function loadCreatorCampaignLinksByCampaignIds(campaignIds: string[]) {
  if (!db || campaignIds.length === 0) return new Map<string, CreatorCampaignLinkRecord[]>();
  const rows = await db
    .select()
    .from(creatorCampaignLinks)
    .where(inArray(creatorCampaignLinks.campaignId, campaignIds))
    .orderBy(asc(creatorCampaignLinks.sortOrder), asc(creatorCampaignLinks.createdAt));

  const map = new Map<string, CreatorCampaignLinkRecord[]>();
  for (const row of rows) {
    const current = map.get(row.campaignId) ?? [];
    current.push(row);
    map.set(row.campaignId, current);
  }
  return map;
}

async function loadCreatorCampaignSummaryMaps(campaigns: CreatorCampaignRecord[]) {
  const creatorMap = await loadCreatorProfilesMap([...new Set(campaigns.map((campaign) => campaign.creatorUserId).filter(Boolean))]);
  const linkMap = await loadCreatorCampaignLinksByCampaignIds(campaigns.map((campaign) => campaign.id));
  const followerCountMap = await loadCampaignFollowerCountMap(campaigns.map((campaign) => campaign.id));
  const countsMap = new Map<string, Partial<Record<CreatorCampaignTargetType, number>>>();

  for (const campaign of campaigns) {
    const links = linkMap.get(campaign.id) ?? [];
    const counts: Partial<Record<CreatorCampaignTargetType, number>> = {};
    for (const link of links) {
      const targetType = link.targetType as CreatorCampaignTargetType;
      counts[targetType] = Number(counts[targetType] ?? 0) + 1;
    }
    countsMap.set(campaign.id, counts);
  }

  return {
    creatorMap,
    linkMap,
    countsMap,
    followerCountMap,
  };
}

async function validateCreatorCampaignLinks(creatorUserId: string, links: Array<{ targetType: CreatorCampaignTargetType; targetId: string }>) {
  if (!db || links.length === 0) return;

  for (const link of links) {
    switch (link.targetType) {
      case "collection": {
        const rows = await db
          .select({ id: drinkCollections.id })
          .from(drinkCollections)
          .where(and(eq(drinkCollections.id, link.targetId), eq(drinkCollections.userId, creatorUserId)))
          .limit(1);
        if (!rows[0]) throw new Error("Linked collection campaigns must point to one of your collections.");
        break;
      }
      case "drop": {
        const rows = await db
          .select({ id: creatorDrops.id })
          .from(creatorDrops)
          .where(and(eq(creatorDrops.id, link.targetId), eq(creatorDrops.creatorUserId, creatorUserId)))
          .limit(1);
        if (!rows[0]) throw new Error("Linked drops must belong to the creator.");
        break;
      }
      case "promo": {
        const rows = await db
          .select({ id: drinkCollectionPromotions.id })
          .from(drinkCollectionPromotions)
          .where(and(eq(drinkCollectionPromotions.id, link.targetId), eq(drinkCollectionPromotions.creatorUserId, creatorUserId)))
          .limit(1);
        if (!rows[0]) throw new Error("Linked promos must belong to the creator.");
        break;
      }
      case "post": {
        const rows = await db
          .select({ id: creatorPosts.id })
          .from(creatorPosts)
          .where(and(eq(creatorPosts.id, link.targetId), eq(creatorPosts.creatorUserId, creatorUserId)))
          .limit(1);
        if (!rows[0]) throw new Error("Linked posts must belong to the creator.");
        break;
      }
      case "roadmap": {
        const rows = await db
          .select({ id: creatorRoadmapItems.id })
          .from(creatorRoadmapItems)
          .where(and(eq(creatorRoadmapItems.id, link.targetId), eq(creatorRoadmapItems.creatorUserId, creatorUserId)))
          .limit(1);
        if (!rows[0]) throw new Error("Linked roadmap items must belong to the creator.");
        break;
      }
      case "challenge": {
        const rows = await db
          .select({ id: drinkChallenges.id })
          .from(drinkChallenges)
          .where(eq(drinkChallenges.id, link.targetId))
          .limit(1);
        if (!rows[0]) throw new Error("Linked challenge was not found.");
        break;
      }
      default:
        throw new Error("Unsupported campaign content type.");
    }
  }
}

async function replaceCreatorCampaignLinks(campaignId: string, links: Array<{ targetType: CreatorCampaignTargetType; targetId: string; sortOrder: number }>) {
  if (!db) throw new Error("Database unavailable");
  await db.delete(creatorCampaignLinks).where(eq(creatorCampaignLinks.campaignId, campaignId));
  if (!links.length) return;
  await db.insert(creatorCampaignLinks).values(
    links.map((link) => insertCreatorCampaignLinkSchema.parse({
      campaignId,
      targetType: link.targetType,
      targetId: link.targetId,
      sortOrder: link.sortOrder,
    })),
  );
}
function creatorRoadmapAudienceLabel(item: Pick<CreatorRoadmapRecord, "creatorUserId" | "visibility">, viewerId?: string | null) {
  if (viewerId && item.creatorUserId === viewerId) return "You";
  if (item.visibility === "members") return "Members";
  if (item.visibility === "followers") return "Followers";
  return "Public";
}

function roadmapSortDate(item: Pick<CreatorRoadmapRecord, "status" | "scheduledFor" | "releasedAt" | "updatedAt" | "createdAt">) {
  if (item.status === "upcoming") {
    return item.scheduledFor ?? item.updatedAt ?? item.createdAt;
  }
  return item.releasedAt ?? item.updatedAt ?? item.createdAt;
}

function sortCreatorRoadmapItems(items: CreatorRoadmapRecord[]) {
  const statusPriority: Record<CreatorRoadmapStatus, number> = {
    live: 0,
    upcoming: 1,
    archived: 2,
  };

  return [...items].sort((a, b) => {
    const aStatus = a.status as CreatorRoadmapStatus;
    const bStatus = b.status as CreatorRoadmapStatus;
    if (statusPriority[aStatus] !== statusPriority[bStatus]) {
      return statusPriority[aStatus] - statusPriority[bStatus];
    }

    const aDate = roadmapSortDate(a).getTime();
    const bDate = roadmapSortDate(b).getTime();

    if (aStatus === "upcoming") {
      return aDate - bDate;
    }

    return bDate - aDate;
  });
}

async function validateCreatorPostLinkedEntities(input: {
  creatorUserId: string;
  visibility?: CreatorPostVisibility | null;
  linkedCollectionId?: string | null;
  linkedChallengeId?: string | null;
}) {
  if (!db) throw new Error("Database unavailable");

  if (input.linkedCollectionId) {
    const collectionRows = await db
      .select({ id: drinkCollections.id, isPublic: drinkCollections.isPublic })
      .from(drinkCollections)
      .where(and(eq(drinkCollections.id, input.linkedCollectionId), eq(drinkCollections.userId, input.creatorUserId)))
      .limit(1);

    if (!collectionRows[0]) {
      throw new Error("Linked collection must belong to the creator.");
    }
    if (!collectionRows[0].isPublic && input.visibility !== "members") {
      throw new Error("Non-public collections can only be linked from member-visible posts.");
    }
  }

  if (input.linkedChallengeId) {
    const challengeRows = await db
      .select({ id: drinkChallenges.id })
      .from(drinkChallenges)
      .where(eq(drinkChallenges.id, input.linkedChallengeId))
      .limit(1);

    if (!challengeRows[0]) {
      throw new Error("Linked challenge was not found.");
    }
  }
}

async function validateCreatorDropLinkedEntities(input: {
  creatorUserId: string;
  visibility?: CreatorDropVisibility | null;
  dropType?: CreatorDropType | null;
  linkedCollectionId?: string | null;
  linkedChallengeId?: string | null;
  linkedPromotionId?: string | null;
}) {
  if (!db) throw new Error("Database unavailable");

  if (input.linkedCollectionId) {
    const collectionRows = await db
      .select({
        id: drinkCollections.id,
        isPublic: drinkCollections.isPublic,
        accessType: drinkCollections.accessType,
      })
      .from(drinkCollections)
      .where(and(eq(drinkCollections.id, input.linkedCollectionId), eq(drinkCollections.userId, input.creatorUserId)))
      .limit(1);

    const linkedCollection = collectionRows[0];
    if (!linkedCollection) {
      throw new Error("Linked collection must belong to the creator.");
    }
    if ((linkedCollection.accessType === "membership_only" || !linkedCollection.isPublic) && input.visibility !== "members") {
      throw new Error("Member-only collections can only be linked from member-visible drops.");
    }
  }

  if (input.linkedChallengeId) {
    const challengeRows = await db
      .select({ id: drinkChallenges.id })
      .from(drinkChallenges)
      .where(eq(drinkChallenges.id, input.linkedChallengeId))
      .limit(1);

    if (!challengeRows[0]) {
      throw new Error("Linked challenge was not found.");
    }
  }

  if (input.linkedPromotionId) {
    const promotionRows = await db
      .select({
        id: drinkCollectionPromotions.id,
        creatorUserId: drinkCollectionPromotions.creatorUserId,
        collectionId: drinkCollectionPromotions.collectionId,
      })
      .from(drinkCollectionPromotions)
      .where(eq(drinkCollectionPromotions.id, input.linkedPromotionId))
      .limit(1);

    const promotion = promotionRows[0];
    if (!promotion || promotion.creatorUserId !== input.creatorUserId) {
      throw new Error("Linked promotion must belong to the creator.");
    }
    if (input.linkedCollectionId && promotion.collectionId !== input.linkedCollectionId) {
      throw new Error("Linked promotion must match the linked collection.");
    }
  }

  if (input.dropType === "promo_launch" && !input.linkedPromotionId) {
    throw new Error("Promo launch drops should link to a promotion.");
  }

  if (input.dropType === "member_drop" && input.visibility !== "members") {
    throw new Error("Member drops must use members visibility.");
  }
}

async function validateCreatorRoadmapLinkedEntities(input: {
  creatorUserId: string;
  itemType?: CreatorRoadmapItemType | null;
  visibility?: CreatorRoadmapVisibility | null;
  linkedCollectionId?: string | null;
  linkedChallengeId?: string | null;
}) {
  if (!db) throw new Error("Database unavailable");

  if (input.linkedCollectionId) {
    const collectionRows = await db
      .select({ id: drinkCollections.id })
      .from(drinkCollections)
      .where(and(eq(drinkCollections.id, input.linkedCollectionId), eq(drinkCollections.userId, input.creatorUserId)))
      .limit(1);

    if (!collectionRows[0]) {
      throw new Error("Linked collection must belong to the creator.");
    }
  }

  if (input.linkedChallengeId) {
    const challengeRows = await db
      .select({ id: drinkChallenges.id })
      .from(drinkChallenges)
      .where(eq(drinkChallenges.id, input.linkedChallengeId))
      .limit(1);

    if (!challengeRows[0]) {
      throw new Error("Linked challenge was not found.");
    }
  }

  if (input.itemType === "member_drop" && input.visibility !== "members") {
    throw new Error("Member drop roadmap items must use members visibility.");
  }
}

async function loadCreatorPostLinkedMaps(posts: CreatorPostRecord[]) {
  if (!db || posts.length === 0) {
    return {
      creatorMap: new Map<string, Awaited<ReturnType<typeof loadUserBasicProfile>>>(),
      collectionMap: new Map<string, typeof drinkCollections.$inferSelect>(),
      challengeMap: new Map<string, typeof drinkChallenges.$inferSelect>(),
      collaborationMap: new Map<string, CreatorCollaborationRecord>(),
      collaborationProfileMap: new Map<string, { id: string; username: string | null; avatar: string | null }>(),
    };
  }

  const creatorIds = [...new Set(posts.map((post) => post.creatorUserId).filter(Boolean))];
  const collectionIds = [...new Set(posts.map((post) => post.linkedCollectionId).filter((value): value is string => Boolean(value)))];
  const challengeIds = [...new Set(posts.map((post) => post.linkedChallengeId).filter((value): value is string => Boolean(value)))];

  const [creatorRows, collectionRows, challengeRows] = await Promise.all([
    creatorIds.length === 0
      ? Promise.resolve([] as Array<{ id: string; username: string | null; avatar: string | null }>)
      : db
        .select({ id: users.id, username: users.username, avatar: users.avatar })
        .from(users)
        .where(inArray(users.id, creatorIds)),
    collectionIds.length === 0
      ? Promise.resolve([] as Array<typeof drinkCollections.$inferSelect>)
      : db.select().from(drinkCollections).where(inArray(drinkCollections.id, collectionIds)),
    challengeIds.length === 0
      ? Promise.resolve([] as Array<typeof drinkChallenges.$inferSelect>)
      : db.select().from(drinkChallenges).where(inArray(drinkChallenges.id, challengeIds)),
  ]);
  const collaborationMap = await loadAcceptedCollaborationsForTargets(
    posts.map((post) => ({ collaborationType: "post" as const, targetId: post.id })),
  );
  const collaborationProfileMap = await loadCreatorProfilesMap(
    [...collaborationMap.values()].flatMap((row) => [row.ownerCreatorUserId, row.collaboratorUserId]),
  );

  return {
    creatorMap: new Map(creatorRows.map((row) => [row.id, row])),
    collectionMap: new Map(collectionRows.map((row) => [row.id, row])),
    challengeMap: new Map(challengeRows.map((row) => [row.id, row])),
    collaborationMap,
    collaborationProfileMap,
  };
}

async function loadCreatorDropLinkedMaps(drops: CreatorDropRecord[]) {
  if (!db || drops.length === 0) {
    return {
      creatorMap: new Map<string, Awaited<ReturnType<typeof loadUserBasicProfile>>>(),
      collectionMap: new Map<string, typeof drinkCollections.$inferSelect>(),
      challengeMap: new Map<string, typeof drinkChallenges.$inferSelect>(),
      promotionMap: new Map<string, typeof drinkCollectionPromotions.$inferSelect>(),
      collaborationMap: new Map<string, CreatorCollaborationRecord>(),
      collaborationProfileMap: new Map<string, { id: string; username: string | null; avatar: string | null }>(),
    };
  }

  const creatorIds = [...new Set(drops.map((drop) => drop.creatorUserId).filter(Boolean))];
  const collectionIds = [...new Set(drops.map((drop) => drop.linkedCollectionId).filter((value): value is string => Boolean(value)))];
  const challengeIds = [...new Set(drops.map((drop) => drop.linkedChallengeId).filter((value): value is string => Boolean(value)))];
  const promotionIds = [...new Set(drops.map((drop) => drop.linkedPromotionId).filter((value): value is string => Boolean(value)))];

  const [creatorRows, collectionRows, challengeRows, promotionRows] = await Promise.all([
    creatorIds.length === 0
      ? Promise.resolve([] as Array<{ id: string; username: string | null; avatar: string | null }>)
      : db
        .select({ id: users.id, username: users.username, avatar: users.avatar })
        .from(users)
        .where(inArray(users.id, creatorIds)),
    collectionIds.length === 0
      ? Promise.resolve([] as Array<typeof drinkCollections.$inferSelect>)
      : db.select().from(drinkCollections).where(inArray(drinkCollections.id, collectionIds)),
    challengeIds.length === 0
      ? Promise.resolve([] as Array<typeof drinkChallenges.$inferSelect>)
      : db.select().from(drinkChallenges).where(inArray(drinkChallenges.id, challengeIds)),
    promotionIds.length === 0
      ? Promise.resolve([] as Array<typeof drinkCollectionPromotions.$inferSelect>)
      : db.select().from(drinkCollectionPromotions).where(inArray(drinkCollectionPromotions.id, promotionIds)),
  ]);
  const collaborationMap = await loadAcceptedCollaborationsForTargets(
    drops.map((drop) => ({ collaborationType: "drop" as const, targetId: drop.id })),
  );
  const collaborationProfileMap = await loadCreatorProfilesMap(
    [...collaborationMap.values()].flatMap((row) => [row.ownerCreatorUserId, row.collaboratorUserId]),
  );

  return {
    creatorMap: new Map(creatorRows.map((row) => [row.id, row])),
    collectionMap: new Map(collectionRows.map((row) => [row.id, row])),
    challengeMap: new Map(challengeRows.map((row) => [row.id, row])),
    promotionMap: new Map(promotionRows.map((row) => [row.id, row])),
    collaborationMap,
    collaborationProfileMap,
  };
}

async function loadCreatorDropRsvpMaps(drops: CreatorDropRecord[], viewerId?: string | null) {
  if (!db || drops.length === 0) {
    return {
      rsvpCountMap: new Map<string, number>(),
      viewerRsvpSet: new Set<string>(),
    };
  }

  const dropIds = [...new Set(drops.map((drop) => drop.id).filter(Boolean))];
  if (dropIds.length === 0) {
    return {
      rsvpCountMap: new Map<string, number>(),
      viewerRsvpSet: new Set<string>(),
    };
  }

  const [countRows, viewerRows] = await Promise.all([
    db
      .select({
        dropId: creatorDropRsvps.dropId,
        count: sql<number>`count(*)::int`,
      })
      .from(creatorDropRsvps)
      .where(inArray(creatorDropRsvps.dropId, dropIds))
      .groupBy(creatorDropRsvps.dropId),
    viewerId
      ? db
          .select({ dropId: creatorDropRsvps.dropId })
          .from(creatorDropRsvps)
          .where(and(eq(creatorDropRsvps.userId, viewerId), inArray(creatorDropRsvps.dropId, dropIds)))
      : Promise.resolve([] as Array<{ dropId: string }>),
  ]);

  return {
    rsvpCountMap: new Map(countRows.map((row) => [row.dropId, Number(row.count ?? 0)])),
    viewerRsvpSet: new Set(viewerRows.map((row) => row.dropId).filter(Boolean)),
  };
}

async function loadCreatorRoadmapLinkedMaps(items: CreatorRoadmapRecord[]) {
  if (!db || items.length === 0) {
    return {
      creatorMap: new Map<string, Awaited<ReturnType<typeof loadUserBasicProfile>>>(),
      collectionMap: new Map<string, typeof drinkCollections.$inferSelect>(),
      challengeMap: new Map<string, typeof drinkChallenges.$inferSelect>(),
      collaborationMap: new Map<string, CreatorCollaborationRecord>(),
      collaborationProfileMap: new Map<string, { id: string; username: string | null; avatar: string | null }>(),
    };
  }

  const creatorIds = [...new Set(items.map((item) => item.creatorUserId).filter(Boolean))];
  const collectionIds = [...new Set(items.map((item) => item.linkedCollectionId).filter((value): value is string => Boolean(value)))];
  const challengeIds = [...new Set(items.map((item) => item.linkedChallengeId).filter((value): value is string => Boolean(value)))];

  const [creatorRows, collectionRows, challengeRows] = await Promise.all([
    creatorIds.length === 0
      ? Promise.resolve([] as Array<{ id: string; username: string | null; avatar: string | null }>)
      : db
        .select({ id: users.id, username: users.username, avatar: users.avatar })
        .from(users)
        .where(inArray(users.id, creatorIds)),
    collectionIds.length === 0
      ? Promise.resolve([] as Array<typeof drinkCollections.$inferSelect>)
      : db.select().from(drinkCollections).where(inArray(drinkCollections.id, collectionIds)),
    challengeIds.length === 0
      ? Promise.resolve([] as Array<typeof drinkChallenges.$inferSelect>)
      : db.select().from(drinkChallenges).where(inArray(drinkChallenges.id, challengeIds)),
  ]);
  const collaborationMap = await loadAcceptedCollaborationsForTargets(
    items.map((item) => ({ collaborationType: "roadmap" as const, targetId: item.id })),
  );
  const collaborationProfileMap = await loadCreatorProfilesMap(
    [...collaborationMap.values()].flatMap((row) => [row.ownerCreatorUserId, row.collaboratorUserId]),
  );

  return {
    creatorMap: new Map(creatorRows.map((row) => [row.id, row])),
    collectionMap: new Map(collectionRows.map((row) => [row.id, row])),
    challengeMap: new Map(challengeRows.map((row) => [row.id, row])),
    collaborationMap,
    collaborationProfileMap,
  };
}


type CreatorCampaignAnalyticsItem = {
  campaignId: string;
  slug: string;
  name: string;
  visibility: CreatorCampaignVisibility;
  isActive: boolean;
  startsAt: string | null;
  endsAt: string | null;
  followerCount: number;
  linkedDropsCount: number;
  linkedPostsCount: number;
  linkedCollectionsCount: number;
  linkedChallengesCount: number;
  totalDropRsvps: number;
  totalDropViews: number;
  totalDropClicks: number;
  purchasesFromLinkedCollections: number;
  purchasesFromLinkedCollectionsNote: string | null;
  membershipsFromCampaign: number;
  membershipsFromCampaignNote: string | null;
  campaignEngagementScore: number;
  campaignEngagementScoreNote: string;
  milestones: CreatorCampaignMilestone[];
};

type CreatorCampaignAnalyticsSummary = {
  totalCampaigns: number;
  activeCampaigns: number;
  totalCampaignFollowers: number;
  totalCampaignDropRsvps: number;
  totalCampaignClicks: number;
  totalCampaignPurchases: number;
  totalCampaignMembershipConversions: number;
};

type CreatorCampaignMilestoneType =
  | "campaign_live"
  | "first_drop_live"
  | "first_collection_linked"
  | "first_sale_from_campaign"
  | "first_membership_conversion"
  | "member_campaign_launched"
  | "campaign_followers_10"
  | "campaign_followers_50"
  | "campaign_followers_100"
  | "campaign_rsvps_10"
  | "campaign_rsvps_50"
  | "campaign_clicks_100";

type CreatorCampaignMilestone = {
  type: CreatorCampaignMilestoneType;
  label: string;
  shortLabel: string;
  description: string;
  achieved: boolean;
  achievedAt: string | null;
  isPublic: boolean;
  currentValue: number | null;
  targetValue: number | null;
};

function toMilestoneDate(value?: Date | null) {
  return value ? value.toISOString() : null;
}

function findNthAchievementDate<T extends { createdAt: Date }>(rows: T[], target: number) {
  if (rows.length < target || target <= 0) return null;
  return rows[target - 1]?.createdAt ?? null;
}

function buildCreatorCampaignMilestones(input: {
  campaign: CreatorCampaignRecord;
  links: CreatorCampaignLinkRecord[];
  isMemberFocusedCampaign: boolean;
  followerCount: number;
  followRows: Array<{ createdAt: Date }>;
  dropRows: Array<Pick<CreatorDropRecord, "id" | "dropType" | "isPublished" | "scheduledFor">>;
  totalDropRsvps: number;
  rsvpRows: Array<{ createdAt: Date }>;
  totalDropClicks: number;
  purchasesFromLinkedCollections: number;
  purchaseRows: Array<{ createdAt: Date }>;
  membershipsFromCampaign: number;
  membershipRows: Array<{ createdAt: Date }>;
}) {
  const now = new Date();
  const state = getCreatorCampaignState(input.campaign, now);
  const launchedAt = input.campaign.startsAt && input.campaign.startsAt <= now
    ? input.campaign.startsAt
    : state !== "upcoming"
      ? input.campaign.createdAt
      : null;
  const sortedLiveDrops = input.dropRows
    .filter((drop) => drop.isPublished && drop.scheduledFor <= now)
    .sort((a, b) => a.scheduledFor.getTime() - b.scheduledFor.getTime());
  const firstDropLiveAt = sortedLiveDrops[0]?.scheduledFor ?? null;
  const firstCollectionLinkedAt = input.links
    .filter((link) => link.targetType === "collection")
    .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())[0]?.createdAt ?? null;
  const memberCampaignLaunchAt = input.isMemberFocusedCampaign && state !== "upcoming"
    ? launchedAt ?? input.campaign.createdAt
    : null;

  const milestones: CreatorCampaignMilestone[] = [
    {
      type: "campaign_live",
      label: state === "active" ? "Live now" : "Campaign launched",
      shortLabel: state === "active" ? "Live now" : "Launched",
      description: "The campaign has started and is actively part of the creator story arc.",
      achieved: Boolean(launchedAt),
      achievedAt: toMilestoneDate(launchedAt),
      isPublic: true,
      currentValue: null,
      targetValue: null,
    },
    {
      type: "first_drop_live",
      label: "First drop live",
      shortLabel: "Drop live",
      description: "At least one linked drop has gone live inside this campaign.",
      achieved: Boolean(firstDropLiveAt),
      achievedAt: toMilestoneDate(firstDropLiveAt),
      isPublic: true,
      currentValue: Number(sortedLiveDrops.length),
      targetValue: 1,
    },
    {
      type: "first_collection_linked",
      label: "Collection linked",
      shortLabel: "Collection linked",
      description: "The campaign has a linked collection for followers to explore or purchase.",
      achieved: Boolean(firstCollectionLinkedAt),
      achievedAt: toMilestoneDate(firstCollectionLinkedAt),
      isPublic: true,
      currentValue: input.links.filter((link) => link.targetType === "collection").length,
      targetValue: 1,
    },
    {
      type: "first_sale_from_campaign",
      label: "First campaign sale",
      shortLabel: "First sale",
      description: "A linked collection has recorded its first completed purchase during the campaign window.",
      achieved: input.purchasesFromLinkedCollections > 0,
      achievedAt: toMilestoneDate(input.purchaseRows[0]?.createdAt ?? null),
      isPublic: true,
      currentValue: input.purchasesFromLinkedCollections,
      targetValue: 1,
    },
    {
      type: "first_membership_conversion",
      label: "First membership conversion",
      shortLabel: "First member",
      description: "The campaign has driven its first membership conversion proxy.",
      achieved: input.membershipsFromCampaign > 0,
      achievedAt: toMilestoneDate(input.membershipRows[0]?.createdAt ?? null),
      isPublic: false,
      currentValue: input.membershipsFromCampaign,
      targetValue: 1,
    },
    {
      type: "member_campaign_launched",
      label: "Member campaign launched",
      shortLabel: "Member campaign",
      description: "This campaign includes member-focused access or member drops.",
      achieved: Boolean(memberCampaignLaunchAt),
      achievedAt: toMilestoneDate(memberCampaignLaunchAt),
      isPublic: false,
      currentValue: null,
      targetValue: null,
    },
    ...([10, 50, 100] as const).map((target) => ({
      type: `campaign_followers_${target}` as const,
      label: `${target} campaign followers`,
      shortLabel: `${target} followers`,
      description: `Followers are explicitly subscribing to this campaign story arc.`,
      achieved: input.followerCount >= target,
      achievedAt: toMilestoneDate(findNthAchievementDate(input.followRows, target)),
      isPublic: true,
      currentValue: input.followerCount,
      targetValue: target,
    })),
    ...([10, 50] as const).map((target) => ({
      type: `campaign_rsvps_${target}` as const,
      label: `${target} RSVP interest`,
      shortLabel: `${target} RSVPs`,
      description: `Linked drops have collected ${target}+ RSVPs or Notify Me signups.`,
      achieved: input.totalDropRsvps >= target,
      achievedAt: toMilestoneDate(findNthAchievementDate(input.rsvpRows, target)),
      isPublic: true,
      currentValue: input.totalDropRsvps,
      targetValue: target,
    })),
    {
      type: "campaign_clicks_100",
      label: "100 click-throughs",
      shortLabel: "100 clicks",
      description: "Linked drops have generated 100 or more click-through events.",
      achieved: input.totalDropClicks >= 100,
      achievedAt: null,
      isPublic: false,
      currentValue: input.totalDropClicks,
      targetValue: 100,
    },
  ];

  return milestones;
}

async function loadCreatorCampaignPerformanceSnapshots(creatorUserId: string) {
  if (!db) throw new Error("Database unavailable");

  const campaigns = await db
    .select()
    .from(creatorCampaigns)
    .where(eq(creatorCampaigns.creatorUserId, creatorUserId))
    .orderBy(desc(creatorCampaigns.updatedAt))
    .limit(120);

  if (campaigns.length === 0) {
    return {
      summary: {
        totalCampaigns: 0,
        activeCampaigns: 0,
        totalCampaignFollowers: 0,
        totalCampaignDropRsvps: 0,
        totalCampaignClicks: 0,
        totalCampaignPurchases: 0,
        totalCampaignMembershipConversions: 0,
      } satisfies CreatorCampaignAnalyticsSummary,
      items: [] as CreatorCampaignAnalyticsItem[],
      attributionNotes: [
        "Campaign follower counts come from explicit campaign follows.",
        "Drop RSVP, view, and click metrics roll up linked drop analytics that already exist elsewhere in the creator dashboard.",
        "Purchases from linked collections are approximate and count completed purchases made during the campaign window.",
        "Membership conversions are approximate and only shown for member-focused campaigns that have member visibility, member drops, or members-only collections.",
        "Milestones are derived from existing campaign analytics so creators get momentum badges without managing another system.",
        "Campaign engagement score is a lightweight weighted score for comparison, not a payout or attribution metric.",
      ],
      generatedAt: new Date().toISOString(),
    };
  }

  const campaignIds = campaigns.map((campaign) => campaign.id);
  const [linkMap, followerCountMap, followRows, membershipRows] = await Promise.all([
    loadCreatorCampaignLinksByCampaignIds(campaignIds),
    loadCampaignFollowerCountMap(campaignIds),
    db.select({
      campaignId: creatorCampaignFollows.campaignId,
      createdAt: creatorCampaignFollows.createdAt,
    }).from(creatorCampaignFollows).where(inArray(creatorCampaignFollows.campaignId, campaignIds)).orderBy(asc(creatorCampaignFollows.createdAt)),
    db.select({
      createdAt: creatorMemberships.createdAt,
      status: creatorMemberships.status,
    }).from(creatorMemberships).where(eq(creatorMemberships.creatorUserId, creatorUserId)).orderBy(asc(creatorMemberships.createdAt)),
  ]);

  const dropIds = [...new Set(
    campaigns.flatMap((campaign) => (linkMap.get(campaign.id) ?? [])
      .filter((link) => link.targetType === "drop")
      .map((link) => link.targetId)),
  )];
  const collectionIds = [...new Set(
    campaigns.flatMap((campaign) => (linkMap.get(campaign.id) ?? [])
      .filter((link) => link.targetType === "collection")
      .map((link) => link.targetId)),
  )];

  const [dropRows, collectionRows, eventRows, rsvpCountRows, rsvpActivityRows, purchaseRows] = await Promise.all([
    dropIds.length
      ? db.select({
          id: creatorDrops.id,
          dropType: creatorDrops.dropType,
          isPublished: creatorDrops.isPublished,
          scheduledFor: creatorDrops.scheduledFor,
        }).from(creatorDrops).where(inArray(creatorDrops.id, dropIds))
      : Promise.resolve([] as Array<Pick<CreatorDropRecord, "id" | "dropType" | "isPublished" | "scheduledFor">>),
    collectionIds.length
      ? db.select({
          id: drinkCollections.id,
          accessType: drinkCollections.accessType,
        }).from(drinkCollections).where(inArray(drinkCollections.id, collectionIds))
      : Promise.resolve([] as Array<{ id: string; accessType: string | null }>),
    dropIds.length
      ? db.select({
          dropId: creatorDropEvents.dropId,
          eventType: creatorDropEvents.eventType,
          count: sql<number>`count(*)::int`,
        }).from(creatorDropEvents).where(inArray(creatorDropEvents.dropId, dropIds)).groupBy(creatorDropEvents.dropId, creatorDropEvents.eventType)
      : Promise.resolve([] as Array<{ dropId: string; eventType: string; count: number }>),
    dropIds.length
      ? db.select({
          dropId: creatorDropRsvps.dropId,
          count: sql<number>`count(*)::int`,
        }).from(creatorDropRsvps).where(inArray(creatorDropRsvps.dropId, dropIds)).groupBy(creatorDropRsvps.dropId)
      : Promise.resolve([] as Array<{ dropId: string; count: number }>),
    dropIds.length
      ? db.select({
          dropId: creatorDropRsvps.dropId,
          createdAt: creatorDropRsvps.createdAt,
        }).from(creatorDropRsvps).where(inArray(creatorDropRsvps.dropId, dropIds)).orderBy(asc(creatorDropRsvps.createdAt))
      : Promise.resolve([] as Array<{ dropId: string; createdAt: Date }>),
    collectionIds.length
      ? db.select({
          collectionId: drinkCollectionPurchases.collectionId,
          createdAt: drinkCollectionPurchases.createdAt,
          status: drinkCollectionPurchases.status,
        }).from(drinkCollectionPurchases).where(inArray(drinkCollectionPurchases.collectionId, collectionIds)).orderBy(asc(drinkCollectionPurchases.createdAt))
      : Promise.resolve([] as Array<{ collectionId: string; createdAt: Date; status: string }>),
  ]);

  const dropMap = new Map(dropRows.map((row) => [row.id, row]));
  const collectionMap = new Map(collectionRows.map((row) => [row.id, row]));
  const rsvpCountMap = new Map(rsvpCountRows.map((row) => [row.dropId, Number(row.count ?? 0)]));
  const eventCountMap = new Map<string, { views: number; clicks: number }>();
  for (const row of eventRows) {
    const current = eventCountMap.get(row.dropId) ?? { views: 0, clicks: 0 };
    if (row.eventType === "view_drop") current.views = Number(row.count ?? 0);
    if (row.eventType === "click_drop_target") current.clicks = Number(row.count ?? 0);
    eventCountMap.set(row.dropId, current);
  }

  const purchaseRowsByCollectionId = new Map<string, Array<{ createdAt: Date; status: string }>>();
  for (const purchase of purchaseRows) {
    const current = purchaseRowsByCollectionId.get(purchase.collectionId) ?? [];
    current.push({ createdAt: purchase.createdAt, status: purchase.status });
    purchaseRowsByCollectionId.set(purchase.collectionId, current);
  }

  const followRowsByCampaignId = new Map<string, Array<{ createdAt: Date }>>();
  for (const follow of followRows) {
    const current = followRowsByCampaignId.get(follow.campaignId) ?? [];
    current.push({ createdAt: follow.createdAt });
    followRowsByCampaignId.set(follow.campaignId, current);
  }

  const rsvpRowsByDropId = new Map<string, Array<{ createdAt: Date }>>();
  for (const rsvp of rsvpActivityRows) {
    const current = rsvpRowsByDropId.get(rsvp.dropId) ?? [];
    current.push({ createdAt: rsvp.createdAt });
    rsvpRowsByDropId.set(rsvp.dropId, current);
  }

  const items = campaigns.map((campaign) => {
    const links = linkMap.get(campaign.id) ?? [];
    const dropLinkIds = links.filter((link) => link.targetType === "drop").map((link) => link.targetId);
    const collectionLinkIds = links.filter((link) => link.targetType === "collection").map((link) => link.targetId);
    const followerCount = followerCountMap.get(campaign.id) ?? 0;
    const totalDropRsvps = dropLinkIds.reduce((sum, dropId) => sum + (rsvpCountMap.get(dropId) ?? 0), 0);
    const totalDropViews = dropLinkIds.reduce((sum, dropId) => sum + (eventCountMap.get(dropId)?.views ?? 0), 0);
    const totalDropClicks = dropLinkIds.reduce((sum, dropId) => sum + (eventCountMap.get(dropId)?.clicks ?? 0), 0);
    const purchasesFromLinkedCollections = collectionLinkIds.reduce((sum, collectionId) => {
      const count = (purchaseRowsByCollectionId.get(collectionId) ?? []).filter((purchase) => (
        purchase.status === "completed" && isDateWithinCampaignAnalyticsWindow(purchase.createdAt, campaign)
      )).length;
      return sum + count;
    }, 0);
    const isMemberFocusedCampaign = campaign.visibility === "members"
      || dropLinkIds.some((dropId) => (dropMap.get(dropId)?.dropType ?? "") === "member_drop")
      || collectionLinkIds.some((collectionId) => (collectionMap.get(collectionId)?.accessType ?? "") === "membership_only");
    const membershipActivityRows = isMemberFocusedCampaign
      ? membershipRows.filter((membership) => isDateWithinCampaignAnalyticsWindow(membership.createdAt, campaign))
      : [];
    const membershipsFromCampaign = membershipActivityRows.length;
    const campaignEngagementScore = Math.round(
      followerCount
      + totalDropRsvps * 2
      + totalDropClicks * 3
      + purchasesFromLinkedCollections * 5
      + membershipsFromCampaign * 6
      + totalDropViews * 0.25
      + links.filter((link) => link.targetType === "post").length
    );

    const purchaseActivityRows = collectionLinkIds.flatMap((collectionId) => (
      purchaseRowsByCollectionId.get(collectionId) ?? []
    )).filter((purchase) => (
      purchase.status === "completed" && isDateWithinCampaignAnalyticsWindow(purchase.createdAt, campaign)
    )).sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());

    const campaignRsvpRows = dropLinkIds.flatMap((dropId) => rsvpRowsByDropId.get(dropId) ?? [])
      .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());

    const milestones = buildCreatorCampaignMilestones({
      campaign,
      links,
      isMemberFocusedCampaign,
      followerCount,
      followRows: followRowsByCampaignId.get(campaign.id) ?? [],
      dropRows: dropLinkIds.map((dropId) => dropMap.get(dropId)).filter((drop): drop is Pick<CreatorDropRecord, "id" | "dropType" | "isPublished" | "scheduledFor"> => Boolean(drop)),
      totalDropRsvps,
      rsvpRows: campaignRsvpRows,
      totalDropClicks,
      purchasesFromLinkedCollections,
      purchaseRows: purchaseActivityRows,
      membershipsFromCampaign,
      membershipRows: membershipActivityRows,
    });

    return {
      campaignId: campaign.id,
      slug: campaign.slug,
      name: campaign.name,
      visibility: campaign.visibility as CreatorCampaignVisibility,
      isActive: Boolean(campaign.isActive),
      startsAt: campaign.startsAt ? campaign.startsAt.toISOString() : null,
      endsAt: campaign.endsAt ? campaign.endsAt.toISOString() : null,
      followerCount,
      linkedDropsCount: dropLinkIds.length,
      linkedPostsCount: links.filter((link) => link.targetType === "post").length,
      linkedCollectionsCount: collectionLinkIds.length,
      linkedChallengesCount: links.filter((link) => link.targetType === "challenge").length,
      totalDropRsvps,
      totalDropViews,
      totalDropClicks,
      purchasesFromLinkedCollections,
      purchasesFromLinkedCollectionsNote: collectionLinkIds.length
        ? "Approximate: counts completed linked-collection purchases inside the campaign window."
        : null,
      membershipsFromCampaign,
      membershipsFromCampaignNote: isMemberFocusedCampaign
        ? "Approximate: counts memberships that started during this campaign window for member-focused campaign content."
        : null,
      campaignEngagementScore,
      campaignEngagementScoreNote: "Weighted comparison score using followers, RSVP interest, click-throughs, and approximate conversions.",
      milestones,
    } satisfies CreatorCampaignAnalyticsItem;
  });

  return {
    summary: {
      totalCampaigns: items.length,
      activeCampaigns: campaigns.filter((campaign) => getCreatorCampaignState(campaign) === "active").length,
      totalCampaignFollowers: items.reduce((sum, item) => sum + item.followerCount, 0),
      totalCampaignDropRsvps: items.reduce((sum, item) => sum + item.totalDropRsvps, 0),
      totalCampaignClicks: items.reduce((sum, item) => sum + item.totalDropClicks, 0),
      totalCampaignPurchases: items.reduce((sum, item) => sum + item.purchasesFromLinkedCollections, 0),
      totalCampaignMembershipConversions: items.reduce((sum, item) => sum + item.membershipsFromCampaign, 0),
    } satisfies CreatorCampaignAnalyticsSummary,
    items,
    attributionNotes: [
      "Campaign follower counts come from explicit campaign follows.",
      "Drop RSVP, view, and click metrics roll up linked drop analytics that already exist elsewhere in the creator dashboard.",
      "Purchases from linked collections are approximate and count completed purchases made during the campaign window.",
      "Membership conversions are approximate and only shown for member-focused campaigns that have member visibility, member drops, or members-only collections.",
      "Milestones are derived from existing campaign follows, linked drop RSVPs, click activity, and conversion proxies.",
      "Campaign engagement score is a lightweight weighted score for comparison, not a payout or attribution metric.",
    ],
    generatedAt: new Date().toISOString(),
  };
}

function getCreatorCampaignAnalyticsWindow(campaign: Pick<CreatorCampaignRecord, "startsAt" | "endsAt" | "createdAt">) {
  return {
    startsAt: campaign.startsAt ?? campaign.createdAt,
    endsAt: campaign.endsAt ?? new Date(),
  };
}

function isDateWithinCampaignAnalyticsWindow(value: Date, campaign: Pick<CreatorCampaignRecord, "startsAt" | "endsAt" | "createdAt">) {
  const window = getCreatorCampaignAnalyticsWindow(campaign);
  return value >= window.startsAt && value <= window.endsAt;
}

async function loadCreatorCampaignAnalytics(creatorUserId: string) {
  return loadCreatorCampaignPerformanceSnapshots(creatorUserId);
}

async function loadCreatorCampaignDetail(campaign: CreatorCampaignRecord, viewerId?: string | null) {
  if (!db) throw new Error("Database unavailable");

  const links = await db
    .select()
    .from(creatorCampaignLinks)
    .where(eq(creatorCampaignLinks.campaignId, campaign.id))
    .orderBy(asc(creatorCampaignLinks.sortOrder), asc(creatorCampaignLinks.createdAt));

  const collectionIds = [...new Set(links.filter((link) => link.targetType === "collection").map((link) => link.targetId))];
  const dropIds = [...new Set(links.filter((link) => link.targetType === "drop").map((link) => link.targetId))];
  const promoIds = [...new Set(links.filter((link) => link.targetType === "promo").map((link) => link.targetId))];
  const challengeIds = [...new Set(links.filter((link) => link.targetType === "challenge").map((link) => link.targetId))];
  const postIds = [...new Set(links.filter((link) => link.targetType === "post").map((link) => link.targetId))];
  const roadmapIds = [...new Set(links.filter((link) => link.targetType === "roadmap").map((link) => link.targetId))];

  const [
    creatorMap,
    followedCreatorIds,
    memberCreatorIds,
    collectionAccessMap,
    collectionRows,
    dropRows,
    promoRows,
    challengeRows,
    postRows,
    roadmapRows,
  ] = await Promise.all([
    loadCreatorProfilesMap([campaign.creatorUserId]),
    loadFollowedCreatorIdsForUser(viewerId),
    loadActiveMembershipCreatorIdsForUser(viewerId),
    loadCollectionAccessMapForUser(viewerId),
    collectionIds.length ? db.select().from(drinkCollections).where(inArray(drinkCollections.id, collectionIds)) : Promise.resolve([] as Array<typeof drinkCollections.$inferSelect>),
    dropIds.length ? db.select().from(creatorDrops).where(inArray(creatorDrops.id, dropIds)) : Promise.resolve([] as CreatorDropRecord[]),
    promoIds.length ? db.select().from(drinkCollectionPromotions).where(inArray(drinkCollectionPromotions.id, promoIds)) : Promise.resolve([] as Array<typeof drinkCollectionPromotions.$inferSelect>),
    challengeIds.length ? db.select().from(drinkChallenges).where(inArray(drinkChallenges.id, challengeIds)) : Promise.resolve([] as Array<typeof drinkChallenges.$inferSelect>),
    postIds.length ? db.select().from(creatorPosts).where(inArray(creatorPosts.id, postIds)) : Promise.resolve([] as CreatorPostRecord[]),
    roadmapIds.length ? db.select().from(creatorRoadmapItems).where(inArray(creatorRoadmapItems.id, roadmapIds)) : Promise.resolve([] as CreatorRoadmapRecord[]),
  ]);

  const collectionMap = new Map(collectionRows.map((row) => [row.id, row]));
  const dropMap = new Map(dropRows.map((row) => [row.id, row]));
  const promoMap = new Map(promoRows.map((row) => [row.id, row]));
  const challengeMap = new Map(challengeRows.map((row) => [row.id, row]));
  const postMap = new Map(postRows.map((row) => [row.id, row]));
  const roadmapMap = new Map(roadmapRows.map((row) => [row.id, row]));

  const visibleDrops = dropRows.filter((drop) => canViewerSeeCreatorDrop({
    drop,
    viewerId,
    followedCreatorIds,
    memberCreatorIds,
    includeArchived: true,
  }));
  const visiblePosts = postRows.filter((post) => canViewerSeeCreatorPost({ post, viewerId, followedCreatorIds, memberCreatorIds }));
  const visibleRoadmap = sortCreatorRoadmapItems(roadmapRows.filter((item) => canViewerSeeCreatorRoadmapItem({
    item,
    viewerId,
    followedCreatorIds,
    memberCreatorIds,
  })));

  const [dropLinkedMaps, dropRsvpMaps, postLinkedMaps, roadmapLinkedMaps] = await Promise.all([
    loadCreatorDropLinkedMaps(visibleDrops),
    loadCreatorDropRsvpMaps(visibleDrops, viewerId),
    loadCreatorPostLinkedMaps(visiblePosts),
    loadCreatorRoadmapLinkedMaps(visibleRoadmap),
  ]);

  const visibleCollections = links
    .filter((link) => link.targetType === "collection")
    .map((link) => collectionMap.get(link.targetId))
    .filter((collection): collection is typeof drinkCollections.$inferSelect => {
      if (!collection) return false;
      if (viewerId && collection.userId === viewerId) return true;
      const grants = collectionAccessMap.get(collection.id);
      if (collection.accessType === "membership_only" && !grants?.has("membership")) return false;
      if (!collection.isPublic && !grants?.size) return false;
      return true;
    });

  const visiblePromos = links
    .filter((link) => link.targetType === "promo")
    .map((link) => promoMap.get(link.targetId))
    .filter((promotion): promotion is typeof drinkCollectionPromotions.$inferSelect => {
      if (!promotion) return false;
      const linkedCollection = collectionMap.get(promotion.collectionId);
      if (!linkedCollection) return false;
      if (viewerId && linkedCollection.userId === viewerId) return true;
      const grants = collectionAccessMap.get(linkedCollection.id);
      if (linkedCollection.accessType === "membership_only" && !grants?.has("membership")) return false;
      if (!linkedCollection.isPublic && !grants?.size) return false;
      return true;
    })
    .map((promotion) => ({
      id: promotion.id,
      code: promotion.code,
      collectionId: promotion.collectionId,
      collectionName: collectionMap.get(promotion.collectionId)?.name ?? "Collection",
      createdAt: promotion.createdAt ? promotion.createdAt.toISOString() : null,
      startsAt: promotion.startsAt ? promotion.startsAt.toISOString() : null,
      endsAt: promotion.endsAt ? promotion.endsAt.toISOString() : null,
      isActive: Boolean(promotion.isActive),
      route: `/drinks/collections/${encodeURIComponent(promotion.collectionId)}`,
    }));

  const followerCountMap = await loadCampaignFollowerCountMap([campaign.id]);
  const followedCampaignIds = await loadFollowedCampaignIdsForUser(viewerId);

  const detail = {
    campaign: serializeCreatorCampaign(campaign, {
      viewerId,
      creator: creatorMap.get(campaign.creatorUserId) ?? null,
      followerCount: followerCountMap.get(campaign.id) ?? 0,
      isFollowing: followedCampaignIds.has(campaign.id),
      counts: links.reduce((acc, link) => {
        const key = link.targetType as CreatorCampaignTargetType;
        acc[key] = Number(acc[key] ?? 0) + 1;
        return acc;
      }, {} as Partial<Record<CreatorCampaignTargetType, number>>),
    }),
    linkedContent: {
      collections: visibleCollections.map((collection) => ({
        id: collection.id,
        name: collection.name,
        description: collection.description ?? null,
        accessType: collectionAccessTypeForRow(collection),
        isPublic: Boolean(collection.isPublic),
        route: `/drinks/collections/${encodeURIComponent(collection.id)}`,
      })),
      drops: visibleDrops.map((drop) => serializeCreatorDrop(drop, {
        viewerId,
        creator: dropLinkedMaps.creatorMap.get(drop.creatorUserId) ?? null,
        linkedCollection: drop.linkedCollectionId ? dropLinkedMaps.collectionMap.get(drop.linkedCollectionId) ?? null : null,
        linkedChallenge: drop.linkedChallengeId ? dropLinkedMaps.challengeMap.get(drop.linkedChallengeId) ?? null : null,
        linkedPromotion: drop.linkedPromotionId ? dropLinkedMaps.promotionMap.get(drop.linkedPromotionId) ?? null : null,
        acceptedCollaboration: serializeAcceptedCollaboration(dropLinkedMaps.collaborationMap.get(`drop:${drop.id}`) ?? null, dropLinkedMaps.collaborationProfileMap),
        rsvpCount: dropRsvpMaps.rsvpCountMap.get(drop.id) ?? 0,
        isRsvped: dropRsvpMaps.viewerRsvpSet.has(drop.id),
      })),
      promos: visiblePromos,
      challenges: links
        .filter((link) => link.targetType === "challenge")
        .map((link) => challengeMap.get(link.targetId))
        .filter((challenge): challenge is typeof drinkChallenges.$inferSelect => Boolean(challenge))
        .map((challenge) => ({
          id: challenge.id,
          slug: challenge.slug,
          title: challenge.title,
          route: `/drinks/challenges/${encodeURIComponent(challenge.slug)}`,
        })),
      posts: visiblePosts.map((post) => serializeCreatorPost(post, {
        viewerId,
        creator: postLinkedMaps.creatorMap.get(post.creatorUserId) ?? null,
        linkedCollection: post.linkedCollectionId ? postLinkedMaps.collectionMap.get(post.linkedCollectionId) ?? null : null,
        linkedChallenge: post.linkedChallengeId ? postLinkedMaps.challengeMap.get(post.linkedChallengeId) ?? null : null,
        acceptedCollaboration: serializeAcceptedCollaboration(postLinkedMaps.collaborationMap.get(`post:${post.id}`) ?? null, postLinkedMaps.collaborationProfileMap),
      })),
      roadmap: visibleRoadmap.map((item) => serializeCreatorRoadmapItem(item, {
        viewerId,
        creator: roadmapLinkedMaps.creatorMap.get(item.creatorUserId) ?? null,
        linkedCollection: item.linkedCollectionId ? roadmapLinkedMaps.collectionMap.get(item.linkedCollectionId) ?? null : null,
        linkedChallenge: item.linkedChallengeId ? roadmapLinkedMaps.challengeMap.get(item.linkedChallengeId) ?? null : null,
        acceptedCollaboration: serializeAcceptedCollaboration(roadmapLinkedMaps.collaborationMap.get(`roadmap:${item.id}`) ?? null, roadmapLinkedMaps.collaborationProfileMap),
      })),
    },
  };

  return detail;
}

type CreatorCampaignUpdateItem = {
  id: string;
  targetType: "drop" | "post" | "roadmap" | "promo";
  label: string;
  title: string;
  description: string | null;
  timestamp: string | null;
  route: string;
};

function buildCreatorCampaignUpdateItems(detail: Awaited<ReturnType<typeof loadCreatorCampaignDetail>>) {
  const updates: CreatorCampaignUpdateItem[] = [
    ...detail.linkedContent.drops.map((drop) => ({
      id: `drop:${drop.id}`,
      targetType: "drop" as const,
      label: drop.status === "live" ? "Drop live" : drop.status === "upcoming" ? "Drop scheduled" : "Drop replay",
      title: drop.title,
      description: drop.description ?? drop.recapNotes ?? null,
      timestamp: drop.scheduledFor ?? drop.updatedAt ?? drop.createdAt,
      route: drop.detailRoute,
    })),
    ...detail.linkedContent.posts.map((post) => ({
      id: `post:${post.id}`,
      targetType: "post" as const,
      label: post.postType === "member_only" ? "Member post" : "Campaign post",
      title: post.title,
      description: post.body ?? null,
      timestamp: post.updatedAt ?? post.createdAt,
      route: post.linkedCollection?.route ?? post.linkedChallenge?.route ?? detail.campaign.route,
    })),
    ...detail.linkedContent.roadmap.map((item) => ({
      id: `roadmap:${item.id}`,
      targetType: "roadmap" as const,
      label: item.status === "upcoming" ? "Roadmap note" : item.status === "live" ? "Roadmap live" : "Roadmap archive",
      title: item.title,
      description: item.description ?? null,
      timestamp: item.releasedAt ?? item.scheduledFor ?? item.updatedAt ?? item.createdAt,
      route: item.linkedCollection?.route ?? item.linkedChallenge?.route ?? "/drinks/roadmap",
    })),
    ...detail.linkedContent.promos.map((promo) => ({
      id: `promo:${promo.id}`,
      targetType: "promo" as const,
      label: promo.isActive ? "Promo active" : "Promo linked",
      title: `Promo code ${promo.code}`,
      description: `Applies to ${promo.collectionName}.`,
      timestamp: promo.startsAt ?? promo.createdAt ?? null,
      route: promo.route,
    })),
  ];

  return updates
    .sort((a, b) => new Date(b.timestamp ?? 0).getTime() - new Date(a.timestamp ?? 0).getTime())
    .slice(0, 8);
}

async function loadCampaignAlertRecipientIds(
  campaign: Pick<CreatorCampaignRecord, "id" | "creatorUserId" | "visibility">,
  contentVisibility: "public" | "followers" | "members",
) {
  if (!db) return [];

  const followRows = await db
    .select({ userId: creatorCampaignFollows.userId })
    .from(creatorCampaignFollows)
    .where(eq(creatorCampaignFollows.campaignId, campaign.id));

  let recipientIds = [...new Set(
    followRows
      .map((row) => row.userId)
      .filter((userId): userId is string => Boolean(userId) && userId !== campaign.creatorUserId),
  )];

  if (!recipientIds.length) return [];

  const requiredAudience = campaign.visibility === "members" || contentVisibility === "members"
    ? "members"
    : campaign.visibility === "followers" || contentVisibility === "followers"
      ? "followers"
      : "public";

  if (requiredAudience === "followers") {
    const followerRows = await db
      .select({ userId: follows.followerId })
      .from(follows)
      .where(and(eq(follows.followingId, campaign.creatorUserId), inArray(follows.followerId, recipientIds)));
    recipientIds = followerRows.map((row) => row.userId).filter(Boolean);
  } else if (requiredAudience === "members") {
    const membershipRows = await db
      .select()
      .from(creatorMemberships)
      .where(and(eq(creatorMemberships.creatorUserId, campaign.creatorUserId), inArray(creatorMemberships.userId, recipientIds)));
    const activeMemberSet = new Set(
      membershipRows
        .filter((membership) => isCreatorMembershipActiveRecord(membership))
        .map((membership) => membership.userId)
        .filter(Boolean),
    );
    recipientIds = recipientIds.filter((userId) => activeMemberSet.has(userId));
  }

  return recipientIds;
}

async function maybeSendCampaignLinkedContentAlerts(input: {
  targetType: "drop" | "post" | "promo";
  targetId: string;
  contentVisibility: "public" | "followers" | "members";
  title: string;
  message: string;
  creatorUserId: string;
  creatorUsername?: string | null;
  creatorAvatar?: string | null;
  metadata?: Record<string, any>;
}) {
  if (!db) return;

  const linkRows = await db
    .select({ campaignId: creatorCampaignLinks.campaignId })
    .from(creatorCampaignLinks)
    .where(and(eq(creatorCampaignLinks.targetType, input.targetType), eq(creatorCampaignLinks.targetId, input.targetId)));

  const campaignIds = [...new Set(linkRows.map((row) => row.campaignId).filter(Boolean))];
  if (!campaignIds.length) return;

  const campaigns = await db
    .select()
    .from(creatorCampaigns)
    .where(inArray(creatorCampaigns.id, campaignIds));

  for (const campaign of campaigns) {
    let recipientIds = await loadCampaignAlertRecipientIds(campaign, input.contentVisibility);
    if (!recipientIds.length) continue;

    const eventKey = typeof input.metadata?.event === "string" ? input.metadata.event : null;
    if (eventKey) {
      const existingRows = await db
        .select({ userId: notifications.userId })
        .from(notifications)
        .where(and(
          eq(notifications.type, DRINK_ALERT_TYPES.followedCampaignUpdate),
          inArray(notifications.userId, recipientIds),
          sql`${notifications.metadata}->>'campaignId' = ${campaign.id}`,
          sql`${notifications.metadata}->>'targetType' = ${input.targetType}`,
          sql`${notifications.metadata}->>'targetId' = ${input.targetId}`,
          sql`${notifications.metadata}->>'event' = ${eventKey}`,
        ));

      const existingUserIds = new Set(existingRows.map((row) => row.userId).filter(Boolean));
      recipientIds = recipientIds.filter((userId) => !existingUserIds.has(userId));
      if (!recipientIds.length) continue;
    }

    await sendFollowedCampaignUpdateAlerts({
      campaignId: campaign.id,
      campaignName: campaign.name,
      creatorUserId: input.creatorUserId,
      creatorUsername: input.creatorUsername ?? null,
      creatorAvatar: input.creatorAvatar ?? null,
      title: input.title,
      message: input.message,
      linkUrl: `/drinks/campaigns/${encodeURIComponent(campaign.slug)}`,
      recipientIds,
      metadata: {
        targetType: input.targetType,
        targetId: input.targetId,
        contentVisibility: input.contentVisibility,
        ...input.metadata,
      },
    });
  }
}

function serializeCreatorPost(
  post: CreatorPostRecord,
  options: {
    viewerId?: string | null;
    creator?: { id: string; username: string | null; avatar: string | null } | null;
    linkedCollection?: typeof drinkCollections.$inferSelect | null;
    linkedChallenge?: typeof drinkChallenges.$inferSelect | null;
    acceptedCollaboration?: ReturnType<typeof serializeAcceptedCollaboration> | null;
  } = {},
) {
  const creator = options.creator ?? null;
  const linkedCollection = options.linkedCollection ?? null;
  const linkedChallenge = options.linkedChallenge ?? null;

  return {
    id: post.id,
    creatorUserId: post.creatorUserId,
    title: post.title,
    body: post.body,
    postType: post.postType as CreatorPostType,
    visibility: post.visibility as CreatorPostVisibility,
    audienceLabel: creatorPostAudienceLabel(post, options.viewerId),
    createdAt: post.createdAt.toISOString(),
    updatedAt: post.updatedAt.toISOString(),
    creator: creator
      ? {
        userId: creator.id,
        username: creator.username ?? null,
        avatar: creator.avatar ?? null,
        route: `/drinks/creator/${encodeURIComponent(creator.id)}`,
      }
      : null,
    linkedCollection: linkedCollection
      ? {
        id: linkedCollection.id,
        name: linkedCollection.name,
        accessType: collectionAccessTypeForRow(linkedCollection),
        isPublic: Boolean(linkedCollection.isPublic),
        route: `/drinks/collections/${encodeURIComponent(linkedCollection.id)}`,
      }
      : null,
    linkedChallenge: linkedChallenge
      ? {
        id: linkedChallenge.id,
        slug: linkedChallenge.slug,
        title: linkedChallenge.title,
        route: `/drinks/challenges/${encodeURIComponent(linkedChallenge.slug)}`,
      }
      : null,
    acceptedCollaboration: options.acceptedCollaboration ?? null,
  };
}

function serializeCreatorDrop(
  drop: CreatorDropRecord,
  options: {
    viewerId?: string | null;
    creator?: { id: string; username: string | null; avatar: string | null } | null;
    linkedCollection?: typeof drinkCollections.$inferSelect | null;
    linkedChallenge?: typeof drinkChallenges.$inferSelect | null;
    linkedPromotion?: typeof drinkCollectionPromotions.$inferSelect | null;
    acceptedCollaboration?: ReturnType<typeof serializeAcceptedCollaboration> | null;
    rsvpCount?: number;
    isRsvped?: boolean;
  } = {},
) {
  const creator = options.creator ?? null;
  const linkedCollection = options.linkedCollection ?? null;
  const linkedChallenge = options.linkedChallenge ?? null;
  const linkedPromotion = options.linkedPromotion ?? null;

  const status = getCreatorDropStatus(drop);

  return {
    id: drop.id,
    creatorUserId: drop.creatorUserId,
    title: drop.title,
    description: drop.description ?? null,
    recapNotes: drop.recapNotes ?? null,
    dropType: drop.dropType as CreatorDropType,
    visibility: drop.visibility as CreatorDropVisibility,
    status,
    audienceLabel: creatorDropAudienceLabel(drop, options.viewerId),
    scheduledFor: drop.scheduledFor.toISOString(),
    detailRoute: `/drinks/drops/${encodeURIComponent(drop.id)}`,
    isPublished: Boolean(drop.isPublished),
    rsvpCount: Math.max(0, Number(options.rsvpCount ?? 0)),
    isRsvped: Boolean(options.isRsvped),
    createdAt: drop.createdAt.toISOString(),
    updatedAt: drop.updatedAt.toISOString(),
    creator: creator
      ? {
        userId: creator.id,
        username: creator.username ?? null,
        avatar: creator.avatar ?? null,
        route: `/drinks/creator/${encodeURIComponent(creator.id)}`,
      }
      : null,
    linkedCollection: linkedCollection
      ? {
        id: linkedCollection.id,
        name: linkedCollection.name,
        accessType: collectionAccessTypeForRow(linkedCollection),
        isPublic: Boolean(linkedCollection.isPublic),
        route: `/drinks/collections/${encodeURIComponent(linkedCollection.id)}`,
      }
      : null,
    linkedChallenge: linkedChallenge
      ? {
        id: linkedChallenge.id,
        slug: linkedChallenge.slug,
        title: linkedChallenge.title,
        route: `/drinks/challenges/${encodeURIComponent(linkedChallenge.slug)}`,
      }
      : null,
    linkedPromotion: linkedPromotion
      ? {
        id: linkedPromotion.id,
        code: linkedPromotion.code,
        startsAt: linkedPromotion.startsAt ? linkedPromotion.startsAt.toISOString() : null,
        endsAt: linkedPromotion.endsAt ? linkedPromotion.endsAt.toISOString() : null,
      }
      : null,
    acceptedCollaboration: options.acceptedCollaboration ?? null,
  };
}

function serializeCreatorRoadmapItem(
  item: CreatorRoadmapRecord,
  options: {
    viewerId?: string | null;
    creator?: { id: string; username: string | null; avatar: string | null } | null;
    linkedCollection?: typeof drinkCollections.$inferSelect | null;
    linkedChallenge?: typeof drinkChallenges.$inferSelect | null;
    acceptedCollaboration?: ReturnType<typeof serializeAcceptedCollaboration> | null;
  } = {},
) {
  const creator = options.creator ?? null;
  const linkedCollection = options.linkedCollection ?? null;
  const linkedChallenge = options.linkedChallenge ?? null;

  return {
    id: item.id,
    creatorUserId: item.creatorUserId,
    title: item.title,
    description: item.description ?? null,
    itemType: item.itemType as CreatorRoadmapItemType,
    visibility: item.visibility as CreatorRoadmapVisibility,
    audienceLabel: creatorRoadmapAudienceLabel(item, options.viewerId),
    scheduledFor: item.scheduledFor ? item.scheduledFor.toISOString() : null,
    releasedAt: item.releasedAt ? item.releasedAt.toISOString() : null,
    status: item.status as CreatorRoadmapStatus,
    createdAt: item.createdAt.toISOString(),
    updatedAt: item.updatedAt.toISOString(),
    creator: creator
      ? {
        userId: creator.id,
        username: creator.username ?? null,
        avatar: creator.avatar ?? null,
        route: `/drinks/creator/${encodeURIComponent(creator.id)}`,
      }
      : null,
    linkedCollection: linkedCollection
      ? {
        id: linkedCollection.id,
        name: linkedCollection.name,
        accessType: collectionAccessTypeForRow(linkedCollection),
        isPublic: Boolean(linkedCollection.isPublic),
        route: `/drinks/collections/${encodeURIComponent(linkedCollection.id)}`,
      }
      : null,
    linkedChallenge: linkedChallenge
      ? {
        id: linkedChallenge.id,
        slug: linkedChallenge.slug,
        title: linkedChallenge.title,
        route: `/drinks/challenges/${encodeURIComponent(linkedChallenge.slug)}`,
      }
      : null,
    acceptedCollaboration: options.acceptedCollaboration ?? null,
  };
}

async function maybeSendCreatorDropAlerts(drop: CreatorDropRecord) {
  if (!db || !drop.isPublished) return;

  const now = Date.now();
  const scheduledTime = drop.scheduledFor.getTime();
  const diff = scheduledTime - now;
  const maxLeadWindowMs = 1000 * 60 * 60 * 48;
  if (diff < 0 || diff > maxLeadWindowMs) return;

  const creator = await loadUserBasicProfile(drop.creatorUserId);
  await sendCreatorDropAlerts({
    creatorUserId: drop.creatorUserId,
    creatorUsername: creator?.username ?? null,
    creatorAvatar: creator?.avatar ?? null,
    dropId: drop.id,
    title: drop.title,
    visibility: drop.visibility as CreatorDropVisibility,
    scheduledFor: drop.scheduledFor.toISOString(),
  });

  await maybeSendCampaignLinkedContentAlerts({
    targetType: "drop",
    targetId: drop.id,
    contentVisibility: drop.visibility as "public" | "followers" | "members",
    title: "A campaign you follow has a drop update",
    message: `${creator?.username ? `@${creator.username}` : "A creator"} scheduled "${drop.title}" inside a campaign you follow.`,
    creatorUserId: drop.creatorUserId,
    creatorUsername: creator?.username ?? null,
    creatorAvatar: creator?.avatar ?? null,
    metadata: {
      dropId: drop.id,
      event: getCreatorDropStatus(drop) === "live" ? "drop_live" : "drop_scheduled",
      scheduledFor: drop.scheduledFor.toISOString(),
    },
  });
}

async function maybeSendCreatorDropRsvpLiveAlerts() {
  if (!db) return;

  const now = new Date();
  const liveWindowStart = new Date(now.getTime() - CREATOR_DROP_ARCHIVE_WINDOW_MS);
  const dueDrops = await db
    .select()
    .from(creatorDrops)
    .where(
      and(
        eq(creatorDrops.isPublished, true),
        lte(creatorDrops.scheduledFor, now),
        gt(creatorDrops.scheduledFor, liveWindowStart),
      ),
    )
    .orderBy(desc(creatorDrops.scheduledFor))
    .limit(80);

  for (const drop of dueDrops) {
    const rsvpRows = await db
      .select({ userId: creatorDropRsvps.userId })
      .from(creatorDropRsvps)
      .where(eq(creatorDropRsvps.dropId, drop.id));

    let recipientIds = [...new Set(
      rsvpRows
        .map((row) => row.userId)
        .filter((userId): userId is string => Boolean(userId) && userId !== drop.creatorUserId),
    )];

    if (!recipientIds.length) continue;

    if (drop.visibility === "followers") {
      const followerRows = await db
        .select({ userId: follows.followerId })
        .from(follows)
        .where(and(eq(follows.followingId, drop.creatorUserId), inArray(follows.followerId, recipientIds)));
      recipientIds = followerRows.map((row) => row.userId).filter(Boolean);
    } else if (drop.visibility === "members") {
      const membershipRows = await db
        .select()
        .from(creatorMemberships)
        .where(eq(creatorMemberships.creatorUserId, drop.creatorUserId));
      const activeMemberSet = new Set(
        membershipRows
          .filter((membership) => isCreatorMembershipActiveRecord(membership))
          .map((membership) => membership.userId)
          .filter(Boolean),
      );
      recipientIds = recipientIds.filter((userId) => activeMemberSet.has(userId));
    }

    if (!recipientIds.length) continue;

    const existingRows = await db
      .select({ userId: notifications.userId })
      .from(notifications)
      .where(and(
        eq(notifications.type, DRINK_ALERT_TYPES.rsvpedDropLive),
        inArray(notifications.userId, recipientIds),
        sql`${notifications.metadata}->>'dropId' = ${drop.id}`,
        sql`${notifications.metadata}->>'event' = 'live'`,
      ));

    const existingUserIds = new Set(existingRows.map((row) => row.userId).filter(Boolean));
    const pendingRecipientIds = recipientIds.filter((userId) => !existingUserIds.has(userId));
    if (!pendingRecipientIds.length) continue;

    const creator = await loadUserBasicProfile(drop.creatorUserId);
    await sendRsvpedDropLiveAlerts({
      dropId: drop.id,
      title: drop.title,
      creatorUserId: drop.creatorUserId,
      creatorUsername: creator?.username ?? null,
      creatorAvatar: creator?.avatar ?? null,
      recipientIds: pendingRecipientIds,
    });

    await maybeSendCampaignLinkedContentAlerts({
      targetType: "drop",
      targetId: drop.id,
      contentVisibility: drop.visibility as "public" | "followers" | "members",
      title: "A campaign you follow has gone live",
      message: `${creator?.username ? `@${creator.username}` : "A creator"} just took "${drop.title}" live inside a campaign you follow.`,
      creatorUserId: drop.creatorUserId,
      creatorUsername: creator?.username ?? null,
      creatorAvatar: creator?.avatar ?? null,
      metadata: {
        dropId: drop.id,
        event: "drop_live",
        scheduledFor: drop.scheduledFor.toISOString(),
      },
    });
  }
}

async function maybeSendCreatorPostAlerts(post: CreatorPostRecord) {
  if (!db) return;

  const creator = await loadUserBasicProfile(post.creatorUserId);
  const creatorHandle = creator?.username ? `@${creator.username}` : "A creator";
  const shouldSendCreatorAudienceAlert = post.postType === "promo" || post.postType === "collection_launch" || post.visibility === "members";

  if (!shouldSendCreatorAudienceAlert) {
    await maybeSendCampaignLinkedContentAlerts({
      targetType: "post",
      targetId: post.id,
      contentVisibility: post.visibility as "public" | "followers" | "members",
      title: "A campaign you follow has a new update",
      message: `${creatorHandle} published "${post.title}" inside a campaign you follow.`,
      creatorUserId: post.creatorUserId,
      creatorUsername: creator?.username ?? null,
      creatorAvatar: creator?.avatar ?? null,
      metadata: {
        creatorPostId: post.id,
        event: "post_published",
        postType: post.postType,
      },
    });
    return;
  }

  const linkUrl = post.linkedCollectionId
    ? `/drinks/collections/${encodeURIComponent(post.linkedCollectionId)}`
    : `/drinks/creator/${encodeURIComponent(post.creatorUserId)}`;

  let recipientIds: string[] = [];
  let type: DrinkAlertType = DRINK_ALERT_TYPES.followedCreatorPost;
  let title = "A creator you follow published an update";
  let message = `${creatorHandle} posted "${post.title}".`;

  if (post.visibility === "members") {
    const memberRows = await db
      .select()
      .from(creatorMemberships)
      .where(and(eq(creatorMemberships.creatorUserId, post.creatorUserId), inArray(creatorMemberships.status, ["active", "canceled"])));

    recipientIds = [...new Set(
      memberRows
        .filter((row) => isCreatorMembershipActiveRecord(row))
        .map((row) => row.userId)
        .filter((userId): userId is string => Boolean(userId) && userId !== post.creatorUserId),
    )];
    type = DRINK_ALERT_TYPES.creatorMemberPost;
    title = "New member update from a creator you support";
    message = `${creatorHandle} shared a members update: "${post.title}".`;
  } else {
    const followerRows = await db
      .select({ userId: follows.followerId })
      .from(follows)
      .where(eq(follows.followingId, post.creatorUserId));

    recipientIds = [...new Set(
      followerRows
        .map((row) => row.userId)
        .filter((userId): userId is string => Boolean(userId) && userId !== post.creatorUserId),
    )];

    if (post.postType === "promo") {
      title = "A creator you follow posted a promo";
      message = `${creatorHandle} posted a promo update: "${post.title}".`;
    } else if (post.postType === "collection_launch") {
      title = "A creator you follow launched something new";
      message = `${creatorHandle} announced a collection launch: "${post.title}".`;
    }
  }

  if (!recipientIds.length) return;

  await db.insert(notifications).values(
    recipientIds.map((userId) => ({
      userId,
      type,
      title,
      message,
      linkUrl,
      imageUrl: creator?.avatar ?? null,
      priority: post.visibility === "members" ? "high" : "normal",
      metadata: {
        creatorPostId: post.id,
        creatorUserId: post.creatorUserId,
        linkedCollectionId: post.linkedCollectionId ?? null,
        linkedChallengeId: post.linkedChallengeId ?? null,
        visibility: post.visibility,
        postType: post.postType,
      },
    })),
  ).catch((error) => {
    console.error("Failed to send creator post alerts:", error);
  });

  await maybeSendCampaignLinkedContentAlerts({
    targetType: "post",
    targetId: post.id,
    contentVisibility: post.visibility as "public" | "followers" | "members",
    title: "A campaign you follow has a new update",
    message: `${creatorHandle} published "${post.title}" inside a campaign you follow.`,
    creatorUserId: post.creatorUserId,
    creatorUsername: creator?.username ?? null,
    creatorAvatar: creator?.avatar ?? null,
    metadata: {
      creatorPostId: post.id,
      event: "post_published",
      postType: post.postType,
    },
  });
}

async function upsertDrinkCollectionSalesLedgerEntry(
  tx: typeof db,
  input: {
    creatorUserId: string;
    collectionId: string;
    purchaseId: string | null;
    checkoutSessionId: string | null;
    promotionId?: string | null;
    promotionCode?: string | null;
    originalAmountCents?: number | null;
    discountAmountCents?: number | null;
    grossAmountCents: number;
    currencyCode: string | null | undefined;
    createdAt: Date;
    status?: DrinkCollectionSalesLedgerStatus;
    statusReason?: string | null;
    refundedAt?: Date | null;
  },
) {
  if (!tx) {
    throw new Error("Database unavailable");
  }

  const finance = estimateCollectionFinanceBreakdown(input.grossAmountCents);
  const values = {
    userId: input.creatorUserId,
    collectionId: input.collectionId,
    purchaseId: input.purchaseId,
    checkoutSessionId: input.checkoutSessionId,
    promotionId: input.promotionId ?? null,
    promotionCode: input.promotionCode ?? null,
    originalAmountCents: input.originalAmountCents ?? null,
    discountAmountCents: input.discountAmountCents ?? null,
    grossAmountCents: finance.grossAmountCents,
    platformFeeCents: finance.platformFeeCents,
    creatorShareCents: finance.creatorShareCents,
    currencyCode: normalizeSquareCurrencyCode(input.currencyCode),
    status: input.status ?? "completed",
    statusReason: input.statusReason ?? null,
    refundedAt: input.refundedAt ?? null,
    createdAt: input.createdAt,
    updatedAt: new Date(),
  } as const;

  if (input.checkoutSessionId) {
    await tx
      .insert(drinkCollectionSalesLedger)
      .values(values)
      .onConflictDoUpdate({
        target: drinkCollectionSalesLedger.checkoutSessionId,
        set: {
          userId: values.userId,
          collectionId: values.collectionId,
          purchaseId: values.purchaseId,
          promotionId: values.promotionId,
          promotionCode: values.promotionCode,
          originalAmountCents: values.originalAmountCents,
          discountAmountCents: values.discountAmountCents,
          grossAmountCents: values.grossAmountCents,
          platformFeeCents: values.platformFeeCents,
          creatorShareCents: values.creatorShareCents,
          currencyCode: values.currencyCode,
          status: values.status,
          statusReason: values.statusReason,
          refundedAt: values.refundedAt,
          createdAt: values.createdAt,
          updatedAt: values.updatedAt,
        },
      });
    return;
  }

  if (input.purchaseId) {
    await tx
      .insert(drinkCollectionSalesLedger)
      .values(values)
      .onConflictDoUpdate({
        target: drinkCollectionSalesLedger.purchaseId,
        set: {
          userId: values.userId,
          collectionId: values.collectionId,
          checkoutSessionId: values.checkoutSessionId,
          promotionId: values.promotionId,
          promotionCode: values.promotionCode,
          originalAmountCents: values.originalAmountCents,
          discountAmountCents: values.discountAmountCents,
          grossAmountCents: values.grossAmountCents,
          platformFeeCents: values.platformFeeCents,
          creatorShareCents: values.creatorShareCents,
          currencyCode: values.currencyCode,
          status: values.status,
          statusReason: values.statusReason,
          refundedAt: values.refundedAt,
          createdAt: values.createdAt,
          updatedAt: values.updatedAt,
        },
      });
  }
}

async function backfillDrinkCollectionSalesLedger() {
  if (!db) return;

  const completedSessions = await db
    .select({
      sessionId: drinkCollectionCheckoutSessions.id,
      purchaserUserId: drinkCollectionCheckoutSessions.userId,
      collectionId: drinkCollectionCheckoutSessions.collectionId,
      promotionId: drinkCollectionCheckoutSessions.promotionId,
      promotionCode: drinkCollectionCheckoutSessions.promotionCode,
      originalAmountCents: drinkCollectionCheckoutSessions.originalAmountCents,
      discountAmountCents: drinkCollectionCheckoutSessions.discountAmountCents,
      amountCents: drinkCollectionCheckoutSessions.amountCents,
      currencyCode: drinkCollectionCheckoutSessions.currencyCode,
      verifiedAt: drinkCollectionCheckoutSessions.verifiedAt,
      updatedAt: drinkCollectionCheckoutSessions.updatedAt,
      creatorUserId: drinkCollections.userId,
    })
    .from(drinkCollectionCheckoutSessions)
    .innerJoin(drinkCollections, eq(drinkCollectionCheckoutSessions.collectionId, drinkCollections.id))
    .where(eq(drinkCollectionCheckoutSessions.status, "completed"))
    .orderBy(desc(drinkCollectionCheckoutSessions.verifiedAt), desc(drinkCollectionCheckoutSessions.updatedAt));

  for (const session of completedSessions) {
    const purchaseRows = await db
      .select({
        id: drinkCollectionPurchases.id,
        createdAt: drinkCollectionPurchases.createdAt,
        status: drinkCollectionPurchases.status,
        statusReason: drinkCollectionPurchases.statusReason,
        accessRevokedAt: drinkCollectionPurchases.accessRevokedAt,
      })
      .from(drinkCollectionPurchases)
      .where(
        and(
          eq(drinkCollectionPurchases.userId, session.purchaserUserId),
          eq(drinkCollectionPurchases.collectionId, session.collectionId),
        ),
      )
      .limit(1);

    const purchase = purchaseRows[0];
    if (!purchase) continue;

    await upsertDrinkCollectionSalesLedgerEntry(db, {
      creatorUserId: session.creatorUserId,
      collectionId: session.collectionId,
      purchaseId: purchase.id,
      checkoutSessionId: session.sessionId,
      promotionId: session.promotionId,
      promotionCode: session.promotionCode,
      originalAmountCents: session.originalAmountCents,
      discountAmountCents: session.discountAmountCents,
      grossAmountCents: Number(session.amountCents ?? 0),
      currencyCode: session.currencyCode,
      createdAt: purchase.createdAt ?? session.verifiedAt ?? session.updatedAt ?? new Date(),
      status: purchase.status === "completed" ? "completed" : purchase.status,
      statusReason: purchase.statusReason,
      refundedAt: purchase.accessRevokedAt,
    });
  }
}

function getCollectionCheckoutBaseUrl(req: Request) {
  const configuredBaseUrl = process.env.APP_BASE_URL?.trim() || process.env.CLIENT_URL?.trim();
  if (configuredBaseUrl) return configuredBaseUrl.replace(/\/$/, "");
  const host = req.get("host");
  if (!host) throw new Error("Unable to determine checkout redirect host");
  return `${req.protocol}://${host}`;
}

function buildCollectionCheckoutRedirectUrl(req: Request, collectionId: string, checkoutSessionId: string) {
  const baseUrl = getCollectionCheckoutBaseUrl(req);
  return `${baseUrl}/drinks/collections/${encodeURIComponent(collectionId)}?checkoutSessionId=${encodeURIComponent(checkoutSessionId)}&squareCheckout=return`;
}

function formatCollectionCheckoutReferenceId(checkoutSessionId: string) {
  return `drink_collection_checkout:${checkoutSessionId}`;
}

function buildBundleCheckoutRedirectUrl(req: Request, bundleId: string, checkoutSessionId: string) {
  const baseUrl = getCollectionCheckoutBaseUrl(req);
  return `${baseUrl}/drinks/bundles/${encodeURIComponent(bundleId)}?checkoutSessionId=${encodeURIComponent(checkoutSessionId)}&squareCheckout=return`;
}

function buildGiftClaimUrl(req: Request, giftCode: string) {
  const baseUrl = getCollectionCheckoutBaseUrl(req);
  return `${baseUrl}/drinks/gifts/${encodeURIComponent(giftCode)}`;
}

function formatBundleCheckoutReferenceId(checkoutSessionId: string) {
  return `drink_bundle_checkout:${checkoutSessionId}`;
}

function normalizePurchaseType(value?: string | null): DrinkPurchaseType {
  return value === "gift" ? "gift" : "self";
}

function normalizeSquareCurrencyCode(value?: string | null) {
  const normalized = String(value || "USD").trim().toUpperCase();
  return normalized || "USD";
}

function bigintAmountToNumber(value: unknown) {
  if (typeof value === "bigint") return Number(value);
  if (typeof value === "number") return value;
  if (typeof value === "string" && value.length > 0) return Number(value);
  return 0;
}

function sumTenderAmounts(tenders: any[] | null | undefined) {
  return (tenders ?? []).reduce((sum, tender) => sum + bigintAmountToNumber(tender?.amountMoney?.amount), 0);
}

async function resolveCollectionPurchaseContext(collectionId: string, viewerUserId: string): Promise<ResolvedCollectionPurchaseContext> {
  return resolveCollectionPurchaseContextWithPromo(collectionId, viewerUserId, null);
}

async function loadCollectionPromotionForCode(collectionId: string, code: string) {
  if (!db) {
    throw new Error("Database unavailable");
  }

  const normalizedCode = normalizePromotionCode(code);
  if (!normalizedCode) return null;

  const rows = await db
    .select()
    .from(drinkCollectionPromotions)
    .where(
      and(
        eq(drinkCollectionPromotions.collectionId, collectionId),
        eq(drinkCollectionPromotions.code, normalizedCode),
      ),
    )
    .limit(1);

  return rows[0] ?? null;
}

async function resolveValidPromotionPricing(collection: typeof drinkCollections.$inferSelect, code: string) {
  const promotion = await loadCollectionPromotionForCode(collection.id, code);
  if (!promotion) {
    const error = new Error("Promotion code not found for this collection.");
    (error as any).status = 404;
    throw error;
  }

  if (promotion.creatorUserId !== collection.userId) {
    const error = new Error("Promotion is not valid for this collection.");
    (error as any).status = 403;
    throw error;
  }

  if (!isPromotionCurrentlyValid(promotion)) {
    const error = new Error("Promotion code is inactive, expired, or fully redeemed.");
    (error as any).status = 400;
    throw error;
  }

  const pricing = serializePromotionPricing(promotion, Number(collection.priceCents ?? 0), squareConfig.currency ?? "USD");
  if (pricing.finalAmountCents <= 0 || pricing.discountAmountCents <= 0) {
    const error = new Error("Promotion does not produce a valid discounted checkout amount.");
    (error as any).status = 400;
    throw error;
  }

  return {
    promotion,
    pricing,
  };
}

async function resolveCollectionPurchaseContextWithPromo(
  collectionId: string,
  viewerUserId: string,
  promoCode: string | null,
): Promise<ResolvedCollectionPurchaseContext> {
  if (!db) {
    throw new Error("Database unavailable");
  }

  const rows = await db.select().from(drinkCollections).where(eq(drinkCollections.id, collectionId)).limit(1);
  const collection = rows[0] ? normalizeCollectionRowForResponse(rows[0]) : null;
  if (!collection) {
    const error = new Error("Collection not found");
    (error as any).status = 404;
    throw error;
  }

  const isOwner = viewerUserId === collection.userId;
  if (!collection.isPublic && !isOwner) {
    const error = new Error("Collection is private");
    (error as any).status = 403;
    throw error;
  }

  if (collection.accessType === "public") {
    const error = new Error("Collection is already free");
    (error as any).status = 400;
    throw error;
  }

  if (collection.accessType !== "premium_purchase") {
    const error = new Error("This collection is available through membership access, not direct checkout.");
    (error as any).status = 400;
    throw error;
  }

  const ownedCollectionIds = await loadOwnedCollectionIdsForUser(viewerUserId);
  const promoPricing = promoCode ? (await resolveValidPromotionPricing(collection, promoCode)).pricing : null;

  return {
    collection,
    isOwner,
    alreadyOwned: isOwner || ownedCollectionIds.has(collection.id),
    promoPricing,
  };
}

async function resolveBundlePurchaseContext(bundleId: string, viewerUserId: string) {
  if (!db) {
    throw new Error("Database unavailable");
  }

  const rows = await db.select().from(drinkBundles).where(eq(drinkBundles.id, bundleId)).limit(1);
  const bundle = rows[0];
  if (!bundle) {
    const error = new Error("Bundle not found");
    (error as any).status = 404;
    throw error;
  }

  const isOwner = viewerUserId === bundle.userId;
  if (!bundle.isPublic && !isOwner) {
    const error = new Error("Bundle is private");
    (error as any).status = 403;
    throw error;
  }

  if (!bundle.isPremium) {
    const error = new Error("Bundle is already free");
    (error as any).status = 400;
    throw error;
  }

  const itemRows = await db
    .select({
      collectionId: drinkBundleItems.collectionId,
      collectionUserId: drinkCollections.userId,
      isPremium: drinkCollections.isPremium,
      accessType: drinkCollections.accessType,
    })
    .from(drinkBundleItems)
    .innerJoin(drinkCollections, eq(drinkBundleItems.collectionId, drinkCollections.id))
    .where(eq(drinkBundleItems.bundleId, bundle.id));

  if (itemRows.length === 0) {
    const error = new Error("Bundle must include at least one premium collection before checkout");
    (error as any).status = 400;
    throw error;
  }

  const invalidItem = itemRows.find((item) => item.collectionUserId !== bundle.userId || deriveCollectionAccessType({ accessType: item.accessType, isPremium: item.isPremium }) !== "premium_purchase");
  if (invalidItem) {
    const error = new Error("Bundles can only include this creator's Premium Purchase collections");
    (error as any).status = 400;
    throw error;
  }

  const ownedBundleIds = await loadOwnedBundleIdsForUser(viewerUserId);
  return {
    bundle,
    isOwner,
    alreadyOwned: isOwner || ownedBundleIds.has(bundle.id),
  };
}

async function loadCheckoutSessionForUser(checkoutSessionId: string, userId: string) {
  if (!db) return null;
  const rows = await db
    .select()
    .from(drinkCollectionCheckoutSessions)
    .where(
      and(
        eq(drinkCollectionCheckoutSessions.id, checkoutSessionId),
        eq(drinkCollectionCheckoutSessions.userId, userId),
      ),
    )
    .limit(1);

  return rows[0] ?? null;
}

async function loadBundleCheckoutSessionForUser(checkoutSessionId: string, userId: string) {
  if (!db) return null;
  const rows = await db
    .select()
    .from(drinkBundleCheckoutSessions)
    .where(
      and(
        eq(drinkBundleCheckoutSessions.id, checkoutSessionId),
        eq(drinkBundleCheckoutSessions.userId, userId),
      ),
    )
    .limit(1);

  return rows[0] ?? null;
}

function getCollectionCheckoutPollStatus(session: DrinkCollectionCheckoutSessionRecord): DrinkCollectionCheckoutStatus {
  if (session.status === "completed") return "completed";
  if (session.status === "failed") return "failed";
  if (session.status === "canceled") return "canceled";
  if (session.status === "refunded_pending") return "refunded_pending";
  if (session.status === "refunded") return "refunded";
  if (session.status === "revoked") return "revoked";
  return "pending";
}

function toGiftSummary(record: DrinkGiftRecord, claimUrl: string): GiftSummary {
  return {
    id: record.id,
    giftCode: record.giftCode,
    status: record.status as DrinkGiftStatus,
    targetType: record.targetType as DrinkGiftTargetType,
    targetId: record.targetId,
    checkoutSessionId: record.checkoutSessionId,
    purchaserUserId: record.purchaserUserId,
    recipientUserId: record.recipientUserId ?? null,
    recipientIdentifier: record.recipientIdentifier ?? null,
    claimUrl,
    claimedAt: record.claimedAt ? record.claimedAt.toISOString() : null,
    completedAt: record.completedAt ? record.completedAt.toISOString() : null,
    revokedAt: record.revokedAt ? record.revokedAt.toISOString() : null,
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
  };
}

function toCollectionCheckoutSnapshot(session?: DrinkCollectionCheckoutSessionRecord | null, gift?: GiftSummary | null): CollectionCheckoutSnapshot | null {
  if (!session) return null;
  return {
    checkoutSessionId: session.id,
    status: getCollectionCheckoutPollStatus(session),
    purchaseType: normalizePurchaseType(session.purchaseType),
    failureReason: session.failureReason ?? null,
    updatedAt: session.updatedAt.toISOString(),
    verifiedAt: session.verifiedAt ? session.verifiedAt.toISOString() : null,
    expiresAt: session.expiresAt ? session.expiresAt.toISOString() : null,
    originalAmountCents: session.originalAmountCents ?? null,
    discountAmountCents: session.discountAmountCents ?? null,
    promotionCode: session.promotionCode ?? null,
    gift: gift ?? null,
  };
}

function getBundleCheckoutPollStatus(session: DrinkBundleCheckoutSessionRecord): DrinkBundleCheckoutStatus {
  if (session.status === "completed") return "completed";
  if (session.status === "failed") return "failed";
  if (session.status === "canceled") return "canceled";
  if (session.status === "refunded_pending") return "refunded_pending";
  if (session.status === "refunded") return "refunded";
  if (session.status === "revoked") return "revoked";
  return "pending";
}

function toBundleCheckoutSnapshot(session?: DrinkBundleCheckoutSessionRecord | null, gift?: GiftSummary | null): BundleCheckoutSnapshot | null {
  if (!session) return null;
  return {
    checkoutSessionId: session.id,
    status: getBundleCheckoutPollStatus(session),
    purchaseType: normalizePurchaseType(session.purchaseType),
    failureReason: session.failureReason ?? null,
    updatedAt: session.updatedAt.toISOString(),
    verifiedAt: session.verifiedAt ? session.verifiedAt.toISOString() : null,
    expiresAt: session.expiresAt ? session.expiresAt.toISOString() : null,
    gift: gift ?? null,
  };
}

async function loadLatestCheckoutSessionForUserCollection(userId: string, collectionId: string) {
  if (!db) return null;

  const rows = await db
    .select()
    .from(drinkCollectionCheckoutSessions)
    .where(
      and(
        eq(drinkCollectionCheckoutSessions.userId, userId),
        eq(drinkCollectionCheckoutSessions.collectionId, collectionId),
      ),
    )
    .orderBy(desc(drinkCollectionCheckoutSessions.updatedAt), desc(drinkCollectionCheckoutSessions.createdAt))
    .limit(1);

  return rows[0] ?? null;
}

async function loadLatestCheckoutSessionForUserBundle(userId: string, bundleId: string) {
  if (!db) return null;

  const rows = await db
    .select()
    .from(drinkBundleCheckoutSessions)
    .where(
      and(
        eq(drinkBundleCheckoutSessions.userId, userId),
        eq(drinkBundleCheckoutSessions.bundleId, bundleId),
      ),
    )
    .orderBy(desc(drinkBundleCheckoutSessions.updatedAt), desc(drinkBundleCheckoutSessions.createdAt))
    .limit(1);

  return rows[0] ?? null;
}

async function loadCheckoutSessionForWebhookLookup(input: {
  checkoutSessionId?: string | null;
  squareOrderId?: string | null;
  squarePaymentId?: string | null;
  providerReferenceId?: string | null;
}) {
  if (!db) return null;

  const conditions: any[] = [];
  if (input.checkoutSessionId) conditions.push(eq(drinkCollectionCheckoutSessions.id, input.checkoutSessionId));
  if (input.squareOrderId) conditions.push(eq(drinkCollectionCheckoutSessions.squareOrderId, input.squareOrderId));
  if (input.squarePaymentId) conditions.push(eq(drinkCollectionCheckoutSessions.squarePaymentId, input.squarePaymentId));
  if (input.providerReferenceId) conditions.push(eq(drinkCollectionCheckoutSessions.providerReferenceId, input.providerReferenceId));
  if (!conditions.length) return null;

  const rows = await db
    .select()
    .from(drinkCollectionCheckoutSessions)
    .where(or(...conditions))
    .orderBy(desc(drinkCollectionCheckoutSessions.updatedAt), desc(drinkCollectionCheckoutSessions.createdAt))
    .limit(1);

  return rows[0] ?? null;
}

async function loadGiftByCheckoutSessionId(checkoutSessionId?: string | null) {
  if (!db || !checkoutSessionId) return null;

  const rows = await db
    .select()
    .from(drinkGifts)
    .where(eq(drinkGifts.checkoutSessionId, checkoutSessionId))
    .limit(1);

  return rows[0] ?? null;
}

async function loadGiftByCode(giftCode: string) {
  if (!db) return null;

  const rows = await db
    .select()
    .from(drinkGifts)
    .where(eq(drinkGifts.giftCode, giftCode))
    .limit(1);

  return rows[0] ?? null;
}

async function ensureGiftRecordForCheckout(
  tx: typeof db,
  input: {
    purchaserUserId: string;
    targetType: DrinkGiftTargetType;
    targetId: string;
    checkoutSessionId: string;
    provider?: string | null;
    recipientIdentifier?: string | null;
  },
) {
  const now = new Date();

  await tx
    .insert(drinkGifts)
    .values({
      purchaserUserId: input.purchaserUserId,
      recipientIdentifier: input.recipientIdentifier ?? null,
      targetType: input.targetType,
      targetId: input.targetId,
      checkoutSessionId: input.checkoutSessionId,
      provider: input.provider ?? "square",
      status: "pending",
      giftCode: crypto.randomUUID(),
      updatedAt: now,
    })
    .onConflictDoUpdate({
      target: drinkGifts.checkoutSessionId,
      set: {
        purchaserUserId: input.purchaserUserId,
        targetType: input.targetType,
        targetId: input.targetId,
        provider: input.provider ?? "square",
        recipientIdentifier: input.recipientIdentifier ?? null,
        status: "pending",
        revokedAt: null,
        updatedAt: now,
      },
    });

  const rows = await tx
    .select()
    .from(drinkGifts)
    .where(eq(drinkGifts.checkoutSessionId, input.checkoutSessionId))
    .limit(1);

  return rows[0] ?? null;
}

async function loadBundleCheckoutSessionForWebhookLookup(input: {
  checkoutSessionId?: string | null;
  squareOrderId?: string | null;
  squarePaymentId?: string | null;
  providerReferenceId?: string | null;
}) {
  if (!db) return null;

  const conditions: any[] = [];
  if (input.checkoutSessionId) conditions.push(eq(drinkBundleCheckoutSessions.id, input.checkoutSessionId));
  if (input.squareOrderId) conditions.push(eq(drinkBundleCheckoutSessions.squareOrderId, input.squareOrderId));
  if (input.squarePaymentId) conditions.push(eq(drinkBundleCheckoutSessions.squarePaymentId, input.squarePaymentId));
  if (input.providerReferenceId) conditions.push(eq(drinkBundleCheckoutSessions.providerReferenceId, input.providerReferenceId));
  if (!conditions.length) return null;

  const rows = await db
    .select()
    .from(drinkBundleCheckoutSessions)
    .where(or(...conditions))
    .orderBy(desc(drinkBundleCheckoutSessions.updatedAt), desc(drinkBundleCheckoutSessions.createdAt))
    .limit(1);

  return rows[0] ?? null;
}

async function grantCollectionPurchase(
  session: DrinkCollectionCheckoutSessionRecord,
  input: { squarePaymentId?: string | null; squareOrderId?: string | null } = {},
) {
  if (!db) {
    throw new Error("Database unavailable");
  }

  await db.transaction(async (tx) => {
    const collectionRows = await tx
      .select({
        creatorUserId: drinkCollections.userId,
        priceCents: drinkCollections.priceCents,
      })
      .from(drinkCollections)
      .where(eq(drinkCollections.id, session.collectionId))
      .limit(1);

    const collection = collectionRows[0];
    if (!collection) {
      throw new Error("Collection not found for premium purchase grant");
    }

    const now = new Date();
    const purchaseType = normalizePurchaseType(session.purchaseType);
    let purchase: { id: string; createdAt: Date | null } | null = null;

    if (purchaseType === "gift") {
      await ensureGiftRecordForCheckout(tx as typeof db, {
        purchaserUserId: session.userId,
        targetType: "collection",
        targetId: session.collectionId,
        checkoutSessionId: session.id,
        provider: session.provider,
      });
    } else {
      const insertedPurchase = await tx
        .insert(drinkCollectionPurchases)
        .values({
          userId: session.userId,
          collectionId: session.collectionId,
          status: "completed",
          statusReason: null,
          accessRevokedAt: null,
          updatedAt: now,
        })
        .onConflictDoUpdate({
          target: [drinkCollectionPurchases.userId, drinkCollectionPurchases.collectionId],
          set: {
            status: "completed",
            statusReason: null,
            accessRevokedAt: null,
            updatedAt: now,
          },
        })
        .returning({
          id: drinkCollectionPurchases.id,
          createdAt: drinkCollectionPurchases.createdAt,
        });

      purchase = insertedPurchase[0] ?? (await tx
        .select({
          id: drinkCollectionPurchases.id,
          createdAt: drinkCollectionPurchases.createdAt,
        })
        .from(drinkCollectionPurchases)
        .where(
          and(
            eq(drinkCollectionPurchases.userId, session.userId),
            eq(drinkCollectionPurchases.collectionId, session.collectionId),
          ),
        )
        .limit(1))[0] ?? null;

      if (!purchase) {
        throw new Error("Purchase ownership record missing after premium collection grant");
      }
    }

    await tx
      .update(drinkCollectionCheckoutSessions)
      .set({
        status: "completed",
        squareOrderId: input.squareOrderId ?? session.squareOrderId,
        squarePaymentId: input.squarePaymentId ?? session.squarePaymentId,
        verifiedAt: now,
        refundedAt: null,
        accessRevokedAt: null,
        lastVerifiedAt: now,
        failureReason: null,
        updatedAt: now,
      })
      .where(eq(drinkCollectionCheckoutSessions.id, session.id));

    await upsertDrinkCollectionSalesLedgerEntry(tx as typeof db, {
      creatorUserId: collection.creatorUserId,
      collectionId: session.collectionId,
      purchaseId: purchase?.id ?? null,
      checkoutSessionId: session.id,
      promotionId: session.promotionId,
      promotionCode: session.promotionCode,
      originalAmountCents: session.originalAmountCents ?? collection.priceCents,
      discountAmountCents: session.discountAmountCents ?? 0,
      grossAmountCents: Number(session.amountCents ?? collection.priceCents ?? 0),
      currencyCode: session.currencyCode,
      createdAt: purchase?.createdAt ?? session.verifiedAt ?? session.updatedAt ?? new Date(),
      status: "completed",
      statusReason: null,
      refundedAt: null,
    });

    if (session.promotionId && session.status !== "completed") {
      await tx
        .update(drinkCollectionPromotions)
        .set({
          redemptionCount: sql`${drinkCollectionPromotions.redemptionCount} + 1`,
          updatedAt: now,
        })
        .where(eq(drinkCollectionPromotions.id, session.promotionId));
    }
  });
}

async function updateCollectionAccessState(
  session: DrinkCollectionCheckoutSessionRecord,
  input: CollectionAccessStatusInput,
) {
  if (!db) {
    throw new Error("Database unavailable");
  }

  await db.transaction(async (tx) => {
    const now = new Date();
    const revokeTimestamp = input.purchaseStatus === "completed" ? null : (input.refundedAt ?? now);
    const purchaseType = normalizePurchaseType(session.purchaseType);
    const gift = purchaseType === "gift"
      ? await (tx as typeof db)
        .select()
        .from(drinkGifts)
        .where(eq(drinkGifts.checkoutSessionId, session.id))
        .limit(1)
        .then((rows) => rows[0] ?? null)
      : null;
    const purchaseUserId = gift?.recipientUserId ?? session.userId;

    const existingPurchase = purchaseUserId
      ? (await tx
        .select({
          id: drinkCollectionPurchases.id,
          createdAt: drinkCollectionPurchases.createdAt,
        })
        .from(drinkCollectionPurchases)
        .where(
          and(
            eq(drinkCollectionPurchases.userId, purchaseUserId),
            eq(drinkCollectionPurchases.collectionId, session.collectionId),
          ),
        )
        .limit(1))[0] ?? null
      : null;

    if (existingPurchase && purchaseUserId) {
      await tx
        .update(drinkCollectionPurchases)
        .set({
          status: input.purchaseStatus,
          statusReason: input.reason ?? null,
          accessRevokedAt: revokeTimestamp,
          updatedAt: now,
        })
        .where(eq(drinkCollectionPurchases.id, existingPurchase.id));
    }

    await tx
      .update(drinkCollectionCheckoutSessions)
      .set({
        status: input.checkoutStatus,
        squareOrderId: input.squareOrderId ?? session.squareOrderId,
        squarePaymentId: input.squarePaymentId ?? session.squarePaymentId,
        refundedAt: isRefundRelatedStatus(input.checkoutStatus) ? (input.refundedAt ?? now) : null,
        accessRevokedAt: input.checkoutStatus === "completed" ? null : revokeTimestamp,
        failureReason: input.reason ?? null,
        lastVerifiedAt: now,
        updatedAt: now,
      })
      .where(eq(drinkCollectionCheckoutSessions.id, session.id));

    if (gift) {
      await tx
        .update(drinkGifts)
        .set({
          status: input.checkoutStatus === "completed" ? "completed" : "revoked",
          revokedAt: input.checkoutStatus === "completed" ? null : revokeTimestamp,
          completedAt: input.checkoutStatus === "completed" ? (gift.completedAt ?? now) : gift.completedAt,
          updatedAt: now,
        })
        .where(eq(drinkGifts.id, gift.id));
    }

    if (existingPurchase || input.ledgerStatus === "completed") {
      await tx
        .update(drinkCollectionSalesLedger)
        .set({
          purchaseId: existingPurchase?.id ?? null,
          status: input.ledgerStatus,
          statusReason: input.reason ?? null,
          refundedAt: isRefundRelatedStatus(input.ledgerStatus) ? (input.refundedAt ?? now) : null,
          updatedAt: now,
        })
        .where(eq(drinkCollectionSalesLedger.checkoutSessionId, session.id));
    }
  });
}

async function grantBundlePurchase(
  session: DrinkBundleCheckoutSessionRecord,
  input: { squarePaymentId?: string | null; squareOrderId?: string | null } = {},
) {
  if (!db) throw new Error("Database unavailable");

  await db.transaction(async (tx) => {
    const now = new Date();
    if (normalizePurchaseType(session.purchaseType) === "gift") {
      await ensureGiftRecordForCheckout(tx as typeof db, {
        purchaserUserId: session.userId,
        targetType: "bundle",
        targetId: session.bundleId,
        checkoutSessionId: session.id,
        provider: session.provider,
      });
    } else {
      await tx
        .insert(drinkBundlePurchases)
        .values({
          userId: session.userId,
          bundleId: session.bundleId,
          status: "completed",
          statusReason: null,
          accessRevokedAt: null,
          updatedAt: now,
        })
        .onConflictDoUpdate({
          target: [drinkBundlePurchases.userId, drinkBundlePurchases.bundleId],
          set: {
            status: "completed",
            statusReason: null,
            accessRevokedAt: null,
            updatedAt: now,
          },
        });
    }

    await tx
      .update(drinkBundleCheckoutSessions)
      .set({
        status: "completed",
        squareOrderId: input.squareOrderId ?? session.squareOrderId,
        squarePaymentId: input.squarePaymentId ?? session.squarePaymentId,
        verifiedAt: now,
        refundedAt: null,
        accessRevokedAt: null,
        lastVerifiedAt: now,
        failureReason: null,
        updatedAt: now,
      })
      .where(eq(drinkBundleCheckoutSessions.id, session.id));
  });
}

async function updateBundleAccessState(
  session: DrinkBundleCheckoutSessionRecord,
  input: {
    purchaseStatus: DrinkBundlePurchaseStatus;
    checkoutStatus: DrinkBundleCheckoutStatus;
    reason?: string | null;
    squarePaymentId?: string | null;
    squareOrderId?: string | null;
    refundedAt?: Date | null;
  },
) {
  if (!db) throw new Error("Database unavailable");

  await db.transaction(async (tx) => {
    const now = new Date();
    const revokeTimestamp = input.purchaseStatus === "completed" ? null : (input.refundedAt ?? now);
    const purchaseType = normalizePurchaseType(session.purchaseType);
    const gift = purchaseType === "gift"
      ? await (tx as typeof db)
        .select()
        .from(drinkGifts)
        .where(eq(drinkGifts.checkoutSessionId, session.id))
        .limit(1)
        .then((rows) => rows[0] ?? null)
      : null;
    const purchaseUserId = gift?.recipientUserId ?? session.userId;

    if (purchaseUserId) {
      await tx
        .update(drinkBundlePurchases)
        .set({
          status: input.purchaseStatus,
          statusReason: input.reason ?? null,
          accessRevokedAt: revokeTimestamp,
          updatedAt: now,
        })
        .where(
          and(
            eq(drinkBundlePurchases.userId, purchaseUserId),
            eq(drinkBundlePurchases.bundleId, session.bundleId),
          ),
        );
    }

    await tx
      .update(drinkBundleCheckoutSessions)
      .set({
        status: input.checkoutStatus,
        squareOrderId: input.squareOrderId ?? session.squareOrderId,
        squarePaymentId: input.squarePaymentId ?? session.squarePaymentId,
        refundedAt: isRefundRelatedStatus(input.checkoutStatus) ? (input.refundedAt ?? now) : null,
        accessRevokedAt: input.checkoutStatus === "completed" ? null : revokeTimestamp,
        failureReason: input.reason ?? null,
        lastVerifiedAt: now,
        updatedAt: now,
      })
      .where(eq(drinkBundleCheckoutSessions.id, session.id));

    if (gift) {
      await tx
        .update(drinkGifts)
        .set({
          status: input.checkoutStatus === "completed" ? "completed" : "revoked",
          revokedAt: input.checkoutStatus === "completed" ? null : revokeTimestamp,
          completedAt: input.checkoutStatus === "completed" ? (gift.completedAt ?? now) : gift.completedAt,
          updatedAt: now,
        })
        .where(eq(drinkGifts.id, gift.id));
    }
  });
}

function parseSquareOrderState(order: any, payment: any | null, expectedAmountCents: number): ParsedSquareOrderStatus {
  const orderState = String(order?.state || "").toUpperCase();
  const tenderTotal = sumTenderAmounts(order?.tenders);
  const squarePaymentId = payment?.id ?? order?.tenders?.find((tender: any) => tender?.paymentId || tender?.id)?.paymentId ?? order?.tenders?.find((tender: any) => tender?.paymentId || tender?.id)?.id ?? null;
  const paymentStatus = String(payment?.status || "").toUpperCase();
  const paymentAmount = bigintAmountToNumber(payment?.amountMoney?.amount);

  if (orderState === "COMPLETED" && tenderTotal >= expectedAmountCents) {
    if (!payment || (paymentStatus === "COMPLETED" && paymentAmount >= expectedAmountCents)) {
      return {
        status: "completed",
        squareOrderId: order?.id ?? null,
        squarePaymentId,
      };
    }
  }

  if (paymentStatus === "FAILED") {
    return {
      status: "failed",
      squareOrderId: order?.id ?? null,
      squarePaymentId,
      failureReason: "Square reported the payment as failed.",
    };
  }

  if (paymentStatus === "CANCELED" || orderState === "CANCELED") {
    return {
      status: "canceled",
      squareOrderId: order?.id ?? null,
      squarePaymentId,
      failureReason: "Square checkout was canceled before payment completed.",
    };
  }

  return {
    status: "pending",
    squareOrderId: order?.id ?? null,
    squarePaymentId,
  };
}

async function fetchSquareOrderVerification(session: DrinkCollectionCheckoutSessionRecord): Promise<SquareOrderVerificationPayload | null> {
  if (!session.squareOrderId) return null;

  const squareClient = getSquareClient();
  const orderResponse = await squareClient.orders.get({ orderId: session.squareOrderId });
  const order = orderResponse?.order ?? null;
  if (!order) return null;

  const paymentId = order.tenders?.find((tender) => tender?.paymentId || tender?.id)?.paymentId
    ?? order.tenders?.find((tender) => tender?.paymentId || tender?.id)?.id
    ?? session.squarePaymentId
    ?? null;

  let payment = null;
  if (paymentId) {
    try {
      const paymentResponse = await squareClient.payments.get({ paymentId });
      payment = paymentResponse?.payment ?? null;
    } catch (error) {
      console.warn("[drinks/collections] Failed to retrieve Square payment", {
        checkoutSessionId: session.id,
        paymentId,
        error,
      });
    }
  }

  return {
    order,
    payment,
    squareOrderId: order.id ?? session.squareOrderId ?? null,
    squarePaymentId: payment?.id ?? paymentId,
  };
}

async function fetchSquareOrderVerificationForBundle(session: DrinkBundleCheckoutSessionRecord): Promise<SquareOrderVerificationPayload | null> {
  if (!session.squareOrderId) return null;

  const squareClient = getSquareClient();
  const orderResponse = await squareClient.orders.get({ orderId: session.squareOrderId });
  const order = orderResponse?.order ?? null;
  if (!order) return null;

  const paymentId = order.tenders?.find((tender) => tender?.paymentId || tender?.id)?.paymentId
    ?? order.tenders?.find((tender) => tender?.paymentId || tender?.id)?.id
    ?? session.squarePaymentId
    ?? null;

  let payment = null;
  if (paymentId) {
    try {
      const paymentResponse = await squareClient.payments.get({ paymentId });
      payment = paymentResponse?.payment ?? null;
    } catch (error) {
      console.warn("[drinks/bundles] Failed to retrieve Square payment", {
        checkoutSessionId: session.id,
        paymentId,
        error,
      });
    }
  }

  return {
    order,
    payment,
    squareOrderId: order.id ?? session.squareOrderId ?? null,
    squarePaymentId: payment?.id ?? paymentId,
  };
}


function getSquareWebhookNotificationUrl(req: Request) {
  const configuredBaseUrl = process.env.APP_BASE_URL?.trim() || process.env.CLIENT_URL?.trim();
  if (configuredBaseUrl) {
    return `${configuredBaseUrl.replace(/\/$/, "")}${req.originalUrl}`;
  }

  const host = req.get("host");
  if (!host) {
    throw new Error("Unable to determine Square webhook host");
  }

  return `${req.protocol}://${host}${req.originalUrl}`;
}

function extractSquareWebhookObject(payload: SquareWebhookEventBody) {
  const objectEnvelope = payload.data?.object ?? null;
  const objectType = String(payload.data?.type || "").trim().toLowerCase();
  if (!objectEnvelope || !objectType) {
    return { objectType, resource: null as Record<string, any> | null };
  }

  const resource = (objectEnvelope as Record<string, any>)[objectType] ?? objectEnvelope;
  return {
    objectType,
    resource: resource && typeof resource === "object" ? (resource as Record<string, any>) : null,
  };
}

async function resolveWebhookSessionFromPayload(payload: SquareWebhookEventBody) {
  const { resource } = extractSquareWebhookObject(payload);
  const checkoutSessionId = typeof resource?.metadata?.checkoutSessionId === "string" ? resource.metadata.checkoutSessionId : null;
  const providerReferenceId = typeof resource?.referenceId === "string"
    ? resource.referenceId
    : typeof resource?.order?.referenceId === "string"
      ? resource.order.referenceId
      : null;
  const squareOrderId = typeof resource?.orderId === "string"
    ? resource.orderId
    : typeof resource?.id === "string" && String(payload.data?.type || "").toLowerCase() === "order"
      ? resource.id
      : null;
  const squarePaymentId = typeof resource?.id === "string" && String(payload.data?.type || "").toLowerCase() === "payment"
    ? resource.id
    : typeof resource?.paymentId === "string"
      ? resource.paymentId
      : null;

  let session = await loadCheckoutSessionForWebhookLookup({
    checkoutSessionId,
    squareOrderId,
    squarePaymentId,
    providerReferenceId,
  });

  if (!session && squarePaymentId) {
    try {
      const squareClient = getSquareClient();
      const paymentResponse = await squareClient.payments.get({ paymentId: squarePaymentId });
      const payment = paymentResponse?.payment ?? null;
      session = await loadCheckoutSessionForWebhookLookup({
        checkoutSessionId,
        squareOrderId: payment?.orderId ?? squareOrderId,
        squarePaymentId,
        providerReferenceId,
      });
    } catch (error) {
      console.warn("[drinks/collections] Failed webhook payment lookup", {
        eventId: payload.event_id,
        squarePaymentId,
        error,
      });
    }
  }

  return {
    session,
    resource,
    checkoutSessionId,
    providerReferenceId,
    squareOrderId,
    squarePaymentId,
  };
}

async function resolveBundleWebhookSessionFromPayload(payload: SquareWebhookEventBody) {
  const { resource } = extractSquareWebhookObject(payload);
  const checkoutSessionId = typeof resource?.metadata?.checkoutSessionId === "string" ? resource.metadata.checkoutSessionId : null;
  const providerReferenceId = typeof resource?.referenceId === "string"
    ? resource.referenceId
    : typeof resource?.order?.referenceId === "string"
      ? resource.order.referenceId
      : null;
  const squareOrderId = typeof resource?.orderId === "string"
    ? resource.orderId
    : typeof resource?.id === "string" && String(payload.data?.type || "").toLowerCase() === "order"
      ? resource.id
      : null;
  const squarePaymentId = typeof resource?.id === "string" && String(payload.data?.type || "").toLowerCase() === "payment"
    ? resource.id
    : typeof resource?.paymentId === "string"
      ? resource.paymentId
      : null;

  let session = await loadBundleCheckoutSessionForWebhookLookup({
    checkoutSessionId,
    squareOrderId,
    squarePaymentId,
    providerReferenceId,
  });

  if (!session && squarePaymentId) {
    try {
      const squareClient = getSquareClient();
      const paymentResponse = await squareClient.payments.get({ paymentId: squarePaymentId });
      const payment = paymentResponse?.payment ?? null;
      session = await loadBundleCheckoutSessionForWebhookLookup({
        checkoutSessionId,
        squareOrderId: payment?.orderId ?? squareOrderId,
        squarePaymentId,
        providerReferenceId,
      });
    } catch (error) {
      console.warn("[drinks/bundles] Failed webhook payment lookup", {
        eventId: payload.event_id,
        squarePaymentId,
        error,
      });
    }
  }

  return {
    session,
    resource,
    checkoutSessionId,
    providerReferenceId,
    squareOrderId,
    squarePaymentId,
  };
}

function doesWebhookMatchSession(
  session: DrinkCollectionCheckoutSessionRecord,
  input: {
    resource: Record<string, any> | null;
    checkoutSessionId?: string | null;
    providerReferenceId?: string | null;
    squareOrderId?: string | null;
    squarePaymentId?: string | null;
  },
) {
  const metadata = input.resource?.metadata ?? null;
  if (input.checkoutSessionId && input.checkoutSessionId !== session.id) return false;
  if (input.providerReferenceId && input.providerReferenceId !== session.providerReferenceId) return false;
  if (input.squareOrderId && session.squareOrderId && input.squareOrderId !== session.squareOrderId) return false;
  if (input.squarePaymentId && session.squarePaymentId && input.squarePaymentId !== session.squarePaymentId) return false;
  if (metadata?.collectionId && metadata.collectionId !== session.collectionId) return false;
  if (metadata?.userId && metadata.userId !== session.userId) return false;
  return true;
}

function getPaymentAmountDetails(resource: Record<string, any> | null) {
  const amountMoney = resource?.amountMoney ?? resource?.totalMoney ?? resource?.approvedMoney ?? null;
  return {
    amountCents: bigintAmountToNumber(amountMoney?.amount),
    currencyCode: normalizeSquareCurrencyCode(amountMoney?.currency),
  };
}

function mapSquareRefundState(refundStatus: string): CollectionAccessStatusInput | null {
  const normalized = refundStatus.trim().toUpperCase();
  if (!normalized) return null;

  if (normalized === "COMPLETED") {
    return {
      purchaseStatus: "refunded",
      checkoutStatus: "refunded",
      ledgerStatus: "refunded",
      reason: "Square reported that this premium collection payment was refunded.",
      refundedAt: new Date(),
    };
  }

  if (normalized === "PENDING") {
    return {
      purchaseStatus: "refunded_pending",
      checkoutStatus: "refunded_pending",
      ledgerStatus: "refunded_pending",
      reason: "Square reported that a refund is pending for this premium collection payment.",
      refundedAt: new Date(),
    };
  }

  return null;
}

async function recordSquareWebhookEvent(input: {
  eventId: string;
  eventType: string;
  objectType?: string | null;
  objectId?: string | null;
  checkoutSessionId?: string | null;
  createdAt?: string | null;
  status?: string;
}) {
  if (!db) throw new Error("Database unavailable");

  const insertResult = await db
    .insert(drinkCollectionSquareWebhookEvents)
    .values({
      eventId: input.eventId,
      eventType: input.eventType,
      objectType: input.objectType ?? null,
      objectId: input.objectId ?? null,
      checkoutSessionId: input.checkoutSessionId ?? null,
      status: input.status ?? "processed",
      createdAt: input.createdAt ? new Date(input.createdAt) : null,
    })
    .onConflictDoNothing({ target: drinkCollectionSquareWebhookEvents.eventId })
    .returning({ id: drinkCollectionSquareWebhookEvents.id });

  return insertResult.length > 0;
}

async function recordBundleSquareWebhookEvent(input: {
  eventId: string;
  eventType: string;
  objectType?: string | null;
  objectId?: string | null;
  checkoutSessionId?: string | null;
  createdAt?: string | null;
  status?: string;
}) {
  if (!db) throw new Error("Database unavailable");

  const insertResult = await db
    .insert(drinkBundleSquareWebhookEvents)
    .values({
      eventId: input.eventId,
      eventType: input.eventType,
      objectType: input.objectType ?? null,
      objectId: input.objectId ?? null,
      checkoutSessionId: input.checkoutSessionId ?? null,
      status: input.status ?? "processed",
      createdAt: input.createdAt ? new Date(input.createdAt) : null,
    })
    .onConflictDoNothing({ target: drinkBundleSquareWebhookEvents.eventId })
    .returning({ id: drinkBundleSquareWebhookEvents.id });

  return insertResult.length > 0;
}

async function reconcileSquareWebhookEvent(payload: SquareWebhookEventBody) {
  if (!db) {
    throw new Error("Database unavailable");
  }

  const eventId = String(payload.event_id || "").trim();
  const eventType = String(payload.type || "").trim().toLowerCase();
  const { objectType, resource } = extractSquareWebhookObject(payload);
  const objectId = typeof payload.data?.id === "string" ? payload.data.id : typeof resource?.id === "string" ? resource.id : null;

  if (!eventId || !eventType) {
    return { ok: false, ignored: true, reason: "invalid_event" } as const;
  }

  const inserted = await recordSquareWebhookEvent({
    eventId,
    eventType,
    objectType,
    objectId,
    createdAt: payload.created_at ?? null,
    status: "received",
  });

  if (!inserted) {
    return { ok: true, duplicate: true, ignored: true, eventId, eventType } as const;
  }

  const lookup = await resolveWebhookSessionFromPayload(payload);
  if (!lookup.session || !doesWebhookMatchSession(lookup.session, lookup)) {
    await db
      .update(drinkCollectionSquareWebhookEvents)
      .set({
        checkoutSessionId: lookup.session?.id ?? null,
        status: "ignored",
      })
      .where(eq(drinkCollectionSquareWebhookEvents.eventId, eventId));

    return { ok: true, ignored: true, eventId, eventType, reason: "session_not_found" } as const;
  }

  const session = lookup.session;
  await db
    .update(drinkCollectionSquareWebhookEvents)
    .set({
      checkoutSessionId: session.id,
      status: "processing",
    })
    .where(eq(drinkCollectionSquareWebhookEvents.eventId, eventId));

  const metadata = resource?.metadata ?? null;
  if (metadata?.collectionId && metadata.collectionId !== session.collectionId) {
    await updateCollectionAccessState(session, {
      purchaseStatus: "revoked",
      checkoutStatus: "revoked",
      ledgerStatus: "revoked",
      squareOrderId: lookup.squareOrderId,
      squarePaymentId: lookup.squarePaymentId,
      reason: "Square webhook metadata did not match the expected collection.",
    });
    await db.update(drinkCollectionSquareWebhookEvents).set({ status: "rejected" }).where(eq(drinkCollectionSquareWebhookEvents.eventId, eventId));
    return { ok: true, ignored: true, eventId, eventType, reason: "collection_mismatch" } as const;
  }

  if (metadata?.userId && metadata.userId !== session.userId) {
    await updateCollectionAccessState(session, {
      purchaseStatus: "revoked",
      checkoutStatus: "revoked",
      ledgerStatus: "revoked",
      squareOrderId: lookup.squareOrderId,
      squarePaymentId: lookup.squarePaymentId,
      reason: "Square webhook metadata did not match the expected purchaser.",
    });
    await db.update(drinkCollectionSquareWebhookEvents).set({ status: "rejected" }).where(eq(drinkCollectionSquareWebhookEvents.eventId, eventId));
    return { ok: true, ignored: true, eventId, eventType, reason: "user_mismatch" } as const;
  }

  const paymentDetails = getPaymentAmountDetails(resource);
  const shouldValidateAmount = eventType.startsWith("payment.") || eventType.startsWith("order.");
  const amountMismatch = shouldValidateAmount && paymentDetails.amountCents > 0 && paymentDetails.amountCents < session.amountCents;
  const currencyMismatch = shouldValidateAmount && paymentDetails.amountCents > 0 && paymentDetails.currencyCode !== normalizeSquareCurrencyCode(session.currencyCode);

  if (amountMismatch || currencyMismatch) {
    await updateCollectionAccessState(session, {
      purchaseStatus: "revoked",
      checkoutStatus: "revoked",
      ledgerStatus: "revoked",
      squareOrderId: lookup.squareOrderId,
      squarePaymentId: lookup.squarePaymentId,
      reason: amountMismatch
        ? `Square reported ${paymentDetails.amountCents} cents, which is less than the expected ${session.amountCents} cents.`
        : `Square reported ${paymentDetails.currencyCode}, which did not match ${normalizeSquareCurrencyCode(session.currencyCode)}.`,
    });
    await db.update(drinkCollectionSquareWebhookEvents).set({ status: "rejected" }).where(eq(drinkCollectionSquareWebhookEvents.eventId, eventId));
    return { ok: true, ignored: true, eventId, eventType, reason: amountMismatch ? "amount_mismatch" : "currency_mismatch" } as const;
  }

  if (eventType.startsWith("payment.")) {
    const paymentStatus = String(resource?.status || "").toUpperCase();
    if (paymentStatus === "COMPLETED") {
      await grantCollectionPurchase(session, {
        squareOrderId: lookup.squareOrderId ?? resource?.orderId ?? session.squareOrderId,
        squarePaymentId: lookup.squarePaymentId ?? resource?.id ?? session.squarePaymentId,
      });
      await db.update(drinkCollectionSquareWebhookEvents).set({ status: "processed" }).where(eq(drinkCollectionSquareWebhookEvents.eventId, eventId));
      return { ok: true, eventId, eventType, checkoutSessionId: session.id, status: "completed" } as const;
    }

    if (paymentStatus === "FAILED") {
      await updateCollectionAccessState(session, {
        purchaseStatus: "revoked",
        checkoutStatus: "failed",
        ledgerStatus: "revoked",
        squareOrderId: lookup.squareOrderId ?? resource?.orderId ?? session.squareOrderId,
        squarePaymentId: lookup.squarePaymentId ?? resource?.id ?? session.squarePaymentId,
        reason: resource?.delayAction ?? resource?.sourceType
          ? `Square reported the payment as failed (${paymentStatus}).`
          : "Square reported the payment as failed.",
      });
      await db.update(drinkCollectionSquareWebhookEvents).set({ status: "processed" }).where(eq(drinkCollectionSquareWebhookEvents.eventId, eventId));
      return { ok: true, eventId, eventType, checkoutSessionId: session.id, status: "failed" } as const;
    }

    if (paymentStatus === "CANCELED") {
      await updateCollectionAccessState(session, {
        purchaseStatus: "revoked",
        checkoutStatus: "canceled",
        ledgerStatus: "revoked",
        squareOrderId: lookup.squareOrderId ?? resource?.orderId ?? session.squareOrderId,
        squarePaymentId: lookup.squarePaymentId ?? resource?.id ?? session.squarePaymentId,
        reason: "Square checkout was canceled before payment completed.",
      });
      await db.update(drinkCollectionSquareWebhookEvents).set({ status: "processed" }).where(eq(drinkCollectionSquareWebhookEvents.eventId, eventId));
      return { ok: true, eventId, eventType, checkoutSessionId: session.id, status: "canceled" } as const;
    }
  }

  if (eventType.startsWith("order.")) {
    const parsed = parseSquareOrderState(resource, null, session.amountCents);
    if (parsed.status === "completed") {
      await grantCollectionPurchase(session, {
        squareOrderId: parsed.squareOrderId ?? lookup.squareOrderId ?? session.squareOrderId,
        squarePaymentId: parsed.squarePaymentId ?? lookup.squarePaymentId ?? session.squarePaymentId,
      });
    } else if (parsed.status === "failed" || parsed.status === "canceled") {
      await updateCollectionAccessState(session, {
        purchaseStatus: "revoked",
        checkoutStatus: parsed.status,
        ledgerStatus: "revoked",
        squareOrderId: parsed.squareOrderId ?? lookup.squareOrderId ?? session.squareOrderId,
        squarePaymentId: parsed.squarePaymentId ?? lookup.squarePaymentId ?? session.squarePaymentId,
        reason: parsed.failureReason ?? "Square updated the order to a non-completed state.",
      });
    } else {
      await db
        .update(drinkCollectionCheckoutSessions)
        .set({
          squareOrderId: parsed.squareOrderId ?? lookup.squareOrderId ?? session.squareOrderId,
          squarePaymentId: parsed.squarePaymentId ?? lookup.squarePaymentId ?? session.squarePaymentId,
          lastVerifiedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(drinkCollectionCheckoutSessions.id, session.id));
    }

    await db.update(drinkCollectionSquareWebhookEvents).set({ status: "processed" }).where(eq(drinkCollectionSquareWebhookEvents.eventId, eventId));
    return { ok: true, eventId, eventType, checkoutSessionId: session.id, status: getCollectionCheckoutPollStatus(session) } as const;
  }

  if (eventType.startsWith("refund.")) {
    const refundStatus = String(resource?.status || "").toUpperCase();
    const refundState = mapSquareRefundState(refundStatus);
    if (refundState) {
      await updateCollectionAccessState(session, {
        ...refundState,
        squarePaymentId: lookup.squarePaymentId ?? resource?.paymentId ?? session.squarePaymentId,
        squareOrderId: lookup.squareOrderId ?? session.squareOrderId,
      });
    } else if ((refundStatus === "FAILED" || refundStatus === "REJECTED" || refundStatus === "CANCELED")
      && session.status === "refunded_pending") {
      await grantCollectionPurchase(session, {
        squareOrderId: lookup.squareOrderId ?? session.squareOrderId,
        squarePaymentId: lookup.squarePaymentId ?? resource?.paymentId ?? session.squarePaymentId,
      });
    }
    await db.update(drinkCollectionSquareWebhookEvents).set({ status: "processed" }).where(eq(drinkCollectionSquareWebhookEvents.eventId, eventId));
    return { ok: true, eventId, eventType, checkoutSessionId: session.id, status: refundStatus } as const;
  }

  await db.update(drinkCollectionSquareWebhookEvents).set({ status: "ignored" }).where(eq(drinkCollectionSquareWebhookEvents.eventId, eventId));
  return { ok: true, ignored: true, eventId, eventType, reason: "unsupported_event" } as const;
}

async function reconcileBundleSquareWebhookEvent(payload: SquareWebhookEventBody) {
  if (!db) throw new Error("Database unavailable");

  const eventId = String(payload.event_id || "").trim();
  const eventType = String(payload.type || "").trim().toLowerCase();
  const { objectType, resource } = extractSquareWebhookObject(payload);
  const objectId = typeof payload.data?.id === "string" ? payload.data.id : typeof resource?.id === "string" ? resource.id : null;

  if (!eventId || !eventType) {
    return { ok: false, ignored: true, reason: "invalid_event" } as const;
  }

  const inserted = await recordBundleSquareWebhookEvent({
    eventId,
    eventType,
    objectType,
    objectId,
    createdAt: payload.created_at ?? null,
    status: "received",
  });

  if (!inserted) {
    return { ok: true, duplicate: true, ignored: true, eventId, eventType } as const;
  }

  const lookup = await resolveBundleWebhookSessionFromPayload(payload);
  if (!lookup.session || !doesWebhookMatchSession(lookup.session as any, lookup)) {
    await db
      .update(drinkBundleSquareWebhookEvents)
      .set({ checkoutSessionId: lookup.session?.id ?? null, status: "ignored" })
      .where(eq(drinkBundleSquareWebhookEvents.eventId, eventId));

    return { ok: true, ignored: true, eventId, eventType, reason: "session_not_found" } as const;
  }

  const session = lookup.session;
  await db
    .update(drinkBundleSquareWebhookEvents)
    .set({ checkoutSessionId: session.id, status: "processing" })
    .where(eq(drinkBundleSquareWebhookEvents.eventId, eventId));

  const metadata = resource?.metadata ?? null;
  if (metadata?.bundleId && metadata.bundleId !== session.bundleId) {
    await updateBundleAccessState(session, {
      purchaseStatus: "revoked",
      checkoutStatus: "revoked",
      squareOrderId: lookup.squareOrderId,
      squarePaymentId: lookup.squarePaymentId,
      reason: "Square webhook metadata did not match the expected bundle.",
    });
    await db.update(drinkBundleSquareWebhookEvents).set({ status: "rejected" }).where(eq(drinkBundleSquareWebhookEvents.eventId, eventId));
    return { ok: true, ignored: true, eventId, eventType, reason: "bundle_mismatch" } as const;
  }

  if (metadata?.userId && metadata.userId !== session.userId) {
    await updateBundleAccessState(session, {
      purchaseStatus: "revoked",
      checkoutStatus: "revoked",
      squareOrderId: lookup.squareOrderId,
      squarePaymentId: lookup.squarePaymentId,
      reason: "Square webhook metadata did not match the expected purchaser.",
    });
    await db.update(drinkBundleSquareWebhookEvents).set({ status: "rejected" }).where(eq(drinkBundleSquareWebhookEvents.eventId, eventId));
    return { ok: true, ignored: true, eventId, eventType, reason: "user_mismatch" } as const;
  }

  const paymentDetails = getPaymentAmountDetails(resource);
  const shouldValidateAmount = eventType.startsWith("payment.") || eventType.startsWith("order.");
  const amountMismatch = shouldValidateAmount && paymentDetails.amountCents > 0 && paymentDetails.amountCents < session.amountCents;
  const currencyMismatch = shouldValidateAmount && paymentDetails.amountCents > 0 && paymentDetails.currencyCode !== normalizeSquareCurrencyCode(session.currencyCode);

  if (amountMismatch || currencyMismatch) {
    await updateBundleAccessState(session, {
      purchaseStatus: "revoked",
      checkoutStatus: "revoked",
      squareOrderId: lookup.squareOrderId,
      squarePaymentId: lookup.squarePaymentId,
      reason: amountMismatch
        ? `Square reported ${paymentDetails.amountCents} cents, which is less than the expected ${session.amountCents} cents.`
        : `Square reported ${paymentDetails.currencyCode}, which did not match ${normalizeSquareCurrencyCode(session.currencyCode)}.`,
    });
    await db.update(drinkBundleSquareWebhookEvents).set({ status: "rejected" }).where(eq(drinkBundleSquareWebhookEvents.eventId, eventId));
    return { ok: true, ignored: true, eventId, eventType, reason: amountMismatch ? "amount_mismatch" : "currency_mismatch" } as const;
  }

  if (eventType.startsWith("payment.")) {
    const paymentStatus = String(resource?.status || "").toUpperCase();
    if (paymentStatus === "COMPLETED") {
      await grantBundlePurchase(session, {
        squareOrderId: lookup.squareOrderId ?? resource?.orderId ?? session.squareOrderId,
        squarePaymentId: lookup.squarePaymentId ?? resource?.id ?? session.squarePaymentId,
      });
    } else if (paymentStatus === "FAILED") {
      await updateBundleAccessState(session, {
        purchaseStatus: "revoked",
        checkoutStatus: "failed",
        squareOrderId: lookup.squareOrderId ?? resource?.orderId ?? session.squareOrderId,
        squarePaymentId: lookup.squarePaymentId ?? resource?.id ?? session.squarePaymentId,
        reason: "Square reported the payment as failed.",
      });
    } else if (paymentStatus === "CANCELED") {
      await updateBundleAccessState(session, {
        purchaseStatus: "revoked",
        checkoutStatus: "canceled",
        squareOrderId: lookup.squareOrderId ?? resource?.orderId ?? session.squareOrderId,
        squarePaymentId: lookup.squarePaymentId ?? resource?.id ?? session.squarePaymentId,
        reason: "Square checkout was canceled before payment completed.",
      });
    }

    await db.update(drinkBundleSquareWebhookEvents).set({ status: "processed" }).where(eq(drinkBundleSquareWebhookEvents.eventId, eventId));
    return { ok: true, eventId, eventType, checkoutSessionId: session.id, status: getBundleCheckoutPollStatus(session) } as const;
  }

  if (eventType.startsWith("order.")) {
    const parsed = parseSquareOrderState(resource, null, session.amountCents);
    if (parsed.status === "completed") {
      await grantBundlePurchase(session, {
        squareOrderId: parsed.squareOrderId ?? lookup.squareOrderId ?? session.squareOrderId,
        squarePaymentId: parsed.squarePaymentId ?? lookup.squarePaymentId ?? session.squarePaymentId,
      });
    } else if (parsed.status === "failed" || parsed.status === "canceled") {
      await updateBundleAccessState(session, {
        purchaseStatus: "revoked",
        checkoutStatus: parsed.status,
        squareOrderId: parsed.squareOrderId ?? lookup.squareOrderId ?? session.squareOrderId,
        squarePaymentId: parsed.squarePaymentId ?? lookup.squarePaymentId ?? session.squarePaymentId,
        reason: parsed.failureReason ?? "Square updated the order to a non-completed state.",
      });
    }

    await db.update(drinkBundleSquareWebhookEvents).set({ status: "processed" }).where(eq(drinkBundleSquareWebhookEvents.eventId, eventId));
    return { ok: true, eventId, eventType, checkoutSessionId: session.id, status: getBundleCheckoutPollStatus(session) } as const;
  }

  if (eventType.startsWith("refund.")) {
    const refundStatus = String(resource?.status || "").toUpperCase();
    const refundState = mapSquareRefundState(refundStatus);
    if (refundState) {
      await updateBundleAccessState(session, {
        purchaseStatus: refundState.purchaseStatus,
        checkoutStatus: refundState.checkoutStatus,
        squarePaymentId: lookup.squarePaymentId ?? resource?.paymentId ?? session.squarePaymentId,
        squareOrderId: lookup.squareOrderId ?? session.squareOrderId,
        reason: refundState.reason,
        refundedAt: refundState.refundedAt,
      });
    } else if ((refundStatus === "FAILED" || refundStatus === "REJECTED" || refundStatus === "CANCELED")
      && session.status === "refunded_pending") {
      await grantBundlePurchase(session, {
        squareOrderId: lookup.squareOrderId ?? session.squareOrderId,
        squarePaymentId: lookup.squarePaymentId ?? resource?.paymentId ?? session.squarePaymentId,
      });
    }

    await db.update(drinkBundleSquareWebhookEvents).set({ status: "processed" }).where(eq(drinkBundleSquareWebhookEvents.eventId, eventId));
    return { ok: true, eventId, eventType, checkoutSessionId: session.id, status: refundStatus } as const;
  }

  await db.update(drinkBundleSquareWebhookEvents).set({ status: "ignored" }).where(eq(drinkBundleSquareWebhookEvents.eventId, eventId));
  return { ok: true, ignored: true, eventId, eventType, reason: "unsupported_event" } as const;
}

async function loadMembershipCheckoutSessionForUser(sessionId: string, userId: string) {
  if (!db) return null;
  const rows = await db
    .select()
    .from(creatorMembershipCheckoutSessions)
    .where(and(eq(creatorMembershipCheckoutSessions.id, sessionId), eq(creatorMembershipCheckoutSessions.userId, userId)))
    .limit(1);
  return rows[0] ?? null;
}

async function loadLatestMembershipCheckoutSessionForUserCreator(userId: string, creatorUserId: string) {
  if (!db) return null;
  const rows = await db
    .select()
    .from(creatorMembershipCheckoutSessions)
    .where(and(eq(creatorMembershipCheckoutSessions.userId, userId), eq(creatorMembershipCheckoutSessions.creatorUserId, creatorUserId)))
    .orderBy(desc(creatorMembershipCheckoutSessions.createdAt))
    .limit(1);
  return rows[0] ?? null;
}

async function grantCreatorMembership(session: CreatorMembershipCheckoutSessionRecord, squarePaymentId?: string | null, squareOrderId?: string | null) {
  if (!db) throw new Error("Database unavailable");
  const now = new Date();
  const planRows = await db.select().from(creatorMembershipPlans).where(eq(creatorMembershipPlans.id, session.planId)).limit(1);
  const plan = planRows[0];
  if (!plan) throw new Error("Membership plan not found");
  const endsAt = membershipEndsAt(now, normalizeMembershipBillingInterval(plan.billingInterval));

  await db.transaction(async (tx) => {
    await tx
      .insert(creatorMemberships)
      .values({
        userId: session.userId,
        creatorUserId: session.creatorUserId,
        planId: session.planId,
        status: "active",
        startedAt: now,
        endsAt,
        canceledAt: null,
        squareSubscriptionId: null,
        paymentReference: squarePaymentId ?? squareOrderId ?? session.providerReferenceId,
        updatedAt: now,
      })
      .onConflictDoUpdate({
        target: [creatorMemberships.userId, creatorMemberships.creatorUserId],
        set: {
          planId: session.planId,
          status: "active",
          startedAt: now,
          endsAt,
          canceledAt: null,
          paymentReference: squarePaymentId ?? squareOrderId ?? session.providerReferenceId,
          updatedAt: now,
        },
      });

    const membershipRows = await tx
      .select({ id: creatorMemberships.id })
      .from(creatorMemberships)
      .where(and(eq(creatorMemberships.userId, session.userId), eq(creatorMemberships.creatorUserId, session.creatorUserId)))
      .limit(1);

    await tx
      .insert(creatorMembershipSalesLedger)
      .values({
        userId: session.userId,
        creatorUserId: session.creatorUserId,
        membershipId: membershipRows[0]?.id ?? null,
        checkoutSessionId: session.id,
        planId: session.planId,
        grossAmountCents: session.amountCents,
        currencyCode: session.currencyCode,
        status: "completed",
        statusReason: null,
        updatedAt: now,
      })
      .onConflictDoUpdate({
        target: creatorMembershipSalesLedger.checkoutSessionId,
        set: {
          membershipId: membershipRows[0]?.id ?? null,
          grossAmountCents: session.amountCents,
          currencyCode: session.currencyCode,
          status: "completed",
          statusReason: null,
          updatedAt: now,
        },
      });

    await tx
      .update(creatorMembershipCheckoutSessions)
      .set({
        status: "completed",
        squareOrderId: squareOrderId ?? session.squareOrderId,
        squarePaymentId: squarePaymentId ?? session.squarePaymentId,
        verifiedAt: session.verifiedAt ?? now,
        lastVerifiedAt: now,
        failureReason: null,
        updatedAt: now,
      })
      .where(eq(creatorMembershipCheckoutSessions.id, session.id));
  });
}

async function verifyMembershipCheckoutSession(session: CreatorMembershipCheckoutSessionRecord) {
  if (!db) throw new Error("Database unavailable");
  const existingMembership = await loadViewerMembershipForCreator(session.userId, session.creatorUserId);
  if (isCreatorMembershipActiveRecord(existingMembership)) {
    await db
      .update(creatorMembershipCheckoutSessions)
      .set({
        status: "completed",
        verifiedAt: session.verifiedAt ?? new Date(),
        lastVerifiedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(creatorMembershipCheckoutSessions.id, session.id));
    return { status: "completed" as CreatorMembershipCheckoutStatus, membership: existingMembership };
  }

  const verification = await fetchSquareOrderVerification(session as any);
  const parsed = parseSquareOrderState(verification?.order ?? null, verification?.payment ?? null, session.amountCents);
  if (parsed.status === "completed") {
    await grantCreatorMembership(session, parsed.squarePaymentId ?? null, parsed.squareOrderId ?? null);
    const refreshed = await loadViewerMembershipForCreator(session.userId, session.creatorUserId);
    return { status: "completed" as CreatorMembershipCheckoutStatus, membership: refreshed };
  }

  await db
    .update(creatorMembershipCheckoutSessions)
    .set({
      status: parsed.status === "pending" ? "pending" : parsed.status,
      squareOrderId: parsed.squareOrderId ?? session.squareOrderId,
      squarePaymentId: parsed.squarePaymentId ?? session.squarePaymentId,
      failureReason: parsed.failureReason ?? null,
      lastVerifiedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(creatorMembershipCheckoutSessions.id, session.id));

  return { status: parsed.status as CreatorMembershipCheckoutStatus, membership: null, failureReason: parsed.failureReason ?? null };
}

async function verifyCollectionCheckoutSession(session: DrinkCollectionCheckoutSessionRecord): Promise<SquareCheckoutVerificationResult> {
  if (!db) {
    throw new Error("Database unavailable");
  }

  const purchaseType = normalizePurchaseType(session.purchaseType);
  const ownedCollectionIds = purchaseType === "gift" ? new Set<string>() : await loadOwnedCollectionIdsForUser(session.userId);
  if (purchaseType !== "gift" && ownedCollectionIds.has(session.collectionId)) {
    await db
      .update(drinkCollectionCheckoutSessions)
      .set({
        status: "completed",
        verifiedAt: session.verifiedAt ?? new Date(),
        lastVerifiedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(drinkCollectionCheckoutSessions.id, session.id));

    return {
      status: "completed",
      owned: true,
      collectionId: session.collectionId,
      checkoutSessionId: session.id,
      squareOrderId: session.squareOrderId,
      squarePaymentId: session.squarePaymentId,
      failureReason: null,
    };
  }

  if (getCollectionCheckoutPollStatus(session) !== "pending") {
    return {
      status: getCollectionCheckoutPollStatus(session),
      owned: purchaseType === "gift" ? false : ownedCollectionIds.has(session.collectionId),
      collectionId: session.collectionId,
      checkoutSessionId: session.id,
      squareOrderId: session.squareOrderId,
      squarePaymentId: session.squarePaymentId,
      failureReason: session.failureReason,
    };
  }

  const verification = await fetchSquareOrderVerification(session);
  if (!verification) {
    await db
      .update(drinkCollectionCheckoutSessions)
      .set({
        lastVerifiedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(drinkCollectionCheckoutSessions.id, session.id));

    return {
      status: "pending",
      owned: false,
      collectionId: session.collectionId,
      checkoutSessionId: session.id,
      squareOrderId: session.squareOrderId,
      squarePaymentId: session.squarePaymentId,
      failureReason: null,
    };
  }

  const parsed = parseSquareOrderState(verification.order, verification.payment, session.amountCents);

  if (parsed.status === "completed") {
    await grantCollectionPurchase(session, {
      squareOrderId: parsed.squareOrderId,
      squarePaymentId: parsed.squarePaymentId,
    });
    return {
      status: "completed",
      owned: purchaseType === "gift" ? false : true,
      collectionId: session.collectionId,
      checkoutSessionId: session.id,
      squareOrderId: parsed.squareOrderId,
      squarePaymentId: parsed.squarePaymentId,
      failureReason: null,
    };
  }

  await db
    .update(drinkCollectionCheckoutSessions)
    .set({
      status: parsed.status === "pending" ? session.status : parsed.status,
      squareOrderId: parsed.squareOrderId ?? session.squareOrderId,
      squarePaymentId: parsed.squarePaymentId ?? session.squarePaymentId,
      failureReason: parsed.failureReason ?? null,
      lastVerifiedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(drinkCollectionCheckoutSessions.id, session.id));

  return {
    status: parsed.status,
    owned: false,
    collectionId: session.collectionId,
    checkoutSessionId: session.id,
    squareOrderId: parsed.squareOrderId ?? session.squareOrderId,
    squarePaymentId: parsed.squarePaymentId ?? session.squarePaymentId,
    failureReason: parsed.failureReason ?? null,
  };
}

async function verifyBundleCheckoutSession(session: DrinkBundleCheckoutSessionRecord) {
  if (!db) throw new Error("Database unavailable");

  const purchaseType = normalizePurchaseType(session.purchaseType);
  const ownedBundleIds = purchaseType === "gift" ? new Set<string>() : await loadOwnedBundleIdsForUser(session.userId);
  if (purchaseType !== "gift" && ownedBundleIds.has(session.bundleId)) {
    await db
      .update(drinkBundleCheckoutSessions)
      .set({
        status: "completed",
        verifiedAt: session.verifiedAt ?? new Date(),
        lastVerifiedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(drinkBundleCheckoutSessions.id, session.id));

    return {
      status: "completed" as const,
      owned: true,
      bundleId: session.bundleId,
      checkoutSessionId: session.id,
      squareOrderId: session.squareOrderId,
      squarePaymentId: session.squarePaymentId,
      failureReason: null,
    };
  }

  if (getBundleCheckoutPollStatus(session) !== "pending") {
    return {
      status: getBundleCheckoutPollStatus(session),
      owned: purchaseType === "gift" ? false : ownedBundleIds.has(session.bundleId),
      bundleId: session.bundleId,
      checkoutSessionId: session.id,
      squareOrderId: session.squareOrderId,
      squarePaymentId: session.squarePaymentId,
      failureReason: session.failureReason,
    };
  }

  const verification = await fetchSquareOrderVerificationForBundle(session);
  if (!verification) {
    await db
      .update(drinkBundleCheckoutSessions)
      .set({
        lastVerifiedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(drinkBundleCheckoutSessions.id, session.id));

    return {
      status: "pending" as const,
      owned: false,
      bundleId: session.bundleId,
      checkoutSessionId: session.id,
      squareOrderId: session.squareOrderId,
      squarePaymentId: session.squarePaymentId,
      failureReason: null,
    };
  }

  const parsed = parseSquareOrderState(verification.order, verification.payment, session.amountCents);
  if (parsed.status === "completed") {
    await grantBundlePurchase(session, {
      squareOrderId: parsed.squareOrderId,
      squarePaymentId: parsed.squarePaymentId,
    });
    return {
      status: "completed" as const,
      owned: purchaseType === "gift" ? false : true,
      bundleId: session.bundleId,
      checkoutSessionId: session.id,
      squareOrderId: parsed.squareOrderId,
      squarePaymentId: parsed.squarePaymentId,
      failureReason: null,
    };
  }

  await db
    .update(drinkBundleCheckoutSessions)
    .set({
      status: parsed.status === "pending" ? session.status : parsed.status,
      squareOrderId: parsed.squareOrderId ?? session.squareOrderId,
      squarePaymentId: parsed.squarePaymentId ?? session.squarePaymentId,
      failureReason: parsed.failureReason ?? null,
      lastVerifiedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(drinkBundleCheckoutSessions.id, session.id));

  return {
    status: parsed.status,
    owned: false,
    bundleId: session.bundleId,
    checkoutSessionId: session.id,
    squareOrderId: parsed.squareOrderId ?? session.squareOrderId,
    squarePaymentId: parsed.squarePaymentId ?? session.squarePaymentId,
    failureReason: parsed.failureReason ?? null,
  };
}

async function loadDirectlyOwnedCollectionIdsForUser(userId?: string | null): Promise<Set<string>> {
  if (!db || !userId) return new Set();

  const rows = await db
    .select({ collectionId: drinkCollectionPurchases.collectionId })
    .from(drinkCollectionPurchases)
    .where(
      and(
        eq(drinkCollectionPurchases.userId, userId),
        eq(drinkCollectionPurchases.status, "completed"),
      ),
    );

  return new Set(rows.map((row) => row.collectionId));
}

async function loadOwnedBundleIdsForUser(userId?: string | null): Promise<Set<string>> {
  if (!db || !userId) return new Set();

  const rows = await db
    .select({ bundleId: drinkBundlePurchases.bundleId })
    .from(drinkBundlePurchases)
    .where(
      and(
        eq(drinkBundlePurchases.userId, userId),
        eq(drinkBundlePurchases.status, "completed"),
      ),
    );

  return new Set(rows.map((row) => row.bundleId));
}

async function loadOwnedCollectionIdsForUser(userId?: string | null): Promise<Set<string>> {
  const accessMap = await loadCollectionAccessMapForUser(userId);
  return new Set(accessMap.keys());
}

async function claimGiftForUser(gift: DrinkGiftRecord, userId: string) {
  if (!db) throw new Error("Database unavailable");

  if (gift.status === "revoked") {
    const error = new Error("This gift is no longer available to claim.");
    (error as any).status = 410;
    throw error;
  }

  if (gift.recipientUserId && gift.recipientUserId !== userId) {
    const error = new Error("This gift has already been claimed by another account.");
    (error as any).status = 409;
    throw error;
  }

  await db.transaction(async (tx) => {
    const now = new Date();

    if (gift.targetType === "collection") {
      await tx
        .insert(drinkCollectionPurchases)
        .values({
          userId,
          collectionId: gift.targetId,
          status: "completed",
          statusReason: null,
          accessRevokedAt: null,
          updatedAt: now,
        })
        .onConflictDoUpdate({
          target: [drinkCollectionPurchases.userId, drinkCollectionPurchases.collectionId],
          set: {
            status: "completed",
            statusReason: null,
            accessRevokedAt: null,
            updatedAt: now,
          },
        });

      await tx
        .update(drinkCollectionSalesLedger)
        .set({
          purchaseId: sql`(
            SELECT id
            FROM drink_collection_purchases
            WHERE user_id = ${userId} AND collection_id = ${gift.targetId}
            LIMIT 1
          )`,
          updatedAt: now,
        })
        .where(eq(drinkCollectionSalesLedger.checkoutSessionId, gift.checkoutSessionId));
    } else {
      await tx
        .insert(drinkBundlePurchases)
        .values({
          userId,
          bundleId: gift.targetId,
          status: "completed",
          statusReason: null,
          accessRevokedAt: null,
          updatedAt: now,
        })
        .onConflictDoUpdate({
          target: [drinkBundlePurchases.userId, drinkBundlePurchases.bundleId],
          set: {
            status: "completed",
            statusReason: null,
            accessRevokedAt: null,
            updatedAt: now,
          },
        });
    }

    await tx
      .update(drinkGifts)
      .set({
        recipientUserId: userId,
        status: "completed",
        claimedAt: gift.claimedAt ?? now,
        completedAt: now,
        revokedAt: null,
        updatedAt: now,
      })
      .where(eq(drinkGifts.id, gift.id));
  });

  return (await loadGiftByCode(gift.giftCode)) ?? gift;
}

async function loadGiftHistory(userId: string, req: Request) {
  if (!db) throw new Error("Database unavailable");

  const [purchasedRows, receivedRows] = await Promise.all([
    db
      .select()
      .from(drinkGifts)
      .where(eq(drinkGifts.purchaserUserId, userId))
      .orderBy(desc(drinkGifts.createdAt)),
    db
      .select()
      .from(drinkGifts)
      .where(eq(drinkGifts.recipientUserId, userId))
      .orderBy(desc(drinkGifts.updatedAt), desc(drinkGifts.createdAt)),
  ]);

  const collectionIds = new Set<string>();
  const bundleIds = new Set<string>();
  for (const gift of [...purchasedRows, ...receivedRows]) {
    if (gift.targetType === "collection") collectionIds.add(gift.targetId);
    if (gift.targetType === "bundle") bundleIds.add(gift.targetId);
  }

  const [collectionRows, bundleRows] = await Promise.all([
    collectionIds.size
      ? db.select({ id: drinkCollections.id, name: drinkCollections.name }).from(drinkCollections).where(inArray(drinkCollections.id, [...collectionIds]))
      : Promise.resolve([]),
    bundleIds.size
      ? db.select({ id: drinkBundles.id, name: drinkBundles.name }).from(drinkBundles).where(inArray(drinkBundles.id, [...bundleIds]))
      : Promise.resolve([]),
  ]);

  const collectionNameMap = new Map(collectionRows.map((row) => [row.id, row.name]));
  const bundleNameMap = new Map(bundleRows.map((row) => [row.id, row.name]));
  const toEntry = (gift: DrinkGiftRecord) => ({
    ...toGiftSummary(gift, buildGiftClaimUrl(req, gift.giftCode)),
    targetName: gift.targetType === "collection"
      ? (collectionNameMap.get(gift.targetId) ?? "Premium collection")
      : (bundleNameMap.get(gift.targetId) ?? "Premium bundle"),
    targetRoute: gift.targetType === "collection"
      ? `/drinks/collections/${gift.targetId}`
      : `/drinks/bundles/${gift.targetId}`,
  });

  return {
    purchased: purchasedRows.map(toEntry),
    received: receivedRows.map(toEntry),
  };
}

async function loadWishlistedCollectionIdsForUser(userId?: string | null): Promise<Set<string>> {
  if (!db || !userId) return new Set();

  const rows = await db
    .select({ collectionId: drinkCollectionWishlists.collectionId })
    .from(drinkCollectionWishlists)
    .where(eq(drinkCollectionWishlists.userId, userId));

  return new Set(rows.map((row) => row.collectionId));
}

function normalizeCollectionReviewSummary(input?: { averageRating?: unknown; reviewCount?: unknown } | null): CollectionReviewSummary {
  const reviewCount = Math.max(0, Number(input?.reviewCount ?? 0));
  const rawAverageRating = Number(input?.averageRating ?? 0);
  const averageRating = reviewCount > 0 && Number.isFinite(rawAverageRating)
    ? Math.round(rawAverageRating * 10) / 10
    : 0;

  return {
    averageRating,
    reviewCount,
  };
}

function normalizeOptionalReviewText(value: unknown, maxLength: number) {
  if (typeof value !== "string") return null;
  const normalized = value.trim();
  if (!normalized) return null;
  return normalized.slice(0, maxLength);
}

const collectionReviewInputSchema = z.object({
  rating: z.coerce.number().int().min(1).max(5),
  title: z.string().max(160).optional().nullable(),
  body: z.string().max(4000).optional().nullable(),
});

async function loadCollectionReviewSummaryMap(collectionIds: string[]): Promise<Map<string, CollectionReviewSummary>> {
  if (!db || collectionIds.length === 0) return new Map();

  const uniqueCollectionIds = [...new Set(collectionIds.filter(Boolean))];
  if (uniqueCollectionIds.length === 0) return new Map();

  const rows = await db
    .select({
      collectionId: drinkCollectionReviews.collectionId,
      averageRating: sql<string>`round(avg(${drinkCollectionReviews.rating})::numeric, 1)`,
      reviewCount: sql<number>`count(*)::int`,
    })
    .from(drinkCollectionReviews)
    .where(inArray(drinkCollectionReviews.collectionId, uniqueCollectionIds))
    .groupBy(drinkCollectionReviews.collectionId);

  return new Map(rows.map((row) => [row.collectionId, normalizeCollectionReviewSummary(row)]));
}

async function loadHydratedCollectionReviews(collectionId: string) {
  if (!db) {
    throw new Error("Database unavailable");
  }

  const [reviewRows, summaryMap] = await Promise.all([
    db
      .select({
        id: drinkCollectionReviews.id,
        userId: drinkCollectionReviews.userId,
        collectionId: drinkCollectionReviews.collectionId,
        rating: drinkCollectionReviews.rating,
        title: drinkCollectionReviews.title,
        body: drinkCollectionReviews.body,
        isVerifiedPurchase: drinkCollectionReviews.isVerifiedPurchase,
        createdAt: drinkCollectionReviews.createdAt,
        updatedAt: drinkCollectionReviews.updatedAt,
        username: users.username,
        displayName: users.displayName,
        avatar: users.avatar,
      })
      .from(drinkCollectionReviews)
      .innerJoin(users, eq(drinkCollectionReviews.userId, users.id))
      .where(eq(drinkCollectionReviews.collectionId, collectionId))
      .orderBy(desc(drinkCollectionReviews.createdAt)),
    loadCollectionReviewSummaryMap([collectionId]),
  ]);

  const reviews: HydratedDrinkCollectionReview[] = reviewRows.map((row) => ({
    id: row.id,
    userId: row.userId,
    collectionId: row.collectionId,
    rating: Number(row.rating ?? 0),
    title: row.title ?? null,
    body: row.body ?? null,
    isVerifiedPurchase: Boolean(row.isVerifiedPurchase),
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    user: {
      username: row.username ?? null,
      displayName: row.displayName ?? null,
      avatar: row.avatar ?? null,
    },
  }));

  return {
    summary: summaryMap.get(collectionId) ?? normalizeCollectionReviewSummary(),
    reviews,
  };
}

async function userHasActiveCollectionReviewAccess(userId: string, collectionId: string) {
  const ownedCollectionIds = await loadOwnedCollectionIdsForUser(userId);
  return ownedCollectionIds.has(collectionId);
}

async function resolveCollectionWithItems(
  collection: typeof drinkCollections.$inferSelect,
  viewerUserId?: string | null,
  ownedCollectionIds?: Set<string>,
  collectionAccessMap?: Map<string, Set<CollectionAccessGrant>>,
  wishlistedCollectionIds?: Set<string>,
  activePromotionPricingByCollectionId?: Map<string, CollectionPromoPricingSnapshot>,
  wishlistCountsByCollectionId?: Map<string, number>,
  reviewSummaryByCollectionId?: Map<string, CollectionReviewSummary>,
) {
  if (!db) return null;

  const normalizedCollection = normalizeCollectionRowForResponse(collection);
  const acceptedCollaborationMap = await loadAcceptedCollaborationsForTargets([
    { collaborationType: "collection", targetId: normalizedCollection.id },
  ]);
  const acceptedCollaboration = acceptedCollaborationMap.get(`collection:${normalizedCollection.id}`) ?? null;

  const creatorRows = await db
    .select({
      username: users.username,
      avatar: users.avatar,
    })
    .from(users)
    .where(eq(users.id, normalizedCollection.userId))
    .limit(1);

  const creator = creatorRows[0];
  const collaborationProfilesMap = await loadCreatorProfilesMap([
    normalizedCollection.userId,
    acceptedCollaboration?.collaboratorUserId ?? "",
    acceptedCollaboration?.ownerCreatorUserId ?? "",
  ]);

  const itemRows = await db
    .select({
      drinkSlug: drinkCollectionItems.drinkSlug,
      addedAt: drinkCollectionItems.addedAt,
    })
    .from(drinkCollectionItems)
    .where(eq(drinkCollectionItems.collectionId, normalizedCollection.id));

  const detailsBySlug = await resolveDrinkDetailsMapBySlugs(itemRows.map((row) => row.drinkSlug));

  const items = itemRows.map((row) => ({
    id: `${normalizedCollection.id}:${row.drinkSlug}`,
    drinkSlug: row.drinkSlug,
    drinkName: detailsBySlug.get(row.drinkSlug)?.name ?? row.drinkSlug,
    image: detailsBySlug.get(row.drinkSlug)?.image ?? null,
    route: detailsBySlug.get(row.drinkSlug)?.route ?? `/drinks/recipe/${encodeURIComponent(row.drinkSlug)}`,
    remixedFromSlug: detailsBySlug.get(row.drinkSlug)?.remixedFromSlug ?? null,
    addedAt: row.addedAt,
    drink: detailsBySlug.get(row.drinkSlug) ?? null,
  }));

  const coverImage = items[0]?.image ?? null;
  const isOwner = Boolean(viewerUserId && viewerUserId === normalizedCollection.userId);
  const isOwned = isOwner || Boolean(viewerUserId && ownedCollectionIds?.has(normalizedCollection.id));
  const accessGrants = new Set<CollectionAccessGrant>(collectionAccessMap?.get(normalizedCollection.id) ?? []);
  if (isOwner) accessGrants.add("creator");
  const serializedAccessGrants = serializeCollectionAccessGrants(accessGrants);
  const isWishlisted = !isOwned && Boolean(viewerUserId && wishlistedCollectionIds?.has(normalizedCollection.id));
  const reviewSummary = reviewSummaryByCollectionId?.get(normalizedCollection.id) ?? normalizeCollectionReviewSummary();

  return {
    ...normalizedCollection,
    creatorUsername: creator?.username ?? null,
    creatorAvatar: creator?.avatar ?? null,
    route: `/drinks/collections/${collection.id}`,
    coverImage,
    itemsCount: itemRows.length,
    items,
    ownedByViewer: isOwned,
    viewerAccessGrants: serializedAccessGrants,
    viewerPrimaryAccessGrant: serializedAccessGrants[0] ?? null,
    isWishlisted,
    wishlistCount: Number(wishlistCountsByCollectionId?.get(normalizedCollection.id) ?? 0),
    averageRating: reviewSummary.averageRating,
    reviewCount: reviewSummary.reviewCount,
    activePromoPricing: activePromotionPricingByCollectionId?.get(normalizedCollection.id) ?? null,
    acceptedCollaboration: serializeAcceptedCollaboration(acceptedCollaboration, collaborationProfilesMap),
  };
}

async function resolvePublicCollectionCards(inputRows: Array<typeof drinkCollections.$inferSelect>, viewerUserId?: string | null) {
  const [collectionAccessMap, wishlistedCollectionIds, activePromotionPricingByCollectionId, wishlistCountsByCollectionId, reviewSummaryByCollectionId] = await Promise.all([
    loadCollectionAccessMapForUser(viewerUserId),
    loadWishlistedCollectionIdsForUser(viewerUserId),
    loadActivePromotionPricingMap(inputRows),
    loadWishlistCountsForCollections(inputRows.map((row) => row.id)),
    loadCollectionReviewSummaryMap(inputRows.map((row) => row.id)),
  ]);
  const ownedCollectionIds = new Set(collectionAccessMap.keys());
  const collections = await Promise.all(
    inputRows.map((row) => resolveCollectionWithItems(
      row,
      viewerUserId,
      ownedCollectionIds,
      collectionAccessMap,
      wishlistedCollectionIds,
      activePromotionPricingByCollectionId,
      wishlistCountsByCollectionId,
      reviewSummaryByCollectionId,
    )),
  );
  return collections.filter(Boolean);
}

async function resolveBundleWithCollections(
  bundle: typeof drinkBundles.$inferSelect,
  viewerUserId?: string | null,
  ownedBundleIds?: Set<string>,
  accessibleCollectionIds?: Set<string>,
) {
  if (!db) return null;

  const [creatorRows, itemRows, viewerOwnedBundleIds, viewerAccessibleCollectionIds] = await Promise.all([
    db.select({ username: users.username, avatar: users.avatar }).from(users).where(eq(users.id, bundle.userId)).limit(1),
    db
      .select({
        collectionId: drinkBundleItems.collectionId,
        addedAt: drinkBundleItems.addedAt,
        sortOrder: drinkBundleItems.sortOrder,
      })
      .from(drinkBundleItems)
      .where(eq(drinkBundleItems.bundleId, bundle.id))
      .orderBy(asc(drinkBundleItems.sortOrder), asc(drinkBundleItems.addedAt)),
    ownedBundleIds ? Promise.resolve(ownedBundleIds) : loadOwnedBundleIdsForUser(viewerUserId),
    accessibleCollectionIds ? Promise.resolve(accessibleCollectionIds) : loadOwnedCollectionIdsForUser(viewerUserId),
  ]);

  const collectionIds = itemRows.map((row) => row.collectionId);
  const collectionRows = collectionIds.length === 0
    ? []
    : await db.select().from(drinkCollections).where(inArray(drinkCollections.id, collectionIds));
  const collectionMap = new Map(collectionRows.map((row) => [row.id, row]));
  const collectionCards = await Promise.all(
    itemRows.map(async (item) => {
      const collection = collectionMap.get(item.collectionId);
      if (!collection) return null;
      const resolved = await resolveCollectionWithItems(
        collection,
        viewerUserId,
        viewerAccessibleCollectionIds,
        undefined,
      );
      return resolved ? { ...resolved, addedAt: item.addedAt.toISOString(), sortOrder: Number(item.sortOrder ?? 0) } : null;
    }),
  );

  const creator = creatorRows[0] ?? null;
  const viewerOwnsBundle = Boolean(viewerUserId && (viewerOwnedBundleIds.has(bundle.id) || viewerUserId === bundle.userId));

  return {
    ...bundle,
    creatorUsername: creator?.username ?? null,
    creatorAvatar: creator?.avatar ?? null,
    route: `/drinks/bundles/${bundle.id}`,
    itemsCount: collectionCards.filter(Boolean).length,
    includedCollections: collectionCards.filter(Boolean),
    ownedByViewer: viewerOwnsBundle,
    unlockedCollectionCount: collectionCards.filter((collection) => collection?.id && viewerAccessibleCollectionIds.has(collection.id)).length,
  };
}

async function resolvePublicBundleCards(inputRows: Array<typeof drinkBundles.$inferSelect>, viewerUserId?: string | null) {
  const [ownedBundleIds, accessibleCollectionIds] = await Promise.all([
    loadOwnedBundleIdsForUser(viewerUserId),
    loadOwnedCollectionIdsForUser(viewerUserId),
  ]);

  const bundles = await Promise.all(
    inputRows.map((row) => resolveBundleWithCollections(row, viewerUserId, ownedBundleIds, accessibleCollectionIds)),
  );

  return bundles.filter(Boolean);
}

async function loadCollectionCreatorsMap(userIds: string[]) {
  if (!db || userIds.length === 0) return new Map<string, { username: string | null; avatar: string | null }>();

  const rows = await db
    .select({
      id: users.id,
      username: users.username,
      avatar: users.avatar,
    })
    .from(users)
    .where(inArray(users.id, [...new Set(userIds)]));

  return new Map(rows.map((row) => [row.id, { username: row.username ?? null, avatar: row.avatar ?? null }]));
}

async function loadCollectionCoverImagesMap(collectionIds: string[]) {
  if (!db || collectionIds.length === 0) return new Map<string, string | null>();

  const rows = await db
    .select({
      collectionId: drinkCollectionItems.collectionId,
      drinkSlug: drinkCollectionItems.drinkSlug,
      addedAt: drinkCollectionItems.addedAt,
    })
    .from(drinkCollectionItems)
    .where(inArray(drinkCollectionItems.collectionId, [...new Set(collectionIds)]))
    .orderBy(asc(drinkCollectionItems.collectionId), asc(drinkCollectionItems.addedAt));

  const firstDrinkByCollectionId = new Map<string, string>();
  for (const row of rows) {
    if (!firstDrinkByCollectionId.has(row.collectionId)) {
      firstDrinkByCollectionId.set(row.collectionId, row.drinkSlug);
    }
  }

  const detailsBySlug = await resolveDrinkDetailsMapBySlugs([...firstDrinkByCollectionId.values()]);
  const coverImages = new Map<string, string | null>();

  for (const [collectionId, drinkSlug] of firstDrinkByCollectionId.entries()) {
    coverImages.set(collectionId, detailsBySlug.get(drinkSlug)?.image ?? null);
  }

  return coverImages;
}

async function loadPurchasedCollectionsForUser(userId: string) {
  if (!db) {
    throw new Error("Database unavailable");
  }

  const rows = await db
    .select({
      purchaseId: drinkCollectionPurchases.id,
      collectionId: drinkCollectionPurchases.collectionId,
      purchaseStatus: drinkCollectionPurchases.status,
      purchaseStatusReason: drinkCollectionPurchases.statusReason,
      accessRevokedAt: drinkCollectionPurchases.accessRevokedAt,
      purchasedAt: drinkCollectionPurchases.createdAt,
      collectionName: drinkCollections.name,
      collectionDescription: drinkCollections.description,
      collectionIsPublic: drinkCollections.isPublic,
      collectionIsPremium: drinkCollections.isPremium,
      collectionPriceCents: drinkCollections.priceCents,
      collectionUpdatedAt: drinkCollections.updatedAt,
      collectionUserId: drinkCollections.userId,
    })
    .from(drinkCollectionPurchases)
    .innerJoin(drinkCollections, eq(drinkCollectionPurchases.collectionId, drinkCollections.id))
    .where(eq(drinkCollectionPurchases.userId, userId))
    .orderBy(desc(drinkCollectionPurchases.createdAt));

  const creatorMap = await loadCollectionCreatorsMap(rows.map((row) => row.collectionUserId));
  const coverImagesMap = await loadCollectionCoverImagesMap(rows.map((row) => row.collectionId));

  return rows.map((row) => {
    const creator = creatorMap.get(row.collectionUserId);
    return {
      purchaseId: row.purchaseId,
      collectionId: row.collectionId,
      status: row.purchaseStatus,
      statusReason: row.purchaseStatusReason,
      accessRevokedAt: row.accessRevokedAt,
      name: row.collectionName,
      description: row.collectionDescription,
      isPublic: row.collectionIsPublic,
      isPremium: row.collectionIsPremium,
      priceCents: row.collectionPriceCents,
      purchasedAt: row.purchasedAt,
      updatedAt: row.collectionUpdatedAt,
      userId: row.collectionUserId,
      creatorUsername: creator?.username ?? null,
      creatorAvatar: creator?.avatar ?? null,
      coverImage: coverImagesMap.get(row.collectionId) ?? null,
      route: `/drinks/collections/${row.collectionId}`,
    };
  });
}

async function loadWishlistedCollectionsForUser(userId: string) {
  if (!db) {
    throw new Error("Database unavailable");
  }

  const rows = await db
    .select({
      wishlistId: drinkCollectionWishlists.id,
      wishlistedAt: drinkCollectionWishlists.createdAt,
      collectionId: drinkCollections.id,
      collectionName: drinkCollections.name,
      collectionDescription: drinkCollections.description,
      collectionIsPublic: drinkCollections.isPublic,
      collectionAccessType: drinkCollections.accessType,
      collectionIsPremium: drinkCollections.isPremium,
      collectionPriceCents: drinkCollections.priceCents,
      collectionUpdatedAt: drinkCollections.updatedAt,
      collectionUserId: drinkCollections.userId,
    })
    .from(drinkCollectionWishlists)
    .innerJoin(drinkCollections, eq(drinkCollectionWishlists.collectionId, drinkCollections.id))
    .where(eq(drinkCollectionWishlists.userId, userId))
    .orderBy(desc(drinkCollectionWishlists.createdAt));

  const ownedCollectionIds = await loadOwnedCollectionIdsForUser(userId);
  const filteredRows = rows.filter((row) => (
    deriveCollectionAccessType({
      accessType: row.collectionAccessType,
      isPremium: row.collectionIsPremium,
      fallback: row.collectionIsPremium ? "premium_purchase" : "public",
    }) === "premium_purchase"
  ) && !ownedCollectionIds.has(row.collectionId));
  const creatorMap = await loadCollectionCreatorsMap(filteredRows.map((row) => row.collectionUserId));
  const coverImagesMap = await loadCollectionCoverImagesMap(filteredRows.map((row) => row.collectionId));
  const activePromotionPricingMap = await loadActivePromotionPricingMap(
    filteredRows.map((row) => ({
      id: row.collectionId,
      userId: row.collectionUserId,
      name: row.collectionName,
      description: row.collectionDescription,
      isPublic: row.collectionIsPublic,
      accessType: row.collectionAccessType,
      isPremium: row.collectionIsPremium,
      priceCents: row.collectionPriceCents,
      updatedAt: row.collectionUpdatedAt,
      createdAt: row.wishlistedAt,
    } as typeof drinkCollections.$inferSelect)),
  );
  const wishlistCountsByCollectionId = await loadWishlistCountsForCollections(filteredRows.map((row) => row.collectionId));

  return filteredRows.map((row) => {
    const creator = creatorMap.get(row.collectionUserId);
    const activePromoPricing = activePromotionPricingMap.get(row.collectionId) ?? null;
    return {
      wishlistId: row.wishlistId,
      wishlistedAt: row.wishlistedAt.toISOString(),
      collectionId: row.collectionId,
      name: row.collectionName,
      description: row.collectionDescription,
      isPublic: row.collectionIsPublic,
      isPremium: row.collectionIsPremium,
      priceCents: Number(row.collectionPriceCents ?? 0),
      updatedAt: row.collectionUpdatedAt.toISOString(),
      userId: row.collectionUserId,
      creatorUsername: creator?.username ?? null,
      creatorAvatar: creator?.avatar ?? null,
      coverImage: coverImagesMap.get(row.collectionId) ?? null,
      route: `/drinks/collections/${row.collectionId}`,
      isWishlisted: true,
      ownedByViewer: false,
      wishlistCount: Number(wishlistCountsByCollectionId.get(row.collectionId) ?? 0),
      activePromoPricing,
      promoAlertReady: Boolean(activePromoPricing),
    };
  });
}

async function loadCreatorMembershipDashboardSummary(creatorUserId: string) {
  if (!db) throw new Error("Database unavailable");
  const plan = await loadCreatorMembershipPlanByCreatorId(creatorUserId);
  const memberRows = await db.select().from(creatorMemberships).where(eq(creatorMemberships.creatorUserId, creatorUserId));
  const ledgerRows = await db.select().from(creatorMembershipSalesLedger).where(eq(creatorMembershipSalesLedger.creatorUserId, creatorUserId));
  const activeMembers = memberRows.filter((row) => isCreatorMembershipActiveRecord(row));
  const canceledMembers = memberRows.filter((row) => row.status === "canceled");
  const expiredMembers = memberRows.filter((row) => row.status === "expired" || (row.endsAt && row.endsAt <= new Date()));
  const grossRevenueCents = ledgerRows
    .filter((row) => row.status === "completed")
    .reduce((sum, row) => sum + Number(row.grossAmountCents ?? 0), 0);

  return {
    plan: serializeMembershipPlan(plan),
    stats: {
      activeMembers: activeMembers.length,
      canceledMembers: canceledMembers.length,
      expiredMembers: expiredMembers.length,
      totalMembers: memberRows.length,
      grossRevenueCents,
    },
  };
}

async function loadMembershipsForUser(userId: string) {
  if (!db) throw new Error("Database unavailable");
  const memberships = await db.select().from(creatorMemberships).where(eq(creatorMemberships.userId, userId)).orderBy(desc(creatorMemberships.updatedAt));
  const creatorIds = [...new Set(memberships.map((membership) => membership.creatorUserId))];
  const planIds = [...new Set(memberships.map((membership) => membership.planId))];
  const [creatorMap, planRows, creatorCollections] = await Promise.all([
    loadCollectionCreatorsMap(creatorIds),
    planIds.length ? db.select().from(creatorMembershipPlans).where(inArray(creatorMembershipPlans.id, planIds)) : Promise.resolve([]),
    creatorIds.length
      ? db.select().from(drinkCollections).where(inArray(drinkCollections.userId, creatorIds))
      : Promise.resolve([]),
  ]);
  const planMap = new Map(planRows.map((row) => [row.id, row]));
  const collectionsByCreatorId = new Map<string, Array<typeof drinkCollections.$inferSelect>>();
  for (const collection of normalizeCollectionRowsForResponse(creatorCollections)) {
    const current = collectionsByCreatorId.get(collection.userId) ?? [];
    current.push(collection);
    collectionsByCreatorId.set(collection.userId, current);
  }

  return memberships.map((membership) => {
    const creator = creatorMap.get(membership.creatorUserId);
    const plan = planMap.get(membership.planId) ?? null;
    const serializedMembership = serializeMembershipRecord(membership);
    const collections = (serializedMembership?.accessActive
      ? (collectionsByCreatorId.get(membership.creatorUserId) ?? [])
      : [])
      .filter((collection) => collection.accessType === "membership_only")
      .map((collection) => ({
        id: collection.id,
        name: collection.name,
        route: `/drinks/collections/${collection.id}`,
        priceCents: Number(collection.priceCents ?? 0),
        isPublic: Boolean(collection.isPublic),
        accessType: collection.accessType,
      }));
    return {
      membership: serializedMembership,
      plan: serializeMembershipPlan(plan),
      creator: {
        userId: membership.creatorUserId,
        username: creator?.username ?? null,
        avatar: creator?.avatar ?? null,
        route: `/drinks/creator/${membership.creatorUserId}`,
      },
      accessibleCollections: collections,
    };
  });
}

async function loadBuyerCollectionOrders(userId: string) {
  if (!db) {
    throw new Error("Database unavailable");
  }

  const purchaseRows = await db
    .select({
      purchaseId: drinkCollectionPurchases.id,
      collectionId: drinkCollectionPurchases.collectionId,
      purchaseStatus: drinkCollectionPurchases.status,
      purchaseStatusReason: drinkCollectionPurchases.statusReason,
      accessRevokedAt: drinkCollectionPurchases.accessRevokedAt,
      purchasedAt: drinkCollectionPurchases.createdAt,
      updatedAt: drinkCollectionPurchases.updatedAt,
      collectionName: drinkCollections.name,
      collectionUserId: drinkCollections.userId,
      ledgerId: drinkCollectionSalesLedger.id,
      grossAmountCents: drinkCollectionSalesLedger.grossAmountCents,
      currencyCode: drinkCollectionSalesLedger.currencyCode,
      refundedAt: drinkCollectionSalesLedger.refundedAt,
    })
    .from(drinkCollectionPurchases)
    .innerJoin(drinkCollections, eq(drinkCollectionPurchases.collectionId, drinkCollections.id))
    .leftJoin(drinkCollectionSalesLedger, eq(drinkCollectionSalesLedger.purchaseId, drinkCollectionPurchases.id))
    .where(eq(drinkCollectionPurchases.userId, userId))
    .orderBy(desc(drinkCollectionPurchases.createdAt));

  const activeOwnedCollectionIds = new Set(
    purchaseRows
      .filter((row) => row.purchaseStatus === "completed")
      .map((row) => row.collectionId),
  );
  const creatorMap = await loadCollectionCreatorsMap(purchaseRows.map((row) => row.collectionUserId));

  const pendingCheckoutRows = await db
    .select({
      checkoutSessionId: drinkCollectionCheckoutSessions.id,
      collectionId: drinkCollectionCheckoutSessions.collectionId,
      status: drinkCollectionCheckoutSessions.status,
      statusReason: drinkCollectionCheckoutSessions.failureReason,
      amountCents: drinkCollectionCheckoutSessions.amountCents,
      currencyCode: drinkCollectionCheckoutSessions.currencyCode,
      purchasedAt: drinkCollectionCheckoutSessions.verifiedAt,
      createdAt: drinkCollectionCheckoutSessions.createdAt,
      refundedAt: drinkCollectionCheckoutSessions.refundedAt,
      accessRevokedAt: drinkCollectionCheckoutSessions.accessRevokedAt,
      squareOrderId: drinkCollectionCheckoutSessions.squareOrderId,
      collectionName: drinkCollections.name,
      collectionUserId: drinkCollections.userId,
    })
    .from(drinkCollectionCheckoutSessions)
    .innerJoin(drinkCollections, eq(drinkCollectionCheckoutSessions.collectionId, drinkCollections.id))
    .where(
      and(
        eq(drinkCollectionCheckoutSessions.userId, userId),
        eq(drinkCollectionCheckoutSessions.status, "pending"),
      ),
    )
    .orderBy(desc(drinkCollectionCheckoutSessions.createdAt));

  const pendingCreators = await loadCollectionCreatorsMap(
    pendingCheckoutRows
      .map((row) => row.collectionUserId)
      .filter((creatorUserId) => !creatorMap.has(creatorUserId)),
  );

  const orders = [
    ...purchaseRows.map((row) => {
      const creator = creatorMap.get(row.collectionUserId);
      const refundedAt = row.refundedAt ?? row.accessRevokedAt ?? null;
      return {
        orderId: row.ledgerId ?? row.purchaseId,
        purchaseId: row.purchaseId,
        collectionId: row.collectionId,
        collectionName: row.collectionName,
        collectionRoute: `/drinks/collections/${row.collectionId}`,
        creatorUserId: row.collectionUserId,
        creatorUsername: creator?.username ?? null,
        grossAmountCents: Number(row.grossAmountCents ?? 0),
        currency: normalizeSquareCurrencyCode(row.currencyCode ?? squareConfig.currency ?? "USD"),
        status: row.purchaseStatus,
        statusReason: row.purchaseStatusReason,
        purchasedAt: (row.purchasedAt ?? row.updatedAt).toISOString(),
        refundedAt: refundedAt ? refundedAt.toISOString() : null,
        owned: row.purchaseStatus === "completed",
      };
    }),
    ...pendingCheckoutRows
      .filter((row) => !activeOwnedCollectionIds.has(row.collectionId))
      .map((row) => {
        const creator = creatorMap.get(row.collectionUserId) ?? pendingCreators.get(row.collectionUserId);
        const purchasedAt = row.purchasedAt ?? row.createdAt;
        const refundedAt = row.refundedAt ?? row.accessRevokedAt ?? null;
        return {
          orderId: row.squareOrderId ?? row.checkoutSessionId,
          purchaseId: null,
          collectionId: row.collectionId,
          collectionName: row.collectionName,
          collectionRoute: `/drinks/collections/${row.collectionId}`,
          creatorUserId: row.collectionUserId,
          creatorUsername: creator?.username ?? null,
          grossAmountCents: Number(row.amountCents ?? 0),
          currency: normalizeSquareCurrencyCode(row.currencyCode ?? squareConfig.currency ?? "USD"),
          status: row.status === "pending" ? "pending" : row.status,
          statusReason: row.statusReason,
          purchasedAt: purchasedAt.toISOString(),
          refundedAt: refundedAt ? refundedAt.toISOString() : null,
          owned: false,
        };
      }),
  ];

  return orders.sort((a, b) => new Date(b.purchasedAt).getTime() - new Date(a.purchasedAt).getTime());
}

async function loadCreatorCollectionOrders(userId: string) {
  if (!db) {
    throw new Error("Database unavailable");
  }

  const collectionRows = await db
    .select({
      id: drinkCollections.id,
      name: drinkCollections.name,
      userId: drinkCollections.userId,
    })
    .from(drinkCollections)
    .where(and(eq(drinkCollections.userId, userId), eq(drinkCollections.accessType, "premium_purchase")));

  if (collectionRows.length === 0) {
    return [];
  }

  const collectionIds = collectionRows.map((row) => row.id);
  const collectionNameMap = new Map(collectionRows.map((row) => [row.id, row.name]));

  const ledgerRows = await db
    .select({
      ledgerId: drinkCollectionSalesLedger.id,
      purchaseId: drinkCollectionSalesLedger.purchaseId,
      checkoutSessionId: drinkCollectionSalesLedger.checkoutSessionId,
      collectionId: drinkCollectionSalesLedger.collectionId,
      promotionCode: drinkCollectionSalesLedger.promotionCode,
      originalAmountCents: drinkCollectionSalesLedger.originalAmountCents,
      discountAmountCents: drinkCollectionSalesLedger.discountAmountCents,
      grossAmountCents: drinkCollectionSalesLedger.grossAmountCents,
      currencyCode: drinkCollectionSalesLedger.currencyCode,
      status: drinkCollectionSalesLedger.status,
      statusReason: drinkCollectionSalesLedger.statusReason,
      refundedAt: drinkCollectionSalesLedger.refundedAt,
      purchasedAt: drinkCollectionSalesLedger.createdAt,
    })
    .from(drinkCollectionSalesLedger)
    .where(inArray(drinkCollectionSalesLedger.collectionId, collectionIds))
    .orderBy(desc(drinkCollectionSalesLedger.createdAt));

  return ledgerRows.map((row, index) => ({
    orderId: row.ledgerId,
    purchaseId: row.purchaseId,
    checkoutSessionId: row.checkoutSessionId,
    collectionId: row.collectionId,
    collectionName: collectionNameMap.get(row.collectionId) ?? "Premium collection",
    collectionRoute: `/drinks/collections/${row.collectionId}`,
    promotionCode: row.promotionCode ?? null,
    originalAmountCents: row.originalAmountCents === null ? null : Number(row.originalAmountCents ?? 0),
    discountAmountCents: row.discountAmountCents === null ? null : Number(row.discountAmountCents ?? 0),
    grossAmountCents: Number(row.grossAmountCents ?? 0),
    currency: normalizeSquareCurrencyCode(row.currencyCode ?? squareConfig.currency ?? "USD"),
    status: row.status,
    statusReason: row.statusReason,
    purchasedAt: row.purchasedAt.toISOString(),
    refundedAt: row.refundedAt ? row.refundedAt.toISOString() : null,
    buyerLabel: `Private buyer ${index + 1}`,
    buyerVisibility: "private" as const,
  }));
}

async function loadRecentCollectionReviewsForCreator(userId: string, limit = 5) {
  if (!db) return [] as Array<HydratedDrinkCollectionReview & { collectionName: string; collectionRoute: string }>;

  const rows = await db
    .select({
      id: drinkCollectionReviews.id,
      userId: drinkCollectionReviews.userId,
      collectionId: drinkCollectionReviews.collectionId,
      rating: drinkCollectionReviews.rating,
      title: drinkCollectionReviews.title,
      body: drinkCollectionReviews.body,
      isVerifiedPurchase: drinkCollectionReviews.isVerifiedPurchase,
      createdAt: drinkCollectionReviews.createdAt,
      updatedAt: drinkCollectionReviews.updatedAt,
      username: users.username,
      displayName: users.displayName,
      avatar: users.avatar,
      collectionName: drinkCollections.name,
    })
    .from(drinkCollectionReviews)
    .innerJoin(drinkCollections, eq(drinkCollectionReviews.collectionId, drinkCollections.id))
    .innerJoin(users, eq(drinkCollectionReviews.userId, users.id))
    .where(and(eq(drinkCollections.userId, userId), eq(drinkCollections.accessType, "premium_purchase")))
    .orderBy(desc(drinkCollectionReviews.createdAt))
    .limit(limit);

  return rows.map((row) => ({
    id: row.id,
    userId: row.userId,
    collectionId: row.collectionId,
    rating: Number(row.rating ?? 0),
    title: row.title ?? null,
    body: row.body ?? null,
    isVerifiedPurchase: Boolean(row.isVerifiedPurchase),
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    collectionName: row.collectionName,
    collectionRoute: `/drinks/collections/${row.collectionId}`,
    user: {
      username: row.username ?? null,
      displayName: row.displayName ?? null,
      avatar: row.avatar ?? null,
    },
  }));
}

async function loadCreatorCollectionSalesSummary(userId: string) {
  if (!db) {
    throw new Error("Database unavailable");
  }

  const premiumCollections = await db
    .select({
      id: drinkCollections.id,
      name: drinkCollections.name,
      description: drinkCollections.description,
      priceCents: drinkCollections.priceCents,
      updatedAt: drinkCollections.updatedAt,
      isPublic: drinkCollections.isPublic,
      createdAt: drinkCollections.createdAt,
    })
    .from(drinkCollections)
    .where(and(eq(drinkCollections.userId, userId), eq(drinkCollections.accessType, "premium_purchase")))
    .orderBy(desc(drinkCollections.updatedAt));

  if (premiumCollections.length === 0) {
    return {
      totals: {
        premiumCollections: 0,
        purchases: 0,
        grossRevenueCents: 0,
        refundedSalesCount: 0,
        refundedRevenueCents: 0,
        totalWishlistInterest: 0,
      },
      reviewInsights: {
        averageRating: 0,
        totalReviews: 0,
        recentReviews: [] as Array<HydratedDrinkCollectionReview & { collectionName: string; collectionRoute: string }>,
      },
      collections: [] as Array<{
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
      }>,
    };
  }

  const collectionIds = premiumCollections.map((collection) => collection.id);
  const [coverImagesMap, wishlistCountsByCollectionId, reviewSummaryByCollectionId, recentReviews] = await Promise.all([
    loadCollectionCoverImagesMap(collectionIds),
    loadWishlistCountsForCollections(collectionIds),
    loadCollectionReviewSummaryMap(collectionIds),
    loadRecentCollectionReviewsForCreator(userId),
  ]);

  const ledgerRows = await db
    .select({
      id: drinkCollectionSalesLedger.id,
      collectionId: drinkCollectionSalesLedger.collectionId,
      grossAmountCents: drinkCollectionSalesLedger.grossAmountCents,
      status: drinkCollectionSalesLedger.status,
      createdAt: drinkCollectionSalesLedger.createdAt,
    })
    .from(drinkCollectionSalesLedger)
    .where(inArray(drinkCollectionSalesLedger.collectionId, collectionIds))
    .orderBy(desc(drinkCollectionSalesLedger.createdAt));

  const salesByCollectionId = new Map<string, {
    purchases: number;
    grossRevenueCents: number;
    refundedSalesCount: number;
    refundedRevenueCents: number;
    lastPurchasedAt: Date | null;
  }>();

  for (const entry of ledgerRows) {
    const existing = salesByCollectionId.get(entry.collectionId) ?? {
      purchases: 0,
      grossRevenueCents: 0,
      refundedSalesCount: 0,
      refundedRevenueCents: 0,
      lastPurchasedAt: null,
    };

    if (entry.status === "completed") {
      existing.purchases += 1;
      existing.grossRevenueCents += Number(entry.grossAmountCents ?? 0);
      if (!existing.lastPurchasedAt || entry.createdAt > existing.lastPurchasedAt) {
        existing.lastPurchasedAt = entry.createdAt;
      }
    } else if (entry.status === "refunded" || entry.status === "refunded_pending" || entry.status === "revoked") {
      existing.refundedSalesCount += 1;
      existing.refundedRevenueCents += Number(entry.grossAmountCents ?? 0);
    }

    salesByCollectionId.set(entry.collectionId, existing);
  }

  const collections = premiumCollections.map((collection) => {
    const stats = salesByCollectionId.get(collection.id) ?? {
      purchases: 0,
      grossRevenueCents: 0,
      refundedSalesCount: 0,
      refundedRevenueCents: 0,
      lastPurchasedAt: null as Date | null,
    };
    const reviewSummary = reviewSummaryByCollectionId.get(collection.id) ?? normalizeCollectionReviewSummary();

    return {
      id: collection.id,
      name: collection.name,
      description: collection.description,
      isPublic: collection.isPublic,
      priceCents: Number(collection.priceCents ?? 0),
      purchases: stats.purchases,
      grossRevenueCents: stats.grossRevenueCents,
      refundedSalesCount: stats.refundedSalesCount,
      refundedRevenueCents: stats.refundedRevenueCents,
      wishlistCount: Number(wishlistCountsByCollectionId.get(collection.id) ?? 0),
      averageRating: reviewSummary.averageRating,
      reviewCount: reviewSummary.reviewCount,
      lastPurchasedAt: stats.lastPurchasedAt ? stats.lastPurchasedAt.toISOString() : null,
      updatedAt: collection.updatedAt.toISOString(),
      route: `/drinks/collections/${collection.id}`,
      coverImage: coverImagesMap.get(collection.id) ?? null,
    };
  });

  const totalReviews = collections.reduce((sum, collection) => sum + collection.reviewCount, 0);
  const weightedRatingTotal = collections.reduce((sum, collection) => sum + (collection.averageRating * collection.reviewCount), 0);

  return {
    totals: {
      premiumCollections: premiumCollections.length,
      purchases: collections.reduce((sum, collection) => sum + collection.purchases, 0),
      grossRevenueCents: collections.reduce((sum, collection) => sum + collection.grossRevenueCents, 0),
      refundedSalesCount: collections.reduce((sum, collection) => sum + collection.refundedSalesCount, 0),
      refundedRevenueCents: collections.reduce((sum, collection) => sum + collection.refundedRevenueCents, 0),
      totalWishlistInterest: collections.reduce((sum, collection) => sum + collection.wishlistCount, 0),
    },
    reviewInsights: {
      averageRating: totalReviews > 0 ? Math.round((weightedRatingTotal / totalReviews) * 10) / 10 : 0,
      totalReviews,
      recentReviews,
    },
    collections,
  };
}

async function loadCreatorCollectionFinanceSummary(userId: string) {
  if (!db) {
    throw new Error("Database unavailable");
  }

  const premiumCollections = await db
    .select({
      id: drinkCollections.id,
    })
    .from(drinkCollections)
    .where(and(eq(drinkCollections.userId, userId), eq(drinkCollections.accessType, "premium_purchase")));

  const recentSales = await db
    .select({
      id: drinkCollectionSalesLedger.id,
      collectionId: drinkCollectionSalesLedger.collectionId,
      checkoutSessionId: drinkCollectionSalesLedger.checkoutSessionId,
      purchaseId: drinkCollectionSalesLedger.purchaseId,
      collectionName: drinkCollections.name,
      promotionCode: drinkCollectionSalesLedger.promotionCode,
      originalAmountCents: drinkCollectionSalesLedger.originalAmountCents,
      discountAmountCents: drinkCollectionSalesLedger.discountAmountCents,
      grossAmountCents: drinkCollectionSalesLedger.grossAmountCents,
      platformFeeCents: drinkCollectionSalesLedger.platformFeeCents,
      creatorShareCents: drinkCollectionSalesLedger.creatorShareCents,
      currencyCode: drinkCollectionSalesLedger.currencyCode,
      status: drinkCollectionSalesLedger.status,
      statusReason: drinkCollectionSalesLedger.statusReason,
      refundedAt: drinkCollectionSalesLedger.refundedAt,
      createdAt: drinkCollectionSalesLedger.createdAt,
    })
    .from(drinkCollectionSalesLedger)
    .innerJoin(drinkCollections, eq(drinkCollectionSalesLedger.collectionId, drinkCollections.id))
    .where(eq(drinkCollectionSalesLedger.userId, userId))
    .orderBy(desc(drinkCollectionSalesLedger.createdAt))
    .limit(10);

  const totals = recentSales.filter((sale) => sale.status === "completed").reduce((acc, sale) => {
    acc.grossSalesCents += Number(sale.grossAmountCents ?? 0);
    acc.platformFeesCents += Number(sale.platformFeeCents ?? 0);
    acc.estimatedCreatorShareCents += Number(sale.creatorShareCents ?? 0);
    return acc;
  }, {
    grossSalesCents: 0,
    platformFeesCents: 0,
    estimatedCreatorShareCents: 0,
  });

  const completedCountRows = await db
    .select({
      count: sql<number>`count(*)::int`,
      grossSalesCents: sql<number>`coalesce(sum(${drinkCollectionSalesLedger.grossAmountCents}), 0)::int`,
      platformFeesCents: sql<number>`coalesce(sum(${drinkCollectionSalesLedger.platformFeeCents}), 0)::int`,
      estimatedCreatorShareCents: sql<number>`coalesce(sum(${drinkCollectionSalesLedger.creatorShareCents}), 0)::int`,
    })
    .from(drinkCollectionSalesLedger)
    .where(
      and(
        eq(drinkCollectionSalesLedger.userId, userId),
        eq(drinkCollectionSalesLedger.status, "completed"),
      ),
    );

  const aggregate = completedCountRows[0] ?? {
    count: 0,
    grossSalesCents: totals.grossSalesCents,
    platformFeesCents: totals.platformFeesCents,
    estimatedCreatorShareCents: totals.estimatedCreatorShareCents,
  };

  const refundedCountRows = await db
    .select({
      count: sql<number>`count(*)::int`,
      refundedSalesCents: sql<number>`coalesce(sum(${drinkCollectionSalesLedger.grossAmountCents}), 0)::int`,
    })
    .from(drinkCollectionSalesLedger)
    .where(
      and(
        eq(drinkCollectionSalesLedger.userId, userId),
        inArray(drinkCollectionSalesLedger.status, ["refunded", "refunded_pending", "revoked"]),
      ),
    );

  const refundedAggregate = refundedCountRows[0] ?? {
    count: 0,
    refundedSalesCents: 0,
  };

  return {
    summary: {
      grossSalesCents: Number(aggregate.grossSalesCents ?? 0),
      platformFeesCents: Number(aggregate.platformFeesCents ?? 0),
      estimatedCreatorShareCents: Number(aggregate.estimatedCreatorShareCents ?? 0),
      totalPremiumSalesCount: Number(aggregate.count ?? 0),
      refundedSalesCount: Number(refundedAggregate.count ?? 0),
      refundedSalesCents: Number(refundedAggregate.refundedSalesCents ?? 0),
      premiumCollectionsCount: premiumCollections.length,
      estimates: {
        usesEstimatedShareFormula: true,
        platformFeeBps: PREMIUM_COLLECTION_PLATFORM_FEE_BPS,
        creatorShareBps: PREMIUM_COLLECTION_CREATOR_SHARE_BPS,
      },
    },
    recentSales: recentSales.map((sale) => ({
      id: sale.id,
      collectionId: sale.collectionId,
      collectionName: sale.collectionName,
      purchaseId: sale.purchaseId,
      checkoutSessionId: sale.checkoutSessionId,
      promotionCode: sale.promotionCode ?? null,
      originalAmountCents: sale.originalAmountCents === null ? null : Number(sale.originalAmountCents ?? 0),
      discountAmountCents: sale.discountAmountCents === null ? null : Number(sale.discountAmountCents ?? 0),
      grossAmountCents: Number(sale.grossAmountCents ?? 0),
      platformFeeCents: Number(sale.platformFeeCents ?? 0),
      creatorShareCents: Number(sale.creatorShareCents ?? 0),
      currencyCode: normalizeSquareCurrencyCode(sale.currencyCode),
      status: sale.status,
      statusReason: sale.statusReason,
      refundedAt: sale.refundedAt ? sale.refundedAt.toISOString() : null,
      createdAt: sale.createdAt.toISOString(),
      route: `/drinks/collections/${sale.collectionId}`,
    })),
    reportingNotes: [
      "Finance totals only include ledger rows that are still in completed status, using the actual paid amount captured by Square.",
      "Refunded, refund-pending, and revoked Premium Purchase collection sales are separated from completed revenue totals and do not keep access active.",
      `Estimated platform fees and creator share use an internal ${PREMIUM_COLLECTION_PLATFORM_FEE_BPS / 100}% / ${PREMIUM_COLLECTION_CREATOR_SHARE_BPS / 100}% split for reporting readiness only.`,
      "No payouts are sent automatically yet. Square checkout captures sales, but creator transfers are not implemented in this dashboard.",
    ],
  };
}

async function trackCollectionEvent(input: {
  collectionId: string;
  eventType: DrinkCollectionEventType;
  userId?: string | null;
}) {
  if (!db || !TRACKABLE_COLLECTION_EVENTS.has(input.eventType)) return;

  await db.insert(drinkCollectionEvents).values({
    collectionId: input.collectionId,
    eventType: input.eventType,
    userId: input.userId ?? null,
  });
}

async function shouldTrackCollectionView(collectionId: string, viewerUserId: string | null | undefined) {
  if (!db) return false;
  if (!viewerUserId) return true;

  const rows = await db
    .select({
      userId: drinkCollections.userId,
    })
    .from(drinkCollections)
    .where(eq(drinkCollections.id, collectionId))
    .limit(1);

  const collection = rows[0];
  if (!collection) return false;
  if (collection.userId === viewerUserId) return false;

  const ownedCollectionIds = await loadOwnedCollectionIdsForUser(viewerUserId);
  return !ownedCollectionIds.has(collectionId);
}

async function loadCreatorCollectionConversionAnalytics(userId: string) {
  if (!db) {
    throw new Error("Database unavailable");
  }

  const premiumCollections = await db
    .select({
      id: drinkCollections.id,
      name: drinkCollections.name,
      isPremium: drinkCollections.isPremium,
      priceCents: drinkCollections.priceCents,
      isPublic: drinkCollections.isPublic,
      updatedAt: drinkCollections.updatedAt,
    })
    .from(drinkCollections)
    .where(and(eq(drinkCollections.userId, userId), eq(drinkCollections.accessType, "premium_purchase")))
    .orderBy(desc(drinkCollections.updatedAt));

  if (premiumCollections.length === 0) {
    return {
      summary: {
        premiumCollectionsCount: 0,
        totalCollectionViews: 0,
        totalCheckoutStarts: 0,
        totalCompletedPurchases: 0,
        totalRefundedPurchases: 0,
        grossSalesCents: 0,
        totalWishlistInterest: 0,
        overallConversionRate: null as number | null,
      },
      collections: [] as Array<{
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
      }>,
      reportingNotes: [
        "Collection views use tracked Premium Purchase collection detail-page views from non-owner visitors and can include repeat visits.",
        "Checkout starts count each Square checkout session creation, including retries.",
        "Completed purchases and refunded lifecycle counts come from the same Premium Purchase collection ownership and sales records used in finance reporting.",
      ],
    };
  }

  const collectionIds = premiumCollections.map((collection) => collection.id);

  const [viewRows, checkoutStartRows, purchaseRows, wishlistCountsByCollectionId] = await Promise.all([
    db
      .select({
        collectionId: drinkCollectionEvents.collectionId,
        viewsCount: sql<number>`count(*)::int`,
      })
      .from(drinkCollectionEvents)
      .where(
        and(
          inArray(drinkCollectionEvents.collectionId, collectionIds),
          eq(drinkCollectionEvents.eventType, "view"),
        ),
      )
      .groupBy(drinkCollectionEvents.collectionId),
    db
      .select({
        collectionId: drinkCollectionCheckoutSessions.collectionId,
        checkoutStartsCount: sql<number>`count(*)::int`,
      })
      .from(drinkCollectionCheckoutSessions)
      .where(inArray(drinkCollectionCheckoutSessions.collectionId, collectionIds))
      .groupBy(drinkCollectionCheckoutSessions.collectionId),
    db
      .select({
        collectionId: drinkCollectionSalesLedger.collectionId,
        completedPurchasesCount: sql<number>`count(*) filter (where ${drinkCollectionSalesLedger.status} = 'completed')::int`,
        refundedCount: sql<number>`count(*) filter (where ${drinkCollectionSalesLedger.status} in ('refunded', 'refunded_pending', 'revoked'))::int`,
        grossSalesCents: sql<number>`coalesce(sum(case when ${drinkCollectionSalesLedger.status} = 'completed' then ${drinkCollectionSalesLedger.grossAmountCents} else 0 end), 0)::int`,
      })
      .from(drinkCollectionSalesLedger)
      .where(inArray(drinkCollectionSalesLedger.collectionId, collectionIds))
      .groupBy(drinkCollectionSalesLedger.collectionId),
    loadWishlistCountsForCollections(collectionIds),
  ]);

  const viewsByCollectionId = new Map(viewRows.map((row) => [row.collectionId, Number(row.viewsCount ?? 0)]));
  const checkoutStartsByCollectionId = new Map(checkoutStartRows.map((row) => [row.collectionId, Number(row.checkoutStartsCount ?? 0)]));
  const purchaseStatsByCollectionId = new Map(
    purchaseRows.map((row) => [
      row.collectionId,
      {
        completedPurchasesCount: Number(row.completedPurchasesCount ?? 0),
        refundedCount: Number(row.refundedCount ?? 0),
        grossSalesCents: Number(row.grossSalesCents ?? 0),
      },
    ]),
  );

  const collections = premiumCollections.map((collection) => {
    const viewsCount = viewsByCollectionId.get(collection.id) ?? 0;
    const checkoutStartsCount = checkoutStartsByCollectionId.get(collection.id) ?? 0;
    const purchaseStats = purchaseStatsByCollectionId.get(collection.id) ?? {
      completedPurchasesCount: 0,
      refundedCount: 0,
      grossSalesCents: 0,
    };
    const conversionRate = viewsCount > 0
      ? Number(((purchaseStats.completedPurchasesCount / viewsCount) * 100).toFixed(1))
      : null;

    return {
      collectionId: collection.id,
      collectionName: collection.name,
      isPremium: collection.isPremium,
      priceCents: Number(collection.priceCents ?? 0),
      viewsCount,
      checkoutStartsCount,
      completedPurchasesCount: purchaseStats.completedPurchasesCount,
      refundedCount: purchaseStats.refundedCount,
      grossSalesCents: purchaseStats.grossSalesCents,
      wishlistCount: Number(wishlistCountsByCollectionId.get(collection.id) ?? 0),
      conversionRate,
      route: `/drinks/collections/${collection.id}`,
      isPublic: collection.isPublic,
    };
  });

  const totalCollectionViews = collections.reduce((sum, collection) => sum + collection.viewsCount, 0);
  const totalCompletedPurchases = collections.reduce((sum, collection) => sum + collection.completedPurchasesCount, 0);

  return {
    summary: {
      premiumCollectionsCount: premiumCollections.length,
      totalCollectionViews,
      totalCheckoutStarts: collections.reduce((sum, collection) => sum + collection.checkoutStartsCount, 0),
      totalCompletedPurchases,
      totalRefundedPurchases: collections.reduce((sum, collection) => sum + collection.refundedCount, 0),
      grossSalesCents: collections.reduce((sum, collection) => sum + collection.grossSalesCents, 0),
      totalWishlistInterest: collections.reduce((sum, collection) => sum + collection.wishlistCount, 0),
      overallConversionRate: totalCollectionViews > 0
        ? Number(((totalCompletedPurchases / totalCollectionViews) * 100).toFixed(1))
        : null,
    },
    collections,
    reportingNotes: [
      "Collection views use tracked Premium Purchase collection detail-page views from non-owner visitors and can include repeat visits.",
      "Checkout starts count each Square checkout session creation, including retries.",
      "Completed purchases only include sales ledger rows still in completed status, so discounted checkouts flow through at the actual paid amount.",
      "Refunded count combines refunded, refund-pending, and revoked lifecycle states so analytics stay aligned with access and finance reporting.",
      "Wishlist interest is tracked separately from views, checkouts, purchases, and revenue so demand signals stay honest.",
    ],
  };
}

function featuredCollectionScore(collection: {
  itemsCount: number;
  updatedAt: Date;
}): number {
  const recencyHours = Math.max(0, (Date.now() - new Date(collection.updatedAt).getTime()) / (1000 * 60 * 60));
  const recencyPoints = Math.max(0, 240 - recencyHours);
  return Number(collection.itemsCount) * 100 + recencyPoints;
}

function normalizeRemixDiscoverySort(value: unknown): RemixDiscoverySort {
  if (typeof value !== "string") return "recent";
  const normalized = value.trim().toLowerCase();
  return normalized === "popular" ? "popular" : "recent";
}

function challengeIsActiveNow(challenge: typeof drinkChallenges.$inferSelect, now = new Date()): boolean {
  if (!challenge.isActive) return false;
  return challenge.startsAt.getTime() <= now.getTime() && challenge.endsAt.getTime() >= now.getTime();
}

const challengeSubmissionBodySchema = z.object({
  drinkSlug: z.string().trim().min(1).max(200).optional(),
});

const CHALLENGE_SEEDS: Array<{
  slug: string;
  title: string;
  description: string;
  theme: string;
  originalDrinkSlug?: string;
  challengeType: string;
  startsAt: Date;
  endsAt: Date;
  isActive: boolean;
}> = [
  {
    slug: "remix-a-tom-collins",
    title: "Remix a Tom Collins",
    description: "Put your spin on the classic Tom Collins. Keep it bright, balanced, and summer-ready.",
    theme: "Classic Remix",
    originalDrinkSlug: "tom-collins",
    challengeType: "remix",
    startsAt: new Date("2026-05-01T00:00:00.000Z"),
    endsAt: new Date("2026-06-15T23:59:59.000Z"),
    isActive: true,
  },
  {
    slug: "best-summer-spritz",
    title: "Best Summer Spritz",
    description: "Craft a light and refreshing spritz for hot weather hangouts.",
    theme: "Seasonal",
    challengeType: "open",
    startsAt: new Date("2026-05-15T00:00:00.000Z"),
    endsAt: new Date("2026-08-31T23:59:59.000Z"),
    isActive: true,
  },
  {
    slug: "zero-proof-week",
    title: "Zero-Proof Week",
    description: "Showcase alcohol-free creativity with mindful, flavor-forward builds.",
    theme: "Zero-Proof",
    challengeType: "zero-proof",
    startsAt: new Date("2026-06-01T00:00:00.000Z"),
    endsAt: new Date("2026-06-08T23:59:59.000Z"),
    isActive: true,
  },
];

async function seedDrinkChallengesIfEmpty() {
  if (!db) return;

  const existing = await db.select({ id: drinkChallenges.id }).from(drinkChallenges).limit(1);
  if (existing.length > 0) return;

  await db.insert(drinkChallenges).values(CHALLENGE_SEEDS);
}

type MostRemixedDrinkItem = {
  slug: string;
  name: string;
  image: string | null;
  route: string;
  sourceCategoryRoute: string | null;
  remixCount: number;
  views7d: number;
  lastRemixAt: Date | null;
};

function canonicalRouteForUserRecipe(recipe: { category: string; subcategory: string | null }): string {
  return `/drinks/${recipe.category}${recipe.subcategory ? `/${recipe.subcategory}` : ""}`;
}

function resolveMostRemixedTieBreaker(a: MostRemixedDrinkItem, b: MostRemixedDrinkItem): number {
  return (
    b.remixCount - a.remixCount ||
    b.views7d - a.views7d ||
    ((b.lastRemixAt?.getTime() ?? 0) - (a.lastRemixAt?.getTime() ?? 0)) ||
    a.slug.localeCompare(b.slug)
  );
}

type CreatorLeaderboardRow = {
  userId: string;
  username: string | null;
  avatar: string | null;
  creatorScore: number;
  totalCreated: number;
  totalViews7d: number;
  totalRemixesReceived: number;
  totalGroceryAdds: number;
  followerCount?: number;
  topDrink: {
    slug: string;
    name: string;
    image: string | null;
    route: string;
    score: number;
    remixesCount: number;
  } | null;
};

type TrendingCreatorRow = CreatorLeaderboardRow & {
  recentCreatedCount: number;
  publicRoute: string;
};

type CreatorActivityType = "view" | "grocery_add" | "remix" | "follow";

type CreatorActivityItem = {
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
};

type DrinkNotificationType = "view_summary" | "grocery_add" | "remix" | "follow";

type DrinkNotificationItem = {
  id: string;
  type: DrinkNotificationType;
  createdAt: string;
  title: string;
  subtitle: string;
  route: string | null;
  relatedDrinkSlug: string | null;
  relatedUsername: string | null;
};

type WhatsNewFeedType =
  | "remix"
  | "trending_drink"
  | "trending_creator"
  | "followed_creator_post"
  | "most_remixed_highlight";

type WhatsNewFeedItem = {
  type: WhatsNewFeedType;
  createdAt: string;
  title: string;
  subtitle: string;
  image: string | null;
  route: string;
  relatedUserId: string | null;
  relatedUsername: string | null;
  relatedDrinkSlug: string | null;
};

type CreatorBadgeDefinition = {
  id: string;
  title: string;
  description: string;
  icon: string;
  isPublic: boolean;
};

type CreatorBadgeProgress = {
  current: number;
  target: number;
  label: string;
};

const CREATOR_BADGE_DEFINITIONS: CreatorBadgeDefinition[] = [
  { id: "first-drink-published", title: "First Drink Published", description: "Published your first drink recipe.", icon: "🍹", isPublic: true },
  { id: "first-remix-created", title: "First Remix Created", description: "Shared your first remix.", icon: "🧪", isPublic: true },
  { id: "first-remix-received", title: "First Remix Received", description: "Another creator remixed one of your drinks.", icon: "🔁", isPublic: true },
  { id: "100-views", title: "100 Views", description: "Reached 100 total views across your drinks.", icon: "👀", isPublic: true },
  { id: "10-grocery-adds", title: "10 Grocery Adds", description: "Got added to grocery lists 10 times.", icon: "🛒", isPublic: true },
  { id: "5-followers", title: "5 Followers", description: "Reached 5 creator followers.", icon: "🤝", isPublic: true },
  { id: "trending-creator", title: "Trending Creator", description: "Ranked among the top trending drink creators this week.", icon: "📈", isPublic: true },
  { id: "top-creator", title: "Top Creator", description: "Ranked among the top creators on the leaderboard.", icon: "🏆", isPublic: true },
];

async function buildCreatorBadges(userId: string) {
  if (!db) {
    return {
      badges: CREATOR_BADGE_DEFINITIONS.map((badge) => ({ ...badge, isEarned: false, earnedAt: null, progress: null as CreatorBadgeProgress | null })),
    };
  }

  const [profile] = await db
    .select({ followersCount: users.followersCount })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  const recipes = await db
    .select({ slug: drinkRecipes.slug, createdAt: drinkRecipes.createdAt, remixedFromSlug: drinkRecipes.remixedFromSlug })
    .from(drinkRecipes)
    .where(eq(drinkRecipes.userId, userId))
    .orderBy(asc(drinkRecipes.createdAt));

  const recipeSlugs = recipes.map((recipe) => recipe.slug);

  const eventTotals = recipeSlugs.length > 0
    ? await db
        .select({
          totalViews: sql<number>`count(*) filter (where ${drinkEvents.eventType} = 'view')`,
          totalGroceryAdds: sql<number>`count(*) filter (where ${drinkEvents.eventType} = 'grocery_add')`,
        })
        .from(drinkEvents)
        .where(inArray(drinkEvents.slug, recipeSlugs))
    : [{ totalViews: 0, totalGroceryAdds: 0 }];

  const [firstRemixReceived] = recipeSlugs.length > 0
    ? await db
        .select({ createdAt: drinkRecipes.createdAt })
        .from(drinkRecipes)
        .where(inArray(drinkRecipes.remixedFromSlug, recipeSlugs))
        .orderBy(asc(drinkRecipes.createdAt))
        .limit(1)
    : [];

  const trendingRows = await getTrendingDrinkCreators(10);
  const leaderboardRows = await getDrinkCreatorLeaderboard(10);

  const firstDrink = recipes[0] ?? null;
  const firstRemixCreated = recipes.find((recipe) => Boolean(recipe.remixedFromSlug)) ?? null;
  const totalViews = Number(eventTotals[0]?.totalViews ?? 0);
  const totalGroceryAdds = Number(eventTotals[0]?.totalGroceryAdds ?? 0);
  const followerCount = Number(profile?.followersCount ?? 0);
  const isTrendingCreator = trendingRows.some((row) => row.userId === userId);
  const isTopCreator = leaderboardRows.some((row) => row.userId === userId);

  const earnedById = new Map<string, { isEarned: boolean; earnedAt: string | null; progress: CreatorBadgeProgress | null }>([
    ["first-drink-published", { isEarned: Boolean(firstDrink), earnedAt: firstDrink?.createdAt ? new Date(firstDrink.createdAt).toISOString() : null, progress: null }],
    ["first-remix-created", { isEarned: Boolean(firstRemixCreated), earnedAt: firstRemixCreated?.createdAt ? new Date(firstRemixCreated.createdAt).toISOString() : null, progress: null }],
    ["first-remix-received", { isEarned: Boolean(firstRemixReceived), earnedAt: firstRemixReceived?.createdAt ? new Date(firstRemixReceived.createdAt).toISOString() : null, progress: null }],
    ["100-views", { isEarned: totalViews >= 100, earnedAt: totalViews >= 100 ? new Date().toISOString() : null, progress: { current: totalViews, target: 100, label: "Views" } }],
    ["10-grocery-adds", { isEarned: totalGroceryAdds >= 10, earnedAt: totalGroceryAdds >= 10 ? new Date().toISOString() : null, progress: { current: totalGroceryAdds, target: 10, label: "Grocery adds" } }],
    ["5-followers", { isEarned: followerCount >= 5, earnedAt: followerCount >= 5 ? new Date().toISOString() : null, progress: { current: followerCount, target: 5, label: "Followers" } }],
    ["trending-creator", { isEarned: isTrendingCreator, earnedAt: isTrendingCreator ? new Date().toISOString() : null, progress: null }],
    ["top-creator", { isEarned: isTopCreator, earnedAt: isTopCreator ? new Date().toISOString() : null, progress: null }],
  ]);

  return {
    badges: CREATOR_BADGE_DEFINITIONS.map((definition) => {
      const computed = earnedById.get(definition.id);
      return {
        ...definition,
        isEarned: computed?.isEarned ?? false,
        earnedAt: computed?.earnedAt ?? null,
        progress: computed?.progress ?? null,
      };
    }),
  };
}

function toActivityDateKey(value: Date | null | undefined): string {
  if (!value) return "unknown";
  return value.toISOString().slice(0, 10);
}

function toReadableDay(value: Date | null | undefined): string {
  if (!value) return "recently";
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" }).format(value);
}

function buildDrinkNotificationFeed(userId: string, items: CreatorActivityItem[]): DrinkNotificationItem[] {
  return items.map((item) => {
    const baseId = [
      item.type,
      item.createdAt,
      item.targetDrinkSlug ?? "none",
      item.actorUserId ?? item.actorUsername ?? "none",
      item.count ?? "1",
    ].join(":");

    if (item.type === "remix") {
      return {
        id: `remix:${baseId}`,
        type: "remix",
        createdAt: item.createdAt,
        title: item.targetDrinkName
          ? `Your drink ${item.targetDrinkName} was remixed`
          : "One of your drinks was remixed",
        subtitle: item.actorUsername
          ? `@${item.actorUsername} published a remix based on your original drink.`
          : "A creator published a remix based on your original drink.",
        route: item.route,
        relatedDrinkSlug: item.targetDrinkSlug,
        relatedUsername: item.actorUsername,
      };
    }

    if (item.type === "grocery_add") {
      return {
        id: `grocery:${baseId}`,
        type: "grocery_add",
        createdAt: item.createdAt,
        title: item.targetDrinkName
          ? `Your drink ${item.targetDrinkName} got grocery adds`
          : "One of your drinks got grocery adds",
        subtitle: item.count && item.count > 0
          ? `${item.count} shopping-list add${item.count === 1 ? "" : "s"} ${item.uniqueActors && item.uniqueActors > 0 ? `from ${item.uniqueActors} creator${item.uniqueActors === 1 ? "" : "s"}` : ""}.`
          : "Creators added this drink to their shopping lists.",
        route: item.route,
        relatedDrinkSlug: item.targetDrinkSlug,
        relatedUsername: null,
      };
    }

    if (item.type === "follow") {
      return {
        id: `follow:${baseId}`,
        type: "follow",
        createdAt: item.createdAt,
        title: "You gained a new follower",
        subtitle: item.actorUsername
          ? `@${item.actorUsername} started following your creator profile.`
          : "A new creator started following your creator profile.",
        route: `/drinks/creator/${userId}`,
        relatedDrinkSlug: null,
        relatedUsername: item.actorUsername,
      };
    }

    return {
      id: `views:${baseId}`,
      type: "view_summary",
      createdAt: item.createdAt,
      title: item.targetDrinkName
        ? `Your drink ${item.targetDrinkName} got new views`
        : "One of your drinks got new views",
      subtitle: item.count && item.count > 0
        ? `${item.count} view${item.count === 1 ? "" : "s"}${item.uniqueActors && item.uniqueActors > 0 ? ` from ${item.uniqueActors} person${item.uniqueActors === 1 ? "" : "s"}` : ""}.`
        : "Your drink had recent view activity.",
      route: item.route,
      relatedDrinkSlug: item.targetDrinkSlug,
      relatedUsername: null,
    };
  });
}

async function getDrinkCreatorLeaderboard(limit = 10): Promise<CreatorLeaderboardRow[]> {
  if (!db) return [];

  const safeLimit = Math.max(1, Math.min(limit, 50));
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

  const createdRows = await db
    .select({ userId: drinkRecipes.userId, totalCreated: sql<number>`count(*)` })
    .from(drinkRecipes)
    .where(sql`${drinkRecipes.userId} is not null`)
    .groupBy(drinkRecipes.userId);

  if (createdRows.length === 0) return [];

  const creatorIds = createdRows.map((row) => row.userId).filter((userId): userId is string => Boolean(userId));
  if (creatorIds.length === 0) return [];

  const creatorRecipes = await db
    .select({ slug: drinkRecipes.slug, name: drinkRecipes.name, image: drinkRecipes.image, userId: drinkRecipes.userId })
    .from(drinkRecipes)
    .where(inArray(drinkRecipes.userId, creatorIds));

  if (creatorRecipes.length === 0) return [];

  const recipeSlugs = creatorRecipes.map((recipe) => recipe.slug);

  const eventRows = await db
    .select({
      slug: drinkEvents.slug,
      views7d: sql<number>`count(*) filter (where ${drinkEvents.eventType} = 'view')`,
      groceryAdds7d: sql<number>`count(*) filter (where ${drinkEvents.eventType} = 'grocery_add')`,
    })
    .from(drinkEvents)
    .where(and(inArray(drinkEvents.slug, recipeSlugs), gt(drinkEvents.createdAt, sevenDaysAgo)))
    .groupBy(drinkEvents.slug);

  const remixedByOthersRows = await db
    .select({ remixedFromSlug: drinkRecipes.remixedFromSlug, remixesCount: sql<number>`count(*)` })
    .from(drinkRecipes)
    .where(inArray(drinkRecipes.remixedFromSlug, recipeSlugs))
    .groupBy(drinkRecipes.remixedFromSlug);

  const profiles = await db
    .select({ id: users.id, username: users.username, avatar: users.avatar, followersCount: users.followersCount })
    .from(users)
    .where(inArray(users.id, creatorIds));

  const createdByUser = new Map(
    createdRows
      .filter((row): row is { userId: string; totalCreated: number } => Boolean(row.userId))
      .map((row) => [row.userId, Number(row.totalCreated ?? 0)])
  );

  const eventsBySlug = new Map(
    eventRows.map((row) => [row.slug, { views7d: Number(row.views7d ?? 0), groceryAdds7d: Number(row.groceryAdds7d ?? 0) }])
  );

  const remixesBySlug = new Map(
    remixedByOthersRows
      .filter((row): row is { remixedFromSlug: string; remixesCount: number } => Boolean(row.remixedFromSlug))
      .map((row) => [row.remixedFromSlug, Number(row.remixesCount ?? 0)])
  );

  const profileById = new Map(profiles.map((profile) => [profile.id, {
    username: profile.username,
    avatar: profile.avatar,
    followersCount: Number(profile.followersCount ?? 0),
  }]));

  const recipesByCreator = new Map<string, Array<typeof creatorRecipes[number]>>();
  for (const recipe of creatorRecipes) {
    if (!recipe.userId) continue;
    const current = recipesByCreator.get(recipe.userId) ?? [];
    current.push(recipe);
    recipesByCreator.set(recipe.userId, current);
  }

  const rows: CreatorLeaderboardRow[] = creatorIds.map((creatorId) => {
    const creatorRecipeRows = recipesByCreator.get(creatorId) ?? [];
    const totals = creatorRecipeRows.reduce((acc, recipe) => {
      const metrics = eventsBySlug.get(recipe.slug) ?? { views7d: 0, groceryAdds7d: 0 };
      const remixesCount = remixesBySlug.get(recipe.slug) ?? 0;
      const recipeScore = metrics.views7d + (remixesCount * 4) + (metrics.groceryAdds7d * 2);

      if (!acc.topDrink || recipeScore > acc.topDrink.score) {
        acc.topDrink = {
          slug: recipe.slug,
          name: recipe.name,
          image: recipe.image ?? null,
          route: toDrinkRoute(recipe.slug),
          score: recipeScore,
          remixesCount,
        };
      }

      acc.totalViews7d += metrics.views7d;
      acc.totalRemixesReceived += remixesCount;
      acc.totalGroceryAdds += metrics.groceryAdds7d;
      return acc;
    }, {
      totalViews7d: 0,
      totalRemixesReceived: 0,
      totalGroceryAdds: 0,
      topDrink: null as CreatorLeaderboardRow["topDrink"],
    });

    const totalCreated = createdByUser.get(creatorId) ?? creatorRecipeRows.length;
    const creatorScore =
      (totals.totalViews7d * 1) +
      (totals.totalRemixesReceived * 4) +
      (totals.totalGroceryAdds * 2) +
      (totalCreated * 0.5);

    const creatorProfile = profileById.get(creatorId);

    return {
      userId: creatorId,
      username: creatorProfile?.username ?? null,
      avatar: creatorProfile?.avatar ?? null,
      creatorScore,
      totalCreated,
      totalViews7d: totals.totalViews7d,
      totalRemixesReceived: totals.totalRemixesReceived,
      totalGroceryAdds: totals.totalGroceryAdds,
      followerCount: creatorProfile?.followersCount ?? 0,
      topDrink: totals.topDrink,
    };
  });

  return rows
    .sort((a, b) => b.creatorScore - a.creatorScore || b.totalViews7d - a.totalViews7d || b.totalRemixesReceived - a.totalRemixesReceived)
    .slice(0, safeLimit);
}

async function getTrendingDrinkCreators(limit = 25): Promise<TrendingCreatorRow[]> {
  if (!db) return [];

  const safeLimit = Math.max(1, Math.min(limit, 100));
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

  const createdRows = await db
    .select({
      userId: drinkRecipes.userId,
      totalCreated: sql<number>`count(*)`,
      recentCreatedCount: sql<number>`count(*) filter (where ${drinkRecipes.createdAt} > ${sevenDaysAgo})`,
    })
    .from(drinkRecipes)
    .where(sql`${drinkRecipes.userId} is not null`)
    .groupBy(drinkRecipes.userId);

  if (createdRows.length === 0) return [];

  const creatorIds = createdRows.map((row) => row.userId).filter((userId): userId is string => Boolean(userId));
  if (creatorIds.length === 0) return [];

  const creatorRecipes = await db
    .select({ slug: drinkRecipes.slug, name: drinkRecipes.name, image: drinkRecipes.image, userId: drinkRecipes.userId })
    .from(drinkRecipes)
    .where(inArray(drinkRecipes.userId, creatorIds));

  if (creatorRecipes.length === 0) return [];

  const recipeSlugs = creatorRecipes.map((recipe) => recipe.slug);

  const eventRows = await db
    .select({
      slug: drinkEvents.slug,
      views7d: sql<number>`count(*) filter (where ${drinkEvents.eventType} = 'view')`,
      groceryAdds7d: sql<number>`count(*) filter (where ${drinkEvents.eventType} = 'grocery_add')`,
    })
    .from(drinkEvents)
    .where(and(inArray(drinkEvents.slug, recipeSlugs), gt(drinkEvents.createdAt, sevenDaysAgo)))
    .groupBy(drinkEvents.slug);

  const remixedByOthersRows = await db
    .select({ remixedFromSlug: drinkRecipes.remixedFromSlug, remixesCount: sql<number>`count(*)` })
    .from(drinkRecipes)
    .where(and(inArray(drinkRecipes.remixedFromSlug, recipeSlugs), gt(drinkRecipes.createdAt, sevenDaysAgo)))
    .groupBy(drinkRecipes.remixedFromSlug);

  const profiles = await db
    .select({ id: users.id, username: users.username, avatar: users.avatar, followersCount: users.followersCount })
    .from(users)
    .where(inArray(users.id, creatorIds));

  const createdByUser = new Map(
    createdRows
      .filter((row): row is { userId: string; totalCreated: number; recentCreatedCount: number } => Boolean(row.userId))
      .map((row) => [row.userId, {
        totalCreated: Number(row.totalCreated ?? 0),
        recentCreatedCount: Number(row.recentCreatedCount ?? 0),
      }])
  );

  const eventsBySlug = new Map(
    eventRows.map((row) => [row.slug, { views7d: Number(row.views7d ?? 0), groceryAdds7d: Number(row.groceryAdds7d ?? 0) }])
  );

  const remixesBySlug = new Map(
    remixedByOthersRows
      .filter((row): row is { remixedFromSlug: string; remixesCount: number } => Boolean(row.remixedFromSlug))
      .map((row) => [row.remixedFromSlug, Number(row.remixesCount ?? 0)])
  );

  const profileById = new Map(profiles.map((profile) => [profile.id, {
    username: profile.username,
    avatar: profile.avatar,
    followersCount: Number(profile.followersCount ?? 0),
  }]));

  const recipesByCreator = new Map<string, Array<typeof creatorRecipes[number]>>();
  for (const recipe of creatorRecipes) {
    if (!recipe.userId) continue;
    const current = recipesByCreator.get(recipe.userId) ?? [];
    current.push(recipe);
    recipesByCreator.set(recipe.userId, current);
  }

  const rows: TrendingCreatorRow[] = creatorIds.map((creatorId) => {
    const creatorRecipeRows = recipesByCreator.get(creatorId) ?? [];
    const totals = creatorRecipeRows.reduce((acc, recipe) => {
      const metrics = eventsBySlug.get(recipe.slug) ?? { views7d: 0, groceryAdds7d: 0 };
      const remixesCount = remixesBySlug.get(recipe.slug) ?? 0;
      const recipeScore = metrics.views7d + (remixesCount * 4) + (metrics.groceryAdds7d * 2);

      if (!acc.topDrink || recipeScore > acc.topDrink.score) {
        acc.topDrink = {
          slug: recipe.slug,
          name: recipe.name,
          image: recipe.image ?? null,
          route: `/drinks/recipe/${recipe.slug}`,
          score: recipeScore,
          remixesCount,
        };
      }

      acc.totalViews7d += metrics.views7d;
      acc.totalRemixesReceived += remixesCount;
      acc.totalGroceryAdds += metrics.groceryAdds7d;
      return acc;
    }, {
      totalViews7d: 0,
      totalRemixesReceived: 0,
      totalGroceryAdds: 0,
      topDrink: null as CreatorLeaderboardRow["topDrink"],
    });

    const createdStats = createdByUser.get(creatorId) ?? { totalCreated: creatorRecipeRows.length, recentCreatedCount: 0 };
    const creatorScore =
      (totals.totalViews7d * 1) +
      (totals.totalRemixesReceived * 4) +
      (totals.totalGroceryAdds * 2) +
      (createdStats.recentCreatedCount * 1);

    const creatorProfile = profileById.get(creatorId);
    return {
      userId: creatorId,
      username: creatorProfile?.username ?? null,
      avatar: creatorProfile?.avatar ?? null,
      creatorScore,
      totalCreated: createdStats.totalCreated,
      recentCreatedCount: createdStats.recentCreatedCount,
      totalViews7d: totals.totalViews7d,
      totalRemixesReceived: totals.totalRemixesReceived,
      totalGroceryAdds: totals.totalGroceryAdds,
      followerCount: creatorProfile?.followersCount ?? 0,
      topDrink: totals.topDrink,
      publicRoute: `/drinks/creator/${encodeURIComponent(creatorId)}`,
    };
  });

  return rows
    .sort((a, b) =>
      b.creatorScore - a.creatorScore ||
      b.totalViews7d - a.totalViews7d ||
      b.totalRemixesReceived - a.totalRemixesReceived ||
      b.recentCreatedCount - a.recentCreatedCount
    )
    .slice(0, safeLimit);
}


r.get("/challenges", async (_req, res) => {
  try {
    if (!db) return res.status(503).json({ ok: false, error: "Database unavailable" });

    await seedDrinkChallengesIfEmpty();

    const rows = await db
      .select({
        id: drinkChallenges.id,
        slug: drinkChallenges.slug,
        title: drinkChallenges.title,
        description: drinkChallenges.description,
        theme: drinkChallenges.theme,
        originalDrinkSlug: drinkChallenges.originalDrinkSlug,
        challengeType: drinkChallenges.challengeType,
        startsAt: drinkChallenges.startsAt,
        endsAt: drinkChallenges.endsAt,
        isActive: drinkChallenges.isActive,
        createdAt: drinkChallenges.createdAt,
        submissionsCount: sql<number>`count(${drinkChallengeSubmissions.id})`,
      })
      .from(drinkChallenges)
      .leftJoin(drinkChallengeSubmissions, eq(drinkChallengeSubmissions.challengeId, drinkChallenges.id))
      .groupBy(
        drinkChallenges.id,
        drinkChallenges.slug,
        drinkChallenges.title,
        drinkChallenges.description,
        drinkChallenges.theme,
        drinkChallenges.originalDrinkSlug,
        drinkChallenges.challengeType,
        drinkChallenges.startsAt,
        drinkChallenges.endsAt,
        drinkChallenges.isActive,
        drinkChallenges.createdAt,
      )
      .orderBy(desc(drinkChallenges.startsAt));

    const items = rows.map((row) => ({
      ...row,
      isActive: challengeIsActiveNow(row),
      submissionsCount: Number(row.submissionsCount ?? 0),
    }));

    return res.json({ ok: true, count: items.length, items });
  } catch (error) {
    console.error("Error loading drink challenges:", error);
    return res.status(500).json({ ok: false, error: "Failed to fetch drink challenges" });
  }
});

r.get("/challenges/:slug", async (req, res) => {
  try {
    if (!db) return res.status(503).json({ ok: false, error: "Database unavailable" });

    await seedDrinkChallengesIfEmpty();

    const slug = normalizeSlug(req.params.slug);
    if (!slug) return res.status(400).json({ ok: false, error: "Invalid challenge slug" });

    const rows = await db.select().from(drinkChallenges).where(eq(drinkChallenges.slug, slug)).limit(1);
    const challenge = rows[0];
    if (!challenge) return res.status(404).json({ ok: false, error: "Challenge not found" });

    const canonicalDrink = challenge.originalDrinkSlug ? getCanonicalDrinkBySlug(challenge.originalDrinkSlug) : null;

    return res.json({
      ok: true,
      challenge: {
        ...challenge,
        isActive: challengeIsActiveNow(challenge),
      },
      canonicalDrink: canonicalDrink
        ? {
            slug: canonicalDrink.slug,
            name: canonicalDrink.name,
            route: canonicalDrink.route,
            image: canonicalDrink.image ?? null,
          }
        : null,
    });
  } catch (error) {
    console.error("Error loading drink challenge:", error);
    return res.status(500).json({ ok: false, error: "Failed to fetch drink challenge" });
  }
});

r.get("/challenges/:slug/submissions", async (req, res) => {
  try {
    if (!db) return res.status(503).json({ ok: false, error: "Database unavailable" });

    await seedDrinkChallengesIfEmpty();

    const slug = normalizeSlug(req.params.slug);
    if (!slug) return res.status(400).json({ ok: false, error: "Invalid challenge slug" });

    const challengeRows = await db.select().from(drinkChallenges).where(eq(drinkChallenges.slug, slug)).limit(1);
    const challenge = challengeRows[0];
    if (!challenge) return res.status(404).json({ ok: false, error: "Challenge not found" });

    const { limit, offset } = parseLimitOffset(req.query as Record<string, unknown>, { limit: 50, maxLimit: 100 });

    const rows = await db
      .select({
        id: drinkChallengeSubmissions.id,
        challengeId: drinkChallengeSubmissions.challengeId,
        userId: drinkChallengeSubmissions.userId,
        drinkSlug: drinkChallengeSubmissions.drinkSlug,
        createdAt: drinkChallengeSubmissions.createdAt,
        username: users.username,
        avatar: users.avatar,
      })
      .from(drinkChallengeSubmissions)
      .leftJoin(users, eq(users.id, drinkChallengeSubmissions.userId))
      .where(eq(drinkChallengeSubmissions.challengeId, challenge.id))
      .orderBy(desc(drinkChallengeSubmissions.createdAt))
      .limit(limit)
      .offset(offset);

    const detailsBySlug = await resolveDrinkDetailsMapBySlugs(rows.map((row) => row.drinkSlug));

    const submissions = rows.map((row) => ({
      id: row.id,
      challengeId: row.challengeId,
      userId: row.userId,
      drinkSlug: row.drinkSlug,
      createdAt: row.createdAt,
      creatorUsername: row.username ?? null,
      creatorAvatar: row.avatar ?? null,
      drink: detailsBySlug.get(row.drinkSlug) ?? null,
    }));

    return res.json({
      ok: true,
      challenge: { ...challenge, isActive: challengeIsActiveNow(challenge) },
      count: submissions.length,
      limit,
      offset,
      submissions,
    });
  } catch (error) {
    console.error("Error loading challenge submissions:", error);
    return res.status(500).json({ ok: false, error: "Failed to fetch challenge submissions" });
  }
});

r.post("/challenges/:slug/join", requireAuth, async (req, res) => {
  try {
    if (!db) return res.status(503).json({ ok: false, error: "Database unavailable" });

    const slug = normalizeSlug(req.params.slug);
    if (!slug) return res.status(400).json({ ok: false, error: "Invalid challenge slug" });

    const rows = await db.select().from(drinkChallenges).where(eq(drinkChallenges.slug, slug)).limit(1);
    const challenge = rows[0];
    if (!challenge) return res.status(404).json({ ok: false, error: "Challenge not found" });
    if (!challengeIsActiveNow(challenge)) {
      return res.status(400).json({ ok: false, error: "Challenge is not currently active" });
    }

    const body = challengeSubmissionBodySchema.parse(req.body ?? {});
    const userId = resolveEngagementUserId(req);
    if (!userId) return res.status(401).json({ ok: false, error: "Authentication required" });

    if (!body.drinkSlug) {
      return res.json({
        ok: true,
        challenge,
        submitRoute: `/drinks/submit?remix=${encodeURIComponent(challenge.originalDrinkSlug || "")}&challenge=${encodeURIComponent(challenge.slug)}`,
      });
    }

    const normalizedDrinkSlug = normalizeSlug(body.drinkSlug);
    if (!normalizedDrinkSlug) return res.status(400).json({ ok: false, error: "Invalid drink slug" });

    const drink = await resolveDrinkDetailsBySlug(normalizedDrinkSlug);
    if (!drink) return res.status(404).json({ ok: false, error: "Drink not found" });

    const inserted = await db
      .insert(drinkChallengeSubmissions)
      .values({
        challengeId: challenge.id,
        userId,
        drinkSlug: normalizedDrinkSlug,
      })
      .onConflictDoNothing()
      .returning();

    return res.status(inserted.length > 0 ? 201 : 200).json({
      ok: true,
      challengeId: challenge.id,
      challengeSlug: challenge.slug,
      joined: inserted.length > 0,
      submission: inserted[0] ?? null,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ ok: false, error: "Invalid join request", details: error.errors });
    }

    console.error("Error joining challenge:", error);
    return res.status(500).json({ ok: false, error: "Failed to join challenge" });
  }
});

r.post("/challenges", requireAuth, async (req, res) => {
  try {
    if (!db) return res.status(503).json({ ok: false, error: "Database unavailable" });

    const parsed = insertDrinkChallengeSchema.parse(req.body ?? {});
    const inserted = await db.insert(drinkChallenges).values(parsed).returning();
    return res.status(201).json({ ok: true, challenge: inserted[0] });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ ok: false, error: "Invalid challenge payload", details: error.errors });
    }

    console.error("Error creating challenge:", error);
    return res.status(500).json({ ok: false, error: "Failed to create challenge" });
  }
});

// Submit a user drink recipe
r.post("/submit", requireAuth, async (req, res) => {
  try {
    if (!db) {
      return res.status(503).json({ ok: false, error: "Database unavailable" });
    }

    const name = String(req.body?.name ?? "").trim();
    if (!name) {
      return res.status(400).json({ ok: false, error: "name is required" });
    }

    const baseSlug = slugifyDrinkRecipeName(name) || "user-drink";
    let slug = baseSlug;
    let suffix = 2;

    while (await getUserRecipeBySlug(slug)) {
      slug = `${baseSlug}-${suffix}`;
      suffix += 1;
    }

    const parsed = insertDrinkRecipeSchema.parse({
      slug,
      name,
      description: str(req.body?.description),
      ingredients: Array.isArray(req.body?.ingredients) ? req.body.ingredients.map((v: unknown) => String(v)).filter(Boolean) : [],
      instructions: Array.isArray(req.body?.instructions) ? req.body.instructions.map((v: unknown) => String(v)).filter(Boolean) : [],
      glassware: str(req.body?.glassware),
      method: str(req.body?.method),
      prepTime: typeof req.body?.prepTime === "number" ? req.body.prepTime : undefined,
      servingSize: str(req.body?.servingSize),
      difficulty: str(req.body?.difficulty),
      spiritType: str(req.body?.spiritType),
      abv: str(req.body?.abv),
      image: str(req.body?.image),
      category: str(req.body?.category) || "smoothies",
      subcategory: str(req.body?.subcategory),
      remixedFromSlug: normalizeSlug(req.body?.remixedFromSlug),
      challengeSlug: normalizeSlug(req.body?.challengeSlug),
      userId: resolveEngagementUserId(req),
    });

    const rows = await db.insert(drinkRecipes).values({ ...parsed, source: "chefsire" }).returning();

    const challengeSlug = normalizeSlug(req.body?.challengeSlug);
    if (challengeSlug && rows[0]?.slug && parsed.userId) {
      const challengeRows = await db.select().from(drinkChallenges).where(eq(drinkChallenges.slug, challengeSlug)).limit(1);
      const challenge = challengeRows[0];
      if (challenge) {
        await db
          .insert(drinkChallengeSubmissions)
          .values({
            challengeId: challenge.id,
            userId: parsed.userId,
            drinkSlug: rows[0].slug,
          })
          .onConflictDoNothing();
      }
    }

    return res.status(201).json({ ok: true, recipe: rows[0] });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ ok: false, error: "Invalid drink recipe data", details: error.errors });
    }

    console.error("Error submitting drink recipe:", error);

    const errorMessage = error instanceof Error ? error.message : String(error);
    return res.status(500).json({
      ok: false,
      error: process.env.NODE_ENV === "production" ? "Failed to submit drink recipe" : `Failed to submit drink recipe: ${errorMessage}`,
    });
  }
});

// Fetch remixes linked to a source canonical drink slug
r.get("/remixes", async (req, res) => {
  try {
    if (!db) {
      return res.status(503).json({ ok: false, error: "Database unavailable" });
    }

    const sort = normalizeRemixDiscoverySort(req.query?.sort);
    const { limit, offset } = parseLimitOffset(req.query as Record<string, unknown>, { limit: 30, maxLimit: 60 });
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    const remixRowsQuery = db
      .select({
        id: drinkRecipes.id,
        slug: drinkRecipes.slug,
        name: drinkRecipes.name,
        image: drinkRecipes.image,
        createdAt: drinkRecipes.createdAt,
        userId: drinkRecipes.userId,
        creatorUsername: users.username,
        creatorAvatar: users.avatar,
        remixedFromSlug: drinkRecipes.remixedFromSlug,
        views7d: sql<number>`count(${drinkEvents.id}) filter (where ${drinkEvents.eventType} = 'view' and ${drinkEvents.createdAt} >= ${sevenDaysAgo})`,
      })
      .from(drinkRecipes)
      .leftJoin(users, eq(drinkRecipes.userId, users.id))
      .leftJoin(drinkEvents, eq(drinkEvents.slug, drinkRecipes.slug))
      .where(sql`${drinkRecipes.remixedFromSlug} is not null`)
      .groupBy(
        drinkRecipes.id,
        drinkRecipes.slug,
        drinkRecipes.name,
        drinkRecipes.image,
        drinkRecipes.createdAt,
        drinkRecipes.userId,
        users.username,
        users.avatar,
        drinkRecipes.remixedFromSlug
      );

    const remixRows = await (sort === "popular"
      ? remixRowsQuery
          .orderBy(
            desc(sql`count(${drinkEvents.id}) filter (where ${drinkEvents.eventType} = 'view' and ${drinkEvents.createdAt} >= ${sevenDaysAgo})`),
            desc(drinkRecipes.createdAt)
          )
          .limit(limit)
          .offset(offset)
      : remixRowsQuery
          .orderBy(desc(drinkRecipes.createdAt))
          .limit(limit)
          .offset(offset));
    const remixSlugs = remixRows.map((row) => row.slug);
    const remixesCountRows = remixSlugs.length
      ? await db
          .select({ remixedFromSlug: drinkRecipes.remixedFromSlug, remixesCount: sql<number>`count(*)` })
          .from(drinkRecipes)
          .where(inArray(drinkRecipes.remixedFromSlug, remixSlugs))
          .groupBy(drinkRecipes.remixedFromSlug)
      : [];

    const remixesCountBySlug = new Map(
      remixesCountRows
        .filter((row): row is { remixedFromSlug: string; remixesCount: number } => Boolean(row.remixedFromSlug))
        .map((row) => [row.remixedFromSlug, Number(row.remixesCount ?? 0)])
    );

    const items = remixRows.map((entry) => {
      const sourceSlug = entry.remixedFromSlug ?? null;
      const canonicalSource = sourceSlug ? getCanonicalDrinkBySlug(sourceSlug) : null;
      const sourceRoute = canonicalSource?.route ?? (sourceSlug ? `/drinks/recipe/${sourceSlug}` : null);

      return {
        id: entry.id,
        slug: entry.slug,
        name: entry.name,
        image: entry.image ?? null,
        createdAt: entry.createdAt,
        userId: entry.userId ?? null,
        creatorUsername: entry.creatorUsername ?? null,
        creatorAvatar: entry.creatorAvatar ?? null,
        remixedFromSlug: sourceSlug,
        route: toDrinkRoute(entry.slug, true),
        sourceRoute,
        views7d: Number(entry.views7d ?? 0),
        remixesCount: remixesCountBySlug.get(entry.slug) ?? 0,
      };
    });

    return res.json({ ok: true, sort, count: items.length, limit, offset, items });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("[drinks/remixes] Error fetching remix discovery feed:", {
      sort: normalizeRemixDiscoverySort(req.query?.sort),
      query: req.query,
      error,
      message,
    });
    return res.status(500).json({
      ok: false,
      error: process.env.NODE_ENV === "production" ? "Failed to fetch remix discovery feed" : `Failed to fetch remix discovery feed: ${message}`,
    });
  }
});

// Fetch canonical/original drinks ranked by remix activity.
r.get("/most-remixed", async (req, res) => {
  try {
    if (!db) {
      return res.status(503).json({ ok: false, error: "Database unavailable" });
    }

    const { limit, offset } = parseLimitOffset(req.query as Record<string, unknown>, { limit: 24, maxLimit: 100 });
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    const remixAggregateRows = await db
      .select({
        slug: drinkRecipes.remixedFromSlug,
        remixCount: sql<number>`count(*)`,
        lastRemixAt: sql<Date>`max(${drinkRecipes.createdAt})`,
      })
      .from(drinkRecipes)
      .where(sql`${drinkRecipes.remixedFromSlug} is not null`)
      .groupBy(drinkRecipes.remixedFromSlug);

    const sourceSlugs = remixAggregateRows
      .map((row) => row.slug)
      .filter((slug): slug is string => typeof slug === "string" && slug.length > 0);

    if (sourceSlugs.length === 0) {
      return res.json({ ok: true, count: 0, items: [] });
    }

    const viewRows = await db
      .select({
        slug: drinkEvents.slug,
        views7d: sql<number>`count(*) filter (where ${drinkEvents.eventType} = 'view' and ${drinkEvents.createdAt} >= ${sevenDaysAgo})`,
      })
      .from(drinkEvents)
      .where(inArray(drinkEvents.slug, sourceSlugs))
      .groupBy(drinkEvents.slug);

    const userSourceRows = await db
      .select({
        slug: drinkRecipes.slug,
        name: drinkRecipes.name,
        image: drinkRecipes.image,
        category: drinkRecipes.category,
        subcategory: drinkRecipes.subcategory,
      })
      .from(drinkRecipes)
      .where(inArray(drinkRecipes.slug, sourceSlugs));

    const views7dBySlug = new Map(viewRows.map((row) => [row.slug, Number(row.views7d ?? 0)]));
    const userSourceBySlug = new Map(userSourceRows.map((row) => [row.slug, row]));

    const rankedItems: MostRemixedDrinkItem[] = remixAggregateRows
      .filter((row): row is { slug: string; remixCount: number; lastRemixAt: Date | null } => Boolean(row.slug))
      .map((row) => {
        const canonical = getCanonicalDrinkBySlug(row.slug);
        const userSource = userSourceBySlug.get(row.slug);

        const route = canonical?.route ?? `/drinks/recipe/${row.slug}`;
        const sourceCategoryRoute = canonical?.sourceRoute ?? (userSource ? canonicalRouteForUserRecipe({
          category: userSource.category,
          subcategory: userSource.subcategory ?? null,
        }) : null);

        return {
          slug: row.slug,
          name: canonical?.name ?? userSource?.name ?? row.slug,
          image: canonical?.image ?? userSource?.image ?? null,
          route,
          sourceCategoryRoute,
          remixCount: Number(row.remixCount ?? 0),
          views7d: views7dBySlug.get(row.slug) ?? 0,
          lastRemixAt: row.lastRemixAt ? new Date(row.lastRemixAt) : null,
        };
      })
      .sort(resolveMostRemixedTieBreaker)
      .slice(offset, offset + limit);

    return res.json({
      ok: true,
      count: rankedItems.length,
      items: rankedItems.map((item) => ({
        slug: item.slug,
        name: item.name,
        image: item.image,
        route: item.route,
        sourceCategoryRoute: item.sourceCategoryRoute,
        remixesCount: item.remixCount,
        views7d: item.views7d,
      })),
      limit,
      offset,
    });
  } catch (error) {
    console.error("Error fetching most remixed drinks:", error);
    return res.status(500).json({ ok: false, error: "Failed to fetch most remixed drinks" });
  }
});

// Fetch remixes linked to a source canonical drink slug
r.get("/remixes/:slug", async (req, res) => {
  try {
    if (!db) {
      return res.status(503).json({ ok: false, error: "Database unavailable" });
    }

    const sourceSlug = normalizeSlug(req.params?.slug);
    if (!sourceSlug) {
      return res.status(400).json({ ok: false, error: "slug is required" });
    }

    const remixes = await db
      .select({
        slug: drinkRecipes.slug,
        name: drinkRecipes.name,
        image: drinkRecipes.image,
        createdAt: drinkRecipes.createdAt,
        creatorUsername: users.username,
        creatorId: drinkRecipes.userId,
      })
      .from(drinkRecipes)
      .leftJoin(users, eq(drinkRecipes.userId, users.id))
      .where(eq(drinkRecipes.remixedFromSlug, sourceSlug))
      .orderBy(desc(drinkRecipes.createdAt))
      .limit(24);

    const items = remixes.map((entry) => ({
      slug: entry.slug,
      name: entry.name,
      image: entry.image ?? null,
      creatorName: entry.creatorUsername ?? null,
      creatorId: entry.creatorId ?? null,
      createdAt: entry.createdAt,
      route: `/drinks/recipe/${entry.slug}?community=1`,
      remixedFromSlug: sourceSlug,
    }));

    return res.json({ ok: true, slug: sourceSlug, count: items.length, items });
  } catch (error) {
    console.error("Error fetching drink remixes:", error);
    return res.status(500).json({ ok: false, error: "Failed to fetch drink remixes" });
  }
});

// Fetch remix lineage for a canonical or community drink recipe
r.get("/remix-chain/:slug", async (req, res) => {
  try {
    if (!db) {
      return res.status(503).json({ ok: false, error: "Database unavailable" });
    }

    const slug = normalizeSlug(req.params?.slug);
    if (!slug) {
      return res.status(400).json({ ok: false, error: "slug is required" });
    }

    const currentNode = await resolveRemixChainNode(slug);
    if (!currentNode) {
      return res.status(404).json({ ok: false, error: "Recipe not found" });
    }

    const current = await hydrateRemixNodeCreator(currentNode);

    const ancestors: RemixChainNode[] = [];
    const ancestorSeen = new Set<string>([current.slug]);
    let parentSlug = current.remixedFromSlug;

    while (parentSlug && !ancestorSeen.has(parentSlug) && ancestors.length < 16) {
      ancestorSeen.add(parentSlug);
      const parentNode = await resolveRemixChainNode(parentSlug);
      if (!parentNode) break;
      ancestors.push(await hydrateRemixNodeCreator(parentNode));
      parentSlug = parentNode.remixedFromSlug;
    }

    const descendants: Array<RemixChainNode & { parentSlug: string; depth: number }> = [];
    const descendantSeen = new Set<string>([current.slug]);
    let frontier = [current.slug];
    let depth = 1;

    while (frontier.length > 0 && depth <= 6 && descendants.length < 200) {
      const rows = await db
        .select()
        .from(drinkRecipes)
        .where(inArray(drinkRecipes.remixedFromSlug, frontier))
        .orderBy(desc(drinkRecipes.createdAt));

      if (rows.length === 0) break;

      const nextFrontier: string[] = [];
      for (const row of rows) {
        if (descendantSeen.has(row.slug)) continue;
        descendantSeen.add(row.slug);
        descendants.push({
          ...(await hydrateRemixNodeCreator(toRemixChainNodeFromUserRecipe(row))),
          parentSlug: row.remixedFromSlug ?? current.slug,
          depth,
        });
        nextFrontier.push(row.slug);
      }

      frontier = nextFrontier;
      depth += 1;
    }

    const children = descendants.filter((entry) => entry.depth === 1);

    return res.json({
      ok: true,
      current,
      parent: ancestors[0] ?? null,
      children,
      ancestors,
      descendants,
    });
  } catch (error) {
    console.error("Error fetching drink remix chain:", error);
    return res.status(500).json({ ok: false, error: "Failed to fetch drink remix chain" });
  }
});

// Fetch a user-submitted drink recipe
r.get("/user/:slug", async (req, res) => {
  try {
    if (!db) {
      return res.status(503).json({ ok: false, error: "Database unavailable" });
    }
    const slug = String(req.params?.slug ?? "").trim();
    if (!slug) return res.status(400).json({ ok: false, error: "slug is required" });

    const recipe = await getUserRecipeBySlug(slug);
    if (!recipe) return res.status(404).json({ ok: false, error: "Recipe not found" });

    const creator = recipe.userId
      ? await db.select({ username: users.username }).from(users).where(eq(users.id, recipe.userId)).limit(1)
      : [];

    return res.json({
      ok: true,
      recipe: {
        ...recipe,
        creatorId: recipe.userId ?? null,
        creatorUsername: creator[0]?.username ?? null,
      },
    });
  } catch (error) {
    console.error("Error fetching user drink recipe:", error);
    return res.status(500).json({ ok: false, error: "Failed to fetch drink recipe" });
  }
});

// Track canonical drink recipe events
r.post("/events", async (req, res) => {
  try {
    if (!db) {
      return res.status(503).json({ ok: false, error: "Database unavailable" });
    }

    const parsed = parseTrackedEventBody(req.body, TRACKABLE_DRINK_EVENTS);
    if (!parsed.ok) {
      return res.status(parsed.status).json({ ok: false, error: parsed.error });
    }

    const { slug, eventType } = parsed;

    const canonicalRecipe = getCanonicalDrinkBySlug(slug);
    const userRecipe = canonicalRecipe ? null : await getUserRecipeBySlug(slug);
    if (!canonicalRecipe && !userRecipe) {
      return res.status(404).json({ ok: false, error: "Unknown drink slug" });
    }

    await db.insert(drinkEvents).values({
      slug,
      eventType,
      userId: resolveEngagementUserId(req),
    });

    return res.status(201).json({ ok: true });
  } catch (error: any) {
    console.error("Error logging drink event:", error);
    return res.status(500).json({ ok: false, error: "Failed to log drink event" });
  }
});

// Trending canonical drink recipes
r.get("/trending", async (_req, res) => {
  try {
    if (!db) {
      return res.json({
        ok: true,
        window: "7d",
        ranking: { formula: "views_last_24h * 3 + views_days_2_to_7 * 1 + remix_events * 4 + shopping_list_adds * 2" },
        items: [],
      });
    }

    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const views24hSql = sql<number>`count(*) filter (where ${drinkEvents.eventType} = 'view' and ${drinkEvents.createdAt} > ${oneDayAgo})`;
    const views7dSql = sql<number>`count(*) filter (where ${drinkEvents.eventType} = 'view' and ${drinkEvents.createdAt} > ${sevenDaysAgo})`;
    const remixesSql = sql<number>`count(*) filter (where ${drinkEvents.eventType} = 'remix' and ${drinkEvents.createdAt} > ${sevenDaysAgo})`;
    const groceryAddsSql = sql<number>`count(*) filter (where ${drinkEvents.eventType} = 'grocery_add' and ${drinkEvents.createdAt} > ${sevenDaysAgo})`;
    const scoreSql = sql<number>`(
      (${views24hSql} * 3)
      + (greatest(${views7dSql} - ${views24hSql}, 0) * 1)
      + (${remixesSql} * 4)
      + (${groceryAddsSql} * 2)
    )`;

    const rows = await db
      .select({
        slug: drinkEvents.slug,
        score: scoreSql,
        views24h: views24hSql,
        views7d: views7dSql,
        remixes: remixesSql,
        groceryAdds: groceryAddsSql,
      })
      .from(drinkEvents)
      .where(gt(drinkEvents.createdAt, sevenDaysAgo))
      .groupBy(drinkEvents.slug)
      .orderBy(desc(scoreSql), desc(views24hSql), desc(remixesSql), desc(groceryAddsSql), desc(views7dSql))
      .limit(10);

    const resolved = await Promise.all(rows.map((row) => resolveDrinkDetailsBySlug(row.slug)));

    const items = resolved
      .map((item, index) => {
        if (!item) return null;
        const row = rows[index];
        return {
          slug: item.slug,
          name: item.name,
          image: item.image,
          route: item.route,
          sourceCategoryRoute: item.sourceCategoryRoute,
          source: item.source,
          score: Number(row.score ?? 0),
          views7d: Number(row.views7d ?? 0),
          views24h: Number(row.views24h ?? 0),
          remixes: Number(row.remixes ?? 0),
          remixesCount: Number(row.remixes ?? 0),
          groceryAdds: Number(row.groceryAdds ?? 0),
        };
      })
      .filter(Boolean);

    return res.json({
      ok: true,
      window: "7d",
      ranking: {
        formula: "views_last_24h * 3 + views_days_2_to_7 * 1 + remix_events * 4 + shopping_list_adds * 2",
      },
      items,
    });
  } catch (error: any) {
    console.error("Error getting trending drinks:", error);
    return res.status(500).json({ ok: false, error: "Failed to fetch trending drinks" });
  }
});

// Trending canonical drinks scoped to a source category route
r.get("/trending/by-category", async (req, res) => {
  try {
    const sourceCategoryRoute = typeof req.query?.sourceCategoryRoute === "string"
      ? req.query.sourceCategoryRoute.trim()
      : "";

    if (!sourceCategoryRoute) {
      return res.status(400).json({ ok: false, error: "sourceCategoryRoute is required" });
    }

    if (!db) {
      return res.json({
        ok: true,
        sourceCategoryRoute,
        items: [],
      });
    }

    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    const hotScoreSql = sql<number>`
      (
        (sum(case when ${drinkEvents.createdAt} >= ${oneDayAgo} then 1 else 0 end) * 3)
        + (sum(case when ${drinkEvents.createdAt} >= ${sevenDaysAgo} then 1 else 0 end) * 1)
        + (count(*) * 0.3)
        - ((extract(epoch from (now() - max(${drinkEvents.createdAt}))) / 3600.0) * 0.05)
      )
    `;

    const rows = await db
      .select({
        slug: drinkEvents.slug,
        score: hotScoreSql,
        views7d: sql<number>`sum(case when ${drinkEvents.createdAt} >= ${sevenDaysAgo} then 1 else 0 end)`,
        views24h: sql<number>`sum(case when ${drinkEvents.createdAt} >= ${oneDayAgo} then 1 else 0 end)`,
      })
      .from(drinkEvents)
      .where(and(eq(drinkEvents.eventType, "view"), gt(drinkEvents.createdAt, thirtyDaysAgo)))
      .groupBy(drinkEvents.slug)
      .orderBy(desc(hotScoreSql), desc(sql`sum(case when ${drinkEvents.createdAt} >= ${oneDayAgo} then 1 else 0 end)`), desc(sql`sum(case when ${drinkEvents.createdAt} >= ${sevenDaysAgo} then 1 else 0 end)`));

    const resolved = await Promise.all(rows.map((row) => resolveDrinkDetailsBySlug(row.slug)));

    const items = resolved
      .map((item, index) => {
        if (!item || item.sourceCategoryRoute !== sourceCategoryRoute) return null;
        const row = rows[index];
        return {
          slug: item.slug,
          name: item.name,
          image: item.image,
          route: item.route,
          sourceCategoryRoute: item.sourceCategoryRoute,
          source: item.source,
          score: Number(row.score ?? 0),
          views7d: Number(row.views7d ?? 0),
          views24h: Number(row.views24h ?? 0),
        };
      })
      .filter(Boolean)
      .slice(0, 6);

    return res.json({
      ok: true,
      sourceCategoryRoute,
      items,
    });
  } catch (error: any) {
    console.error("Error getting category trending drinks:", error);
    return res.status(500).json({ ok: false, error: "Failed to fetch category trending drinks" });
  }
});

// Recommended canonical drinks based on recently viewed slugs
r.get("/recommended", async (req, res) => {
  try {
    const { limit, offset } = parseLimitOffset(req.query as Record<string, unknown>, { limit: 8, maxLimit: 24 });
    const recentFromQuery = typeof req.query?.recent === "string" ? req.query.recent : "";
    const recentFromBody = Array.isArray(req.body?.recent)
      ? req.body.recent.join(",")
      : typeof req.body?.recent === "string"
        ? req.body.recent
        : "";

    const recentSlugs = (recentFromQuery || recentFromBody)
      .split(",")
      .map((slug) => slug.trim())
      .filter(Boolean);

    const recentSet = new Set(recentSlugs);

    if (!db) {
      return res.json({ ok: true, items: [] });
    }

    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    const rows = await db
      .select({
        slug: drinkEvents.slug,
        score: sql<number>`sum(case when ${drinkEvents.createdAt} >= ${oneDayAgo} then 2 else 1 end)`,
        views7d: sql<number>`count(*)`,
      })
      .from(drinkEvents)
      .where(and(eq(drinkEvents.eventType, "view"), gt(drinkEvents.createdAt, sevenDaysAgo)))
      .groupBy(drinkEvents.slug)
      .orderBy(desc(sql<number>`sum(case when ${drinkEvents.createdAt} >= ${oneDayAgo} then 2 else 1 end)`), desc(sql<number>`count(*)`))
      .limit(300);

    const viewerId = resolveEngagementUserId(req);
    const followedCreatorIds = viewerId
      ? (await db
          .select({ followingId: follows.followingId })
          .from(follows)
          .where(eq(follows.followerId, viewerId)))
          .map((row) => row.followingId)
      : [];

    const followedCreatorSet = new Set(followedCreatorIds);
    const recipeCreators = await db
      .select({ slug: drinkRecipes.slug, userId: drinkRecipes.userId })
      .from(drinkRecipes)
      .where(inArray(drinkRecipes.slug, rows.map((row) => row.slug)));

    const creatorBySlug = new Map(
      recipeCreators
        .filter((row): row is { slug: string; userId: string } => Boolean(row.slug) && Boolean(row.userId))
        .map((row) => [row.slug, row.userId])
    );

    const rankedRows = rows
      .map((row) => {
        const creatorId = creatorBySlug.get(row.slug);
        const baseScore = Number(row.score ?? 0);
        const followedBoost = creatorId && followedCreatorSet.has(creatorId)
          ? Math.min(6, Math.max(1.5, baseScore * 0.2))
          : 0;
        return {
          ...row,
          rankScore: baseScore + followedBoost,
          followedBoost,
          isFollowedCreator: followedBoost > 0,
        };
      })
      .sort((a, b) => b.rankScore - a.rankScore || Number(b.score ?? 0) - Number(a.score ?? 0) || Number(b.views7d ?? 0) - Number(a.views7d ?? 0));

    const detailsBySlug = await resolveDrinkDetailsMapBySlugs([
      ...recentSlugs,
      ...rankedRows.map((row) => row.slug),
    ]);

    const recentCategoryRoutes = new Set(
      recentSlugs
        .map((slug) => detailsBySlug.get(slug)?.sourceCategoryRoute)
        .filter((route): route is string => Boolean(route))
    );

    const scopedRows: typeof rankedRows = recentCategoryRoutes.size === 0
      ? rankedRows
      : rankedRows.filter((row) => {
          const details = detailsBySlug.get(row.slug);
          return Boolean(details && recentCategoryRoutes.has(details.sourceCategoryRoute));
        });

    const recommendationPool = (scopedRows.length > 0 ? scopedRows : rankedRows).slice(0, 240);

    const remixesCountRows = recommendationPool.length > 0
      ? await db
          .select({ remixedFromSlug: drinkRecipes.remixedFromSlug, remixesCount: sql<number>`count(*)` })
          .from(drinkRecipes)
          .where(inArray(drinkRecipes.remixedFromSlug, recommendationPool.map((row) => row.slug)))
          .groupBy(drinkRecipes.remixedFromSlug)
      : [];

    const remixesCountBySlug = new Map(
      remixesCountRows
        .filter((row): row is { remixedFromSlug: string; remixesCount: number } => Boolean(row.remixedFromSlug))
        .map((row) => [row.remixedFromSlug, Number(row.remixesCount ?? 0)])
    );

    const mapped = recommendationPool.map((row) => {
      const item = detailsBySlug.get(row.slug);
      if (!item || recentSet.has(item.slug)) return null;
      return {
        ...toDiscoveryDrinkCard({
          slug: item.slug,
          name: item.name,
          image: item.image,
          route: item.route,
          remixesCount: remixesCountBySlug.get(item.slug) ?? 0,
          views7d: Number(row.views7d ?? 0),
        }),
        sourceCategoryRoute: item.sourceCategoryRoute,
        source: item.source,
        isFollowedCreator: row.isFollowedCreator,
      };
    });

    const items = mapped.filter((item): item is NonNullable<typeof item> => Boolean(item)).slice(offset, offset + limit);

    return res.json({ ok: true, limit, offset, items });
  } catch (error: any) {
    console.error("Error getting recommended drinks:", error);
    return res.status(500).json({ ok: false, error: "Failed to fetch recommended drinks" });
  }
});

r.get("/creator-posts/feed", optionalAuth, async (req, res) => {
  try {
    await ensureDrinkCollectionsSchema();
    if (!db) {
      return res.status(503).json({ ok: false, error: "Database unavailable" });
    }

    const viewerId = req.user?.id ?? null;
    const [posts, followedCreatorIds, memberCreatorIds] = await Promise.all([
      db.select().from(creatorPosts).orderBy(desc(creatorPosts.createdAt)).limit(120),
      loadFollowedCreatorIdsForUser(viewerId),
      loadActiveMembershipCreatorIdsForUser(viewerId),
    ]);

    const visiblePosts = posts.filter((post) => canViewerSeeCreatorPost({
      post,
      viewerId,
      followedCreatorIds,
      memberCreatorIds,
    }));

    const prioritizedPosts = visiblePosts
      .map((post) => ({
        post,
        priority: viewerId
          ? post.creatorUserId === viewerId
            ? 0
            : memberCreatorIds.has(post.creatorUserId)
              ? 1
              : followedCreatorIds.has(post.creatorUserId)
                ? 2
                : 3
          : 0,
      }))
      .sort((a, b) => {
        if (a.priority !== b.priority) return a.priority - b.priority;
        return b.post.createdAt.getTime() - a.post.createdAt.getTime();
      })
      .map((entry) => entry.post);

    const maps = await loadCreatorPostLinkedMaps(prioritizedPosts);
    const items = prioritizedPosts.map((post) => serializeCreatorPost(post, {
      viewerId,
      creator: maps.creatorMap.get(post.creatorUserId) ?? null,
      linkedCollection: post.linkedCollectionId ? maps.collectionMap.get(post.linkedCollectionId) ?? null : null,
      linkedChallenge: post.linkedChallengeId ? maps.challengeMap.get(post.linkedChallengeId) ?? null : null,
      acceptedCollaboration: serializeAcceptedCollaboration(maps.collaborationMap.get(`post:${post.id}`) ?? null, maps.collaborationProfileMap),
    }));

    return res.json({
      ok: true,
      signedIn: Boolean(viewerId),
      count: items.length,
      visibility: {
        public: true,
        followers: Boolean(viewerId),
        members: Boolean(viewerId),
      },
      items,
    });
  } catch (error) {
    const message = logCollectionRouteError("/creator-posts/feed", req, error);
    return res.status(500).json(collectionServerError(message, "Failed to load creator posts feed"));
  }
});

r.get("/drops/feed", optionalAuth, async (req, res) => {
  try {
    await ensureDrinkCollectionsSchema();
    if (!db) {
      return res.status(503).json({ ok: false, error: "Database unavailable" });
    }

    await maybeSendCreatorDropRsvpLiveAlerts();

    const viewerId = req.user?.id ?? null;
    const now = new Date();
    const visibleWindowStart = new Date(now.getTime() - CREATOR_DROP_ARCHIVE_WINDOW_MS);
    const [drops, followedCreatorIds, memberCreatorIds] = await Promise.all([
      db.select()
        .from(creatorDrops)
        .where(and(eq(creatorDrops.isPublished, true), gt(creatorDrops.scheduledFor, visibleWindowStart)))
        .orderBy(asc(creatorDrops.scheduledFor))
        .limit(240),
      loadFollowedCreatorIdsForUser(viewerId),
      loadActiveMembershipCreatorIdsForUser(viewerId),
    ]);

    const visibleDrops = drops.filter((drop) => canViewerSeeCreatorDrop({
      drop,
      viewerId,
      followedCreatorIds,
      memberCreatorIds,
      includeArchived: true,
      now,
    }));

    const statusPriority: Record<CreatorDropStatus, number> = {
      live: 0,
      upcoming: 1,
      archived: 2,
    };

    const prioritizedDrops = visibleDrops
      .map((drop) => ({
        drop,
        status: getCreatorDropStatus(drop, now),
        priority: viewerId
          ? drop.creatorUserId === viewerId
            ? 0
            : memberCreatorIds.has(drop.creatorUserId)
              ? 1
              : followedCreatorIds.has(drop.creatorUserId)
                ? 2
                : 3
          : 3,
      }))
      .sort((a, b) => {
        if (statusPriority[a.status] !== statusPriority[b.status]) {
          return statusPriority[a.status] - statusPriority[b.status];
        }
        if (a.priority !== b.priority) return a.priority - b.priority;
        if (a.status === "live") {
          return b.drop.scheduledFor.getTime() - a.drop.scheduledFor.getTime();
        }
        return a.drop.scheduledFor.getTime() - b.drop.scheduledFor.getTime();
      })
      .map((entry) => entry.drop);

    const [maps, rsvpMaps] = await Promise.all([
      loadCreatorDropLinkedMaps(prioritizedDrops),
      loadCreatorDropRsvpMaps(prioritizedDrops, viewerId),
    ]);
    const items = prioritizedDrops.map((drop) => serializeCreatorDrop(drop, {
      viewerId,
      creator: maps.creatorMap.get(drop.creatorUserId) ?? null,
      linkedCollection: drop.linkedCollectionId ? maps.collectionMap.get(drop.linkedCollectionId) ?? null : null,
      linkedChallenge: drop.linkedChallengeId ? maps.challengeMap.get(drop.linkedChallengeId) ?? null : null,
      linkedPromotion: drop.linkedPromotionId ? maps.promotionMap.get(drop.linkedPromotionId) ?? null : null,
      acceptedCollaboration: serializeAcceptedCollaboration(maps.collaborationMap.get(`drop:${drop.id}`) ?? null, maps.collaborationProfileMap),
      rsvpCount: rsvpMaps.rsvpCountMap.get(drop.id) ?? 0,
      isRsvped: rsvpMaps.viewerRsvpSet.has(drop.id),
    }));

    return res.json({
      ok: true,
      signedIn: Boolean(viewerId),
      count: items.length,
      visibility: {
        public: true,
        followers: Boolean(viewerId),
        members: Boolean(viewerId),
      },
      items,
    });
  } catch (error) {
    const message = logCollectionRouteError("/drops/feed", req, error);
    return res.status(500).json(collectionServerError(message, "Failed to load scheduled drops"));
  }
});

r.get("/drops/creator/:userId", optionalAuth, async (req, res) => {
  try {
    await ensureDrinkCollectionsSchema();
    if (!db) {
      return res.status(503).json({ ok: false, error: "Database unavailable" });
    }

    await maybeSendCreatorDropRsvpLiveAlerts();

    const creatorUserId = String(req.params.userId ?? "").trim();
    if (!creatorUserId) {
      return res.status(400).json({ ok: false, error: "Creator userId is required." });
    }

    const viewerId = req.user?.id ?? null;
    const now = new Date();
    const visibleWindowStart = new Date(now.getTime() - CREATOR_DROP_ARCHIVE_WINDOW_MS);
    const isCreatorView = viewerId === creatorUserId;
    const [acceptedCollaborations, followedCreatorIds, memberCreatorIds] = await Promise.all([
      loadAcceptedCollaborationsForCreator(creatorUserId),
      loadFollowedCreatorIdsForUser(viewerId),
      loadActiveMembershipCreatorIdsForUser(viewerId),
    ]);
    const acceptedDropIds = acceptedCollaborations
      .filter((row) => row.collaborationType === "drop")
      .map((row) => row.targetId);
    const ownDrops = await db
      .select()
      .from(creatorDrops)
      .where(
        isCreatorView
          ? eq(creatorDrops.creatorUserId, creatorUserId)
          : and(eq(creatorDrops.creatorUserId, creatorUserId), gt(creatorDrops.scheduledFor, visibleWindowStart)),
      )
      .orderBy(desc(creatorDrops.scheduledFor))
      .limit(160);
    const collaborativeDrops = acceptedDropIds.length > 0
      ? await db
          .select()
          .from(creatorDrops)
          .where(
            isCreatorView
              ? inArray(creatorDrops.id, acceptedDropIds)
              : and(inArray(creatorDrops.id, acceptedDropIds), gt(creatorDrops.scheduledFor, visibleWindowStart)),
          )
          .orderBy(desc(creatorDrops.scheduledFor))
      : [];
    const drops = [...new Map([...ownDrops, ...collaborativeDrops].map((drop) => [drop.id, drop])).values()];

    const visibleDrops = drops.filter((drop) => canViewerSeeCreatorDrop({
      drop,
      viewerId,
      followedCreatorIds,
      memberCreatorIds,
      includeArchived: true,
      now,
    }));

    const statusPriority: Record<CreatorDropStatus, number> = {
      live: 0,
      upcoming: 1,
      archived: 2,
    };
    const sortedDrops = [...visibleDrops].sort((a, b) => {
      const aStatus = getCreatorDropStatus(a, now);
      const bStatus = getCreatorDropStatus(b, now);
      if (statusPriority[aStatus] !== statusPriority[bStatus]) {
        return statusPriority[aStatus] - statusPriority[bStatus];
      }
      if (aStatus === "live" || aStatus === "archived") {
        return b.scheduledFor.getTime() - a.scheduledFor.getTime();
      }
      return a.scheduledFor.getTime() - b.scheduledFor.getTime();
    });

    const [maps, rsvpMaps] = await Promise.all([
      loadCreatorDropLinkedMaps(sortedDrops),
      loadCreatorDropRsvpMaps(sortedDrops, viewerId),
    ]);
    const items = sortedDrops.map((drop) => serializeCreatorDrop(drop, {
      viewerId,
      creator: maps.creatorMap.get(drop.creatorUserId) ?? null,
      linkedCollection: drop.linkedCollectionId ? maps.collectionMap.get(drop.linkedCollectionId) ?? null : null,
      linkedChallenge: drop.linkedChallengeId ? maps.challengeMap.get(drop.linkedChallengeId) ?? null : null,
      linkedPromotion: drop.linkedPromotionId ? maps.promotionMap.get(drop.linkedPromotionId) ?? null : null,
      acceptedCollaboration: serializeAcceptedCollaboration(maps.collaborationMap.get(`drop:${drop.id}`) ?? null, maps.collaborationProfileMap),
      rsvpCount: rsvpMaps.rsvpCountMap.get(drop.id) ?? 0,
      isRsvped: rsvpMaps.viewerRsvpSet.has(drop.id),
    }));

    return res.json({
      ok: true,
      creatorUserId,
      count: items.length,
      items,
    });
  } catch (error) {
    const message = logCollectionRouteError("/drops/creator/:userId", req, error);
    return res.status(500).json(collectionServerError(message, "Failed to load creator drops"));
  }
});

r.get("/drops/:id", optionalAuth, async (req, res) => {
  try {
    await ensureDrinkCollectionsSchema();
    if (!db) {
      return res.status(503).json({ ok: false, error: "Database unavailable" });
    }

    await maybeSendCreatorDropRsvpLiveAlerts();

    const dropId = String(req.params.id ?? "").trim();
    if (!dropId) {
      return res.status(400).json({ ok: false, error: "Drop id is required." });
    }

    const viewerId = req.user?.id ?? null;
    const access = await loadCreatorDropForViewer(dropId, viewerId);
    if (!access) {
      return res.status(404).json({ ok: false, error: "Drop not found." });
    }

    const [maps, rsvpMaps] = await Promise.all([
      loadCreatorDropLinkedMaps([access.drop]),
      loadCreatorDropRsvpMaps([access.drop], viewerId),
    ]);

    return res.json({
      ok: true,
      drop: serializeCreatorDrop(access.drop, {
        viewerId,
        creator: maps.creatorMap.get(access.drop.creatorUserId) ?? null,
        linkedCollection: access.drop.linkedCollectionId ? maps.collectionMap.get(access.drop.linkedCollectionId) ?? null : null,
        linkedChallenge: access.drop.linkedChallengeId ? maps.challengeMap.get(access.drop.linkedChallengeId) ?? null : null,
        linkedPromotion: access.drop.linkedPromotionId ? maps.promotionMap.get(access.drop.linkedPromotionId) ?? null : null,
        acceptedCollaboration: serializeAcceptedCollaboration(maps.collaborationMap.get(`drop:${access.drop.id}`) ?? null, maps.collaborationProfileMap),
        rsvpCount: rsvpMaps.rsvpCountMap.get(access.drop.id) ?? 0,
        isRsvped: rsvpMaps.viewerRsvpSet.has(access.drop.id),
      }),
    });
  } catch (error) {
    const message = logCollectionRouteError("/drops/:id", req, error);
    return res.status(500).json(collectionServerError(message, "Failed to load creator drop"));
  }
});

r.post("/drops/:id/events", optionalAuth, async (req, res) => {
  try {
    await ensureDrinkCollectionsSchema();
    if (!db) {
      return res.status(503).json({ ok: false, error: "Database unavailable" });
    }

    const dropId = String(req.params.id ?? "").trim();
    const parsed = z.object({
      eventType: z.enum(["view_drop", "click_drop_target"]),
      targetType: z.enum(["collection", "challenge", "promo", "campaign"]).optional().nullable(),
      targetId: z.string().trim().optional().nullable(),
    }).safeParse(req.body ?? {});

    if (!dropId) {
      return res.status(400).json({ ok: false, error: "Drop id is required." });
    }
    if (!parsed.success) {
      return res.status(400).json({ ok: false, error: parsed.error.issues[0]?.message ?? "Invalid drop event payload." });
    }

    const access = await loadCreatorDropForViewer(dropId, req.user?.id ?? null);
    if (!access) {
      return res.status(404).json({ ok: false, error: "Drop not found." });
    }

    const values = insertCreatorDropEventSchema.parse({
      dropId,
      eventType: parsed.data.eventType,
      userId: req.user?.id ?? null,
      targetType: parsed.data.targetType ?? null,
      targetId: parsed.data.targetId ?? null,
    });
    await db.insert(creatorDropEvents).values(values);

    return res.status(201).json({ ok: true });
  } catch (error) {
    const message = logCollectionRouteError("/drops/:id/events", req, error);
    return res.status(500).json(collectionServerError(message, "Failed to track drop event"));
  }
});

r.get("/drops/:id/rsvp-status", requireAuth, async (req, res) => {
  try {
    await ensureDrinkCollectionsSchema();
    if (!db) {
      return res.status(503).json({ ok: false, error: "Database unavailable" });
    }

    const dropId = String(req.params.id ?? "").trim();
    if (!dropId) {
      return res.status(400).json({ ok: false, error: "Drop id is required." });
    }

    const access = await loadCreatorDropForViewer(dropId, req.user!.id);
    if (!access) {
      return res.status(404).json({ ok: false, error: "Drop not found." });
    }

    const [countRows, viewerRows] = await Promise.all([
      db
        .select({ count: sql<number>`count(*)::int` })
        .from(creatorDropRsvps)
        .where(eq(creatorDropRsvps.dropId, dropId)),
      db
        .select({ id: creatorDropRsvps.id })
        .from(creatorDropRsvps)
        .where(and(eq(creatorDropRsvps.dropId, dropId), eq(creatorDropRsvps.userId, req.user!.id)))
        .limit(1),
    ]);

    return res.json({
      ok: true,
      dropId,
      isRsvped: Boolean(viewerRows[0]),
      rsvpCount: Number(countRows[0]?.count ?? 0),
      canManageInterest: access.isCreator,
    });
  } catch (error) {
    const message = logCollectionRouteError("/drops/:id/rsvp-status", req, error);
    return res.status(500).json(collectionServerError(message, "Failed to load drop RSVP status"));
  }
});

r.get("/drops/:id/rsvps", requireAuth, async (req, res) => {
  try {
    await ensureDrinkCollectionsSchema();
    if (!db) {
      return res.status(503).json({ ok: false, error: "Database unavailable" });
    }

    const dropId = String(req.params.id ?? "").trim();
    if (!dropId) {
      return res.status(400).json({ ok: false, error: "Drop id is required." });
    }

    const rows = await db
      .select()
      .from(creatorDrops)
      .where(and(eq(creatorDrops.id, dropId), eq(creatorDrops.creatorUserId, req.user!.id)))
      .limit(1);

    if (!rows[0]) {
      return res.status(404).json({ ok: false, error: "Drop not found." });
    }

    const [countRows, rsvpRows] = await Promise.all([
      db
        .select({ count: sql<number>`count(*)::int` })
        .from(creatorDropRsvps)
        .where(eq(creatorDropRsvps.dropId, dropId)),
      db
        .select({
          id: creatorDropRsvps.id,
          userId: creatorDropRsvps.userId,
          createdAt: creatorDropRsvps.createdAt,
          username: users.username,
          avatar: users.avatar,
        })
        .from(creatorDropRsvps)
        .innerJoin(users, eq(users.id, creatorDropRsvps.userId))
        .where(eq(creatorDropRsvps.dropId, dropId))
        .orderBy(desc(creatorDropRsvps.createdAt))
        .limit(50),
    ]);

    return res.json({
      ok: true,
      dropId,
      rsvpCount: Number(countRows[0]?.count ?? 0),
      items: rsvpRows.map((row) => ({
        id: row.id,
        userId: row.userId,
        createdAt: row.createdAt.toISOString(),
        username: row.username ?? null,
        avatar: row.avatar ?? null,
      })),
    });
  } catch (error) {
    const message = logCollectionRouteError("/drops/:id/rsvps", req, error);
    return res.status(500).json(collectionServerError(message, "Failed to load drop RSVPs"));
  }
});

r.post("/drops/:id/rsvp", requireAuth, async (req, res) => {
  try {
    await ensureDrinkCollectionsSchema();
    if (!db) {
      return res.status(503).json({ ok: false, error: "Database unavailable" });
    }

    const dropId = String(req.params.id ?? "").trim();
    if (!dropId) {
      return res.status(400).json({ ok: false, error: "Drop id is required." });
    }

    const access = await loadCreatorDropForViewer(dropId, req.user!.id);
    if (!access || getCreatorDropStatus(access.drop) !== "upcoming") {
      return res.status(404).json({ ok: false, error: "Drop not found." });
    }

    if (!access.drop.isPublished && !access.isCreator) {
      return res.status(404).json({ ok: false, error: "Drop not found." });
    }

    const values = insertCreatorDropRsvpSchema.parse({
      userId: req.user!.id,
      dropId,
    });

    await db
      .insert(creatorDropRsvps)
      .values(values)
      .onConflictDoNothing({ target: [creatorDropRsvps.userId, creatorDropRsvps.dropId] });

    const countRows = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(creatorDropRsvps)
      .where(eq(creatorDropRsvps.dropId, dropId));

    return res.status(201).json({
      ok: true,
      dropId,
      isRsvped: true,
      rsvpCount: Number(countRows[0]?.count ?? 0),
    });
  } catch (error) {
    const message = logCollectionRouteError("/drops/:id/rsvp", req, error);
    return res.status(500).json(collectionServerError(message, "Failed to RSVP to drop"));
  }
});

r.delete("/drops/:id/rsvp", requireAuth, async (req, res) => {
  try {
    await ensureDrinkCollectionsSchema();
    if (!db) {
      return res.status(503).json({ ok: false, error: "Database unavailable" });
    }

    const dropId = String(req.params.id ?? "").trim();
    if (!dropId) {
      return res.status(400).json({ ok: false, error: "Drop id is required." });
    }

    const access = await loadCreatorDropForViewer(dropId, req.user!.id);
    if (!access) {
      return res.status(404).json({ ok: false, error: "Drop not found." });
    }

    await db
      .delete(creatorDropRsvps)
      .where(and(eq(creatorDropRsvps.dropId, dropId), eq(creatorDropRsvps.userId, req.user!.id)));

    const countRows = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(creatorDropRsvps)
      .where(eq(creatorDropRsvps.dropId, dropId));

    return res.json({
      ok: true,
      dropId,
      isRsvped: false,
      rsvpCount: Number(countRows[0]?.count ?? 0),
    });
  } catch (error) {
    const message = logCollectionRouteError("/drops/:id/rsvp", req, error);
    return res.status(500).json(collectionServerError(message, "Failed to remove drop RSVP"));
  }
});

r.post("/drops", requireAuth, async (req, res) => {
  try {
    await ensureDrinkCollectionsSchema();
    if (!db) {
      return res.status(503).json({ ok: false, error: "Database unavailable" });
    }

    const parsed = createCreatorDropBodySchema.safeParse(req.body ?? {});
    if (!parsed.success) {
      return res.status(400).json({ ok: false, error: parsed.error.issues[0]?.message ?? "Invalid creator drop payload." });
    }

    const payload = parsed.data;
    const values = insertCreatorDropSchema.parse({
      creatorUserId: req.user!.id,
      title: payload.title.trim(),
      description: payload.description?.trim() ? payload.description.trim() : null,
      dropType: payload.dropType === "member_drop" ? "member_drop" : payload.dropType,
      visibility: payload.dropType === "member_drop" ? "members" : payload.visibility,
      scheduledFor: new Date(payload.scheduledFor),
      linkedCollectionId: normalizeNullableForeignId(payload.linkedCollectionId),
      linkedChallengeId: normalizeNullableForeignId(payload.linkedChallengeId),
      linkedPromotionId: normalizeNullableForeignId(payload.linkedPromotionId),
      recapNotes: payload.recapNotes?.trim() ? payload.recapNotes.trim() : null,
      isPublished: payload.isPublished ?? true,
    });

    await validateCreatorDropLinkedEntities({
      creatorUserId: values.creatorUserId,
      visibility: values.visibility as CreatorDropVisibility,
      dropType: values.dropType as CreatorDropType,
      linkedCollectionId: values.linkedCollectionId,
      linkedChallengeId: values.linkedChallengeId,
      linkedPromotionId: values.linkedPromotionId,
    });

    const inserted = await db.insert(creatorDrops).values({
      ...values,
      updatedAt: new Date(),
    }).returning();
    const drop = inserted[0];
    if (!drop) {
      return res.status(500).json({ ok: false, error: "Failed to create creator drop." });
    }

    await maybeSendCreatorDropAlerts(drop);
    const [maps, rsvpMaps] = await Promise.all([
      loadCreatorDropLinkedMaps([drop]),
      loadCreatorDropRsvpMaps([drop], req.user!.id),
    ]);
    return res.status(201).json({
      ok: true,
      drop: serializeCreatorDrop(drop, {
        viewerId: req.user!.id,
        creator: maps.creatorMap.get(drop.creatorUserId) ?? null,
        linkedCollection: drop.linkedCollectionId ? maps.collectionMap.get(drop.linkedCollectionId) ?? null : null,
        linkedChallenge: drop.linkedChallengeId ? maps.challengeMap.get(drop.linkedChallengeId) ?? null : null,
        linkedPromotion: drop.linkedPromotionId ? maps.promotionMap.get(drop.linkedPromotionId) ?? null : null,
        acceptedCollaboration: serializeAcceptedCollaboration(maps.collaborationMap.get(`drop:${drop.id}`) ?? null, maps.collaborationProfileMap),
        rsvpCount: rsvpMaps.rsvpCountMap.get(drop.id) ?? 0,
        isRsvped: rsvpMaps.viewerRsvpSet.has(drop.id),
      }),
    });
  } catch (error) {
    const message = logCollectionRouteError("/drops", req, error);
    return res.status(500).json(collectionServerError(message, "Failed to create creator drop"));
  }
});

r.patch("/drops/:id", requireAuth, async (req, res) => {
  try {
    await ensureDrinkCollectionsSchema();
    if (!db) {
      return res.status(503).json({ ok: false, error: "Database unavailable" });
    }

    const dropId = String(req.params.id ?? "").trim();
    if (!dropId) {
      return res.status(400).json({ ok: false, error: "Drop id is required." });
    }

    const parsed = updateCreatorDropBodySchema.safeParse(req.body ?? {});
    if (!parsed.success) {
      return res.status(400).json({ ok: false, error: parsed.error.issues[0]?.message ?? "Invalid creator drop payload." });
    }

    const existingRows = await db
      .select()
      .from(creatorDrops)
      .where(and(eq(creatorDrops.id, dropId), eq(creatorDrops.creatorUserId, req.user!.id)))
      .limit(1);

    const existing = existingRows[0];
    if (!existing) {
      return res.status(404).json({ ok: false, error: "Creator drop not found." });
    }

    const payload = parsed.data;
    const nextDropType = (payload.dropType ?? existing.dropType) as CreatorDropType;
    const nextVisibility = (nextDropType === "member_drop" ? "members" : (payload.visibility ?? existing.visibility)) as CreatorDropVisibility;
    const nextScheduledFor = payload.scheduledFor ? new Date(payload.scheduledFor) : existing.scheduledFor;

    if (Number.isNaN(nextScheduledFor.getTime())) {
      return res.status(400).json({ ok: false, error: "Drops must use a valid scheduled time." });
    }
    if (payload.scheduledFor !== undefined && nextScheduledFor <= new Date()) {
      return res.status(400).json({ ok: false, error: "Only upcoming drops can be rescheduled into the future. Leave timing unchanged to update launch notes." });
    }

    const values = {
      title: payload.title?.trim() ?? existing.title,
      description: payload.description !== undefined ? (payload.description?.trim() ? payload.description.trim() : null) : existing.description,
      dropType: nextDropType,
      visibility: nextVisibility,
      scheduledFor: nextScheduledFor,
      linkedCollectionId: payload.linkedCollectionId !== undefined ? normalizeNullableForeignId(payload.linkedCollectionId) : existing.linkedCollectionId,
      linkedChallengeId: payload.linkedChallengeId !== undefined ? normalizeNullableForeignId(payload.linkedChallengeId) : existing.linkedChallengeId,
      linkedPromotionId: payload.linkedPromotionId !== undefined ? normalizeNullableForeignId(payload.linkedPromotionId) : existing.linkedPromotionId,
      recapNotes: payload.recapNotes !== undefined ? (payload.recapNotes?.trim() ? payload.recapNotes.trim() : null) : existing.recapNotes,
      isPublished: payload.isPublished ?? existing.isPublished,
      updatedAt: new Date(),
    };

    await validateCreatorDropLinkedEntities({
      creatorUserId: req.user!.id,
      visibility: values.visibility,
      dropType: values.dropType,
      linkedCollectionId: values.linkedCollectionId,
      linkedChallengeId: values.linkedChallengeId,
      linkedPromotionId: values.linkedPromotionId,
    });

    const updatedRows = await db
      .update(creatorDrops)
      .set(values)
      .where(eq(creatorDrops.id, dropId))
      .returning();

    const drop = updatedRows[0];
    if (drop && (existing.scheduledFor.getTime() !== drop.scheduledFor.getTime() || existing.visibility !== drop.visibility || existing.isPublished !== drop.isPublished)) {
      await maybeSendCreatorDropAlerts(drop);
    }

    const [maps, rsvpMaps] = await Promise.all([
      loadCreatorDropLinkedMaps(drop ? [drop] : []),
      loadCreatorDropRsvpMaps(drop ? [drop] : [], req.user!.id),
    ]);
    return res.json({
      ok: true,
      drop: drop ? serializeCreatorDrop(drop, {
        viewerId: req.user!.id,
        creator: maps.creatorMap.get(drop.creatorUserId) ?? null,
        linkedCollection: drop.linkedCollectionId ? maps.collectionMap.get(drop.linkedCollectionId) ?? null : null,
        linkedChallenge: drop.linkedChallengeId ? maps.challengeMap.get(drop.linkedChallengeId) ?? null : null,
        linkedPromotion: drop.linkedPromotionId ? maps.promotionMap.get(drop.linkedPromotionId) ?? null : null,
        acceptedCollaboration: serializeAcceptedCollaboration(maps.collaborationMap.get(`drop:${drop.id}`) ?? null, maps.collaborationProfileMap),
        rsvpCount: rsvpMaps.rsvpCountMap.get(drop.id) ?? 0,
        isRsvped: rsvpMaps.viewerRsvpSet.has(drop.id),
      }) : null,
    });
  } catch (error) {
    const message = logCollectionRouteError("/drops/:id", req, error);
    return res.status(500).json(collectionServerError(message, "Failed to update creator drop"));
  }
});

r.delete("/drops/:id", requireAuth, async (req, res) => {
  try {
    await ensureDrinkCollectionsSchema();
    if (!db) {
      return res.status(503).json({ ok: false, error: "Database unavailable" });
    }

    const dropId = String(req.params.id ?? "").trim();
    if (!dropId) {
      return res.status(400).json({ ok: false, error: "Drop id is required." });
    }

    const deletedRows = await db
      .delete(creatorDrops)
      .where(and(eq(creatorDrops.id, dropId), eq(creatorDrops.creatorUserId, req.user!.id)))
      .returning({ id: creatorDrops.id });

    if (!deletedRows[0]) {
      return res.status(404).json({ ok: false, error: "Creator drop not found." });
    }

    return res.json({ ok: true, deletedId: deletedRows[0].id });
  } catch (error) {
    const message = logCollectionRouteError("/drops/:id", req, error);
    return res.status(500).json(collectionServerError(message, "Failed to delete creator drop"));
  }
});

r.get("/roadmap/feed", optionalAuth, async (req, res) => {
  try {
    await ensureDrinkCollectionsSchema();
    if (!db) {
      return res.status(503).json({ ok: false, error: "Database unavailable" });
    }

    const viewerId = req.user?.id ?? null;
    const [roadmapItems, followedCreatorIds, memberCreatorIds] = await Promise.all([
      db.select().from(creatorRoadmapItems).orderBy(desc(creatorRoadmapItems.updatedAt)).limit(240),
      loadFollowedCreatorIdsForUser(viewerId),
      loadActiveMembershipCreatorIdsForUser(viewerId),
    ]);

    const visibleItems = sortCreatorRoadmapItems(roadmapItems.filter((item) => canViewerSeeCreatorRoadmapItem({
      item,
      viewerId,
      followedCreatorIds,
      memberCreatorIds,
    })));

    const maps = await loadCreatorRoadmapLinkedMaps(visibleItems);
    const items = visibleItems.map((item) => serializeCreatorRoadmapItem(item, {
      viewerId,
      creator: maps.creatorMap.get(item.creatorUserId) ?? null,
      linkedCollection: item.linkedCollectionId ? maps.collectionMap.get(item.linkedCollectionId) ?? null : null,
      linkedChallenge: item.linkedChallengeId ? maps.challengeMap.get(item.linkedChallengeId) ?? null : null,
      acceptedCollaboration: serializeAcceptedCollaboration(maps.collaborationMap.get(`roadmap:${item.id}`) ?? null, maps.collaborationProfileMap),
    }));

    return res.json({
      ok: true,
      signedIn: Boolean(viewerId),
      count: items.length,
      visibility: {
        public: true,
        followers: Boolean(viewerId),
        members: Boolean(viewerId),
      },
      counts: {
        upcoming: items.filter((item) => item.status === "upcoming").length,
        live: items.filter((item) => item.status === "live").length,
        archived: items.filter((item) => item.status === "archived").length,
      },
      items,
    });
  } catch (error) {
    const message = logCollectionRouteError("/roadmap/feed", req, error);
    return res.status(500).json(collectionServerError(message, "Failed to load creator roadmap"));
  }
});

r.get("/roadmap/creator/:userId", optionalAuth, async (req, res) => {
  try {
    await ensureDrinkCollectionsSchema();
    if (!db) {
      return res.status(503).json({ ok: false, error: "Database unavailable" });
    }

    const creatorUserId = String(req.params.userId ?? "").trim();
    if (!creatorUserId) {
      return res.status(400).json({ ok: false, error: "Creator userId is required." });
    }

    const viewerId = req.user?.id ?? null;
    const [acceptedCollaborations, followedCreatorIds, memberCreatorIds] = await Promise.all([
      loadAcceptedCollaborationsForCreator(creatorUserId),
      loadFollowedCreatorIdsForUser(viewerId),
      loadActiveMembershipCreatorIdsForUser(viewerId),
    ]);
    const acceptedRoadmapIds = acceptedCollaborations
      .filter((row) => row.collaborationType === "roadmap")
      .map((row) => row.targetId);
    const ownRoadmapItems = await db
      .select()
      .from(creatorRoadmapItems)
      .where(eq(creatorRoadmapItems.creatorUserId, creatorUserId))
      .orderBy(desc(creatorRoadmapItems.updatedAt))
      .limit(160);
    const collaborativeRoadmapItems = acceptedRoadmapIds.length > 0
      ? await db
          .select()
          .from(creatorRoadmapItems)
          .where(inArray(creatorRoadmapItems.id, acceptedRoadmapIds))
          .orderBy(desc(creatorRoadmapItems.updatedAt))
      : [];
    const roadmapItems = [...new Map([...ownRoadmapItems, ...collaborativeRoadmapItems].map((item) => [item.id, item])).values()];

    const visibleItems = sortCreatorRoadmapItems(roadmapItems.filter((item) => canViewerSeeCreatorRoadmapItem({
      item,
      viewerId,
      followedCreatorIds,
      memberCreatorIds,
    })));

    const maps = await loadCreatorRoadmapLinkedMaps(visibleItems);
    const items = visibleItems.map((item) => serializeCreatorRoadmapItem(item, {
      viewerId,
      creator: maps.creatorMap.get(item.creatorUserId) ?? null,
      linkedCollection: item.linkedCollectionId ? maps.collectionMap.get(item.linkedCollectionId) ?? null : null,
      linkedChallenge: item.linkedChallengeId ? maps.challengeMap.get(item.linkedChallengeId) ?? null : null,
      acceptedCollaboration: serializeAcceptedCollaboration(maps.collaborationMap.get(`roadmap:${item.id}`) ?? null, maps.collaborationProfileMap),
    }));

    return res.json({
      ok: true,
      creatorUserId,
      count: items.length,
      counts: {
        upcoming: items.filter((item) => item.status === "upcoming").length,
        live: items.filter((item) => item.status === "live").length,
        archived: items.filter((item) => item.status === "archived").length,
      },
      items,
    });
  } catch (error) {
    const message = logCollectionRouteError("/roadmap/creator/:userId", req, error);
    return res.status(500).json(collectionServerError(message, "Failed to load creator roadmap"));
  }
});

r.post("/roadmap", requireAuth, async (req, res) => {
  try {
    await ensureDrinkCollectionsSchema();
    if (!db) {
      return res.status(503).json({ ok: false, error: "Database unavailable" });
    }

    const parsed = createCreatorRoadmapBodySchema.safeParse(req.body ?? {});
    if (!parsed.success) {
      return res.status(400).json({ ok: false, error: parsed.error.issues[0]?.message ?? "Invalid creator roadmap payload." });
    }

    const payload = parsed.data;
    const values = insertCreatorRoadmapItemSchema.parse({
      creatorUserId: req.user!.id,
      title: payload.title.trim(),
      description: payload.description?.trim() ? payload.description.trim() : null,
      itemType: payload.itemType,
      visibility: payload.itemType === "member_drop" ? "members" : payload.visibility,
      linkedCollectionId: normalizeNullableForeignId(payload.linkedCollectionId),
      linkedChallengeId: normalizeNullableForeignId(payload.linkedChallengeId),
      scheduledFor: payload.scheduledFor ? new Date(payload.scheduledFor) : null,
      releasedAt: payload.releasedAt ? new Date(payload.releasedAt) : (payload.status === "live" || payload.status === "archived" ? new Date() : null),
      status: payload.status,
    });

    await validateCreatorRoadmapLinkedEntities({
      creatorUserId: values.creatorUserId,
      itemType: values.itemType as CreatorRoadmapItemType,
      visibility: values.visibility as CreatorRoadmapVisibility,
      linkedCollectionId: values.linkedCollectionId,
      linkedChallengeId: values.linkedChallengeId,
    });

    const inserted = await db.insert(creatorRoadmapItems).values({
      ...values,
      updatedAt: new Date(),
    }).returning();
    const item = inserted[0];
    if (!item) {
      return res.status(500).json({ ok: false, error: "Failed to create creator roadmap item." });
    }

    const maps = await loadCreatorRoadmapLinkedMaps([item]);
    return res.status(201).json({
      ok: true,
      item: serializeCreatorRoadmapItem(item, {
        viewerId: req.user!.id,
        creator: maps.creatorMap.get(item.creatorUserId) ?? null,
        linkedCollection: item.linkedCollectionId ? maps.collectionMap.get(item.linkedCollectionId) ?? null : null,
        linkedChallenge: item.linkedChallengeId ? maps.challengeMap.get(item.linkedChallengeId) ?? null : null,
        acceptedCollaboration: serializeAcceptedCollaboration(maps.collaborationMap.get(`roadmap:${item.id}`) ?? null, maps.collaborationProfileMap),
      }),
    });
  } catch (error) {
    const message = logCollectionRouteError("/roadmap", req, error);
    return res.status(500).json(collectionServerError(message, "Failed to create roadmap item"));
  }
});

r.patch("/roadmap/:id", requireAuth, async (req, res) => {
  try {
    await ensureDrinkCollectionsSchema();
    if (!db) {
      return res.status(503).json({ ok: false, error: "Database unavailable" });
    }

    const roadmapId = String(req.params.id ?? "").trim();
    if (!roadmapId) {
      return res.status(400).json({ ok: false, error: "Roadmap item id is required." });
    }

    const parsed = updateCreatorRoadmapBodySchema.safeParse(req.body ?? {});
    if (!parsed.success) {
      return res.status(400).json({ ok: false, error: parsed.error.issues[0]?.message ?? "Invalid creator roadmap payload." });
    }

    const existingRows = await db
      .select()
      .from(creatorRoadmapItems)
      .where(and(eq(creatorRoadmapItems.id, roadmapId), eq(creatorRoadmapItems.creatorUserId, req.user!.id)))
      .limit(1);

    const existing = existingRows[0];
    if (!existing) {
      return res.status(404).json({ ok: false, error: "Creator roadmap item not found." });
    }

    const payload = parsed.data;
    const nextItemType = (payload.itemType ?? existing.itemType) as CreatorRoadmapItemType;
    const nextStatus = (payload.status ?? existing.status) as CreatorRoadmapStatus;
    const nextVisibility = (nextItemType === "member_drop" ? "members" : (payload.visibility ?? existing.visibility)) as CreatorRoadmapVisibility;
    const nextReleasedAt = payload.releasedAt !== undefined
      ? (payload.releasedAt ? new Date(payload.releasedAt) : null)
      : nextStatus === "upcoming"
        ? null
        : existing.releasedAt ?? new Date();

    const values = {
      title: payload.title?.trim() ?? existing.title,
      description: payload.description !== undefined ? (payload.description?.trim() ? payload.description.trim() : null) : existing.description,
      itemType: nextItemType,
      visibility: nextVisibility,
      linkedCollectionId: payload.linkedCollectionId !== undefined ? normalizeNullableForeignId(payload.linkedCollectionId) : existing.linkedCollectionId,
      linkedChallengeId: payload.linkedChallengeId !== undefined ? normalizeNullableForeignId(payload.linkedChallengeId) : existing.linkedChallengeId,
      scheduledFor: payload.scheduledFor !== undefined ? (payload.scheduledFor ? new Date(payload.scheduledFor) : null) : existing.scheduledFor,
      releasedAt: nextReleasedAt,
      status: nextStatus,
      updatedAt: new Date(),
    };

    await validateCreatorRoadmapLinkedEntities({
      creatorUserId: req.user!.id,
      itemType: values.itemType,
      visibility: values.visibility,
      linkedCollectionId: values.linkedCollectionId,
      linkedChallengeId: values.linkedChallengeId,
    });

    const updatedRows = await db
      .update(creatorRoadmapItems)
      .set(values)
      .where(eq(creatorRoadmapItems.id, roadmapId))
      .returning();

    const item = updatedRows[0];
    const maps = await loadCreatorRoadmapLinkedMaps(item ? [item] : []);
    return res.json({
      ok: true,
      item: item ? serializeCreatorRoadmapItem(item, {
        viewerId: req.user!.id,
        creator: maps.creatorMap.get(item.creatorUserId) ?? null,
        linkedCollection: item.linkedCollectionId ? maps.collectionMap.get(item.linkedCollectionId) ?? null : null,
        linkedChallenge: item.linkedChallengeId ? maps.challengeMap.get(item.linkedChallengeId) ?? null : null,
        acceptedCollaboration: serializeAcceptedCollaboration(maps.collaborationMap.get(`roadmap:${item.id}`) ?? null, maps.collaborationProfileMap),
      }) : null,
    });
  } catch (error) {
    const message = logCollectionRouteError("/roadmap/:id", req, error);
    return res.status(500).json(collectionServerError(message, "Failed to update roadmap item"));
  }
});

r.delete("/roadmap/:id", requireAuth, async (req, res) => {
  try {
    await ensureDrinkCollectionsSchema();
    if (!db) {
      return res.status(503).json({ ok: false, error: "Database unavailable" });
    }

    const roadmapId = String(req.params.id ?? "").trim();
    if (!roadmapId) {
      return res.status(400).json({ ok: false, error: "Roadmap item id is required." });
    }

    const deletedRows = await db
      .delete(creatorRoadmapItems)
      .where(and(eq(creatorRoadmapItems.id, roadmapId), eq(creatorRoadmapItems.creatorUserId, req.user!.id)))
      .returning({ id: creatorRoadmapItems.id });

    if (!deletedRows[0]) {
      return res.status(404).json({ ok: false, error: "Creator roadmap item not found." });
    }

    return res.json({ ok: true, deletedId: deletedRows[0].id });
  } catch (error) {
    const message = logCollectionRouteError("/roadmap/:id", req, error);
    return res.status(500).json(collectionServerError(message, "Failed to delete roadmap item"));
  }
});

r.get("/campaigns", optionalAuth, async (req, res) => {
  try {
    await ensureDrinkCollectionsSchema();
    if (!db) {
      return res.status(503).json({ ok: false, error: "Database unavailable" });
    }

    const viewerId = req.user?.id ?? null;
    const [campaigns, followedCreatorIds, memberCreatorIds, followedCampaignIds] = await Promise.all([
      db.select().from(creatorCampaigns).orderBy(desc(creatorCampaigns.updatedAt)).limit(160),
      loadFollowedCreatorIdsForUser(viewerId),
      loadActiveMembershipCreatorIdsForUser(viewerId),
      loadFollowedCampaignIdsForUser(viewerId),
    ]);

    const visibleCampaigns = campaigns.filter((campaign) => canViewerSeeCreatorCampaign({
      campaign,
      viewerId,
      followedCreatorIds,
      memberCreatorIds,
    }));
    const maps = await loadCreatorCampaignSummaryMaps(visibleCampaigns);

    return res.json({
      ok: true,
      count: visibleCampaigns.length,
      items: visibleCampaigns.map((campaign) => serializeCreatorCampaign(campaign, {
        viewerId,
        creator: maps.creatorMap.get(campaign.creatorUserId) ?? null,
        counts: maps.countsMap.get(campaign.id),
        followerCount: maps.followerCountMap.get(campaign.id) ?? 0,
        isFollowing: followedCampaignIds.has(campaign.id),
      })),
    });
  } catch (error) {
    const message = logCollectionRouteError("/campaigns", req, error);
    return res.status(500).json(collectionServerError(message, "Failed to load creator campaigns"));
  }
});

r.get("/campaigns/creator/:userId", optionalAuth, async (req, res) => {
  try {
    await ensureDrinkCollectionsSchema();
    if (!db) {
      return res.status(503).json({ ok: false, error: "Database unavailable" });
    }

    const creatorUserId = String(req.params.userId ?? "").trim();
    if (!creatorUserId) {
      return res.status(400).json({ ok: false, error: "Creator userId is required." });
    }

    const viewerId = req.user?.id ?? null;
    const [campaigns, followedCreatorIds, memberCreatorIds, followedCampaignIds] = await Promise.all([
      db.select().from(creatorCampaigns).where(eq(creatorCampaigns.creatorUserId, creatorUserId)).orderBy(desc(creatorCampaigns.updatedAt)).limit(80),
      loadFollowedCreatorIdsForUser(viewerId),
      loadActiveMembershipCreatorIdsForUser(viewerId),
      loadFollowedCampaignIdsForUser(viewerId),
    ]);

    const visibleCampaigns = campaigns.filter((campaign) => canViewerSeeCreatorCampaign({
      campaign,
      viewerId,
      followedCreatorIds,
      memberCreatorIds,
    }));
    const maps = await loadCreatorCampaignSummaryMaps(visibleCampaigns);

    return res.json({
      ok: true,
      creatorUserId,
      count: visibleCampaigns.length,
      items: visibleCampaigns.map((campaign) => serializeCreatorCampaign(campaign, {
        viewerId,
        creator: maps.creatorMap.get(campaign.creatorUserId) ?? null,
        counts: maps.countsMap.get(campaign.id),
        followerCount: maps.followerCountMap.get(campaign.id) ?? 0,
        isFollowing: followedCampaignIds.has(campaign.id),
      })),
    });
  } catch (error) {
    const message = logCollectionRouteError("/campaigns/creator/:userId", req, error);
    return res.status(500).json(collectionServerError(message, "Failed to load creator campaigns"));
  }
});

r.get("/campaigns/following", requireAuth, async (req, res) => {
  try {
    await ensureDrinkCollectionsSchema();
    if (!db) {
      return res.status(503).json({ ok: false, error: "Database unavailable" });
    }

    const viewerId = req.user!.id;
    const [followRows, followedCreatorIds, memberCreatorIds] = await Promise.all([
      db
        .select({ campaignId: creatorCampaignFollows.campaignId, createdAt: creatorCampaignFollows.createdAt })
        .from(creatorCampaignFollows)
        .where(eq(creatorCampaignFollows.userId, viewerId))
        .orderBy(desc(creatorCampaignFollows.createdAt))
        .limit(120),
      loadFollowedCreatorIdsForUser(viewerId),
      loadActiveMembershipCreatorIdsForUser(viewerId),
    ]);

    const campaignIds = followRows.map((row) => row.campaignId).filter(Boolean);
    if (campaignIds.length === 0) {
      return res.json({ ok: true, count: 0, items: [] });
    }

    const campaigns = await db
      .select()
      .from(creatorCampaigns)
      .where(inArray(creatorCampaigns.id, campaignIds));

    const visibleCampaigns = campaigns.filter((campaign) => canViewerSeeCreatorCampaign({
      campaign,
      viewerId,
      followedCreatorIds,
      memberCreatorIds,
    }));

    const campaignMap = new Map(visibleCampaigns.map((campaign) => [campaign.id, campaign]));
    const orderedCampaigns = followRows
      .map((row) => campaignMap.get(row.campaignId))
      .filter((campaign): campaign is CreatorCampaignRecord => Boolean(campaign));

    const details = await Promise.all(orderedCampaigns.map((campaign) => loadCreatorCampaignDetail(campaign, viewerId)));

    return res.json({
      ok: true,
      count: details.length,
      items: details.map((detail) => ({
        campaign: detail.campaign,
        recentUpdates: buildCreatorCampaignUpdateItems(detail).slice(0, 3),
        linkedCounts: detail.campaign.counts,
      })),
    });
  } catch (error) {
    const message = logCollectionRouteError("/campaigns/following", req, error);
    return res.status(500).json(collectionServerError(message, "Failed to load followed campaigns"));
  }
});

r.get("/campaigns/:id/follow-status", optionalAuth, async (req, res) => {
  try {
    await ensureDrinkCollectionsSchema();
    if (!db) {
      return res.status(503).json({ ok: false, error: "Database unavailable" });
    }

    const campaignId = String(req.params.id ?? "").trim();
    if (!campaignId) {
      return res.status(400).json({ ok: false, error: "Campaign id is required." });
    }

    const campaignRows = await db.select().from(creatorCampaigns).where(eq(creatorCampaigns.id, campaignId)).limit(1);
    const campaign = campaignRows[0];
    if (!campaign) {
      return res.status(404).json({ ok: false, error: "Campaign not found." });
    }

    const viewerId = req.user?.id ?? null;
    const [followedCreatorIds, memberCreatorIds, followerCountMap, followedCampaignIds] = await Promise.all([
      loadFollowedCreatorIdsForUser(viewerId),
      loadActiveMembershipCreatorIdsForUser(viewerId),
      loadCampaignFollowerCountMap([campaignId]),
      loadFollowedCampaignIdsForUser(viewerId),
    ]);

    if (!canViewerSeeCreatorCampaign({ campaign, viewerId, followedCreatorIds, memberCreatorIds })) {
      return res.status(404).json({ ok: false, error: "Campaign not found." });
    }

    return res.json({
      ok: true,
      campaignId,
      isFollowing: viewerId ? followedCampaignIds.has(campaignId) : false,
      followerCount: followerCountMap.get(campaignId) ?? 0,
      canFollow: Boolean(viewerId && viewerId !== campaign.creatorUserId),
    });
  } catch (error) {
    const message = logCollectionRouteError("/campaigns/:id/follow-status", req, error);
    return res.status(500).json(collectionServerError(message, "Failed to load campaign follow status"));
  }
});

r.post("/campaigns/:id/follow", requireAuth, async (req, res) => {
  try {
    await ensureDrinkCollectionsSchema();
    if (!db) {
      return res.status(503).json({ ok: false, error: "Database unavailable" });
    }

    const campaignId = String(req.params.id ?? "").trim();
    if (!campaignId) {
      return res.status(400).json({ ok: false, error: "Campaign id is required." });
    }

    const campaignRows = await db.select().from(creatorCampaigns).where(eq(creatorCampaigns.id, campaignId)).limit(1);
    const campaign = campaignRows[0];
    if (!campaign) {
      return res.status(404).json({ ok: false, error: "Campaign not found." });
    }
    if (campaign.creatorUserId === req.user!.id) {
      return res.status(400).json({ ok: false, error: "Creators do not need to follow their own campaigns." });
    }

    const [followedCreatorIds, memberCreatorIds] = await Promise.all([
      loadFollowedCreatorIdsForUser(req.user!.id),
      loadActiveMembershipCreatorIdsForUser(req.user!.id),
    ]);
    if (!canViewerSeeCreatorCampaign({ campaign, viewerId: req.user!.id, followedCreatorIds, memberCreatorIds })) {
      return res.status(404).json({ ok: false, error: "Campaign not found." });
    }

    await db.insert(creatorCampaignFollows).values(insertCreatorCampaignFollowSchema.parse({
      userId: req.user!.id,
      campaignId,
    })).onConflictDoNothing();

    const followerCountMap = await loadCampaignFollowerCountMap([campaignId]);
    return res.status(201).json({
      ok: true,
      campaignId,
      isFollowing: true,
      followerCount: followerCountMap.get(campaignId) ?? 0,
    });
  } catch (error) {
    const message = logCollectionRouteError("/campaigns/:id/follow", req, error);
    return res.status(500).json(collectionServerError(message, "Failed to follow campaign"));
  }
});

r.delete("/campaigns/:id/follow", requireAuth, async (req, res) => {
  try {
    await ensureDrinkCollectionsSchema();
    if (!db) {
      return res.status(503).json({ ok: false, error: "Database unavailable" });
    }

    const campaignId = String(req.params.id ?? "").trim();
    if (!campaignId) {
      return res.status(400).json({ ok: false, error: "Campaign id is required." });
    }

    await db.delete(creatorCampaignFollows).where(and(
      eq(creatorCampaignFollows.campaignId, campaignId),
      eq(creatorCampaignFollows.userId, req.user!.id),
    ));

    const followerCountMap = await loadCampaignFollowerCountMap([campaignId]);
    return res.json({
      ok: true,
      campaignId,
      isFollowing: false,
      followerCount: followerCountMap.get(campaignId) ?? 0,
    });
  } catch (error) {
    const message = logCollectionRouteError("/campaigns/:id/follow", req, error);
    return res.status(500).json(collectionServerError(message, "Failed to unfollow campaign"));
  }
});

r.get("/campaigns/:slug", optionalAuth, async (req, res) => {
  try {
    await ensureDrinkCollectionsSchema();
    if (!db) {
      return res.status(503).json({ ok: false, error: "Database unavailable" });
    }

    const slug = String(req.params.slug ?? "").trim();
    if (!slug) {
      return res.status(400).json({ ok: false, error: "Campaign slug is required." });
    }

    const campaignRows = await db.select().from(creatorCampaigns).where(eq(creatorCampaigns.slug, slug)).limit(1);
    const campaign = campaignRows[0];
    if (!campaign) {
      return res.status(404).json({ ok: false, error: "Campaign not found." });
    }

    const viewerId = req.user?.id ?? null;
    const [followedCreatorIds, memberCreatorIds] = await Promise.all([
      loadFollowedCreatorIdsForUser(viewerId),
      loadActiveMembershipCreatorIdsForUser(viewerId),
    ]);
    if (!canViewerSeeCreatorCampaign({ campaign, viewerId, followedCreatorIds, memberCreatorIds })) {
      return res.status(404).json({ ok: false, error: "Campaign not found." });
    }

    const detail = await loadCreatorCampaignDetail(campaign, viewerId);
    const performance = await loadCreatorCampaignPerformanceSnapshots(campaign.creatorUserId);
    const campaignSnapshot = performance.items.find((item) => item.campaignId === campaign.id) ?? null;
    const ownerAnalytics = viewerId && viewerId === campaign.creatorUserId
      ? campaignSnapshot
      : null;
    return res.json({
      ok: true,
      ...detail,
      milestones: {
        public: (campaignSnapshot?.milestones ?? []).filter((milestone) => milestone.isPublic && milestone.achieved),
        owner: viewerId && viewerId === campaign.creatorUserId ? (campaignSnapshot?.milestones ?? []) : [],
      },
      recentUpdates: buildCreatorCampaignUpdateItems(detail),
      ownerAnalytics,
    });
  } catch (error) {
    const message = logCollectionRouteError("/campaigns/:slug", req, error);
    return res.status(500).json(collectionServerError(message, "Failed to load creator campaign"));
  }
});

r.post("/campaigns", requireAuth, async (req, res) => {
  try {
    await ensureDrinkCollectionsSchema();
    if (!db) {
      return res.status(503).json({ ok: false, error: "Database unavailable" });
    }

    const parsed = createCreatorCampaignBodySchema.safeParse(req.body ?? {});
    if (!parsed.success) {
      return res.status(400).json({ ok: false, error: parsed.error.issues[0]?.message ?? "Invalid campaign payload." });
    }

    const payload = parsed.data;
    const links = [...new Map((payload.links ?? []).map((link, index) => [`${link.targetType}:${link.targetId}`, {
      targetType: link.targetType,
      targetId: link.targetId.trim(),
      sortOrder: Number(link.sortOrder ?? index),
    }])).values()] as Array<{ targetType: CreatorCampaignTargetType; targetId: string; sortOrder: number }>;

    await validateCreatorCampaignLinks(req.user!.id, links);

    const values = insertCreatorCampaignSchema.parse({
      creatorUserId: req.user!.id,
      slug: payload.slug.trim().toLowerCase(),
      name: payload.name.trim(),
      description: payload.description?.trim() ? payload.description.trim() : null,
      visibility: payload.visibility,
      startsAt: payload.startsAt ? new Date(payload.startsAt) : null,
      endsAt: payload.endsAt ? new Date(payload.endsAt) : null,
      isActive: payload.isActive ?? true,
    });

    const inserted = await db.insert(creatorCampaigns).values({
      ...values,
      updatedAt: new Date(),
    }).returning();
    const campaign = inserted[0];
    if (!campaign) {
      return res.status(500).json({ ok: false, error: "Failed to create campaign." });
    }

    await replaceCreatorCampaignLinks(campaign.id, links);
    const detail = await loadCreatorCampaignDetail(campaign, req.user!.id);
    return res.status(201).json({ ok: true, ...detail });
  } catch (error) {
    const message = logCollectionRouteError("/campaigns", req, error);
    return res.status(500).json(collectionServerError(message, "Failed to create creator campaign"));
  }
});

r.patch("/campaigns/:id", requireAuth, async (req, res) => {
  try {
    await ensureDrinkCollectionsSchema();
    if (!db) {
      return res.status(503).json({ ok: false, error: "Database unavailable" });
    }

    const campaignId = String(req.params.id ?? "").trim();
    if (!campaignId) {
      return res.status(400).json({ ok: false, error: "Campaign id is required." });
    }

    const parsed = updateCreatorCampaignBodySchema.safeParse(req.body ?? {});
    if (!parsed.success) {
      return res.status(400).json({ ok: false, error: parsed.error.issues[0]?.message ?? "Invalid campaign payload." });
    }

    const existingRows = await db
      .select()
      .from(creatorCampaigns)
      .where(and(eq(creatorCampaigns.id, campaignId), eq(creatorCampaigns.creatorUserId, req.user!.id)))
      .limit(1);
    const existing = existingRows[0];
    if (!existing) {
      return res.status(404).json({ ok: false, error: "Campaign not found." });
    }

    const payload = parsed.data;
    const links = payload.links
      ? [...new Map(payload.links.map((link, index) => [`${link.targetType}:${link.targetId}`, {
          targetType: link.targetType,
          targetId: link.targetId.trim(),
          sortOrder: Number(link.sortOrder ?? index),
        }])).values()] as Array<{ targetType: CreatorCampaignTargetType; targetId: string; sortOrder: number }>
      : null;
    if (links) {
      await validateCreatorCampaignLinks(req.user!.id, links);
    }

    const nextSlug = payload.slug !== undefined ? payload.slug.trim().toLowerCase() : existing.slug;
    const updatedRows = await db
      .update(creatorCampaigns)
      .set({
        slug: nextSlug,
        name: payload.name !== undefined ? payload.name.trim() : existing.name,
        description: payload.description !== undefined ? (payload.description?.trim() ? payload.description.trim() : null) : existing.description,
        visibility: payload.visibility ?? (existing.visibility as CreatorCampaignVisibility),
        startsAt: payload.startsAt !== undefined ? (payload.startsAt ? new Date(payload.startsAt) : null) : existing.startsAt,
        endsAt: payload.endsAt !== undefined ? (payload.endsAt ? new Date(payload.endsAt) : null) : existing.endsAt,
        isActive: payload.isActive ?? existing.isActive,
        updatedAt: new Date(),
      })
      .where(eq(creatorCampaigns.id, campaignId))
      .returning();

    const campaign = updatedRows[0];
    if (!campaign) {
      return res.status(500).json({ ok: false, error: "Failed to update campaign." });
    }
    if (links) {
      await replaceCreatorCampaignLinks(campaign.id, links);
    }
    const detail = await loadCreatorCampaignDetail(campaign, req.user!.id);
    return res.json({ ok: true, ...detail });
  } catch (error) {
    const message = logCollectionRouteError("/campaigns/:id", req, error);
    return res.status(500).json(collectionServerError(message, "Failed to update creator campaign"));
  }
});

r.delete("/campaigns/:id", requireAuth, async (req, res) => {
  try {
    await ensureDrinkCollectionsSchema();
    if (!db) {
      return res.status(503).json({ ok: false, error: "Database unavailable" });
    }

    const campaignId = String(req.params.id ?? "").trim();
    if (!campaignId) {
      return res.status(400).json({ ok: false, error: "Campaign id is required." });
    }

    const deletedRows = await db
      .delete(creatorCampaigns)
      .where(and(eq(creatorCampaigns.id, campaignId), eq(creatorCampaigns.creatorUserId, req.user!.id)))
      .returning({ id: creatorCampaigns.id });

    if (!deletedRows[0]) {
      return res.status(404).json({ ok: false, error: "Campaign not found." });
    }

    return res.json({ ok: true, deletedId: deletedRows[0].id });
  } catch (error) {
    const message = logCollectionRouteError("/campaigns/:id", req, error);
    return res.status(500).json(collectionServerError(message, "Failed to delete creator campaign"));
  }
});

r.get("/creator-posts/creator/:userId", optionalAuth, async (req, res) => {
  try {
    await ensureDrinkCollectionsSchema();
    if (!db) {
      return res.status(503).json({ ok: false, error: "Database unavailable" });
    }

    const creatorUserId = String(req.params.userId ?? "").trim();
    if (!creatorUserId) {
      return res.status(400).json({ ok: false, error: "Creator userId is required." });
    }

    const viewerId = req.user?.id ?? null;
    const [acceptedCollaborations, followedCreatorIds, memberCreatorIds] = await Promise.all([
      loadAcceptedCollaborationsForCreator(creatorUserId),
      loadFollowedCreatorIdsForUser(viewerId),
      loadActiveMembershipCreatorIdsForUser(viewerId),
    ]);
    const acceptedPostIds = acceptedCollaborations
      .filter((row) => row.collaborationType === "post")
      .map((row) => row.targetId);
    const ownPosts = await db
      .select()
      .from(creatorPosts)
      .where(eq(creatorPosts.creatorUserId, creatorUserId))
      .orderBy(desc(creatorPosts.createdAt))
      .limit(60);
    const collaborativePosts = acceptedPostIds.length > 0
      ? await db
          .select()
          .from(creatorPosts)
          .where(inArray(creatorPosts.id, acceptedPostIds))
          .orderBy(desc(creatorPosts.createdAt))
      : [];
    const posts = [...new Map([...ownPosts, ...collaborativePosts].map((post) => [post.id, post])).values()];

    const visiblePosts = posts.filter((post) => canViewerSeeCreatorPost({
      post,
      viewerId,
      followedCreatorIds,
      memberCreatorIds,
    }));

    const maps = await loadCreatorPostLinkedMaps(visiblePosts);
    const items = visiblePosts.map((post) => serializeCreatorPost(post, {
      viewerId,
      creator: maps.creatorMap.get(post.creatorUserId) ?? null,
      linkedCollection: post.linkedCollectionId ? maps.collectionMap.get(post.linkedCollectionId) ?? null : null,
      linkedChallenge: post.linkedChallengeId ? maps.challengeMap.get(post.linkedChallengeId) ?? null : null,
      acceptedCollaboration: serializeAcceptedCollaboration(maps.collaborationMap.get(`post:${post.id}`) ?? null, maps.collaborationProfileMap),
    }));

    return res.json({
      ok: true,
      creatorUserId,
      count: items.length,
      items,
    });
  } catch (error) {
    const message = logCollectionRouteError("/creator-posts/creator/:userId", req, error);
    return res.status(500).json(collectionServerError(message, "Failed to load creator posts"));
  }
});

r.post("/creator-posts", requireAuth, async (req, res) => {
  try {
    await ensureDrinkCollectionsSchema();
    if (!db) {
      return res.status(503).json({ ok: false, error: "Database unavailable" });
    }

    const parsed = createCreatorPostBodySchema.safeParse(req.body ?? {});
    if (!parsed.success) {
      return res.status(400).json({ ok: false, error: parsed.error.issues[0]?.message ?? "Invalid creator post payload." });
    }

    const payload = parsed.data;
    const values = {
      creatorUserId: req.user!.id,
      title: payload.title.trim(),
      body: payload.body.trim(),
      postType: payload.postType,
      visibility: payload.postType === "member_only" ? "members" as const : payload.visibility,
      linkedCollectionId: normalizeNullableForeignId(payload.linkedCollectionId),
      linkedChallengeId: normalizeNullableForeignId(payload.linkedChallengeId),
      updatedAt: new Date(),
    };

    await validateCreatorPostLinkedEntities({
      creatorUserId: values.creatorUserId,
      visibility: values.visibility,
      linkedCollectionId: values.linkedCollectionId,
      linkedChallengeId: values.linkedChallengeId,
    });

    const inserted = await db.insert(creatorPosts).values(values).returning();
    const post = inserted[0];
    if (!post) {
      return res.status(500).json({ ok: false, error: "Failed to create creator post." });
    }

    await maybeSendCreatorPostAlerts(post);
    const maps = await loadCreatorPostLinkedMaps([post]);
    return res.status(201).json({
      ok: true,
      post: serializeCreatorPost(post, {
        viewerId: req.user!.id,
        creator: maps.creatorMap.get(post.creatorUserId) ?? null,
        linkedCollection: post.linkedCollectionId ? maps.collectionMap.get(post.linkedCollectionId) ?? null : null,
        linkedChallenge: post.linkedChallengeId ? maps.challengeMap.get(post.linkedChallengeId) ?? null : null,
        acceptedCollaboration: serializeAcceptedCollaboration(maps.collaborationMap.get(`post:${post.id}`) ?? null, maps.collaborationProfileMap),
      }),
    });
  } catch (error) {
    const message = logCollectionRouteError("/creator-posts", req, error);
    return res.status(500).json(collectionServerError(message, "Failed to create creator post"));
  }
});

r.patch("/creator-posts/:id", requireAuth, async (req, res) => {
  try {
    await ensureDrinkCollectionsSchema();
    if (!db) {
      return res.status(503).json({ ok: false, error: "Database unavailable" });
    }

    const postId = String(req.params.id ?? "").trim();
    if (!postId) {
      return res.status(400).json({ ok: false, error: "Post id is required." });
    }

    const parsed = updateCreatorPostBodySchema.safeParse(req.body ?? {});
    if (!parsed.success) {
      return res.status(400).json({ ok: false, error: parsed.error.issues[0]?.message ?? "Invalid creator post payload." });
    }

    const existingRows = await db
      .select()
      .from(creatorPosts)
      .where(and(eq(creatorPosts.id, postId), eq(creatorPosts.creatorUserId, req.user!.id)))
      .limit(1);

    const existing = existingRows[0];
    if (!existing) {
      return res.status(404).json({ ok: false, error: "Creator post not found." });
    }

    const payload = parsed.data;
    const values = {
      title: payload.title?.trim() ?? existing.title,
      body: payload.body?.trim() ?? existing.body,
      postType: payload.postType ?? (existing.postType as CreatorPostType),
      visibility: (payload.postType ?? existing.postType) === "member_only"
        ? "members" as const
        : (payload.visibility ?? (existing.visibility as CreatorPostVisibility)),
      linkedCollectionId: payload.linkedCollectionId !== undefined ? normalizeNullableForeignId(payload.linkedCollectionId) : existing.linkedCollectionId,
      linkedChallengeId: payload.linkedChallengeId !== undefined ? normalizeNullableForeignId(payload.linkedChallengeId) : existing.linkedChallengeId,
      updatedAt: new Date(),
    };

    if (values.postType === "collection_launch" && !values.linkedCollectionId) {
      return res.status(400).json({ ok: false, error: "Collection launch posts should link to a collection." });
    }
    if (values.postType === "challenge" && !values.linkedChallengeId) {
      return res.status(400).json({ ok: false, error: "Challenge posts should link to a challenge." });
    }

    await validateCreatorPostLinkedEntities({
      creatorUserId: req.user!.id,
      visibility: values.visibility,
      linkedCollectionId: values.linkedCollectionId,
      linkedChallengeId: values.linkedChallengeId,
    });

    const updatedRows = await db
      .update(creatorPosts)
      .set(values)
      .where(eq(creatorPosts.id, postId))
      .returning();

    const post = updatedRows[0];
    const maps = await loadCreatorPostLinkedMaps(post ? [post] : []);
    return res.json({
      ok: true,
      post: post ? serializeCreatorPost(post, {
        viewerId: req.user!.id,
        creator: maps.creatorMap.get(post.creatorUserId) ?? null,
        linkedCollection: post.linkedCollectionId ? maps.collectionMap.get(post.linkedCollectionId) ?? null : null,
        linkedChallenge: post.linkedChallengeId ? maps.challengeMap.get(post.linkedChallengeId) ?? null : null,
        acceptedCollaboration: serializeAcceptedCollaboration(maps.collaborationMap.get(`post:${post.id}`) ?? null, maps.collaborationProfileMap),
      }) : null,
    });
  } catch (error) {
    const message = logCollectionRouteError("/creator-posts/:id", req, error);
    return res.status(500).json(collectionServerError(message, "Failed to update creator post"));
  }
});

r.delete("/creator-posts/:id", requireAuth, async (req, res) => {
  try {
    await ensureDrinkCollectionsSchema();
    if (!db) {
      return res.status(503).json({ ok: false, error: "Database unavailable" });
    }

    const postId = String(req.params.id ?? "").trim();
    if (!postId) {
      return res.status(400).json({ ok: false, error: "Post id is required." });
    }

    const deletedRows = await db
      .delete(creatorPosts)
      .where(and(eq(creatorPosts.id, postId), eq(creatorPosts.creatorUserId, req.user!.id)))
      .returning({ id: creatorPosts.id });

    if (!deletedRows[0]) {
      return res.status(404).json({ ok: false, error: "Creator post not found." });
    }

    return res.json({ ok: true, deletedId: deletedRows[0].id });
  } catch (error) {
    const message = logCollectionRouteError("/creator-posts/:id", req, error);
    return res.status(500).json(collectionServerError(message, "Failed to delete creator post"));
  }
});

r.get("/collaborations/mine", requireAuth, async (req, res) => {
  try {
    await ensureDrinkCollectionsSchema();
    if (!db) {
      return res.status(503).json({ ok: false, error: "Database unavailable" });
    }

    const userId = req.user!.id;
    const rows = await db
      .select()
      .from(creatorCollaborations)
      .where(
        or(
          eq(creatorCollaborations.ownerCreatorUserId, userId),
          eq(creatorCollaborations.collaboratorUserId, userId),
        ),
      )
      .orderBy(desc(creatorCollaborations.updatedAt));

    const [profileMap, targetMap] = await Promise.all([
      loadAcceptedCollaborationProfileMapByRows(rows),
      loadCollaborationTargetsMap(rows),
    ]);

    const items = rows.map((row) => serializeCreatorCollaborationRow(row, profileMap, targetMap));

    return res.json({
      ok: true,
      userId,
      counts: {
        total: items.length,
        incomingPending: items.filter((item) => item.collaboratorUserId === userId && item.status === "pending").length,
        outgoingPending: items.filter((item) => item.ownerCreatorUserId === userId && item.status === "pending").length,
        accepted: items.filter((item) => item.status === "accepted").length,
      },
      incoming: items.filter((item) => item.collaboratorUserId === userId),
      outgoing: items.filter((item) => item.ownerCreatorUserId === userId),
    });
  } catch (error) {
    const message = logCollectionRouteError("/collaborations/mine", req, error);
    return res.status(500).json(collectionServerError(message, "Failed to load creator collaborations"));
  }
});

r.post("/collaborations", requireAuth, async (req, res) => {
  try {
    await ensureDrinkCollectionsSchema();
    if (!db) {
      return res.status(503).json({ ok: false, error: "Database unavailable" });
    }

    const parsed = createCreatorCollaborationBodySchema.safeParse(req.body ?? {});
    if (!parsed.success) {
      return res.status(400).json({ ok: false, error: parsed.error.issues[0]?.message ?? "Invalid collaboration payload." });
    }

    const ownerCreatorUserId = req.user!.id;
    const payload = parsed.data;
    const collaboratorUserId = payload.collaboratorUserId.trim();
    if (collaboratorUserId === ownerCreatorUserId) {
      return res.status(400).json({ ok: false, error: "Invite a different creator for collaboration." });
    }

    const [collaboratorRows, canCollaborate, target] = await Promise.all([
      db.select({ id: users.id, username: users.username, avatar: users.avatar }).from(users).where(eq(users.id, collaboratorUserId)).limit(1),
      userCanReceiveCreatorCollaboration(collaboratorUserId),
      resolveCollaborationTargetForOwner({
        ownerCreatorUserId,
        collaborationType: payload.collaborationType,
        targetId: payload.targetId,
      }),
    ]);

    if (!collaboratorRows[0]) {
      return res.status(404).json({ ok: false, error: "Collaborator not found." });
    }
    if (!canCollaborate) {
      return res.status(400).json({ ok: false, error: "Collaborator needs at least one existing creator artifact before joining creator collaborations." });
    }
    if (!target) {
      return res.status(404).json({ ok: false, error: "Supported target not found for this creator." });
    }

    const existingRows = await db
      .select()
      .from(creatorCollaborations)
      .where(
        and(
          eq(creatorCollaborations.collaborationType, payload.collaborationType),
          eq(creatorCollaborations.targetId, payload.targetId),
        ),
      )
      .limit(1);

    const existing = existingRows[0] ?? null;
    if (existing && existing.collaboratorUserId !== collaboratorUserId && (existing.status === "pending" || existing.status === "accepted")) {
      return res.status(409).json({ ok: false, error: "This target already has an active collaborator in version one." });
    }
    if (existing && existing.collaboratorUserId === collaboratorUserId && existing.status === "accepted") {
      const [profileMap, targetMap] = await Promise.all([
        loadAcceptedCollaborationProfileMapByRows([existing]),
        loadCollaborationTargetsMap([existing]),
      ]);
      return res.status(200).json({
        ok: true,
        collaboration: serializeCreatorCollaborationRow(existing, profileMap, targetMap),
        note: "This creator collaboration is already active.",
      });
    }

    const baseValues = insertCreatorCollaborationSchema.parse({
      ownerCreatorUserId,
      collaboratorUserId,
      collaborationType: payload.collaborationType,
      targetId: payload.targetId,
      status: "pending",
    });

    const rows = existing
      ? await db
          .update(creatorCollaborations)
          .set({
            ...baseValues,
            status: "pending",
            updatedAt: new Date(),
          })
          .where(eq(creatorCollaborations.id, existing.id))
          .returning()
      : await db
          .insert(creatorCollaborations)
          .values({
            ...baseValues,
            updatedAt: new Date(),
          })
          .returning();

    const collaboration = rows[0];
    const [profileMap, targetMap] = await Promise.all([
      loadAcceptedCollaborationProfileMapByRows(collaboration ? [collaboration] : []),
      loadCollaborationTargetsMap(collaboration ? [collaboration] : []),
    ]);

    return res.status(existing ? 200 : 201).json({
      ok: true,
      collaboration: collaboration ? serializeCreatorCollaborationRow(collaboration, profileMap, targetMap) : null,
      note: "Creator collaborations are social attribution and discovery first. Revenue sharing and payouts stay unchanged in version one.",
    });
  } catch (error) {
    const message = logCollectionRouteError("/collaborations", req, error);
    return res.status(500).json(collectionServerError(message, "Failed to create creator collaboration"));
  }
});

r.post("/collaborations/:id/accept", requireAuth, async (req, res) => {
  try {
    await ensureDrinkCollectionsSchema();
    if (!db) {
      return res.status(503).json({ ok: false, error: "Database unavailable" });
    }

    const collaborationId = String(req.params.id ?? "").trim();
    if (!collaborationId) {
      return res.status(400).json({ ok: false, error: "Collaboration id is required." });
    }

    const existingRows = await db
      .select()
      .from(creatorCollaborations)
      .where(eq(creatorCollaborations.id, collaborationId))
      .limit(1);
    const existing = existingRows[0];

    if (!existing || existing.collaboratorUserId !== req.user!.id) {
      return res.status(404).json({ ok: false, error: "Collaboration invite not found." });
    }
    if (existing.status !== "pending") {
      return res.status(400).json({ ok: false, error: "Only pending collaboration invites can be accepted." });
    }

    const updatedRows = await db
      .update(creatorCollaborations)
      .set({ status: "accepted", updatedAt: new Date() })
      .where(eq(creatorCollaborations.id, collaborationId))
      .returning();
    const collaboration = updatedRows[0];

    const [profileMap, targetMap] = await Promise.all([
      loadAcceptedCollaborationProfileMapByRows(collaboration ? [collaboration] : []),
      loadCollaborationTargetsMap(collaboration ? [collaboration] : []),
    ]);

    return res.json({
      ok: true,
      collaboration: collaboration ? serializeCreatorCollaborationRow(collaboration, profileMap, targetMap) : null,
      note: "Accepted collaborations add public attribution and cross-surface discovery, not automatic payout sharing.",
    });
  } catch (error) {
    const message = logCollectionRouteError("/collaborations/:id/accept", req, error);
    return res.status(500).json(collectionServerError(message, "Failed to accept creator collaboration"));
  }
});

r.post("/collaborations/:id/decline", requireAuth, async (req, res) => {
  try {
    await ensureDrinkCollectionsSchema();
    if (!db) {
      return res.status(503).json({ ok: false, error: "Database unavailable" });
    }

    const collaborationId = String(req.params.id ?? "").trim();
    if (!collaborationId) {
      return res.status(400).json({ ok: false, error: "Collaboration id is required." });
    }

    const existingRows = await db
      .select()
      .from(creatorCollaborations)
      .where(eq(creatorCollaborations.id, collaborationId))
      .limit(1);
    const existing = existingRows[0];

    if (!existing || existing.collaboratorUserId !== req.user!.id) {
      return res.status(404).json({ ok: false, error: "Collaboration invite not found." });
    }
    if (existing.status !== "pending") {
      return res.status(400).json({ ok: false, error: "Only pending collaboration invites can be declined." });
    }

    const updatedRows = await db
      .update(creatorCollaborations)
      .set({ status: "declined", updatedAt: new Date() })
      .where(eq(creatorCollaborations.id, collaborationId))
      .returning();
    const collaboration = updatedRows[0];

    const [profileMap, targetMap] = await Promise.all([
      loadAcceptedCollaborationProfileMapByRows(collaboration ? [collaboration] : []),
      loadCollaborationTargetsMap(collaboration ? [collaboration] : []),
    ]);

    return res.json({
      ok: true,
      collaboration: collaboration ? serializeCreatorCollaborationRow(collaboration, profileMap, targetMap) : null,
    });
  } catch (error) {
    const message = logCollectionRouteError("/collaborations/:id/decline", req, error);
    return res.status(500).json(collectionServerError(message, "Failed to decline creator collaboration"));
  }
});

r.delete("/collaborations/:id", requireAuth, async (req, res) => {
  try {
    await ensureDrinkCollectionsSchema();
    if (!db) {
      return res.status(503).json({ ok: false, error: "Database unavailable" });
    }

    const collaborationId = String(req.params.id ?? "").trim();
    if (!collaborationId) {
      return res.status(400).json({ ok: false, error: "Collaboration id is required." });
    }

    const existingRows = await db
      .select()
      .from(creatorCollaborations)
      .where(eq(creatorCollaborations.id, collaborationId))
      .limit(1);
    const existing = existingRows[0];

    if (!existing || existing.ownerCreatorUserId !== req.user!.id) {
      return res.status(404).json({ ok: false, error: "Collaboration not found for this creator." });
    }

    const updatedRows = await db
      .update(creatorCollaborations)
      .set({ status: "revoked", updatedAt: new Date() })
      .where(eq(creatorCollaborations.id, collaborationId))
      .returning();
    const collaboration = updatedRows[0];

    const [profileMap, targetMap] = await Promise.all([
      loadAcceptedCollaborationProfileMapByRows(collaboration ? [collaboration] : []),
      loadCollaborationTargetsMap(collaboration ? [collaboration] : []),
    ]);

    return res.json({
      ok: true,
      collaboration: collaboration ? serializeCreatorCollaborationRow(collaboration, profileMap, targetMap) : null,
      note: "Revoking removes collaboration attribution only. Ownership, pricing, and payouts stay unchanged.",
    });
  } catch (error) {
    const message = logCollectionRouteError("/collaborations/:id", req, error);
    return res.status(500).json(collectionServerError(message, "Failed to revoke creator collaboration"));
  }
});

r.get("/following-feed", requireAuth, async (req, res) => {
  try {
    if (!db) {
      return res.status(503).json({ ok: false, error: "Database unavailable" });
    }

    const viewerId = String(req.user.id ?? "").trim();
    if (!viewerId) {
      return res.status(401).json({ ok: false, error: "Unauthorized", code: "NO_USER" });
    }
    const followedCreatorRows = await db
      .select({ followingId: follows.followingId })
      .from(follows)
      .where(eq(follows.followerId, viewerId));

    const followedCreatorIds = followedCreatorRows.map((row) => row.followingId).filter(Boolean);
    if (followedCreatorIds.length === 0) {
      return res.json({ ok: true, followingCount: 0, items: [] });
    }

    const recipeRows = await db
      .select({
        id: drinkRecipes.id,
        slug: drinkRecipes.slug,
        name: drinkRecipes.name,
        image: drinkRecipes.image,
        createdAt: drinkRecipes.createdAt,
        userId: drinkRecipes.userId,
        creatorUsername: users.username,
        creatorAvatar: users.avatar,
        remixedFromSlug: drinkRecipes.remixedFromSlug,
      })
      .from(drinkRecipes)
      .innerJoin(users, eq(drinkRecipes.userId, users.id))
      .where(inArray(drinkRecipes.userId, followedCreatorIds))
      .orderBy(desc(drinkRecipes.createdAt))
      .limit(120);

    if (recipeRows.length === 0) {
      return res.json({ ok: true, followingCount: followedCreatorIds.length, items: [] });
    }

    const recipeSlugs = recipeRows.map((row) => row.slug).filter((slug): slug is string => typeof slug === "string" && slug.length > 0);
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    const viewRows = recipeSlugs.length > 0
      ? await db
          .select({ slug: drinkEvents.slug, views7d: sql<number>`count(*)` })
          .from(drinkEvents)
          .where(
            and(
              inArray(drinkEvents.slug, recipeSlugs),
              eq(drinkEvents.eventType, "view"),
              gt(drinkEvents.createdAt, sevenDaysAgo),
            )
          )
          .groupBy(drinkEvents.slug)
      : [];

    const remixRows = recipeSlugs.length > 0
      ? await db
          .select({ remixedFromSlug: drinkRecipes.remixedFromSlug, remixesCount: sql<number>`count(*)` })
          .from(drinkRecipes)
          .where(inArray(drinkRecipes.remixedFromSlug, recipeSlugs))
          .groupBy(drinkRecipes.remixedFromSlug)
      : [];

    const viewsBySlug = new Map(viewRows.map((row) => [row.slug, Number(row.views7d ?? 0)]));
    const remixesBySlug = new Map(
      remixRows
        .filter((row): row is { remixedFromSlug: string; remixesCount: number } => Boolean(row.remixedFromSlug))
        .map((row) => [row.remixedFromSlug, Number(row.remixesCount ?? 0)]),
    );

    const items = recipeRows
      .map((row) => {
        const createdAtMs = row.createdAt ? new Date(row.createdAt).getTime() : 0;
        const views7d = viewsBySlug.get(row.slug) ?? 0;
        const remixesCount = remixesBySlug.get(row.slug) ?? 0;
        const engagementScore = (views7d * 0.75) + (remixesCount * 3);
        const rankScore = createdAtMs + (engagementScore * 60_000);

        return {
          id: row.id,
          slug: row.slug,
          name: row.name,
          image: row.image ?? null,
          createdAt: row.createdAt,
          userId: row.userId,
          creatorUsername: row.creatorUsername ?? "unknown",
          creatorAvatar: row.creatorAvatar ?? null,
          remixedFromSlug: row.remixedFromSlug ?? null,
          views7d,
          remixesCount,
          route: `/drinks/recipe/${row.slug}`,
          rankScore,
        };
      })
      .sort((a, b) => b.rankScore - a.rankScore)
      .map(({ rankScore, ...item }) => item)
      .slice(0, 60);

    return res.json({ ok: true, followingCount: followedCreatorIds.length, items });
  } catch (error) {
    console.error("[drinks/following-feed] Error loading following drinks feed:", { viewerId: req.user?.id, error });
    const message = error instanceof Error ? error.message : String(error);
    return res.status(500).json({ ok: false, error: process.env.NODE_ENV === "production" ? "Failed to fetch following drinks feed" : `Failed to fetch following drinks feed: ${message}` });
  }
});

r.get("/whats-new", optionalAuth, async (req, res) => {
  try {
    if (!db) {
      return res.status(503).json({ ok: false, error: "Database unavailable" });
    }

    const { limit, offset } = parseLimitOffset(req.query as Record<string, unknown>, { limit: 40, maxLimit: 80 });
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const viewerId = req.user?.id ?? null;

    const recentRemixRows = await db
      .select({
        slug: drinkRecipes.slug,
        name: drinkRecipes.name,
        image: drinkRecipes.image,
        createdAt: drinkRecipes.createdAt,
        remixedFromSlug: drinkRecipes.remixedFromSlug,
        userId: drinkRecipes.userId,
        username: users.username,
      })
      .from(drinkRecipes)
      .leftJoin(users, eq(drinkRecipes.userId, users.id))
      .where(sql`${drinkRecipes.remixedFromSlug} is not null`)
      .orderBy(desc(drinkRecipes.createdAt))
      .limit(20);

    const trendingDrinkRows = await db
      .select({
        remixedFromSlug: drinkRecipes.remixedFromSlug,
        remixesCount: sql<number>`count(*)`,
        lastRemixAt: sql<Date>`max(${drinkRecipes.createdAt})`,
      })
      .from(drinkRecipes)
      .where(and(sql`${drinkRecipes.remixedFromSlug} is not null`, gt(drinkRecipes.createdAt, sevenDaysAgo)))
      .groupBy(drinkRecipes.remixedFromSlug)
      .orderBy(desc(sql`count(*)`))
      .limit(12);

    const trendingCreators = await getTrendingDrinkCreators(8);
    const mostRemixedRows = await db
      .select({
        remixedFromSlug: drinkRecipes.remixedFromSlug,
        remixesCount: sql<number>`count(*)`,
      })
      .from(drinkRecipes)
      .where(sql`${drinkRecipes.remixedFromSlug} is not null`)
      .groupBy(drinkRecipes.remixedFromSlug)
      .orderBy(desc(sql`count(*)`))
      .limit(6);

    let followedRows: Array<{
      slug: string;
      name: string;
      image: string | null;
      createdAt: Date;
      userId: string | null;
      username: string | null;
    }> = [];

    if (viewerId) {
      const followedCreatorRows = await db
        .select({ followingId: follows.followingId })
        .from(follows)
        .where(eq(follows.followerId, viewerId));

      const followedCreatorIds = followedCreatorRows.map((row) => row.followingId).filter(Boolean);
      if (followedCreatorIds.length > 0) {
        followedRows = await db
          .select({
            slug: drinkRecipes.slug,
            name: drinkRecipes.name,
            image: drinkRecipes.image,
            createdAt: drinkRecipes.createdAt,
            userId: drinkRecipes.userId,
            username: users.username,
          })
          .from(drinkRecipes)
          .innerJoin(users, eq(drinkRecipes.userId, users.id))
          .where(inArray(drinkRecipes.userId, followedCreatorIds))
          .orderBy(desc(drinkRecipes.createdAt))
          .limit(20);
      }
    }

    const items: WhatsNewFeedItem[] = [];

    for (const row of recentRemixRows) {
      const sourceSlug = row.remixedFromSlug ?? null;
      const canonicalSource = sourceSlug ? getCanonicalDrinkBySlug(sourceSlug) : null;
      const sourceName = canonicalSource?.name ?? sourceSlug ?? "another drink";
      items.push({
        type: "remix",
        createdAt: (row.createdAt ? new Date(row.createdAt) : new Date()).toISOString(),
        title: `New remix of ${sourceName}`,
        subtitle: row.username
          ? `@${row.username} shared \"${row.name}\" as a remix.`
          : `A community creator shared \"${row.name}\" as a remix.`,
        image: row.image ?? canonicalSource?.image ?? null,
        route: `/drinks/recipe/${row.slug}?community=1`,
        relatedUserId: row.userId ?? null,
        relatedUsername: row.username ?? null,
        relatedDrinkSlug: sourceSlug,
      });
    }

    for (const row of trendingDrinkRows) {
      if (!row.remixedFromSlug) continue;
      const canonicalDrink = getCanonicalDrinkBySlug(row.remixedFromSlug);
      const drinkName = canonicalDrink?.name ?? row.remixedFromSlug;
      items.push({
        type: "trending_drink",
        createdAt: (row.lastRemixAt ? new Date(row.lastRemixAt) : new Date()).toISOString(),
        title: `${drinkName} is trending this week`,
        subtitle: `${Number(row.remixesCount ?? 0).toLocaleString()} new remixes in the last 7 days.`,
        image: canonicalDrink?.image ?? null,
        route: canonicalDrink?.route ?? `/drinks/recipe/${row.remixedFromSlug}`,
        relatedUserId: null,
        relatedUsername: null,
        relatedDrinkSlug: row.remixedFromSlug,
      });
    }

    for (const [index, creator] of trendingCreators.entries()) {
      items.push({
        type: "trending_creator",
        createdAt: new Date(Date.now() - (index * 5 * 60 * 1000)).toISOString(),
        title: `${creator.username ? `@${creator.username}` : "A creator"} is trending`,
        subtitle: `Trending creator this week with ${Number(creator.totalRemixesReceived ?? 0).toLocaleString()} remixes received.`,
        image: creator.avatar ?? creator.topDrink?.image ?? null,
        route: creator.publicRoute,
        relatedUserId: creator.userId,
        relatedUsername: creator.username ?? null,
        relatedDrinkSlug: creator.topDrink?.slug ?? null,
      });
    }

    for (const row of followedRows) {
      if (!row.userId) continue;
      items.push({
        type: "followed_creator_post",
        createdAt: (row.createdAt ? new Date(row.createdAt) : new Date()).toISOString(),
        title: "A creator you follow posted a new drink",
        subtitle: row.username
          ? `@${row.username} published \"${row.name}\".`
          : `A followed creator published \"${row.name}\".`,
        image: row.image ?? null,
        route: toDrinkRoute(row.slug),
        relatedUserId: row.userId,
        relatedUsername: row.username ?? null,
        relatedDrinkSlug: row.slug,
      });
    }

    for (const row of mostRemixedRows) {
      if (!row.remixedFromSlug) continue;
      const canonicalDrink = getCanonicalDrinkBySlug(row.remixedFromSlug);
      const name = canonicalDrink?.name ?? row.remixedFromSlug;
      items.push({
        type: "most_remixed_highlight",
        createdAt: new Date(Date.now() - 10 * 60 * 1000).toISOString(),
        title: `${name} is one of the most remixed drinks`,
        subtitle: `${Number(row.remixesCount ?? 0).toLocaleString()} total remixes so far.`,
        image: canonicalDrink?.image ?? null,
        route: "/drinks/most-remixed",
        relatedUserId: null,
        relatedUsername: null,
        relatedDrinkSlug: row.remixedFromSlug,
      });
    }

    const unique = new Set<string>();
    const deduped = items.filter((item) => {
      const key = `${item.type}:${item.route}:${item.relatedUserId ?? "none"}:${item.relatedDrinkSlug ?? "none"}`;
      if (unique.has(key)) return false;
      unique.add(key);
      return true;
    });

    const mixed = deduped
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(offset, offset + limit);

    return res.json({
      ok: true,
      count: mixed.length,
      itemTypes: [
        "remix",
        "trending_drink",
        "trending_creator",
        "followed_creator_post",
        "most_remixed_highlight",
      ],
      limit,
      offset,
      items: mixed,
    });
  } catch (error) {
    console.error("Error loading drinks what's new feed:", error);
    return res.status(500).json({ ok: false, error: "Failed to fetch drinks what's new feed" });
  }
});


r.get("/creators/leaderboard", async (req, res) => {
  try {
    if (!db) {
      return res.status(503).json({ ok: false, error: "Database unavailable" });
    }

    const limitParam = Number(req.query?.limit);
    const limit = Number.isFinite(limitParam) ? limitParam : 10;
    const leaderboard = await getDrinkCreatorLeaderboard(limit);

    return res.json({ ok: true, leaderboard, count: leaderboard.length });
  } catch (error) {
    console.error("Error fetching drink creator leaderboard:", error);
    return res.status(500).json({ ok: false, error: "Failed to fetch drink creator leaderboard" });
  }
});

r.get("/creators/trending", async (req, res) => {
  try {
    if (!db) {
      return res.status(503).json({ ok: false, error: "Database unavailable" });
    }

    const limitParam = Number(req.query?.limit);
    const limit = Number.isFinite(limitParam) ? limitParam : 25;
    const creators = await getTrendingDrinkCreators(limit);

    return res.json({
      ok: true,
      creators,
      count: creators.length,
      rankingFormula: "score = totalViews7d*1 + totalRemixesReceived*4 + totalGroceryAdds*2 + recentCreatedCount*1",
    });
  } catch (error) {
    console.error("Error fetching trending drink creators:", error);
    return res.status(500).json({ ok: false, error: "Failed to fetch trending drink creators" });
  }
});

r.get("/creator/:userId/badges", optionalAuth, async (req, res) => {
  try {
    if (!db) {
      return res.status(503).json({ ok: false, error: "Database unavailable" });
    }

    const requestedUserId = String(req.params?.userId ?? "").trim();
    if (!requestedUserId) {
      return res.status(400).json({ ok: false, error: "userId is required" });
    }

    const badgeData = await buildCreatorBadges(requestedUserId);
    const isOwnerView = Boolean(req.user?.id && req.user.id === requestedUserId);

    const privateBadges = badgeData.badges;
    const publicBadges = privateBadges
      .filter((badge) => badge.isPublic && badge.isEarned)
      .map((badge) => ({ ...badge, progress: null }));

    return res.json({
      ok: true,
      userId: requestedUserId,
      visibility: isOwnerView ? "private" : "public",
      badges: isOwnerView ? privateBadges : publicBadges,
      earnedCount: (isOwnerView ? privateBadges : publicBadges).filter((badge) => badge.isEarned).length,
      totalCount: isOwnerView ? privateBadges.length : publicBadges.length,
      nextMilestones: isOwnerView
        ? privateBadges
            .filter((badge) => !badge.isEarned && badge.progress)
            .sort((a, b) => {
              const ar = a.progress ? (a.progress.current / Math.max(a.progress.target, 1)) : 0;
              const br = b.progress ? (b.progress.current / Math.max(b.progress.target, 1)) : 0;
              return br - ar;
            })
            .slice(0, 2)
            .map((badge) => ({
              id: badge.id,
              title: badge.title,
              icon: badge.icon,
              description: badge.description,
              progress: badge.progress,
            }))
        : [],
    });
  } catch (error) {
    console.error("Error fetching drink creator badges:", error);
    return res.status(500).json({ ok: false, error: "Failed to fetch creator badges" });
  }
});

// Creator dashboard metrics for a user's submitted/remixed drink recipes
r.get("/creator/:userId", requireAuth, async (req, res) => {
  try {
    if (!db) {
      return res.status(503).json({ ok: false, error: "Database unavailable" });
    }

    const requestedUserId = String(req.params?.userId ?? "").trim();
    if (!requestedUserId) {
      return res.status(400).json({ ok: false, error: "userId is required" });
    }

    const authUserId = String(req.user.id ?? "").trim();
    if (!authUserId || requestedUserId !== authUserId) {
      return res.status(403).json({ ok: false, error: "Not authorized" });
    }

    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    const recipes = await db
      .select({
        id: drinkRecipes.id,
        slug: drinkRecipes.slug,
        name: drinkRecipes.name,
        image: drinkRecipes.image,
        createdAt: drinkRecipes.createdAt,
        remixedFromSlug: drinkRecipes.remixedFromSlug,
      })
      .from(drinkRecipes)
      .where(eq(drinkRecipes.userId, requestedUserId))
      .orderBy(desc(drinkRecipes.createdAt));

    const creatorLeaderboard = await getDrinkCreatorLeaderboard(250);
    const creatorRank = creatorLeaderboard.findIndex((entry) => entry.userId === requestedUserId) + 1;
    const creatorLeaderboardEntry = creatorLeaderboard.find((entry) => entry.userId === requestedUserId) ?? null;

    if (recipes.length === 0) {
      return res.json({
        ok: true,
        userId: requestedUserId,
        summary: {
          creatorRank: creatorRank > 0 ? creatorRank : null,
          creatorScore: creatorLeaderboardEntry?.creatorScore ?? 0,
          totalCreated: 0,
          totalRemixesCreated: 0,
          totalViews7d: 0,
          totalRemixesReceived: 0,
          totalGroceryAdds: 0,
          topPerformingDrink: null,
          mostRemixedDrink: null,
          followerCount: Number((await db.select({ followersCount: users.followersCount }).from(users).where(eq(users.id, requestedUserId)).limit(1))[0]?.followersCount ?? 0),
          isFollowing: false,
        },
        items: [],
      });
    }

    const recipeSlugs = recipes.map((recipe) => recipe.slug).filter((slug): slug is string => typeof slug === "string" && slug.length > 0);

    const eventRows = recipeSlugs.length > 0
      ? await db
          .select({
            slug: drinkEvents.slug,
            views24h: sql<number>`count(*) filter (where ${drinkEvents.eventType} = 'view' and ${drinkEvents.createdAt} > ${oneDayAgo})`,
            views7d: sql<number>`count(*) filter (where ${drinkEvents.eventType} = 'view' and ${drinkEvents.createdAt} > ${sevenDaysAgo})`,
            groceryAdds: sql<number>`count(*) filter (where ${drinkEvents.eventType} = 'grocery_add' and ${drinkEvents.createdAt} > ${sevenDaysAgo})`,
          })
          .from(drinkEvents)
          .where(and(inArray(drinkEvents.slug, recipeSlugs), gt(drinkEvents.createdAt, sevenDaysAgo)))
          .groupBy(drinkEvents.slug)
      : [];

    const remixedByOthersRows = recipeSlugs.length > 0
      ? await db
          .select({
            remixedFromSlug: drinkRecipes.remixedFromSlug,
            remixesCount: sql<number>`count(*)`,
          })
          .from(drinkRecipes)
          .where(inArray(drinkRecipes.remixedFromSlug, recipeSlugs))
          .groupBy(drinkRecipes.remixedFromSlug)
      : [];

    const eventsBySlug = new Map(
      eventRows.map((row) => [row.slug, {
        views24h: Number(row.views24h ?? 0),
        views7d: Number(row.views7d ?? 0),
        groceryAdds: Number(row.groceryAdds ?? 0),
      }])
    );

    const remixesBySlug = new Map(
      remixedByOthersRows
        .filter((row): row is { remixedFromSlug: string; remixesCount: number } => Boolean(row.remixedFromSlug))
        .map((row) => [row.remixedFromSlug, Number(row.remixesCount ?? 0)])
    );

    const items = recipes.map((recipe) => {
      const metrics = eventsBySlug.get(recipe.slug) ?? { views24h: 0, views7d: 0, groceryAdds: 0 };
      const remixesCount = remixesBySlug.get(recipe.slug) ?? 0;
      const score = (metrics.views24h * 3) + (Math.max(metrics.views7d - metrics.views24h, 0) * 1) + (remixesCount * 4) + (metrics.groceryAdds * 2);

      return {
        id: recipe.id,
        slug: recipe.slug,
        name: recipe.name,
        image: recipe.image ?? null,
        createdAt: recipe.createdAt,
        remixedFromSlug: recipe.remixedFromSlug ?? null,
        views7d: metrics.views7d,
        views24h: metrics.views24h,
        remixesCount,
        groceryAdds: metrics.groceryAdds,
        score,
      };
    });

    const totalCreated = items.length;
    const totalRemixesCreated = items.filter((item) => Boolean(item.remixedFromSlug)).length;
    const totalViews7d = items.reduce((sum, item) => sum + item.views7d, 0);
    const totalRemixesReceived = items.reduce((sum, item) => sum + item.remixesCount, 0);
    const totalGroceryAdds = items.reduce((sum, item) => sum + item.groceryAdds, 0);
    const [topPerformingDrink] = [...items].sort((a, b) => b.score - a.score || b.views7d - a.views7d || b.remixesCount - a.remixesCount);
    const [mostRemixedDrink] = [...items].sort((a, b) => b.remixesCount - a.remixesCount || b.score - a.score || b.views7d - a.views7d);

    return res.json({
      ok: true,
      userId: requestedUserId,
      summary: {
        creatorRank: creatorRank > 0 ? creatorRank : null,
        creatorScore: creatorLeaderboardEntry?.creatorScore ?? 0,
        totalCreated,
        totalRemixesCreated,
        totalViews7d,
        totalRemixesReceived,
        totalGroceryAdds,
        topPerformingDrink: topPerformingDrink
          ? {
            id: topPerformingDrink.id,
            slug: topPerformingDrink.slug,
            name: topPerformingDrink.name,
            image: topPerformingDrink.image,
            score: topPerformingDrink.score,
          }
          : null,
        mostRemixedDrink: mostRemixedDrink
          ? {
            id: mostRemixedDrink.id,
            slug: mostRemixedDrink.slug,
            name: mostRemixedDrink.name,
            image: mostRemixedDrink.image,
            remixesCount: mostRemixedDrink.remixesCount,
          }
          : null,
        followerCount: Number((await db.select({ followersCount: users.followersCount }).from(users).where(eq(users.id, requestedUserId)).limit(1))[0]?.followersCount ?? 0),
        isFollowing: false,
      },
      items,
    });
  } catch (error) {
    console.error("[drinks/creator/:userId] Error fetching creator drink metrics:", { requestedUserId: req.params?.userId, authUserId: req.user?.id, error });
    const message = error instanceof Error ? error.message : String(error);
    return res.status(500).json({ ok: false, error: process.env.NODE_ENV === "production" ? "Failed to fetch creator drink metrics" : `Failed to fetch creator drink metrics: ${message}` });
  }
});


// Unified drinks notifications feed for the signed-in creator user
r.get("/notifications", requireAuth, async (req, res) => {
  try {
    if (!db) {
      return res.status(503).json({ ok: false, error: "Database unavailable" });
    }

    const requestedUserId = String(req.user.id ?? "").trim();
    if (!requestedUserId) {
      return res.status(400).json({ ok: false, error: "userId is required" });
    }

    const limitParam = Number(req.query?.limit);
    const limit = Number.isFinite(limitParam) ? Math.max(10, Math.min(limitParam, 200)) : 80;

    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    const recipes = await db
      .select({ slug: drinkRecipes.slug, name: drinkRecipes.name })
      .from(drinkRecipes)
      .where(eq(drinkRecipes.userId, requestedUserId));

    const recipeSlugs = recipes.map((recipe) => recipe.slug).filter((slug): slug is string => typeof slug === "string" && slug.length > 0);
    const recipeNameBySlug = new Map(recipes.map((recipe) => [recipe.slug, recipe.name]));

    const activityItems: CreatorActivityItem[] = [];

    if (recipeSlugs.length > 0) {
      const recentEvents = await db
        .select({
          slug: drinkEvents.slug,
          eventType: drinkEvents.eventType,
          createdAt: drinkEvents.createdAt,
          actorUserId: drinkEvents.userId,
          actorUsername: users.username,
        })
        .from(drinkEvents)
        .leftJoin(users, eq(users.id, drinkEvents.userId))
        .where(
          and(
            inArray(drinkEvents.slug, recipeSlugs),
            inArray(drinkEvents.eventType, ["view", "grocery_add"]),
            gt(drinkEvents.createdAt, thirtyDaysAgo),
          ),
        )
        .orderBy(desc(drinkEvents.createdAt))
        .limit(600);

      type DailyAggregate = {
        slug: string;
        eventType: "view" | "grocery_add";
        dateKey: string;
        createdAt: Date;
        totalCount: number;
        actorIds: Set<string>;
      };

      const dailyEventSummary = new Map<string, DailyAggregate>();
      for (const event of recentEvents) {
        if (!event.createdAt) continue;
        const normalizedEventType = event.eventType === "grocery_add" ? "grocery_add" : "view";
        const dateKey = toActivityDateKey(event.createdAt);
        const key = `${event.slug}:${normalizedEventType}:${dateKey}`;
        const existing = dailyEventSummary.get(key);
        if (existing) {
          existing.totalCount += 1;
          if (event.actorUserId) existing.actorIds.add(event.actorUserId);
        } else {
          dailyEventSummary.set(key, {
            slug: event.slug,
            eventType: normalizedEventType,
            dateKey,
            createdAt: event.createdAt,
            totalCount: 1,
            actorIds: new Set(event.actorUserId ? [event.actorUserId] : []),
          });
        }
      }

      for (const item of dailyEventSummary.values()) {
        const targetDrinkName = recipeNameBySlug.get(item.slug) ?? item.slug;
        const readableDay = toReadableDay(item.createdAt);
        const uniqueActors = item.actorIds.size;

        if (item.eventType === "view") {
          activityItems.push({
            type: "view",
            createdAt: item.createdAt.toISOString(),
            actorUserId: null,
            actorUsername: null,
            targetDrinkSlug: item.slug,
            targetDrinkName,
            route: `/drinks/recipe/${item.slug}`,
            message: `Your drink ${targetDrinkName} got ${item.totalCount} view${item.totalCount === 1 ? "" : "s"} on ${readableDay}`,
            count: item.totalCount,
            uniqueActors,
          });
        } else {
          activityItems.push({
            type: "grocery_add",
            createdAt: item.createdAt.toISOString(),
            actorUserId: null,
            actorUsername: null,
            targetDrinkSlug: item.slug,
            targetDrinkName,
            route: `/drinks/recipe/${item.slug}`,
            message: `Your drink ${targetDrinkName} was added to shopping lists ${item.totalCount} time${item.totalCount === 1 ? "" : "s"} on ${readableDay}`,
            count: item.totalCount,
            uniqueActors,
          });
        }
      }

      const remixRows = await db
        .select({
          slug: drinkRecipes.slug,
          name: drinkRecipes.name,
          remixedFromSlug: drinkRecipes.remixedFromSlug,
          createdAt: drinkRecipes.createdAt,
          actorUserId: drinkRecipes.userId,
          actorUsername: users.username,
        })
        .from(drinkRecipes)
        .leftJoin(users, eq(users.id, drinkRecipes.userId))
        .where(
          and(
            inArray(drinkRecipes.remixedFromSlug, recipeSlugs),
            gt(drinkRecipes.createdAt, thirtyDaysAgo),
          ),
        )
        .orderBy(desc(drinkRecipes.createdAt))
        .limit(250);

      for (const remix of remixRows) {
        const parentSlug = remix.remixedFromSlug;
        if (!parentSlug) continue;
        const parentName = recipeNameBySlug.get(parentSlug) ?? parentSlug;
        const remixName = remix.name ?? remix.slug;
        const actorIsCreator = remix.actorUserId === requestedUserId;
        const actorUsername = actorIsCreator ? null : remix.actorUsername ?? null;
        const actorUserId = actorIsCreator ? null : remix.actorUserId ?? null;
        const actorPrefix = actorUsername ? `@${actorUsername}` : "Someone";

        activityItems.push({
          type: "remix",
          createdAt: remix.createdAt.toISOString(),
          actorUserId,
          actorUsername,
          targetDrinkSlug: parentSlug,
          targetDrinkName: parentName,
          route: `/drinks/recipe/${remix.slug}`,
          message: `${actorPrefix} remixed your drink ${parentName} into ${remixName}`,
        });
      }
    }

    const followerRows = await db
      .select({
        createdAt: follows.createdAt,
        actorUserId: follows.followerId,
        actorUsername: users.username,
      })
      .from(follows)
      .leftJoin(users, eq(users.id, follows.followerId))
      .where(and(eq(follows.followingId, requestedUserId), gt(follows.createdAt, thirtyDaysAgo)))
      .orderBy(desc(follows.createdAt))
      .limit(100);

    for (const row of followerRows) {
      const actorUsername = row.actorUsername ?? null;
      activityItems.push({
        type: "follow",
        createdAt: row.createdAt.toISOString(),
        actorUserId: row.actorUserId ?? null,
        actorUsername,
        targetDrinkSlug: null,
        targetDrinkName: null,
        route: `/drinks/creator/${requestedUserId}`,
        message: actorUsername ? `@${actorUsername} started following you` : "Someone started following you",
      });
    }

    const sorted = activityItems
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, limit);

    const notifications = buildDrinkNotificationFeed(requestedUserId, sorted);

    const typeCounts = notifications.reduce(
      (acc, item) => {
        acc[item.type] += 1;
        return acc;
      },
      { view_summary: 0, grocery_add: 0, remix: 0, follow: 0 } as Record<DrinkNotificationType, number>,
    );

    return res.json({
      ok: true,
      userId: requestedUserId,
      generatedAt: new Date().toISOString(),
      items: notifications,
      summary: {
        totalItems: notifications.length,
        typeCounts,
        windowDays: 30,
        summarized: ["view_summary", "grocery_add"],
      },
    });
  } catch (error) {
    console.error("Error loading drinks notifications:", error);
    return res.status(500).json({ ok: false, error: "Failed to fetch drinks notifications" });
  }
});

r.get("/alerts", requireAuth, async (req, res) => {
  try {
    if (!db) {
      return res.status(503).json({ ok: false, error: "Database unavailable" });
    }

    await maybeSendCreatorDropRsvpLiveAlerts();

    const limitParam = Number(req.query?.limit);
    const limit = Number.isFinite(limitParam) ? Math.max(1, Math.min(limitParam, 100)) : 50;

    const rows = await db
      .select()
      .from(notifications)
      .where(
        and(
          eq(notifications.userId, req.user!.id),
          inArray(notifications.type, DRINK_ALERT_TYPE_VALUES),
        ),
      )
      .orderBy(desc(notifications.createdAt))
      .limit(limit);

    const alerts = rows.map(serializeDrinkAlert);
    return res.json({
      ok: true,
      userId: req.user!.id,
      alerts,
      count: alerts.length,
      unreadCount: alerts.filter((alert) => !alert.isRead).length,
      empty: alerts.length === 0,
    });
  } catch (error) {
    console.error("Error loading drinks alerts:", error);
    return res.status(500).json({ ok: false, error: "Failed to fetch drinks alerts" });
  }
});

r.post("/alerts/read-all", requireAuth, async (req, res) => {
  try {
    if (!db) {
      return res.status(503).json({ ok: false, error: "Database unavailable" });
    }

    await db
      .update(notifications)
      .set({ read: true, readAt: new Date() })
      .where(
        and(
          eq(notifications.userId, req.user!.id),
          eq(notifications.read, false),
          inArray(notifications.type, DRINK_ALERT_TYPE_VALUES),
        ),
      );

    return res.json({ ok: true });
  } catch (error) {
    console.error("Error marking all drinks alerts read:", error);
    return res.status(500).json({ ok: false, error: "Failed to update alerts" });
  }
});

r.post("/alerts/:id/read", requireAuth, async (req, res) => {
  try {
    if (!db) {
      return res.status(503).json({ ok: false, error: "Database unavailable" });
    }

    const rows = await db
      .update(notifications)
      .set({ read: true, readAt: new Date() })
      .where(
        and(
          eq(notifications.id, req.params.id),
          eq(notifications.userId, req.user!.id),
          inArray(notifications.type, DRINK_ALERT_TYPE_VALUES),
        ),
      )
      .returning();

    const alert = rows[0];
    if (!alert) {
      return res.status(404).json({ ok: false, error: "Alert not found" });
    }

    return res.json({ ok: true, alert: serializeDrinkAlert(alert) });
  } catch (error) {
    console.error("Error marking drinks alert read:", error);
    return res.status(500).json({ ok: false, error: "Failed to update alert" });
  }
});

// Lightweight creator activity feed derived from drink events/remixes/follows
r.get("/creator/:userId/activity", requireAuth, async (req, res) => {
  try {
    if (!db) {
      return res.status(503).json({ ok: false, error: "Database unavailable" });
    }

    const requestedUserId = String(req.params?.userId ?? "").trim();
    if (!requestedUserId) {
      return res.status(400).json({ ok: false, error: "userId is required" });
    }

    const authUserId = String(req.user.id ?? "").trim();
    if (!authUserId || requestedUserId !== authUserId) {
      return res.status(403).json({ ok: false, error: "Not authorized" });
    }

    const limitParam = Number(req.query?.limit);
    const limit = Number.isFinite(limitParam) ? Math.max(10, Math.min(limitParam, 200)) : 80;
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    const recipes = await db
      .select({ slug: drinkRecipes.slug, name: drinkRecipes.name })
      .from(drinkRecipes)
      .where(eq(drinkRecipes.userId, requestedUserId));

    const recipeSlugs = recipes.map((recipe) => recipe.slug).filter((slug): slug is string => typeof slug === "string" && slug.length > 0);
    const recipeNameBySlug = new Map(recipes.map((recipe) => [recipe.slug, recipe.name]));

    const activityItems: CreatorActivityItem[] = [];

    if (recipeSlugs.length > 0) {
      const recentEvents = await db
        .select({
          slug: drinkEvents.slug,
          eventType: drinkEvents.eventType,
          createdAt: drinkEvents.createdAt,
          actorUserId: drinkEvents.userId,
          actorUsername: users.username,
        })
        .from(drinkEvents)
        .leftJoin(users, eq(users.id, drinkEvents.userId))
        .where(
          and(
            inArray(drinkEvents.slug, recipeSlugs),
            inArray(drinkEvents.eventType, ["view", "grocery_add"]),
            gt(drinkEvents.createdAt, thirtyDaysAgo),
          ),
        )
        .orderBy(desc(drinkEvents.createdAt))
        .limit(600);

      type DailyAggregate = {
        slug: string;
        eventType: "view" | "grocery_add";
        dateKey: string;
        createdAt: Date;
        totalCount: number;
        actorIds: Set<string>;
      };

      const dailyEventSummary = new Map<string, DailyAggregate>();
      for (const event of recentEvents) {
        if (!event.createdAt) continue;
        const normalizedEventType = event.eventType === "grocery_add" ? "grocery_add" : "view";
        const dateKey = toActivityDateKey(event.createdAt);
        const key = `${event.slug}:${normalizedEventType}:${dateKey}`;
        const existing = dailyEventSummary.get(key);
        if (existing) {
          existing.totalCount += 1;
          if (event.actorUserId) existing.actorIds.add(event.actorUserId);
        } else {
          dailyEventSummary.set(key, {
            slug: event.slug,
            eventType: normalizedEventType,
            dateKey,
            createdAt: event.createdAt,
            totalCount: 1,
            actorIds: new Set(event.actorUserId ? [event.actorUserId] : []),
          });
        }
      }

      for (const item of dailyEventSummary.values()) {
        const targetDrinkName = recipeNameBySlug.get(item.slug) ?? item.slug;
        const readableDay = toReadableDay(item.createdAt);
        const uniqueActors = item.actorIds.size;

        if (item.eventType === "view") {
          activityItems.push({
            type: "view",
            createdAt: item.createdAt.toISOString(),
            actorUserId: null,
            actorUsername: null,
            targetDrinkSlug: item.slug,
            targetDrinkName,
            route: `/drinks/recipe/${item.slug}`,
            message: `Your drink ${targetDrinkName} got ${item.totalCount} view${item.totalCount === 1 ? "" : "s"} on ${readableDay}`,
            count: item.totalCount,
            uniqueActors,
          });
        } else {
          activityItems.push({
            type: "grocery_add",
            createdAt: item.createdAt.toISOString(),
            actorUserId: null,
            actorUsername: null,
            targetDrinkSlug: item.slug,
            targetDrinkName,
            route: `/drinks/recipe/${item.slug}`,
            message: `Your drink ${targetDrinkName} was added to shopping lists ${item.totalCount} time${item.totalCount === 1 ? "" : "s"} on ${readableDay}`,
            count: item.totalCount,
            uniqueActors,
          });
        }
      }

      const remixRows = await db
        .select({
          slug: drinkRecipes.slug,
          name: drinkRecipes.name,
          remixedFromSlug: drinkRecipes.remixedFromSlug,
          createdAt: drinkRecipes.createdAt,
          actorUserId: drinkRecipes.userId,
          actorUsername: users.username,
        })
        .from(drinkRecipes)
        .leftJoin(users, eq(users.id, drinkRecipes.userId))
        .where(
          and(
            inArray(drinkRecipes.remixedFromSlug, recipeSlugs),
            gt(drinkRecipes.createdAt, thirtyDaysAgo),
          ),
        )
        .orderBy(desc(drinkRecipes.createdAt))
        .limit(250);

      for (const remix of remixRows) {
        const parentSlug = remix.remixedFromSlug;
        if (!parentSlug) continue;
        const parentName = recipeNameBySlug.get(parentSlug) ?? parentSlug;
        const remixName = remix.name ?? remix.slug;
        const actorIsCreator = remix.actorUserId === requestedUserId;
        const actorUsername = actorIsCreator ? null : remix.actorUsername ?? null;
        const actorUserId = actorIsCreator ? null : remix.actorUserId ?? null;
        const actorPrefix = actorUsername ? `@${actorUsername}` : "Someone";

        activityItems.push({
          type: "remix",
          createdAt: remix.createdAt.toISOString(),
          actorUserId,
          actorUsername,
          targetDrinkSlug: parentSlug,
          targetDrinkName: parentName,
          route: `/drinks/recipe/${remix.slug}`,
          message: `${actorPrefix} remixed your drink ${parentName} into ${remixName}`,
        });
      }
    }

    const followerRows = await db
      .select({
        createdAt: follows.createdAt,
        actorUserId: follows.followerId,
        actorUsername: users.username,
      })
      .from(follows)
      .leftJoin(users, eq(users.id, follows.followerId))
      .where(and(eq(follows.followingId, requestedUserId), gt(follows.createdAt, thirtyDaysAgo)))
      .orderBy(desc(follows.createdAt))
      .limit(100);

    for (const row of followerRows) {
      const actorUsername = row.actorUsername ?? null;
      const actorPrefix = actorUsername ? `@${actorUsername}` : "Someone";
      activityItems.push({
        type: "follow",
        createdAt: row.createdAt.toISOString(),
        actorUserId: row.actorUserId ?? null,
        actorUsername,
        targetDrinkSlug: null,
        targetDrinkName: null,
        route: `/drinks/creator/${requestedUserId}`,
        message: `${actorPrefix} started following you`,
      });
    }

    const sorted = activityItems
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, limit);

    const typeCounts = sorted.reduce(
      (acc, item) => {
        acc[item.type] += 1;
        return acc;
      },
      { view: 0, grocery_add: 0, remix: 0, follow: 0 } as Record<CreatorActivityType, number>,
    );

    return res.json({
      ok: true,
      userId: requestedUserId,
      generatedAt: new Date().toISOString(),
      items: sorted,
      summary: {
        totalItems: sorted.length,
        typeCounts,
        windowDays: 30,
        summarized: ["view", "grocery_add"],
      },
    });
  } catch (error) {
    console.error("Error loading creator activity feed:", error);
    return res.status(500).json({ ok: false, error: "Failed to fetch creator activity" });
  }
});



r.post("/creators/:userId/follow", requireAuth, async (req, res) => {
  try {
    if (!db) {
      return res.status(503).json({ ok: false, error: "Database unavailable" });
    }

    const creatorId = String(req.params?.userId ?? "").trim();
    const viewerId = req.user.id;

    if (!creatorId) return res.status(400).json({ ok: false, error: "userId is required" });
    if (creatorId === viewerId) return res.status(400).json({ ok: false, error: "You cannot follow yourself" });

    const creator = await db.select({ id: users.id }).from(users).where(eq(users.id, creatorId)).limit(1);
    if (!creator[0]) return res.status(404).json({ ok: false, error: "Creator not found" });

    try {
      await storage.followUser(viewerId, creatorId);
    } catch {
      // ignore duplicate follows
    }

    const isFollowing = await storage.isFollowing(viewerId, creatorId);
    const creatorProfile = await db
      .select({ followersCount: users.followersCount })
      .from(users)
      .where(eq(users.id, creatorId))
      .limit(1);

    return res.json({ ok: true, isFollowing, followerCount: Number(creatorProfile[0]?.followersCount ?? 0) });
  } catch (error) {
    console.error("Error following drink creator:", error);
    return res.status(500).json({ ok: false, error: "Failed to follow creator" });
  }
});

r.delete("/creators/:userId/follow", requireAuth, async (req, res) => {
  try {
    if (!db) {
      return res.status(503).json({ ok: false, error: "Database unavailable" });
    }

    const creatorId = String(req.params?.userId ?? "").trim();
    const viewerId = req.user.id;

    if (!creatorId) return res.status(400).json({ ok: false, error: "userId is required" });
    if (creatorId === viewerId) return res.status(400).json({ ok: false, error: "Invalid creator" });

    await storage.unfollowUser(viewerId, creatorId);

    const isFollowing = await storage.isFollowing(viewerId, creatorId);
    const creatorProfile = await db
      .select({ followersCount: users.followersCount })
      .from(users)
      .where(eq(users.id, creatorId))
      .limit(1);

    return res.json({ ok: true, isFollowing, followerCount: Number(creatorProfile[0]?.followersCount ?? 0) });
  } catch (error) {
    console.error("Error unfollowing drink creator:", error);
    return res.status(500).json({ ok: false, error: "Failed to unfollow creator" });
  }
});

r.get("/creators/:userId/follow-status", requireAuth, async (req, res) => {
  try {
    if (!db) {
      return res.status(503).json({ ok: false, error: "Database unavailable" });
    }

    const creatorId = String(req.params?.userId ?? "").trim();
    const viewerId = req.user.id;

    if (!creatorId) return res.status(400).json({ ok: false, error: "userId is required" });

    const isFollowing = creatorId === viewerId ? false : await storage.isFollowing(viewerId, creatorId);
    const creatorProfile = await db
      .select({ followersCount: users.followersCount })
      .from(users)
      .where(eq(users.id, creatorId))
      .limit(1);

    return res.json({ ok: true, isFollowing, followerCount: Number(creatorProfile[0]?.followersCount ?? 0) });
  } catch (error) {
    console.error("Error checking drink creator follow status:", error);
    return res.status(500).json({ ok: false, error: "Failed to fetch follow status" });
  }
});


r.get("/creators/:userId", async (req, res) => {
  try {
    if (!db) {
      return res.status(503).json({ ok: false, error: "Database unavailable" });
    }

    const creatorId = String(req.params?.userId ?? "").trim();
    if (!creatorId) {
      return res.status(400).json({ ok: false, error: "userId is required" });
    }

    const profile = await db
      .select({ id: users.id, username: users.username, avatar: users.avatar, followersCount: users.followersCount })
      .from(users)
      .where(eq(users.id, creatorId))
      .limit(1);

    if (!profile[0]) {
      return res.status(404).json({ ok: false, error: "Creator not found" });
    }

    const { limit, offset } = parseLimitOffset(req.query as Record<string, unknown>, { limit: 24, maxLimit: 100 });

    const recipes = await db
      .select({
        id: drinkRecipes.id,
        slug: drinkRecipes.slug,
        name: drinkRecipes.name,
        image: drinkRecipes.image,
        createdAt: drinkRecipes.createdAt,
        remixedFromSlug: drinkRecipes.remixedFromSlug,
      })
      .from(drinkRecipes)
      .where(eq(drinkRecipes.userId, creatorId))
      .orderBy(desc(drinkRecipes.createdAt))
      .limit(limit)
      .offset(offset);

    if (recipes.length === 0) {
      return res.json({
        ok: true,
        userId: creatorId,
        username: profile[0].username ?? null,
        avatar: profile[0].avatar ?? null,
        followerCount: Number(profile[0].followersCount ?? 0),
        totalCreated: 0,
        totalViews7d: 0,
        totalRemixesReceived: 0,
        totalGroceryAdds: 0,
        topDrink: null,
        mostRemixedDrinks: [],
        recentRemixActivity: [],
        recentItems: [],
        limit,
        offset,
      });
    }

    const recipeSlugs = recipes.map((recipe) => recipe.slug).filter((slug): slug is string => typeof slug === "string" && slug.length > 0);
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    const eventRows = await db
      .select({
        slug: drinkEvents.slug,
        views7d: sql<number>`count(*) filter (where ${drinkEvents.eventType} = 'view' and ${drinkEvents.createdAt} > ${sevenDaysAgo})`,
        groceryAdds7d: sql<number>`count(*) filter (where ${drinkEvents.eventType} = 'grocery_add' and ${drinkEvents.createdAt} > ${sevenDaysAgo})`,
      })
      .from(drinkEvents)
      .where(and(inArray(drinkEvents.slug, recipeSlugs), gt(drinkEvents.createdAt, sevenDaysAgo)))
      .groupBy(drinkEvents.slug);

    const remixedByOthersRows = await db
      .select({ remixedFromSlug: drinkRecipes.remixedFromSlug, remixesCount: sql<number>`count(*)` })
      .from(drinkRecipes)
      .where(inArray(drinkRecipes.remixedFromSlug, recipeSlugs))
      .groupBy(drinkRecipes.remixedFromSlug);

    const eventsBySlug = new Map(
      eventRows.map((row) => [row.slug, { views7d: Number(row.views7d ?? 0), groceryAdds7d: Number(row.groceryAdds7d ?? 0) }])
    );

    const remixesBySlug = new Map(
      remixedByOthersRows
        .filter((row): row is { remixedFromSlug: string; remixesCount: number } => Boolean(row.remixedFromSlug))
        .map((row) => [row.remixedFromSlug, Number(row.remixesCount ?? 0)])
    );

    const items = recipes.map((recipe) => {
      const metrics = eventsBySlug.get(recipe.slug) ?? { views7d: 0, groceryAdds7d: 0 };
      const remixesCount = remixesBySlug.get(recipe.slug) ?? 0;
      const score = metrics.views7d + (remixesCount * 4) + (metrics.groceryAdds7d * 2);

      return {
        id: recipe.id,
        slug: recipe.slug,
        name: recipe.name,
        image: recipe.image ?? null,
        createdAt: recipe.createdAt,
        remixedFromSlug: recipe.remixedFromSlug ?? null,
        route: toDrinkRoute(recipe.slug),
        views7d: metrics.views7d,
        remixesCount,
        groceryAdds7d: metrics.groceryAdds7d,
        score,
      };
    });

    const totalCreated = items.length;
    const totalViews7d = items.reduce((sum, item) => sum + item.views7d, 0);
    const totalRemixesReceived = items.reduce((sum, item) => sum + item.remixesCount, 0);
    const totalGroceryAdds = items.reduce((sum, item) => sum + item.groceryAdds7d, 0);
    const [topDrink] = [...items].sort((a, b) => b.score - a.score || b.views7d - a.views7d || b.remixesCount - a.remixesCount);

    const mostRemixedDrinks = [...items]
      .sort((a, b) => b.remixesCount - a.remixesCount || b.views7d - a.views7d || b.score - a.score)
      .slice(0, 8)
      .map((item) => ({
        slug: item.slug,
        name: item.name,
        image: item.image,
        route: item.route,
        remixesCount: item.remixesCount,
        views7d: item.views7d,
      }));

    const remixesReceivedRows = await db
      .select({
        slug: drinkRecipes.slug,
        name: drinkRecipes.name,
        remixedFromSlug: drinkRecipes.remixedFromSlug,
        createdAt: drinkRecipes.createdAt,
        creatorUsername: users.username,
      })
      .from(drinkRecipes)
      .leftJoin(users, eq(drinkRecipes.userId, users.id))
      .where(inArray(drinkRecipes.remixedFromSlug, recipeSlugs))
      .orderBy(desc(drinkRecipes.createdAt))
      .limit(20);

    const creatorPublishedRemixes = recipes
      .filter((recipe) => Boolean(recipe.remixedFromSlug))
      .slice(0, 20);

    const recentRemixActivity = [
      ...remixesReceivedRows.map((row) => ({
        type: "received_remix" as const,
        slug: row.slug,
        name: row.name,
        createdAt: row.createdAt,
        route: `/drinks/recipe/${row.slug}`,
        remixedFromSlug: row.remixedFromSlug ?? null,
        creatorUsername: row.creatorUsername ?? null,
      })),
      ...creatorPublishedRemixes.map((recipe) => ({
        type: "creator_published_remix" as const,
        slug: recipe.slug,
        name: recipe.name,
        createdAt: recipe.createdAt,
        route: `/drinks/recipe/${recipe.slug}`,
        remixedFromSlug: recipe.remixedFromSlug ?? null,
        creatorUsername: profile[0].username ?? null,
      })),
    ]
      .sort((a, b) => {
        const aTime = a.createdAt ? new Date(a.createdAt).getTime() : 0;
        const bTime = b.createdAt ? new Date(b.createdAt).getTime() : 0;
        return bTime - aTime;
      })
      .slice(0, 16);

    return res.json({
      ok: true,
      userId: creatorId,
      username: profile[0].username ?? null,
      avatar: profile[0].avatar ?? null,
      followerCount: Number(profile[0].followersCount ?? 0),
      totalCreated,
      totalViews7d,
      totalRemixesReceived,
      totalGroceryAdds,
      topDrink: topDrink
        ? {
          slug: topDrink.slug,
          name: topDrink.name,
          image: topDrink.image,
          route: topDrink.route,
          score: topDrink.score,
        }
        : null,
      mostRemixedDrinks,
      recentRemixActivity,
      recentItems: items
        .slice(0, limit)
        .map(({ groceryAdds7d, score, ...item }) => item),
      limit,
      offset,
    });
  } catch (error) {
    console.error("Error fetching public drink creator profile:", error);
    return res.status(500).json({ ok: false, error: "Failed to fetch creator profile" });
  }
});

r.get("/creators/:userId/membership/status", optionalAuth, async (req, res) => {
  try {
    if (!db) {
      logCollectionDbUnavailable("/creators/:userId/membership/status", req);
      return res.status(503).json({ ok: false, error: "Database unavailable", code: "DB_UNAVAILABLE" });
    }

    await ensureDrinkCollectionsSchema();

    const plan = await loadCreatorMembershipPlanByCreatorId(req.params.userId);
    const membership = req.user?.id ? await loadViewerMembershipForCreator(req.user.id, req.params.userId) : null;
    const checkoutSessionId = typeof req.query.checkoutSessionId === "string" ? req.query.checkoutSessionId.trim() : "";
    const checkoutSession = req.user?.id
      ? checkoutSessionId
        ? await loadMembershipCheckoutSessionForUser(checkoutSessionId, req.user.id)
        : await loadLatestMembershipCheckoutSessionForUserCreator(req.user.id, req.params.userId)
      : null;
    const checkoutVerification = checkoutSession ? await verifyMembershipCheckoutSession(checkoutSession) : null;

    return res.json({
      ok: true,
      creatorUserId: req.params.userId,
      plan: serializeMembershipPlan(plan),
      membership: serializeMembershipRecord(checkoutVerification?.membership ?? membership),
      checkout: checkoutSession
        ? {
            id: checkoutSession.id,
            status: checkoutVerification?.status ?? checkoutSession.status,
            failureReason: checkoutVerification?.failureReason ?? checkoutSession.failureReason ?? null,
            checkoutUrl: checkoutSession.checkoutUrl ?? null,
            updatedAt: checkoutSession.updatedAt.toISOString(),
          }
        : null,
    });
  } catch (error) {
    const message = logCollectionRouteError("/creators/:userId/membership/status", req, error);
    return res.status(500).json(collectionServerError(message, "Failed to load membership status"));
  }
});

r.post("/creators/:userId/membership/create-checkout", requireAuth, async (req, res) => {
  try {
    if (!db) return res.status(503).json({ ok: false, error: "Database unavailable" });
    await ensureDrinkCollectionsSchema();

    if (req.user!.id === req.params.userId) {
      return res.status(400).json({ ok: false, error: "Creators cannot subscribe to their own membership." });
    }

    const configError = getSquareConfigError();
    if (configError) {
      return res.status(503).json({
        ok: false,
        error: `${configError} Set SQUARE_ENV, SQUARE_ACCESS_TOKEN, SQUARE_LOCATION_ID, and APP_BASE_URL before enabling memberships.`,
      });
    }

    const plan = await loadCreatorMembershipPlanByCreatorId(req.params.userId);
    if (!plan || !plan.isActive) {
      return res.status(404).json({ ok: false, error: "No active membership plan is available for this creator." });
    }

    const existingMembership = await loadViewerMembershipForCreator(req.user!.id, req.params.userId);
    if (isCreatorMembershipActiveRecord(existingMembership)) {
      return res.status(200).json({ ok: true, alreadyActive: true, membership: serializeMembershipRecord(existingMembership) });
    }

    const createdRows = await db
      .insert(creatorMembershipCheckoutSessions)
      .values({
        userId: req.user!.id,
        creatorUserId: req.params.userId,
        planId: plan.id,
        provider: "square",
        status: "pending",
        amountCents: Number(plan.priceCents ?? 0),
        currencyCode: normalizeSquareCurrencyCode(squareConfig.currency),
        providerReferenceId: `membership:${plan.id}:${crypto.randomUUID()}`,
        expiresAt: new Date(Date.now() + 1000 * 60 * 30),
      })
      .returning();
    const checkoutSession = createdRows[0];
    const squareClient = getSquareClient();
    const redirectUrl = `${req.protocol}://${req.get("host")}/drinks/creator/${encodeURIComponent(req.params.userId)}?membershipCheckoutSessionId=${encodeURIComponent(checkoutSession.id)}&membershipSquareCheckout=1`;
    const squareResponse = await squareClient.checkout.paymentLinks.create({
      idempotencyKey: checkoutSession.providerReferenceId,
      quickPay: {
        name: `${plan.name} membership`,
        priceMoney: {
          amount: BigInt(Number(plan.priceCents ?? 0)),
          currency: normalizeSquareCurrencyCode(squareConfig.currency) as any,
        },
        locationId: squareConfig.locationId!,
      },
      checkoutOptions: {
        redirectUrl,
      },
      prePopulatedData: {
        buyerEmail: req.user?.email ?? undefined,
      },
      description: `ChefSire creator membership ${plan.name}`,
    });

    const paymentLink = squareResponse.paymentLink;
    const orderId = paymentLink?.orderId ?? squareResponse.relatedResources?.orders?.[0]?.id ?? null;
    if (!paymentLink?.url || !paymentLink.id) {
      await db.update(creatorMembershipCheckoutSessions).set({
        status: "failed",
        failureReason: "Square did not return a usable membership checkout link.",
        updatedAt: new Date(),
      }).where(eq(creatorMembershipCheckoutSessions.id, checkoutSession.id));
      return res.status(502).json({ ok: false, error: "Failed to create Square checkout link" });
    }

    await db.update(creatorMembershipCheckoutSessions).set({
      squarePaymentLinkId: paymentLink.id,
      squareOrderId: orderId,
      checkoutUrl: paymentLink.url,
      updatedAt: new Date(),
    }).where(eq(creatorMembershipCheckoutSessions.id, checkoutSession.id));

    return res.status(201).json({
      ok: true,
      creatorUserId: req.params.userId,
      plan: serializeMembershipPlan(plan),
      checkoutSessionId: checkoutSession.id,
      checkoutUrl: paymentLink.url,
      amountCents: Number(plan.priceCents ?? 0),
      currencyCode: normalizeSquareCurrencyCode(squareConfig.currency),
      billingInterval: normalizeMembershipBillingInterval(plan.billingInterval),
      renewalMode: "manual_renewal_v1",
    });
  } catch (error) {
    const message = logCollectionRouteError("/creators/:userId/membership/create-checkout", req, error);
    return res.status(500).json(collectionServerError(message, "Failed to start Square membership checkout"));
  }
});


// Search drinks across canonical + user submissions
r.get("/search", async (req, res) => {
  try {
    const q = typeof req.query?.q === "string" ? req.query.q.trim() : "";
    if (!q) return res.json({ ok: true, items: [] });

    const canonicalMatches = searchDrinks({ q, source: "external", pageSize: 10, offset: 0 });

    let userMatches: any[] = [];
    if (db) {
      userMatches = await db
        .select()
        .from(drinkRecipes)
        .where(
          or(
            ilike(drinkRecipes.name, `%${q}%`),
            ilike(drinkRecipes.description, `%${q}%`),
            ilike(drinkRecipes.category, `%${q}%`),
            ilike(drinkRecipes.subcategory, `%${q}%`)
          )
        )
        .limit(20);
    }

    const external = (await canonicalMatches).results.map((item) => ({
      slug: item.sourceId,
      name: item.title,
      image: item.imageUrl ?? null,
      route: `/drinks/recipe/${item.sourceId}`,
      source: "external",
    }));

    const userItems = userMatches.map((item) => ({
      slug: item.slug,
      name: item.name,
      image: item.image ?? null,
      route: `/drinks/recipe/${item.slug}`,
      source: "chefsire",
      sourceCategoryRoute: `/drinks/${item.category}${item.subcategory ? `/${item.subcategory}` : ""}`,
    }));

    return res.json({ ok: true, items: [...userItems, ...external] });
  } catch (error) {
    console.error("Error searching drinks:", error);
    return res.status(500).json({ ok: false, error: "Failed to search drinks" });
  }
});

// Unified drinks community search (drinks, remixes, creators, challenges)
r.get("/community-search", async (req, res) => {
  try {
    const q = typeof req.query?.q === "string" ? req.query.q.trim() : "";
    if (!q) {
      return res.json({
        ok: true,
        query: "",
        results: {
          drinks: [],
          remixes: [],
          creators: [],
          challenges: [],
        },
      });
    }

    const canonicalMatches = await searchDrinks({ q, source: "external", pageSize: 8, offset: 0 });
    const queryLike = `%${q}%`;

    let userRecipeMatches: Array<{
      slug: string;
      name: string;
      image: string | null;
      category: string;
      subcategory: string | null;
      remixedFromSlug: string | null;
      creatorUsername: string | null;
      createdAt: Date;
    }> = [];

    let creators: Array<{
      userId: string;
      username: string;
      avatar: string | null;
      followerCount: number;
      route: string;
    }> = [];

    let challenges: Array<{
      slug: string;
      title: string;
      description: string;
      route: string;
      isActive: boolean;
    }> = [];

    if (db) {
      userRecipeMatches = await db
        .select({
          slug: drinkRecipes.slug,
          name: drinkRecipes.name,
          image: drinkRecipes.image,
          category: drinkRecipes.category,
          subcategory: drinkRecipes.subcategory,
          remixedFromSlug: drinkRecipes.remixedFromSlug,
          creatorUsername: users.username,
          createdAt: drinkRecipes.createdAt,
        })
        .from(drinkRecipes)
        .leftJoin(users, eq(users.id, drinkRecipes.userId))
        .where(
          or(
            ilike(drinkRecipes.name, queryLike),
            ilike(drinkRecipes.description, queryLike),
            ilike(drinkRecipes.category, queryLike),
            ilike(drinkRecipes.subcategory, queryLike),
            ilike(users.username, queryLike),
          ),
        )
        .orderBy(desc(drinkRecipes.createdAt))
        .limit(24);

      creators = await db
        .select({
          userId: users.id,
          username: users.username,
          avatar: users.avatar,
          followerCount: users.followersCount,
        })
        .from(users)
        .where(
          and(
            or(ilike(users.username, queryLike), ilike(users.displayName, queryLike), ilike(users.bio, queryLike)),
            sql`exists (select 1 from ${drinkRecipes} dr where dr.user_id = ${users.id})`,
          ),
        )
        .limit(8)
        .then((rows) =>
          rows.map((row) => ({
            userId: row.userId,
            username: row.username,
            avatar: row.avatar ?? null,
            followerCount: Number(row.followerCount ?? 0),
            route: `/drinks/creator/${row.userId}`,
          })),
        );

      challenges = await db
        .select({
          slug: drinkChallenges.slug,
          title: drinkChallenges.title,
          description: drinkChallenges.description,
          isActive: drinkChallenges.isActive,
          startsAt: drinkChallenges.startsAt,
          endsAt: drinkChallenges.endsAt,
        })
        .from(drinkChallenges)
        .where(
          or(
            ilike(drinkChallenges.slug, queryLike),
            ilike(drinkChallenges.title, queryLike),
            ilike(drinkChallenges.description, queryLike),
            ilike(drinkChallenges.theme, queryLike),
          ),
        )
        .orderBy(desc(drinkChallenges.createdAt))
        .limit(8)
        .then((rows) =>
          rows.map((row) => ({
            slug: row.slug,
            title: row.title,
            description: row.description,
            route: `/drinks/challenges/${row.slug}`,
            isActive:
              row.isActive &&
              row.startsAt.getTime() <= Date.now() &&
              row.endsAt.getTime() >= Date.now(),
          })),
        );
    }

    const allSearchSlugs = [
      ...canonicalMatches.results.map((item) => item.sourceId),
      ...userRecipeMatches.map((recipe) => recipe.slug),
    ];

    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const viewsBySlug = new Map<string, number>();
    const remixesBySlug = new Map<string, number>();

    if (db && allSearchSlugs.length > 0) {
      const viewRows = await db
        .select({ slug: drinkEvents.slug, views7d: sql<number>`count(*)` })
        .from(drinkEvents)
        .where(
          and(
            inArray(drinkEvents.slug, allSearchSlugs),
            eq(drinkEvents.eventType, "view"),
            gt(drinkEvents.createdAt, sevenDaysAgo),
          ),
        )
        .groupBy(drinkEvents.slug);

      const remixRows = await db
        .select({ remixedFromSlug: drinkRecipes.remixedFromSlug, remixesCount: sql<number>`count(*)` })
        .from(drinkRecipes)
        .where(inArray(drinkRecipes.remixedFromSlug, allSearchSlugs))
        .groupBy(drinkRecipes.remixedFromSlug);

      for (const row of viewRows) {
        viewsBySlug.set(row.slug, Number(row.views7d ?? 0));
      }

      for (const row of remixRows) {
        if (row.remixedFromSlug) {
          remixesBySlug.set(row.remixedFromSlug, Number(row.remixesCount ?? 0));
        }
      }
    }

    const canonicalDrinkResults = canonicalMatches.results.map((item) => ({
      slug: item.sourceId,
      name: item.title,
      image: item.imageUrl ?? null,
      route: `/drinks/recipe/${item.sourceId}`,
      sourceCategoryRoute: null,
      views7d: viewsBySlug.get(item.sourceId) ?? 0,
      remixesCount: remixesBySlug.get(item.sourceId) ?? 0,
      isTrending: item.relevanceScore >= 0.85,
    }));

    const userDrinkResults = userRecipeMatches
      .filter((recipe) => !recipe.remixedFromSlug)
      .map((recipe) => ({
        slug: recipe.slug,
        name: recipe.name,
        image: recipe.image ?? null,
        route: `/drinks/recipe/${recipe.slug}`,
        sourceCategoryRoute: `/drinks/${recipe.category}${recipe.subcategory ? `/${recipe.subcategory}` : ""}`,
        views7d: viewsBySlug.get(recipe.slug) ?? 0,
        remixesCount: remixesBySlug.get(recipe.slug) ?? 0,
        isTrending: recipe.createdAt.getTime() >= sevenDaysAgo.getTime(),
      }));

    const remixResults = userRecipeMatches
      .filter((recipe) => Boolean(recipe.remixedFromSlug))
      .map((recipe) => ({
        slug: recipe.slug,
        name: recipe.name,
        image: recipe.image ?? null,
        route: `/drinks/recipe/${recipe.slug}`,
        remixedFromSlug: recipe.remixedFromSlug,
        creatorUsername: recipe.creatorUsername ?? null,
        views7d: viewsBySlug.get(recipe.slug) ?? 0,
        remixesCount: remixesBySlug.get(recipe.slug) ?? 0,
        isTrending: recipe.createdAt.getTime() >= sevenDaysAgo.getTime(),
      }));

    return res.json({
      ok: true,
      query: q,
      results: {
        drinks: [...userDrinkResults, ...canonicalDrinkResults].slice(0, 12),
        remixes: remixResults.slice(0, 12),
        creators,
        challenges,
      },
    });
  } catch (error) {
    console.error("Error searching drinks community:", error);
    return res.status(500).json({ ok: false, error: "Failed to search drinks community" });
  }
});

// Helper to coerce query values into strings
function str(v: unknown): string | undefined {
  return typeof v === "string" ? v : undefined;
}

// ========================================
// DRINK COLLECTIONS
// ========================================

r.post("/collections", optionalAuth, async (req, res) => {
  try {
    if (!req.user?.id) return collectionAuthRequired(res);
    if (!db) {
      logCollectionDbUnavailable("", req);
      return res.status(503).json({ ok: false, error: "Database unavailable", code: "DB_UNAVAILABLE" });
    }

    await ensureDrinkCollectionsSchema();

    const requestedAccessType = deriveCollectionAccessType({
      accessType: req.body?.accessType,
      isPremium: req.body?.isPremium,
      fallback: "public",
    });
    const validation = validateCollectionAccessPayload(requestedAccessType, Number(req.body?.priceCents ?? 0));
    if (!validation.ok) {
      return res.status(400).json({ ok: false, error: validation.error });
    }

    const parsed = insertDrinkCollectionSchema.safeParse({
      userId: req.user.id,
      name: req.body?.name,
      description: normalizeCollectionDescription(req.body?.description),
      isPublic: Boolean(req.body?.isPublic),
      accessType: requestedAccessType,
      isPremium: requestedAccessType !== "public",
      priceCents: validation.normalizedPrice,
    });

    if (!parsed.success) {
      return res.status(400).json({ ok: false, error: "Invalid collection payload", details: parsed.error.flatten() });
    }

    const createdRows = await db.insert(drinkCollections).values(parsed.data).returning();
    const created = createdRows[0] ? normalizeCollectionRowForResponse(createdRows[0]) : null;
    if (created) {
      await maybeNotifyFollowersAboutPublishedPremiumCollection(created, null);
    }
    return res.status(201).json({ ok: true, collection: { ...created, itemsCount: 0, items: [] } });
  } catch (error) {
    logCollectionRouteError("", req, error);
    const payload = collectionDbErrorResponse(error, "Failed to create collection");
    const status = classifyCollectionError(error, "Failed to create collection").status;
    return res.status(status).json(payload);
  }
});

r.get("/collections/mine", optionalAuth, async (req, res) => {
  try {
    if (!req.user?.id) return collectionAuthRequired(res);
    if (!db) {
      logCollectionDbUnavailable("/mine", req);
      return res.status(503).json({ ok: false, error: "Database unavailable", code: "DB_UNAVAILABLE" });
    }

    await ensureDrinkCollectionsSchema();

    const { limit, offset } = parseLimitOffset(req.query as Record<string, unknown>, { limit: 20, maxLimit: 100 });

    const rows = await db
      .select()
      .from(drinkCollections)
      .where(eq(drinkCollections.userId, req.user.id))
      .orderBy(desc(drinkCollections.updatedAt))
      .limit(limit)
      .offset(offset);

    const collections = await Promise.all(rows.map((row) => resolveCollectionWithItems(row, req.user?.id ?? null)));
    return res.json({ ok: true, limit, offset, collections: collections.filter(Boolean) });
  } catch (error) {
    logCollectionRouteError("/mine", req, error);
    const payload = collectionDbErrorResponse(error, "Failed to load collections");
    const status = classifyCollectionError(error, "Failed to load collections").status;
    return res.status(status).json(payload);
  }
});

r.get("/collections/purchased", requireAuth, async (req, res) => {
  try {
    if (!db) {
      logCollectionDbUnavailable("/purchased", req);
      return res.status(503).json({ ok: false, error: "Database unavailable", code: "DB_UNAVAILABLE" });
    }

    await ensureDrinkCollectionsSchema();

    const collections = await loadPurchasedCollectionsForUser(req.user!.id);
    return res.json({
      ok: true,
      collections,
      count: collections.length,
    });
  } catch (error) {
    logCollectionRouteError("/purchased", req, error);
    const payload = collectionDbErrorResponse(error, "Failed to load purchased collections");
    const status = classifyCollectionError(error, "Failed to load purchased collections").status;
    return res.status(status).json(payload);
  }
});

r.get("/memberships/mine", requireAuth, async (req, res) => {
  try {
    if (!db) {
      logCollectionDbUnavailable("/memberships/mine", req);
      return res.status(503).json({ ok: false, error: "Database unavailable", code: "DB_UNAVAILABLE" });
    }
    await ensureDrinkCollectionsSchema();
    const memberships = await loadMembershipsForUser(req.user!.id);
    return res.json({
      ok: true,
      memberships,
      count: memberships.length,
      reportingNotes: [
        "Membership checkout in v1 uses Square payment links for a single monthly or yearly term.",
        "Canceling a membership stops future renewal intent in-app, but the current paid term stays active until its end date.",
        "Membership access adds to direct purchases, bundles, and gifts instead of replacing them.",
      ],
    });
  } catch (error) {
    const message = logCollectionRouteError("/memberships/mine", req, error);
    return res.status(500).json(collectionServerError(message, "Failed to load memberships"));
  }
});

r.post("/memberships/:id/cancel", requireAuth, async (req, res) => {
  try {
    if (!db) return res.status(503).json({ ok: false, error: "Database unavailable" });
    await ensureDrinkCollectionsSchema();

    const rows = await db
      .select()
      .from(creatorMemberships)
      .where(and(eq(creatorMemberships.id, req.params.id), eq(creatorMemberships.userId, req.user!.id)))
      .limit(1);
    const membership = rows[0];
    if (!membership) return res.status(404).json({ ok: false, error: "Membership not found" });

    const now = new Date();
    const nextStatus: CreatorMembershipStatus = membership.endsAt && membership.endsAt <= now ? "expired" : "canceled";
    const updatedRows = await db
      .update(creatorMemberships)
      .set({
        status: nextStatus,
        canceledAt: membership.canceledAt ?? now,
        updatedAt: now,
      })
      .where(eq(creatorMemberships.id, membership.id))
      .returning();

    return res.json({
      ok: true,
      membership: serializeMembershipRecord(updatedRows[0] ?? membership),
      note: "Version one memberships do not auto-renew yet, so canceling only updates the in-app membership status.",
    });
  } catch (error) {
    const message = logCollectionRouteError("/memberships/:id/cancel", req, error);
    return res.status(500).json(collectionServerError(message, "Failed to cancel membership"));
  }
});

r.post("/collections/:id/wishlist", requireAuth, async (req, res) => {
  try {
    if (!db) return res.status(503).json({ ok: false, error: "Database unavailable" });
    await ensureDrinkCollectionsSchema();

    const collectionRows = await db.select().from(drinkCollections).where(eq(drinkCollections.id, req.params.id)).limit(1);
    const collection = collectionRows[0] ? normalizeCollectionRowForResponse(collectionRows[0]) : null;
    if (!collection) return res.status(404).json({ ok: false, error: "Collection not found" });

    const isOwner = req.user!.id === collection.userId;
    if (!collection.isPublic && !isOwner) {
      return res.status(403).json({ ok: false, error: "Collection is private" });
    }
    if (collection.accessType !== "premium_purchase") {
      return res.status(400).json({ ok: false, error: "Only Premium Purchase collections can be wishlisted" });
    }
    if (isOwner) {
      return res.status(400).json({ ok: false, error: "You cannot wishlist your own Premium Purchase collection" });
    }

    const ownedCollectionIds = await loadOwnedCollectionIdsForUser(req.user!.id);
    if (ownedCollectionIds.has(collection.id)) {
      return res.status(400).json({ ok: false, error: "You already own this collection through a purchase, bundle, gift, or membership grant" });
    }

    const inserted = await db
      .insert(drinkCollectionWishlists)
      .values({
        userId: req.user!.id,
        collectionId: collection.id,
      })
      .onConflictDoNothing({ target: [drinkCollectionWishlists.userId, drinkCollectionWishlists.collectionId] })
      .returning();

    const wishlistCountsByCollectionId = await loadWishlistCountsForCollections([collection.id]);

    return res.status(inserted[0] ? 201 : 200).json({
      ok: true,
      collectionId: collection.id,
      isWishlisted: true,
      owned: false,
      wishlistCount: Number(wishlistCountsByCollectionId.get(collection.id) ?? 0),
    });
  } catch (error) {
    const message = logCollectionRouteError("/:id/wishlist", req, error);
    return res.status(500).json(collectionServerError(message, "Failed to add collection to wishlist"));
  }
});

r.delete("/collections/:id/wishlist", requireAuth, async (req, res) => {
  try {
    if (!db) return res.status(503).json({ ok: false, error: "Database unavailable" });
    await ensureDrinkCollectionsSchema();

    await db
      .delete(drinkCollectionWishlists)
      .where(
        and(
          eq(drinkCollectionWishlists.userId, req.user!.id),
          eq(drinkCollectionWishlists.collectionId, req.params.id),
        ),
      );

    const wishlistCountsByCollectionId = await loadWishlistCountsForCollections([req.params.id]);

    return res.json({
      ok: true,
      collectionId: req.params.id,
      isWishlisted: false,
      owned: false,
      wishlistCount: Number(wishlistCountsByCollectionId.get(req.params.id) ?? 0),
    });
  } catch (error) {
    const message = logCollectionRouteError("/:id/wishlist", req, error);
    return res.status(500).json(collectionServerError(message, "Failed to remove collection from wishlist"));
  }
});

r.get("/collections/:id/wishlist-status", requireAuth, async (req, res) => {
  try {
    if (!db) return res.status(503).json({ ok: false, error: "Database unavailable" });
    await ensureDrinkCollectionsSchema();

    const collectionRows = await db.select().from(drinkCollections).where(eq(drinkCollections.id, req.params.id)).limit(1);
    const collection = collectionRows[0];
    if (!collection) return res.status(404).json({ ok: false, error: "Collection not found" });

    const ownedCollectionIds = await loadOwnedCollectionIdsForUser(req.user!.id);
    const owned = req.user!.id === collection.userId || ownedCollectionIds.has(collection.id);

    const wishlistRows = owned
      ? []
      : await db
          .select({ id: drinkCollectionWishlists.id })
          .from(drinkCollectionWishlists)
          .where(
            and(
              eq(drinkCollectionWishlists.userId, req.user!.id),
              eq(drinkCollectionWishlists.collectionId, collection.id),
            ),
          )
          .limit(1);

    const wishlistCountsByCollectionId = await loadWishlistCountsForCollections([collection.id]);

    return res.json({
      ok: true,
      collectionId: collection.id,
      isWishlisted: !owned && Boolean(wishlistRows[0]),
      owned,
      wishlistCount: Number(wishlistCountsByCollectionId.get(collection.id) ?? 0),
    });
  } catch (error) {
    const message = logCollectionRouteError("/:id/wishlist-status", req, error);
    return res.status(500).json(collectionServerError(message, "Failed to load collection wishlist status"));
  }
});

r.get("/collections/wishlist", requireAuth, async (req, res) => {
  try {
    if (!db) {
      logCollectionDbUnavailable("/wishlist", req);
      return res.status(503).json({ ok: false, error: "Database unavailable", code: "DB_UNAVAILABLE" });
    }

    await ensureDrinkCollectionsSchema();

    const collections = await loadWishlistedCollectionsForUser(req.user!.id);
    return res.json({
      ok: true,
      collections,
      count: collections.length,
      promoAlertReadiness: {
        scaffolded: true,
        activelySurfacedCollections: collections.filter((collection) => Boolean(collection.activePromoPricing)).length,
      },
    });
  } catch (error) {
    logCollectionRouteError("/wishlist", req, error);
    const payload = collectionDbErrorResponse(error, "Failed to load wishlisted collections");
    const status = classifyCollectionError(error, "Failed to load wishlisted collections").status;
    return res.status(status).json(payload);
  }
});

r.get("/orders", requireAuth, async (req, res) => {
  try {
    if (!db) {
      logCollectionDbUnavailable("/orders", req);
      return res.status(503).json({ ok: false, error: "Database unavailable", code: "DB_UNAVAILABLE" });
    }

    await ensureDrinkCollectionsSchema();

    const orders = await loadBuyerCollectionOrders(req.user!.id);
    return res.json({
      ok: true,
      userId: req.user!.id,
      orders,
      count: orders.length,
      reportingNotes: [
        "Completed orders keep premium collection ownership active.",
        "Refunded, refund-pending, and revoked orders do not keep ownership active.",
        "Pending orders represent Square checkout activity that has not been granted ownership yet.",
      ],
    });
  } catch (error) {
    logCollectionRouteError("/orders", req, error);
    const payload = collectionDbErrorResponse(error, "Failed to load premium collection orders");
    const status = classifyCollectionError(error, "Failed to load premium collection orders").status;
    return res.status(status).json(payload);
  }
});

r.get("/collections/public/:userId", optionalAuth, async (req, res) => {
  try {
    if (!db) {
      logCollectionDbUnavailable("/public/:userId", req);
      return res.status(503).json({ ok: false, error: "Database unavailable", code: "DB_UNAVAILABLE" });
    }

    await ensureDrinkCollectionsSchema();

    const creatorUserId = String(req.params.userId ?? "").trim();
    if (!creatorUserId) {
      return res.status(400).json({ ok: false, error: "Creator userId is required." });
    }

    const { limit, offset } = parseLimitOffset(req.query as Record<string, unknown>, { limit: 20, maxLimit: 100 });
    const acceptedCollaborations = await loadAcceptedCollaborationsForCreator(creatorUserId);
    const collaborativeCollectionIds = acceptedCollaborations
      .filter((row) => row.collaborationType === "collection")
      .map((row) => row.targetId);

    const ownRows = await db
      .select()
      .from(drinkCollections)
      .where(and(eq(drinkCollections.userId, creatorUserId), eq(drinkCollections.isPublic, true)))
      .orderBy(desc(drinkCollections.updatedAt))
      .limit(limit + offset);

    const collaborativeRows = collaborativeCollectionIds.length > 0
      ? await db
          .select()
          .from(drinkCollections)
          .where(and(inArray(drinkCollections.id, collaborativeCollectionIds), eq(drinkCollections.isPublic, true)))
          .orderBy(desc(drinkCollections.updatedAt))
      : [];

    const rows = [...new Map([...ownRows, ...collaborativeRows].map((row) => [row.id, row])).values()]
      .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime())
      .slice(offset, offset + limit);

    const collections = await resolvePublicCollectionCards(rows, req.user?.id ?? null);
    return res.json({ ok: true, limit, offset, collections: collections.filter(Boolean) });
  } catch (error) {
    const message = logCollectionRouteError("/public/:userId", req, error);
    return res.status(500).json(collectionServerError(message, "Failed to load public collections"));
  }
});

r.get("/collections/explore", optionalAuth, async (req, res) => {
  try {
    if (!db) {
      logCollectionDbUnavailable("/explore", req);
      return res.status(503).json({ ok: false, error: "Database unavailable", code: "DB_UNAVAILABLE" });
    }

    await ensureDrinkCollectionsSchema();

    const { limit, offset } = parseLimitOffset(req.query as Record<string, unknown>, { limit: 24, maxLimit: 100 });

    const rows = await db
      .select()
      .from(drinkCollections)
      .where(eq(drinkCollections.isPublic, true))
      .orderBy(desc(drinkCollections.updatedAt))
      .limit(limit)
      .offset(offset);

    const collections = await resolvePublicCollectionCards(rows, req.user?.id ?? null);
    return res.json({ ok: true, limit, offset, collections });
  } catch (error) {
    const message = logCollectionRouteError("/explore", req, error);
    return res.status(500).json(collectionServerError(message, "Failed to load collections explore"));
  }
});

r.get("/collections/featured", optionalAuth, async (req, res) => {
  try {
    if (!db) {
      logCollectionDbUnavailable("/featured", req);
      return res.status(503).json({ ok: false, error: "Database unavailable", code: "DB_UNAVAILABLE" });
    }

    await ensureDrinkCollectionsSchema();

    const { limit } = parseLimitOffset(req.query as Record<string, unknown>, { limit: 8, maxLimit: 24 });

    const rows = await db
      .select()
      .from(drinkCollections)
      .where(eq(drinkCollections.isPublic, true))
      .orderBy(desc(drinkCollections.updatedAt))
      .limit(100);

    const hydrated = await resolvePublicCollectionCards(rows, req.user?.id ?? null);
    const featured = hydrated
      .sort((a, b) => featuredCollectionScore(b) - featuredCollectionScore(a))
      .slice(0, limit);

    return res.json({
      ok: true,
      ranking: "Featured score = (public collection itemsCount × 100) + recency bonus from updatedAt.",
      collections: featured,
    });
  } catch (error) {
    const message = logCollectionRouteError("/featured", req, error);
    return res.status(500).json(collectionServerError(message, "Failed to load featured collections"));
  }
});

r.get("/gifts", requireAuth, async (req, res) => {
  try {
    if (!db) {
      logCollectionDbUnavailable("/gifts", req);
      return res.status(503).json({ ok: false, error: "Database unavailable", code: "DB_UNAVAILABLE" });
    }

    await ensureDrinkCollectionsSchema();

    const history = await loadGiftHistory(req.user!.id, req);
    return res.json({
      ok: true,
      userId: req.user!.id,
      purchased: history.purchased,
      received: history.received,
    });
  } catch (error) {
    logCollectionRouteError("/gifts", req, error);
    const payload = collectionDbErrorResponse(error, "Failed to load gifts");
    const status = classifyCollectionError(error, "Failed to load gifts").status;
    return res.status(status).json(payload);
  }
});

r.get("/gifts/:token", optionalAuth, async (req, res) => {
  try {
    if (!db) return res.status(503).json({ ok: false, error: "Database unavailable" });
    await ensureDrinkCollectionsSchema();

    const gift = await loadGiftByCode(req.params.token);
    if (!gift) return res.status(404).json({ ok: false, error: "Gift not found" });

    let targetName = "Premium gift";
    let targetRoute = "/";
    if (gift.targetType === "collection") {
      const collection = await db.select({ id: drinkCollections.id, name: drinkCollections.name }).from(drinkCollections).where(eq(drinkCollections.id, gift.targetId)).limit(1);
      targetName = collection[0]?.name ?? "Premium collection";
      targetRoute = `/drinks/collections/${gift.targetId}`;
    } else {
      const bundle = await db.select({ id: drinkBundles.id, name: drinkBundles.name }).from(drinkBundles).where(eq(drinkBundles.id, gift.targetId)).limit(1);
      targetName = bundle[0]?.name ?? "Premium bundle";
      targetRoute = `/drinks/bundles/${gift.targetId}`;
    }

    const viewerOwnsTarget = req.user?.id
      ? (gift.targetType === "collection"
        ? (await loadOwnedCollectionIdsForUser(req.user.id)).has(gift.targetId)
        : (await loadOwnedBundleIdsForUser(req.user.id)).has(gift.targetId))
      : false;

    return res.json({
      ok: true,
      gift: {
        ...toGiftSummary(gift, buildGiftClaimUrl(req, gift.giftCode)),
        targetName,
        targetRoute,
      },
      viewer: {
        signedIn: Boolean(req.user?.id),
        userId: req.user?.id ?? null,
        canClaim: Boolean(req.user?.id)
          && gift.status !== "revoked"
          && (!gift.recipientUserId || gift.recipientUserId === req.user?.id),
        alreadyClaimedByViewer: Boolean(req.user?.id && gift.recipientUserId === req.user.id),
        ownsTarget: viewerOwnsTarget,
      },
    });
  } catch (error) {
    const message = logCollectionRouteError("/gifts/:token", req, error);
    return res.status(500).json(collectionServerError(message, "Failed to load gift"));
  }
});

r.post("/gifts/:token/claim", requireAuth, async (req, res) => {
  try {
    if (!db) return res.status(503).json({ ok: false, error: "Database unavailable" });
    await ensureDrinkCollectionsSchema();

    const gift = await loadGiftByCode(req.params.token);
    if (!gift) return res.status(404).json({ ok: false, error: "Gift not found" });

    const claimedGift = await claimGiftForUser(gift, req.user!.id);
    return res.json({
      ok: true,
      gift: {
        ...toGiftSummary(claimedGift, buildGiftClaimUrl(req, claimedGift.giftCode)),
        targetRoute: claimedGift.targetType === "collection"
          ? `/drinks/collections/${claimedGift.targetId}`
          : `/drinks/bundles/${claimedGift.targetId}`,
      },
    });
  } catch (error) {
    const status = typeof error === "object" && error !== null && "status" in error
      ? Number((error as { status?: unknown }).status || 500)
      : 500;
    const message = logCollectionRouteError("/gifts/:token/claim", req, error);
    return res.status(status).json({ ok: false, error: error instanceof Error ? error.message : message });
  }
});

// ========================================
// DRINK BUNDLES
// ========================================

r.post("/bundles", requireAuth, async (req, res) => {
  try {
    if (!db) return res.status(503).json({ ok: false, error: "Database unavailable" });
    await ensureDrinkCollectionsSchema();

    const parsed = createDrinkBundleBodySchema.safeParse(req.body ?? {});
    if (!parsed.success) {
      return res.status(400).json({ ok: false, error: "Invalid bundle payload", details: parsed.error.flatten() });
    }

    const slug = await ensureUniqueBundleSlug(parsed.data.slug ?? parsed.data.name);
    const createPayload = insertDrinkBundleSchema.parse({
      userId: req.user!.id,
      slug,
      name: parsed.data.name,
      description: normalizeCollectionDescription(parsed.data.description),
      isPublic: Boolean(parsed.data.isPublic),
      isPremium: parsed.data.isPremium ?? true,
      priceCents: Math.max(1, Number(parsed.data.priceCents ?? 0)),
    });

    const createdRows = await db.insert(drinkBundles).values(createPayload).returning();
    const bundle = createdRows[0];
    return res.status(201).json({ ok: true, bundle: await resolveBundleWithCollections(bundle, req.user!.id) });
  } catch (error) {
    const message = logCollectionRouteError("/bundles", req, error);
    return res.status(500).json(collectionServerError(message, "Failed to create bundle"));
  }
});

r.get("/bundles/mine", requireAuth, async (req, res) => {
  try {
    if (!db) return res.status(503).json({ ok: false, error: "Database unavailable" });
    await ensureDrinkCollectionsSchema();

    const rows = await db
      .select()
      .from(drinkBundles)
      .where(eq(drinkBundles.userId, req.user!.id))
      .orderBy(desc(drinkBundles.updatedAt));

    const bundles = await resolvePublicBundleCards(rows, req.user!.id);
    return res.json({ ok: true, bundles });
  } catch (error) {
    const message = logCollectionRouteError("/bundles/mine", req, error);
    return res.status(500).json(collectionServerError(message, "Failed to load bundles"));
  }
});

r.get("/bundles/public/:userId", optionalAuth, async (req, res) => {
  try {
    if (!db) return res.status(503).json({ ok: false, error: "Database unavailable" });
    await ensureDrinkCollectionsSchema();

    const rows = await db
      .select()
      .from(drinkBundles)
      .where(and(eq(drinkBundles.userId, req.params.userId), eq(drinkBundles.isPublic, true)))
      .orderBy(desc(drinkBundles.updatedAt));

    const bundles = await resolvePublicBundleCards(rows, req.user?.id ?? null);
    return res.json({ ok: true, bundles });
  } catch (error) {
    const message = logCollectionRouteError("/bundles/public/:userId", req, error);
    return res.status(500).json(collectionServerError(message, "Failed to load public bundles"));
  }
});

r.get("/bundles/explore", optionalAuth, async (req, res) => {
  try {
    if (!db) return res.status(503).json({ ok: false, error: "Database unavailable" });
    await ensureDrinkCollectionsSchema();

    const rows = await db
      .select()
      .from(drinkBundles)
      .where(eq(drinkBundles.isPublic, true))
      .orderBy(desc(drinkBundles.updatedAt))
      .limit(24);

    const bundles = await resolvePublicBundleCards(rows, req.user?.id ?? null);
    return res.json({ ok: true, bundles });
  } catch (error) {
    const message = logCollectionRouteError("/bundles/explore", req, error);
    return res.status(500).json(collectionServerError(message, "Failed to load bundle explore"));
  }
});

r.get("/bundles/:id", optionalAuth, async (req, res) => {
  try {
    if (!db) return res.status(503).json({ ok: false, error: "Database unavailable" });
    await ensureDrinkCollectionsSchema();

    const rows = await db.select().from(drinkBundles).where(eq(drinkBundles.id, req.params.id)).limit(1);
    const bundle = rows[0];
    if (!bundle) return res.status(404).json({ ok: false, error: "Bundle not found" });

    const isOwner = req.user?.id === bundle.userId;
    if (!bundle.isPublic && !isOwner) {
      return res.status(403).json({ ok: false, error: "Bundle is private" });
    }

    const resolved = await resolveBundleWithCollections(bundle, req.user?.id ?? null);
    const latestCheckout = req.user?.id && !isOwner ? await loadLatestCheckoutSessionForUserBundle(req.user.id, bundle.id) : null;
    const latestGift = latestCheckout ? await loadGiftByCheckoutSessionId(latestCheckout.id) : null;
    return res.json({
      ok: true,
      bundle: {
        ...resolved,
        checkout: toBundleCheckoutSnapshot(
          latestCheckout,
          latestGift ? toGiftSummary(latestGift, buildGiftClaimUrl(req, latestGift.giftCode)) : null,
        ),
      },
    });
  } catch (error) {
    const message = logCollectionRouteError("/bundles/:id", req, error);
    return res.status(500).json(collectionServerError(message, "Failed to load bundle"));
  }
});

r.patch("/bundles/:id", requireAuth, async (req, res) => {
  try {
    if (!db) return res.status(503).json({ ok: false, error: "Database unavailable" });
    await ensureDrinkCollectionsSchema();

    const existingRows = await db.select().from(drinkBundles).where(eq(drinkBundles.id, req.params.id)).limit(1);
    const existing = existingRows[0];
    if (!existing) return res.status(404).json({ ok: false, error: "Bundle not found" });
    if (existing.userId !== req.user!.id) return res.status(403).json({ ok: false, error: "Not authorized" });

    const parsed = updateDrinkBundleBodySchema.safeParse(req.body ?? {});
    if (!parsed.success) {
      return res.status(400).json({ ok: false, error: "Invalid bundle update", details: parsed.error.flatten() });
    }

    const nextIsPremium = parsed.data.isPremium ?? existing.isPremium;
    const nextPriceCents = parsed.data.priceCents ?? existing.priceCents;
    if (!nextIsPremium || Number(nextPriceCents ?? 0) <= 0) {
      return res.status(400).json({ ok: false, error: "Bundles currently support premium paid bundles only" });
    }

    const updatedRows = await db
      .update(drinkBundles)
      .set({
        ...(parsed.data.slug !== undefined ? { slug: await ensureUniqueBundleSlug(parsed.data.slug, existing.id) } : {}),
        ...(parsed.data.name !== undefined ? { name: parsed.data.name } : {}),
        ...(parsed.data.description !== undefined ? { description: normalizeCollectionDescription(parsed.data.description) } : {}),
        ...(parsed.data.isPublic !== undefined ? { isPublic: parsed.data.isPublic } : {}),
        ...(parsed.data.isPremium !== undefined ? { isPremium: parsed.data.isPremium } : {}),
        ...(parsed.data.priceCents !== undefined ? { priceCents: parsed.data.priceCents } : {}),
        updatedAt: new Date(),
      })
      .where(eq(drinkBundles.id, existing.id))
      .returning();

    return res.json({ ok: true, bundle: await resolveBundleWithCollections(updatedRows[0] ?? existing, req.user!.id) });
  } catch (error) {
    const message = logCollectionRouteError("/bundles/:id", req, error);
    return res.status(500).json(collectionServerError(message, "Failed to update bundle"));
  }
});

r.delete("/bundles/:id", requireAuth, async (req, res) => {
  try {
    if (!db) return res.status(503).json({ ok: false, error: "Database unavailable" });
    await ensureDrinkCollectionsSchema();

    const rows = await db.select().from(drinkBundles).where(eq(drinkBundles.id, req.params.id)).limit(1);
    const bundle = rows[0];
    if (!bundle) return res.status(404).json({ ok: false, error: "Bundle not found" });
    if (bundle.userId !== req.user!.id) return res.status(403).json({ ok: false, error: "Not authorized" });

    await db.delete(drinkBundles).where(eq(drinkBundles.id, bundle.id));
    return res.json({ ok: true, deletedId: bundle.id });
  } catch (error) {
    const message = logCollectionRouteError("/bundles/:id", req, error);
    return res.status(500).json(collectionServerError(message, "Failed to delete bundle"));
  }
});

r.post("/bundles/:id/items", requireAuth, async (req, res) => {
  try {
    if (!db) return res.status(503).json({ ok: false, error: "Database unavailable" });
    await ensureDrinkCollectionsSchema();

    const bundleRows = await db.select().from(drinkBundles).where(eq(drinkBundles.id, req.params.id)).limit(1);
    const bundle = bundleRows[0];
    if (!bundle) return res.status(404).json({ ok: false, error: "Bundle not found" });
    if (bundle.userId !== req.user!.id) return res.status(403).json({ ok: false, error: "Not authorized" });

    const parsed = createDrinkBundleItemBodySchema.safeParse(req.body ?? {});
    if (!parsed.success) {
      return res.status(400).json({ ok: false, error: "Invalid bundle item payload", details: parsed.error.flatten() });
    }

    const collectionRows = await db.select().from(drinkCollections).where(eq(drinkCollections.id, parsed.data.collectionId)).limit(1);
    const collection = collectionRows[0] ? normalizeCollectionRowForResponse(collectionRows[0]) : null;
    if (!collection) return res.status(404).json({ ok: false, error: "Collection not found" });
    if (collection.userId !== req.user!.id || collection.accessType !== "premium_purchase") {
      return res.status(400).json({ ok: false, error: "Bundles can only include your Premium Purchase collections" });
    }

    await db
      .insert(drinkBundleItems)
      .values({
        bundleId: bundle.id,
        collectionId: collection.id,
        sortOrder: parsed.data.sortOrder ?? 0,
      })
      .onConflictDoUpdate({
        target: [drinkBundleItems.bundleId, drinkBundleItems.collectionId],
        set: {
          sortOrder: parsed.data.sortOrder ?? 0,
        },
      });

    await db.update(drinkBundles).set({ updatedAt: new Date() }).where(eq(drinkBundles.id, bundle.id));
    const refreshed = await db.select().from(drinkBundles).where(eq(drinkBundles.id, bundle.id)).limit(1);
    return res.status(201).json({ ok: true, bundle: await resolveBundleWithCollections(refreshed[0] ?? bundle, req.user!.id) });
  } catch (error) {
    const message = logCollectionRouteError("/bundles/:id/items", req, error);
    return res.status(500).json(collectionServerError(message, "Failed to add bundle item"));
  }
});

r.delete("/bundles/:id/items/:collectionId", requireAuth, async (req, res) => {
  try {
    if (!db) return res.status(503).json({ ok: false, error: "Database unavailable" });
    await ensureDrinkCollectionsSchema();

    const bundleRows = await db.select().from(drinkBundles).where(eq(drinkBundles.id, req.params.id)).limit(1);
    const bundle = bundleRows[0];
    if (!bundle) return res.status(404).json({ ok: false, error: "Bundle not found" });
    if (bundle.userId !== req.user!.id) return res.status(403).json({ ok: false, error: "Not authorized" });

    await db
      .delete(drinkBundleItems)
      .where(and(eq(drinkBundleItems.bundleId, bundle.id), eq(drinkBundleItems.collectionId, req.params.collectionId)));

    await db.update(drinkBundles).set({ updatedAt: new Date() }).where(eq(drinkBundles.id, bundle.id));
    const refreshed = await db.select().from(drinkBundles).where(eq(drinkBundles.id, bundle.id)).limit(1);
    return res.json({ ok: true, bundle: await resolveBundleWithCollections(refreshed[0] ?? bundle, req.user!.id) });
  } catch (error) {
    const message = logCollectionRouteError("/bundles/:id/items/:collectionId", req, error);
    return res.status(500).json(collectionServerError(message, "Failed to remove bundle item"));
  }
});

r.get("/bundles/:id/ownership", requireAuth, async (req, res) => {
  try {
    if (!db) return res.status(503).json({ ok: false, error: "Database unavailable" });
    await ensureDrinkCollectionsSchema();

    const rows = await db.select().from(drinkBundles).where(eq(drinkBundles.id, req.params.id)).limit(1);
    const bundle = rows[0];
    if (!bundle) return res.status(404).json({ ok: false, error: "Bundle not found" });

    const isOwner = req.user!.id === bundle.userId;
    const ownedBundleIds = await loadOwnedBundleIdsForUser(req.user!.id);
    const latestCheckout = isOwner ? null : await loadLatestCheckoutSessionForUserBundle(req.user!.id, bundle.id);
    const latestGift = latestCheckout ? await loadGiftByCheckoutSessionId(latestCheckout.id) : null;

    return res.json({
      ok: true,
      bundleId: bundle.id,
      owned: isOwner || ownedBundleIds.has(bundle.id),
      checkout: toBundleCheckoutSnapshot(
        latestCheckout,
        latestGift ? toGiftSummary(latestGift, buildGiftClaimUrl(req, latestGift.giftCode)) : null,
      ),
    });
  } catch (error) {
    const message = logCollectionRouteError("/bundles/:id/ownership", req, error);
    return res.status(500).json(collectionServerError(message, "Failed to resolve bundle ownership"));
  }
});

r.post("/bundles/:id/create-checkout", requireAuth, async (req, res) => {
  try {
    if (!db) return res.status(503).json({ ok: false, error: "Database unavailable" });
    await ensureDrinkCollectionsSchema();

    const configError = getSquareConfigError();
    if (configError) {
      return res.status(503).json({
        ok: false,
        error: `${configError} Set SQUARE_ENV, SQUARE_ACCESS_TOKEN, SQUARE_LOCATION_ID, and APP_BASE_URL before enabling premium bundle checkout.`,
        code: "SQUARE_NOT_CONFIGURED",
      });
    }

    const parsedBody = createCheckoutBodySchema.safeParse(req.body ?? {});
    if (!parsedBody.success) {
      return res.status(400).json({ ok: false, error: "Invalid checkout request", details: parsedBody.error.flatten() });
    }

    const purchaseType = parsedBody.data.purchaseType ?? "self";
    const context = await resolveBundlePurchaseContext(req.params.id, req.user!.id);
    if (purchaseType === "self" && context.alreadyOwned) {
      return res.json({ ok: true, bundleId: context.bundle.id, owned: true, alreadyOwned: true });
    }

    const insertedSessions = await db
      .insert(drinkBundleCheckoutSessions)
      .values({
        userId: req.user!.id,
        bundleId: context.bundle.id,
        provider: "square",
        purchaseType,
        status: "pending",
        amountCents: context.bundle.priceCents,
        currencyCode: normalizeSquareCurrencyCode(squareConfig.currency),
        providerReferenceId: formatBundleCheckoutReferenceId(crypto.randomUUID()),
        expiresAt: new Date(Date.now() + 1000 * 60 * 30),
        updatedAt: new Date(),
      })
      .returning();

    const checkoutSession = insertedSessions[0];
    const itemRows = await db
      .select({ name: drinkCollections.name })
      .from(drinkBundleItems)
      .innerJoin(drinkCollections, eq(drinkBundleItems.collectionId, drinkCollections.id))
      .where(eq(drinkBundleItems.bundleId, context.bundle.id));

    const squareClient = getSquareClient();
    const redirectUrl = buildBundleCheckoutRedirectUrl(req, context.bundle.id, checkoutSession.id);
    const squareResponse = await squareClient.checkout.paymentLinks.create({
      idempotencyKey: checkoutSession.providerReferenceId,
      order: {
        locationId: squareConfig.locationId!,
        referenceId: checkoutSession.providerReferenceId,
        metadata: {
          checkoutSessionId: checkoutSession.id,
          bundleId: context.bundle.id,
          userId: req.user!.id,
          purchaseType,
        },
        lineItems: [
          {
            name: context.bundle.name,
            quantity: "1",
            basePriceMoney: {
              amount: BigInt(context.bundle.priceCents),
              currency: normalizeSquareCurrencyCode(squareConfig.currency) as any,
            },
            note: `Premium drink bundle ${purchaseType === "gift" ? "gift" : "unlock"} for ${context.bundle.name}${itemRows.length ? ` (${itemRows.length} collections)` : ""}`,
          },
        ],
      },
      checkoutOptions: {
        redirectUrl,
        allowTipping: false,
        askForShippingAddress: false,
      },
      paymentNote: `Premium bundle ${purchaseType === "gift" ? "gift" : "unlock"}: ${context.bundle.id}`,
      description: `ChefSire premium drink bundle ${purchaseType === "gift" ? "gift" : "checkout"}: ${context.bundle.name}`,
    });

    const paymentLink = squareResponse.paymentLink;
    const orderId = paymentLink?.orderId ?? squareResponse.relatedResources?.orders?.[0]?.id ?? null;
    if (!paymentLink?.id || !paymentLink.url || !orderId) {
      await db.update(drinkBundleCheckoutSessions).set({
        status: "failed",
        failureReason: "Square did not return a usable checkout link.",
        lastVerifiedAt: new Date(),
        updatedAt: new Date(),
      }).where(eq(drinkBundleCheckoutSessions.id, checkoutSession.id));
      return res.status(502).json({ ok: false, error: "Failed to create Square checkout link" });
    }

    await db.update(drinkBundleCheckoutSessions).set({
      squarePaymentLinkId: paymentLink.id,
      squareOrderId: orderId,
      checkoutUrl: paymentLink.url,
      updatedAt: new Date(),
    }).where(eq(drinkBundleCheckoutSessions.id, checkoutSession.id));

    return res.status(201).json({
      ok: true,
      bundleId: context.bundle.id,
      checkoutSessionId: checkoutSession.id,
      checkoutUrl: paymentLink.url,
      squarePaymentLinkId: paymentLink.id,
      squareOrderId: orderId,
      amountCents: context.bundle.priceCents,
      purchaseType,
      currencyCode: normalizeSquareCurrencyCode(squareConfig.currency),
    });
  } catch (error) {
    const status = typeof error === "object" && error !== null && "status" in error
      ? Number((error as { status?: unknown }).status || 500)
      : 500;
    const message = logCollectionRouteError("/bundles/:id/create-checkout", req, error);
    if (status !== 500) {
      return res.status(status).json({ ok: false, error: error instanceof Error ? error.message : message });
    }
    return res.status(500).json(collectionServerError(message, "Failed to start bundle checkout"));
  }
});

r.get("/bundles/checkout-sessions/:sessionId/status", requireAuth, async (req, res) => {
  try {
    if (!db) return res.status(503).json({ ok: false, error: "Database unavailable" });
    await ensureDrinkCollectionsSchema();

    const checkoutSession = await loadBundleCheckoutSessionForUser(req.params.sessionId, req.user!.id);
    if (!checkoutSession) return res.status(404).json({ ok: false, error: "Checkout session not found" });

    const verification = await verifyBundleCheckoutSession(checkoutSession);
    const gift = await loadGiftByCheckoutSessionId(checkoutSession.id);
    return res.json({
      ok: true,
      ...verification,
      purchaseType: normalizePurchaseType(checkoutSession.purchaseType),
      gift: gift ? toGiftSummary(gift, buildGiftClaimUrl(req, gift.giftCode)) : null,
    });
  } catch (error) {
    const message = logCollectionRouteError("/bundles/checkout-sessions/:sessionId/status", req, error);
    return res.status(500).json(collectionServerError(message, "Failed to verify bundle checkout"));
  }
});

r.get("/creator-dashboard/campaign-analytics", requireAuth, async (req, res) => {
  try {
    await ensureDrinkCollectionsSchema();
    if (!db) {
      return res.status(503).json({ ok: false, error: "Database unavailable" });
    }

    const analytics = await loadCreatorCampaignAnalytics(req.user!.id);
    return res.json({
      ok: true,
      userId: req.user!.id,
      summary: analytics.summary,
      items: analytics.items,
      attributionNotes: analytics.attributionNotes,
      generatedAt: analytics.generatedAt,
    });
  } catch (error) {
    const message = logCollectionRouteError("/creator-dashboard/campaign-analytics", req, error);
    return res.status(500).json(collectionServerError(message, "Failed to load campaign analytics"));
  }
});

r.get("/creator-dashboard/drop-analytics", requireAuth, async (req, res) => {
  try {
    await ensureDrinkCollectionsSchema();
    if (!db) {
      return res.status(503).json({ ok: false, error: "Database unavailable" });
    }

    const creatorUserId = req.user!.id;
    const drops = await db
      .select()
      .from(creatorDrops)
      .where(eq(creatorDrops.creatorUserId, creatorUserId))
      .orderBy(desc(creatorDrops.scheduledFor))
      .limit(160);

    const dropIds = drops.map((drop) => drop.id);
    const linkedCollectionIds = [...new Set(drops.map((drop) => drop.linkedCollectionId).filter((value): value is string => Boolean(value)))];

    const [eventRows, rsvpRows, notificationRows, purchaseRows, membershipRows] = await Promise.all([
      dropIds.length
        ? db.select({
            dropId: creatorDropEvents.dropId,
            eventType: creatorDropEvents.eventType,
            count: sql<number>`count(*)::int`,
          }).from(creatorDropEvents).where(inArray(creatorDropEvents.dropId, dropIds)).groupBy(creatorDropEvents.dropId, creatorDropEvents.eventType)
        : Promise.resolve([] as Array<{ dropId: string; eventType: string; count: number }>),
      dropIds.length
        ? db.select({ dropId: creatorDropRsvps.dropId, count: sql<number>`count(*)::int` }).from(creatorDropRsvps).where(inArray(creatorDropRsvps.dropId, dropIds)).groupBy(creatorDropRsvps.dropId)
        : Promise.resolve([] as Array<{ dropId: string; count: number }>),
      dropIds.length
        ? db.select({
            dropId: sql<string>`${notifications.metadata}->>'dropId'`,
            count: sql<number>`count(*)::int`,
          }).from(notifications).where(
            or(...dropIds.map((id) => sql`${notifications.metadata}->>'dropId' = ${id}`)),
          ).groupBy(sql`${notifications.metadata}->>'dropId'`)
        : Promise.resolve([] as Array<{ dropId: string; count: number }>),
      linkedCollectionIds.length
        ? db.select({
            collectionId: drinkCollectionPurchases.collectionId,
            createdAt: drinkCollectionPurchases.createdAt,
            status: drinkCollectionPurchases.status,
          }).from(drinkCollectionPurchases).where(inArray(drinkCollectionPurchases.collectionId, linkedCollectionIds))
        : Promise.resolve([] as Array<{ collectionId: string; createdAt: Date; status: string }>),
      db.select({
        creatorUserId: creatorMemberships.creatorUserId,
        createdAt: creatorMemberships.createdAt,
        status: creatorMemberships.status,
      }).from(creatorMemberships).where(eq(creatorMemberships.creatorUserId, creatorUserId)),
    ]);

    const eventCountMap = new Map<string, { viewCount: number; linkedClicksCount: number }>();
    for (const row of eventRows) {
      const current = eventCountMap.get(row.dropId) ?? { viewCount: 0, linkedClicksCount: 0 };
      if (row.eventType === "view_drop") current.viewCount = Number(row.count ?? 0);
      if (row.eventType === "click_drop_target") current.linkedClicksCount = Number(row.count ?? 0);
      eventCountMap.set(row.dropId, current);
    }
    const rsvpCountMap = new Map(rsvpRows.map((row) => [row.dropId, Number(row.count ?? 0)]));
    const alertsSentMap = new Map(notificationRows.map((row) => [row.dropId, Number(row.count ?? 0)]));
    const purchasesByCollection = new Map<string, Array<{ createdAt: Date; status: string }>>();
    for (const row of purchaseRows) {
      const current = purchasesByCollection.get(row.collectionId) ?? [];
      current.push({ createdAt: row.createdAt, status: row.status });
      purchasesByCollection.set(row.collectionId, current);
    }

    const items = drops.map((drop) => {
      const metrics = eventCountMap.get(drop.id) ?? { viewCount: 0, linkedClicksCount: 0 };
      const rsvpCount = rsvpCountMap.get(drop.id) ?? 0;
      const alertsSentCount = alertsSentMap.get(drop.id) ?? 0;
      const linkedPurchases = drop.linkedCollectionId
        ? (purchasesByCollection.get(drop.linkedCollectionId) ?? []).filter((purchase) => purchase.createdAt >= drop.scheduledFor && purchase.status === "completed")
        : [];
      const membershipConversions = drop.dropType === "member_drop"
        ? membershipRows.filter((membership) => membership.status === "active" && membership.createdAt >= drop.scheduledFor).length
        : 0;
      const funnelBase = metrics.viewCount > 0 ? metrics.viewCount : rsvpCount > 0 ? rsvpCount : 0;
      const conversionRate = funnelBase > 0 ? Number((((linkedPurchases.length + membershipConversions) / funnelBase) * 100).toFixed(1)) : null;

      return {
        dropId: drop.id,
        title: drop.title,
        status: getCreatorDropStatus(drop),
        scheduledFor: drop.scheduledFor.toISOString(),
        liveAt: drop.isPublished && drop.scheduledFor <= new Date() ? drop.scheduledFor.toISOString() : null,
        rsvpCount,
        viewCount: metrics.viewCount,
        alertsSentCount,
        linkedClicksCount: metrics.linkedClicksCount,
        purchaseCount: linkedPurchases.length,
        membershipConversionsCount: membershipConversions,
        membershipConversionsNote: drop.dropType === "member_drop" ? "Approximate: counts memberships started after this member drop went live." : null,
        purchaseAttributionNote: drop.linkedCollectionId ? "Approximate: counts completed purchases of the linked collection after this drop's launch time." : null,
        conversionRate,
        linkedCollectionId: drop.linkedCollectionId ?? null,
        linkedPromotionId: drop.linkedPromotionId ?? null,
      };
    });

    return res.json({
      ok: true,
      userId: creatorUserId,
      summary: {
        totalDrops: items.length,
        upcomingDrops: items.filter((item) => item.status === "upcoming").length,
        liveDrops: items.filter((item) => item.status === "live").length,
        archivedDrops: items.filter((item) => item.status === "archived").length,
        totalViews: items.reduce((sum, item) => sum + item.viewCount, 0),
        totalRsvps: items.reduce((sum, item) => sum + item.rsvpCount, 0),
        totalAlertsSent: items.reduce((sum, item) => sum + item.alertsSentCount, 0),
        totalLinkedClicks: items.reduce((sum, item) => sum + item.linkedClicksCount, 0),
        totalPurchasesFromDrops: items.reduce((sum, item) => sum + item.purchaseCount, 0),
        totalMembershipConversions: items.reduce((sum, item) => sum + item.membershipConversionsCount, 0),
      },
      attributionNotes: [
        "Drop views and click-throughs are counted from dedicated drop pages.",
        "Purchases from linked release are approximate and count completed linked-collection purchases after the drop launch time.",
        "Membership conversions are approximate and only shown for member drops.",
      ],
      items,
    });
  } catch (error) {
    const message = logCollectionRouteError("/creator-dashboard/drop-analytics", req, error);
    return res.status(500).json(collectionServerError(message, "Failed to load drop launch analytics"));
  }
});

r.get("/creator-dashboard/sales", requireAuth, async (req, res) => {
  try {
    if (!db) {
      logCollectionDbUnavailable("/creator-dashboard/sales", req);
      return res.status(503).json({ ok: false, error: "Database unavailable", code: "DB_UNAVAILABLE" });
    }

    await ensureDrinkCollectionsSchema();

    const sales = await loadCreatorCollectionSalesSummary(req.user!.id);
    return res.json({
      ok: true,
      userId: req.user!.id,
      totals: sales.totals,
      reviewInsights: sales.reviewInsights,
      collections: sales.collections,
      reportingNotes: [
        "Active purchases only count when the ownership record is still in completed status.",
        "Refunded, refund-pending, and revoked premium sales are tracked separately and excluded from completed sales totals.",
        "Gross sales are reporting only, use the actual paid amount after discounts, and do not imply payouts or net earnings.",
        "Reviews are social proof only and do not change ownership, finance reporting, or conversion analytics directly.",
      ],
    });
  } catch (error) {
    logCollectionRouteError("/creator-dashboard/sales", req, error);
    const payload = collectionDbErrorResponse(error, "Failed to load creator sales");
    const status = classifyCollectionError(error, "Failed to load creator sales").status;
    return res.status(status).json(payload);
  }
});

r.get("/creator-dashboard/orders", requireAuth, async (req, res) => {
  try {
    if (!db) {
      logCollectionDbUnavailable("/creator-dashboard/orders", req);
      return res.status(503).json({ ok: false, error: "Database unavailable", code: "DB_UNAVAILABLE" });
    }

    await ensureDrinkCollectionsSchema();

    const orders = await loadCreatorCollectionOrders(req.user!.id);
    return res.json({
      ok: true,
      userId: req.user!.id,
      orders,
      count: orders.length,
      reportingNotes: [
        "Completed sale means the premium collection purchase is still counted in finance totals at the actual paid amount.",
        "Refunded sale, pending refund, and revoked access stay visible for audit history but do not imply payouts.",
        "Buyer details stay privacy-safe in this dashboard.",
      ],
    });
  } catch (error) {
    logCollectionRouteError("/creator-dashboard/orders", req, error);
    const payload = collectionDbErrorResponse(error, "Failed to load creator order history");
    const status = classifyCollectionError(error, "Failed to load creator order history").status;
    return res.status(status).json(payload);
  }
});

r.get("/creator-dashboard/finance", requireAuth, async (req, res) => {
  try {
    if (!db) {
      logCollectionDbUnavailable("/creator-dashboard/finance", req);
      return res.status(503).json({ ok: false, error: "Database unavailable", code: "DB_UNAVAILABLE" });
    }

    await ensureDrinkCollectionsSchema();

    const finance = await loadCreatorCollectionFinanceSummary(req.user!.id);
    return res.json({
      ok: true,
      userId: req.user!.id,
      summary: finance.summary,
      recentSales: finance.recentSales,
      reportingNotes: finance.reportingNotes,
    });
  } catch (error) {
    logCollectionRouteError("/creator-dashboard/finance", req, error);
    const payload = collectionDbErrorResponse(error, "Failed to load creator finance");
    const status = classifyCollectionError(error, "Failed to load creator finance").status;
    return res.status(status).json(payload);
  }
});

r.get("/creator-dashboard/membership", requireAuth, async (req, res) => {
  try {
    if (!db) {
      logCollectionDbUnavailable("/creator-dashboard/membership", req);
      return res.status(503).json({ ok: false, error: "Database unavailable", code: "DB_UNAVAILABLE" });
    }
    await ensureDrinkCollectionsSchema();
    const membership = await loadCreatorMembershipDashboardSummary(req.user!.id);
    return res.json({
      ok: true,
      userId: req.user!.id,
      ...membership,
      reportingNotes: [
        "Membership revenue is reported separately from one-off premium collection sales.",
        "Version one memberships are term-based and manually renewed through a new Square checkout each billing period.",
      ],
    });
  } catch (error) {
    const message = logCollectionRouteError("/creator-dashboard/membership", req, error);
    return res.status(500).json(collectionServerError(message, "Failed to load creator membership dashboard"));
  }
});

r.post("/creator-dashboard/membership-plan", requireAuth, async (req, res) => {
  try {
    if (!db) return res.status(503).json({ ok: false, error: "Database unavailable" });
    await ensureDrinkCollectionsSchema();
    const parsed = creatorMembershipPlanInputSchema.safeParse(req.body ?? {});
    if (!parsed.success) {
      return res.status(400).json({ ok: false, error: "Invalid membership plan payload", details: parsed.error.flatten() });
    }

    const data = parsed.data;
    const now = new Date();
    const values = {
      creatorUserId: req.user!.id,
      slug: normalizeMembershipPlanSlug(data.name, req.user!.id),
      name: data.name.trim(),
      description: normalizeCollectionDescription(data.description ?? null),
      priceCents: Math.round(Number(data.priceCents)),
      billingInterval: normalizeMembershipBillingInterval(data.billingInterval),
      isActive: Boolean(data.isActive ?? true),
      updatedAt: now,
    };

    const existing = await loadCreatorMembershipPlanByCreatorId(req.user!.id);
    const result = existing
      ? await db.update(creatorMembershipPlans).set(values).where(eq(creatorMembershipPlans.id, existing.id)).returning()
      : await db.insert(creatorMembershipPlans).values(values).returning();

    const summary = await loadCreatorMembershipDashboardSummary(req.user!.id);
    return res.status(existing ? 200 : 201).json({
      ok: true,
      plan: serializeMembershipPlan(result[0]),
      stats: summary.stats,
    });
  } catch (error) {
    const message = logCollectionRouteError("/creator-dashboard/membership-plan", req, error);
    return res.status(500).json(collectionServerError(message, "Failed to save membership plan"));
  }
});

r.get("/creator-dashboard/conversions", requireAuth, async (req, res) => {
  try {
    if (!db) {
      logCollectionDbUnavailable("/creator-dashboard/conversions", req);
      return res.status(503).json({ ok: false, error: "Database unavailable", code: "DB_UNAVAILABLE" });
    }

    await ensureDrinkCollectionsSchema();

    const conversions = await loadCreatorCollectionConversionAnalytics(req.user!.id);
    return res.json({
      ok: true,
      userId: req.user!.id,
      summary: conversions.summary,
      collections: conversions.collections,
      reportingNotes: conversions.reportingNotes,
    });
  } catch (error) {
    logCollectionRouteError("/creator-dashboard/conversions", req, error);
    const payload = collectionDbErrorResponse(error, "Failed to load creator conversion analytics");
    const status = classifyCollectionError(error, "Failed to load creator conversion analytics").status;
    return res.status(status).json(payload);
  }
});

r.get("/creator-dashboard/promotions", requireAuth, async (req, res) => {
  try {
    if (!db) {
      logCollectionDbUnavailable("/creator-dashboard/promotions", req);
      return res.status(503).json({ ok: false, error: "Database unavailable", code: "DB_UNAVAILABLE" });
    }

    await ensureDrinkCollectionsSchema();

    const requestedCollectionId = typeof req.query.collectionId === "string" ? req.query.collectionId.trim() : "";
    const collectionFilter = requestedCollectionId.length
      ? and(
        eq(drinkCollectionPromotions.creatorUserId, req.user!.id),
        eq(drinkCollectionPromotions.collectionId, requestedCollectionId),
      )
      : eq(drinkCollectionPromotions.creatorUserId, req.user!.id);

    const rows = await db
      .select({
        id: drinkCollectionPromotions.id,
        collectionId: drinkCollectionPromotions.collectionId,
        collectionName: drinkCollections.name,
        code: drinkCollectionPromotions.code,
        discountType: drinkCollectionPromotions.discountType,
        discountValue: drinkCollectionPromotions.discountValue,
        startsAt: drinkCollectionPromotions.startsAt,
        endsAt: drinkCollectionPromotions.endsAt,
        isActive: drinkCollectionPromotions.isActive,
        maxRedemptions: drinkCollectionPromotions.maxRedemptions,
        redemptionCount: drinkCollectionPromotions.redemptionCount,
        createdAt: drinkCollectionPromotions.createdAt,
        updatedAt: drinkCollectionPromotions.updatedAt,
      })
      .from(drinkCollectionPromotions)
      .innerJoin(drinkCollections, eq(drinkCollectionPromotions.collectionId, drinkCollections.id))
      .where(collectionFilter)
      .orderBy(desc(drinkCollectionPromotions.createdAt));

    return res.json({
      ok: true,
      promotions: rows.map((row) => ({
        ...row,
        discountValue: Number(row.discountValue ?? 0),
        maxRedemptions: row.maxRedemptions === null ? null : Number(row.maxRedemptions ?? 0),
        redemptionCount: Number(row.redemptionCount ?? 0),
        startsAt: row.startsAt ? row.startsAt.toISOString() : null,
        endsAt: row.endsAt ? row.endsAt.toISOString() : null,
        createdAt: row.createdAt.toISOString(),
        updatedAt: row.updatedAt.toISOString(),
      })),
    });
  } catch (error) {
    logCollectionRouteError("/creator-dashboard/promotions", req, error);
    const payload = collectionDbErrorResponse(error, "Failed to load creator promotions");
    const status = classifyCollectionError(error, "Failed to load creator promotions").status;
    return res.status(status).json(payload);
  }
});

r.post("/creator-dashboard/promotions", requireAuth, async (req, res) => {
  try {
    if (!db) return res.status(503).json({ ok: false, error: "Database unavailable" });
    await ensureDrinkCollectionsSchema();

    const parsed = promotionInputSchema.safeParse(req.body ?? {});
    if (!parsed.success) {
      return res.status(400).json({ ok: false, error: "Invalid promotion details", details: parsed.error.flatten() });
    }

    const collectionRows = await db.select().from(drinkCollections).where(eq(drinkCollections.id, parsed.data.collectionId)).limit(1);
    const collection = collectionRows[0] ? normalizeCollectionRowForResponse(collectionRows[0]) : null;
    if (!collection) return res.status(404).json({ ok: false, error: "Collection not found" });
    if (collection.userId !== req.user!.id) return res.status(403).json({ ok: false, error: "Not authorized" });
    if (collection.accessType !== "premium_purchase") return res.status(400).json({ ok: false, error: "Promotions are only available for Premium Purchase collections" });

    if (parsed.data.discountType === "fixed" && parsed.data.discountValue >= Number(collection.priceCents ?? 0)) {
      return res.status(400).json({ ok: false, error: "Fixed discount must be less than the collection price." });
    }

    const values = {
      creatorUserId: req.user!.id,
      collectionId: collection.id,
      code: parsed.data.code,
      discountType: parsed.data.discountType,
      discountValue: parsed.data.discountValue,
      startsAt: toNullableDate(parsed.data.startsAt),
      endsAt: toNullableDate(parsed.data.endsAt),
      isActive: parsed.data.isActive ?? true,
      maxRedemptions: parsed.data.maxRedemptions ?? null,
      updatedAt: new Date(),
    } as const;

    const inserted = await db.insert(drinkCollectionPromotions).values(values).returning();
    const promotion = inserted[0];
    const wishlistAudienceCount = Number((await loadWishlistCountsForCollections([collection.id])).get(collection.id) ?? 0);
    if (promotion) {
      logWishlistPromoAlertReady({
        collectionId: collection.id,
        creatorUserId: req.user!.id,
        promotionId: promotion.id,
        wishlistAudienceCount,
      });
      await maybeNotifyPromoActivation({
        collection,
        previousPromotion: null,
        nextPromotion: promotion,
      });
    }
    return res.status(201).json({ ok: true, promotion, promoAlertReadyAudienceCount: wishlistAudienceCount });
  } catch (error) {
    const message = logCollectionRouteError("/creator-dashboard/promotions", req, error);
    if (String(message).toLowerCase().includes("duplicate")) {
      return res.status(409).json({ ok: false, error: "That promo code already exists for this collection." });
    }
    return res.status(500).json(collectionServerError(message, "Failed to create promotion"));
  }
});

r.patch("/creator-dashboard/promotions/:id", requireAuth, async (req, res) => {
  try {
    if (!db) return res.status(503).json({ ok: false, error: "Database unavailable" });
    await ensureDrinkCollectionsSchema();

    const existingRows = await db.select().from(drinkCollectionPromotions).where(eq(drinkCollectionPromotions.id, req.params.id)).limit(1);
    const existing = existingRows[0];
    if (!existing) return res.status(404).json({ ok: false, error: "Promotion not found" });
    if (existing.creatorUserId !== req.user!.id) return res.status(403).json({ ok: false, error: "Not authorized" });

    const collectionRows = await db.select().from(drinkCollections).where(eq(drinkCollections.id, existing.collectionId)).limit(1);
    const collection = collectionRows[0];
    if (!collection || collection.userId !== req.user!.id) return res.status(403).json({ ok: false, error: "Not authorized" });

    const parsed = promotionUpdateSchema.safeParse(req.body ?? {});
    if (!parsed.success) {
      return res.status(400).json({ ok: false, error: "Invalid promotion update", details: parsed.error.flatten() });
    }

    const nextDiscountType = parsed.data.discountType ?? existing.discountType;
    const nextDiscountValue = parsed.data.discountValue ?? Number(existing.discountValue ?? 0);
    if (nextDiscountType === "percent" && nextDiscountValue >= 100) {
      return res.status(400).json({ ok: false, error: "Percent discounts must stay between 1 and 99." });
    }
    if (nextDiscountType === "fixed" && nextDiscountValue >= Number(collection.priceCents ?? 0)) {
      return res.status(400).json({ ok: false, error: "Fixed discount must be less than the collection price." });
    }

    const startsAt = parsed.data.startsAt !== undefined ? toNullableDate(parsed.data.startsAt) : existing.startsAt;
    const endsAt = parsed.data.endsAt !== undefined ? toNullableDate(parsed.data.endsAt) : existing.endsAt;
    if (startsAt && endsAt && endsAt <= startsAt) {
      return res.status(400).json({ ok: false, error: "Promotion end date must be after the start date." });
    }

    const updated = await db
      .update(drinkCollectionPromotions)
      .set({
        ...(parsed.data.code !== undefined ? { code: parsed.data.code } : {}),
        ...(parsed.data.discountType !== undefined ? { discountType: parsed.data.discountType } : {}),
        ...(parsed.data.discountValue !== undefined ? { discountValue: parsed.data.discountValue } : {}),
        ...(parsed.data.startsAt !== undefined ? { startsAt } : {}),
        ...(parsed.data.endsAt !== undefined ? { endsAt } : {}),
        ...(parsed.data.isActive !== undefined ? { isActive: parsed.data.isActive } : {}),
        ...(parsed.data.maxRedemptions !== undefined ? { maxRedemptions: parsed.data.maxRedemptions } : {}),
        updatedAt: new Date(),
      })
      .where(eq(drinkCollectionPromotions.id, existing.id))
      .returning();

    const promotion = updated[0] ?? existing;
    const wishlistAudienceCount = Number((await loadWishlistCountsForCollections([collection.id])).get(collection.id) ?? 0);
    logWishlistPromoAlertReady({
      collectionId: collection.id,
      creatorUserId: req.user!.id,
      promotionId: promotion.id,
      wishlistAudienceCount,
    });
    await maybeNotifyPromoActivation({
      collection,
      previousPromotion: existing,
      nextPromotion: promotion,
    });

    return res.json({ ok: true, promotion, promoAlertReadyAudienceCount: wishlistAudienceCount });
  } catch (error) {
    const message = logCollectionRouteError("/creator-dashboard/promotions/:id", req, error);
    if (String(message).toLowerCase().includes("duplicate")) {
      return res.status(409).json({ ok: false, error: "That promo code already exists for this collection." });
    }
    return res.status(500).json(collectionServerError(message, "Failed to update promotion"));
  }
});

r.delete("/creator-dashboard/promotions/:id", requireAuth, async (req, res) => {
  try {
    if (!db) return res.status(503).json({ ok: false, error: "Database unavailable" });
    await ensureDrinkCollectionsSchema();

    const existingRows = await db.select().from(drinkCollectionPromotions).where(eq(drinkCollectionPromotions.id, req.params.id)).limit(1);
    const existing = existingRows[0];
    if (!existing) return res.status(404).json({ ok: false, error: "Promotion not found" });
    if (existing.creatorUserId !== req.user!.id) return res.status(403).json({ ok: false, error: "Not authorized" });

    await db.delete(drinkCollectionPromotions).where(eq(drinkCollectionPromotions.id, existing.id));
    return res.json({ ok: true, deletedId: existing.id });
  } catch (error) {
    const message = logCollectionRouteError("/creator-dashboard/promotions/:id", req, error);
    return res.status(500).json(collectionServerError(message, "Failed to delete promotion"));
  }
});


r.get("/collections/:id/reviews", optionalAuth, async (req, res) => {
  try {
    if (!db) {
      logCollectionDbUnavailable("/:id/reviews", req);
      return res.status(503).json({ ok: false, error: "Database unavailable", code: "DB_UNAVAILABLE" });
    }

    await ensureDrinkCollectionsSchema();

    const collectionRows = await db.select().from(drinkCollections).where(eq(drinkCollections.id, req.params.id)).limit(1);
    const collection = collectionRows[0];
    if (!collection) return res.status(404).json({ ok: false, error: "Collection not found" });

    const isCreator = req.user?.id === collection.userId;
    if (!collection.isPublic && !isCreator) {
      return res.status(403).json({ ok: false, error: "Collection is private" });
    }

    const { summary, reviews } = await loadHydratedCollectionReviews(collection.id);
    const viewerOwnsCollection = req.user?.id ? await userHasActiveCollectionReviewAccess(req.user.id, collection.id) : false;
    const viewerReview = req.user?.id ? reviews.find((review) => review.userId === req.user?.id) ?? null : null;

    return res.json({
      ok: true,
      collectionId: collection.id,
      summary,
      reviews,
      viewerOwnsCollection,
      canReview: Boolean(req.user?.id && viewerOwnsCollection && req.user.id !== collection.userId && collection.isPremium),
      viewerReview,
    });
  } catch (error) {
    const message = logCollectionRouteError("/:id/reviews", req, error);
    return res.status(500).json(collectionServerError(message, "Failed to load collection reviews"));
  }
});

r.post("/collections/:id/reviews", requireAuth, async (req, res) => {
  try {
    if (!db) {
      logCollectionDbUnavailable("/:id/reviews", req);
      return res.status(503).json({ ok: false, error: "Database unavailable", code: "DB_UNAVAILABLE" });
    }

    await ensureDrinkCollectionsSchema();

    const collectionRows = await db.select().from(drinkCollections).where(eq(drinkCollections.id, req.params.id)).limit(1);
    const collection = collectionRows[0];
    if (!collection) return res.status(404).json({ ok: false, error: "Collection not found" });
    if (!collection.isPremium) return res.status(400).json({ ok: false, error: "Reviews are only supported for premium collections" });
    if (collection.userId === req.user!.id) return res.status(403).json({ ok: false, error: "Creators cannot review their own premium collections" });

    const parsed = collectionReviewInputSchema.safeParse(req.body ?? {});
    if (!parsed.success) {
      return res.status(400).json({ ok: false, error: "Rating must be between 1 and 5 and review text must be valid." });
    }

    const hasOwnership = await userHasActiveCollectionReviewAccess(req.user!.id, collection.id);
    if (!hasOwnership) {
      return res.status(403).json({ ok: false, error: "You must currently own this premium collection to leave a review" });
    }

    const existingRows = await db
      .select({ id: drinkCollectionReviews.id })
      .from(drinkCollectionReviews)
      .where(and(eq(drinkCollectionReviews.userId, req.user!.id), eq(drinkCollectionReviews.collectionId, collection.id)))
      .limit(1);

    if (existingRows[0]) {
      return res.status(409).json({ ok: false, error: "You already reviewed this collection. Edit your existing review instead." });
    }

    const now = new Date();
    await db
      .insert(drinkCollectionReviews)
      .values({
        userId: req.user!.id,
        collectionId: collection.id,
        rating: parsed.data.rating,
        title: normalizeOptionalReviewText(parsed.data.title, 160),
        body: normalizeOptionalReviewText(parsed.data.body, 4000),
        isVerifiedPurchase: true,
        createdAt: now,
        updatedAt: now,
      });

    const { summary, reviews } = await loadHydratedCollectionReviews(collection.id);
    const review = reviews.find((entry) => entry.userId === req.user!.id) ?? null;

    return res.status(201).json({ ok: true, review, summary });
  } catch (error) {
    const message = logCollectionRouteError("/:id/reviews", req, error);
    return res.status(500).json(collectionServerError(message, "Failed to create collection review"));
  }
});

r.patch("/collections/:id/reviews/:reviewId", requireAuth, async (req, res) => {
  try {
    if (!db) {
      logCollectionDbUnavailable("/:id/reviews/:reviewId", req);
      return res.status(503).json({ ok: false, error: "Database unavailable", code: "DB_UNAVAILABLE" });
    }

    await ensureDrinkCollectionsSchema();

    const parsed = collectionReviewInputSchema.safeParse(req.body ?? {});
    if (!parsed.success) {
      return res.status(400).json({ ok: false, error: "Rating must be between 1 and 5 and review text must be valid." });
    }

    const reviewRows = await db
      .select()
      .from(drinkCollectionReviews)
      .where(and(eq(drinkCollectionReviews.id, req.params.reviewId), eq(drinkCollectionReviews.collectionId, req.params.id)))
      .limit(1);
    const review = reviewRows[0];
    if (!review) return res.status(404).json({ ok: false, error: "Review not found" });
    if (review.userId !== req.user!.id) return res.status(403).json({ ok: false, error: "You can only edit your own review" });

    const collectionRows = await db.select().from(drinkCollections).where(eq(drinkCollections.id, req.params.id)).limit(1);
    const collection = collectionRows[0];
    if (!collection) return res.status(404).json({ ok: false, error: "Collection not found" });
    if (!collection.isPremium) return res.status(400).json({ ok: false, error: "Reviews are only supported for premium collections" });
    if (collection.userId === req.user!.id) return res.status(403).json({ ok: false, error: "Creators cannot review their own premium collections" });

    const hasOwnership = await userHasActiveCollectionReviewAccess(req.user!.id, collection.id);
    if (!hasOwnership) {
      return res.status(403).json({ ok: false, error: "You must currently own this premium collection to edit a review" });
    }

    await db
      .update(drinkCollectionReviews)
      .set({
        rating: parsed.data.rating,
        title: normalizeOptionalReviewText(parsed.data.title, 160),
        body: normalizeOptionalReviewText(parsed.data.body, 4000),
        updatedAt: new Date(),
      })
      .where(eq(drinkCollectionReviews.id, review.id));

    const { summary, reviews } = await loadHydratedCollectionReviews(collection.id);
    const updatedReview = reviews.find((entry) => entry.id === review.id) ?? null;

    return res.json({ ok: true, review: updatedReview, summary });
  } catch (error) {
    const message = logCollectionRouteError("/:id/reviews/:reviewId", req, error);
    return res.status(500).json(collectionServerError(message, "Failed to update collection review"));
  }
});

r.delete("/collections/:id/reviews/:reviewId", requireAuth, async (req, res) => {
  try {
    if (!db) {
      logCollectionDbUnavailable("/:id/reviews/:reviewId", req);
      return res.status(503).json({ ok: false, error: "Database unavailable", code: "DB_UNAVAILABLE" });
    }

    await ensureDrinkCollectionsSchema();

    const reviewRows = await db
      .select()
      .from(drinkCollectionReviews)
      .where(and(eq(drinkCollectionReviews.id, req.params.reviewId), eq(drinkCollectionReviews.collectionId, req.params.id)))
      .limit(1);
    const review = reviewRows[0];
    if (!review) return res.status(404).json({ ok: false, error: "Review not found" });
    if (review.userId !== req.user!.id) return res.status(403).json({ ok: false, error: "You can only delete your own review" });

    await db.delete(drinkCollectionReviews).where(eq(drinkCollectionReviews.id, review.id));
    const summary = (await loadCollectionReviewSummaryMap([req.params.id])).get(req.params.id) ?? normalizeCollectionReviewSummary();

    return res.json({ ok: true, deletedReviewId: review.id, summary });
  } catch (error) {
    const message = logCollectionRouteError("/:id/reviews/:reviewId", req, error);
    return res.status(500).json(collectionServerError(message, "Failed to delete collection review"));
  }
});

r.get("/collections/:id/ownership", optionalAuth, async (req, res) => {
  try {
    if (!req.user?.id) return collectionAuthRequired(res);
    if (!db) return res.status(503).json({ ok: false, error: "Database unavailable" });

    await ensureDrinkCollectionsSchema();

    const rows = await db.select().from(drinkCollections).where(eq(drinkCollections.id, req.params.id)).limit(1);
    const collection = rows[0] ? normalizeCollectionRowForResponse(rows[0]) : null;
    if (!collection) return res.status(404).json({ ok: false, error: "Collection not found" });

    const isOwner = req.user.id === collection.userId;
    const ownedCollectionIds = await loadOwnedCollectionIdsForUser(req.user.id);
    const owned = isOwner || ownedCollectionIds.has(collection.id);
    const latestCheckoutSession = isOwner ? null : await loadLatestCheckoutSessionForUserCollection(req.user.id, collection.id);

    return res.json({
      ok: true,
      collectionId: collection.id,
      owned,
      checkout: toCollectionCheckoutSnapshot(latestCheckoutSession),
    });
  } catch (error) {
    const message = logCollectionRouteError("/:id/ownership", req, error);
    return res.status(500).json(collectionServerError(message, "Failed to resolve ownership"));
  }
});

r.post("/collections/:id/apply-promo", optionalAuth, async (req, res) => {
  try {
    if (!db) return res.status(503).json({ ok: false, error: "Database unavailable" });
    await ensureDrinkCollectionsSchema();

    const collectionRows = await db.select().from(drinkCollections).where(eq(drinkCollections.id, req.params.id)).limit(1);
    const collection = collectionRows[0];
    if (!collection) return res.status(404).json({ ok: false, error: "Collection not found" });

    const isOwner = req.user?.id && req.user.id === collection.userId;
    if (!collection.isPublic && !isOwner) {
      return res.status(403).json({ ok: false, error: "Collection is private" });
    }

    if (collection.accessType !== "premium_purchase") {
      return res.status(400).json({ ok: false, error: "Promotions only apply to Premium Purchase collections" });
    }

    const parsed = applyPromoBodySchema.safeParse(req.body ?? {});
    if (!parsed.success) {
      return res.status(400).json({ ok: false, error: "Invalid promotion code", details: parsed.error.flatten() });
    }

    const { promotion, pricing } = await resolveValidPromotionPricing(collection, parsed.data.code);
    return res.json({
      ok: true,
      collectionId: collection.id,
      promo: {
        id: promotion.id,
        code: pricing.code,
        discountType: pricing.discountType,
        discountValue: pricing.discountValue,
        startsAt: pricing.startsAt,
        endsAt: pricing.endsAt,
        maxRedemptions: pricing.maxRedemptions,
        redemptionCount: pricing.redemptionCount,
      },
      pricing,
    });
  } catch (error) {
    const status = typeof error === "object" && error !== null && "status" in error
      ? Number((error as { status?: unknown }).status || 500)
      : 500;
    const message = logCollectionRouteError("/:id/apply-promo", req, error);
    if (status !== 500) {
      return res.status(status).json({ ok: false, error: error instanceof Error ? error.message : message });
    }
    return res.status(500).json(collectionServerError(message, "Failed to apply promotion"));
  }
});

r.post("/collections/:id/track-view", optionalAuth, async (req, res) => {
  try {
    if (!db) return res.status(503).json({ ok: false, error: "Database unavailable" });

    await ensureDrinkCollectionsSchema();

    const rows = await db.select().from(drinkCollections).where(eq(drinkCollections.id, req.params.id)).limit(1);
    const collection = rows[0] ? normalizeCollectionRowForResponse(rows[0]) : null;

    if (!collection) return res.status(404).json({ ok: false, error: "Collection not found" });

    const isOwner = req.user?.id && req.user.id === collection.userId;
    if (!collection.isPublic && !isOwner) {
      return res.status(403).json({ ok: false, error: "Collection is private" });
    }

    const shouldTrack = await shouldTrackCollectionView(collection.id, req.user?.id ?? null);
    if (!shouldTrack) {
      return res.status(202).json({
        ok: true,
        tracked: false,
        reason: isOwner ? "owner_view" : "owned_collection_view",
      });
    }

    await trackCollectionEvent({
      collectionId: collection.id,
      eventType: "view",
      userId: req.user?.id ?? null,
    });

    return res.status(201).json({
      ok: true,
      tracked: true,
      collectionId: collection.id,
      eventType: "view",
    });
  } catch (error) {
    const message = logCollectionRouteError("/:id/track-view", req, error);
    return res.status(500).json(collectionServerError(message, "Failed to track collection view"));
  }
});

r.post("/collections/payments/square/webhook", async (req, res) => {
  try {
    if (!db) return res.status(503).json({ ok: false, error: "Database unavailable" });

    await ensureDrinkCollectionsSchema();

    const signatureHeader = String(req.get("x-square-hmacsha256-signature") || "").trim();
    const rawBody = typeof (req as Request & { rawBody?: string }).rawBody === "string"
      ? (req as Request & { rawBody?: string }).rawBody!
      : JSON.stringify(req.body ?? {});

    if (!signatureHeader) {
      return res.status(400).json({ ok: false, error: "Missing Square webhook signature" });
    }

    const signatureKey = requireWebhookKey();
    const isValidSignature = await WebhooksHelper.verifySignature({
      requestBody: rawBody,
      signatureHeader,
      signatureKey,
      notificationUrl: getSquareWebhookNotificationUrl(req),
    });

    if (!isValidSignature) {
      return res.status(401).json({ ok: false, error: "Invalid Square webhook signature" });
    }

    const payload = (req.body ?? {}) as SquareWebhookEventBody;
    let result = await reconcileSquareWebhookEvent(payload);
    if ((result as any)?.reason === "session_not_found") {
      result = await reconcileBundleSquareWebhookEvent(payload);
    }
    return res.status(200).json({ ok: true, result });
  } catch (error) {
    const message = logCollectionRouteError("/collections/payments/square/webhook", req, error);
    return res.status(500).json(collectionServerError(message, "Failed to process Square webhook"));
  }
});

r.post("/collections/:id/create-checkout", requireAuth, async (req, res) => {
  try {
    if (!db) return res.status(503).json({ ok: false, error: "Database unavailable" });

    await ensureDrinkCollectionsSchema();

    const configError = getSquareConfigError();
    if (configError) {
      return res.status(503).json({
        ok: false,
        error: `${configError} Set SQUARE_ENV, SQUARE_ACCESS_TOKEN, SQUARE_LOCATION_ID, and APP_BASE_URL before enabling premium collection checkout.`,
        code: "SQUARE_NOT_CONFIGURED",
      });
    }

    const parsedBody = createCheckoutBodySchema.safeParse(req.body ?? {});
    if (!parsedBody.success) {
      return res.status(400).json({ ok: false, error: "Invalid checkout request", details: parsedBody.error.flatten() });
    }

    const purchaseType = parsedBody.data.purchaseType ?? "self";
    const context = await resolveCollectionPurchaseContextWithPromo(req.params.id, req.user!.id, parsedBody.data.promoCode ?? null);
    if (purchaseType === "self" && context.alreadyOwned) {
      return res.json({
        ok: true,
        collectionId: context.collection.id,
        owned: true,
        alreadyOwned: true,
      });
    }

    const insertedSessions = await db
      .insert(drinkCollectionCheckoutSessions)
      .values({
        userId: req.user!.id,
        collectionId: context.collection.id,
        provider: "square",
        purchaseType,
        status: "pending",
        promotionId: context.promoPricing?.promotionId ?? null,
        promotionCode: context.promoPricing?.code ?? null,
        originalAmountCents: Number(context.collection.priceCents ?? 0),
        discountAmountCents: context.promoPricing?.discountAmountCents ?? 0,
        amountCents: context.promoPricing?.finalAmountCents ?? context.collection.priceCents,
        currencyCode: normalizeSquareCurrencyCode(squareConfig.currency),
        providerReferenceId: formatCollectionCheckoutReferenceId(crypto.randomUUID()),
        expiresAt: new Date(Date.now() + 1000 * 60 * 30),
        updatedAt: new Date(),
      })
      .returning();

    const checkoutSession = insertedSessions[0];
    const squareClient = getSquareClient();
    const redirectUrl = buildCollectionCheckoutRedirectUrl(req, context.collection.id, checkoutSession.id);
    const squareResponse = await squareClient.checkout.paymentLinks.create({
      idempotencyKey: checkoutSession.providerReferenceId,
      order: {
        locationId: squareConfig.locationId!,
        referenceId: checkoutSession.providerReferenceId,
        metadata: {
          checkoutSessionId: checkoutSession.id,
          collectionId: context.collection.id,
          userId: req.user!.id,
          purchaseType,
        },
        lineItems: [
          {
            name: context.collection.name,
            quantity: "1",
            basePriceMoney: {
              amount: BigInt(context.promoPricing?.finalAmountCents ?? context.collection.priceCents),
              currency: normalizeSquareCurrencyCode(squareConfig.currency) as any,
            },
            note: context.promoPricing
              ? `Premium drink collection ${purchaseType === "gift" ? "gift" : "unlock"} for ${context.collection.name} with promo ${context.promoPricing.code}`
              : `Premium drink collection ${purchaseType === "gift" ? "gift" : "unlock"} for ${context.collection.name}`,
          },
        ],
      },
      checkoutOptions: {
        redirectUrl,
        allowTipping: false,
        askForShippingAddress: false,
      },
      paymentNote: `Premium collection ${purchaseType === "gift" ? "gift" : "unlock"}: ${context.collection.id}`,
      description: `ChefSire premium drink collection ${purchaseType === "gift" ? "gift" : "checkout"}: ${context.collection.name}`,
    });

    const paymentLink = squareResponse.paymentLink;
    const orderId = paymentLink?.orderId ?? squareResponse.relatedResources?.orders?.[0]?.id ?? null;

    if (!paymentLink?.id || !paymentLink.url || !orderId) {
      await db
        .update(drinkCollectionCheckoutSessions)
        .set({
          status: "failed",
          failureReason: "Square did not return a usable checkout link.",
          lastVerifiedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(drinkCollectionCheckoutSessions.id, checkoutSession.id));

      return res.status(502).json({ ok: false, error: "Failed to create Square checkout link" });
    }

    await db
      .update(drinkCollectionCheckoutSessions)
      .set({
      squarePaymentLinkId: paymentLink.id,
      squareOrderId: orderId,
      checkoutUrl: paymentLink.url,
        updatedAt: new Date(),
      })
      .where(eq(drinkCollectionCheckoutSessions.id, checkoutSession.id));

    return res.status(201).json({
      ok: true,
      collectionId: context.collection.id,
      checkoutSessionId: checkoutSession.id,
      checkoutUrl: paymentLink.url,
      squarePaymentLinkId: paymentLink.id,
      squareOrderId: orderId,
      amountCents: context.promoPricing?.finalAmountCents ?? context.collection.priceCents,
      purchaseType,
      originalAmountCents: Number(context.collection.priceCents ?? 0),
      discountAmountCents: context.promoPricing?.discountAmountCents ?? 0,
      promotionCode: context.promoPricing?.code ?? null,
      currencyCode: normalizeSquareCurrencyCode(squareConfig.currency),
    });
  } catch (error) {
    const status = typeof error === "object" && error !== null && "status" in error
      ? Number((error as { status?: unknown }).status || 500)
      : 500;
    const message = logCollectionRouteError("/:id/create-checkout", req, error);
    if (status !== 500) {
      return res.status(status).json({ ok: false, error: error instanceof Error ? error.message : message });
    }
    return res.status(500).json(collectionServerError(message, "Failed to start Square checkout"));
  }
});

r.get("/collections/checkout-sessions/:sessionId/status", requireAuth, async (req, res) => {
  try {
    if (!db) return res.status(503).json({ ok: false, error: "Database unavailable" });

    await ensureDrinkCollectionsSchema();

    const checkoutSession = await loadCheckoutSessionForUser(req.params.sessionId, req.user!.id);
    if (!checkoutSession) {
      return res.status(404).json({ ok: false, error: "Checkout session not found" });
    }

    const verification = await verifyCollectionCheckoutSession(checkoutSession);
    const gift = await loadGiftByCheckoutSessionId(checkoutSession.id);
    return res.json({
      ok: true,
      ...verification,
      purchaseType: normalizePurchaseType(checkoutSession.purchaseType),
      gift: gift ? toGiftSummary(gift, buildGiftClaimUrl(req, gift.giftCode)) : null,
    });
  } catch (error) {
    const message = logCollectionRouteError("/checkout-sessions/:sessionId/status", req, error);
    return res.status(500).json(collectionServerError(message, "Failed to verify Square checkout"));
  }
});

r.post("/collections/:id/purchase", requireAuth, async (req, res) => {
  try {
    if (!db) return res.status(503).json({ ok: false, error: "Database unavailable" });

    await ensureDrinkCollectionsSchema();

    const context = await resolveCollectionPurchaseContext(req.params.id, req.user!.id);
    if (context.alreadyOwned) {
      return res.status(200).json({
        ok: true,
        collectionId: context.collection.id,
        owned: true,
        alreadyOwned: true,
      });
    }

    return res.status(410).json({
      ok: false,
      error: "Direct premium unlock is disabled. Start Square checkout with POST /api/drinks/collections/:id/create-checkout instead.",
      code: "SQUARE_CHECKOUT_REQUIRED",
    });
  } catch (error) {
    const status = typeof error === "object" && error !== null && "status" in error
      ? Number((error as { status?: unknown }).status || 500)
      : 500;
    const message = logCollectionRouteError("/:id/purchase", req, error);
    if (status !== 500) {
      return res.status(status).json({ ok: false, error: error instanceof Error ? error.message : message });
    }
    return res.status(500).json(collectionServerError(message, "Failed to unlock collection"));
  }
});

r.get("/collections/:id", optionalAuth, async (req, res) => {
  try {
    if (!db) return res.status(503).json({ ok: false, error: "Database unavailable" });

    await ensureDrinkCollectionsSchema();

    const rows = await db.select().from(drinkCollections).where(eq(drinkCollections.id, req.params.id)).limit(1);
    const collection = rows[0] ? normalizeCollectionRowForResponse(rows[0]) : null;

    if (!collection) return res.status(404).json({ ok: false, error: "Collection not found" });

    const isOwner = req.user?.id && req.user.id === collection.userId;
    if (!collection.isPublic && !isOwner) {
      return res.status(403).json({ ok: false, error: "Collection is private" });
    }

    const [collectionAccessMap, wishlistedCollectionIds, activePromotionPricingByCollectionId, wishlistCountsByCollectionId, reviewSummaryByCollectionId] = await Promise.all([
      loadCollectionAccessMapForUser(req.user?.id ?? null),
      loadWishlistedCollectionIdsForUser(req.user?.id ?? null),
      loadActivePromotionPricingMap([collection]),
      loadWishlistCountsForCollections([collection.id]),
      loadCollectionReviewSummaryMap([collection.id]),
    ]);
    const ownedCollectionIds = new Set(collectionAccessMap.keys());
    const hydrated = await resolveCollectionWithItems(
      collection,
      req.user?.id ?? null,
      ownedCollectionIds,
      collectionAccessMap,
      wishlistedCollectionIds,
      activePromotionPricingByCollectionId,
      wishlistCountsByCollectionId,
      reviewSummaryByCollectionId,
    );

    if (!hydrated) return res.status(500).json({ ok: false, error: "Failed to resolve collection" });

    const latestCheckoutSession = req.user?.id && !isOwner && hydrated.accessType === "premium_purchase"
      ? await loadLatestCheckoutSessionForUserCollection(req.user.id, collection.id)
      : null;
    const latestGift = latestCheckoutSession ? await loadGiftByCheckoutSessionId(latestCheckoutSession.id) : null;
    const membershipPlan = await loadCreatorMembershipPlanByCreatorId(collection.userId);
    const viewerMembership = req.user?.id ? await loadViewerMembershipForCreator(req.user.id, collection.userId) : null;

    const isOwned = Boolean(hydrated.ownedByViewer);
    const requiresUnlock = hydrated.accessType !== "public" && !isOwner && !isOwned;
    if (requiresUnlock) {
      const previewLimit = 2;
      return res.json({
        ok: true,
        collection: {
          ...hydrated,
          isLocked: true,
          requiresUnlock: true,
          ownedByViewer: false,
          previewLimit,
          items: hydrated.items.slice(0, previewLimit),
          checkout: toCollectionCheckoutSnapshot(
            latestCheckoutSession,
            latestGift ? toGiftSummary(latestGift, buildGiftClaimUrl(req, latestGift.giftCode)) : null,
          ),
          membershipPlan: serializeMembershipPlan(membershipPlan),
          viewerMembership: serializeMembershipRecord(viewerMembership),
        },
      });
    }

    return res.json({
      ok: true,
      collection: {
        ...hydrated,
        isLocked: false,
        requiresUnlock: false,
        checkout: toCollectionCheckoutSnapshot(
          latestCheckoutSession,
          latestGift ? toGiftSummary(latestGift, buildGiftClaimUrl(req, latestGift.giftCode)) : null,
        ),
        membershipPlan: serializeMembershipPlan(membershipPlan),
        viewerMembership: serializeMembershipRecord(viewerMembership),
      },
    });
  } catch (error) {
    const message = logCollectionRouteError("/:id", req, error);
    return res.status(500).json(collectionServerError(message, "Failed to load collection"));
  }
});

r.patch("/collections/:id", optionalAuth, async (req, res) => {
  try {
    if (!req.user?.id) return collectionAuthRequired(res);
    if (!db) {
      logCollectionDbUnavailable("/:id", req);
      return res.status(503).json({ ok: false, error: "Database unavailable", code: "DB_UNAVAILABLE" });
    }

    await ensureDrinkCollectionsSchema();

    const existingRows = await db.select().from(drinkCollections).where(eq(drinkCollections.id, req.params.id)).limit(1);
    const existing = existingRows[0];
    if (!existing) return res.status(404).json({ ok: false, error: "Collection not found" });
    if (existing.userId !== req.user.id) return res.status(403).json({ ok: false, error: "Not authorized" });

    const parsed = updateDrinkCollectionBodySchema.safeParse(req.body ?? {});
    if (!parsed.success) {
      return res.status(400).json({ ok: false, error: "Invalid collection update", details: parsed.error.flatten() });
    }

    const nextAccessType = deriveCollectionAccessType({
      accessType: parsed.data.accessType,
      isPremium: parsed.data.isPremium,
      fallback: collectionAccessTypeForRow(existing),
    });
    const nextPriceInput = parsed.data.priceCents ?? existing.priceCents;
    const validation = validateCollectionAccessPayload(nextAccessType, nextPriceInput);
    if (!validation.ok) {
      return res.status(400).json({ ok: false, error: validation.error });
    }

    const updatedRows = await db
      .update(drinkCollections)
      .set({
        ...(parsed.data.name !== undefined ? { name: parsed.data.name } : {}),
        ...(parsed.data.description !== undefined ? { description: normalizeCollectionDescription(parsed.data.description) } : {}),
        ...(parsed.data.isPublic !== undefined ? { isPublic: parsed.data.isPublic } : {}),
        accessType: nextAccessType,
        isPremium: nextAccessType !== "public",
        priceCents: validation.normalizedPrice,
        updatedAt: new Date(),
      })
      .where(eq(drinkCollections.id, req.params.id))
      .returning();

    const hydrated = await resolveCollectionWithItems(updatedRows[0], req.user?.id ?? null);
    if (updatedRows[0]) {
      await Promise.all([
        maybeNotifyFollowersAboutPublishedPremiumCollection(updatedRows[0], existing),
        maybeNotifyWishlistersAboutPriceDrop({
          previousCollection: existing,
          nextCollection: updatedRows[0],
        }),
      ]);
    }
    return res.json({ ok: true, collection: hydrated });
  } catch (error) {
    logCollectionRouteError("/:id", req, error);
    const payload = collectionDbErrorResponse(error, "Failed to update collection");
    const status = classifyCollectionError(error, "Failed to update collection").status;
    return res.status(status).json(payload);
  }
});

r.delete("/collections/:id", optionalAuth, async (req, res) => {
  try {
    if (!req.user?.id) return collectionAuthRequired(res);
    if (!db) {
      logCollectionDbUnavailable("/:id", req);
      return res.status(503).json({ ok: false, error: "Database unavailable", code: "DB_UNAVAILABLE" });
    }

    await ensureDrinkCollectionsSchema();

    const existingRows = await db.select().from(drinkCollections).where(eq(drinkCollections.id, req.params.id)).limit(1);
    const existing = existingRows[0];
    if (!existing) return res.status(404).json({ ok: false, error: "Collection not found" });
    if (existing.userId !== req.user.id) return res.status(403).json({ ok: false, error: "Not authorized" });

    await db.delete(drinkCollections).where(eq(drinkCollections.id, req.params.id));
    return res.json({ ok: true, message: "Collection deleted" });
  } catch (error) {
    logCollectionRouteError("/:id", req, error);
    const payload = collectionDbErrorResponse(error, "Failed to delete collection");
    const status = classifyCollectionError(error, "Failed to delete collection").status;
    return res.status(status).json(payload);
  }
});

r.post("/collections/:id/items", optionalAuth, async (req, res) => {
  try {
    if (!req.user?.id) return collectionAuthRequired(res);
    if (!db) {
      logCollectionDbUnavailable("/:id/items", req);
      return res.status(503).json({ ok: false, error: "Database unavailable", code: "DB_UNAVAILABLE" });
    }

    await ensureDrinkCollectionsSchema();

    const existingRows = await db.select().from(drinkCollections).where(eq(drinkCollections.id, req.params.id)).limit(1);
    const existing = existingRows[0];
    if (!existing) return res.status(404).json({ ok: false, error: "Collection not found" });
    if (existing.userId !== req.user.id) return res.status(403).json({ ok: false, error: "Not authorized" });

    const parsed = createDrinkCollectionItemBodySchema.safeParse(req.body ?? {});
    if (!parsed.success) {
      return res.status(400).json({ ok: false, error: "Invalid collection item payload", details: parsed.error.flatten() });
    }

    const drink = await resolveDrinkDetailsBySlug(parsed.data.drinkSlug);
    if (!drink) return res.status(404).json({ ok: false, error: "Drink slug not found" });

    await db
      .insert(drinkCollectionItems)
      .values({ collectionId: req.params.id, drinkSlug: parsed.data.drinkSlug })
      .onConflictDoNothing();

    await db
      .update(drinkCollections)
      .set({ updatedAt: new Date() })
      .where(eq(drinkCollections.id, req.params.id));

    const refreshedRows = await db.select().from(drinkCollections).where(eq(drinkCollections.id, req.params.id)).limit(1);
    const hydrated = await resolveCollectionWithItems(refreshedRows[0], req.user?.id ?? null);
    return res.status(201).json({ ok: true, collection: hydrated });
  } catch (error) {
    logCollectionRouteError("/:id/items", req, error);
    const payload = collectionDbErrorResponse(error, "Failed to add item");
    const status = classifyCollectionError(error, "Failed to add item").status;
    return res.status(status).json(payload);
  }
});

r.delete("/collections/:id/items/:slug", optionalAuth, async (req, res) => {
  try {
    if (!req.user?.id) return collectionAuthRequired(res);
    if (!db) {
      logCollectionDbUnavailable("/:id/items/:slug", req);
      return res.status(503).json({ ok: false, error: "Database unavailable", code: "DB_UNAVAILABLE" });
    }

    await ensureDrinkCollectionsSchema();

    const existingRows = await db.select().from(drinkCollections).where(eq(drinkCollections.id, req.params.id)).limit(1);
    const existing = existingRows[0];
    if (!existing) return res.status(404).json({ ok: false, error: "Collection not found" });
    if (existing.userId !== req.user.id) return res.status(403).json({ ok: false, error: "Not authorized" });

    const slug = normalizeSlug(req.params.slug);
    if (!slug) return res.status(400).json({ ok: false, error: "Invalid slug" });

    await db
      .delete(drinkCollectionItems)
      .where(and(eq(drinkCollectionItems.collectionId, req.params.id), eq(drinkCollectionItems.drinkSlug, slug)));

    await db
      .update(drinkCollections)
      .set({ updatedAt: new Date() })
      .where(eq(drinkCollections.id, req.params.id));

    const refreshedRows = await db.select().from(drinkCollections).where(eq(drinkCollections.id, req.params.id)).limit(1);
    const hydrated = await resolveCollectionWithItems(refreshedRows[0], req.user?.id ?? null);
    return res.json({ ok: true, collection: hydrated });
  } catch (error) {
    logCollectionRouteError("/:id/items/:slug", req, error);
    const payload = collectionDbErrorResponse(error, "Failed to remove item");
    const status = classifyCollectionError(error, "Failed to remove item").status;
    return res.status(status).json(payload);
  }
});

// ========================================
// CUSTOM DRINKS API ROUTES (NEW)
// ========================================

// Get user's custom drinks
r.get("/custom-drinks/user/:userId", requireAuth, async (req, res) => {
  try {
    const { userId } = req.params;
    const { category } = req.query;
    
    const drinks = await storage.getUserCustomDrinks(
      userId, 
      category as string | undefined
    );
    res.json({ ok: true, drinks });
  } catch (error: any) {
    console.error("Error fetching user drinks:", error);
    res.status(500).json({ ok: false, error: "Failed to fetch custom drinks" });
  }
});

// Get single custom drink
r.get("/custom-drinks/:id", async (req, res) => {
  try {
    const drink = await storage.getCustomDrinkWithUser(req.params.id);
    if (!drink) {
      return res.status(404).json({ ok: false, error: "Drink not found" });
    }
    res.json({ ok: true, drink });
  } catch (error: any) {
    console.error("Error fetching drink:", error);
    res.status(500).json({ ok: false, error: "Failed to fetch drink" });
  }
});

// Get public/community drinks
r.get("/custom-drinks/public", async (req, res) => {
  try {
    const { category, limit } = req.query;
    const drinks = await storage.getPublicCustomDrinks(
      category as string | undefined,
      limit ? parseInt(limit as string) : undefined
    );
    res.json({ ok: true, drinks });
  } catch (error: any) {
    console.error("Error fetching public drinks:", error);
    res.status(500).json({ ok: false, error: "Failed to fetch public drinks" });
  }
});

// Create custom drink
r.post("/custom-drinks", requireAuth, async (req, res) => {
  try {
    const drinkData = insertCustomDrinkSchema.parse({
      ...req.body,
      userId: req.user.id,
    });
    
    const drink = await storage.createCustomDrink(drinkData);
    res.status(201).json({ ok: true, drink });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ 
        ok: false,
        error: "Invalid drink data", 
        details: error.errors 
      });
    }
    console.error("Error creating drink:", error);
    res.status(500).json({ ok: false, error: "Failed to create custom drink" });
  }
});

// Update custom drink
r.patch("/custom-drinks/:id", requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    
    // Verify ownership
    const existing = await storage.getCustomDrink(id);
    if (!existing) {
      return res.status(404).json({ ok: false, error: "Drink not found" });
    }
    if (existing.userId !== req.user.id) {
      return res.status(403).json({ ok: false, error: "Not authorized" });
    }
    
    const updated = await storage.updateCustomDrink(id, req.body);
    res.json({ ok: true, drink: updated });
  } catch (error: any) {
    console.error("Error updating drink:", error);
    res.status(500).json({ ok: false, error: "Failed to update drink" });
  }
});

// Delete custom drink
r.delete("/custom-drinks/:id", requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    
    // Verify ownership
    const existing = await storage.getCustomDrink(id);
    if (!existing) {
      return res.status(404).json({ ok: false, error: "Drink not found" });
    }
    if (existing.userId !== req.user.id) {
      return res.status(403).json({ ok: false, error: "Not authorized" });
    }
    
    const success = await storage.deleteCustomDrink(id);
    if (success) {
      res.json({ ok: true, message: "Drink deleted successfully" });
    } else {
      res.status(500).json({ ok: false, error: "Failed to delete drink" });
    }
  } catch (error: any) {
    console.error("Error deleting drink:", error);
    res.status(500).json({ ok: false, error: "Failed to delete drink" });
  }
});

// ========================================
// DRINK PHOTOS
// ========================================

// Upload drink photo
r.post("/custom-drinks/:id/photo", requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    
    // Verify drink exists and user owns it
    const drink = await storage.getCustomDrink(id);
    if (!drink) {
      return res.status(404).json({ ok: false, error: "Drink not found" });
    }
    if (drink.userId !== req.user.id) {
      return res.status(403).json({ ok: false, error: "Not authorized" });
    }
    
    const photoData = insertDrinkPhotoSchema.parse({
      drinkId: id,
      userId: req.user.id,
      imageUrl: req.body.imageUrl,
      caption: req.body.caption,
    });
    
    const photo = await storage.createDrinkPhoto(photoData);
    
    // Also update the drink's imageUrl if it doesn't have one
    if (!drink.imageUrl) {
      await storage.updateCustomDrink(id, { imageUrl: photo.imageUrl });
    }
    
    res.status(201).json({ ok: true, photo });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ 
        ok: false,
        error: "Invalid photo data", 
        details: error.errors 
      });
    }
    console.error("Error uploading photo:", error);
    res.status(500).json({ ok: false, error: "Failed to upload photo" });
  }
});

// Get drink photos
r.get("/custom-drinks/:id/photos", async (req, res) => {
  try {
    const photos = await storage.getDrinkPhotos(req.params.id);
    res.json({ ok: true, photos });
  } catch (error: any) {
    console.error("Error fetching photos:", error);
    res.status(500).json({ ok: false, error: "Failed to fetch photos" });
  }
});

// Delete drink photo
r.delete("/drink-photos/:id", requireAuth, async (req, res) => {
  try {
    const success = await storage.deleteDrinkPhoto(req.params.id);
    if (success) {
      res.json({ ok: true, message: "Photo deleted successfully" });
    } else {
      res.status(404).json({ ok: false, error: "Photo not found" });
    }
  } catch (error: any) {
    console.error("Error deleting photo:", error);
    res.status(500).json({ ok: false, error: "Failed to delete photo" });
  }
});

// ========================================
// DRINK LIKES
// ========================================

// Like a drink
r.post("/custom-drinks/:id/like", requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const like = await storage.likeDrink(req.user.id, id);
    res.status(201).json({ ok: true, like });
  } catch (error: any) {
    console.error("Error liking drink:", error);
    res.status(500).json({ ok: false, error: "Failed to like drink" });
  }
});

// Unlike a drink
r.delete("/custom-drinks/:id/like", requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const success = await storage.unlikeDrink(req.user.id, id);
    if (success) {
      res.json({ ok: true, message: "Drink unliked" });
    } else {
      res.status(404).json({ ok: false, error: "Like not found" });
    }
  } catch (error: any) {
    console.error("Error unliking drink:", error);
    res.status(500).json({ ok: false, error: "Failed to unlike drink" });
  }
});

// Check if drink is liked
r.get("/custom-drinks/:id/liked", requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const isLiked = await storage.isDrinkLiked(req.user.id, id);
    res.json({ ok: true, isLiked });
  } catch (error: any) {
    console.error("Error checking like status:", error);
    res.status(500).json({ ok: false, error: "Failed to check like status" });
  }
});

// ========================================
// DRINK SAVES/FAVORITES
// ========================================

// Save a drink
r.post("/custom-drinks/:id/save", requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const save = await storage.saveDrink(req.user.id, id);
    res.status(201).json({ ok: true, save });
  } catch (error: any) {
    console.error("Error saving drink:", error);
    res.status(500).json({ ok: false, error: "Failed to save drink" });
  }
});

// Unsave a drink
r.delete("/custom-drinks/:id/save", requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const success = await storage.unsaveDrink(req.user.id, id);
    if (success) {
      res.json({ ok: true, message: "Drink unsaved" });
    } else {
      res.status(404).json({ ok: false, error: "Save not found" });
    }
  } catch (error: any) {
    console.error("Error unsaving drink:", error);
    res.status(500).json({ ok: false, error: "Failed to unsave drink" });
  }
});

// Check if drink is saved
r.get("/custom-drinks/:id/saved", requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const isSaved = await storage.isDrinkSaved(req.user.id, id);
    res.json({ ok: true, isSaved });
  } catch (error: any) {
    console.error("Error checking save status:", error);
    res.status(500).json({ ok: false, error: "Failed to check save status" });
  }
});

// Get user's saved drinks
r.get("/custom-drinks/saved/:userId", requireAuth, async (req, res) => {
  try {
    const { userId } = req.params;
    const { category } = req.query;
    const drinks = await storage.getUserSavedDrinks(
      userId,
      category as string | undefined
    );
    res.json({ ok: true, drinks });
  } catch (error: any) {
    console.error("Error fetching saved drinks:", error);
    res.status(500).json({ ok: false, error: "Failed to fetch saved drinks" });
  }
});

// ========================================
// USER DRINK STATS
// ========================================

// Get user stats
r.get("/user-drink-stats/:userId", async (req, res) => {
  try {
    const stats = await storage.getUserDrinkStats(req.params.userId);
    res.json({ ok: true, stats });
  } catch (error: any) {
    console.error("Error fetching stats:", error);
    res.status(500).json({ ok: false, error: "Failed to fetch stats" });
  }
});

// Update user stats
r.patch("/user-drink-stats/:userId", requireAuth, async (req, res) => {
  try {
    const { userId } = req.params;
    
    if (userId !== req.user.id) {
      return res.status(403).json({ ok: false, error: "Not authorized" });
    }
    
    const updated = await storage.updateUserDrinkStats(userId, req.body);
    res.json({ ok: true, stats: updated });
  } catch (error: any) {
    console.error("Error updating stats:", error);
    res.status(500).json({ ok: false, error: "Failed to update stats" });
  }
});

// Award badge to user
r.post("/user-drink-stats/:userId/badge", requireAuth, async (req, res) => {
  try {
    const { userId } = req.params;
    const { badge } = req.body;
    
    if (!badge) {
      return res.status(400).json({ ok: false, error: "Badge name required" });
    }
    
    await storage.addBadge(userId, badge);
    res.json({ ok: true, message: "Badge awarded" });
  } catch (error: any) {
    console.error("Error awarding badge:", error);
    res.status(500).json({ ok: false, error: "Failed to award badge" });
  }
});

export default r;
