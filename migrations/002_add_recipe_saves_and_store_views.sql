-- Migration: Add recipe_saves table and viewCount to stores
-- Date: 2025-12-20

-- Add recipe_saves table (similar to drink_saves)
CREATE TABLE IF NOT EXISTS "recipe_saves" (
  "id" varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  "user_id" varchar NOT NULL REFERENCES "users"("id"),
  "recipe_id" varchar NOT NULL REFERENCES "recipes"("id") ON DELETE CASCADE,
  "created_at" timestamp DEFAULT now() NOT NULL
);

-- Create unique index to prevent duplicate saves
CREATE UNIQUE INDEX IF NOT EXISTS "recipe_saves_user_recipe_idx" ON "recipe_saves" ("user_id", "recipe_id");

-- Add viewCount column to stores table
ALTER TABLE "stores" ADD COLUMN IF NOT EXISTS "view_count" integer DEFAULT 0;
