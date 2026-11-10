import { sql } from "drizzle-orm";

/**
 * Source-reviewed direct users.id FK policy. Unknown or manually classified
 * live dependencies are blockers before irreversible account closure. No
 * provider/retention approval is implied by a clean inventory.
 */
export const CLOSURE_FK_CLASSES = {
  "retain_ledger": [
    "orders",
    "products",
    "subscription_history",
    "payment_methods",
    "square_oauth_transactions",
    "commissions",
    "payouts",
    "payout_schedules",
    "catering_inquiries",
    "catering_bookings",
    "catering_offer_revisions",
    "catering_booking_amendments",
    "catering_booking_tasks",
    "catering_booking_activity",
    "catering_booking_message_requests",
    "catering_booking_files",
    "catering_booking_execution_timeline",
    "catering_booking_staff_assignments",
    "catering_booking_equipment",
    "catering_booking_access_details",
    "catering_booking_execution_milestones",
    "catering_booking_execution_create_requests",
    "catering_booking_closeout",
    "catering_booking_closeout_items",
    "catering_booking_billing",
    "catering_booking_invoices",
    "catering_booking_payments",
    "catering_booking_adjustments",
    "catering_booking_payment_attempts",
    "wedding_square_card_updates",
    "wedding_square_enrollment_attempts",
    "wedding_square_subscriptions",
    "wedding_square_card_setup_attempts",
    "meal_plan_purchases",
    "meal_plan_blueprints",
    "wedding_intro_trials",
    "nutrition_intro_trials",
    "drink_bundle_purchases",
    "drink_bundle_checkout_sessions",
    "drink_collection_purchases",
    "drink_collection_checkout_sessions",
    "drink_collection_sales_ledger",
    "drink_gifts",
    "creator_memberships",
    "creator_membership_checkout_sessions",
    "creator_membership_sales_ledger"
  ],
  "retain_shared": [
    "dm_participants",
    "dm_messages",
    "stores",
    "store_drops",
    "clubs",
    "club_memberships",
    "club_join_requests",
    "drink_collections",
    "creator_collaborations"
  ],
  "erase_private": [
    "posts",
    "recipe_reviews",
    "review_helpful",
    "stories",
    "likes",
    "comments",
    "comment_likes",
    "follows",
    "follow_requests",
    "email_verification_tokens",
    "wedding_rsvp_invitations",
    "wedding_event_details",
    "wedding_calendar_events",
    "pantry_households",
    "pantry_household_members",
    "pantry_items",
    "nutrition_logs",
    "family_members",
    "user_substitution_preferences",
    "club_posts",
    "club_post_likes",
    "challenge_progress",
    "user_badges",
    "meal_plans",
    "meal_streaks",
    "body_metrics",
    "meal_favorites",
    "water_logs",
    "meal_plan_reviews",
    "creator_analytics",
    "user_nutrition_campaigns",
    "adaptive_planner_snapshots",
    "adaptive_planner_profiles",
    "nutrition_personality_profiles",
    "planner_relationship_learning",
    "planner_objective_history",
    "custom_drinks",
    "drink_photos",
    "drink_likes",
    "drink_saves",
    "drink_events",
    "pet_food_events",
    "drink_recipes",
    "drink_challenge_submissions",
    "recipe_saves",
    "user_drink_stats",
    "notifications",
    "quest_progress",
    "recipe_remixes",
    "remix_likes",
    "remix_saves",
    "ai_suggestions",
    "meal_recommendations",
    "meal_prep_schedules",
    "leftovers",
    "grocery_list_items",
    "user_meal_plan_progress",
    "user_meal_plan_achievements",
    "family_meal_profiles",
    "drink_collection_wishlists",
    "drink_collection_reviews",
    "drink_collection_promotions",
    "drink_collection_events",
    "creator_campaigns",
    "creator_campaign_rollout_timeline_events",
    "creator_campaign_templates",
    "creator_campaign_playbook_profiles",
    "creator_campaign_follows",
    "creator_campaign_action_states",
    "creator_campaign_variant_events",
    "creator_campaign_spotlight_events",
    "creator_campaign_surface_events",
    "creator_posts",
    "creator_drops",
    "creator_drop_rsvps",
    "creator_roadmap_items",
    "creator_drop_events"
  ],
  "needs_manual_review": [
    "catering_packages",
    "catering_availability_settings",
    "catering_availability_exceptions",
    "catering_availability_weekly_rules",
    "catering_reviews",
    "catering_portfolio_items",
    "drink_bundles",
    "creator_membership_plans"
  ]
} as const;
export type ClosureFkClass = keyof typeof CLOSURE_FK_CLASSES;
export type ClosureFkDependency = {
  table: string; constraint: string; onDelete: string;
  category: ClosureFkClass | "unclassified";
};
const rowsOf = (r: any): any[] => r?.rows ?? (Array.isArray(r) ? r : []);
const known = new Map<string, ClosureFkClass>();
for (const [kind, tables] of Object.entries(CLOSURE_FK_CLASSES) as [ClosureFkClass, readonly string[]][]) {
  for (const table of tables) {
    if (known.has(table)) throw new Error(`Duplicate closure FK classification for ${table}`);
    known.set(table, kind);
  }
}
export async function inspectClosureUserForeignKeys(tx: any): Promise<{
  dependencies: ClosureFkDependency[]; unknownTables: string[]; manualReviewTables: string[];
}> {
  const rows = rowsOf(await tx.execute(sql`
    SELECT child.relname AS "table", con.conname AS "constraint",
           CASE con.confdeltype
             WHEN 'a' THEN 'NO ACTION' WHEN 'r' THEN 'RESTRICT'
             WHEN 'c' THEN 'CASCADE' WHEN 'n' THEN 'SET NULL'
             WHEN 'd' THEN 'SET DEFAULT' ELSE 'UNKNOWN'
           END AS "onDelete"
    FROM pg_constraint con
    JOIN pg_class child ON child.oid = con.conrelid
    JOIN pg_namespace ns ON ns.oid = child.relnamespace
    WHERE con.contype = 'f' AND con.confrelid = 'public.users'::regclass
      AND ns.nspname = 'public'
    ORDER BY child.relname, con.conname
  `));
  const dependencies = rows.map((row): ClosureFkDependency => ({
    table: String(row.table), constraint: String(row.constraint),
    onDelete: String(row.onDelete),
    category: known.get(String(row.table)) ?? "unclassified",
  }));
  return {
    dependencies,
    unknownTables: [...new Set(dependencies.filter(x => x.category === "unclassified").map(x => x.table))],
    manualReviewTables: [...new Set(dependencies.filter(x => x.category === "needs_manual_review").map(x => x.table))],
  };
}
export function closureForeignKeyInventoryClear(
  result: Awaited<ReturnType<typeof inspectClosureUserForeignKeys>>
): boolean {
  return result.unknownTables.length === 0 && result.manualReviewTables.length === 0;
}
