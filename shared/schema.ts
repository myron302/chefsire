import { sql } from "drizzle-orm";
import {
  pgTable,
  text,
  varchar,
  integer,
  boolean,
  timestamp,
  jsonb,
  decimal,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

/* =========================================================================
   ===== EXISTING TABLES (unchanged)
   ========================================================================= */
export const users = pgTable(
  "users",
  {
    id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
    username: text("username").notNull().unique(),
    email: text("email").notNull().unique(),
    password: text("password").notNull(),
    displayName: text("display_name").notNull(),
    firstName: text("first_name"),
    lastName: text("last_name"),
    royalTitle: text("royal_title"),
    showFullName: boolean("show_full_name").default(false),
    bio: text("bio"),
    avatar: text("avatar"),
    specialty: text("specialty"),
    isChef: boolean("is_chef").default(false),
    followersCount: integer("followers_count").default(0),
    followingCount: integer("following_count").default(0),
    postsCount: integer("posts_count").default(0),
    cateringEnabled: boolean("catering_enabled").default(false),
    cateringLocation: text("catering_location"),
    cateringRadius: integer("catering_radius").default(25),
    cateringBio: text("catering_bio"),
    cateringAvailable: boolean("catering_available").default(true),
    subscriptionTier: text("subscription_tier").default("free"),
    subscriptionStatus: text("subscription_status").default("active"),
    subscriptionEndsAt: timestamp("subscription_ends_at"),
    monthlyRevenue: decimal("monthly_revenue", { precision: 10, scale: 2 }).default("0"),
    nutritionPremium: boolean("nutrition_premium").default(false),
    nutritionTrialEndsAt: timestamp("nutrition_trial_ends_at"),
    dailyCalorieGoal: integer("daily_calorie_goal"),
    macroGoals: jsonb("macro_goals").$type<{ protein: number; carbs: number; fat: number }>(),
    dietaryRestrictions: jsonb("dietary_restrictions").$type<string[]>().default(sql`'[]'::jsonb`),

    // ✅ NEW: will be set upon clicking verification link
    emailVerifiedAt: timestamp("email_verified_at"),

    createdAt: timestamp("created_at").defaultNow(),
  },
  (table) => ({
    cateringLocationIdx: index("catering_location_idx").on(table.cateringLocation),
    subscriptionTierIdx: index("subscription_tier_idx").on(table.subscriptionTier),
  })
);

export const posts = pgTable("posts", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id).notNull(),
  caption: text("caption"),
  imageUrl: text("image_url").notNull(),
  tags: jsonb("tags").$type<string[]>().default(sql`'[]'::jsonb`),
  likesCount: integer("likes_count").default(0),
  commentsCount: integer("comments_count").default(0),
  isRecipe: boolean("is_recipe").default(false),
  createdAt: timestamp("created_at").defaultNow(),
});

export const recipes = pgTable("recipes", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  postId: varchar("post_id").references(() => posts.id),
  title: text("title").notNull(),
  imageUrl: text("image_url"),
  ingredients: jsonb("ingredients").$type<string[]>().notNull(),
  instructions: jsonb("instructions").$type<string[]>().notNull(),
  cookTime: integer("cook_time"),
  servings: integer("servings"),
  difficulty: text("difficulty"),
  nutrition: jsonb("nutrition").$type<Record<string, any>>(),
  calories: integer("calories"),
  protein: decimal("protein", { precision: 5, scale: 2 }),
  carbs: decimal("carbs", { precision: 5, scale: 2 }),
  fat: decimal("fat", { precision: 5, scale: 2 }),
  fiber: decimal("fiber", { precision: 5, scale: 2 }),
});

export const stories = pgTable("stories", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id).notNull(),
  imageUrl: text("image_url").notNull(),
  caption: text("caption"),
  expiresAt: timestamp("expires_at").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const likes = pgTable("likes", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id).notNull(),
  postId: varchar("post_id").references(() => posts.id).notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const comments = pgTable("comments", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id).notNull(),
  postId: varchar("post_id").references(() => posts.id).notNull(),
  content: text("content").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const follows = pgTable("follows", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  followerId: varchar("follower_id").references(() => users.id).notNull(),
  followingId: varchar("following_id").references(() => users.id).notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

/* ===== CATERING ===== */
export const cateringInquiries = pgTable("catering_inquiries", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  customerId: varchar("customer_id").references(() => users.id).notNull(),
  chefId: varchar("chef_id").references(() => users.id).notNull(),
  eventDate: timestamp("event_date").notNull(),
  guestCount: integer("guest_count"),
  eventType: text("event_type"),
  cuisinePreferences: jsonb("cuisine_preferences").$type<string[]>().default(sql`'[]'::jsonb`),
  budget: decimal("budget", { precision: 10, scale: 2 }),
  message: text("message"),
  status: text("status").default("pending"),
  createdAt: timestamp("created_at").defaultNow(),
});

/* ===== MARKETPLACE ===== */
export const products = pgTable(
  "products",
  {
    id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
    sellerId: varchar("seller_id").references(() => users.id).notNull(),
    name: text("name").notNull(),
    description: text("description"),
    price: decimal("price", { precision: 10, scale: 2 }).notNull(),
    category: text("category").notNull(),
    images: jsonb("images").$type<string[]>().default(sql`'[]'::jsonb`),
    inventory: integer("inventory").default(0),
    shippingEnabled: boolean("shipping_enabled").default(true),
    localPickupEnabled: boolean("local_pickup_enabled").default(false),
    pickupLocation: text("pickup_location"),
    pickupInstructions: text("pickup_instructions"),
    shippingCost: decimal("shipping_cost", { precision: 8, scale: 2 }),
    isExternal: boolean("is_external").default(false),
    externalUrl: text("external_url"),
    salesCount: integer("sales_count").default(0),
    viewsCount: integer("views_count").default(0),
    isActive: boolean("is_active").default(true),
    createdAt: timestamp("created_at").defaultNow(),
  },
  (table) => ({
    categoryIdx: index("products_category_idx").on(table.category),
    sellerIdx: index("products_seller_idx").on(table.sellerId),
    pickupLocationIdx: index("products_pickup_location_idx").on(table.pickupLocation),
  })
);

