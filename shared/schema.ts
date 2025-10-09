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
