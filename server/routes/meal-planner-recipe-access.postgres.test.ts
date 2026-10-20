/**
 * Phase 3C (review follow-up #2): meal-planner recipe references and shared weeks.
 *
 * Real HTTP, real planner router, real SQL on a local PostgreSQL (CS_TEST_PG_URL; skipped otherwise).
 * Invariants:
 *  - `recipeId` is a LOCAL recipe link and must be visible to the actor; `sourceRecipeId` is provenance text that may be an external
 *    provider id (`mealdb_123`). Local-or-external is decided by the recipes table, never by the spelling of the id.
 *  - Recipe access is re-evaluated at every read (own week, shared preview, copy responses), so a share or a stored entry never keeps a
 *    private-club recipe readable for someone who is not currently entitled to it.
 *  - Copying a shared week omits entries whose local recipe the RECEIVER cannot see.
 */
import test from "node:test";
import assert from "node:assert/strict";
import express from "express";
import type { AddressInfo } from "node:net";
import { PG_URL, connectLocalPg, ddl, makeCaller } from "../test-support/authz-pg-harness";

const PRIVATE_TITLE = "SECRET-CLUB-DISH";
const PRIVATE_INGREDIENT = "SECRET-INGREDIENT";
const PRIVATE_STEP = "SECRET-STEP";
const PUBLIC_TITLE = "Open Pancakes";
const TOKEN = "sharedweek1234";
const DAY = "2030-01-15"; // a Tuesday

