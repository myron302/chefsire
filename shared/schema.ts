import { sql } from "drizzle-orm";
import {
  pgTable,
  text,
  varchar,
  integer,
  boolean,
  timestamp,
  date,
  bigserial,
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
    password: text("password"),  // Made optional for OAuth users
    displayName: text("display_name").notNull(),
    firstName: text("first_name"),
    lastName: text("last_name"),
    royalTitle: text("royal_title"),
    showFullName: boolean("show_full_name").default(false),
    bio: text("bio"),
    avatar: text("avatar"),
    isPrivate: boolean("is_private").default(false),
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
weddingTier: text("wedding_tier").default("free"),
weddingStatus: text("wedding_status").default("inactive"),
weddingEndsAt: timestamp("wedding_ends_at"),
vendorTier: text("vendor_tier").default("free"),
vendorStatus: text("vendor_status").default("inactive"),
vendorEndsAt: timestamp("vendor_ends_at"),
    dailyCalorieGoal: integer("daily_calorie_goal"),
    macroGoals: jsonb("macro_goals").$type<{ protein: number; carbs: number; fat: number }>(),
    dietaryRestrictions: jsonb("dietary_restrictions").$type<string[]>().default(sql`'[]'::jsonb`),

    // OAuth fields
    googleId: text("google_id"),
    facebookId: text("facebook_id"),
    instagramId: text("instagram_id"),
    tiktokId: text("tiktok_id"),
    provider: text("provider"),  // 'local' | 'google' | 'facebook' | 'instagram' | 'tiktok'

    // ✅ NEW: will be set upon clicking verification link (or instantly for OAuth)
    emailVerifiedAt: timestamp("email_verified_at"),

    createdAt: timestamp("created_at").defaultNow(),
  },
  (table) => ({
    cateringLocationIdx: index("catering_location_idx").on(table.cateringLocation),
    subscriptionTierIdx: index("subscription_tier_idx").on(table.subscriptionTier),
    googleIdIdx: index("google_id_idx").on(table.googleId),
    facebookIdIdx: index("facebook_id_idx").on(table.facebookId),
    instagramIdIdx: index("instagram_id_idx").on(table.instagramId),
    tiktokIdIdx: index("tiktok_id_idx").on(table.tiktokId),
  })
);

export const posts = pgTable("posts", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id).notNull(),
  caption: text("caption"),
  imageUrl: text("image_url").notNull(),
  additionalImages: jsonb("additional_images").$type<string[]>().default(sql`'[]'::jsonb`).notNull(),
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
  averageRating: decimal("average_rating", { precision: 3, scale: 2 }).default("0"),
  reviewCount: integer("review_count").default(0),
  externalSource: text("external_source"), // 'mealdb', 'spoonacular', etc.
  externalId: text("external_id"), // Original ID from external API
  cuisine: text("cuisine"), // Cuisine type
  mealType: text("meal_type"), // Meal category
  sourceUrl: text("source_url"), // Original source URL
});

/* ===== RECIPE REVIEWS ===== */
export const recipeReviews = pgTable("recipe_reviews", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  recipeId: varchar("recipe_id").references(() => recipes.id).notNull(),
  userId: varchar("user_id").references(() => users.id).notNull(),
  rating: integer("rating").notNull(),
  reviewText: text("review_text"),
  helpfulCount: integer("helpful_count").notNull().default(0),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const recipeReviewPhotos = pgTable("recipe_review_photos", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  reviewId: varchar("review_id").references(() => recipeReviews.id).notNull(),
  photoUrl: text("photo_url").notNull(),
  caption: text("caption"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const reviewHelpful = pgTable("review_helpful", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  reviewId: varchar("review_id").references(() => recipeReviews.id).notNull(),
  userId: varchar("user_id").references(() => users.id).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

/**
 * Likes on comments: each like links a user to a comment.  The unique index
 * ensures a user can only like a given comment once.  The onDelete cascade
 * cleans up likes automatically when a comment is removed.
 */
export const commentLikes = pgTable(
  "comment_likes",
  {
    id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
    userId: varchar("user_id").references(() => users.id).notNull(),
    commentId: varchar("comment_id").references(() => comments.id, { onDelete: "cascade" }).notNull(),
    createdAt: timestamp("created_at").defaultNow(),
  },
  (table) => ({
    userCommentIdx: uniqueIndex("comment_likes_user_comment_idx").on(table.userId, table.commentId),
  })
);

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

export const comments = pgTable(
  "comments",
  {
    id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
    userId: varchar("user_id").references(() => users.id).notNull(),
    postId: varchar("post_id").references(() => posts.id).notNull(),

    // Threading: null = top-level comment; otherwise points to parent comment id
    parentId: varchar("parent_id").references(() => comments.id, { onDelete: "cascade" }),

    content: text("content").notNull(),
    createdAt: timestamp("created_at").defaultNow(),
  },
  (t) => ({
    postIdIdx: index("comments_post_id_idx").on(t.postId),
    userIdIdx: index("comments_user_id_idx").on(t.userId),
    parentIdIdx: index("comments_parent_id_idx").on(t.parentId),
  })
);


export const follows = pgTable(
  "follows",
  {
    id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
    followerId: varchar("follower_id").references(() => users.id).notNull(),
    followingId: varchar("following_id").references(() => users.id).notNull(),
    createdAt: timestamp("created_at").defaultNow(),
  },
  (table) => ({
    followerIdx: index("follows_follower_id_idx").on(table.followerId),
    followingIdx: index("follows_following_id_idx").on(table.followingId),
    followerCreatedAtIdx: index("follows_follower_created_at_idx").on(table.followerId, table.createdAt),
    followingCreatedAtIdx: index("follows_following_created_at_idx").on(table.followingId, table.createdAt),
  })
);

export const followRequests = pgTable("follow_requests", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  requesterId: varchar("requester_id").references(() => users.id).notNull(),
  targetId: varchar("target_id").references(() => users.id).notNull(),
  status: text("status").notNull().default("pending"), // 'pending' | 'accepted' | 'declined' | 'canceled'
  createdAt: timestamp("created_at").defaultNow(),
  respondedAt: timestamp("responded_at"),
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
    productCategory: text("product_category").default("physical"), // physical, digital, cookbook, course, ingredient, tool
    images: jsonb("images").$type<string[]>().default(sql`'[]'::jsonb`),
    inventory: integer("inventory").default(0),
    shippingEnabled: boolean("shipping_enabled").default(true),
    localPickupEnabled: boolean("local_pickup_enabled").default(false),
    inStoreOnly: boolean("in_store_only").default(false),
    isDigital: boolean("is_digital").default(false),
    digitalFileUrl: text("digital_file_url"), // For digital products like cookbooks
    digitalFileName: text("digital_file_name"), // Original filename of the digital product
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
    productCategoryIdx: index("products_product_category_idx").on(table.productCategory),
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
    deliveryMethod: text("delivery_method").notNull().default("shipped"), // shipped, pickup, in_store, digital
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
  subscriptionType: text("subscription_type").default("marketplace"),
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
  customProtein: integer("custom_protein"),
  customCarbs: integer("custom_carbs"),
  customFat: integer("custom_fat"),
  source: varchar("source", { length: 50 }),
});

export const mealStreaks = pgTable("meal_streaks", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id).notNull(),
  currentStreak: integer("current_streak").notNull().default(0),
  longestStreak: integer("longest_streak").notNull().default(0),
  lastLoggedDate: date("last_logged_date"),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const bodyMetrics = pgTable("body_metrics", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id).notNull(),
  date: date("date").notNull(),
  weightLbs: decimal("weight_lbs", { precision: 8, scale: 2 }).notNull(),
  bodyFatPct: decimal("body_fat_pct", { precision: 5, scale: 2 }),
  waistIn: decimal("waist_in", { precision: 6, scale: 2 }),
  hipIn: decimal("hip_in", { precision: 6, scale: 2 }),
  createdAt: timestamp("created_at").defaultNow(),
});

export const mealFavorites = pgTable("meal_favorites", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id).notNull(),
  mealName: text("meal_name").notNull(),
  calories: integer("calories"),
  protein: integer("protein"),
  carbs: integer("carbs"),
  fat: integer("fat"),
  fiber: integer("fiber"),
  isFavorite: boolean("is_favorite").default(false),
  timesLogged: integer("times_logged").default(0),
  lastUsed: timestamp("last_used"),
});

export const waterLogs = pgTable("water_logs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id).notNull(),
  date: date("date").notNull(),
  glassesLogged: integer("glasses_logged").notNull().default(0),
  dailyTarget: integer("daily_target").notNull().default(8),
  updatedAt: timestamp("updated_at").defaultNow(),
});

