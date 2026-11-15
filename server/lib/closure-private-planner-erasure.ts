import { sql } from "drizzle-orm";
import { assertInternalClosureMutationAllowed } from "./closure-feature";

/**
 * An explicitly bounded subset of eventual member content erasure.
 * Only own planner/pantry/nutrition/verification rows are deleted, never
 * financial or shared social/commerce records. Test-only until full
 * closure orchestration and legal retention approval are complete.
 *
 * Do not call this before media references are inventoried: some planner rows
 * may contain historical URLs. This helper cannot authorize media deletion.
 */
const rowsOf = (result: any): any[] => result?.rows ?? (Array.isArray(result) ? result : []);

export type PrivatePlannerErasureCounts = Record<string, number>;

export async function erasePrivatePlannerRowsWithinTransaction(
  tx: any,
  userId: string,
): Promise<PrivatePlannerErasureCounts> {
  assertInternalClosureMutationAllowed();
  // Child rows whose FK default is NO ACTION must be cleared before parents.
  // Queries are all fixed, parameterized, and ordered. Missing expected
  // tables or relationships FAIL and the caller must roll back the transaction.
  const steps: [string, ReturnType<typeof sql>][] = [
    ["meal_plan_entries", sql`
      DELETE FROM meal_plan_entries
      WHERE meal_plan_id IN (SELECT id FROM meal_plans WHERE user_id = ${userId})
      RETURNING 1`],
    ["allergen_profiles", sql`
      DELETE FROM allergen_profiles
      WHERE family_member_id IN (SELECT id FROM family_members WHERE user_id = ${userId})
      RETURNING 1`],
    ["family_meal_profiles", sql`
      DELETE FROM family_meal_profiles
      WHERE user_id = ${userId}
         OR family_member_id IN (SELECT id FROM family_members WHERE user_id = ${userId})
      RETURNING 1`],
    ["family_members", sql`DELETE FROM family_members WHERE user_id = ${userId} RETURNING 1`],
    ["meal_prep_schedules", sql`DELETE FROM meal_prep_schedules WHERE user_id = ${userId} RETURNING 1`],
    ["grocery_list_items", sql`DELETE FROM grocery_list_items WHERE user_id = ${userId} RETURNING 1`],
    ["user_meal_plan_progress", sql`DELETE FROM user_meal_plan_progress WHERE user_id = ${userId} RETURNING 1`],
    ["meal_plans", sql`DELETE FROM meal_plans WHERE user_id = ${userId} RETURNING 1`],
    ["meal_favorites", sql`DELETE FROM meal_favorites WHERE user_id = ${userId} RETURNING 1`],
    ["meal_streaks", sql`DELETE FROM meal_streaks WHERE user_id = ${userId} RETURNING 1`],
    ["body_metrics", sql`DELETE FROM body_metrics WHERE user_id = ${userId} RETURNING 1`],
    ["water_logs", sql`DELETE FROM water_logs WHERE user_id = ${userId} RETURNING 1`],
    ["nutrition_logs", sql`DELETE FROM nutrition_logs WHERE user_id = ${userId} RETURNING 1`],
    ["pantry_items", sql`DELETE FROM pantry_items WHERE user_id = ${userId} RETURNING 1`],
    ["user_substitution_preferences", sql`DELETE FROM user_substitution_preferences WHERE user_id = ${userId} RETURNING 1`],
    ["adaptive_planner_snapshots", sql`DELETE FROM adaptive_planner_snapshots WHERE user_id = ${userId} RETURNING 1`],
    ["adaptive_planner_profiles", sql`DELETE FROM adaptive_planner_profiles WHERE user_id = ${userId} RETURNING 1`],
    ["nutrition_personality_profiles", sql`DELETE FROM nutrition_personality_profiles WHERE user_id = ${userId} RETURNING 1`],
    ["planner_relationship_learning", sql`DELETE FROM planner_relationship_learning WHERE user_id = ${userId} RETURNING 1`],
    ["planner_objective_history", sql`DELETE FROM planner_objective_history WHERE user_id = ${userId} RETURNING 1`],
    ["user_nutrition_campaigns", sql`DELETE FROM user_nutrition_campaigns WHERE user_id = ${userId} RETURNING 1`],
    ["email_verification_tokens", sql`DELETE FROM email_verification_tokens WHERE user_id = ${userId} RETURNING 1`],
    ["wedding_rsvp_invitations", sql`DELETE FROM wedding_rsvp_invitations WHERE user_id = ${userId} RETURNING 1`],
    ["wedding_calendar_events", sql`DELETE FROM wedding_calendar_events WHERE user_id = ${userId} RETURNING 1`],
    ["wedding_event_details", sql`DELETE FROM wedding_event_details WHERE user_id = ${userId} RETURNING 1`],
    ["notifications", sql`DELETE FROM notifications WHERE user_id = ${userId} RETURNING 1`],
  ];
  const counts: PrivatePlannerErasureCounts = {};
  for (const [table, query] of steps) {
    counts[table] = rowsOf(await tx.execute(query)).length;
  }
  return counts;
}
