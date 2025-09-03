import { sql } from "drizzle-orm";
import { pgTable, text, varchar, integer, boolean, timestamp, jsonb, decimal, index } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// ===== EXISTING TABLES =====
export const users = pgTable("users", {
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
  cateringLocation: text("catering_location"), // postal code for privacy
  cateringRadius: integer("catering_radius").default(25), // miles
  cateringBio: text("catering_bio"), // separate bio for catering services
  cateringAvailable: boolean("catering_available").default(true), // can toggle availability
  subscriptionTier: text("subscription_tier").default("free"), // free, starter, professional, enterprise, premium_plus
  subscriptionStatus: text("subscription_status").default("active"), // active, cancelled, past_due
  subscriptionEndsAt: timestamp("subscription_ends_at"),
  monthlyRevenue: decimal("monthly_revenue", { precision: 10, scale: 2 }).default("0"), // for commission calculations
  nutritionPremium: boolean("nutrition_premium").default(false),
  nutritionTrialEndsAt: timestamp("nutrition_trial_ends_at"),
  dailyCalorieGoal: integer("daily_calorie_goal"),
  macroGoals: jsonb("macro_goals").$type<{ protein: number; carbs: number; fat: number }>(),
  dietaryRestrictions: jsonb("dietary_restrictions").$type<string[]>().default([]),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => ({
  cateringLocationIdx: index("catering_location_idx").on(table.cateringLocation),
  subscriptionTierIdx: index("subscription_tier_idx").on(table.subscriptionTier),
}));

export const posts = pgTable("posts", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id).notNull(),
  caption: text("caption"),
  imageUrl: text("image_url").notNull(),
  tags: jsonb("tags").$type<string[]>().default([]),
  likesCount: integer("likes_count").default(0),
  commentsCount: integer("comments_count").default(0),
  isRecipe: boolean("is_recipe").default(false),
  createdAt: timestamp("created_at").defaultNow(),
});

export const recipes = pgTable("recipes", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  postId: varchar("post_id").references(() => posts.id).notNull(),
  title: text("title").notNull(),
  ingredients: jsonb("ingredients").$type<string[]>().notNull(),
  instructions: jsonb("instructions").$type<string[]>().notNull(),
  cookTime: integer("cook_time"), // in minutes
  servings: integer("servings"),
  difficulty: text("difficulty"), // Easy, Medium, Hard
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

// ===== NEW TABLES FOR EXPANDED FEATURES =====

// CATERING SYSTEM
export const cateringInquiries = pgTable("catering_inquiries", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  customerId: varchar("customer_id").references(() => users.id).notNull(),
  chefId: varchar("chef_id").references(() => users.id).notNull(),
  eventDate: timestamp("event_date").notNull(),
  guestCount: integer("guest_count"),
  eventType: text("event_type"), // wedding, corporate, birthday, etc
  cuisinePreferences: jsonb("cuisine_preferences").$type<string[]>().default([]),
  budget: decimal("budget", { precision: 10, scale: 2 }),
  message: text("message"),
  status: text("status").default("pending"), // pending, accepted, declined, completed
  createdAt: timestamp("created_at").defaultNow(),
});

// MARKETPLACE SYSTEM
export const products = pgTable("products", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  sellerId: varchar("seller_id").references(() => users.id).notNull(),
  name: text("name").notNull(),
  description: text("description"),
  price: decimal("price", { precision: 10, scale: 2 }).notNull(),
  category: text("category").notNull(), // spices, ingredients, cookware, cookbooks
  images: jsonb("images").$type<string[]>().default([]),
  inventory: integer("inventory").default(0),
  shippingEnabled: boolean("shipping_enabled").default(true),
  localPickupEnabled: boolean("local_pickup_enabled").default(false),
  pickupLocation: text("pickup_location"), // postal code
  pickupInstructions: text("pickup_instructions"),
  shippingCost: decimal("shipping_cost", { precision: 8, scale: 2 }),
  isExternal: boolean("is_external").default(false),
  externalUrl: text("external_url"),
  salesCount: integer("sales_count").default(0),
  viewsCount: integer("views_count").default(0),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => ({
  categoryIdx: index("products_category_idx").on(table.category),
  sellerIdx: index("products_seller_idx").on(table.sellerId),
  pickupLocationIdx: index("products_pickup_location_idx").on(table.pickupLocation),
}));