export const orders = pgTable(
  "orders",
  {
    id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
    buyerId: varchar("buyer_id").references(() => users.id).notNull(),
    sellerId: varchar("seller_id").references(() => users.id).notNull(),
    productId: varchar("product_id").references(() => products.id).notNull(),
    quantity: integer("quantity").notNull(),
    totalAmount: decimal("total_amount", { precision: 10, scale: 2 }).notNull(),
    platformFee: decimal("platform_fee", { precision: 8, scale: 2 }).notNull(),
    sellerAmount: decimal("seller_amount", { precision: 10, scale: 2 }).notNull(),
    shippingAddress: jsonb("shipping_address").$type<{
      street: string;
      city: string;
      state: string;
      zipCode: string;
      country: string;
    }>(),
    fulfillmentMethod: text("fulfillment_method").notNull(),
    status: text("status").default("pending"),
    trackingNumber: text("tracking_number"),
    createdAt: timestamp("created_at").defaultNow(),
  },
  (table) => ({
    buyerIdx: index("orders_buyer_idx").on(table.buyerId),
    sellerIdx: index("orders_seller_idx").on(table.sellerId),
    statusIdx: index("orders_status_idx").on(table.status),
  })
);

/* ===== SUBSCRIPTION ===== */
export const subscriptionHistory = pgTable("subscription_history", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id).notNull(),
  tier: text("tier").notNull(),
  amount: decimal("amount", { precision: 8, scale: 2 }).notNull(),
  startDate: timestamp("start_date").notNull(),
  endDate: timestamp("end_date").notNull(),
  status: text("status").notNull(),
  paymentMethod: text("payment_method"),
  createdAt: timestamp("created_at").defaultNow(),
});

/* ===== MEAL PLANNING ===== */
export const mealPlans = pgTable("meal_plans", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id).notNull(),
  name: text("name").notNull(),
  startDate: timestamp("start_date").notNull(),
  endDate: timestamp("end_date").notNull(),
  isTemplate: boolean("is_template").default(false),
  createdAt: timestamp("created_at").defaultNow(),
});

export const mealPlanEntries = pgTable("meal_plan_entries", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  mealPlanId: varchar("meal_plan_id").references(() => mealPlans.id).notNull(),
  recipeId: varchar("recipe_id").references(() => recipes.id),
  date: timestamp("date").notNull(),
  mealType: text("meal_type").notNull(),
  servings: integer("servings").default(1),
  customName: text("custom_name"),
  customCalories: integer("custom_calories"),
});

/* ===== PANTRY ===== */
export const pantryItems = pgTable(
  "pantry_items",
  {
    id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
    userId: varchar("user_id").references(() => users.id).notNull(),
    name: text("name").notNull(),
    category: text("category"),
    quantity: decimal("quantity", { precision: 8, scale: 2 }),
    unit: text("unit"),
    expirationDate: timestamp("expiration_date"),
    purchaseDate: timestamp("purchase_date"),
    notes: text("notes"),
    createdAt: timestamp("created_at").defaultNow(),
  },
  (table) => ({
    userIdx: index("pantry_user_idx").on(table.userId),
    expirationIdx: index("pantry_expiration_idx").on(table.expirationDate),
  })
);

/* ===== NUTRITION LOGS ===== */
export const nutritionLogs = pgTable(
  "nutrition_logs",
  {
    id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
    userId: varchar("user_id").references(() => users.id).notNull(),
    date: timestamp("date").notNull(),
    mealType: text("meal_type").notNull(),
    recipeId: varchar("recipe_id").references(() => recipes.id),
    customFoodName: text("custom_food_name"),
    servings: decimal("servings", { precision: 5, scale: 2 }).default("1"),
    calories: integer("calories").notNull(),
    protein: decimal("protein", { precision: 5, scale: 2 }),
    carbs: decimal("carbs", { precision: 5, scale: 2 }),
    fat: decimal("fat", { precision: 5, scale: 2 }),
    fiber: decimal("fiber", { precision: 5, scale: 2 }),
    sodium: decimal("sodium", { precision: 8, scale: 2 }),
    sugar: decimal("sugar", { precision: 5, scale: 2 }),
    imageUrl: text("image_url"),
    recognitionConfidence: decimal("recognition_confidence", { precision: 3, scale: 2 }),
    createdAt: timestamp("created_at").defaultNow(),
  },
  (table) => ({
    userDateIdx: index("nutrition_user_date_idx").on(table.userId, table.date),
  })
);

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
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

/* ===== STORES TABLE ===== */
export const stores = pgTable(
  "stores",
  {
    id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
    userId: varchar("user_id")
      .references(() => users.id)
      .notNull()
      .unique(),
    handle: text("handle").notNull().unique(),
    name: text("name").notNull(),
    bio: text("bio"),
    theme: jsonb("theme").$type<Record<string, any>>().default(sql`'{}'::jsonb`),
    layout: jsonb("layout").$type<Record<string, any>>(),
    published: boolean("published").default(false),
    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow(),
  },
  (t) => ({
    handleIdx: index("stores_handle_idx").on(t.handle),
    userIdIdx: index("stores_user_id_idx").on(t.userId),
    publishedIdx: index("stores_published_idx").on(t.published),
  })
);

/* ===== ✅ NEW: EMAIL VERIFICATION TOKENS ===== */
export const emailVerificationTokens = pgTable(
  "email_verification_tokens",
  {
    // keep consistent with your string UUID style
    id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),

    // references users.id (varchar UUID)
    userId: varchar("user_id").references(() => users.id).notNull(),

    // SHA-256 hex string (64 chars)
    tokenHash: varchar("token_hash", { length: 64 }).notNull(),

    // email being verified
    email: varchar("email", { length: 255 }).notNull(),

    // 30 minute default expiry
    expiresAt: timestamp("expires_at").notNull().default(sql`now() + interval '30 minutes'`),

    // set once used
    consumedAt: timestamp("consumed_at"),

    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => ({
    userIdx: index("evt_user_idx").on(t.userId),
    tokenIdx: index("evt_token_hash_idx").on(t.tokenHash),
  })
);

