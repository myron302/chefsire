import { sql } from "drizzle-orm";
import { index, integer, jsonb, pgTable, text, timestamp, varchar } from "drizzle-orm/pg-core";
import { users } from "./users-auth";

export const adaptivePlannerSnapshots = pgTable("adaptive_planner_snapshots", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id).notNull(),
  weekKey: text("week_key").notNull(),
  snapshotVersion: integer("snapshot_version").notNull().default(1),
  objectiveState: jsonb("objective_state").$type<Record<string, unknown>>().notNull().default(sql`'{}'::jsonb`),
  adherenceState: jsonb("adherence_state").$type<Record<string, unknown>>().notNull().default(sql`'{}'::jsonb`),
  sustainabilityState: jsonb("sustainability_state").$type<Record<string, unknown>>().notNull().default(sql`'{}'::jsonb`),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (t) => ({
  userWeekIdx: index("adaptive_planner_snapshots_user_week_idx").on(t.userId, t.weekKey),
}));

export const adaptivePlannerProfiles = pgTable("adaptive_planner_profiles", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id).notNull(),
  profileVersion: text("profile_version").notNull().default("v1"),
  plannerMode: text("planner_mode").notNull().default("balanced"),
  adaptationCadence: text("adaptation_cadence").notNull().default("weekly"),
  currentGoalFocus: text("current_goal_focus"),
  profileMetadata: jsonb("profile_metadata").$type<Record<string, unknown>>().notNull().default(sql`'{}'::jsonb`),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (t) => ({
  userIdx: index("adaptive_planner_profiles_user_idx").on(t.userId),
}));

export const nutritionPersonalityProfiles = pgTable("nutrition_personality_profiles", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id).notNull(),
  personalityVersion: integer("personality_version").notNull().default(1),
  consistencyScore: integer("consistency_score").notNull().default(0),
  noveltySeekingScore: integer("novelty_seeking_score").notNull().default(0),
  routineAffinityScore: integer("routine_affinity_score").notNull().default(0),
  preferenceTags: text("preference_tags").array().notNull().default(sql`'{}'::text[]`),
  profileMetadata: jsonb("profile_metadata").$type<Record<string, unknown>>().notNull().default(sql`'{}'::jsonb`),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (t) => ({
  userIdx: index("nutrition_personality_profiles_user_idx").on(t.userId),
}));

export const plannerRelationshipLearning = pgTable("planner_relationship_learning", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id).notNull(),
  relationshipVersion: integer("relationship_version").notNull().default(1),
  sourceDimension: text("source_dimension").notNull(),
  targetDimension: text("target_dimension").notNull(),
  confidenceScore: integer("confidence_score").notNull().default(0),
  relationshipMetadata: jsonb("relationship_metadata").$type<Record<string, unknown>>().notNull().default(sql`'{}'::jsonb`),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (t) => ({
  userDimensionIdx: index("planner_relationship_learning_user_dimension_idx").on(t.userId, t.sourceDimension, t.targetDimension),
}));

export const plannerObjectiveHistory = pgTable("planner_objective_history", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id).notNull(),
  objectiveVersion: integer("objective_version").notNull().default(1),
  objectiveKey: text("objective_key").notNull(),
  objectiveStatus: text("objective_status").notNull().default("active"),
  objectiveScore: integer("objective_score").notNull().default(0),
  summaryMetadata: jsonb("summary_metadata").$type<Record<string, unknown>>().notNull().default(sql`'{}'::jsonb`),
  observedAt: timestamp("observed_at").defaultNow().notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (t) => ({
  userObjectiveIdx: index("planner_objective_history_user_objective_idx").on(t.userId, t.objectiveKey),
}));
