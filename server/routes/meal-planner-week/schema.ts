import { sql } from "drizzle-orm";
import { db } from "../../db/index.js";
import { createRetryableInit } from "../../lib/retryable-init.js";

/**
 * Single-flight, and a failed attempt is retried after a bounded backoff instead of being cached for the life of the process
 * (see lib/retryable-init.ts). Every statement below is idempotent.
 */
export const mealPlannerWeekSchemaInit = createRetryableInit({
  name: "meal-planner-week-schema",
  run: async () => {
    await db.execute(sql`ALTER TABLE meal_plan_entries ADD COLUMN IF NOT EXISTS custom_protein INTEGER;`);
    await db.execute(sql`ALTER TABLE meal_plan_entries ADD COLUMN IF NOT EXISTS custom_carbs INTEGER;`);
    await db.execute(sql`ALTER TABLE meal_plan_entries ADD COLUMN IF NOT EXISTS custom_fat INTEGER;`);
    await db.execute(sql`ALTER TABLE meal_plan_entries ADD COLUMN IF NOT EXISTS meal_items JSONB;`);
    await db.execute(sql`ALTER TABLE meal_plan_entries ADD COLUMN IF NOT EXISTS source VARCHAR(50);`);
    await db.execute(sql`ALTER TABLE meal_plan_entries ADD COLUMN IF NOT EXISTS source_recipe_id TEXT;`);
    await db.execute(sql`ALTER TABLE meal_plan_entries ADD COLUMN IF NOT EXISTS source_recipe_title TEXT;`);
    await db.execute(sql`ALTER TABLE meal_plan_entries ADD COLUMN IF NOT EXISTS source_recipe_image_url TEXT;`);
    await db.execute(sql`ALTER TABLE meal_plan_entries ADD COLUMN IF NOT EXISTS source_recipe_servings INTEGER;`);
    await db.execute(sql`ALTER TABLE meal_plan_entries ADD COLUMN IF NOT EXISTS source_recipe_url TEXT;`);
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS meal_plan_week_shares (
        id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id VARCHAR NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        week_anchor DATE NOT NULL,
        visibility VARCHAR(20) NOT NULL DEFAULT 'private',
        summary_fingerprint VARCHAR(200),
        public_share_token VARCHAR(80),
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW(),
        UNIQUE(user_id, week_anchor),
        UNIQUE(public_share_token)
      );
    `);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_meal_plan_week_shares_user_week ON meal_plan_week_shares(user_id, week_anchor);`);
  },
});

export async function ensureMealPlannerWeekSchema(): Promise<void> {
  return mealPlannerWeekSchemaInit.ensure();
}