/* =========================================================================
   ===== INSERT SCHEMAS
   ========================================================================= */
export const insertUserSchema = createInsertSchema(users).omit({
  id: true,
  followersCount: true,
  followingCount: true,
  postsCount: true,
  monthlyRevenue: true,
  createdAt: true,

  // ✅ Don’t require this on insert
  emailVerifiedAt: true,
});

export const insertPostSchema = createInsertSchema(posts).omit({
  id: true,
  likesCount: true,
  commentsCount: true,
  createdAt: true,
});

export const insertRecipeSchema = createInsertSchema(recipes).omit({
  id: true,
});

export const insertStorySchema = createInsertSchema(stories).omit({
  id: true,
  createdAt: true,
});

export const insertLikeSchema = createInsertSchema(likes).omit({
  id: true,
  createdAt: true,
});

export const insertCommentSchema = createInsertSchema(comments).omit({
  id: true,
  createdAt: true,
});

export const insertFollowSchema = createInsertSchema(follows).omit({
  id: true,
  createdAt: true,
});

export const insertCateringInquirySchema = createInsertSchema(cateringInquiries).omit({
  id: true,
  createdAt: true,
});

export const insertProductSchema = createInsertSchema(products).omit({
  id: true,
  salesCount: true,
  viewsCount: true,
  createdAt: true,
});

export const insertOrderSchema = createInsertSchema(orders).omit({
  id: true,
  createdAt: true,
});

export const insertSubscriptionHistorySchema = createInsertSchema(subscriptionHistory).omit({
  id: true,
  createdAt: true,
});

export const insertMealPlanSchema = createInsertSchema(mealPlans).omit({
  id: true,
  createdAt: true,
});

export const insertMealPlanEntrySchema = createInsertSchema(mealPlanEntries).omit({
  id: true,
});

export const insertPantryItemSchema = createInsertSchema(pantryItems).omit({
  id: true,
  createdAt: true,
});

export const insertNutritionLogSchema = createInsertSchema(nutritionLogs).omit({
  id: true,
  createdAt: true,
});

export const insertCustomDrinkSchema = createInsertSchema(customDrinks).omit({
  id: true,
  likesCount: true,
  savesCount: true,
  sharesCount: true,
  createdAt: true,
  updatedAt: true,
});

export const insertDrinkPhotoSchema = createInsertSchema(drinkPhotos).omit({
  id: true,
  likesCount: true,
  createdAt: true,
});

export const insertDrinkLikeSchema = createInsertSchema(drinkLikes).omit({
  id: true,
  createdAt: true,
});

export const insertDrinkSaveSchema = createInsertSchema(drinkSaves).omit({
  id: true,
  createdAt: true,
});

export const insertUserDrinkStatsSchema = createInsertSchema(userDrinkStats).omit({
  id: true,
  updatedAt: true,
});

export const insertStoreSchema = createInsertSchema(stores).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

/* ===== NEW PANTRY SCHEMAS ===== */
export const insertBarcodeLookupSchema = createInsertSchema(barcodeLookup).omit({
  id: true,
  scannedCount: true,
  lastScannedAt: true,
  createdAt: true,
});

export const insertHouseholdSchema = createInsertSchema(households).omit({
  id: true,
  inviteCode: true,
  createdAt: true,
});

export const insertHouseholdMemberSchema = createInsertSchema(householdMembers).omit({
  id: true,
  joinedAt: true,
});

export const insertPantryItemEnhancedSchema = createInsertSchema(pantryItemsEnhanced).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertRecipeMatchSchema = createInsertSchema(recipeMatches).omit({
  id: true,
  calculatedAt: true,
});

export const insertExpiryReminderSchema = createInsertSchema(expiryReminders).omit({
  id: true,
  createdAt: true,
});

/* ===== NEW ALLERGY SCHEMAS ===== */
export const insertFamilyMemberSchema = createInsertSchema(familyMembers).omit({
  id: true,
  createdAt: true,
});

export const insertAllergenProfileSchema = createInsertSchema(allergenProfiles).omit({
  id: true,
  createdAt: true,
});

export const insertRecipeAllergenSchema = createInsertSchema(recipeAllergens).omit({
  id: true,
  createdAt: true,
});

export const insertUserSubstitutionPreferenceSchema = createInsertSchema(userSubstitutionPreferences).omit({
  id: true,
  usedCount: true,
  lastUsedAt: true,
  createdAt: true,
});

export const insertProductAllergenSchema = createInsertSchema(productAllergens).omit({
  id: true,
  verifiedAt: true,
  createdAt: true,
});

/* ===== NEW MARKETPLACE SCHEMAS ===== */
export const insertMealPlanBlueprintSchema = createInsertSchema(mealPlanBlueprints).omit({
  id: true,
  salesCount: true,
  viewsCount: true,
  reviewsCount: true,
  currentVersion: true,
  createdAt: true,
  updatedAt: true,
});

export const insertBlueprintVersionSchema = createInsertSchema(blueprintVersions).omit({
  id: true,
  createdAt: true,
});

export const insertMealPlanPurchaseSchema = createInsertSchema(mealPlanPurchases).omit({
  id: true,
  downloadCount: true,
  createdAt: true,
});

export const insertMealPlanReviewSchema = createInsertSchema(mealPlanReviews).omit({
  id: true,
  helpfulCount: true,
  createdAt: true,
  updatedAt: true,
});

export const insertCreatorAnalyticsSchema = createInsertSchema(creatorAnalytics).omit({
  id: true,
  updatedAt: true,
});

/* ===== NEW CLUBS SCHEMAS ===== */
export const insertClubSchema = createInsertSchema(clubs).omit({
  id: true,
  memberCount: true,
  postCount: true,
  createdAt: true,
  updatedAt: true,
});

export const insertClubMembershipSchema = createInsertSchema(clubMemberships).omit({
  id: true,
  joinedAt: true,
});

