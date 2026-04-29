import { sql } from "drizzle-orm";
import { pgTable, text, varchar, integer, boolean, timestamp, bigserial, jsonb, decimal, index, uniqueIndex } from "drizzle-orm/pg-core";
import { users } from "./users-auth";
import { recipes } from "./social-content";
import {
  DRINK_COLLECTION_ACCESS_TYPE_VALUES,
  DRINK_COLLECTION_PURCHASE_STATUS_VALUES,
  DRINK_COLLECTION_CHECKOUT_STATUS_VALUES,
  DRINK_COLLECTION_SALES_LEDGER_STATUS_VALUES,
  DRINK_PURCHASE_TYPE_VALUES,
  DRINK_COLLECTION_PROMOTION_DISCOUNT_TYPE_VALUES,
  CREATOR_POST_VISIBILITY_VALUES,
  CREATOR_DROP_VISIBILITY_VALUES,
  CREATOR_ROADMAP_VISIBILITY_VALUES,
  CREATOR_CAMPAIGN_ROLLOUT_TIMELINE_AUDIENCE_VALUES,
  CREATOR_CAMPAIGN_STARTS_WITH_AUDIENCE_VALUES,
  CREATOR_CAMPAIGN_PLAYBOOK_PROFILE_STARTS_WITH_AUDIENCE_VALUES,
  CREATOR_CAMPAIGN_PLAYBOOK_PREFERRED_AUDIENCE_FIT_VALUES,
  defineCreatorSchema,
} from "./drinks-creator/creator";
export {
  DRINK_COLLECTION_ACCESS_TYPE_VALUES,
  DRINK_COLLECTION_PURCHASE_STATUS_VALUES,
  DRINK_COLLECTION_CHECKOUT_STATUS_VALUES,
  DRINK_COLLECTION_SALES_LEDGER_STATUS_VALUES,
  DRINK_PURCHASE_TYPE_VALUES,
  DRINK_COLLECTION_PROMOTION_DISCOUNT_TYPE_VALUES,
  CREATOR_POST_VISIBILITY_VALUES,
  CREATOR_DROP_VISIBILITY_VALUES,
  CREATOR_ROADMAP_VISIBILITY_VALUES,
  CREATOR_CAMPAIGN_ROLLOUT_TIMELINE_AUDIENCE_VALUES,
  CREATOR_CAMPAIGN_STARTS_WITH_AUDIENCE_VALUES,
  CREATOR_CAMPAIGN_PLAYBOOK_PROFILE_STARTS_WITH_AUDIENCE_VALUES,
  CREATOR_CAMPAIGN_PLAYBOOK_PREFERRED_AUDIENCE_FIT_VALUES,
};
export type {
  DrinkCollectionAccessType,
  DrinkCollectionPurchaseStatus,
  DrinkCollectionCheckoutStatus,
  DrinkCollectionSalesLedgerStatus,
  DrinkPurchaseType,
  DrinkCollectionPromotionDiscountType,
  CreatorPostVisibility,
  CreatorDropVisibility,
  CreatorRoadmapVisibility,
  CreatorCampaignRolloutTimelineAudience,
  CreatorCampaignStartsWithAudience,
  CreatorCampaignPlaybookProfileStartsWithAudience,
  CreatorCampaignPlaybookPreferredAudienceFit,
  CreatorCampaignRolloutTimelineMetadata,
  CreatorCampaignEventMetadata,
} from "./drinks-creator/creator";

/* ===== SUBSTITUTIONS ===== */
export const substitutionIngredients = pgTable(
  "substitution_ingredients",
  {
    id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
    ingredient: varchar("ingredient", { length: 160 }).notNull(),
    aliases: jsonb("aliases").$type<string[]>().default(sql`'[]'::jsonb`).notNull(),
    group: varchar("group", { length: 80 }).default(""),
    pantryArea: varchar("pantry_area", { length: 80 }).default(""),
    notes: text("notes").default(""),
    source: varchar("source", { length: 200 }).default(""),
    createdAt: timestamp("created_at").defaultNow(),
  },
  (t) => ({
    ingredientIdx: index("subs_ing_ingredient_idx").on(t.ingredient),
  })
);

