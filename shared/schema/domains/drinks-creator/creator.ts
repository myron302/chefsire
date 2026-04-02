import { sql } from "drizzle-orm";
import { AnyPgColumn, pgTable, text, varchar, integer, boolean, timestamp, bigserial, jsonb, index, uniqueIndex, check } from "drizzle-orm/pg-core";

export const DRINK_COLLECTION_ACCESS_TYPE_VALUES = ["public", "premium_purchase", "membership_only"] as const;
export type DrinkCollectionAccessType = (typeof DRINK_COLLECTION_ACCESS_TYPE_VALUES)[number];

export const DRINK_COLLECTION_PURCHASE_STATUS_VALUES = ["completed", "refunded_pending", "refunded", "revoked"] as const;
export type DrinkCollectionPurchaseStatus = (typeof DRINK_COLLECTION_PURCHASE_STATUS_VALUES)[number];

export const DRINK_COLLECTION_CHECKOUT_STATUS_VALUES = [
  "pending",
  "completed",
  "failed",
  "canceled",
  "refunded_pending",
  "refunded",
  "revoked",
] as const;
export type DrinkCollectionCheckoutStatus = (typeof DRINK_COLLECTION_CHECKOUT_STATUS_VALUES)[number];

export const DRINK_COLLECTION_SALES_LEDGER_STATUS_VALUES = ["completed", "refunded_pending", "refunded", "revoked"] as const;
export type DrinkCollectionSalesLedgerStatus = (typeof DRINK_COLLECTION_SALES_LEDGER_STATUS_VALUES)[number];

export const DRINK_PURCHASE_TYPE_VALUES = ["self", "gift"] as const;
export type DrinkPurchaseType = (typeof DRINK_PURCHASE_TYPE_VALUES)[number];

export const DRINK_COLLECTION_PROMOTION_DISCOUNT_TYPE_VALUES = ["percent", "fixed"] as const;
export type DrinkCollectionPromotionDiscountType = (typeof DRINK_COLLECTION_PROMOTION_DISCOUNT_TYPE_VALUES)[number];
export const CREATOR_POST_VISIBILITY_VALUES = ["public", "followers", "members"] as const;
export type CreatorPostVisibility = (typeof CREATOR_POST_VISIBILITY_VALUES)[number];
export const CREATOR_DROP_VISIBILITY_VALUES = CREATOR_POST_VISIBILITY_VALUES;
export type CreatorDropVisibility = (typeof CREATOR_DROP_VISIBILITY_VALUES)[number];
export const CREATOR_ROADMAP_VISIBILITY_VALUES = CREATOR_POST_VISIBILITY_VALUES;
export type CreatorRoadmapVisibility = (typeof CREATOR_ROADMAP_VISIBILITY_VALUES)[number];
export const CREATOR_CAMPAIGN_ROLLOUT_TIMELINE_AUDIENCE_VALUES = ["members", "followers", "public"] as const;
export type CreatorCampaignRolloutTimelineAudience = (typeof CREATOR_CAMPAIGN_ROLLOUT_TIMELINE_AUDIENCE_VALUES)[number];
export const CREATOR_CAMPAIGN_STARTS_WITH_AUDIENCE_VALUES = ["members", "followers", "public"] as const;
export type CreatorCampaignStartsWithAudience = (typeof CREATOR_CAMPAIGN_STARTS_WITH_AUDIENCE_VALUES)[number];

export const CREATOR_CAMPAIGN_PLAYBOOK_PROFILE_STARTS_WITH_AUDIENCE_VALUES = ["members", "followers", "public"] as const;
export type CreatorCampaignPlaybookProfileStartsWithAudience = (typeof CREATOR_CAMPAIGN_PLAYBOOK_PROFILE_STARTS_WITH_AUDIENCE_VALUES)[number];

export const CREATOR_CAMPAIGN_PLAYBOOK_PREFERRED_AUDIENCE_FIT_VALUES = ["members", "followers", "public"] as const;
export type CreatorCampaignPlaybookPreferredAudienceFit = (typeof CREATOR_CAMPAIGN_PLAYBOOK_PREFERRED_AUDIENCE_FIT_VALUES)[number];

type CreatorCampaignRolloutTimelineChange<T> = {
  from: T;
  to: T;
};

export type CreatorCampaignRolloutTimelineMetadata = {
  rolloutMode?: string | CreatorCampaignRolloutTimelineChange<string>;
  startsWithAudience?: CreatorCampaignRolloutTimelineChange<string | null>;
  unlockFollowersAt?: string | null | CreatorCampaignRolloutTimelineChange<string | null>;
  unlockPublicAt?: string | null | CreatorCampaignRolloutTimelineChange<string | null>;
  rolloutNotesChanged?: boolean;
  isRolloutActive?: boolean | CreatorCampaignRolloutTimelineChange<boolean>;
  currentAudience?: string;
  finalAudience?: string;
  readinessState?: "blocked" | "almost_ready" | "missing_key_items";
  preflightKind?: string;
  targetAt?: string | null;
  dropId?: string;
  dropType?: string;
  route?: string;
  delayedByHours?: number;
  nextUnlockAt?: string | null;
  field?: "unlockFollowersAt" | "unlockPublicAt";
  releasedAt?: string;
  nextAudience?: CreatorCampaignRolloutTimelineAudience;
  previousPausedAt?: string | null;
};

export type CreatorCampaignEventMetadata = {
  dropId?: string;
  source?: "campaign_variant" | "campaign_surface";
  referrerRoute?: string;
};