/* ===== MEAL PLAN MARKETPLACE ===== */
export const mealPlanBlueprints = pgTable("meal_plan_blueprints", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  creatorId: varchar("creator_id").references(() => users.id).notNull(),
  title: text("title").notNull(),
  description: text("description"),
  duration: integer("duration").notNull().default(7),
  durationUnit: text("duration_unit").notNull().default("days"),
  priceInCents: integer("price_in_cents").notNull(),
  category: text("category").notNull().default("general"),
  dietaryLabels: text("dietary_labels").array().default(sql`'{}'::text[]`),
  difficulty: text("difficulty").notNull().default("medium"),
  servings: integer("servings").notNull().default(4),
  tags: text("tags").array().default(sql`'{}'::text[]`),
  status: text("status").notNull().default("draft"),
  salesCount: integer("sales_count").notNull().default(0),
  isPremiumContent: boolean("is_premium_content").default(false),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const blueprintVersions = pgTable("blueprint_versions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  blueprintId: varchar("blueprint_id").references(() => mealPlanBlueprints.id).notNull(),
  version: integer("version").notNull(),
  mealStructure: text("meal_structure").notNull(),
  changeLog: text("change_log"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const mealPlanPurchases = pgTable("meal_plan_purchases", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id).notNull(),
  blueprintId: varchar("blueprint_id").references(() => mealPlanBlueprints.id).notNull(),
  pricePaidCents: integer("price_paid_cents").notNull(),
  paymentStatus: text("payment_status").notNull().default("completed"),
  paymentMethod: text("payment_method"),
  transactionId: text("transaction_id"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const mealPlanReviews = pgTable("meal_plan_reviews", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id).notNull(),
  blueprintId: varchar("blueprint_id").references(() => mealPlanBlueprints.id).notNull(),
  rating: integer("rating").notNull(),
  comment: text("comment"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const creatorAnalytics = pgTable("creator_analytics", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  creatorId: varchar("creator_id").references(() => users.id).notNull(),
  date: text("date").notNull(),
  totalSales: integer("total_sales").notNull().default(0),
  totalRevenueCents: integer("total_revenue_cents").notNull().default(0),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

/* ===== PANTRY ===== */
/* ===== PANTRY HOUSEHOLDS ===== */
export const pantryHouseholds = pgTable(
  "pantry_households",
  {
    id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
    name: text("name").notNull(),
    inviteCode: varchar("invite_code").notNull(),
    ownerId: varchar("owner_id").references(() => users.id).notNull(),
    createdAt: timestamp("created_at").defaultNow(),
  },
  (t) => ({
    inviteCodeIdx: uniqueIndex("pantry_households_invite_code_uq").on(t.inviteCode),
    ownerIdIdx: index("pantry_households_owner_id_idx").on(t.ownerId),
  })
);

export const pantryHouseholdMembers = pgTable(
  "pantry_household_members",
  {
    id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
    householdId: varchar("household_id").references(() => pantryHouseholds.id).notNull(),
    userId: varchar("user_id").references(() => users.id).notNull(),
    role: text("role").notNull().default("member"), // owner | admin | member
    joinedAt: timestamp("joined_at").defaultNow(),
  },
  (t) => ({
    householdIdIdx: index("pantry_household_members_household_id_idx").on(t.householdId),
    userIdIdx: index("pantry_household_members_user_id_idx").on(t.userId),
    householdUserUq: uniqueIndex("pantry_household_members_household_user_uq").on(t.householdId, t.userId),
  })
);

export const pantryItems = pgTable(
  "pantry_items",
  {
    id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
    userId: varchar("user_id").references(() => users.id).notNull(),
    name: text("name").notNull(),
    category: text("category"),
    quantity: decimal("quantity", { precision: 8, scale: 2 }),
    unit: text("unit"),
    location: text("location"),
    expirationDate: timestamp("expiration_date"),
    purchaseDate: timestamp("purchase_date"),
    notes: text("notes"),
    isRunningLow: boolean("is_running_low").default(false),
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

/* ===== ALLERGEN MANAGEMENT ===== */
export const familyMembers = pgTable(
  "family_members",
  {
    id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
    userId: varchar("user_id").references(() => users.id).notNull(),
    householdMemberId: varchar("household_member_id").references(() => users.id),
    name: text("name").notNull(),
    relationship: text("relationship"),
    dateOfBirth: timestamp("date_of_birth"),
    species: text("species").default("human"),
    notes: text("notes"),
    createdAt: timestamp("created_at").defaultNow(),
  },
  (table) => ({
    userIdx: index("family_members_user_idx").on(table.userId),
    householdMemberIdx: index("family_members_household_member_idx").on(table.householdMemberId),
  })
);

export const allergenProfiles = pgTable(
  "allergen_profiles",
  {
    id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
    familyMemberId: varchar("family_member_id").references(() => familyMembers.id, { onDelete: "cascade" }).notNull(),
    allergen: text("allergen").notNull(),
    severity: text("severity").notNull(),
    diagnosedBy: text("diagnosed_by"),
    diagnosedDate: timestamp("diagnosed_date"),
    notes: text("notes"),
    createdAt: timestamp("created_at").defaultNow(),
  },
  (table) => ({
    familyMemberIdx: index("allergen_profiles_family_member_idx").on(table.familyMemberId),
    allergenIdx: index("allergen_profiles_allergen_idx").on(table.allergen),
  })
);

export const recipeAllergens = pgTable(
  "recipe_allergens",
  {
    id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
    recipeId: varchar("recipe_id").references(() => recipes.id, { onDelete: "cascade" }).notNull(),
    allergens: jsonb("allergens").$type<string[]>().default(sql`'[]'::jsonb`).notNull(),
    createdAt: timestamp("created_at").defaultNow(),
  },
  (table) => ({
    recipeIdx: index("recipe_allergens_recipe_idx").on(table.recipeId),
  })
);

export const userSubstitutionPreferences = pgTable(
  "user_substitution_preferences",
  {
    id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
    userId: varchar("user_id").references(() => users.id).notNull(),
    originalIngredient: text("original_ingredient").notNull(),
    substitutes: jsonb("substitutes").$type<string[]>().default(sql`'[]'::jsonb`).notNull(),
    reason: text("reason"),
    createdAt: timestamp("created_at").defaultNow(),
  },
  (table) => ({
    userIdx: index("user_sub_prefs_user_idx").on(table.userId),
    ingredientIdx: index("user_sub_prefs_ingredient_idx").on(table.originalIngredient),
  })
);

export const productAllergens = pgTable(
  "product_allergens",
  {
    id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
    barcode: text("barcode").notNull().unique(),
    productName: text("product_name").notNull(),
    allergens: jsonb("allergens").$type<string[]>().default(sql`'[]'::jsonb`).notNull(),
    mayContain: jsonb("may_contain").$type<string[]>().default(sql`'[]'::jsonb`).notNull(),
    createdAt: timestamp("created_at").defaultNow(),
  },
  (table) => ({
    barcodeIdx: index("product_allergens_barcode_idx").on(table.barcode),
  })
);

/* ===== CLUBS & COMMUNITIES ===== */
export const clubs = pgTable(
  "clubs",
  {
    id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
    creatorId: varchar("creator_id").references(() => users.id).notNull(),
    name: text("name").notNull(),
    description: text("description"),
    category: text("category").default("general"),
    rules: text("rules"),
    coverImage: text("cover_image"),
    isPublic: boolean("is_public").default(true),
    createdAt: timestamp("created_at").defaultNow(),
  },
  (table) => ({
    creatorIdx: index("clubs_creator_idx").on(table.creatorId),
    categoryIdx: index("clubs_category_idx").on(table.category),
  })
);

export const clubMemberships = pgTable(
  "club_memberships",
  {
    id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
    clubId: varchar("club_id").references(() => clubs.id, { onDelete: "cascade" }).notNull(),
    userId: varchar("user_id").references(() => users.id).notNull(),
    role: text("role").default("member"),
    joinedAt: timestamp("joined_at").defaultNow(),
  },
  (table) => ({
    clubUserIdx: index("club_memberships_club_user_idx").on(table.clubId, table.userId),
  })
);


export const clubJoinRequests = pgTable(
  "club_join_requests",
  {
    id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
    clubId: varchar("club_id").references(() => clubs.id, { onDelete: "cascade" }).notNull(),
    userId: varchar("user_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
    status: text("status").default("pending").notNull(), // pending, approved, declined
    createdAt: timestamp("created_at").defaultNow(),
    decidedAt: timestamp("decided_at"),
    decidedBy: varchar("decided_by").references(() => users.id, { onDelete: "set null" }),
  },
  (table) => ({
    clubIdx: index("club_join_requests_club_idx").on(table.clubId),
    userIdx: index("club_join_requests_user_idx").on(table.userId),
    clubUserIdx: index("club_join_requests_club_user_idx").on(table.clubId, table.userId),
    statusIdx: index("club_join_requests_status_idx").on(table.status),
  })
);

export const clubPosts = pgTable(
  "club_posts",
  {
    id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
    clubId: varchar("club_id").references(() => clubs.id, { onDelete: "cascade" }).notNull(),
    userId: varchar("user_id").references(() => users.id).notNull(),
    content: text("content").notNull(),
    imageUrl: text("image_url"),
    recipeId: varchar("recipe_id").references(() => recipes.id, { onDelete: "set null" }),
    likesCount: integer("likes_count").default(0),
    commentsCount: integer("comments_count").default(0),
    createdAt: timestamp("created_at").defaultNow(),
  },
  (table) => ({
    clubIdx: index("club_posts_club_idx").on(table.clubId),
    userIdx: index("club_posts_user_idx").on(table.userId),
  })
);


export const clubPostLikes = pgTable(
  "club_post_likes",
  {
    id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
    clubPostId: varchar("club_post_id").references(() => clubPosts.id, { onDelete: "cascade" }).notNull(),
    userId: varchar("user_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
    createdAt: timestamp("created_at").defaultNow(),
  },
  (table) => ({
    postIdx: index("club_post_likes_post_idx").on(table.clubPostId),
    userIdx: index("club_post_likes_user_idx").on(table.userId),
    postUserIdx: index("club_post_likes_post_user_idx").on(table.clubPostId, table.userId),
  })
);

export const challenges = pgTable(
  "challenges",
  {
    id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
    clubId: varchar("club_id").references(() => clubs.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    description: text("description"),
    goal: text("goal").notNull(),
    requirements: jsonb("requirements").$type<any[]>().default(sql`'[]'::jsonb`),
    rewards: jsonb("rewards").$type<any[]>().default(sql`'[]'::jsonb`),
    tier: text("tier").default("bronze"),
    startDate: timestamp("start_date").notNull(),
    endDate: timestamp("end_date").notNull(),
    createdAt: timestamp("created_at").defaultNow(),
  },
  (table) => ({
    clubIdx: index("challenges_club_idx").on(table.clubId),
  })
);

export const challengeProgress = pgTable(
  "challenge_progress",
  {
    id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
    challengeId: varchar("challenge_id").references(() => challenges.id, { onDelete: "cascade" }).notNull(),
    userId: varchar("user_id").references(() => users.id).notNull(),
    progress: integer("progress").default(0),
    currentProgress: integer("current_progress").default(0),
    currentStreak: integer("current_streak").default(0),
    completedSteps: jsonb("completed_steps").$type<any[]>().default(sql`'[]'::jsonb`),
    completed: boolean("completed").default(false),
    isCompleted: boolean("is_completed").default(false),
    completedAt: timestamp("completed_at"),
    startedAt: timestamp("started_at").defaultNow(),
    createdAt: timestamp("created_at").defaultNow(),
  },
  (table) => ({
    challengeUserIdx: index("challenge_progress_challenge_user_idx").on(table.challengeId, table.userId),
  })
);

export const badges = pgTable(
  "badges",
  {
    id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
    name: text("name").notNull().unique(),
    description: text("description"),
    icon: text("icon"),
    rarity: text("rarity").default("common"),
    tier: text("tier").default("bronze"),
    createdAt: timestamp("created_at").defaultNow(),
  }
);

export const userBadges = pgTable(
  "user_badges",
  {
    id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
    userId: varchar("user_id").references(() => users.id).notNull(),
    badgeId: varchar("badge_id").references(() => badges.id).notNull(),
    earnedAt: timestamp("earned_at").defaultNow(),
  },
  (table) => ({
    userBadgeIdx: index("user_badges_user_badge_idx").on(table.userId, table.badgeId),
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

export const drinkCollections = pgTable(
  "drink_collections",
  {
    id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
    userId: varchar("user_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
    name: varchar("name", { length: 160 }).notNull(),
    description: text("description"),
    isPublic: boolean("is_public").default(false).notNull(),
    accessType: text("access_type").default("public").notNull(),
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

export const drinkCollectionItems = pgTable(
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

export const drinkCollectionPurchases = pgTable(
  "drink_collection_purchases",
  {
    id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
    userId: varchar("user_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
    collectionId: varchar("collection_id").references(() => drinkCollections.id, { onDelete: "cascade" }).notNull(),
    status: text("status").default("completed").notNull(),
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

export const drinkCollectionWishlists = pgTable(
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

export const drinkCollectionReviews = pgTable(
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

export const drinkCollectionCheckoutSessions = pgTable(
  "drink_collection_checkout_sessions",
  {
    id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
    userId: varchar("user_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
    collectionId: varchar("collection_id").references(() => drinkCollections.id, { onDelete: "cascade" }).notNull(),
    provider: text("provider").default("square").notNull(),
    purchaseType: text("purchase_type").default("self").notNull(),
    status: text("status").default("pending").notNull(),
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

export const drinkCollectionSquareWebhookEvents = pgTable(
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

export const drinkGifts = pgTable(
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

export const drinkCollectionSalesLedger = pgTable(
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
    status: text("status").default("completed").notNull(),
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

export const drinkCollectionPromotions = pgTable(
  "drink_collection_promotions",
  {
    id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
    creatorUserId: varchar("creator_user_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
    collectionId: varchar("collection_id").references(() => drinkCollections.id, { onDelete: "cascade" }).notNull(),
    code: varchar("code", { length: 64 }).notNull(),
    discountType: text("discount_type").notNull(),
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

export const drinkCollectionEvents = pgTable(
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

export const creatorMembershipPlans = pgTable(
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

export const creatorMemberships = pgTable(
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

export const creatorPosts = pgTable(
  "creator_posts",
  {
    id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
    creatorUserId: varchar("creator_user_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
    title: varchar("title", { length: 160 }).notNull(),
    body: text("body").notNull(),
    postType: text("post_type").default("update").notNull(),
    visibility: text("visibility").default("public").notNull(),
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
  })
);

export const creatorDrops = pgTable(
  "creator_drops",
  {
    id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
    creatorUserId: varchar("creator_user_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
    title: varchar("title", { length: 160 }).notNull(),
    description: text("description"),
    dropType: text("drop_type").default("collection_launch").notNull(),
    visibility: text("visibility").default("public").notNull(),
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
  })
);

export const creatorDropRsvps = pgTable(
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

export const creatorRoadmapItems = pgTable(
  "creator_roadmap_items",
  {
    id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
    creatorUserId: varchar("creator_user_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
    title: varchar("title", { length: 160 }).notNull(),
    description: text("description"),
    itemType: text("item_type").default("roadmap").notNull(),
    visibility: text("visibility").default("public").notNull(),
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
  })
);

export const creatorCampaigns = pgTable(
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
    startsWithAudience: text("starts_with_audience"),
    unlockFollowersAt: timestamp("unlock_followers_at"),
    unlockPublicAt: timestamp("unlock_public_at"),
    rolloutNotes: text("rollout_notes"),
    isRolloutActive: boolean("is_rollout_active").default(false).notNull(),
    isRolloutPaused: boolean("is_rollout_paused").default(false).notNull(),
    rolloutPausedAt: timestamp("rollout_paused_at"),
    isPinned: boolean("is_pinned").default(false).notNull(),
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

export const creatorCampaignRolloutTimelineEvents = pgTable(
  "creator_campaign_rollout_timeline_events",
  {
    id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
    campaignId: varchar("campaign_id").references(() => creatorCampaigns.id, { onDelete: "cascade" }).notNull(),
    actorUserId: varchar("actor_user_id").references(() => users.id, { onDelete: "set null" }),
    eventType: text("event_type").notNull(),
    title: varchar("title", { length: 160 }).notNull(),
    message: text("message").notNull(),
    audienceStage: text("audience_stage"),
    metadata: jsonb("metadata").$type<Record<string, unknown>>().default(sql`'{}'::jsonb`).notNull(),
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

export const creatorCampaignTemplates = pgTable(
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

export const creatorCampaignLinks = pgTable(
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

export const creatorCampaignFollows = pgTable(
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

export const creatorCampaignGoals = pgTable(
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

export const creatorCampaignActionStates = pgTable(
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

export const creatorCampaignExperiments = pgTable(
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

export const creatorCampaignCtaVariants = pgTable(
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

export const creatorCampaignVariantEvents = pgTable(
  "creator_campaign_variant_events",
  {
    id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
    campaignId: varchar("campaign_id").references(() => creatorCampaigns.id, { onDelete: "cascade" }).notNull(),
    variantId: varchar("variant_id").references(() => creatorCampaignCtaVariants.id, { onDelete: "cascade" }).notNull(),
    eventType: text("event_type").notNull(),
    userId: varchar("user_id").references(() => users.id, { onDelete: "set null" }),
    sessionKey: varchar("session_key", { length: 160 }),
    metadata: jsonb("metadata").$type<Record<string, unknown> | null>(),
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

export const creatorCampaignSpotlightEvents = pgTable(
  "creator_campaign_spotlight_events",
  {
    id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
    campaignId: varchar("campaign_id").references(() => creatorCampaigns.id, { onDelete: "cascade" }).notNull(),
    eventType: text("event_type").notNull(),
    surface: text("surface").notNull(),
    userId: varchar("user_id").references(() => users.id, { onDelete: "set null" }),
    sessionKey: varchar("session_key", { length: 160 }),
    metadata: jsonb("metadata").$type<Record<string, unknown> | null>(),
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

export const creatorCampaignSurfaceEvents = pgTable(
  "creator_campaign_surface_events",
  {
    id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
    campaignId: varchar("campaign_id").references(() => creatorCampaigns.id, { onDelete: "cascade" }).notNull(),
    eventType: text("event_type").notNull(),
    surface: text("surface").notNull(),
    userId: varchar("user_id").references(() => users.id, { onDelete: "set null" }),
    sessionKey: varchar("session_key", { length: 160 }),
    metadata: jsonb("metadata").$type<Record<string, unknown> | null>(),
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

export const creatorDropEvents = pgTable(
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

export const creatorCollaborations = pgTable(
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

export const creatorMembershipCheckoutSessions = pgTable(
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

export const creatorMembershipSalesLedger = pgTable(
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
    viewCount: integer("view_count").default(0),
    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow(),
  },
  (t) => ({
    handleIdx: index("stores_handle_idx").on(t.handle),
    userIdIdx: index("stores_user_id_idx").on(t.userId),
    publishedIdx: index("stores_published_idx").on(t.published),
  })
);

/* ===== PAYMENT METHODS ===== */
export const paymentMethods = pgTable(
  "payment_methods",
  {
    id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
    userId: varchar("user_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
    provider: text("provider").notNull(), // square, stripe, paypal
    providerId: text("provider_id").notNull(), // external account ID from provider
    accountStatus: text("account_status").default("pending"), // pending, active, disabled, rejected
    accountType: text("account_type"), // individual, business
    accountEmail: text("account_email"),
    accountDetails: jsonb("account_details").$type<{
      merchantId?: string;
      locationId?: string;
      accessToken?: string; // encrypted
      refreshToken?: string; // encrypted
      tokenExpiresAt?: string;
    }>(),
    isDefault: boolean("is_default").default(false),
    verifiedAt: timestamp("verified_at"),
    lastVerifiedAt: timestamp("last_verified_at"),
    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow(),
  },
  (t) => ({
    userIdx: index("payment_methods_user_idx").on(t.userId),
    providerIdx: index("payment_methods_provider_idx").on(t.provider),
    statusIdx: index("payment_methods_status_idx").on(t.accountStatus),
  })
);

/* ===== COMMISSIONS ===== */
export const commissions = pgTable(
  "commissions",
  {
    id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
    orderId: varchar("order_id").references(() => orders.id).notNull(),
    sellerId: varchar("seller_id").references(() => users.id).notNull(),
    subscriptionTier: text("subscription_tier").notNull(),
    commissionRate: decimal("commission_rate", { precision: 5, scale: 2 }).notNull(), // percentage
    orderTotal: decimal("order_total", { precision: 10, scale: 2 }).notNull(),
    commissionAmount: decimal("commission_amount", { precision: 10, scale: 2 }).notNull(),
    sellerAmount: decimal("seller_amount", { precision: 10, scale: 2 }).notNull(),
    payoutId: varchar("payout_id").references(() => payouts.id),
    status: text("status").default("pending"), // pending, paid, refunded
    createdAt: timestamp("created_at").defaultNow(),
    paidAt: timestamp("paid_at"),
  },
  (t) => ({
    orderIdx: index("commissions_order_idx").on(t.orderId),
    sellerIdx: index("commissions_seller_idx").on(t.sellerId),
    payoutIdx: index("commissions_payout_idx").on(t.payoutId),
    statusIdx: index("commissions_status_idx").on(t.status),
  })
);

/* ===== PAYOUTS ===== */
export const payouts = pgTable(
  "payouts",
  {
    id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
    sellerId: varchar("seller_id").references(() => users.id).notNull(),
    paymentMethodId: varchar("payment_method_id").references(() => paymentMethods.id),
    amount: decimal("amount", { precision: 10, scale: 2 }).notNull(),
    currency: text("currency").default("USD"),
    provider: text("provider").notNull(), // square, stripe, paypal
    providerPayoutId: text("provider_payout_id"), // external payout ID from provider
    status: text("status").default("pending"), // pending, processing, completed, failed, cancelled
    failureReason: text("failure_reason"),
    scheduledFor: timestamp("scheduled_for"),
    processedAt: timestamp("processed_at"),
    completedAt: timestamp("completed_at"),
    metadata: jsonb("metadata").$type<{
      ordersCount?: number;
      dateRange?: { from: string; to: string };
      accountDetails?: Record<string, any>;
    }>(),
    createdAt: timestamp("created_at").defaultNow(),
  },
  (t) => ({
    sellerIdx: index("payouts_seller_idx").on(t.sellerId),
    statusIdx: index("payouts_status_idx").on(t.status),
    scheduledIdx: index("payouts_scheduled_idx").on(t.scheduledFor),
    providerPayoutIdx: index("payouts_provider_payout_idx").on(t.providerPayoutId),
  })
);

/* ===== PAYOUT SCHEDULES ===== */
export const payoutSchedules = pgTable(
  "payout_schedules",
  {
    id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
    sellerId: varchar("seller_id").references(() => users.id, { onDelete: "cascade" }).notNull().unique(),
    frequency: text("frequency").default("weekly"), // daily, weekly, biweekly, monthly
    dayOfWeek: integer("day_of_week"), // 0-6 for weekly (Sunday = 0)
    dayOfMonth: integer("day_of_month"), // 1-31 for monthly
    minimumAmount: decimal("minimum_amount", { precision: 10, scale: 2 }).default("25.00"), // minimum payout threshold
    isActive: boolean("is_active").default(true),
    lastPayoutAt: timestamp("last_payout_at"),
    nextPayoutAt: timestamp("next_payout_at"),
    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow(),
  },
  (t) => ({
    sellerIdx: index("payout_schedules_seller_idx").on(t.sellerId),
    activeIdx: index("payout_schedules_active_idx").on(t.isActive),
    nextPayoutIdx: index("payout_schedules_next_payout_idx").on(t.nextPayoutAt),
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

// Wedding RSVP Invitations Table
export const weddingRsvpInvitations = pgTable(
  "wedding_rsvp_invitations",
  {
    id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),

    // The user who created the wedding event (couple)
    userId: varchar("user_id").references(() => users.id).notNull(),

    // Guest information
    guestName: varchar("guest_name", { length: 255 }).notNull(),
    guestEmail: varchar("guest_email", { length: 255 }).notNull(),

    // RSVP token (hashed)
    tokenHash: varchar("token_hash", { length: 64 }).notNull().unique(),

    // RSVP status
    rsvpStatus: varchar("rsvp_status", { length: 20 }).notNull().default("pending"), // 'pending', 'accepted', 'declined'

    // Plus one allowed
    plusOne: boolean("plus_one").default(false),

    // Name of the guest's plus-one (if provided). When a guest RSVP's with a
    // companion, this field stores the companion's name so the couple can
    // accurately track attendance. Nullable because many invitations will
    // either not allow a plus-one or the guest may decline to provide the
    // name. The frontend should only display this field if the invitation
    // explicitly allows a plus-one.
    plusOneName: varchar("plus_one_name", { length: 255 }),

    // Optional: Wedding event details
    eventDate: timestamp("event_date"),
    eventLocation: text("event_location"),
    eventMessage: text("event_message"),

    // Token expiry (30 days by default)
    expiresAt: timestamp("expires_at").notNull().default(sql`now() + interval '30 days'`),

    // When the guest responded
    respondedAt: timestamp("responded_at"),

    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => ({
    userIdx: index("wri_user_idx").on(t.userId),
    tokenIdx: index("wri_token_hash_idx").on(t.tokenHash),
    emailIdx: index("wri_email_idx").on(t.guestEmail),
  })
);


// Wedding Event Details (saved per user/couple)
// Stores partner names, ceremony/reception details, and the chosen email template.
// One row per user; we use user_id as the primary key so upserts are easy.
export const weddingEventDetails = pgTable(
  "wedding_event_details",
  {
    userId: varchar("user_id").primaryKey().references(() => users.id).notNull(),

    partner1Name: varchar("partner1_name", { length: 255 }),
    partner2Name: varchar("partner2_name", { length: 255 }),

    ceremonyDate: timestamp("ceremony_date"),
    ceremonyTime: varchar("ceremony_time", { length: 20 }),
    ceremonyLocation: text("ceremony_location"),

    receptionDate: timestamp("reception_date"),
    receptionTime: varchar("reception_time", { length: 20 }),
    receptionLocation: text("reception_location"),

    useSameLocation: boolean("use_same_location").default(false),

    customMessage: text("custom_message"),
    selectedTemplate: varchar("selected_template", { length: 32 }).default("elegant"),

    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (t) => ({
    userIdx: index("wedding_event_details_user_idx").on(t.userId),
  })
);

export type WeddingEventDetails = typeof weddingEventDetails.$inferSelect;

// Wedding Planning Calendar Events (saved per user/couple)
export const weddingCalendarEvents = pgTable(
  "wedding_calendar_events",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    userId: varchar("user_id").references(() => users.id).notNull(),
    eventDate: date("event_date").notNull(),
    eventTime: varchar("event_time", { length: 10 }), // optional HH:MM
    title: text("title").notNull(),
    type: varchar("type", { length: 32 }).notNull(),
    notes: text("notes"),
    reminder: boolean("reminder").default(false).notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => ({
    userIdx: index("wedding_calendar_events_user_idx").on(t.userId),
    dateIdx: index("wedding_calendar_events_date_idx").on(t.eventDate),
  })
);

export type WeddingCalendarEvent = typeof weddingCalendarEvents.$inferSelect;

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

export const insertRecipeReviewSchema = createInsertSchema(recipeReviews).omit({
  id: true,
  helpfulCount: true,
  createdAt: true,
  updatedAt: true,
});

export const insertRecipeReviewPhotoSchema = createInsertSchema(recipeReviewPhotos).omit({
  id: true,
  createdAt: true,
});

export const insertReviewHelpfulSchema = createInsertSchema(reviewHelpful).omit({
  id: true,
  createdAt: true,
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

// Schema for inserting a like on a comment.  We omit the id and createdAt fields so they
// are automatically generated by the database.  The commentLikes table records which
// user liked which comment and is limited by a unique index.
export const insertCommentLikeSchema = createInsertSchema(commentLikes).omit({
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
export const insertMealStreakSchema = createInsertSchema(mealStreaks).omit({
  id: true,
});

export const insertBodyMetricSchema = createInsertSchema(bodyMetrics).omit({
  id: true,
  createdAt: true,
});

export const insertMealFavoriteSchema = createInsertSchema(mealFavorites).omit({
  id: true,
});

export const insertWaterLogSchema = createInsertSchema(waterLogs).omit({
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

export const insertDrinkEventSchema = createInsertSchema(drinkEvents).omit({
  id: true,
  createdAt: true,
});

export const insertPetFoodEventSchema = createInsertSchema(petFoodEvents).omit({
  id: true,
  createdAt: true,
});

export const insertDrinkRecipeSchema = createInsertSchema(drinkRecipes).omit({
  id: true,
  source: true,
  createdAt: true,
  updatedAt: true,
});

export const insertDrinkCollectionSchema = createInsertSchema(drinkCollections).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertDrinkCollectionItemSchema = createInsertSchema(drinkCollectionItems).omit({
  addedAt: true,
});

export const insertDrinkCollectionPurchaseSchema = createInsertSchema(drinkCollectionPurchases).omit({
  id: true,
  createdAt: true,
});

export const insertDrinkCollectionWishlistSchema = createInsertSchema(drinkCollectionWishlists).omit({
  id: true,
  createdAt: true,
});

export const insertDrinkCollectionReviewSchema = createInsertSchema(drinkCollectionReviews).omit({
  id: true,
  isVerifiedPurchase: true,
  createdAt: true,
  updatedAt: true,
});

export const insertDrinkCollectionPromotionSchema = createInsertSchema(drinkCollectionPromotions).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  redemptionCount: true,
});

export const insertDrinkBundleSchema = createInsertSchema(drinkBundles).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertCreatorMembershipPlanSchema = createInsertSchema(creatorMembershipPlans).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertCreatorMembershipSchema = createInsertSchema(creatorMemberships).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertCreatorPostSchema = createInsertSchema(creatorPosts).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertCreatorDropSchema = createInsertSchema(creatorDrops).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertCreatorDropRsvpSchema = createInsertSchema(creatorDropRsvps).omit({
  id: true,
  createdAt: true,
});

export const insertCreatorRoadmapItemSchema = createInsertSchema(creatorRoadmapItems).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertCreatorCampaignSchema = createInsertSchema(creatorCampaigns).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertCreatorCampaignRolloutTimelineEventSchema = createInsertSchema(creatorCampaignRolloutTimelineEvents).omit({
  id: true,
  createdAt: true,
});

export const insertCreatorCampaignTemplateSchema = createInsertSchema(creatorCampaignTemplates).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertCreatorCampaignLinkSchema = createInsertSchema(creatorCampaignLinks).omit({
  id: true,
  createdAt: true,
});

export const insertCreatorCampaignFollowSchema = createInsertSchema(creatorCampaignFollows).omit({
  id: true,
  createdAt: true,
});

export const insertCreatorCampaignGoalSchema = createInsertSchema(creatorCampaignGoals).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertCreatorCampaignActionStateSchema = createInsertSchema(creatorCampaignActionStates).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertCreatorCampaignExperimentSchema = createInsertSchema(creatorCampaignExperiments).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertCreatorCampaignCtaVariantSchema = createInsertSchema(creatorCampaignCtaVariants).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertCreatorCampaignVariantEventSchema = createInsertSchema(creatorCampaignVariantEvents).omit({
  id: true,
  createdAt: true,
});

export const insertCreatorCampaignSpotlightEventSchema = createInsertSchema(creatorCampaignSpotlightEvents).omit({
  id: true,
  createdAt: true,
});

export const insertCreatorCampaignSurfaceEventSchema = createInsertSchema(creatorCampaignSurfaceEvents).omit({
  id: true,
  createdAt: true,
});

export const insertCreatorDropEventSchema = createInsertSchema(creatorDropEvents).omit({
  id: true,
  createdAt: true,
});

export const insertCreatorCollaborationSchema = createInsertSchema(creatorCollaborations).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertDrinkBundleItemSchema = createInsertSchema(drinkBundleItems).omit({
  addedAt: true,
});

export const insertDrinkBundlePurchaseSchema = createInsertSchema(drinkBundlePurchases).omit({
  id: true,
  createdAt: true,
});

export const insertDrinkChallengeSchema = createInsertSchema(drinkChallenges).omit({
  id: true,
  createdAt: true,
});

export const insertDrinkChallengeSubmissionSchema = createInsertSchema(drinkChallengeSubmissions).omit({
  id: true,
  createdAt: true,
});

export const insertRecipeSaveSchema = createInsertSchema(recipeSaves).omit({
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

export const insertPaymentMethodSchema = createInsertSchema(paymentMethods).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertCommissionSchema = createInsertSchema(commissions).omit({
  id: true,
  createdAt: true,
});

export const insertPayoutSchema = createInsertSchema(payouts).omit({
  id: true,
  createdAt: true,
});

export const insertPayoutScheduleSchema = createInsertSchema(payoutSchedules).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

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
  createdAt: true,
});

export const insertProductAllergenSchema = createInsertSchema(productAllergens).omit({
  id: true,
  createdAt: true,
});

export const insertClubSchema = createInsertSchema(clubs).omit({
  id: true,
  createdAt: true,
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
});

export const insertChallengeSchema = createInsertSchema(challenges).omit({
  id: true,
  createdAt: true,
});

export const insertChallengeProgressSchema = createInsertSchema(challengeProgress).omit({
  id: true,
  createdAt: true,
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
export type RecipeReview = typeof recipeReviews.$inferSelect;
export type InsertRecipeReview = z.infer<typeof insertRecipeReviewSchema>;
export type RecipeReviewPhoto = typeof recipeReviewPhotos.$inferSelect;
export type InsertRecipeReviewPhoto = z.infer<typeof insertRecipeReviewPhotoSchema>;
export type ReviewHelpful = typeof reviewHelpful.$inferSelect;
export type InsertReviewHelpful = z.infer<typeof insertReviewHelpfulSchema>;
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
export type MealStreak = typeof mealStreaks.$inferSelect;
export type InsertMealStreak = z.infer<typeof insertMealStreakSchema>;
export type BodyMetric = typeof bodyMetrics.$inferSelect;
export type InsertBodyMetric = z.infer<typeof insertBodyMetricSchema>;
export type MealFavorite = typeof mealFavorites.$inferSelect;
export type InsertMealFavorite = z.infer<typeof insertMealFavoriteSchema>;
export type WaterLog = typeof waterLogs.$inferSelect;
export type InsertWaterLog = z.infer<typeof insertWaterLogSchema>;
export type MealPlanBlueprint = typeof mealPlanBlueprints.$inferSelect;
export type BlueprintVersion = typeof blueprintVersions.$inferSelect;
export type MealPlanPurchase = typeof mealPlanPurchases.$inferSelect;
export type MealPlanReview = typeof mealPlanReviews.$inferSelect;
export type CreatorAnalytics = typeof creatorAnalytics.$inferSelect;
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
export type DrinkEvent = typeof drinkEvents.$inferSelect;
export type InsertDrinkEvent = z.infer<typeof insertDrinkEventSchema>;
export type PetFoodEvent = typeof petFoodEvents.$inferSelect;
export type InsertPetFoodEvent = z.infer<typeof insertPetFoodEventSchema>;
export type DrinkRecipe = typeof drinkRecipes.$inferSelect;
export type InsertDrinkRecipe = z.infer<typeof insertDrinkRecipeSchema>;
export type DrinkCollection = typeof drinkCollections.$inferSelect;
export type InsertDrinkCollection = z.infer<typeof insertDrinkCollectionSchema>;
export type DrinkCollectionItem = typeof drinkCollectionItems.$inferSelect;
export type InsertDrinkCollectionItem = z.infer<typeof insertDrinkCollectionItemSchema>;
export type DrinkCollectionPurchase = typeof drinkCollectionPurchases.$inferSelect;
export type InsertDrinkCollectionPurchase = z.infer<typeof insertDrinkCollectionPurchaseSchema>;
export type DrinkCollectionWishlist = typeof drinkCollectionWishlists.$inferSelect;
export type InsertDrinkCollectionWishlist = z.infer<typeof insertDrinkCollectionWishlistSchema>;
export type DrinkCollectionReview = typeof drinkCollectionReviews.$inferSelect;
export type InsertDrinkCollectionReview = z.infer<typeof insertDrinkCollectionReviewSchema>;
export type DrinkCollectionPromotion = typeof drinkCollectionPromotions.$inferSelect;
export type InsertDrinkCollectionPromotion = z.infer<typeof insertDrinkCollectionPromotionSchema>;
export type CreatorMembershipPlan = typeof creatorMembershipPlans.$inferSelect;
export type InsertCreatorMembershipPlan = z.infer<typeof insertCreatorMembershipPlanSchema>;
export type CreatorMembership = typeof creatorMemberships.$inferSelect;
export type InsertCreatorMembership = z.infer<typeof insertCreatorMembershipSchema>;
export type CreatorPost = typeof creatorPosts.$inferSelect;
export type InsertCreatorPost = z.infer<typeof insertCreatorPostSchema>;
export type CreatorDrop = typeof creatorDrops.$inferSelect;
export type InsertCreatorDrop = z.infer<typeof insertCreatorDropSchema>;
export type CreatorDropRsvp = typeof creatorDropRsvps.$inferSelect;
export type InsertCreatorDropRsvp = z.infer<typeof insertCreatorDropRsvpSchema>;
export type CreatorRoadmapItem = typeof creatorRoadmapItems.$inferSelect;
export type InsertCreatorRoadmapItem = z.infer<typeof insertCreatorRoadmapItemSchema>;
export type CreatorCampaign = typeof creatorCampaigns.$inferSelect;
export type InsertCreatorCampaign = z.infer<typeof insertCreatorCampaignSchema>;
export type CreatorCampaignRolloutTimelineEvent = typeof creatorCampaignRolloutTimelineEvents.$inferSelect;
export type InsertCreatorCampaignRolloutTimelineEvent = z.infer<typeof insertCreatorCampaignRolloutTimelineEventSchema>;
export type CreatorCampaignTemplate = typeof creatorCampaignTemplates.$inferSelect;
export type InsertCreatorCampaignTemplate = z.infer<typeof insertCreatorCampaignTemplateSchema>;
export type CreatorCampaignLink = typeof creatorCampaignLinks.$inferSelect;
export type InsertCreatorCampaignLink = z.infer<typeof insertCreatorCampaignLinkSchema>;
export type CreatorCampaignFollow = typeof creatorCampaignFollows.$inferSelect;
export type InsertCreatorCampaignFollow = z.infer<typeof insertCreatorCampaignFollowSchema>;
export type CreatorCampaignActionState = typeof creatorCampaignActionStates.$inferSelect;
export type InsertCreatorCampaignActionState = z.infer<typeof insertCreatorCampaignActionStateSchema>;
export type CreatorCampaignExperiment = typeof creatorCampaignExperiments.$inferSelect;
export type InsertCreatorCampaignExperiment = z.infer<typeof insertCreatorCampaignExperimentSchema>;
export type CreatorCampaignCtaVariant = typeof creatorCampaignCtaVariants.$inferSelect;
export type InsertCreatorCampaignCtaVariant = z.infer<typeof insertCreatorCampaignCtaVariantSchema>;
export type CreatorCampaignVariantEvent = typeof creatorCampaignVariantEvents.$inferSelect;
export type InsertCreatorCampaignVariantEvent = z.infer<typeof insertCreatorCampaignVariantEventSchema>;
export type CreatorCampaignSpotlightEvent = typeof creatorCampaignSpotlightEvents.$inferSelect;
export type InsertCreatorCampaignSpotlightEvent = z.infer<typeof insertCreatorCampaignSpotlightEventSchema>;
export type CreatorCampaignSurfaceEvent = typeof creatorCampaignSurfaceEvents.$inferSelect;
export type InsertCreatorCampaignSurfaceEvent = z.infer<typeof insertCreatorCampaignSurfaceEventSchema>;
export type CreatorDropEvent = typeof creatorDropEvents.$inferSelect;
export type InsertCreatorDropEvent = z.infer<typeof insertCreatorDropEventSchema>;
export type CreatorCollaboration = typeof creatorCollaborations.$inferSelect;
export type InsertCreatorCollaboration = z.infer<typeof insertCreatorCollaborationSchema>;
export type DrinkBundle = typeof drinkBundles.$inferSelect;
export type InsertDrinkBundle = z.infer<typeof insertDrinkBundleSchema>;
export type DrinkBundleItem = typeof drinkBundleItems.$inferSelect;
export type InsertDrinkBundleItem = z.infer<typeof insertDrinkBundleItemSchema>;
export type DrinkBundlePurchase = typeof drinkBundlePurchases.$inferSelect;
export type InsertDrinkBundlePurchase = z.infer<typeof insertDrinkBundlePurchaseSchema>;
export type DrinkChallenge = typeof drinkChallenges.$inferSelect;
export type InsertDrinkChallenge = z.infer<typeof insertDrinkChallengeSchema>;
export type DrinkChallengeSubmission = typeof drinkChallengeSubmissions.$inferSelect;
export type InsertDrinkChallengeSubmission = z.infer<typeof insertDrinkChallengeSubmissionSchema>;
export type RecipeSave = typeof recipeSaves.$inferSelect;
export type InsertRecipeSave = z.infer<typeof insertRecipeSaveSchema>;
export type UserDrinkStats = typeof userDrinkStats.$inferSelect;
export type InsertUserDrinkStats = z.infer<typeof insertUserDrinkStatsSchema>;
export type Store = typeof stores.$inferSelect;
export type InsertStore = z.infer<typeof insertStoreSchema>;
export type PaymentMethod = typeof paymentMethods.$inferSelect;
export type InsertPaymentMethod = z.infer<typeof insertPaymentMethodSchema>;
export type Commission = typeof commissions.$inferSelect;
export type InsertCommission = z.infer<typeof insertCommissionSchema>;
export type Payout = typeof payouts.$inferSelect;
export type InsertPayout = z.infer<typeof insertPayoutSchema>;
export type PayoutSchedule = typeof payoutSchedules.$inferSelect;
export type InsertPayoutSchedule = z.infer<typeof insertPayoutScheduleSchema>;
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

// A like on a comment.  Contains the ids of the user and comment as well as a
// timestamp.  See the commentLikes table definition for details.
export type CommentLike = typeof commentLikes.$inferSelect;
export type InsertCommentLike = z.infer<typeof insertCommentLikeSchema>;

/* ===== NEW TYPE ===== */
export type EmailVerificationToken = typeof emailVerificationTokens.$inferSelect;
export type WeddingRsvpInvitation = typeof weddingRsvpInvitations.$inferSelect;

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

/* =========================================================================
   ===== PHASE 1: DAILY ADDICTION FEATURES
   ========================================================================= */

// Notifications - Real-time user notifications
export const notifications = pgTable(
  "notifications",
  {
    id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
    userId: varchar("user_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
    type: text("type").notNull(), // follow, like, comment, badge_earned, quest_completed, friend_activity, suggestion
    title: text("title").notNull(),
    message: text("message").notNull(),
    imageUrl: text("image_url"),
    linkUrl: text("link_url"),
    metadata: jsonb("metadata").$type<Record<string, any>>().default(sql`'{}'::jsonb`),
    read: boolean("read").default(false),
    readAt: timestamp("read_at"),
    priority: text("priority").default("normal"), // low, normal, high, urgent
    createdAt: timestamp("created_at").defaultNow(),
  },
  (table) => ({
    userIdx: index("notifications_user_idx").on(table.userId),
    readIdx: index("notifications_read_idx").on(table.read),
    typeIdx: index("notifications_type_idx").on(table.type),
    createdIdx: index("notifications_created_idx").on(table.createdAt),
  })
);

// Daily Quests - Quick daily missions for engagement
export const dailyQuests = pgTable(
  "daily_quests",
  {
    id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
    slug: text("slug").notNull().unique(),
    title: text("title").notNull(),
    description: text("description").notNull(),
    questType: text("quest_type").notNull(), // make_drink, try_category, use_ingredient, social_action, streak_milestone
    category: text("category"), // drinks category if applicable
    targetValue: integer("target_value").default(1), // how many to complete
    xpReward: integer("xp_reward").default(50),
    badgeReward: varchar("badge_reward").references(() => badges.id),
    difficulty: text("difficulty").default("easy"), // easy, medium, hard
    isActive: boolean("is_active").default(true),
    recurringPattern: text("recurring_pattern"), // daily, weekly, weekend_only, weekday_only
    metadata: jsonb("metadata").$type<{
      ingredient?: string;
      drinkCategory?: string;
      weatherCondition?: string;
      timeOfDay?: string;
      requiredAction?: string;
    }>().default(sql`'{}'::jsonb`),
    createdAt: timestamp("created_at").defaultNow(),
  },
  (table) => ({
    slugIdx: uniqueIndex("daily_quest_slug_idx").on(table.slug),
    activeIdx: index("daily_quest_active_idx").on(table.isActive),
    typeIdx: index("daily_quest_type_idx").on(table.questType),
  })
);

// Quest Progress - Track user daily quest completion
export const questProgress = pgTable(
  "quest_progress",
  {
    id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
    userId: varchar("user_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
    questId: varchar("quest_id").references(() => dailyQuests.id, { onDelete: "cascade" }).notNull(),
    date: timestamp("date").notNull(), // which day this quest was active for user
    currentProgress: integer("current_progress").default(0),
    targetProgress: integer("target_progress").notNull(),
    status: text("status").default("active"), // active, completed, expired
    completedAt: timestamp("completed_at"),
    xpEarned: integer("xp_earned").default(0),
    createdAt: timestamp("created_at").defaultNow(),
  },
  (table) => ({
    userDateIdx: index("quest_progress_user_date_idx").on(table.userId, table.date),
    questUserIdx: index("quest_progress_quest_user_idx").on(table.questId, table.userId),
    statusIdx: index("quest_progress_status_idx").on(table.status),
  })
);

// Recipe Remixes - Track recipe forks and variations
export const recipeRemixes = pgTable(
  "recipe_remixes",
  {
    id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
    originalRecipeId: varchar("original_recipe_id").references(() => recipes.id).notNull(),
    remixedRecipeId: varchar("remixed_recipe_id").references(() => recipes.id).notNull(),
    userId: varchar("user_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
    remixType: text("remix_type").default("variation"), // variation, dietary_conversion, portion_adjustment, ingredient_swap
    changes: jsonb("changes").$type<{
      addedIngredients?: string[];
      removedIngredients?: string[];
      modifiedIngredients?: Array<{ original: string; new: string; reason?: string }>;
      nutritionChanges?: Record<string, number>;
      prepTimeChange?: number;
      difficultyChange?: string;
      notes?: string;
    }>().default(sql`'{}'::jsonb`),
    likesCount: integer("likes_count").default(0),
    savesCount: integer("saves_count").default(0),
    remixCount: integer("remix_count").default(0), // how many times this remix was remixed
    isPublic: boolean("is_public").default(true),
    createdAt: timestamp("created_at").defaultNow(),
  },
  (table) => ({
    originalIdx: index("recipe_remix_original_idx").on(table.originalRecipeId),
    remixedIdx: index("recipe_remix_remixed_idx").on(table.remixedRecipeId),
    userIdx: index("recipe_remix_user_idx").on(table.userId),
    publicIdx: index("recipe_remix_public_idx").on(table.isPublic),
  })
);

// AI Suggestions - Smart daily personalized suggestions
export const aiSuggestions = pgTable(
  "ai_suggestions",
  {
    id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
    userId: varchar("user_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
    date: timestamp("date").notNull(),
    suggestionType: text("suggestion_type").notNull(), // morning_drink, post_workout, nutrition_gap, weather_based, mood_based
    recipeId: varchar("recipe_id").references(() => recipes.id),
    customDrinkId: varchar("custom_drink_id").references(() => customDrinks.id),
    title: text("title").notNull(),
    reason: text("reason").notNull(), // why this suggestion was made
    confidence: decimal("confidence", { precision: 3, scale: 2 }), // 0.00-1.00
    metadata: jsonb("metadata").$type<{
      weather?: { temp: number; condition: string; };
      nutritionGap?: { nutrient: string; current: number; target: number; };
      mood?: string;
      timeOfDay?: string;
      recentActivity?: string;
    }>().default(sql`'{}'::jsonb`),
    viewed: boolean("viewed").default(false),
    viewedAt: timestamp("viewed_at"),
    accepted: boolean("accepted").default(false), // did user make this drink?
    acceptedAt: timestamp("accepted_at"),
    dismissed: boolean("dismissed").default(false),
    dismissedAt: timestamp("dismissed_at"),
    createdAt: timestamp("created_at").defaultNow(),
  },
  (table) => ({
    userDateIdx: index("ai_suggestions_user_date_idx").on(table.userId, table.date),
    typeIdx: index("ai_suggestions_type_idx").on(table.suggestionType),
    viewedIdx: index("ai_suggestions_viewed_idx").on(table.viewed),
  })
);

/* ===== ADVANCED MEAL PLANNING FEATURES ===== */

// AI-powered meal recommendations
export const mealRecommendations = pgTable(
  "meal_recommendations",
  {
    id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
    userId: varchar("user_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
    recipeId: varchar("recipe_id").references(() => recipes.id),
    blueprintId: varchar("blueprint_id").references(() => mealPlanBlueprints.id),
    recommendationType: text("recommendation_type").notNull(), // goal_based, seasonal, nutritional_balance, preference_based
    targetDate: timestamp("target_date"),
    mealType: text("meal_type"), // breakfast, lunch, dinner, snack
    score: decimal("score", { precision: 3, scale: 2 }).notNull(), // 0.00-1.00
    reason: text("reason").notNull(),
    metadata: jsonb("metadata").$type<{
      nutritionGaps?: string[];
      seasonalIngredients?: string[];
      goalAlignment?: string;
      varietyScore?: number;
    }>().default(sql`'{}'::jsonb`),
    accepted: boolean("accepted").default(false),
    dismissed: boolean("dismissed").default(false),
    createdAt: timestamp("created_at").defaultNow(),
  },
  (table) => ({
    userIdx: index("meal_recommendations_user_idx").on(table.userId),
    dateIdx: index("meal_recommendations_date_idx").on(table.targetDate),
    scoreIdx: index("meal_recommendations_score_idx").on(table.score),
  })
);

// Meal prep scheduling
export const mealPrepSchedules = pgTable(
  "meal_prep_schedules",
  {
    id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
    userId: varchar("user_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
    mealPlanId: varchar("meal_plan_id").references(() => mealPlans.id),
    prepDay: text("prep_day").notNull(), // monday, tuesday, etc.
    prepTime: text("prep_time"), // HH:MM format
    batchRecipes: jsonb("batch_recipes").$type<{
      recipeId: string;
      portions: number;
      forDates: string[];
    }[]>().default(sql`'[]'::jsonb`),
    shoppingDay: text("shopping_day"),
    notes: text("notes"),
    isRunningLow: boolean("is_running_low").default(false),
    reminderEnabled: boolean("reminder_enabled").default(true),
    reminderTime: text("reminder_time"), // HH:MM format
    completed: boolean("completed").default(false),
    completedAt: timestamp("completed_at"),
    createdAt: timestamp("created_at").defaultNow(),
  },
  (table) => ({
    userIdx: index("meal_prep_schedules_user_idx").on(table.userId),
    prepDayIdx: index("meal_prep_schedules_prep_day_idx").on(table.prepDay),
  })
);

// Leftover tracking
export const leftovers = pgTable(
  "leftovers",
  {
    id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
    userId: varchar("user_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
    recipeId: varchar("recipe_id").references(() => recipes.id),
    recipeName: text("recipe_name").notNull(),
    quantity: text("quantity"), // "2 servings", "1/2 container"
    storedDate: timestamp("stored_date").notNull(),
    expiryDate: timestamp("expiry_date"),
    storageLocation: text("storage_location"), // fridge, freezer
    notes: text("notes"),
    isRunningLow: boolean("is_running_low").default(false),
    consumed: boolean("consumed").default(false),
    consumedAt: timestamp("consumed_at"),
    wasted: boolean("wasted").default(false),
    repurposedInto: varchar("repurposed_into").references(() => recipes.id),
    createdAt: timestamp("created_at").defaultNow(),
  },
  (table) => ({
    userIdx: index("leftovers_user_idx").on(table.userId),
    expiryIdx: index("leftovers_expiry_idx").on(table.expiryDate),
    consumedIdx: index("leftovers_consumed_idx").on(table.consumed),
  })
);

// Enhanced grocery list with budget tracking
export const groceryListItems = pgTable(
  "grocery_list_items",
  {
    id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
    userId: varchar("user_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
    mealPlanId: varchar("meal_plan_id").references(() => mealPlans.id),
    listName: text("list_name").default("My Grocery List"),
    ingredientName: text("ingredient_name").notNull(),
    quantity: text("quantity"),
    unit: text("unit"),
    location: text("location"),
    category: text("category"), // produce, dairy, meat, pantry, etc.
    estimatedPrice: decimal("estimated_price", { precision: 8, scale: 2 }),
    actualPrice: decimal("actual_price", { precision: 8, scale: 2 }),
    store: text("store"),
    aisle: text("aisle"), // for store layout optimization
    priority: text("priority").default("normal"), // high, normal, low
    isPantryItem: boolean("is_pantry_item").default(false), // already in pantry
    purchased: boolean("purchased").default(false),
    purchasedAt: timestamp("purchased_at"),
    notes: text("notes"),
    isRunningLow: boolean("is_running_low").default(false),
    createdAt: timestamp("created_at").defaultNow(),
  },
  (table) => ({
    userIdx: index("grocery_list_items_user_idx").on(table.userId),
    categoryIdx: index("grocery_list_items_category_idx").on(table.category),
    purchasedIdx: index("grocery_list_items_purchased_idx").on(table.purchased),
  })
);

// User progress through meal plans
export const userMealPlanProgress = pgTable(
  "user_meal_plan_progress",
  {
    id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
    userId: varchar("user_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
    mealPlanId: varchar("meal_plan_id").references(() => mealPlans.id),
    blueprintId: varchar("blueprint_id").references(() => mealPlanBlueprints.id),
    startDate: timestamp("start_date").notNull(),
    currentDay: integer("current_day").default(1),
    totalDays: integer("total_days").notNull(),
    mealsCompleted: integer("meals_completed").default(0),
    mealsTotal: integer("meals_total").notNull(),
    adherenceRate: decimal("adherence_rate", { precision: 5, scale: 2 }).default("0"), // percentage
    averageRating: decimal("average_rating", { precision: 3, scale: 2 }),
    goalsMet: jsonb("goals_met").$type<{
      calorieGoal: boolean;
      macroGoals: boolean;
      varietyGoal: boolean;
    }>().default(sql`'{}'::jsonb`),
    completed: boolean("completed").default(false),
    completedAt: timestamp("completed_at"),
    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow(),
  },
  (table) => ({
    userIdx: index("user_meal_plan_progress_user_idx").on(table.userId),
    completedIdx: index("user_meal_plan_progress_completed_idx").on(table.completed),
  })
);

// Meal plan achievements
export const mealPlanAchievements = pgTable(
  "meal_plan_achievements",
  {
    id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
    name: text("name").notNull().unique(),
    description: text("description").notNull(),
    icon: text("icon"),
    category: text("category").notNull(), // consistency, variety, nutrition, social
    requirement: jsonb("requirement").$type<{
      type: string; // days_streak, plans_completed, recipes_tried, calories_tracked
      threshold: number;
    }>().notNull(),
    points: integer("points").default(10),
    tier: text("tier").default("bronze"), // bronze, silver, gold, platinum
    createdAt: timestamp("created_at").defaultNow(),
  }
);

// User achievements tracking
export const userMealPlanAchievements = pgTable(
  "user_meal_plan_achievements",
  {
    id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
    userId: varchar("user_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
    achievementId: varchar("achievement_id").references(() => mealPlanAchievements.id).notNull(),
    progress: integer("progress").default(0),
    completed: boolean("completed").default(false),
    completedAt: timestamp("completed_at"),
    createdAt: timestamp("created_at").defaultNow(),
  },
  (table) => ({
    userIdx: index("user_meal_plan_achievements_user_idx").on(table.userId),
    completedIdx: index("user_meal_plan_achievements_completed_idx").on(table.completed),
  })
);

// Family meal profiles for household planning
export const familyMealProfiles = pgTable(
  "family_meal_profiles",
  {
    id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
    userId: varchar("user_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
    familyMemberId: varchar("family_member_id").references(() => familyMembers.id),
    name: text("name").notNull(),
    calorieTarget: integer("calorie_target"),
    macroGoals: jsonb("macro_goals").$type<{ protein: number; carbs: number; fat: number }>(),
    preferences: jsonb("preferences").$type<string[]>().default(sql`'[]'::jsonb`),
    dislikes: jsonb("dislikes").$type<string[]>().default(sql`'[]'::jsonb`),
    portionMultiplier: decimal("portion_multiplier", { precision: 3, scale: 2 }).default("1.00"), // 0.5 for kids, etc.
    isActive: boolean("is_active").default(true),
    createdAt: timestamp("created_at").defaultNow(),
  },
  (table) => ({
    userIdx: index("family_meal_profiles_user_idx").on(table.userId),
  })
);

/* =========================================================================
   ===== PHASE 1 INSERT SCHEMAS
   ========================================================================= */
export const insertNotificationSchema = createInsertSchema(notifications).omit({
  id: true,
  createdAt: true,
});

export const insertDailyQuestSchema = createInsertSchema(dailyQuests).omit({
  id: true,
  createdAt: true,
});

export const insertQuestProgressSchema = createInsertSchema(questProgress).omit({
  id: true,
  createdAt: true,
});

export const insertRecipeRemixSchema = createInsertSchema(recipeRemixes).omit({
  id: true,
  createdAt: true,
});

export const insertAiSuggestionSchema = createInsertSchema(aiSuggestions).omit({
  id: true,
  createdAt: true,
});

/* =========================================================================
   ===== PHASE 1 TYPES
   ========================================================================= */
export type Notification = typeof notifications.$inferSelect;
export type DailyQuest = typeof dailyQuests.$inferSelect;
export type QuestProgress = typeof questProgress.$inferSelect;
export type RecipeRemix = typeof recipeRemixes.$inferSelect;
export type AiSuggestion = typeof aiSuggestions.$inferSelect;

export type NotificationWithDetails = Notification & {
  relatedUser?: User;
  relatedRecipe?: Recipe;
};

export type QuestProgressWithQuest = QuestProgress & {
  quest: DailyQuest;
};

export type RecipeRemixWithDetails = RecipeRemix & {
  originalRecipe: Recipe;
  remixedRecipe: Recipe;
  user: User;
  isLiked?: boolean;
  isSaved?: boolean;
};

export type AiSuggestionWithRecipe = AiSuggestion & {
  recipe?: Recipe;
  customDrink?: CustomDrink;
};
