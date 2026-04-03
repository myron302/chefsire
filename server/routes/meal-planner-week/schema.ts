import { sql } from "drizzle-orm";
import { db } from "../../db/index.js";

let mealPlannerWeekSchemaReady: Promise<void> | null = null;

export async function ensureMealPlannerWeekSchema() {
  if (mealPlannerWeekSchemaReady) return mealPlannerWeekSchemaReady;

  mealPlannerWeekSchemaReady = (async () => {
    await db.execute(sql`ALTER TABLE meal_plan_entries ADD COLUMN IF NOT EXISTS custom_protein INTEGER;`);
    await db.execute(sql`ALTER TABLE meal_plan_entries ADD COLUMN IF NOT EXISTS custom_carbs INTEGER;`);
    await db.execute(sql`ALTER TABLE meal_plan_entries ADD COLUMN IF NOT EXISTS custom_fat INTEGER;`);
    await db.execute(sql`ALTER TABLE meal_plan_entries ADD COLUMN IF NOT EXISTS source VARCHAR(50);`);
  })();

  return mealPlannerWeekSchemaReady;
}