if (!PG_URL) {
  test("planner recipe access (skipped: CS_TEST_PG_URL not set)", { skip: true }, () => {});
} else {
  const local = await connectLocalPg();
  const schema = await import("../../shared/schema");
  await local.query(`
    DROP TABLE IF EXISTS users, posts, recipes, clubs, club_memberships, club_posts, meal_plans, meal_plan_entries, meal_favorites,
      meal_streaks, grocery_list_items, meal_planner_analytics_events CASCADE;
    ${ddl(schema.users, "users", ", UNIQUE (username), UNIQUE (email)")};
    ${ddl(schema.posts, "posts")};
    ${ddl(schema.recipes, "recipes")};
    ${ddl(schema.clubs, "clubs")};
    ${ddl(schema.clubMemberships, "club_memberships")};
    ${ddl(schema.clubPosts, "club_posts")};
    ${ddl(schema.mealPlans, "meal_plans")};
    ${ddl(schema.mealPlanEntries, "meal_plan_entries")};
    ${ddl(schema.mealFavorites, "meal_favorites")};
    ${ddl(schema.mealStreaks, "meal_streaks")};
    ${ddl(schema.groceryListItems, "grocery_list_items")};
  `);
  const { default: plannerRouter } = await import("./meal-planner-week");
  const { ensureMealPlannerWeekSchema } = await import("./meal-planner-week/schema");
  await ensureMealPlannerWeekSchema();
  const app = express();
  app.use(express.json());
  app.use("/api/meal-planner", plannerRouter);
  const server = app.listen(0);
  test.after(async () => { server.close(); await local.end(); });

  const ids: Record<string, string> = {};
  const recipe: Record<string, string> = {};
  let club = "";
  const call = makeCaller(() => `http://127.0.0.1:${(server.address() as AddressInfo).port}`, (who) => ids[who]);

  const entryBody = (over: Record<string, unknown> = {}) => ({ date: DAY, mealType: "dinner", name: "Dinner", calories: 500, protein: 20, carbs: 50, fat: 10, ...over });
  const addEntry = (as: string, over: Record<string, unknown> = {}) => call("POST", "/api/meal-planner/week/entry", as, entryBody(over));
  const week = (as: string) => call("GET", `/api/meal-planner/week?date=${DAY}`, as);
  const leaks = (text: string) => [PRIVATE_TITLE, PRIVATE_INGREDIENT, PRIVATE_STEP].filter((needle) => text.includes(needle));

  test.beforeEach(async () => {
    await local.query(`TRUNCATE users, posts, recipes, clubs, club_memberships, club_posts, meal_plans, meal_plan_entries, meal_favorites, meal_streaks, grocery_list_items CASCADE`);
    await local.query(`TRUNCATE meal_plan_week_shares`);
    for (const name of ["owner", "member", "outsider", "receiver"]) {
      ids[name] = (await local.query(`INSERT INTO users (username, email, display_name, password, nutrition_premium) VALUES ($1, $2, $1, 'x', true) RETURNING id`, [name, `${name}@example.com`])).rows[0].id;
    }
    club = (await local.query(`INSERT INTO clubs (creator_id, name, is_public) VALUES ($1, 'secret club', false) RETURNING id`, [ids.owner])).rows[0].id;
    await local.query(`INSERT INTO club_memberships (club_id, user_id, role) VALUES ($1, $2, 'owner'), ($1, $3, 'member')`, [club, ids.owner, ids.member]);
    const post = (await local.query(`INSERT INTO posts (user_id, caption, image_url) VALUES ($1, 'p', 'i.jpg') RETURNING id`, [ids.owner])).rows[0].id;
    recipe.public = (await local.query(`INSERT INTO recipes (post_id, title, ingredients, instructions, calories, meal_type) VALUES ($1, $2, '["flour"]'::jsonb, '["fry"]'::jsonb, 400, 'breakfast') RETURNING id`, [post, PUBLIC_TITLE])).rows[0].id;
    recipe.private = (await local.query(`INSERT INTO recipes (title, ingredients, instructions, calories, origin_club_id) VALUES ($1, $2::jsonb, $3::jsonb, 600, $4) RETURNING id`, [PRIVATE_TITLE, JSON.stringify([PRIVATE_INGREDIENT]), JSON.stringify([PRIVATE_STEP]), club])).rows[0].id;
  });

  async function shareOwnersWeek() {
    await local.query(`INSERT INTO meal_plan_week_shares (user_id, week_anchor, visibility, public_share_token) VALUES ($1, '2030-01-14', 'public', $2)`, [ids.owner, TOKEN]);
  }
  async function ownerPlansEverything() {
    assert.equal((await addEntry("owner", { name: PRIVATE_TITLE, mealType: "dinner", recipeId: recipe.private })).status, 201);
    assert.equal((await addEntry("owner", { name: PUBLIC_TITLE, mealType: "breakfast", recipeId: recipe.public })).status, 201);
    assert.equal((await addEntry("owner", { name: "Imported", mealType: "lunch", source: "external", sourceRecipeId: "mealdb_123", sourceRecipeTitle: "Arrabiata", sourceRecipeUrl: "https://example.com/r" })).status, 201);
    await shareOwnersWeek();
  }

  test("entry creation: external, public local and authorized private-club recipes are accepted", async () => {
    const external = await addEntry("outsider", { mealType: "lunch", source: "external", sourceRecipeId: "mealdb_123", sourceRecipeTitle: "Arrabiata" });
    assert.equal(external.status, 201, external.text);
    const stored = (await local.query(`SELECT recipe_id, source_recipe_id FROM meal_plan_entries WHERE source_recipe_id = 'mealdb_123'`)).rows[0];
    assert.deepEqual({ recipe_id: stored.recipe_id, source_recipe_id: stored.source_recipe_id }, { recipe_id: null, source_recipe_id: "mealdb_123" });
    assert.equal((await addEntry("outsider", { mealType: "breakfast", recipeId: recipe.public })).status, 201);
    assert.equal((await addEntry("member", { recipeId: recipe.private })).status, 201);
    // Both references together: a visible local recipe plus external provenance.
    assert.equal((await addEntry("outsider", { mealType: "snack", recipeId: recipe.public, sourceRecipeId: "mealdb_999" })).status, 201);
  });

  test("entry creation: an unauthorized local recipe is refused however it is labelled", async () => {
    const attempts: Array<Record<string, unknown>> = [
      { recipeId: recipe.private },
      { recipeId: recipe.private, sourceRecipeId: "mealdb_123" },
      { recipeId: recipe.private, source: "external", sourceRecipeId: "mealdb_123" },
      { sourceRecipeId: recipe.private, source: "external" }, // disguised as an "external" reference
      { recipeId: recipe.public, sourceRecipeId: recipe.private },
      { recipeId: "mealdb_123" }, // not a local recipe at all
    ];
    for (const over of attempts) {
      const r = await addEntry("outsider", over);
      assert.equal(r.status, 404, JSON.stringify(over));
      assert.deepEqual(r.json, { message: "Recipe not found" });
    }
    assert.equal(Number((await local.query(`SELECT count(*) FROM meal_plan_entries`)).rows[0].count), 0);
  });

  test("assistant-apply uses the same classification (external provenance ok, private local refused)", async () => {
    const op = (meal: Record<string, unknown>) => ({ operations: [{ date: DAY, mealType: "dinner", meal: { name: "x", ...meal } }] });
    assert.equal((await call("POST", "/api/meal-planner/week/assistant-apply", "outsider", op({ sourceRecipeId: "mealdb_123" }))).status, 200);
    assert.equal((await call("POST", "/api/meal-planner/week/assistant-apply", "outsider", op({ recipeId: recipe.public }))).status, 200);
    for (const meal of [{ recipeId: recipe.private }, { sourceRecipeId: recipe.private }, { recipeId: recipe.private, sourceRecipeId: "mealdb_1" }]) {
      assert.equal((await call("POST", "/api/meal-planner/week/assistant-apply", "outsider", op(meal))).status, 400, JSON.stringify(meal));
    }
    assert.equal((await call("POST", "/api/meal-planner/week/assistant-apply", "member", op({ recipeId: recipe.private }))).status, 200);
  });

  test("a member reads their private recipe in their own week; losing membership redacts it on the next read", async () => {
    await addEntry("member", { name: PRIVATE_TITLE, recipeId: recipe.private });
    const before = await week("member");
    assert.ok(before.text.includes(PRIVATE_INGREDIENT), "an authorized member sees the recipe they planned");
    await local.query(`DELETE FROM club_memberships WHERE club_id = $1 AND user_id = $2`, [club, ids.member]);
    const after = await week("member");
    assert.equal(after.status, 200);
    assert.deepEqual(leaks(after.text), [], "no restricted recipe data after losing membership");
    assert.equal(after.json.entries[0].recipeUnavailable, true);
    assert.equal(after.json.entries[0].recipe, null);
    assert.equal(after.json.entries[0].customName, "Recipe unavailable");
    assert.equal(after.json.entries[0].calories ?? after.json.entries[0].customCalories, 500, "the slot and the owner's own numbers stay");
  });

  test("a shared week never shows private recipe data to anonymous viewers or outsiders; members still see it", async () => {
    await ownerPlansEverything();
    for (const viewer of ["anon", "outsider", "receiver"]) {
      const r = await call("GET", `/api/meal-planner/week/shared/${TOKEN}`, viewer);
      assert.equal(r.status, 200, viewer);
      assert.deepEqual(leaks(r.text), [], `${viewer} saw restricted data`);
      assert.ok(r.text.includes(PUBLIC_TITLE) && r.text.includes("Imported"), "public and external entries stay visible");
    }
    assert.ok((await call("GET", `/api/meal-planner/week/shared/${TOKEN}`, "member")).text.includes(PRIVATE_TITLE));
    // The share row holds no recipe snapshot at all.
    const row = (await local.query(`SELECT * FROM meal_plan_week_shares`)).rows[0];
    assert.ok(!JSON.stringify(row).includes(PRIVATE_TITLE));
  });

  test("copying a shared week: the receiver gets only what they may see, and no access afterwards", async () => {
    await ownerPlansEverything();
    const impact = await call("GET", `/api/meal-planner/week/shared/${TOKEN}/copy-impact?targetDate=2030-02-12`, "receiver");
    assert.equal(impact.json.skippedUnavailableRecipesCount, 1);
    const copy = await call("POST", `/api/meal-planner/week/shared/${TOKEN}/copy`, "receiver", { targetDate: "2030-02-12" });
    assert.equal(copy.status, 200, copy.text);
    assert.equal(copy.json.copiedEntriesCount, 2);
    assert.equal(copy.json.skippedUnavailableRecipesCount, 1);
    assert.deepEqual(leaks(copy.text), []);
    const got = await call("GET", "/api/meal-planner/week?date=2030-02-12", "receiver");
    assert.deepEqual(leaks(got.text), [], "later reads reveal nothing restricted");
    assert.ok(got.text.includes(PUBLIC_TITLE) && got.text.includes("Imported"), "public and external entries survive the copy");
    const rows = (await local.query(`SELECT recipe_id FROM meal_plan_entries e JOIN meal_plans p ON p.id = e.meal_plan_id WHERE p.user_id = $1`, [ids.receiver])).rows;
    assert.ok(rows.every((r) => r.recipe_id !== recipe.private), "no reference to the private recipe was stored for the receiver");
    // Sharing granted no membership.
    assert.equal(Number((await local.query(`SELECT count(*) FROM club_memberships WHERE user_id = $1`, [ids.receiver])).rows[0].count), 0);
  });

  test("a member copying the shared week keeps the private recipe; leaving the club later redacts it", async () => {
    await ownerPlansEverything();
    await local.query(`INSERT INTO club_memberships (club_id, user_id, role) VALUES ($1, $2, 'member') ON CONFLICT DO NOTHING`, [club, ids.receiver]);
    const copy = await call("POST", `/api/meal-planner/week/shared/${TOKEN}/copy`, "receiver", { targetDate: "2030-02-12" });
    assert.equal(copy.json.copiedEntriesCount, 3);
    assert.ok((await call("GET", "/api/meal-planner/week?date=2030-02-12", "receiver")).text.includes(PRIVATE_INGREDIENT));
    await local.query(`DELETE FROM club_memberships WHERE club_id = $1 AND user_id = $2`, [club, ids.receiver]);
    assert.deepEqual(leaks((await call("GET", "/api/meal-planner/week?date=2030-02-12", "receiver")).text), []);
  });

  test("a shared week whose every recipe is private to the receiver cannot be copied", async () => {
    assert.equal((await addEntry("owner", { name: PRIVATE_TITLE, recipeId: recipe.private })).status, 201);
    await shareOwnersWeek();
    const r = await call("POST", `/api/meal-planner/week/shared/${TOKEN}/copy`, "receiver", { targetDate: "2030-02-12" });
    assert.equal(r.status, 400);
    assert.equal(r.json.code, "SHARED_WEEK_NOTHING_COPYABLE");
    assert.equal((await local.query(`SELECT 1 FROM meal_plans WHERE user_id = $1`, [ids.receiver])).rowCount, 0);
  });

  test("week generation: still gated as before, and its recipe pool never offers recipes the user cannot see", async () => {
    // Nutrition premium has no authoritative paid entitlement in this codebase, so the HTTP route is closed for everyone (unchanged).
    const gated = await call("POST", "/api/meal-planner/week/generate", "member", { date: DAY });
    assert.equal(gated.status, 403);
    assert.equal(gated.json.code, "NUTRITION_PREMIUM_REQUIRED");
    // The pool the route draws from is exercised directly.
    const { buildRecipePool } = await import("./meal-planner-week");
    await local.query(`UPDATE recipes SET meal_type = 'dinner' WHERE id = ANY($1)`, [[recipe.public, recipe.private]]);
    const pool = async (viewerId: string | null) => (await buildRecipePool({ mealType: "dinner", excludeRecipeIds: new Set(), viewerId })).map((r: any) => r.title).sort();
    assert.deepEqual(await pool(ids.outsider), [PUBLIC_TITLE]);
    assert.deepEqual(await pool(null), [PUBLIC_TITLE]);
    assert.deepEqual(await pool(ids.member), [PUBLIC_TITLE, PRIVATE_TITLE]);
  });

  test("every planner read that hydrates recipes goes through the shared redaction", async () => {
    const { readFileSync } = await import("node:fs");
    const src = readFileSync(new URL("./meal-planner-week.ts", import.meta.url), "utf8");
    const hydrating = (src.match(/leftJoin\(recipes, eq\(mealPlanEntries\.recipeId, recipes\.id\)\)/g) ?? []).length;
    const redacting = (src.match(/await redactUnavailableRecipes\(/g) ?? []).length;
    assert.ok(hydrating >= 5 && redacting >= hydrating, `${hydrating} recipe-hydrating reads, ${redacting} redactions`);
  });
}
