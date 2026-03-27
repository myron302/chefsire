import { sql } from "drizzle-orm";
import { pgTable, text, varchar, integer, boolean, timestamp, jsonb, decimal, index, uniqueIndex } from "drizzle-orm/pg-core";
import { users } from "./users-auth";
import { recipes } from "./social-content";
import { badges, familyMembers } from "./pantry-allergens-community";
import { customDrinks } from "./drinks-creator";
import { mealPlanBlueprints, mealPlans } from "./meal-planning";

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
