-- Phase 2: Social Explosion Features Migration
-- Tables: recipe_duets, cook_together_sessions, cook_together_participants,
--         seasonal_events, event_participants, event_leaderboard,
--         competition_votes, competition_judges

-- ============================================================================
-- RECIPE DUETS: Side-by-side video responses to recipes
-- ============================================================================
CREATE TABLE IF NOT EXISTS "recipe_duets" (
  "id" varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  "original_recipe_id" varchar NOT NULL REFERENCES "recipes"("id") ON DELETE CASCADE,
  "original_user_id" varchar NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "duet_user_id" varchar NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "duet_video_url" text,
  "duet_image_url" text,
  "caption" text,
  "likes_count" integer DEFAULT 0,
  "views_count" integer DEFAULT 0,
  "is_public" boolean DEFAULT true,
  "created_at" timestamp DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "recipe_duets_original_recipe_idx" ON "recipe_duets" ("original_recipe_id");
CREATE INDEX IF NOT EXISTS "recipe_duets_duet_user_idx" ON "recipe_duets" ("duet_user_id");
CREATE INDEX IF NOT EXISTS "recipe_duets_created_idx" ON "recipe_duets" ("created_at" DESC);

-- ============================================================================
-- COOK TOGETHER: Live cooking sessions with multiple participants
-- ============================================================================
CREATE TABLE IF NOT EXISTS "cook_together_sessions" (
  "id" varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  "recipe_id" varchar NOT NULL REFERENCES "recipes"("id") ON DELETE CASCADE,
  "host_user_id" varchar NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "title" text NOT NULL,
  "description" text,
  "scheduled_for" timestamp,
  "started_at" timestamp,
  "ended_at" timestamp,
  "max_participants" integer DEFAULT 10,
  "status" text DEFAULT 'scheduled', -- scheduled, active, completed, cancelled
  "recording_url" text,
  "thumbnail_url" text,
  "is_public" boolean DEFAULT true,
  "room_code" varchar(8) UNIQUE,
  "metadata" jsonb DEFAULT '{}'::jsonb,
  "created_at" timestamp DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "cook_together_sessions_host_idx" ON "cook_together_sessions" ("host_user_id");
CREATE INDEX IF NOT EXISTS "cook_together_sessions_status_idx" ON "cook_together_sessions" ("status");
CREATE INDEX IF NOT EXISTS "cook_together_sessions_scheduled_idx" ON "cook_together_sessions" ("scheduled_for");
CREATE UNIQUE INDEX IF NOT EXISTS "cook_together_sessions_room_code_idx" ON "cook_together_sessions" ("room_code");

CREATE TABLE IF NOT EXISTS "cook_together_participants" (
  "id" varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  "session_id" varchar NOT NULL REFERENCES "cook_together_sessions"("id") ON DELETE CASCADE,
  "user_id" varchar NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "joined_at" timestamp DEFAULT now(),
  "left_at" timestamp,
  "completed" boolean DEFAULT false,
  "photo_url" text,
  "rating" integer CHECK (rating >= 1 AND rating <= 5),
  "feedback" text
);

CREATE INDEX IF NOT EXISTS "cook_together_participants_session_idx" ON "cook_together_participants" ("session_id");
CREATE INDEX IF NOT EXISTS "cook_together_participants_user_idx" ON "cook_together_participants" ("user_id");
CREATE UNIQUE INDEX IF NOT EXISTS "cook_together_participants_unique_idx" ON "cook_together_participants" ("session_id", "user_id");

-- ============================================================================
-- SEASONAL EVENTS: Time-limited challenges and competitions
-- ============================================================================
CREATE TABLE IF NOT EXISTS "seasonal_events" (
  "id" varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  "slug" text NOT NULL UNIQUE,
  "title" text NOT NULL,
  "description" text NOT NULL,
  "event_type" text NOT NULL, -- challenge, competition, theme, milestone
  "category" text, -- drinks, recipes, social, streak
  "start_date" timestamp NOT NULL,
  "end_date" timestamp NOT NULL,
  "rules" jsonb DEFAULT '{}'::jsonb,
  "rewards" jsonb DEFAULT '{}'::jsonb, -- {first: {xp: 1000, badge: "id"}, ...}
  "image_url" text,
  "banner_url" text,
  "is_active" boolean DEFAULT true,
  "is_featured" boolean DEFAULT false,
  "participation_count" integer DEFAULT 0,
  "metadata" jsonb DEFAULT '{}'::jsonb,
  "created_at" timestamp DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS "seasonal_events_slug_idx" ON "seasonal_events" ("slug");
CREATE INDEX IF NOT EXISTS "seasonal_events_dates_idx" ON "seasonal_events" ("start_date", "end_date");
CREATE INDEX IF NOT EXISTS "seasonal_events_active_idx" ON "seasonal_events" ("is_active", "is_featured");
CREATE INDEX IF NOT EXISTS "seasonal_events_type_idx" ON "seasonal_events" ("event_type");

CREATE TABLE IF NOT EXISTS "event_participants" (
  "id" varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  "event_id" varchar NOT NULL REFERENCES "seasonal_events"("id") ON DELETE CASCADE,
  "user_id" varchar NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "score" integer DEFAULT 0,
  "rank" integer,
  "progress" jsonb DEFAULT '{}'::jsonb, -- Event-specific progress tracking
  "joined_at" timestamp DEFAULT now(),
  "completed_at" timestamp,
  "reward_claimed" boolean DEFAULT false,
  "reward_claimed_at" timestamp
);

CREATE INDEX IF NOT EXISTS "event_participants_event_idx" ON "event_participants" ("event_id");
CREATE INDEX IF NOT EXISTS "event_participants_user_idx" ON "event_participants" ("user_id");
CREATE INDEX IF NOT EXISTS "event_participants_score_idx" ON "event_participants" ("event_id", "score" DESC);
CREATE UNIQUE INDEX IF NOT EXISTS "event_participants_unique_idx" ON "event_participants" ("event_id", "user_id");

CREATE TABLE IF NOT EXISTS "event_leaderboard" (
  "id" varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  "event_id" varchar NOT NULL REFERENCES "seasonal_events"("id") ON DELETE CASCADE,
  "user_id" varchar NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "points" integer DEFAULT 0,
  "rank" integer NOT NULL,
  "previous_rank" integer,
  "rank_change" integer DEFAULT 0, -- positive = moved up, negative = moved down
  "achievements" jsonb DEFAULT '[]'::jsonb,
  "last_updated" timestamp DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "event_leaderboard_event_idx" ON "event_leaderboard" ("event_id");
CREATE INDEX IF NOT EXISTS "event_leaderboard_rank_idx" ON "event_leaderboard" ("event_id", "rank");
CREATE INDEX IF NOT EXISTS "event_leaderboard_points_idx" ON "event_leaderboard" ("event_id", "points" DESC);
CREATE UNIQUE INDEX IF NOT EXISTS "event_leaderboard_unique_idx" ON "event_leaderboard" ("event_id", "user_id");

-- ============================================================================
-- COMPETITIONS & ENTRIES: Base competition system
-- ============================================================================
CREATE TABLE IF NOT EXISTS "competitions" (
  "id" varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  "title" text NOT NULL,
  "description" text,
  "start_date" timestamp NOT NULL,
  "end_date" timestamp NOT NULL,
  "status" text DEFAULT 'draft', -- draft, active, judging, completed
  "created_by" varchar REFERENCES "users"("id"),
  "created_at" timestamp DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "competition_entries" (
  "id" varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  "competition_id" varchar NOT NULL REFERENCES "competitions"("id") ON DELETE CASCADE,
  "user_id" varchar NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "recipe_id" varchar REFERENCES "recipes"("id"),
  "title" text NOT NULL,
  "description" text,
  "image_url" text,
  "submitted_at" timestamp DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "competition_entries_competition_idx" ON "competition_entries" ("competition_id");
CREATE INDEX IF NOT EXISTS "competition_entries_user_idx" ON "competition_entries" ("user_id");

-- ============================================================================
-- ENHANCED COMPETITIONS: Voting and judging system
-- ============================================================================
CREATE TABLE IF NOT EXISTS "competition_votes" (
  "id" varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  "competition_id" varchar NOT NULL REFERENCES "competitions"("id") ON DELETE CASCADE,
  "entry_id" varchar NOT NULL REFERENCES "competition_entries"("id") ON DELETE CASCADE,
  "user_id" varchar NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "vote_type" text NOT NULL, -- upvote, star, judge_score
  "score" integer CHECK (score >= 1 AND score <= 10), -- For judge scoring
  "comment" text,
  "created_at" timestamp DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "competition_votes_competition_idx" ON "competition_votes" ("competition_id");
CREATE INDEX IF NOT EXISTS "competition_votes_entry_idx" ON "competition_votes" ("entry_id");
CREATE INDEX IF NOT EXISTS "competition_votes_user_idx" ON "competition_votes" ("user_id");
CREATE UNIQUE INDEX IF NOT EXISTS "competition_votes_unique_idx" ON "competition_votes" ("competition_id", "entry_id", "user_id", "vote_type");

CREATE TABLE IF NOT EXISTS "competition_judges" (
  "id" varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  "competition_id" varchar NOT NULL REFERENCES "competitions"("id") ON DELETE CASCADE,
  "user_id" varchar NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "is_lead_judge" boolean DEFAULT false,
  "specialty" text, -- desserts, drinks, health, presentation
  "bio" text,
  "assigned_at" timestamp DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "competition_judges_competition_idx" ON "competition_judges" ("competition_id");
CREATE INDEX IF NOT EXISTS "competition_judges_user_idx" ON "competition_judges" ("user_id");
CREATE UNIQUE INDEX IF NOT EXISTS "competition_judges_unique_idx" ON "competition_judges" ("competition_id", "user_id");

-- ============================================================================
-- GRANTS: Ensure proper permissions
-- ============================================================================
-- Grant SELECT on all new tables to authenticated users
-- (Adjust based on your auth system)