export const insertClubPostSchema = createInsertSchema(clubPosts).omit({
  id: true,
  likesCount: true,
  commentsCount: true,
  createdAt: true,
  updatedAt: true,
});

export const insertChallengeSchema = createInsertSchema(challenges).omit({
  id: true,
  participantCount: true,
  completionCount: true,
  createdAt: true,
});

export const insertChallengeProgressSchema = createInsertSchema(challengeProgress).omit({
  id: true,
  startedAt: true,
  lastActivityAt: true,
});

export const insertBadgeSchema = createInsertSchema(badges).omit({
  id: true,
  createdAt: true,
});

export const insertUserBadgeSchema = createInsertSchema(userBadges).omit({
  id: true,
  earnedAt: true,
});

/* =========================================================================
   ===== TYPES
   ========================================================================= */
export type User = typeof users.$inferSelect;
export type InsertUser = z.infer<typeof insertUserSchema>;
export type Post = typeof posts.$inferSelect;
export type InsertPost = z.infer<typeof insertPostSchema>;
export type Recipe = typeof recipes.$inferSelect;
export type InsertRecipe = z.infer<typeof insertRecipeSchema>;
export type Story = typeof stories.$inferSelect;
export type InsertStory = z.infer<typeof insertStorySchema>;
export type Like = typeof likes.$inferSelect;
export type InsertLike = z.infer<typeof insertLikeSchema>;
export type Comment = typeof comments.$inferSelect;
export type InsertComment = z.infer<typeof insertCommentSchema>;
export type Follow = typeof follows.$inferSelect;
export type InsertFollow = z.infer<typeof insertFollowSchema>;
export type CateringInquiry = typeof cateringInquiries.$inferSelect;
export type InsertCateringInquiry = z.infer<typeof insertCateringInquirySchema>;
export type Product = typeof products.$inferSelect;
export type InsertProduct = z.infer<typeof insertProductSchema>;
export type Order = typeof orders.$inferSelect;
export type InsertOrder = z.infer<typeof insertOrderSchema>;
export type SubscriptionHistory = typeof subscriptionHistory.$inferSelect;
export type InsertSubscriptionHistory = z.infer<typeof insertSubscriptionHistorySchema>;
export type MealPlan = typeof mealPlans.$inferSelect;
export type InsertMealPlan = z.infer<typeof insertMealPlanSchema>;
export type MealPlanEntry = typeof mealPlanEntries.$inferSelect;
export type InsertMealPlanEntry = z.infer<typeof insertMealPlanEntrySchema>;
export type PantryItem = typeof pantryItems.$inferSelect;
export type InsertPantryItem = z.infer<typeof insertPantryItemSchema>;
export type NutritionLog = typeof nutritionLogs.$inferSelect;
export type InsertNutritionLog = z.infer<typeof insertNutritionLogSchema>;
export type CustomDrink = typeof customDrinks.$inferSelect;
export type InsertCustomDrink = z.infer<typeof insertCustomDrinkSchema>;
export type DrinkPhoto = typeof drinkPhotos.$inferSelect;
export type InsertDrinkPhoto = z.infer<typeof insertDrinkPhotoSchema>;
export type DrinkLike = typeof drinkLikes.$inferSelect;
export type InsertDrinkLike = z.infer<typeof insertDrinkLikeSchema>;
export type DrinkSave = typeof drinkSaves.$inferSelect;
export type InsertDrinkSave = z.infer<typeof insertDrinkSaveSchema>;
export type UserDrinkStats = typeof userDrinkStats.$inferSelect;
export type InsertUserDrinkStats = z.infer<typeof insertUserDrinkStatsSchema>;
export type Store = typeof stores.$inferSelect;
export type InsertStore = z.infer<typeof insertStoreSchema>;

/* ===== NEW TYPE ===== */
export type EmailVerificationToken = typeof emailVerificationTokens.$inferSelect;

/* ===== PANTRY 2.0 TYPES ===== */
export type BarcodeLookup = typeof barcodeLookup.$inferSelect;
export type InsertBarcodeLookup = z.infer<typeof insertBarcodeLookupSchema>;
export type Household = typeof households.$inferSelect;
export type InsertHousehold = z.infer<typeof insertHouseholdSchema>;
export type HouseholdMember = typeof householdMembers.$inferSelect;
export type InsertHouseholdMember = z.infer<typeof insertHouseholdMemberSchema>;
export type PantryItemEnhanced = typeof pantryItemsEnhanced.$inferSelect;
export type InsertPantryItemEnhanced = z.infer<typeof insertPantryItemEnhancedSchema>;
export type RecipeMatch = typeof recipeMatches.$inferSelect;
export type InsertRecipeMatch = z.infer<typeof insertRecipeMatchSchema>;
export type ExpiryReminder = typeof expiryReminders.$inferSelect;
export type InsertExpiryReminder = z.infer<typeof insertExpiryReminderSchema>;

/* ===== ALLERGY TYPES ===== */
export type FamilyMember = typeof familyMembers.$inferSelect;
export type InsertFamilyMember = z.infer<typeof insertFamilyMemberSchema>;
export type AllergenProfile = typeof allergenProfiles.$inferSelect;
export type InsertAllergenProfile = z.infer<typeof insertAllergenProfileSchema>;
export type RecipeAllergen = typeof recipeAllergens.$inferSelect;
export type InsertRecipeAllergen = z.infer<typeof insertRecipeAllergenSchema>;
export type UserSubstitutionPreference = typeof userSubstitutionPreferences.$inferSelect;
export type InsertUserSubstitutionPreference = z.infer<typeof insertUserSubstitutionPreferenceSchema>;
export type ProductAllergen = typeof productAllergens.$inferSelect;
export type InsertProductAllergen = z.infer<typeof insertProductAllergenSchema>;

