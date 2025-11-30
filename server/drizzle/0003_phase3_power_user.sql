-- Phase 3: Power User Features Migration
-- Tables: user_analytics, taste_profiles, health_integrations, health_sync_log
-- Enhancements: notifications (add context and scheduling)

-- ============================================================================
-- USER ANALYTICS: Comprehensive user statistics and insights
-- ============================================================================
CREATE TABLE IF NOT EXISTS "user_analytics" (
  "id" varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  "user_id" varchar NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "date" date NOT NULL,

  -- Recipe Stats
  "total_recipes_made" integer DEFAULT 0,
  "total_drinks_made" integer DEFAULT 0,
  "unique_recipes_tried" integer DEFAULT 0,
  "favorite_category" text,
  "recipes_by_category" jsonb DEFAULT '{}'::jsonb,

  -- Nutrition Stats
  "total_calories" integer DEFAULT 0,
  "total_protein" decimal(10,2) DEFAULT 0,
  "total_carbs" decimal(10,2) DEFAULT 0,
  "total_fat" decimal(10,2) DEFAULT 0,
  "total_sugar" decimal(10,2) DEFAULT 0,
  "total_fiber" decimal(10,2) DEFAULT 0,

  -- Ingredient Stats
  "most_used_ingredient" text,
  "total_unique_ingredients" integer DEFAULT 0,
  "ingredient_usage" jsonb DEFAULT '{}'::jsonb, -- {ingredient_id: count}

  -- Time & Cost Stats
  "avg_prep_time" integer, -- minutes
  "total_prep_time" integer, -- minutes
  "total_cost" decimal(10,2) DEFAULT 0,
  "avg_cost_per_recipe" decimal(10,2) DEFAULT 0,

  -- Social Stats
  "recipes_shared" integer DEFAULT 0,
  "likes_received" integer DEFAULT 0,
  "comments_made" integer DEFAULT 0,

  -- Streak Stats
  "current_streak" integer DEFAULT 0,
  "longest_streak" integer DEFAULT 0,

  -- Metadata
  "created_at" timestamp DEFAULT now(),
  "updated_at" timestamp DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "user_analytics_user_date_idx" ON "user_analytics" ("user_id", "date" DESC);
CREATE INDEX IF NOT EXISTS "user_analytics_date_idx" ON "user_analytics" ("date" DESC);
CREATE UNIQUE INDEX IF NOT EXISTS "user_analytics_unique_idx" ON "user_analytics" ("user_id", "date");

-- ============================================================================
-- TASTE PROFILES: User flavor preferences and dietary patterns
-- ============================================================================
CREATE TABLE IF NOT EXISTS "taste_profiles" (
  "id" varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  "user_id" varchar NOT NULL UNIQUE REFERENCES "users"("id") ON DELETE CASCADE,

  -- Taste Dimensions (0-100 scale)
  "sweet_score" integer DEFAULT 50 CHECK (sweet_score >= 0 AND sweet_score <= 100),
  "salty_score" integer DEFAULT 50 CHECK (salty_score >= 0 AND salty_score <= 100),
  "sour_score" integer DEFAULT 50 CHECK (sour_score >= 0 AND sour_score <= 100),
  "bitter_score" integer DEFAULT 50 CHECK (bitter_score >= 0 AND bitter_score <= 100),
  "umami_score" integer DEFAULT 50 CHECK (umami_score >= 0 AND umami_score <= 100),
  "spicy_score" integer DEFAULT 50 CHECK (spicy_score >= 0 AND spicy_score <= 100),

  -- Texture Preferences
  "texture_preferences" jsonb DEFAULT '{}'::jsonb, -- smooth, chunky, creamy, icy

  -- Category Preferences (ordered by preference)
  "preferred_categories" jsonb DEFAULT '[]'::jsonb, -- [category1, category2, ...]
  "avoided_categories" jsonb DEFAULT '[]'::jsonb,

  -- Ingredient Preferences
  "favorite_ingredients" jsonb DEFAULT '[]'::jsonb, -- [ingredient_id1, ...]
  "avoided_ingredients" jsonb DEFAULT '[]'::jsonb,
  "allergens" jsonb DEFAULT '[]'::jsonb,

  -- Dietary Patterns
  "dietary_restrictions" jsonb DEFAULT '[]'::jsonb, -- vegan, keto, etc.
  "health_goals" jsonb DEFAULT '[]'::jsonb, -- weight_loss, muscle_gain, etc.

  -- Time Preferences
  "preferred_prep_time" integer, -- max minutes willing to spend
  "preferred_times_of_day" jsonb DEFAULT '[]'::jsonb, -- breakfast, lunch, etc.

  -- Confidence Scores (how well we know their preferences)
  "profile_confidence" decimal(3,2) DEFAULT 0.00, -- 0.00 to 1.00
  "last_analyzed" timestamp,

  "created_at" timestamp DEFAULT now(),
  "updated_at" timestamp DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS "taste_profiles_user_idx" ON "taste_profiles" ("user_id");

-- ============================================================================
-- HEALTH INTEGRATIONS: Connected health apps and devices
-- ============================================================================
CREATE TABLE IF NOT EXISTS "health_integrations" (
  "id" varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  "user_id" varchar NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "provider" text NOT NULL, -- apple_health, google_fit, fitbit, myfitnesspal
  "provider_user_id" text,

  -- OAuth Tokens
  "access_token" text,
  "refresh_token" text,
  "token_expires_at" timestamp,

  -- Connection Info
  "connected_at" timestamp DEFAULT now(),
  "last_sync" timestamp,
  "next_sync" timestamp,
  "is_active" boolean DEFAULT true,

  -- Sync Settings
  "sync_settings" jsonb DEFAULT '{}'::jsonb, -- {auto_sync: true, sync_nutrition: true, ...}
  "sync_frequency" text DEFAULT 'hourly', -- hourly, daily, manual

  -- Scopes/Permissions
  "scopes" jsonb DEFAULT '[]'::jsonb, -- [nutrition, activity, sleep, ...]

  -- Metadata
  "metadata" jsonb DEFAULT '{}'::jsonb,
  "created_at" timestamp DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "health_integrations_user_idx" ON "health_integrations" ("user_id");
CREATE INDEX IF NOT EXISTS "health_integrations_provider_idx" ON "health_integrations" ("provider");
CREATE INDEX IF NOT EXISTS "health_integrations_active_idx" ON "health_integrations" ("is_active");
CREATE UNIQUE INDEX IF NOT EXISTS "health_integrations_unique_idx" ON "health_integrations" ("user_id", "provider");

-- ============================================================================
-- HEALTH SYNC LOG: Track synchronization history and errors
-- ============================================================================
CREATE TABLE IF NOT EXISTS "health_sync_log" (
  "id" varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  "user_id" varchar NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "integration_id" varchar NOT NULL REFERENCES "health_integrations"("id") ON DELETE CASCADE,
  "provider" text NOT NULL,

  -- Sync Details
  "sync_type" text NOT NULL, -- nutrition, activity, sleep, weight
  "sync_direction" text DEFAULT 'import', -- import, export, bidirectional
  "data_points" integer DEFAULT 0, -- number of records synced
  "date_range_start" timestamp,
  "date_range_end" timestamp,

  -- Status
  "status" text NOT NULL, -- success, partial, failed
  "error_code" text,
  "error_message" text,

  -- Performance
  "duration_ms" integer, -- sync duration in milliseconds
  "synced_at" timestamp DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "health_sync_log_user_idx" ON "health_sync_log" ("user_id");
CREATE INDEX IF NOT EXISTS "health_sync_log_integration_idx" ON "health_sync_log" ("integration_id");
CREATE INDEX IF NOT EXISTS "health_sync_log_synced_idx" ON "health_sync_log" ("synced_at" DESC);
CREATE INDEX IF NOT EXISTS "health_sync_log_status_idx" ON "health_sync_log" ("status");

-- ============================================================================
-- ENHANCED NOTIFICATIONS: Add context, scheduling, and smart delivery
-- ============================================================================
-- Add new columns to existing notifications table
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS "context_data" jsonb DEFAULT '{}'::jsonb;
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS "scheduled_for" timestamp;
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS "delivery_method" text DEFAULT 'in_app'; -- in_app, push, email, sms
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS "sent_at" timestamp;
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS "opened_at" timestamp;
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS "action_taken" boolean DEFAULT false;
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS "action_taken_at" timestamp;

-- Create indexes for new columns
CREATE INDEX IF NOT EXISTS "notifications_scheduled_idx" ON "notifications" ("scheduled_for");
CREATE INDEX IF NOT EXISTS "notifications_delivery_idx" ON "notifications" ("delivery_method");
CREATE INDEX IF NOT EXISTS "notifications_sent_idx" ON "notifications" ("sent_at");

-- ============================================================================
-- USER GOALS: Track personal health and cooking goals
-- ============================================================================
CREATE TABLE IF NOT EXISTS "user_goals" (
  "id" varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  "user_id" varchar NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "goal_type" text NOT NULL, -- nutrition, cooking_skill, social, streak, cost
  "title" text NOT NULL,
  "description" text,

  -- Target Metrics
  "target_value" decimal(10,2),
  "target_unit" text, -- calories, recipes, days, dollars, etc.
  "current_value" decimal(10,2) DEFAULT 0,
  "progress_percentage" integer DEFAULT 0,

  -- Timeframe
  "start_date" date NOT NULL,
  "end_date" date,
  "is_recurring" boolean DEFAULT false, -- daily, weekly, monthly goals
  "recurrence_pattern" text, -- daily, weekly, monthly

  -- Status
  "status" text DEFAULT 'active', -- active, completed, abandoned
  "completed_at" timestamp,

  -- Rewards
  "reward_xp" integer DEFAULT 0,
  "reward_badge_id" varchar,

  "created_at" timestamp DEFAULT now(),
  "updated_at" timestamp DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "user_goals_user_idx" ON "user_goals" ("user_id");
CREATE INDEX IF NOT EXISTS "user_goals_status_idx" ON "user_goals" ("status");
CREATE INDEX IF NOT EXISTS "user_goals_type_idx" ON "user_goals" ("goal_type");

-- ============================================================================
-- RECIPE TIMING: Track when users make recipes for smart suggestions
-- ============================================================================
CREATE TABLE IF NOT EXISTS "recipe_timing_log" (
  "id" varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  "user_id" varchar NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "recipe_id" varchar NOT NULL REFERENCES "recipes"("id") ON DELETE CASCADE,
  "made_at" timestamp NOT NULL DEFAULT now(),
  "time_of_day" text, -- morning, afternoon, evening, night
  "day_of_week" integer, -- 0-6 (Sunday-Saturday)
  "context" jsonb DEFAULT '{}'::jsonb -- weather, mood, activity_before, etc.
);

CREATE INDEX IF NOT EXISTS "recipe_timing_log_user_idx" ON "recipe_timing_log" ("user_id");
CREATE INDEX IF NOT EXISTS "recipe_timing_log_recipe_idx" ON "recipe_timing_log" ("recipe_id");
CREATE INDEX IF NOT EXISTS "recipe_timing_log_made_idx" ON "recipe_timing_log" ("made_at" DESC);
CREATE INDEX IF NOT EXISTS "recipe_timing_log_time_idx" ON "recipe_timing_log" ("time_of_day", "day_of_week");