export const substitutions = pgTable(
  "substitutions",
  {
    id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
    ingredientId: varchar("ingredient_id")
      .notNull()
      .references(() => substitutionIngredients.id, { onDelete: "cascade" }),
    text: text("text").notNull(),
    components: jsonb("components")
      .$type<{ item: string; amount?: number; unit?: string; note?: string }[]>()
      .default(sql`'[]'::jsonb`)
      .notNull(),
    method: jsonb("method")
      .$type<{ action?: string; time_min?: number; time_max?: number; temperature?: string }>()
      .default(sql`'{}'::jsonb`)
      .notNull(),
    ratio: varchar("ratio", { length: 160 }).default(""),
    context: varchar("context", { length: 80 }).default(""),
    dietTags: jsonb("diet_tags").$type<string[]>().default(sql`'[]'::jsonb`).notNull(),
    allergenFlags: jsonb("allergen_flags").$type<string[]>().default(sql`'[]'::jsonb`).notNull(),
    signature: varchar("signature", { length: 256 }).notNull(),
    signatureHash: varchar("signature_hash", { length: 64 }).notNull(),
    variants: jsonb("variants").$type<string[]>().default(sql`'[]'::jsonb`).notNull(),
    provenance: jsonb("provenance").$type<{ source: string; page?: string; url?: string }[]>().default(sql`'[]'::jsonb`).notNull(),
    createdAt: timestamp("created_at").defaultNow(),
  },
  (t) => ({
    uniqPerIngredient: uniqueIndex("uniq_sub_signature_hash").on(t.ingredientId, t.signatureHash),
  })
);

