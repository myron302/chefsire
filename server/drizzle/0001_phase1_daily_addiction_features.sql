-- Phase 1: Daily Addiction Features Migration
-- Tables: notifications, daily_quests, quest_progress, recipe_remixes, ai_suggestions

-- Notifications table for real-time user notifications
CREATE TABLE IF NOT EXISTS "notifications" (
  "id" varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  "user_id" varchar NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "type" text NOT NULL, -- follow, like, comment, badge_earned, quest_completed, friend_activity, suggestion
  "title" text NOT NULL,
  "message" text NOT NULL,
  "image_url" text,
  "link_url" text,
  "metadata" jsonb DEFAULT '{}'::jsonb,
  "read" boolean DEFAULT false,
  "read_at" timestamp,
  "priority" text DEFAULT 'normal', -- low, normal, high, urgent
  "created_at" timestamp DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "notifications_user_idx" ON "notifications" ("user_id");
CREATE INDEX IF NOT EXISTS "notifications_read_idx" ON "notifications" ("read");
CREATE INDEX IF NOT EXISTS "notifications_type_idx" ON "notifications" ("type");
CREATE INDEX IF NOT EXISTS "notifications_created_idx" ON "notifications" ("created_at");

-- Daily Quests table for quick daily missions
CREATE TABLE IF NOT EXISTS "daily_quests" (
  "id" varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  "slug" text NOT NULL UNIQUE,
  "title" text NOT NULL,
  "description" text NOT NULL,
  "quest_type" text NOT NULL, -- make_drink, try_category, use_ingredient, social_action, streak_milestone
  "category" text,
  "target_value" integer DEFAULT 1,
  "xp_reward" integer DEFAULT 50,
  "badge_reward" varchar REFERENCES "badges"("id"),
  "difficulty" text DEFAULT 'easy', -- easy, medium, hard
  "is_active" boolean DEFAULT true,
  "recurring_pattern" text, -- daily, weekly, weekend_only, weekday_only
  "metadata" jsonb DEFAULT '{}'::jsonb,
  "created_at" timestamp DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS "daily_quest_slug_idx" ON "daily_quests" ("slug");
CREATE INDEX IF NOT EXISTS "daily_quest_active_idx" ON "daily_quests" ("is_active");
CREATE INDEX IF NOT EXISTS "daily_quest_type_idx" ON "daily_quests" ("quest_type");

-- Quest Progress table to track user quest completion
CREATE TABLE IF NOT EXISTS "quest_progress" (
  "id" varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  "user_id" varchar NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "quest_id" varchar NOT NULL REFERENCES "daily_quests"("id") ON DELETE CASCADE,
  "date" timestamp NOT NULL,
  "current_progress" integer DEFAULT 0,
  "target_progress" integer NOT NULL,
  "status" text DEFAULT 'active', -- active, completed, expired
  "completed_at" timestamp,
  "xp_earned" integer DEFAULT 0,
  "created_at" timestamp DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "quest_progress_user_date_idx" ON "quest_progress" ("user_id", "date");
CREATE INDEX IF NOT EXISTS "quest_progress_quest_user_idx" ON "quest_progress" ("quest_id", "user_id");
CREATE INDEX IF NOT EXISTS "quest_progress_status_idx" ON "quest_progress" ("status");

-- Recipe Remixes table to track recipe forks and variations
CREATE TABLE IF NOT EXISTS "recipe_remixes" (
  "id" varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  "original_recipe_id" varchar NOT NULL REFERENCES "recipes"("id"),
  "remixed_recipe_id" varchar NOT NULL REFERENCES "recipes"("id"),
  "user_id" varchar NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "remix_type" text DEFAULT 'variation', -- variation, dietary_conversion, portion_adjustment, ingredient_swap
  "changes" jsonb DEFAULT '{}'::jsonb,
  "likes_count" integer DEFAULT 0,
  "saves_count" integer DEFAULT 0,
  "remix_count" integer DEFAULT 0,
  "is_public" boolean DEFAULT true,
  "created_at" timestamp DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "recipe_remix_original_idx" ON "recipe_remixes" ("original_recipe_id");
CREATE INDEX IF NOT EXISTS "recipe_remix_remixed_idx" ON "recipe_remixes" ("remixed_recipe_id");
CREATE INDEX IF NOT EXISTS "recipe_remix_user_idx" ON "recipe_remixes" ("user_id");
CREATE INDEX IF NOT EXISTS "recipe_remix_public_idx" ON "recipe_remixes" ("is_public");

-- AI Suggestions table for smart daily personalized suggestions
CREATE TABLE IF NOT EXISTS "ai_suggestions" (
  "id" varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  "user_id" varchar NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "date" timestamp NOT NULL,
  "suggestion_type" text NOT NULL, -- morning_drink, post_workout, nutrition_gap, weather_based, mood_based
  "recipe_id" varchar REFERENCES "recipes"("id"),
  "custom_drink_id" varchar REFERENCES "custom_drinks"("id"),
  "title" text NOT NULL,
  "reason" text NOT NULL,
  "confidence" decimal(3, 2), -- 0.00-1.00
  "metadata" jsonb DEFAULT '{}'::jsonb,
  "viewed" boolean DEFAULT false,
  "viewed_at" timestamp,
  "accepted" boolean DEFAULT false,
  "accepted_at" timestamp,
  "dismissed" boolean DEFAULT false,
  "dismissed_at" timestamp,
  "created_at" timestamp DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "ai_suggestions_user_date_idx" ON "ai_suggestions" ("user_id", "date");
CREATE INDEX IF NOT EXISTS "ai_suggestions_type_idx" ON "ai_suggestions" ("suggestion_type");
CREATE INDEX IF NOT EXISTS "ai_suggestions_viewed_idx" ON "ai_suggestions" ("viewed");
