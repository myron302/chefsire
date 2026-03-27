import { sql } from "drizzle-orm";
import { pgTable, text, varchar, integer, boolean, timestamp, jsonb, decimal, index, uniqueIndex } from "drizzle-orm/pg-core";
import { users } from "./users-auth";
import { recipes } from "./social-content";

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