/* ===== CUSTOM DRINKS ===== */
export const customDrinks = pgTable(
  "custom_drinks",
  {
    id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
    userId: varchar("user_id").references(() => users.id).notNull(),
    name: text("name").notNull(),
    category: text("category").notNull(),
    drinkType: text("drink_type"),

    ingredients: jsonb("ingredients").$type<
      Array<{
        name: string;
        category: string;
        calories: number;
        protein: number;
        carbs: number;
        fiber: number;
        icon: string;
      }>
    >().notNull(),

    calories: integer("calories").notNull(),
    protein: decimal("protein", { precision: 5, scale: 2 }).notNull(),
    carbs: decimal("carbs", { precision: 5, scale: 2 }).notNull(),
    fiber: decimal("fiber", { precision: 5, scale: 2 }).notNull(),
    fat: decimal("fat", { precision: 5, scale: 2 }).notNull(),

    description: text("description"),
    imageUrl: text("image_url"),
    fitnessGoal: text("fitness_goal"),
    difficulty: text("difficulty"),
    prepTime: integer("prep_time"),
    rating: integer("rating").default(5),

    isPublic: boolean("is_public").default(false),
    likesCount: integer("likes_count").default(0),
    savesCount: integer("saves_count").default(0),
    sharesCount: integer("shares_count").default(0),

    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => ({
    userIdx: index("custom_drinks_user_idx").on(table.userId),
    categoryIdx: index("custom_drinks_category_idx").on(table.category),
    publicIdx: index("custom_drinks_public_idx").on(table.isPublic),
  })
);

export const drinkPhotos = pgTable(
  "drink_photos",
  {
    id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
    drinkId: varchar("drink_id").references(() => customDrinks.id, { onDelete: "cascade" }).notNull(),
    userId: varchar("user_id").references(() => users.id).notNull(),
    imageUrl: text("image_url").notNull(),
    caption: text("caption"),
    likesCount: integer("likes_count").default(0),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => ({
    drinkIdx: index("drink_photos_drink_idx").on(table.drinkId),
    userIdx: index("drink_photos_user_idx").on(table.userId),
  })
);

export const drinkLikes = pgTable(
  "drink_likes",
  {
    id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
    userId: varchar("user_id").references(() => users.id).notNull(),
    drinkId: varchar("drink_id").references(() => customDrinks.id, { onDelete: "cascade" }).notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => ({
    userDrinkIdx: uniqueIndex("drink_likes_user_drink_idx").on(table.userId, table.drinkId),
  })
);

export const drinkSaves = pgTable(
  "drink_saves",
  {
    id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
    userId: varchar("user_id").references(() => users.id).notNull(),
    drinkId: varchar("drink_id").references(() => customDrinks.id, { onDelete: "cascade" }).notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => ({
    userDrinkIdx: uniqueIndex("drink_saves_user_drink_idx").on(table.userId, table.drinkId),
  })
);


export const drinkEvents = pgTable(
  "drink_events",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    slug: text("slug").notNull(),
    eventType: text("event_type").notNull(),
    userId: varchar("user_id").references(() => users.id),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => ({
    slugIdx: index("drink_events_slug_idx").on(table.slug),
    createdAtIdx: index("drink_events_created_at_idx").on(table.createdAt),
    eventTypeIdx: index("drink_events_event_type_idx").on(table.eventType),
    eventTypeCreatedAtIdx: index("drink_events_event_type_created_at_idx").on(table.eventType, table.createdAt),
    slugCreatedAtIdx: index("drink_events_slug_created_at_idx").on(table.slug, table.createdAt),
    slugEventTypeCreatedAtIdx: index("drink_events_slug_event_type_created_at_idx").on(table.slug, table.eventType, table.createdAt),
  })
);

export const petFoodEvents = pgTable(
  "pet_food_events",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    slug: text("slug").notNull(),
    eventType: text("event_type").notNull(),
    userId: varchar("user_id").references(() => users.id),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => ({
    slugIdx: index("pet_food_events_slug_idx").on(table.slug),
    createdAtIdx: index("pet_food_events_created_at_idx").on(table.createdAt),
    eventTypeIdx: index("pet_food_events_event_type_idx").on(table.eventType),
  })
);

export const drinkRecipes = pgTable(
  "drink_recipes",
  {
    id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
    slug: varchar("slug", { length: 200 }).notNull().unique(),
    name: text("name").notNull(),
    description: text("description"),
    ingredients: jsonb("ingredients").$type<string[]>().default(sql`'[]'::jsonb`).notNull(),
    instructions: jsonb("instructions").$type<string[]>().default(sql`'[]'::jsonb`).notNull(),
    glassware: text("glassware"),
    method: text("method"),
    prepTime: integer("prep_time"),
    servingSize: text("serving_size"),
    difficulty: text("difficulty"),
    spiritType: text("spirit_type"),
    abv: text("abv"),
    image: text("image"),
    category: text("category").notNull(),
    subcategory: text("subcategory"),
    remixedFromSlug: varchar("remixed_from_slug", { length: 200 }),
    challengeSlug: varchar("challenge_slug", { length: 200 }),
    userId: varchar("user_id").references(() => users.id),
    source: varchar("source", { length: 50 }).notNull().default("chefsire"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => ({
    slugIdx: uniqueIndex("drink_recipes_slug_idx").on(table.slug),
    categoryIdx: index("drink_recipes_category_idx").on(table.category),
    remixedFromSlugIdx: index("drink_recipes_remixed_from_slug_idx").on(table.remixedFromSlug),
    challengeSlugIdx: index("drink_recipes_challenge_slug_idx").on(table.challengeSlug),
    sourceIdx: index("drink_recipes_source_idx").on(table.source),
    userIdx: index("drink_recipes_user_idx").on(table.userId),
    userCreatedAtIdx: index("drink_recipes_user_created_at_idx").on(table.userId, table.createdAt),
    remixedFromSlugCreatedAtIdx: index("drink_recipes_remixed_from_slug_created_at_idx").on(table.remixedFromSlug, table.createdAt),
  })
);

export const drinkChallenges = pgTable(
  "drink_challenges",
  {
    id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
    slug: varchar("slug", { length: 200 }).notNull().unique(),
    title: text("title").notNull(),
    description: text("description").notNull(),
    theme: text("theme"),
    originalDrinkSlug: varchar("original_drink_slug", { length: 200 }),
    challengeType: text("challenge_type"),
    startsAt: timestamp("starts_at").notNull(),
    endsAt: timestamp("ends_at").notNull(),
    isActive: boolean("is_active").default(true).notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => ({
    slugIdx: uniqueIndex("drink_challenges_slug_idx").on(table.slug),
    activeIdx: index("drink_challenges_active_idx").on(table.isActive),
    startsAtIdx: index("drink_challenges_starts_at_idx").on(table.startsAt),
    endsAtIdx: index("drink_challenges_ends_at_idx").on(table.endsAt),
    originalDrinkSlugIdx: index("drink_challenges_original_drink_slug_idx").on(table.originalDrinkSlug),
  })
);

export const {
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
} = defineCreatorSchema({
  users,
  drinkChallenges,
});

export const drinkBundles = pgTable(
  "drink_bundles",
  {
    id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
    userId: varchar("user_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
    slug: varchar("slug", { length: 200 }).notNull().unique(),
    name: varchar("name", { length: 160 }).notNull(),
    description: text("description"),
    isPublic: boolean("is_public").default(false).notNull(),
    isPremium: boolean("is_premium").default(true).notNull(),
    priceCents: integer("price_cents").default(0).notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => ({
    userIdx: index("drink_bundles_user_idx").on(table.userId),
    slugIdx: uniqueIndex("drink_bundles_slug_idx").on(table.slug),
    publicIdx: index("drink_bundles_public_idx").on(table.isPublic),
    userUpdatedAtIdx: index("drink_bundles_user_updated_at_idx").on(table.userId, table.updatedAt),
  })
);

export const drinkBundleItems = pgTable(
  "drink_bundle_items",
  {
    bundleId: varchar("bundle_id")
      .references(() => drinkBundles.id, { onDelete: "cascade" })
      .notNull(),
    collectionId: varchar("collection_id")
      .references(() => drinkCollections.id, { onDelete: "cascade" })
      .notNull(),
    addedAt: timestamp("added_at").defaultNow().notNull(),
    sortOrder: integer("sort_order").default(0).notNull(),
  },
  (table) => ({
    bundleCollectionIdx: uniqueIndex("drink_bundle_items_bundle_collection_idx").on(table.bundleId, table.collectionId),
    collectionIdx: index("drink_bundle_items_collection_idx").on(table.collectionId),
    sortOrderIdx: index("drink_bundle_items_bundle_sort_order_idx").on(table.bundleId, table.sortOrder),
  })
);

export const drinkBundlePurchases = pgTable(
  "drink_bundle_purchases",
  {
    id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
    userId: varchar("user_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
    bundleId: varchar("bundle_id").references(() => drinkBundles.id, { onDelete: "cascade" }).notNull(),
    status: text("status").default("completed").notNull(),
    statusReason: text("status_reason"),
    accessRevokedAt: timestamp("access_revoked_at"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => ({
    userIdx: index("drink_bundle_purchases_user_idx").on(table.userId),
    bundleIdx: index("drink_bundle_purchases_bundle_idx").on(table.bundleId),
    uniqueOwnershipIdx: uniqueIndex("drink_bundle_purchases_user_bundle_idx").on(table.userId, table.bundleId),
  })
);

export const drinkBundleCheckoutSessions = pgTable(
  "drink_bundle_checkout_sessions",
  {
    id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
    userId: varchar("user_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
    bundleId: varchar("bundle_id").references(() => drinkBundles.id, { onDelete: "cascade" }).notNull(),
    provider: text("provider").default("square").notNull(),
    purchaseType: text("purchase_type").default("self").notNull(),
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
    refundedAt: timestamp("refunded_at"),
    accessRevokedAt: timestamp("access_revoked_at"),
    failureReason: text("failure_reason"),
    expiresAt: timestamp("expires_at"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => ({
    userIdx: index("drink_bundle_checkout_sessions_user_idx").on(table.userId),
    bundleIdx: index("drink_bundle_checkout_sessions_bundle_idx").on(table.bundleId),
    statusIdx: index("drink_bundle_checkout_sessions_status_idx").on(table.status),
    paymentLinkIdx: uniqueIndex("drink_bundle_checkout_sessions_payment_link_idx").on(table.squarePaymentLinkId),
    orderIdx: uniqueIndex("drink_bundle_checkout_sessions_order_idx").on(table.squareOrderId),
  })
);

export const drinkBundleSquareWebhookEvents = pgTable(
  "drink_bundle_square_webhook_events",
  {
    id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
    eventId: text("event_id").notNull().unique(),
    eventType: text("event_type").notNull(),
    objectType: text("object_type"),
    objectId: text("object_id"),
    checkoutSessionId: varchar("checkout_session_id").references(() => drinkBundleCheckoutSessions.id, { onDelete: "set null" }),
    status: text("status").default("processed").notNull(),
    receivedAt: timestamp("received_at").defaultNow().notNull(),
    createdAt: timestamp("created_at"),
  },
  (table) => ({
    objectIdx: index("drink_bundle_square_webhook_events_object_idx").on(table.objectType, table.objectId),
    checkoutSessionIdx: index("drink_bundle_square_webhook_events_checkout_session_idx").on(table.checkoutSessionId),
  })
);

export const drinkChallengeSubmissions = pgTable(
  "drink_challenge_submissions",
  {
    id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
    challengeId: varchar("challenge_id").references(() => drinkChallenges.id, { onDelete: "cascade" }).notNull(),
    userId: varchar("user_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
    drinkSlug: varchar("drink_slug", { length: 200 }).notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => ({
    challengeIdx: index("drink_challenge_submissions_challenge_idx").on(table.challengeId),
    userIdx: index("drink_challenge_submissions_user_idx").on(table.userId),
    drinkSlugIdx: index("drink_challenge_submissions_drink_slug_idx").on(table.drinkSlug),
    uniqueEntryIdx: uniqueIndex("drink_challenge_submissions_unique_entry_idx").on(table.challengeId, table.userId, table.drinkSlug),
  })
);

export const recipeSaves = pgTable(
  "recipe_saves",
  {
    id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
    userId: varchar("user_id").references(() => users.id).notNull(),
    recipeId: varchar("recipe_id").references(() => recipes.id, { onDelete: "cascade" }).notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => ({
    userRecipeIdx: uniqueIndex("recipe_saves_user_recipe_idx").on(table.userId, table.recipeId),
  })
);

export const userDrinkStats = pgTable("user_drink_stats", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id).notNull().unique(),
  totalDrinksMade: integer("total_drinks_made").default(0),
  totalPoints: integer("total_points").default(0),
  level: integer("level").default(1),
  currentStreak: integer("current_streak").default(0),
  longestStreak: integer("longest_streak").default(0),
  lastDrinkDate: timestamp("last_drink_date"),
  smoothiesMade: integer("smoothies_made").default(0),
  proteinShakesMade: integer("protein_shakes_made").default(0),
  detoxesMade: integer("detoxes_made").default(0),
  cocktailsMade: integer("cocktails_made").default(0),
  badges: jsonb("badges").$type<string[]>().default(sql`'[]'::jsonb`),
  achievements: jsonb("achievements").$type<
    Array<{
      id: string;
      name: string;
      earnedAt: string;
    }>
  >().default(sql`'[]'::jsonb`),
  activeCleanseProgramIds: jsonb("active_cleanse_programs").$type<string[]>().default(sql`'[]'::jsonb`),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});
