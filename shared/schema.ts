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


export const follows = pgTable("follows", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  followerId: varchar("follower_id").references(() => users.id).notNull(),
  followingId: varchar("following_id").references(() => users.id).notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

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

/* ===== ALLERGEN MANAGEMENT ===== */
export const familyMembers = pgTable(
  "family_members",
  {
    id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
    userId: varchar("user_id").references(() => users.id).notNull(),
    name: text("name").notNull(),
    relationship: text("relationship"),
    dateOfBirth: timestamp("date_of_birth"),
    species: text("species").default("human"),
    notes: text("notes"),
    createdAt: timestamp("created_at").defaultNow(),
  },
  (table) => ({
    userIdx: index("family_members_user_idx").on(table.userId),
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