/* ===== MARKETPLACE TYPES ===== */
export type MealPlanBlueprint = typeof mealPlanBlueprints.$inferSelect;
export type InsertMealPlanBlueprint = z.infer<typeof insertMealPlanBlueprintSchema>;
export type BlueprintVersion = typeof blueprintVersions.$inferSelect;
export type InsertBlueprintVersion = z.infer<typeof insertBlueprintVersionSchema>;
export type MealPlanPurchase = typeof mealPlanPurchases.$inferSelect;
export type InsertMealPlanPurchase = z.infer<typeof insertMealPlanPurchaseSchema>;
export type MealPlanReview = typeof mealPlanReviews.$inferSelect;
export type InsertMealPlanReview = z.infer<typeof insertMealPlanReviewSchema>;
export type CreatorAnalytics = typeof creatorAnalytics.$inferSelect;
export type InsertCreatorAnalytics = z.infer<typeof insertCreatorAnalyticsSchema>;

/* ===== CLUBS & CHALLENGES TYPES ===== */
export type Club = typeof clubs.$inferSelect;
export type InsertClub = z.infer<typeof insertClubSchema>;
export type ClubMembership = typeof clubMemberships.$inferSelect;
export type InsertClubMembership = z.infer<typeof insertClubMembershipSchema>;
export type ClubPost = typeof clubPosts.$inferSelect;
export type InsertClubPost = z.infer<typeof insertClubPostSchema>;
export type Challenge = typeof challenges.$inferSelect;
export type InsertChallenge = z.infer<typeof insertChallengeSchema>;
export type ChallengeProgress = typeof challengeProgress.$inferSelect;
export type InsertChallengeProgress = z.infer<typeof insertChallengeProgressSchema>;
export type Badge = typeof badges.$inferSelect;
export type InsertBadge = z.infer<typeof insertBadgeSchema>;
export type UserBadge = typeof userBadges.$inferSelect;
export type InsertUserBadge = z.infer<typeof insertUserBadgeSchema>;

/* =========================================================================
   ===== PANTRY TRACKER 2.0 (Enhanced)
   ========================================================================= */

// Barcode cache for faster scanning
export const barcodeLookup = pgTable(
  "barcode_lookup",
  {
    id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
    barcode: varchar("barcode", { length: 50 }).notNull().unique(),
    productName: text("product_name").notNull(),
    brand: text("brand"),
    category: text("category"),
    defaultUnit: text("default_unit"),
    averageShelfLife: integer("average_shelf_life"), // days
    commonAllergens: jsonb("common_allergens").$type<string[]>().default(sql`'[]'::jsonb`),
    imageUrl: text("image_url"),
    nutritionPer100g: jsonb("nutrition_per_100g").$type<{
      calories?: number;
      protein?: number;
      carbs?: number;
      fat?: number;
      fiber?: number;
    }>(),
    scannedCount: integer("scanned_count").default(1),
    lastScannedAt: timestamp("last_scanned_at").defaultNow(),
    createdAt: timestamp("created_at").defaultNow(),
  },
  (table) => ({
    barcodeIdx: index("barcode_idx").on(table.barcode),
  })
);

// Household pantries (shared with family)
export const households = pgTable("households", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  ownerId: varchar("owner_id").references(() => users.id).notNull(),
  inviteCode: varchar("invite_code", { length: 8 }).notNull().unique(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const householdMembers = pgTable(
  "household_members",
  {
    id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
    householdId: varchar("household_id").references(() => households.id, { onDelete: "cascade" }).notNull(),
    userId: varchar("user_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
    role: text("role").notNull().default("member"), // owner, admin, member
    joinedAt: timestamp("joined_at").defaultNow(),
  },
  (table) => ({
    householdUserIdx: uniqueIndex("household_user_idx").on(table.householdId, table.userId),
  })
);

// Enhanced pantry items (extends existing)
export const pantryItemsEnhanced = pgTable(
  "pantry_items_enhanced",
  {
    id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
    userId: varchar("user_id").references(() => users.id).notNull(),
    householdId: varchar("household_id").references(() => households.id),
    name: text("name").notNull(),
    barcode: varchar("barcode", { length: 50 }),
    category: text("category"),
    quantity: decimal("quantity", { precision: 8, scale: 2 }),
    unit: text("unit"),
    location: text("location"), // fridge, freezer, pantry, spice-rack
    expirationDate: timestamp("expiration_date"),
    purchaseDate: timestamp("purchase_date"),
    openedDate: timestamp("opened_date"),
    estimatedCost: decimal("estimated_cost", { precision: 8, scale: 2 }),
    store: text("store"),
    notes: text("notes"),
    imageUrl: text("image_url"),
    isRunningLow: boolean("is_running_low").default(false),
    reorderThreshold: decimal("reorder_threshold", { precision: 8, scale: 2 }),
    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow(),
  },
  (table) => ({
    userIdx: index("pantry_enhanced_user_idx").on(table.userId),
    householdIdx: index("pantry_enhanced_household_idx").on(table.householdId),
    expirationIdx: index("pantry_enhanced_expiration_idx").on(table.expirationDate),
    barcodeIdx: index("pantry_enhanced_barcode_idx").on(table.barcode),
  })
);

// Recipe match scores (cached)
export const recipeMatches = pgTable(
  "recipe_matches",
  {
    id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
    userId: varchar("user_id").references(() => users.id).notNull(),
    recipeId: varchar("recipe_id").references(() => recipes.id).notNull(),
    matchScore: decimal("match_score", { precision: 3, scale: 2 }).notNull(), // 0.00 to 1.00
    matchingIngredients: jsonb("matching_ingredients").$type<string[]>().default(sql`'[]'::jsonb`),
    missingIngredients: jsonb("missing_ingredients").$type<string[]>().default(sql`'[]'::jsonb`),
    calculatedAt: timestamp("calculated_at").defaultNow(),
  },
  (table) => ({
    userRecipeIdx: uniqueIndex("recipe_match_user_recipe_idx").on(table.userId, table.recipeId),
    scoreIdx: index("recipe_match_score_idx").on(table.matchScore),
  })
);

// Expiry reminders
export const expiryReminders = pgTable("expiry_reminders", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id).notNull(),
  pantryItemId: varchar("pantry_item_id").references(() => pantryItemsEnhanced.id, { onDelete: "cascade" }).notNull(),
  reminderDate: timestamp("reminder_date").notNull(),
  daysBefore: integer("days_before").notNull(), // 1, 3, 7
  status: text("status").notNull().default("pending"), // pending, sent, dismissed
  createdAt: timestamp("created_at").defaultNow(),
});

/* =========================================================================
   ===== ALLERGY PROFILES & SMART SUBSTITUTIONS
   ========================================================================= */

// Family member profiles (for tracking different dietary needs)
export const familyMembers = pgTable("family_members", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id).notNull(),
  name: text("name").notNull(),
  relationship: text("relationship"), // spouse, child, pet, self
  birthDate: timestamp("birth_date"),
  isPrimary: boolean("is_primary").default(false),
  avatarUrl: text("avatar_url"),
  createdAt: timestamp("created_at").defaultNow(),
});