export const defineCreatorSchema = ({
  users,
  drinkChallenges,
}: {
  users: any;
  drinkChallenges: any;
}) => {
const drinkCollections = pgTable(
  "drink_collections",
  {
    id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
    userId: varchar("user_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
    name: varchar("name", { length: 160 }).notNull(),
    description: text("description"),
    isPublic: boolean("is_public").default(false).notNull(),
    accessType: text("access_type").$type<DrinkCollectionAccessType>().default("public").notNull(),
    isPremium: boolean("is_premium").default(false).notNull(),
    priceCents: integer("price_cents").default(0).notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => ({
    userIdx: index("drink_collections_user_idx").on(table.userId),
    publicIdx: index("drink_collections_public_idx").on(table.isPublic),
    userUpdatedAtIdx: index("drink_collections_user_updated_at_idx").on(table.userId, table.updatedAt),
    publicUpdatedAtIdx: index("drink_collections_public_updated_at_idx").on(table.isPublic, table.updatedAt),
  })
);

const drinkCollectionItems = pgTable(
  "drink_collection_items",
  {
    collectionId: varchar("collection_id")
      .references(() => drinkCollections.id, { onDelete: "cascade" })
      .notNull(),
    drinkSlug: varchar("drink_slug", { length: 200 }).notNull(),
    addedAt: timestamp("added_at").defaultNow().notNull(),
  },
  (table) => ({
    collectionDrinkIdx: uniqueIndex("drink_collection_items_collection_drink_idx").on(table.collectionId, table.drinkSlug),
    slugIdx: index("drink_collection_items_slug_idx").on(table.drinkSlug),
  })
);

const drinkCollectionPurchases = pgTable(
  "drink_collection_purchases",
  {
    id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
    userId: varchar("user_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
    collectionId: varchar("collection_id").references(() => drinkCollections.id, { onDelete: "cascade" }).notNull(),
    status: text("status").$type<DrinkCollectionPurchaseStatus>().default("completed").notNull(),
    statusReason: text("status_reason"),
    accessRevokedAt: timestamp("access_revoked_at"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => ({
    userIdx: index("drink_collection_purchases_user_idx").on(table.userId),
    collectionIdx: index("drink_collection_purchases_collection_idx").on(table.collectionId),
    uniqueOwnershipIdx: uniqueIndex("drink_collection_purchases_user_collection_idx").on(table.userId, table.collectionId),
  })
);

const drinkCollectionWishlists = pgTable(
  "drink_collection_wishlists",
  {
    id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
    userId: varchar("user_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
    collectionId: varchar("collection_id").references(() => drinkCollections.id, { onDelete: "cascade" }).notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => ({
    userIdx: index("drink_collection_wishlists_user_idx").on(table.userId),
    collectionIdx: index("drink_collection_wishlists_collection_idx").on(table.collectionId),
    userCreatedAtIdx: index("drink_collection_wishlists_user_created_at_idx").on(table.userId, table.createdAt),
    uniqueWishlistIdx: uniqueIndex("drink_collection_wishlists_user_collection_idx").on(table.userId, table.collectionId),
  })
);

const drinkCollectionReviews = pgTable(
  "drink_collection_reviews",
  {
    id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
    userId: varchar("user_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
    collectionId: varchar("collection_id").references(() => drinkCollections.id, { onDelete: "cascade" }).notNull(),
    rating: integer("rating").notNull(),
    title: varchar("title", { length: 160 }),
    body: text("body"),
    isVerifiedPurchase: boolean("is_verified_purchase").default(true).notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => ({
    collectionIdx: index("drink_collection_reviews_collection_idx").on(table.collectionId),
    userIdx: index("drink_collection_reviews_user_idx").on(table.userId),
    collectionCreatedAtIdx: index("drink_collection_reviews_collection_created_at_idx").on(table.collectionId, table.createdAt),
    uniqueUserCollectionIdx: uniqueIndex("drink_collection_reviews_user_collection_idx").on(table.userId, table.collectionId),
  })
);

const drinkCollectionCheckoutSessions = pgTable(
  "drink_collection_checkout_sessions",
  {
    id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
    userId: varchar("user_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
    collectionId: varchar("collection_id").references(() => drinkCollections.id, { onDelete: "cascade" }).notNull(),
    provider: text("provider").default("square").notNull(),
    purchaseType: text("purchase_type").$type<DrinkPurchaseType>().default("self").notNull(),
    status: text("status").$type<DrinkCollectionCheckoutStatus>().default("pending").notNull(),
    promotionId: varchar("promotion_id"),
    promotionCode: text("promotion_code"),
    originalAmountCents: integer("original_amount_cents"),
    discountAmountCents: integer("discount_amount_cents"),
    amountCents: integer("amount_cents").notNull(),
    currencyCode: text("currency_code").default("USD").notNull(),
    squarePaymentLinkId: text("square_payment_link_id"),
    squareOrderId: text("square_order_id"),
    squarePaymentId: text("square_payment_id"),
    providerReferenceId: text("provider_reference_id").notNull().unique(),
    checkoutUrl: text("checkout_url"),
    lastVerifiedAt: timestamp("last_verified_at"),
    verifiedAt: timestamp("verified_at"),
    refundedAt: timestamp("refunded_at"),
    accessRevokedAt: timestamp("access_revoked_at"),
    failureReason: text("failure_reason"),
    expiresAt: timestamp("expires_at"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => ({
    userIdx: index("drink_collection_checkout_sessions_user_idx").on(table.userId),
    collectionIdx: index("drink_collection_checkout_sessions_collection_idx").on(table.collectionId),
    statusIdx: index("drink_collection_checkout_sessions_status_idx").on(table.status),
    paymentLinkIdx: uniqueIndex("drink_collection_checkout_sessions_payment_link_idx").on(table.squarePaymentLinkId),
    orderIdx: uniqueIndex("drink_collection_checkout_sessions_order_idx").on(table.squareOrderId),
  })
);

const drinkCollectionSquareWebhookEvents = pgTable(
  "drink_collection_square_webhook_events",
  {
    id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
    eventId: text("event_id").notNull().unique(),
    eventType: text("event_type").notNull(),
    objectType: text("object_type"),
    objectId: text("object_id"),
    checkoutSessionId: varchar("checkout_session_id").references(() => drinkCollectionCheckoutSessions.id, { onDelete: "set null" }),
    status: text("status").default("processed").notNull(),
    receivedAt: timestamp("received_at").defaultNow().notNull(),
    createdAt: timestamp("created_at"),
  },
  (table) => ({
    objectIdx: index("drink_collection_square_webhook_events_object_idx").on(table.objectType, table.objectId),
    checkoutSessionIdx: index("drink_collection_square_webhook_events_checkout_session_idx").on(table.checkoutSessionId),
  })
);

const drinkGifts = pgTable(
  "drink_gifts",
  {
    id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
    purchaserUserId: varchar("purchaser_user_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
    recipientUserId: varchar("recipient_user_id").references(() => users.id, { onDelete: "set null" }),
    recipientIdentifier: text("recipient_identifier"),
    targetType: text("target_type").notNull(),
    targetId: varchar("target_id", { length: 200 }).notNull(),
    checkoutSessionId: varchar("checkout_session_id", { length: 200 }).notNull(),
    provider: text("provider").default("square").notNull(),
    status: text("status").default("pending").notNull(),
    giftCode: varchar("gift_code", { length: 120 }).notNull().unique(),
    claimedAt: timestamp("claimed_at"),
    completedAt: timestamp("completed_at"),
    revokedAt: timestamp("revoked_at"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => ({
    purchaserIdx: index("drink_gifts_purchaser_user_idx").on(table.purchaserUserId),
    recipientIdx: index("drink_gifts_recipient_user_idx").on(table.recipientUserId),
    targetIdx: index("drink_gifts_target_idx").on(table.targetType, table.targetId),
    checkoutSessionIdx: uniqueIndex("drink_gifts_checkout_session_idx").on(table.checkoutSessionId),
    statusIdx: index("drink_gifts_status_idx").on(table.status),
  })
);

const drinkCollectionSalesLedger = pgTable(
  "drink_collection_sales_ledger",
  {
    id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
    userId: varchar("user_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
    collectionId: varchar("collection_id").references(() => drinkCollections.id, { onDelete: "cascade" }).notNull(),
    purchaseId: varchar("purchase_id").references(() => drinkCollectionPurchases.id, { onDelete: "set null" }),
    checkoutSessionId: varchar("checkout_session_id").references(() => drinkCollectionCheckoutSessions.id, { onDelete: "set null" }),
    promotionId: varchar("promotion_id"),
    promotionCode: text("promotion_code"),
    originalAmountCents: integer("original_amount_cents"),
    discountAmountCents: integer("discount_amount_cents"),
    grossAmountCents: integer("gross_amount_cents").notNull(),
    platformFeeCents: integer("platform_fee_cents"),
    creatorShareCents: integer("creator_share_cents"),
    currencyCode: text("currency_code").default("USD").notNull(),
    status: text("status").$type<DrinkCollectionSalesLedgerStatus>().default("completed").notNull(),
    statusReason: text("status_reason"),
    refundedAt: timestamp("refunded_at"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => ({
    userIdx: index("drink_collection_sales_ledger_user_idx").on(table.userId),
    collectionIdx: index("drink_collection_sales_ledger_collection_idx").on(table.collectionId),
    purchaseIdx: uniqueIndex("drink_collection_sales_ledger_purchase_idx").on(table.purchaseId),
    checkoutSessionIdx: uniqueIndex("drink_collection_sales_ledger_checkout_session_idx").on(table.checkoutSessionId),
    statusCreatedAtIdx: index("drink_collection_sales_ledger_status_created_at_idx").on(table.status, table.createdAt),
  })
);

const drinkCollectionPromotions = pgTable(
  "drink_collection_promotions",
  {
    id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
    creatorUserId: varchar("creator_user_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
    collectionId: varchar("collection_id").references(() => drinkCollections.id, { onDelete: "cascade" }).notNull(),
    code: varchar("code", { length: 64 }).notNull(),
    discountType: text("discount_type").$type<DrinkCollectionPromotionDiscountType>().notNull(),
    discountValue: integer("discount_value").notNull(),
    startsAt: timestamp("starts_at"),
    endsAt: timestamp("ends_at"),
    isActive: boolean("is_active").default(true).notNull(),
    maxRedemptions: integer("max_redemptions"),
    redemptionCount: integer("redemption_count").default(0).notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => ({
    creatorIdx: index("drink_collection_promotions_creator_idx").on(table.creatorUserId),
    collectionIdx: index("drink_collection_promotions_collection_idx").on(table.collectionId),
    activeIdx: index("drink_collection_promotions_active_idx").on(table.isActive, table.startsAt, table.endsAt),
    collectionCodeIdx: uniqueIndex("drink_collection_promotions_collection_code_idx").on(table.collectionId, table.code),
  })
);

const drinkCollectionEvents = pgTable(
  "drink_collection_events",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    collectionId: varchar("collection_id").references(() => drinkCollections.id, { onDelete: "cascade" }).notNull(),
    eventType: text("event_type").notNull(),
    userId: varchar("user_id").references(() => users.id),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => ({
    collectionIdx: index("drink_collection_events_collection_idx").on(table.collectionId),
    eventTypeIdx: index("drink_collection_events_event_type_idx").on(table.eventType),
    createdAtIdx: index("drink_collection_events_created_at_idx").on(table.createdAt),
    collectionEventTypeCreatedAtIdx: index("drink_collection_events_collection_event_type_created_at_idx").on(table.collectionId, table.eventType, table.createdAt),
  })
);

const creatorMembershipPlans = pgTable(
  "creator_membership_plans",
  {
    id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
    creatorUserId: varchar("creator_user_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
    slug: varchar("slug", { length: 160 }).notNull(),
    name: varchar("name", { length: 160 }).notNull(),
    description: text("description"),
    priceCents: integer("price_cents").notNull(),
    billingInterval: text("billing_interval").default("monthly").notNull(),
    isActive: boolean("is_active").default(true).notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => ({
    creatorIdx: uniqueIndex("creator_membership_plans_creator_idx").on(table.creatorUserId),
    slugIdx: uniqueIndex("creator_membership_plans_slug_idx").on(table.slug),
    activeIdx: index("creator_membership_plans_active_idx").on(table.isActive),
  })
);

const creatorMemberships = pgTable(
  "creator_memberships",
  {
    id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
    userId: varchar("user_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
    creatorUserId: varchar("creator_user_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
    planId: varchar("plan_id").references(() => creatorMembershipPlans.id, { onDelete: "cascade" }).notNull(),
    status: text("status").default("active").notNull(),
    startedAt: timestamp("started_at").defaultNow().notNull(),
    endsAt: timestamp("ends_at"),
    canceledAt: timestamp("canceled_at"),
    squareSubscriptionId: text("square_subscription_id"),
    paymentReference: text("payment_reference"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => ({
    userIdx: index("creator_memberships_user_idx").on(table.userId),
    creatorIdx: index("creator_memberships_creator_idx").on(table.creatorUserId),
    statusIdx: index("creator_memberships_status_idx").on(table.status),
    userCreatorIdx: uniqueIndex("creator_memberships_user_creator_idx").on(table.userId, table.creatorUserId),
  })
);

const creatorPosts = pgTable(
  "creator_posts",
  {
    id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
    creatorUserId: varchar("creator_user_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
    title: varchar("title", { length: 160 }).notNull(),
    body: text("body").notNull(),
    postType: text("post_type").default("update").notNull(),
    visibility: text("visibility").$type<CreatorPostVisibility>().default("public").notNull(),
    linkedCollectionId: varchar("linked_collection_id").references(() => drinkCollections.id, { onDelete: "set null" }),
    linkedChallengeId: varchar("linked_challenge_id").references(() => drinkChallenges.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => ({
    creatorIdx: index("creator_posts_creator_idx").on(table.creatorUserId),
    visibilityIdx: index("creator_posts_visibility_idx").on(table.visibility),
    creatorCreatedAtIdx: index("creator_posts_creator_created_at_idx").on(table.creatorUserId, table.createdAt),
    visibilityCreatedAtIdx: index("creator_posts_visibility_created_at_idx").on(table.visibility, table.createdAt),
    visibilityCheck: check("creator_posts_visibility_check", sql`${table.visibility} IN ('public', 'followers', 'members')`),
  })
);

const creatorDrops = pgTable(
  "creator_drops",
  {
    id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
    creatorUserId: varchar("creator_user_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
    title: varchar("title", { length: 160 }).notNull(),
    description: text("description"),
    dropType: text("drop_type").default("collection_launch").notNull(),
    visibility: text("visibility").$type<CreatorDropVisibility>().default("public").notNull(),
    scheduledFor: timestamp("scheduled_for").notNull(),
    linkedCollectionId: varchar("linked_collection_id").references(() => drinkCollections.id, { onDelete: "set null" }),
    linkedChallengeId: varchar("linked_challenge_id").references(() => drinkChallenges.id, { onDelete: "set null" }),
    linkedPromotionId: varchar("linked_promotion_id").references(() => drinkCollectionPromotions.id, { onDelete: "set null" }),
    recapNotes: text("recap_notes"),
    isPublished: boolean("is_published").default(true).notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => ({
    creatorIdx: index("creator_drops_creator_idx").on(table.creatorUserId),
    visibilityIdx: index("creator_drops_visibility_idx").on(table.visibility),
    scheduledIdx: index("creator_drops_scheduled_for_idx").on(table.scheduledFor),
    publishedScheduledIdx: index("creator_drops_published_scheduled_idx").on(table.isPublished, table.scheduledFor),
    creatorScheduledIdx: index("creator_drops_creator_scheduled_idx").on(table.creatorUserId, table.scheduledFor),
    visibilityCheck: check("creator_drops_visibility_check", sql`${table.visibility} IN ('public', 'followers', 'members')`),
  })
);

const creatorDropRsvps = pgTable(
  "creator_drop_rsvps",
  {
    id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
    userId: varchar("user_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
    dropId: varchar("drop_id").references(() => creatorDrops.id, { onDelete: "cascade" }).notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => ({
    userIdx: index("creator_drop_rsvps_user_idx").on(table.userId),
    dropIdx: index("creator_drop_rsvps_drop_idx").on(table.dropId),
    userDropIdx: uniqueIndex("creator_drop_rsvps_user_drop_idx").on(table.userId, table.dropId),
    dropCreatedIdx: index("creator_drop_rsvps_drop_created_at_idx").on(table.dropId, table.createdAt),
  })
);

const creatorRoadmapItems = pgTable(
  "creator_roadmap_items",
  {
    id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
    creatorUserId: varchar("creator_user_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
    title: varchar("title", { length: 160 }).notNull(),
    description: text("description"),
    itemType: text("item_type").default("roadmap").notNull(),
    visibility: text("visibility").$type<CreatorRoadmapVisibility>().default("public").notNull(),
    linkedCollectionId: varchar("linked_collection_id").references(() => drinkCollections.id, { onDelete: "set null" }),
    linkedChallengeId: varchar("linked_challenge_id").references(() => drinkChallenges.id, { onDelete: "set null" }),
    scheduledFor: timestamp("scheduled_for"),
    releasedAt: timestamp("released_at"),
    status: text("status").default("upcoming").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => ({
    creatorIdx: index("creator_roadmap_items_creator_idx").on(table.creatorUserId),
    visibilityIdx: index("creator_roadmap_items_visibility_idx").on(table.visibility),
    statusIdx: index("creator_roadmap_items_status_idx").on(table.status),
    creatorStatusIdx: index("creator_roadmap_items_creator_status_idx").on(table.creatorUserId, table.status),
    scheduledIdx: index("creator_roadmap_items_scheduled_idx").on(table.scheduledFor),
    releasedIdx: index("creator_roadmap_items_released_idx").on(table.releasedAt),
    visibilityCheck: check("creator_roadmap_items_visibility_check", sql`${table.visibility} IN ('public', 'followers', 'members')`),
  })
);

const creatorCampaigns = pgTable(
  "creator_campaigns",
  {
    id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
    creatorUserId: varchar("creator_user_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
    slug: varchar("slug", { length: 200 }).notNull(),
    name: varchar("name", { length: 160 }).notNull(),
    description: text("description"),
    visibility: text("visibility").default("public").notNull(),
    startsAt: timestamp("starts_at"),
    endsAt: timestamp("ends_at"),
    isActive: boolean("is_active").default(true).notNull(),
    rolloutMode: text("rollout_mode").default("public_first").notNull(),
    startsWithAudience: text("starts_with_audience").$type<CreatorCampaignStartsWithAudience | null>(),
    unlockFollowersAt: timestamp("unlock_followers_at"),
    unlockPublicAt: timestamp("unlock_public_at"),
    rolloutNotes: text("rollout_notes"),
    isRolloutActive: boolean("is_rollout_active").default(false).notNull(),
    isRolloutPaused: boolean("is_rollout_paused").default(false).notNull(),
    rolloutPausedAt: timestamp("rollout_paused_at"),
    isPinned: boolean("is_pinned").default(false).notNull(),
    appliedPlaybookProfileId: varchar("applied_playbook_profile_id"),
    playbookAppliedAt: timestamp("playbook_applied_at"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => ({
    creatorIdx: index("creator_campaigns_creator_idx").on(table.creatorUserId),
    slugIdx: uniqueIndex("creator_campaigns_slug_idx").on(table.slug),
    creatorSlugIdx: uniqueIndex("creator_campaigns_creator_slug_idx").on(table.creatorUserId, table.slug),
    visibilityIdx: index("creator_campaigns_visibility_idx").on(table.visibility),
    activeIdx: index("creator_campaigns_active_idx").on(table.isActive, table.startsAt, table.endsAt),
    creatorUpdatedIdx: index("creator_campaigns_creator_updated_at_idx").on(table.creatorUserId, table.updatedAt),
    creatorPinnedIdx: uniqueIndex("creator_campaigns_single_pinned_idx").on(table.creatorUserId).where(sql`${table.isPinned} = true`),
  })
);

const creatorCampaignRolloutTimelineEvents = pgTable(
  "creator_campaign_rollout_timeline_events",
  {
    id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
    campaignId: varchar("campaign_id").references(() => creatorCampaigns.id, { onDelete: "cascade" }).notNull(),
    actorUserId: varchar("actor_user_id").references(() => users.id, { onDelete: "set null" }),
    eventType: text("event_type").notNull(),
    title: varchar("title", { length: 160 }).notNull(),
    message: text("message").notNull(),
    audienceStage: text("audience_stage").$type<CreatorCampaignRolloutTimelineAudience | null>(),
    metadata: jsonb("metadata").$type<CreatorCampaignRolloutTimelineMetadata>().default(sql`'{}'::jsonb`).notNull(),
    occurredAt: timestamp("occurred_at").defaultNow().notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => ({
    campaignIdx: index("creator_campaign_rollout_timeline_events_campaign_idx").on(table.campaignId),
    eventTypeIdx: index("creator_campaign_rollout_timeline_events_event_type_idx").on(table.eventType),
    campaignOccurredIdx: index("creator_campaign_rollout_timeline_events_campaign_occurred_at_idx").on(table.campaignId, table.occurredAt),
    actorIdx: index("creator_campaign_rollout_timeline_events_actor_idx").on(table.actorUserId),
  })
);

const creatorCampaignTemplates = pgTable(
  "creator_campaign_templates",
  {
    id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
    creatorUserId: varchar("creator_user_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
    sourceCampaignId: varchar("source_campaign_id").references(() => creatorCampaigns.id, { onDelete: "set null" }),
    name: varchar("name", { length: 160 }).notNull(),
    description: text("description"),
    blueprint: jsonb("blueprint").$type<{
      campaign: {
        name: string;
        description: string | null;
        visibility: string;
        startsAt: string | null;
        endsAt: string | null;
        isActive: boolean;
      };
      links: Array<{ targetType: string; targetId: string; sortOrder: number }>;
      variants: Array<{
        label: string;
        headline: string | null;
        subheadline: string | null;
        ctaText: string;
        ctaTargetType: string;
        isActive: boolean;
      }>;
      linkedDrafts: {
        drops: Array<Record<string, unknown>>;
        posts: Array<Record<string, unknown>>;
        roadmap: Array<Record<string, unknown>>;
      };
      defaults: {
        resetDates: boolean;
        copyLinkedDrafts: boolean;
        copyCtaVariants: boolean;
      };
    }>().notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => ({
    creatorIdx: index("creator_campaign_templates_creator_idx").on(table.creatorUserId),
    sourceIdx: index("creator_campaign_templates_source_idx").on(table.sourceCampaignId),
    creatorUpdatedIdx: index("creator_campaign_templates_creator_updated_at_idx").on(table.creatorUserId, table.updatedAt),
    creatorNameIdx: uniqueIndex("creator_campaign_templates_creator_name_idx").on(table.creatorUserId, table.name),
  })
);

const creatorCampaignPlaybookProfiles = pgTable(
  "creator_campaign_playbook_profiles",
  {
    id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
    creatorUserId: varchar("creator_user_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
    parentPlaybookProfileId: varchar("parent_playbook_profile_id").references((): AnyPgColumn => creatorCampaignPlaybookProfiles.id, { onDelete: "set null" }),
    sourceCampaignId: varchar("source_campaign_id").references(() => creatorCampaigns.id, { onDelete: "set null" }),
    derivedFromType: text("derived_from_type"),
    versionLabel: varchar("version_label", { length: 80 }),
    name: varchar("name", { length: 160 }).notNull(),
    description: text("description"),
    visibilityStrategy: text("visibility_strategy"),
    rolloutMode: text("rollout_mode").default("public_first").notNull(),
    startsWithAudience: text("starts_with_audience").$type<CreatorCampaignPlaybookProfileStartsWithAudience | null>(),
    recommendedFollowerUnlockDelayHours: integer("recommended_follower_unlock_delay_hours"),
    recommendedPublicUnlockDelayHours: integer("recommended_public_unlock_delay_hours"),
    preferredCtaDirection: text("preferred_cta_direction"),
    preferredExperimentTypes: jsonb("preferred_experiment_types").$type<string[]>().default(sql`'[]'::jsonb`).notNull(),
    preferredAudienceFit: text("preferred_audience_fit").$type<CreatorCampaignPlaybookPreferredAudienceFit | null>(),
    notes: text("notes"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => ({
    creatorIdx: index("creator_campaign_playbook_profiles_creator_idx").on(table.creatorUserId),
    creatorUpdatedIdx: index("creator_campaign_playbook_profiles_creator_updated_at_idx").on(table.creatorUserId, table.updatedAt),
    parentIdx: index("creator_campaign_playbook_profiles_parent_idx").on(table.parentPlaybookProfileId),
    sourceIdx: index("creator_campaign_playbook_profiles_source_campaign_idx").on(table.sourceCampaignId),
    creatorNameIdx: uniqueIndex("creator_campaign_playbook_profiles_creator_name_idx").on(table.creatorUserId, table.name),
  })
);

const creatorCampaignLinks = pgTable(
  "creator_campaign_links",
  {
    id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
    campaignId: varchar("campaign_id").references(() => creatorCampaigns.id, { onDelete: "cascade" }).notNull(),
    targetType: text("target_type").notNull(),
    targetId: varchar("target_id", { length: 200 }).notNull(),
    sortOrder: integer("sort_order").default(0).notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => ({
    campaignIdx: index("creator_campaign_links_campaign_idx").on(table.campaignId),
    targetIdx: index("creator_campaign_links_target_idx").on(table.targetType, table.targetId),
    campaignSortIdx: index("creator_campaign_links_campaign_sort_idx").on(table.campaignId, table.sortOrder, table.createdAt),
    campaignTargetIdx: uniqueIndex("creator_campaign_links_campaign_target_idx").on(table.campaignId, table.targetType, table.targetId),
  })
);

const creatorCampaignFollows = pgTable(
  "creator_campaign_follows",
  {
    id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
    userId: varchar("user_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
    campaignId: varchar("campaign_id").references(() => creatorCampaigns.id, { onDelete: "cascade" }).notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => ({
    userIdx: index("creator_campaign_follows_user_idx").on(table.userId),
    campaignIdx: index("creator_campaign_follows_campaign_idx").on(table.campaignId),
    userCampaignIdx: uniqueIndex("creator_campaign_follows_user_campaign_idx").on(table.userId, table.campaignId),
    campaignCreatedIdx: index("creator_campaign_follows_campaign_created_at_idx").on(table.campaignId, table.createdAt),
  })
);

const creatorCampaignGoals = pgTable(
  "creator_campaign_goals",
  {
    id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
    campaignId: varchar("campaign_id").references(() => creatorCampaigns.id, { onDelete: "cascade" }).notNull(),
    goalType: text("goal_type").notNull(),
    targetValue: integer("target_value").notNull(),
    label: varchar("label", { length: 160 }),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => ({
    campaignIdx: index("creator_campaign_goals_campaign_idx").on(table.campaignId),
    campaignTypeIdx: index("creator_campaign_goals_campaign_type_idx").on(table.campaignId, table.goalType),
    campaignUpdatedIdx: index("creator_campaign_goals_campaign_updated_at_idx").on(table.campaignId, table.updatedAt),
  })
);

const creatorCampaignActionStates = pgTable(
  "creator_campaign_action_states",
  {
    id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
    userId: varchar("user_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
    campaignId: varchar("campaign_id").references(() => creatorCampaigns.id, { onDelete: "cascade" }).notNull(),
    actionType: text("action_type").notNull(),
    actionKey: varchar("action_key", { length: 240 }).notNull(),
    sourceKey: text("source_key"),
    sourceSignature: text("source_signature"),
    state: text("state").default("open").notNull(),
    snoozedUntil: timestamp("snoozed_until"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => ({
    userIdx: index("creator_campaign_action_states_user_idx").on(table.userId),
    campaignIdx: index("creator_campaign_action_states_campaign_idx").on(table.campaignId),
    stateIdx: index("creator_campaign_action_states_state_idx").on(table.userId, table.state, table.updatedAt),
    snoozedIdx: index("creator_campaign_action_states_snoozed_idx").on(table.userId, table.snoozedUntil),
    userActionIdx: uniqueIndex("creator_campaign_action_states_user_action_idx").on(table.userId, table.actionKey),
  })
);

const creatorCampaignExperiments = pgTable(
  "creator_campaign_experiments",
  {
    id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
    campaignId: varchar("campaign_id").references(() => creatorCampaigns.id, { onDelete: "cascade" }).notNull(),
    experimentType: text("experiment_type").notNull(),
    label: varchar("label", { length: 160 }),
    hypothesis: text("hypothesis"),
    startedAt: timestamp("started_at"),
    endedAt: timestamp("ended_at"),
    status: text("status").default("active").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => ({
    campaignIdx: index("creator_campaign_experiments_campaign_idx").on(table.campaignId),
    statusIdx: index("creator_campaign_experiments_status_idx").on(table.status),
    campaignStatusIdx: index("creator_campaign_experiments_campaign_status_updated_at_idx").on(table.campaignId, table.status, table.updatedAt),
    campaignStartedIdx: index("creator_campaign_experiments_campaign_started_at_idx").on(table.campaignId, table.startedAt),
  })
);

const creatorCampaignCtaVariants = pgTable(
  "creator_campaign_cta_variants",
  {
    id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
    campaignId: varchar("campaign_id").references(() => creatorCampaigns.id, { onDelete: "cascade" }).notNull(),
    label: varchar("label", { length: 120 }).notNull(),
    headline: varchar("headline", { length: 160 }),
    subheadline: text("subheadline"),
    ctaText: varchar("cta_text", { length: 120 }).notNull(),
    ctaTargetType: text("cta_target_type").notNull().default("follow"),
    isActive: boolean("is_active").default(false).notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => ({
    campaignIdx: index("creator_campaign_cta_variants_campaign_idx").on(table.campaignId),
    campaignActiveIdx: index("creator_campaign_cta_variants_campaign_active_idx").on(table.campaignId, table.isActive, table.updatedAt),
  })
);

const creatorCampaignVariantEvents = pgTable(
  "creator_campaign_variant_events",
  {
    id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
    campaignId: varchar("campaign_id").references(() => creatorCampaigns.id, { onDelete: "cascade" }).notNull(),
    variantId: varchar("variant_id").references(() => creatorCampaignCtaVariants.id, { onDelete: "cascade" }).notNull(),
    eventType: text("event_type").notNull(),
    userId: varchar("user_id").references(() => users.id, { onDelete: "set null" }),
    sessionKey: varchar("session_key", { length: 160 }),
    metadata: jsonb("metadata").$type<CreatorCampaignEventMetadata | null>(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => ({
    campaignIdx: index("creator_campaign_variant_events_campaign_idx").on(table.campaignId),
    variantIdx: index("creator_campaign_variant_events_variant_idx").on(table.variantId),
    eventTypeIdx: index("creator_campaign_variant_events_event_type_idx").on(table.eventType),
    variantEventCreatedIdx: index("creator_campaign_variant_events_variant_event_created_at_idx").on(table.variantId, table.eventType, table.createdAt),
    userIdx: index("creator_campaign_variant_events_user_idx").on(table.userId),
    sessionIdx: index("creator_campaign_variant_events_session_idx").on(table.sessionKey),
  })
);

const creatorCampaignSpotlightEvents = pgTable(
  "creator_campaign_spotlight_events",
  {
    id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
    campaignId: varchar("campaign_id").references(() => creatorCampaigns.id, { onDelete: "cascade" }).notNull(),
    eventType: text("event_type").notNull(),
    surface: text("surface").notNull(),
    userId: varchar("user_id").references(() => users.id, { onDelete: "set null" }),
    sessionKey: varchar("session_key", { length: 160 }),
    metadata: jsonb("metadata").$type<CreatorCampaignEventMetadata | null>(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => ({
    campaignIdx: index("creator_campaign_spotlight_events_campaign_idx").on(table.campaignId),
    eventTypeIdx: index("creator_campaign_spotlight_events_event_type_idx").on(table.eventType),
    surfaceIdx: index("creator_campaign_spotlight_events_surface_idx").on(table.surface),
    campaignEventCreatedIdx: index("creator_campaign_spotlight_events_campaign_event_created_at_idx").on(table.campaignId, table.eventType, table.createdAt),
    userIdx: index("creator_campaign_spotlight_events_user_idx").on(table.userId),
    sessionIdx: index("creator_campaign_spotlight_events_session_idx").on(table.sessionKey),
  })
);

const creatorCampaignSurfaceEvents = pgTable(
  "creator_campaign_surface_events",
  {
    id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
    campaignId: varchar("campaign_id").references(() => creatorCampaigns.id, { onDelete: "cascade" }).notNull(),
    eventType: text("event_type").notNull(),
    surface: text("surface").notNull(),
    userId: varchar("user_id").references(() => users.id, { onDelete: "set null" }),
    sessionKey: varchar("session_key", { length: 160 }),
    metadata: jsonb("metadata").$type<CreatorCampaignEventMetadata | null>(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => ({
    campaignIdx: index("creator_campaign_surface_events_campaign_idx").on(table.campaignId),
    eventTypeIdx: index("creator_campaign_surface_events_event_type_idx").on(table.eventType),
    surfaceIdx: index("creator_campaign_surface_events_surface_idx").on(table.surface),
    campaignSurfaceEventCreatedIdx: index("creator_campaign_surface_events_campaign_surface_event_created_at_idx").on(table.campaignId, table.surface, table.eventType, table.createdAt),
    userIdx: index("creator_campaign_surface_events_user_idx").on(table.userId),
    sessionIdx: index("creator_campaign_surface_events_session_idx").on(table.sessionKey),
  })
);

const creatorDropEvents = pgTable(
  "creator_drop_events",
  {
    id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
    dropId: varchar("drop_id").references(() => creatorDrops.id, { onDelete: "cascade" }).notNull(),
    eventType: text("event_type").notNull(),
    userId: varchar("user_id").references(() => users.id, { onDelete: "set null" }),
    targetType: text("target_type"),
    targetId: varchar("target_id", { length: 200 }),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => ({
    dropIdx: index("creator_drop_events_drop_idx").on(table.dropId),
    eventTypeIdx: index("creator_drop_events_event_type_idx").on(table.eventType),
    dropEventCreatedIdx: index("creator_drop_events_drop_event_created_at_idx").on(table.dropId, table.eventType, table.createdAt),
    userIdx: index("creator_drop_events_user_idx").on(table.userId),
  })
);

const creatorCollaborations = pgTable(
  "creator_collaborations",
  {
    id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
    ownerCreatorUserId: varchar("owner_creator_user_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
    collaboratorUserId: varchar("collaborator_user_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
    collaborationType: text("collaboration_type").notNull(),
    targetId: varchar("target_id", { length: 200 }).notNull(),
    status: text("status").default("pending").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => ({
    ownerIdx: index("creator_collaborations_owner_idx").on(table.ownerCreatorUserId),
    collaboratorIdx: index("creator_collaborations_collaborator_idx").on(table.collaboratorUserId),
    targetIdx: uniqueIndex("creator_collaborations_target_idx").on(table.collaborationType, table.targetId),
    ownerCollaboratorTargetIdx: uniqueIndex("creator_collaborations_owner_collaborator_target_idx").on(
      table.ownerCreatorUserId,
      table.collaboratorUserId,
      table.collaborationType,
      table.targetId,
    ),
    statusIdx: index("creator_collaborations_status_idx").on(table.status),
  })
);

const creatorMembershipCheckoutSessions = pgTable(
  "creator_membership_checkout_sessions",
  {
    id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
    userId: varchar("user_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
    creatorUserId: varchar("creator_user_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
    planId: varchar("plan_id").references(() => creatorMembershipPlans.id, { onDelete: "cascade" }).notNull(),
    provider: text("provider").default("square").notNull(),
    status: text("status").default("pending").notNull(),
    amountCents: integer("amount_cents").notNull(),
    currencyCode: text("currency_code").default("USD").notNull(),
    squarePaymentLinkId: text("square_payment_link_id"),
    squareOrderId: text("square_order_id"),
    squarePaymentId: text("square_payment_id"),
    providerReferenceId: text("provider_reference_id").notNull().unique(),
    checkoutUrl: text("checkout_url"),
    lastVerifiedAt: timestamp("last_verified_at"),
    verifiedAt: timestamp("verified_at"),
    failureReason: text("failure_reason"),
    expiresAt: timestamp("expires_at"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => ({
    userIdx: index("creator_membership_checkout_sessions_user_idx").on(table.userId),
    creatorIdx: index("creator_membership_checkout_sessions_creator_idx").on(table.creatorUserId),
    planIdx: index("creator_membership_checkout_sessions_plan_idx").on(table.planId),
    statusIdx: index("creator_membership_checkout_sessions_status_idx").on(table.status),
    paymentLinkIdx: uniqueIndex("creator_membership_checkout_sessions_payment_link_idx").on(table.squarePaymentLinkId),
    orderIdx: uniqueIndex("creator_membership_checkout_sessions_order_idx").on(table.squareOrderId),
  })
);

const creatorMembershipSalesLedger = pgTable(
  "creator_membership_sales_ledger",
  {
    id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
    userId: varchar("user_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
    creatorUserId: varchar("creator_user_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
    membershipId: varchar("membership_id").references(() => creatorMemberships.id, { onDelete: "set null" }),
    checkoutSessionId: varchar("checkout_session_id").references(() => creatorMembershipCheckoutSessions.id, { onDelete: "set null" }),
    planId: varchar("plan_id").references(() => creatorMembershipPlans.id, { onDelete: "set null" }),
    grossAmountCents: integer("gross_amount_cents").notNull(),
    currencyCode: text("currency_code").default("USD").notNull(),
    status: text("status").default("completed").notNull(),
    statusReason: text("status_reason"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => ({
    userIdx: index("creator_membership_sales_ledger_user_idx").on(table.userId),
    creatorIdx: index("creator_membership_sales_ledger_creator_idx").on(table.creatorUserId),
    membershipIdx: uniqueIndex("creator_membership_sales_ledger_membership_idx").on(table.membershipId),
    checkoutIdx: uniqueIndex("creator_membership_sales_ledger_checkout_idx").on(table.checkoutSessionId),
    statusIdx: index("creator_membership_sales_ledger_status_idx").on(table.status),
  })
);


  return {
    drinkCollections,
    drinkCollectionItems,
    drinkCollectionPurchases,
    drinkCollectionWishlists,
    drinkCollectionReviews,
    drinkCollectionCheckoutSessions,
    drinkCollectionSquareWebhookEvents,
    drinkGifts,
    drinkCollectionSalesLedger,
    drinkCollectionPromotions,
    drinkCollectionEvents,
    creatorMembershipPlans,
    creatorMemberships,
    creatorPosts,
    creatorDrops,
    creatorDropRsvps,
    creatorRoadmapItems,
    creatorCampaigns,
    creatorCampaignRolloutTimelineEvents,
    creatorCampaignTemplates,
    creatorCampaignPlaybookProfiles,
    creatorCampaignLinks,
    creatorCampaignFollows,
    creatorCampaignGoals,
    creatorCampaignActionStates,
    creatorCampaignExperiments,
    creatorCampaignCtaVariants,
    creatorCampaignVariantEvents,
    creatorCampaignSpotlightEvents,
    creatorCampaignSurfaceEvents,
    creatorDropEvents,
    creatorCollaborations,
    creatorMembershipCheckoutSessions,
    creatorMembershipSalesLedger,
  };
};
