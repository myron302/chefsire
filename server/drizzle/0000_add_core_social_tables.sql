-- Migration: Add core social tables (posts, recipes, recipe_reviews)
-- These tables are required for posting and reviewing functionality

-- ============================================================================
-- POSTS: User posts with images and captions
-- ============================================================================
CREATE TABLE IF NOT EXISTS "posts" (
  "id" varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  "user_id" varchar NOT NULL REFERENCES "users"("id"),
  "caption" text,
  "image_url" text NOT NULL,
  "tags" jsonb DEFAULT '[]'::jsonb,
  "likes_count" integer DEFAULT 0,
  "comments_count" integer DEFAULT 0,
  "is_recipe" boolean DEFAULT false,
  "created_at" timestamp DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "posts_user_id_idx" ON "posts" ("user_id");
CREATE INDEX IF NOT EXISTS "posts_created_at_idx" ON "posts" ("created_at" DESC);

-- ============================================================================
-- RECIPES: Recipe details linked to posts
-- ============================================================================
CREATE TABLE IF NOT EXISTS "recipes" (
  "id" varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  "post_id" varchar REFERENCES "posts"("id"),
  "title" text NOT NULL,
  "image_url" text,
  "ingredients" jsonb NOT NULL,
  "instructions" jsonb NOT NULL,
  "cook_time" integer,
  "servings" integer,
  "difficulty" text,
  "nutrition" jsonb,
  "calories" integer,
  "protein" decimal(5, 2),
  "carbs" decimal(5, 2),
  "fat" decimal(5, 2),
  "fiber" decimal(5, 2),
  "average_rating" decimal(3, 2) DEFAULT 0,
  "review_count" integer DEFAULT 0
);

CREATE INDEX IF NOT EXISTS "recipes_post_id_idx" ON "recipes" ("post_id");
CREATE INDEX IF NOT EXISTS "recipes_title_idx" ON "recipes" ("title");

-- ============================================================================
-- RECIPE REVIEWS: User reviews for recipes
-- ============================================================================
CREATE TABLE IF NOT EXISTS "recipe_reviews" (
  "id" varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  "recipe_id" varchar NOT NULL REFERENCES "recipes"("id"),
  "user_id" varchar NOT NULL REFERENCES "users"("id"),
  "rating" integer NOT NULL,
  "review_text" text,
  "helpful_count" integer NOT NULL DEFAULT 0,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "recipe_reviews_recipe_id_idx" ON "recipe_reviews" ("recipe_id");
CREATE INDEX IF NOT EXISTS "recipe_reviews_user_id_idx" ON "recipe_reviews" ("user_id");
CREATE UNIQUE INDEX IF NOT EXISTS "recipe_reviews_unique_idx" ON "recipe_reviews" ("recipe_id", "user_id");

-- ============================================================================
-- RECIPE REVIEW PHOTOS: Photos attached to reviews
-- ============================================================================
CREATE TABLE IF NOT EXISTS "recipe_review_photos" (
  "id" varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  "review_id" varchar NOT NULL REFERENCES "recipe_reviews"("id"),
  "photo_url" text NOT NULL,
  "caption" text,
  "created_at" timestamp DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "recipe_review_photos_review_id_idx" ON "recipe_review_photos" ("review_id");

-- ============================================================================
-- REVIEW HELPFUL: Track which users found reviews helpful
-- ============================================================================
CREATE TABLE IF NOT EXISTS "review_helpful" (
  "id" varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  "review_id" varchar NOT NULL REFERENCES "recipe_reviews"("id"),
  "user_id" varchar NOT NULL REFERENCES "users"("id"),
  "created_at" timestamp DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "review_helpful_review_id_idx" ON "review_helpful" ("review_id");
CREATE UNIQUE INDEX IF NOT EXISTS "review_helpful_unique_idx" ON "review_helpful" ("review_id", "user_id");

-- ============================================================================
-- STORIES: User stories (24-hour content)
-- ============================================================================
CREATE TABLE IF NOT EXISTS "stories" (
  "id" varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  "user_id" varchar NOT NULL REFERENCES "users"("id"),
  "image_url" text NOT NULL,
  "caption" text,
  "expires_at" timestamp NOT NULL,
  "created_at" timestamp DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "stories_user_id_idx" ON "stories" ("user_id");
CREATE INDEX IF NOT EXISTS "stories_expires_at_idx" ON "stories" ("expires_at");

-- ============================================================================
-- LIKES: Post likes
-- ============================================================================
CREATE TABLE IF NOT EXISTS "likes" (
  "id" varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  "user_id" varchar NOT NULL REFERENCES "users"("id"),
  "post_id" varchar NOT NULL REFERENCES "posts"("id"),
  "created_at" timestamp DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "likes_user_id_idx" ON "likes" ("user_id");
CREATE INDEX IF NOT EXISTS "likes_post_id_idx" ON "likes" ("post_id");
CREATE UNIQUE INDEX IF NOT EXISTS "likes_unique_idx" ON "likes" ("user_id", "post_id");

-- ============================================================================
-- COMMENTS: Post comments
-- ============================================================================
CREATE TABLE IF NOT EXISTS "comments" (
  "id" varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  "user_id" varchar NOT NULL REFERENCES "users"("id"),
  "post_id" varchar NOT NULL REFERENCES "posts"("id"),
  "content" text NOT NULL,
  "created_at" timestamp DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "comments_user_id_idx" ON "comments" ("user_id");
CREATE INDEX IF NOT EXISTS "comments_post_id_idx" ON "comments" ("post_id");

-- ============================================================================
-- FOLLOWS: User follow relationships
-- ============================================================================
CREATE TABLE IF NOT EXISTS "follows" (
  "id" varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  "follower_id" varchar NOT NULL REFERENCES "users"("id"),
  "following_id" varchar NOT NULL REFERENCES "users"("id"),
  "created_at" timestamp DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "follows_follower_id_idx" ON "follows" ("follower_id");
CREATE INDEX IF NOT EXISTS "follows_following_id_idx" ON "follows" ("following_id");
CREATE UNIQUE INDEX IF NOT EXISTS "follows_unique_idx" ON "follows" ("follower_id", "following_id");
