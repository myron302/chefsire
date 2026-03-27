import { sql } from "drizzle-orm";
import { pgTable, text, varchar, integer, boolean, timestamp, date, decimal, index, uniqueIndex } from "drizzle-orm/pg-core";
import { users } from "./users-auth";
import { recipes } from "./social-content";

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
