import "../test-support/auth-test-env";
import test from "node:test";
import assert from "node:assert/strict";
import { PG_URL, connectLocalPg } from "../test-support/authz-pg-harness";
import { erasePrivatePlannerRowsWithinTransaction } from "./closure-private-planner-erasure";

const direct = [
  "meal_prep_schedules", "grocery_list_items", "user_meal_plan_progress", "meal_favorites",
  "meal_streaks", "body_metrics", "water_logs", "nutrition_logs", "pantry_items",
  "user_substitution_preferences", "adaptive_planner_snapshots", "adaptive_planner_profiles",
  "nutrition_personality_profiles", "planner_relationship_learning", "planner_objective_history",
  "user_nutrition_campaigns", "email_verification_tokens", "wedding_rsvp_invitations",
  "wedding_calendar_events", "wedding_event_details", "notifications",
] as const;
const tables = [
  ...direct, "meal_plan_entries", "allergen_profiles", "family_meal_profiles",
  "family_members", "meal_plans", "orders", "users",
];

if (!PG_URL) {
  test("Private planner erasure requires CS_TEST_PG_URL", { skip: true }, () => {});
} else {
  test("private planner cleanup deletes only owner rows and preserves financial evidence", async () => {
    const local = await connectLocalPg();
    try {
      await local.query(`DROP TABLE IF EXISTS ${tables.join(", ")} CASCADE;`);
      await local.query("CREATE TABLE users(id varchar PRIMARY KEY)");
      await local.query("INSERT INTO users VALUES('closing'),('other')");
      await local.query(`
        CREATE TABLE meal_plans(id varchar PRIMARY KEY, user_id varchar REFERENCES users(id));
        CREATE TABLE meal_plan_entries(id varchar PRIMARY KEY, meal_plan_id varchar REFERENCES meal_plans(id));
        CREATE TABLE family_members(id varchar PRIMARY KEY, user_id varchar REFERENCES users(id));
        CREATE TABLE allergen_profiles(id varchar PRIMARY KEY, family_member_id varchar REFERENCES family_members(id));
        CREATE TABLE family_meal_profiles(id varchar PRIMARY KEY, user_id varchar REFERENCES users(id),
          family_member_id varchar REFERENCES family_members(id));
        CREATE TABLE orders(id varchar PRIMARY KEY, buyer_id varchar REFERENCES users(id), amount integer);
      `);
      for (const table of direct) {
        await local.query(`CREATE TABLE "${table}"(id varchar PRIMARY KEY,user_id varchar REFERENCES users(id))`);
        await local.query(`INSERT INTO "${table}" VALUES($1,'closing'),($2,'other')`, [`own-${table}`,`their-${table}`]);
      }
      await local.query(`
        INSERT INTO meal_plans VALUES('own-plan','closing'),('their-plan','other');
        INSERT INTO meal_plan_entries VALUES('own-entry','own-plan'),('their-entry','their-plan');
        INSERT INTO family_members VALUES('own-family','closing'),('their-family','other');
        INSERT INTO allergen_profiles VALUES('own-allergen','own-family'),('their-allergen','their-family');
        INSERT INTO family_meal_profiles VALUES('own-family-meal','closing','own-family'),
          ('their-family-meal','other','their-family');
        INSERT INTO orders VALUES('sale','closing',10000);
      `);
      const { db } = await import("../db");
      const before = await local.query("SELECT count(*)::int n FROM orders");
      assert.equal(before.rows[0].n, 1);
      const counts = await db.transaction((tx: any) => erasePrivatePlannerRowsWithinTransaction(tx, "closing"));
      for (const table of tables.filter(x => x !== "orders" && x !== "users")) {
        assert.equal(counts[table], 1, `expected one removed row from ${table}`);
        const rowCount = await local.query(`SELECT count(*)::int n FROM "${table}"`);
        assert.equal(rowCount.rows[0].n, 1, `the other member's ${table} row survives`);
      }
      assert.deepEqual((await local.query("SELECT buyer_id,amount FROM orders")).rows, [{buyer_id:"closing",amount:10000}]);
      assert.equal((await local.query("SELECT count(*)::int n FROM users")).rows[0].n, 2);
      assert.deepEqual(await db.transaction((tx: any) => erasePrivatePlannerRowsWithinTransaction(tx, "closing")),
        Object.fromEntries(Object.keys(counts).map(x => [x,0])), "repeat cleanup is idempotent");
    } finally {
      await local.query(`DROP TABLE IF EXISTS ${tables.join(", ")} CASCADE;`);
      await local.end();
    }
  });

  test("a missing downstream table aborts the entire erasure transaction", async () => {
    const local = await connectLocalPg();
    try {
      await local.query("DROP TABLE IF EXISTS users, meal_plans, meal_plan_entries, family_members, allergen_profiles, family_meal_profiles CASCADE");
      await local.query(`
        CREATE TABLE users(id varchar PRIMARY KEY);
        CREATE TABLE meal_plans(id varchar PRIMARY KEY,user_id varchar);
        CREATE TABLE meal_plan_entries(id varchar PRIMARY KEY,meal_plan_id varchar);
        CREATE TABLE family_members(id varchar PRIMARY KEY,user_id varchar);
        CREATE TABLE allergen_profiles(id varchar PRIMARY KEY,family_member_id varchar);
        CREATE TABLE family_meal_profiles(id varchar PRIMARY KEY,user_id varchar,family_member_id varchar);
        INSERT INTO users VALUES('closing');
        INSERT INTO meal_plans VALUES('plan','closing');
        INSERT INTO meal_plan_entries VALUES('entry','plan');
      `);
      const { db } = await import("../db");
      await assert.rejects(db.transaction((tx: any) => erasePrivatePlannerRowsWithinTransaction(tx, "closing")),
        /meal_prep_schedules/, "first missing dependent table must reject the whole transaction");
      assert.equal((await local.query("SELECT count(*)::int n FROM meal_plan_entries")).rows[0].n, 1,
        "earlier DELETE was rolled back when a later table was missing");
    } finally {
      await local.query("DROP TABLE IF EXISTS users, meal_plans, meal_plan_entries, family_members, allergen_profiles, family_meal_profiles CASCADE");
      await local.end();
    }
  });
}