// Allergen profiles
export const allergenProfiles = pgTable(
  "allergen_profiles",
  {
    id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
    userId: varchar("user_id").references(() => users.id).notNull(),
    familyMemberId: varchar("family_member_id").references(() => familyMembers.id, { onDelete: "cascade" }),
    allergen: text("allergen").notNull(), // peanuts, shellfish, dairy, gluten, etc.
    severity: text("severity").notNull(), // mild, moderate, severe, life-threatening
    reaction: text("reaction"), // hives, anaphylaxis, digestive, etc.
    diagnosedBy: text("diagnosed_by"), // doctor, self, vet
    notes: text("notes"),
    createdAt: timestamp("created_at").defaultNow(),
  },
  (table) => ({
    userIdx: index("allergen_user_idx").on(table.userId),
    familyMemberIdx: index("allergen_family_member_idx").on(table.familyMemberId),
    allergenIdx: index("allergen_type_idx").on(table.allergen),
  })
);

// Recipe allergen flags (extend existing recipes)
export const recipeAllergens = pgTable(
  "recipe_allergens",
  {
    id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
    recipeId: varchar("recipe_id").references(() => recipes.id, { onDelete: "cascade" }).notNull(),
    allergen: text("allergen").notNull(),
    confidence: decimal("confidence", { precision: 3, scale: 2 }).default("1.00"), // AI detection confidence
    ingredientSource: text("ingredient_source"), // which ingredient contains this allergen
    createdAt: timestamp("created_at").defaultNow(),
  },
  (table) => ({
    recipeIdx: index("recipe_allergen_recipe_idx").on(table.recipeId),
    allergenIdx: index("recipe_allergen_type_idx").on(table.allergen),
  })
);

// Smart substitution history (user-specific overrides)
export const userSubstitutionPreferences = pgTable("user_substitution_preferences", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id).notNull(),
  originalIngredient: text("original_ingredient").notNull(),
  preferredSubstitute: text("preferred_substitute").notNull(),
  reason: text("reason"), // allergy, preference, availability
  usedCount: integer("used_count").default(1),
  lastUsedAt: timestamp("last_used_at").defaultNow(),
  createdAt: timestamp("created_at").defaultNow(),
});

// Product allergen scanner cache
export const productAllergens = pgTable(
  "product_allergens",
  {
    id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
    barcode: varchar("barcode", { length: 50 }).notNull(),
    productName: text("product_name").notNull(),
    allergens: jsonb("allergens").$type<string[]>().default(sql`'[]'::jsonb`),
    mayContain: jsonb("may_contain").$type<string[]>().default(sql`'[]'::jsonb`),
    ingredientList: text("ingredient_list"),
    verifiedBy: text("verified_by"), // user-submitted, fda-api, manual
    verifiedAt: timestamp("verified_at").defaultNow(),
    reportedBy: varchar("reported_by").references(() => users.id),
    createdAt: timestamp("created_at").defaultNow(),
  },
  (table) => ({
    barcodeIdx: uniqueIndex("product_allergen_barcode_idx").on(table.barcode),
  })
);

/* =========================================================================
   ===== MEAL PLAN MARKETPLACE
   ========================================================================= */

// Meal plan blueprints (templates that creators sell)
export const mealPlanBlueprints = pgTable(
  "meal_plan_blueprints",
  {
    id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
    creatorId: varchar("creator_id").references(() => users.id).notNull(),
    title: text("title").notNull(),
    description: text("description"),
    imageUrl: text("image_url"),
    category: text("category"), // weight-loss, muscle-gain, vegan, keto, family, etc.
    duration: integer("duration").notNull(), // days (7, 14, 30)
    priceInCents: integer("price_in_cents").notNull(), // 0 for free
    difficulty: text("difficulty"), // beginner, intermediate, advanced
    targetCalories: integer("target_calories"),
    dietaryTags: jsonb("dietary_tags").$type<string[]>().default(sql`'[]'::jsonb`),
    isPublished: boolean("is_published").default(false),
    isPremium: boolean("is_premium").default(false),
    salesCount: integer("sales_count").default(0),
    viewsCount: integer("views_count").default(0),
    rating: decimal("rating", { precision: 3, scale: 2 }),
    reviewsCount: integer("reviews_count").default(0),
    refundWindowDays: integer("refund_window_days").default(7),
    currentVersion: integer("current_version").default(1),
    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow(),
  },
  (table) => ({
    creatorIdx: index("blueprint_creator_idx").on(table.creatorId),
    categoryIdx: index("blueprint_category_idx").on(table.category),
    publishedIdx: index("blueprint_published_idx").on(table.isPublished),
    priceIdx: index("blueprint_price_idx").on(table.priceInCents),
  })
);

// Blueprint versions (track changes over time)
export const blueprintVersions = pgTable("blueprint_versions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  blueprintId: varchar("blueprint_id").references(() => mealPlanBlueprints.id, { onDelete: "cascade" }).notNull(),
  version: integer("version").notNull(),
  changeNotes: text("change_notes"),
  recipeIds: jsonb("recipe_ids").$type<string[]>().default(sql`'[]'::jsonb`),
  mealStructure: jsonb("meal_structure").$type<
    Array<{
      day: number;
      meals: Array<{ type: string; recipeId: string; servings: number }>;
    }>
  >().default(sql`'[]'::jsonb`),
  shoppingList: jsonb("shopping_list").$type<
    Array<{ ingredient: string; quantity: number; unit: string; category: string }>
  >().default(sql`'[]'::jsonb`),
  createdAt: timestamp("created_at").defaultNow(),
});

