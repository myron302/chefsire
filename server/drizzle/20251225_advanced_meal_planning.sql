-- Migration: Advanced Meal Planning Features
-- Created: 2025-12-25
-- Description: Creates tables for grocery lists, meal recommendations, meal prep schedules, and leftovers tracking

-- ========================================
-- MEAL RECOMMENDATIONS TABLE
-- ========================================
CREATE TABLE IF NOT EXISTS meal_recommendations (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id VARCHAR NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  recipe_id VARCHAR REFERENCES recipes(id),
  blueprint_id VARCHAR REFERENCES meal_plan_blueprints(id),
  recommendation_type TEXT NOT NULL,
  target_date TIMESTAMP,
  meal_type TEXT,
  score DECIMAL(3, 2) NOT NULL,
  reason TEXT NOT NULL,
  metadata JSONB DEFAULT '{}'::jsonb,
  accepted BOOLEAN DEFAULT false,
  dismissed BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS meal_recommendations_user_idx ON meal_recommendations(user_id);
CREATE INDEX IF NOT EXISTS meal_recommendations_date_idx ON meal_recommendations(target_date);
CREATE INDEX IF NOT EXISTS meal_recommendations_score_idx ON meal_recommendations(score);

-- ========================================
-- MEAL PREP SCHEDULES TABLE
-- ========================================
CREATE TABLE IF NOT EXISTS meal_prep_schedules (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id VARCHAR NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  meal_plan_id VARCHAR REFERENCES meal_plans(id),
  prep_day TEXT NOT NULL,
  prep_time TEXT,
  batch_recipes JSONB DEFAULT '[]'::jsonb,
  shopping_day TEXT,
  notes TEXT,
  reminder_enabled BOOLEAN DEFAULT true,
  reminder_time TEXT,
  completed BOOLEAN DEFAULT false,
  completed_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS meal_prep_schedules_user_idx ON meal_prep_schedules(user_id);
CREATE INDEX IF NOT EXISTS meal_prep_schedules_prep_day_idx ON meal_prep_schedules(prep_day);

-- ========================================
-- LEFTOVERS TABLE
-- ========================================
CREATE TABLE IF NOT EXISTS leftovers (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id VARCHAR NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  recipe_id VARCHAR REFERENCES recipes(id),
  recipe_name TEXT NOT NULL,
  quantity TEXT,
  stored_date TIMESTAMP NOT NULL,
  expiry_date TIMESTAMP,
  storage_location TEXT,
  notes TEXT,
  consumed BOOLEAN DEFAULT false,
  consumed_at TIMESTAMP,
  wasted BOOLEAN DEFAULT false,
  repurposed_into VARCHAR REFERENCES recipes(id),
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS leftovers_user_idx ON leftovers(user_id);
CREATE INDEX IF NOT EXISTS leftovers_expiry_idx ON leftovers(expiry_date);
CREATE INDEX IF NOT EXISTS leftovers_consumed_idx ON leftovers(consumed);

-- ========================================
-- GROCERY LIST ITEMS TABLE
-- ========================================
CREATE TABLE IF NOT EXISTS grocery_list_items (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id VARCHAR NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  meal_plan_id VARCHAR REFERENCES meal_plans(id),
  list_name TEXT DEFAULT 'My Grocery List',
  ingredient_name TEXT NOT NULL,
  quantity TEXT,
  unit TEXT,
  category TEXT,
  estimated_price DECIMAL(8, 2),
  actual_price DECIMAL(8, 2),
  store TEXT,
  aisle TEXT,
  priority TEXT DEFAULT 'normal',
  is_pantry_item BOOLEAN DEFAULT false,
  purchased BOOLEAN DEFAULT false,
  purchased_at TIMESTAMP,
  notes TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS grocery_list_items_user_idx ON grocery_list_items(user_id);
CREATE INDEX IF NOT EXISTS grocery_list_items_category_idx ON grocery_list_items(category);
CREATE INDEX IF NOT EXISTS grocery_list_items_purchased_idx ON grocery_list_items(purchased);

-- ========================================
-- GRANT PERMISSIONS
-- ========================================
-- Note: Neon doesn't use the 'authenticated' role (that's Supabase-specific)
-- Permissions are handled at the connection level in Neon
-- GRANT SELECT, INSERT, UPDATE, DELETE ON meal_recommendations TO authenticated;
-- GRANT SELECT, INSERT, UPDATE, DELETE ON meal_prep_schedules TO authenticated;
-- GRANT SELECT, INSERT, UPDATE, DELETE ON leftovers TO authenticated;
-- GRANT SELECT, INSERT, UPDATE, DELETE ON grocery_list_items TO authenticated;
