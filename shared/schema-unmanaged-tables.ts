/**
 * Tables that exist (or may exist) in the database but are deliberately NOT declared in the Drizzle schema, with where each comes from.
 *
 * This is an exclusion REGISTRY, not a second schema: it holds no columns, types or constraints, and `drizzle-kit push` never reads it. Push
 * is kept away from these tables structurally -- `drizzle.config.ts` hands `tablesFilter` only the DECLARED table names -- so an entry here is
 * documentation plus a drift guard: `server/lib/schema-table-coverage.test.ts` fails if the repository creates any table that is neither
 * declared nor listed here, so a new table can never silently fall outside both.
 *
 * Moving a table into the canonical schema is a deliberate act: declare it with a definition proven identical to the real table (see the
 * parity tests for the catering and Square tables), then delete its entry here. Never do it from this file's description alone.
 * Full audit and rationale: docs/schema-push-safety.md.
 */

export type UnmanagedTableKind =
  /** Infrastructure the application must never lose. */
  | "migration_ledger"
  /** Evidence of a security action; losing it loses the only record of who was affected. */
  | "audit_evidence"
  /** Rows set aside by an integrity migration instead of being deleted. */
  | "quarantine"
  /** Created by the historical hand-written SQL in server/drizzle or server/migrations; Drizzle never declared it. */
  | "historical_sql"
  /** Created at runtime by `CREATE TABLE IF NOT EXISTS` in a route/service module. */
  | "runtime_ddl"
  /** Present in the live database but created by nothing in this repository. */
  | "external";

export type UnmanagedTable = { kind: UnmanagedTableKind; origin: string; canonicalize: "no" | "later" };

const entry = (kind: UnmanagedTableKind, origin: string, canonicalize: UnmanagedTable["canonicalize"] = "later"): UnmanagedTable => ({ kind, origin, canonicalize });
const group = (names: string[], kind: UnmanagedTableKind, origin: string, canonicalize?: UnmanagedTable["canonicalize"]) =>
  Object.fromEntries(names.map((name) => [name, entry(kind, origin, canonicalize)]));

export const UNMANAGED_TABLES: Readonly<Record<string, UnmanagedTable>> = {
  _app_migrations: entry("migration_ledger", "server/scripts/run-migrations.ts", "no"),
  legacy_credential_invalidations: entry("audit_evidence", "server/migrations/20261002_email_verification_provenance.sql"),
  recipe_remixes_invalid_lineage: entry("quarantine", "server/migrations/20260917_remix_integrity.sql"),
  playing_with_neon: entry("external", "Neon console sample table (server/scripts/export-table.ts); not created by this repository", "no"),
  ...group(["competitions", "competition_entries", "competition_judges", "competition_votes", "cook_together_sessions", "cook_together_participants",
    "event_leaderboard", "event_participants", "recipe_duets", "seasonal_events"], "historical_sql", "server/drizzle/0002_phase2_social_explosion.sql"),
  ...group(["health_integrations", "health_sync_log", "recipe_timing_log", "taste_profiles", "user_analytics", "user_goals"],
    "historical_sql", "server/drizzle/0003_phase3_power_user.sql"),
  ...group(["households", "household_members"], "historical_sql", "server/drizzle/20260106_household_pantry.sql"),
  ...group(["meal_plan_comments", "meal_plan_creator_profiles", "meal_plan_likes", "meal_plan_saves", "shared_week_comments", "shared_week_likes",
    "shared_week_saves"], "runtime_ddl", "server/drizzle/20260604_meal_planner_social_foundation.sql + server/routes/meal-social.ts"),
  meal_plan_week_shares: entry("runtime_ddl", "server/routes/meal-planner-week/schema.ts"),
  meal_planner_analytics_events: entry("runtime_ddl", "server/migrations/20260624_meal_planner_analytics_events.sql + server/routes/meal-planner-events.ts"),
  pantry_household_invites: entry("runtime_ddl", "server/routes/pantry/household-schema.ts"),
  wedding_budget_settings: entry("runtime_ddl", "server/routes/wedding-budget-settings.ts"),
  wedding_planning_insights: entry("runtime_ddl", "server/routes/wedding-insights.ts"),
  wedding_planning_tasks: entry("runtime_ddl", "server/routes/wedding-planning-tasks.ts"),
  wedding_registry_links: entry("runtime_ddl", "server/migrations/20251213_wedding_registry_links.sql + server/routes/wedding-registry-links.ts"),
  wedding_vendor_listings: entry("runtime_ddl", "server/routes/wedding-vendor-listings.ts"),
  wedding_vendor_quotes: entry("runtime_ddl", "server/routes/wedding-vendor-quotes.ts"),
};