// Meal plan purchases
export const mealPlanPurchases = pgTable(
  "meal_plan_purchases",
  {
    id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
    buyerId: varchar("buyer_id").references(() => users.id).notNull(),
    blueprintId: varchar("blueprint_id").references(() => mealPlanBlueprints.id).notNull(),
    versionId: varchar("version_id").references(() => blueprintVersions.id).notNull(),
    amountPaid: integer("amount_paid").notNull(), // cents
    platformFee: integer("platform_fee").notNull(), // cents
    creatorPayout: integer("creator_payout").notNull(), // cents
    paymentMethod: text("payment_method"),
    stripePaymentId: text("stripe_payment_id"),
    refundedAt: timestamp("refunded_at"),
    refundReason: text("refund_reason"),
    downloadCount: integer("download_count").default(0),
    lastDownloadedAt: timestamp("last_downloaded_at"),
    createdAt: timestamp("created_at").defaultNow(),
  },
  (table) => ({
    buyerIdx: index("purchase_buyer_idx").on(table.buyerId),
    blueprintIdx: index("purchase_blueprint_idx").on(table.blueprintId),
  })
);

// Meal plan reviews
export const mealPlanReviews = pgTable(
  "meal_plan_reviews",
  {
    id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
    blueprintId: varchar("blueprint_id").references(() => mealPlanBlueprints.id, { onDelete: "cascade" }).notNull(),
    userId: varchar("user_id").references(() => users.id).notNull(),
    purchaseId: varchar("purchase_id").references(() => mealPlanPurchases.id),
    rating: integer("rating").notNull(), // 1-5
    title: text("title"),
    review: text("review"),
    wouldRecommend: boolean("would_recommend"),
    verifiedPurchase: boolean("verified_purchase").default(false),
    helpfulCount: integer("helpful_count").default(0),
    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow(),
  },
  (table) => ({
    blueprintIdx: index("review_blueprint_idx").on(table.blueprintId),
    userBlueprintIdx: uniqueIndex("review_user_blueprint_idx").on(table.userId, table.blueprintId),
  })
);

// Creator analytics
export const creatorAnalytics = pgTable("creator_analytics", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  creatorId: varchar("creator_id").references(() => users.id).notNull().unique(),
  totalSales: integer("total_sales").default(0),
  totalRevenue: integer("total_revenue").default(0), // cents
  totalPayout: integer("total_payout").default(0), // cents
  activePlans: integer("active_plans").default(0),
  averageRating: decimal("average_rating", { precision: 3, scale: 2 }),
  totalReviews: integer("total_reviews").default(0),
  followerCount: integer("follower_count").default(0),
  conversionRate: decimal("conversion_rate", { precision: 5, scale: 2 }), // views to sales %
  updatedAt: timestamp("updated_at").defaultNow(),
});

/* =========================================================================
   ===== CLUBS & CHALLENGES (Community)
   ========================================================================= */

// Clubs (micro-communities)
export const clubs = pgTable(
  "clubs",
  {
    id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
    name: text("name").notNull(),
    slug: text("slug").notNull().unique(),
    description: text("description"),
    imageUrl: text("image_url"),
    bannerUrl: text("banner_url"),
    ownerId: varchar("owner_id").references(() => users.id).notNull(),
    category: text("category"), // dietary, lifestyle, health, skill-level
    tags: jsonb("tags").$type<string[]>().default(sql`'[]'::jsonb`),
    isPublic: boolean("is_public").default(true),
    isPaid: boolean("is_paid").default(false),
    pricePerMonth: integer("price_per_month"), // cents
    memberCount: integer("member_count").default(0),
    postCount: integer("post_count").default(0),
    rules: text("rules"),
    welcomeMessage: text("welcome_message"),
    isActive: boolean("is_active").default(true),
    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow(),
  },
  (table) => ({
    slugIdx: uniqueIndex("club_slug_idx").on(table.slug),
    categoryIdx: index("club_category_idx").on(table.category),
    ownerIdx: index("club_owner_idx").on(table.ownerId),
  })
);

