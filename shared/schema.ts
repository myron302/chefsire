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

// ===== NEW TABLES (ABRIDGED FOR BREVITY) =====
export const cateringInquiries = pgTable("catering_inquiries", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  customerId: varchar("customer_id").references(() => users.id).notNull(),
  chefId: varchar("chef_id").references(() => users.id).notNull(),
  eventDate: timestamp("event_date").notNull(),
  guestCount: integer("guest_count"),
  eventType: text("event_type"),
  cuisinePreferences: jsonb("cuisine_preferences").$type<string[]>().default([]),
  budget: decimal("budget", { precision: 10, scale: 2 }),
  message: text("message"),
  status: text("status").default("pending"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const products = pgTable("products", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  sellerId: varchar("seller_id").references(() => users.id).notNull(),
  name: text("name").notNull(),
  price: decimal("price", { precision: 10, scale: 2 }).notNull(),
  category: text("category").notNull(),
  images: jsonb("images").$type<string[]>().default([]),
  inventory: integer("inventory").default(0),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
});

export const orders = pgTable("orders", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  buyerId: varchar("buyer_id").references(() => users.id).notNull(),
  sellerId: varchar("seller_id").references(() => users.id).notNull(),
  productId: varchar("product_id").references(() => products.id).notNull(),
  quantity: integer("quantity").notNull(),
  totalAmount: decimal("total_amount", { precision: 10, scale: 2 }).notNull(),
  platformFee: decimal("platform_fee", { precision: 8, scale: 2 }).notNull(),
  sellerAmount: decimal("seller_amount", { precision: 10, scale: 2 }).notNull(),
  fulfillmentMethod: text("fulfillment_method").notNull(),
  status: text("status").default("pending"),
  createdAt: timestamp("created_at").defaultNow(),
});

// ... (other tables like mealPlans, pantryItems, etc., omitted for brevity but include as needed)

// ===== INSERT SCHEMAS =====
export const insertUserSchema = createInsertSchema(users).omit({
  id: true,
  followersCount: true,
  followingCount: true,
  postsCount: true,
  monthlyRevenue: true,
  createdAt: true,
});

export const insertStorySchema = createInsertSchema(stories).omit({
  id: true,
  createdAt: true,
});

// ... (other insert schemas as needed)

// ===== TYPES =====
export type User = typeof users.$inferSelect;
export type Story = typeof stories.$inferSelect;
export type StoryWithUser = Story & { user: User };
// ... (other types as needed)
