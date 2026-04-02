import { sql } from "drizzle-orm";
import { pgTable, text, varchar, integer, boolean, timestamp, bigserial, index, uniqueIndex } from "drizzle-orm/pg-core";
import {
  DrinkCollectionAccessType,
  DrinkCollectionPurchaseStatus,
  DrinkCollectionCheckoutStatus,
  DrinkCollectionSalesLedgerStatus,
  DrinkPurchaseType,
  DrinkCollectionPromotionDiscountType,
} from "./creator-constants";

export const defineCreatorCommerceSchema = ({ users }: { users: any }) => {
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
  };
};