// Club memberships
export const clubMemberships = pgTable(
  "club_memberships",
  {
    id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
    clubId: varchar("club_id").references(() => clubs.id, { onDelete: "cascade" }).notNull(),
    userId: varchar("user_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
    role: text("role").notNull().default("member"), // owner, moderator, member
    status: text("status").notNull().default("active"), // active, banned, left
    subscriptionId: text("subscription_id"), // Stripe subscription for paid clubs
    joinedAt: timestamp("joined_at").defaultNow(),
    leftAt: timestamp("left_at"),
  },
  (table) => ({
    clubUserIdx: uniqueIndex("club_member_idx").on(table.clubId, table.userId),
    userIdx: index("membership_user_idx").on(table.userId),
  })
);

// Club posts (separate from main feed)
export const clubPosts = pgTable(
  "club_posts",
  {
    id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
    clubId: varchar("club_id").references(() => clubs.id, { onDelete: "cascade" }).notNull(),
    userId: varchar("user_id").references(() => users.id).notNull(),
    content: text("content").notNull(),
    imageUrl: text("image_url"),
    recipeId: varchar("recipe_id").references(() => recipes.id),
    isPinned: boolean("is_pinned").default(false),
    likesCount: integer("likes_count").default(0),
    commentsCount: integer("comments_count").default(0),
    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow(),
  },
  (table) => ({
    clubIdx: index("club_post_club_idx").on(table.clubId),
    userIdx: index("club_post_user_idx").on(table.userId),
  })
);

// Challenges
export const challenges = pgTable(
  "challenges",
  {
    id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
    title: text("title").notNull(),
    slug: text("slug").notNull().unique(),
    description: text("description"),
    imageUrl: text("image_url"),
    clubId: varchar("club_id").references(() => clubs.id, { onDelete: "cascade" }),
    creatorId: varchar("creator_id").references(() => users.id).notNull(),
    category: text("category"), // cooking, health, creativity
    duration: integer("duration").notNull(), // days
    goal: text("goal").notNull(), // "Complete 7 recipes", "30 smoothies", etc.
    requirements: jsonb("requirements").$type<
      Array<{
        type: string; // recipe-count, specific-recipes, streak
        target: number;
        description: string;
      }>
    >().default(sql`'[]'::jsonb`),
    rewards: jsonb("rewards").$type<
      Array<{
        type: string; // badge, points, premium-trial
        value: string;
      }>
    >().default(sql`'[]'::jsonb`),
    startDate: timestamp("start_date"),
    endDate: timestamp("end_date"),
    isRecurring: boolean("is_recurring").default(false),
    participantCount: integer("participant_count").default(0),
    completionCount: integer("completion_count").default(0),
    isActive: boolean("is_active").default(true),
    createdAt: timestamp("created_at").defaultNow(),
  },
  (table) => ({
    slugIdx: uniqueIndex("challenge_slug_idx").on(table.slug),
    clubIdx: index("challenge_club_idx").on(table.clubId),
    activeIdx: index("challenge_active_idx").on(table.isActive),
  })
);

// User challenge progress
export const challengeProgress = pgTable(
  "challenge_progress",
  {
    id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
    challengeId: varchar("challenge_id").references(() => challenges.id, { onDelete: "cascade" }).notNull(),
    userId: varchar("user_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
    status: text("status").notNull().default("in-progress"), // in-progress, completed, abandoned
    progress: integer("progress").default(0), // 0-100
    currentStreak: integer("current_streak").default(0),
    longestStreak: integer("longest_streak").default(0),
    completedSteps: jsonb("completed_steps").$type<
      Array<{
        step: string;
        completedAt: string;
        recipeId?: string;
        imageUrl?: string;
      }>
    >().default(sql`'[]'::jsonb`),
    startedAt: timestamp("started_at").defaultNow(),
    completedAt: timestamp("completed_at"),
    lastActivityAt: timestamp("last_activity_at").defaultNow(),
  },
  (table) => ({
    challengeUserIdx: uniqueIndex("challenge_progress_idx").on(table.challengeId, table.userId),
    userIdx: index("progress_user_idx").on(table.userId),
    statusIdx: index("progress_status_idx").on(table.status),
  })
);

// Badges (gamification)
export const badges = pgTable("badges", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull().unique(),
  slug: text("slug").notNull().unique(),
  description: text("description"),
  iconUrl: text("icon_url"),
  category: text("category"), // achievement, skill, social, milestone
  rarity: text("rarity"), // common, rare, epic, legendary
  requirements: text("requirements"),
  points: integer("points").default(0),
  createdAt: timestamp("created_at").defaultNow(),
});

// User badges
export const userBadges = pgTable(
  "user_badges",
  {
    id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
    userId: varchar("user_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
    badgeId: varchar("badge_id").references(() => badges.id).notNull(),
    earnedAt: timestamp("earned_at").defaultNow(),
    source: text("source"), // challenge, milestone, manual
    challengeId: varchar("challenge_id").references(() => challenges.id),
  },
  (table) => ({
    userBadgeIdx: uniqueIndex("user_badge_idx").on(table.userId, table.badgeId),
    userIdx: index("user_badges_user_idx").on(table.userId),
  })
);

/* =========================================================================
   ===== Extended types
   ========================================================================= */
export type PostWithUser = Post & { user: User; recipe?: Recipe; isLiked?: boolean; isSaved?: boolean };
export type StoryWithUser = Story & { user: User };
export type CommentWithUser = Comment & { user: User };
export type ProductWithSeller = Product & { seller: User };
export type OrderWithDetails = Order & { product: Product; seller: User; buyer: User };
export type MealPlanWithEntries = MealPlan & { entries: (MealPlanEntry & { recipe?: Recipe })[] };
export type ChefWithCatering = User & { availableForCatering: boolean; distance?: number };
export type SubstitutionIngredient = typeof substitutionIngredients.$inferSelect;
export type Substitution = typeof substitutions.$inferSelect;
export type CustomDrinkWithUser = CustomDrink & {
  user: User;
  isLiked?: boolean;
  isSaved?: boolean;
  photos?: DrinkPhoto[];
};

/* ===== NEW EXTENDED TYPES ===== */
export type PantryItemWithDetails = PantryItemEnhanced & {
  barcodeData?: BarcodeLookup;
  reminders?: ExpiryReminder[];
};

export type HouseholdWithMembers = Household & {
  owner: User;
  members: (HouseholdMember & { user: User })[];
};

export type FamilyMemberWithAllergens = FamilyMember & {
  allergens: AllergenProfile[];
};

export type RecipeWithAllergens = Recipe & {
  allergens: RecipeAllergen[];
  isSafeFor?: { familyMemberId: string; memberName: string }[];
};

export type RecipeWithMatch = Recipe & {
  matchScore?: number;
  matchingIngredients?: string[];
  missingIngredients?: string[];
};

export type MealPlanBlueprintWithCreator = MealPlanBlueprint & {
  creator: User;
  currentVersionData?: BlueprintVersion;
  hasPurchased?: boolean;
};

export type MealPlanPurchaseWithDetails = MealPlanPurchase & {
  blueprint: MealPlanBlueprint;
  version: BlueprintVersion;
  buyer: User;
};

export type MealPlanReviewWithUser = MealPlanReview & {
  user: User;
};

export type ClubWithDetails = Club & {
  owner: User;
  isMember?: boolean;
  membershipStatus?: string;
};

export type ClubPostWithUser = ClubPost & {
  user: User;
  recipe?: Recipe;
  isLiked?: boolean;
};

export type ChallengeWithProgress = Challenge & {
  creator: User;
  userProgress?: ChallengeProgress;
  isJoined?: boolean;
};

export type ChallengeProgressWithDetails = ChallengeProgress & {
  challenge: Challenge;
  user: User;
};

export type BadgeWithEarnedInfo = Badge & {
  earnedAt?: string;
  source?: string;
};
