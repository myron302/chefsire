import { db } from "../db/index.js";
import { sql } from "drizzle-orm";

export const MEAL_PLANNER_EVENT_TYPES = [
  "plan_view",
  "storefront_view",
  "shared_week_view",
  "shared_week_copy",
  "marketplace_plan_save",
  "shared_week_save",
] as const;

export type MealPlannerEventType = typeof MEAL_PLANNER_EVENT_TYPES[number];

export async function ensureMealPlannerEventsSchema() {
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS meal_planner_analytics_events (
      id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
      event_type text NOT NULL,
      creator_id varchar REFERENCES users(id),
      actor_user_id varchar REFERENCES users(id),
      meal_plan_id varchar REFERENCES meal_plan_blueprints(id),
      shared_week_token text,
      metadata jsonb DEFAULT '{}'::jsonb,
      session_key text,
      created_at timestamp NOT NULL DEFAULT now()
    )
  `);
  await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_meal_planner_events_creator_type_created ON meal_planner_analytics_events(creator_id, event_type, created_at DESC);`);
  await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_meal_planner_events_plan_type ON meal_planner_analytics_events(meal_plan_id, event_type);`);
  await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_meal_planner_events_shared_week_type ON meal_planner_analytics_events(shared_week_token, event_type);`);
}

type RecordMealPlannerEventInput = {
  eventType: MealPlannerEventType;
  creatorId?: string | null;
  actorUserId?: string | null;
  mealPlanId?: string | null;
  sharedWeekToken?: string | null;
  metadata?: Record<string, unknown> | null;
  sessionKey?: string | null;
  dedupeViews?: boolean;
};

export async function recordMealPlannerEvent(input: RecordMealPlannerEventInput) {
  await ensureMealPlannerEventsSchema();
  const eventType = input.eventType;
  const actorUserId = input.actorUserId || null;
  const sessionKey = input.sessionKey || null;
  const mealPlanId = input.mealPlanId || null;
  const sharedWeekToken = input.sharedWeekToken || null;
  const creatorId = input.creatorId || null;

  if (input.dedupeViews && (eventType === "plan_view" || eventType === "storefront_view" || eventType === "shared_week_view")) {
    const duplicate = await db.execute(sql`
      SELECT id FROM meal_planner_analytics_events
      WHERE event_type = ${eventType}
        AND COALESCE(creator_id, '') = COALESCE(${creatorId}, '')
        AND COALESCE(actor_user_id, '') = COALESCE(${actorUserId}, '')
        AND COALESCE(meal_plan_id, '') = COALESCE(${mealPlanId}, '')
        AND COALESCE(shared_week_token, '') = COALESCE(${sharedWeekToken}, '')
        AND COALESCE(session_key, '') = COALESCE(${sessionKey}, '')
        AND created_at >= NOW() - INTERVAL '30 minutes'
      LIMIT 1
    `);
    if ((duplicate as any).rows?.length) return { inserted: false, deduped: true };
  }

  await db.execute(sql`
    INSERT INTO meal_planner_analytics_events (event_type, creator_id, actor_user_id, meal_plan_id, shared_week_token, metadata, session_key)
    VALUES (${eventType}, ${creatorId}, ${actorUserId}, ${mealPlanId}, ${sharedWeekToken}, ${JSON.stringify(input.metadata || {})}::jsonb, ${sessionKey})
  `);
  return { inserted: true, deduped: false };
}
