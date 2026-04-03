import { sql } from "drizzle-orm";
import { db } from "../../db/index.js";

let advancedMealPlanningSchemaReady: Promise<void> | null = null;

export async function ensureAdvancedMealPlanningSchema() {
  if (advancedMealPlanningSchemaReady) return advancedMealPlanningSchemaReady;

  advancedMealPlanningSchemaReady = (async () => {
    if (!db) {
      throw new Error("Database is not configured (missing DATABASE_URL).");
    }

    await db.execute(sql`CREATE EXTENSION IF NOT EXISTS pgcrypto;`);

    await db.execute(sql`
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
    `);

    await db.execute(sql`CREATE INDEX IF NOT EXISTS meal_recommendations_user_idx ON meal_recommendations(user_id);`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS meal_recommendations_date_idx ON meal_recommendations(target_date);`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS meal_recommendations_score_idx ON meal_recommendations(score);`);

    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS meal_prep_schedules (
        id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id VARCHAR NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        meal_plan_id VARCHAR REFERENCES meal_plans(id),
        prep_day TEXT NOT NULL,
        prep_time TEXT,
        batch_recipes JSONB DEFAULT '[]'::jsonb,
        shopping_day TEXT,
        notes TEXT,
        is_running_low BOOLEAN DEFAULT false,
        reminder_enabled BOOLEAN DEFAULT true,
        reminder_time TEXT,
        completed BOOLEAN DEFAULT false,
        completed_at TIMESTAMP,
        created_at TIMESTAMP DEFAULT NOW()
      );
    `);

    await db.execute(sql`CREATE INDEX IF NOT EXISTS meal_prep_schedules_user_idx ON meal_prep_schedules(user_id);`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS meal_prep_schedules_prep_day_idx ON meal_prep_schedules(prep_day);`);

    await db.execute(sql`
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
        is_running_low BOOLEAN DEFAULT false,
        consumed BOOLEAN DEFAULT false,
        consumed_at TIMESTAMP,
        wasted BOOLEAN DEFAULT false,
        repurposed_into VARCHAR REFERENCES recipes(id),
        created_at TIMESTAMP DEFAULT NOW()
      );
    `);

    await db.execute(sql`CREATE INDEX IF NOT EXISTS leftovers_user_idx ON leftovers(user_id);`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS leftovers_expiry_idx ON leftovers(expiry_date);`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS leftovers_consumed_idx ON leftovers(consumed);`);

    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS grocery_list_items (
        id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id VARCHAR NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        meal_plan_id VARCHAR REFERENCES meal_plans(id),
        list_name TEXT DEFAULT 'My Grocery List',
        ingredient_name TEXT NOT NULL,
        quantity TEXT,
        unit TEXT,
        category TEXT,
        location TEXT,
        estimated_price DECIMAL(8, 2),
        actual_price DECIMAL(8, 2),
        store TEXT,
        aisle TEXT,
        priority TEXT DEFAULT 'normal',
        is_pantry_item BOOLEAN DEFAULT false,
        is_running_low BOOLEAN DEFAULT false,
        purchased BOOLEAN DEFAULT false,
        purchased_at TIMESTAMP,
        notes TEXT,
        created_at TIMESTAMP DEFAULT NOW()
      );
    `);

    await db.execute(sql`CREATE INDEX IF NOT EXISTS grocery_list_items_user_idx ON grocery_list_items(user_id);`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS grocery_list_items_category_idx ON grocery_list_items(category);`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS grocery_list_items_purchased_idx ON grocery_list_items(purchased);`);

    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS meal_streaks (
        id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id VARCHAR NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        current_streak INTEGER NOT NULL DEFAULT 0,
        longest_streak INTEGER NOT NULL DEFAULT 0,
        last_logged_date DATE,
        updated_at TIMESTAMP DEFAULT NOW()
      );
    `);

    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS body_metrics (
        id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id VARCHAR NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        date DATE NOT NULL,
        weight_lbs DECIMAL(8, 2) NOT NULL,
        body_fat_pct DECIMAL(5, 2),
        waist_in DECIMAL(6, 2),
        hip_in DECIMAL(6, 2),
        created_at TIMESTAMP DEFAULT NOW()
      );
    `);

    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS meal_favorites (
        id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id VARCHAR NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        meal_name TEXT NOT NULL,
        calories INTEGER,
        protein INTEGER,
        carbs INTEGER,
        fat INTEGER,
        fiber INTEGER,
        is_favorite BOOLEAN DEFAULT false,
        times_logged INTEGER DEFAULT 0,
        last_used TIMESTAMP
      );
    `);

    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS water_logs (
        id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id VARCHAR NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        date DATE NOT NULL,
        glasses_logged INTEGER NOT NULL DEFAULT 0,
        daily_target INTEGER NOT NULL DEFAULT 8,
        updated_at TIMESTAMP DEFAULT NOW()
      );
    `);

    await db.execute(sql`CREATE UNIQUE INDEX IF NOT EXISTS water_logs_user_date_uidx ON water_logs(user_id, date);`);
    await db.execute(sql`CREATE UNIQUE INDEX IF NOT EXISTS meal_streaks_user_uidx ON meal_streaks(user_id);`);
    await db.execute(sql`ALTER TABLE meal_plan_entries ADD COLUMN IF NOT EXISTS source VARCHAR(50);`);

    await db.execute(sql`ALTER TABLE meal_prep_schedules ADD COLUMN IF NOT EXISTS is_running_low BOOLEAN DEFAULT false;`);
    await db.execute(sql`ALTER TABLE leftovers ADD COLUMN IF NOT EXISTS is_running_low BOOLEAN DEFAULT false;`);
    await db.execute(sql`ALTER TABLE grocery_list_items ADD COLUMN IF NOT EXISTS location TEXT;`);
    await db.execute(sql`ALTER TABLE grocery_list_items ADD COLUMN IF NOT EXISTS is_running_low BOOLEAN DEFAULT false;`);

    await db.execute(sql`UPDATE meal_prep_schedules SET is_running_low = false WHERE is_running_low IS NULL;`);
    await db.execute(sql`UPDATE leftovers SET is_running_low = false WHERE is_running_low IS NULL;`);
    await db.execute(sql`UPDATE grocery_list_items SET is_running_low = false WHERE is_running_low IS NULL;`);
  })();

  return advancedMealPlanningSchemaReady;
}