export const orders = pgTable("orders", {
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
  fulfillmentMethod: text("fulfillment_method").notNull(), // shipping, pickup
  status: text("status").default("pending"), // pending, paid, shipped, delivered, cancelled
  trackingNumber: text("tracking_number"),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => ({
  buyerIdx: index("orders_buyer_idx").on(table.buyerId),
  sellerIdx: index("orders_seller_idx").on(table.sellerId),
  statusIdx: index("orders_status_idx").on(table.status),
}));

// SUBSCRIPTION MANAGEMENT
export const subscriptionHistory = pgTable("subscription_history", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id).notNull(),
  tier: text("tier").notNull(),
  amount: decimal("amount", { precision: 8, scale: 2 }).notNull(),
  startDate: timestamp("start_date").notNull(),
  endDate: timestamp("end_date").notNull(),
  status: text("status").notNull(), // active, cancelled, expired
  paymentMethod: text("payment_method"),
  createdAt: timestamp("created_at").defaultNow(),
});

// MEAL PLANNING SYSTEM
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
  mealType: text("meal_type").notNull(), // breakfast, lunch, dinner, snack
  servings: integer("servings").default(1),
  customName: text("custom_name"), // for non-recipe meals
  customCalories: integer("custom_calories"),
});

// PANTRY MANAGEMENT
export const pantryItems = pgTable("pantry_items", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id).notNull(),
  name: text("name").notNull(),
  category: text("category"), // vegetables, proteins, spices, etc
  quantity: decimal("quantity", { precision: 8, scale: 2 }),
  unit: text("unit"), // cups, lbs, oz, etc
  expirationDate: timestamp("expiration_date"),
  purchaseDate: timestamp("purchase_date"),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => ({
  userIdx: index("pantry_user_idx").on(table.userId),
  expirationIdx: index("pantry_expiration_idx").on(table.expirationDate),
}));

// NUTRITION TRACKING
export const nutritionLogs = pgTable("nutrition_logs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id).notNull(),
  date: timestamp("date").notNull(),
  mealType: text("meal_type").notNull(), // breakfast, lunch, dinner, snack
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
}, (table) => ({
  userDateIdx: index("nutrition_user_date_idx").on(table.userId, table.date),
}));

// INGREDIENT SUBSTITUTIONS
export const ingredientSubstitutions = pgTable("ingredient_substitutions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  originalIngredient: text("original_ingredient").notNull(),
  substituteIngredient: text("substitute_ingredient").notNull(),
  ratio: text("ratio").notNull(), // "1:1", "2:1", etc
  notes: text("notes"),
  category: text("category"), // dairy, gluten-free, vegan, etc
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => ({
  originalIdx: index("substitutions_original_idx").on(table.originalIngredient),
  categoryIdx: index("substitutions_category_idx").on(table.category),
}));

// ===== INSERT SCHEMAS =====
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

// ===== TYPES =====
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
export type Product = typeof products.$inferSelect;
export type InsertProduct = z.infer<typeof insertProductSchema>;
export type Order = typeof orders.$inferSelect;
export type MealPlan = typeof mealPlans.$inferSelect;
export type MealPlanEntry = typeof mealPlanEntries.$inferSelect;
export type PantryItem = typeof pantryItems.$inferSelect;
export type NutritionLog = typeof nutritionLogs.$inferSelect;
export type IngredientSubstitution = typeof ingredientSubstitutions.$inferSelect;

// Extended types for API responses
export type PostWithUser = Post & { user: User; recipe?: Recipe; isLiked?: boolean; isSaved?: boolean };
export type StoryWithUser = Story & { user: User };
export type CommentWithUser = Comment & { user: User };
export type ProductWithSeller = Product & { seller: User };
export type OrderWithDetails = Order & { product: Product; seller: User; buyer: User };
export type MealPlanWithEntries = MealPlan & { entries: (MealPlanEntry & { recipe?: Recipe })[] };
export type ChefWithCatering = User & { availableForCatering: boolean; distance?: number };
