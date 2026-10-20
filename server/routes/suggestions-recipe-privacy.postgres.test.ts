/**
 * Phase 3C (review follow-up #4): stored AI suggestions must honour CURRENT recipe visibility.
 *
 * A suggestion's title and reason are written from the recipe it points at, and the row is persisted. Access can change afterwards
 * (membership removed, user leaves the club), so every read and every mutation re-checks the recipe against the user's present rights.
 *
 * Real HTTP, real suggestions router, real SQL on a local PostgreSQL (CS_TEST_PG_URL; skipped otherwise).
 */
import test from "node:test";
import assert from "node:assert/strict";
import express from "express";
import type { AddressInfo } from "node:net";
import { PG_URL, connectLocalPg, ddl, makeCaller } from "../test-support/authz-pg-harness";

const PRIVATE_TITLE = "SECRET-CLUB-STEW";
const PUBLIC_TITLE = "Open Smoothie Bowl";

if (!PG_URL) {
  test("suggestion privacy (skipped: CS_TEST_PG_URL not set)", { skip: true }, () => {});
} else {
  const local = await connectLocalPg();
  const schema = await import("../../shared/schema");
  await local.query(`
    DROP TABLE IF EXISTS users, recipes, clubs, club_memberships, ai_suggestions, user_drink_stats, nutrition_logs CASCADE;
    ${ddl(schema.users, "users", ", UNIQUE (username), UNIQUE (email)")};
    ${ddl(schema.recipes, "recipes")};
    ${ddl(schema.clubs, "clubs")};
    ${ddl(schema.clubMemberships, "club_memberships")};
    ${ddl(schema.aiSuggestions, "ai_suggestions")};
    ${ddl(schema.userDrinkStats, "user_drink_stats")};
    ${ddl(schema.nutritionLogs, "nutrition_logs")};
  `);
  const { default: suggestionsRouter } = await import("./suggestions");
  const app = express();
  app.use(express.json());
  app.use("/api/suggestions", suggestionsRouter);
  const server = app.listen(0);
  test.after(async () => { server.close(); await local.end(); });

  const ids: Record<string, string> = {};
  const recipe: Record<string, string> = {};
  const sug: Record<string, string> = {};
  let club = "";
  const call = makeCaller(() => `http://127.0.0.1:${(server.address() as AddressInfo).port}`, (who) => ids[who]);
  const leaks = (text: string) => [PRIVATE_TITLE, recipe.private].filter((needle) => needle && text.includes(needle));
  const row = async (id: string) => (await local.query(`SELECT accepted, dismissed FROM ai_suggestions WHERE id = $1`, [id])).rows[0];

  test.beforeEach(async () => {
    await local.query(`TRUNCATE users, recipes, clubs, club_memberships, ai_suggestions, user_drink_stats, nutrition_logs CASCADE`);
    for (const name of ["owner", "member", "outsider"]) {
      ids[name] = (await local.query(`INSERT INTO users (username, email, display_name, password) VALUES ($1, $2, $1, 'x') RETURNING id`, [name, `${name}@example.com`])).rows[0].id;
    }
    club = (await local.query(`INSERT INTO clubs (creator_id, name, is_public) VALUES ($1, 'secret club', false) RETURNING id`, [ids.owner])).rows[0].id;
    await local.query(`INSERT INTO club_memberships (club_id, user_id, role) VALUES ($1, $2, 'owner'), ($1, $3, 'member')`, [club, ids.owner, ids.member]);
    recipe.private = (await local.query(`INSERT INTO recipes (title, ingredients, instructions, origin_club_id) VALUES ($1, '["x"]'::jsonb, '["y"]'::jsonb, $2) RETURNING id`, [PRIVATE_TITLE, club])).rows[0].id;
    recipe.public = (await local.query(`INSERT INTO recipes (title, ingredients, instructions) VALUES ($1, '["x"]'::jsonb, '["y"]'::jsonb) RETURNING id`, [PUBLIC_TITLE])).rows[0].id;
    const add = async (key: string, who: string, type: string, recipeId: string | null, title: string) => {
      sug[key] = (await local.query(
        `INSERT INTO ai_suggestions (user_id, date, suggestion_type, recipe_id, title, reason) VALUES ($1, now(), $2, $3, $4, $5) RETURNING id`,
        [ids[who], type, recipeId, title, `because ${title}`],
      )).rows[0].id;
    };
    await add("memberPrivate", "member", "morning_drink", recipe.private, `Start your day with ${PRIVATE_TITLE}`);
    await add("memberPublic", "member", "nutrition_gap", recipe.public, `Boost your protein with ${PUBLIC_TITLE}`);
    await add("memberNoRecipe", "member", "weather_based", null, "Iced tea for a hot day");
    await add("outsiderPrivate", "outsider", "morning_drink", recipe.private, `Start your day with ${PRIVATE_TITLE}`); // stale: they never/no longer had access
  });

  const today = (who: string) => call("GET", "/api/suggestions/today", who);
  const titlesOf = (r: { json: any }) => (r.json.suggestions as Array<{ title: string }>).map((x) => x.title).sort();

  test("a current member sees the private-recipe suggestion, the public one and the recipe-less one", async () => {
    const r = await today("member");
    assert.equal(r.status, 200);
    assert.deepEqual(titlesOf(r), [`Boost your protein with ${PUBLIC_TITLE}`, "Iced tea for a hot day", `Start your day with ${PRIVATE_TITLE}`].sort());
  });

  test("removed or departed members get no private recipe data from stored suggestions, on every request", async () => {
    await local.query(`DELETE FROM club_memberships WHERE club_id = $1 AND user_id = $2`, [club, ids.member]); // removed (or left)
    for (let i = 0; i < 2; i++) { // rechecked on each request, not cached
      const r = await today("member");
      assert.equal(r.status, 200);
      assert.deepEqual(leaks(r.text), [], "restricted recipe metadata returned");
      assert.deepEqual(titlesOf(r), [`Boost your protein with ${PUBLIC_TITLE}`, "Iced tea for a hot day"].sort(), "public and unrelated suggestions remain");
    }
    // Hidden, not minted anew: no replacement suggestions were generated and the stored row is kept as history.
    assert.equal(Number((await local.query(`SELECT count(*) FROM ai_suggestions WHERE user_id = $1`, [ids.member])).rows[0].count), 3);
    // Access restored -> it returns without regeneration.
    await local.query(`INSERT INTO club_memberships (club_id, user_id, role) VALUES ($1, $2, 'member')`, [club, ids.member]);
    assert.ok(titlesOf(await today("member")).includes(`Start your day with ${PRIVATE_TITLE}`));
  });

  test("a user who never had access gets nothing restricted even if a stale row exists", async () => {
    const r = await today("outsider");
    assert.equal(r.status, 200);
    assert.deepEqual(leaks(r.text), []);
    assert.equal(Number((await local.query(`SELECT count(*) FROM ai_suggestions WHERE user_id = $1`, [ids.outsider])).rows[0].count), 1, "the stale row is not deleted and nothing was regenerated");
  });

  test("accept and dismiss: a revoked user gets a plain 404, no metadata, and the row is not mutated", async () => {
    await local.query(`DELETE FROM club_memberships WHERE club_id = $1 AND user_id = $2`, [club, ids.member]);
    for (const action of ["accept", "dismiss"]) {
      const r = await call("POST", `/api/suggestions/${sug.memberPrivate}/${action}`, "member");
      assert.equal(r.status, 404, action);
      assert.deepEqual(r.json, { error: "Suggestion not found" });
      assert.deepEqual(leaks(r.text), []);
    }
    assert.deepEqual(await row(sug.memberPrivate), { accepted: false, dismissed: false });
    // Another user's suggestion is still just a 404.
    assert.equal((await call("POST", `/api/suggestions/${sug.memberPublic}/accept`, "outsider")).status, 404);
    assert.deepEqual(await row(sug.memberPublic), { accepted: false, dismissed: false });
  });

  test("accept and dismiss still work for authorized suggestions: private (member), public and recipe-less", async () => {
    const a = await call("POST", `/api/suggestions/${sug.memberPrivate}/accept`, "member");
    assert.equal(a.status, 200);
    assert.equal(a.json.suggestion.accepted, true);
    assert.equal((await call("POST", `/api/suggestions/${sug.memberPublic}/dismiss`, "member")).json.suggestion.dismissed, true);
    assert.equal((await call("POST", `/api/suggestions/${sug.memberNoRecipe}/accept`, "member")).status, 200);
    // A revoked user can still act on a PUBLIC or recipe-less suggestion (nothing restricted involved).
    await local.query(`DELETE FROM club_memberships WHERE club_id = $1 AND user_id = $2`, [club, ids.member]);
    const pub = await local.query(`INSERT INTO ai_suggestions (user_id, date, suggestion_type, recipe_id, title, reason) VALUES ($1, now(), 'mood_based', $2, 'pub', 'r') RETURNING id`, [ids.member, recipe.public]);
    assert.equal((await call("POST", `/api/suggestions/${pub.rows[0].id}/dismiss`, "member")).status, 200);
  });

  test("an authorized member can still dismiss and later no longer see it; anonymous callers are refused", async () => {
    assert.equal((await call("GET", "/api/suggestions/today", "anon")).status, 401);
    assert.equal((await call("POST", `/api/suggestions/${sug.memberPrivate}/accept`, "anon")).status, 401);
    await call("POST", `/api/suggestions/${sug.memberPrivate}/dismiss`, "member");
    assert.ok(!titlesOf(await today("member")).includes(`Start your day with ${PRIVATE_TITLE}`));
  });

  test("newly generated suggestions respect current recipe visibility", async () => {
    await local.query(`TRUNCATE ai_suggestions`);
    for (let i = 0; i < 29; i++) {
      await local.query(`INSERT INTO recipes (title, ingredients, instructions, origin_club_id) VALUES ($1, '["x"]'::jsonb, '["y"]'::jsonb, $2)`, [`${PRIVATE_TITLE}-${i}`, club]);
    }
    for (const who of ["member", "outsider"]) {
      await local.query(`INSERT INTO user_drink_stats (user_id, current_streak) VALUES ($1, 5)`, [ids[who]]);
    }
    const privateIds = new Set((await local.query(`SELECT id FROM recipes WHERE origin_club_id IS NOT NULL`)).rows.map((r) => r.id));
    let memberSawPrivate = false;
    for (let i = 0; i < 12; i++) {
      const out = await call("POST", "/api/suggestions/generate", "outsider");
      assert.equal(out.status, 200);
      assert.ok(!out.text.includes(PRIVATE_TITLE), "outsider was suggested a private-club recipe");
      assert.ok((out.json.suggestions as any[]).every((s) => !s.recipeId || !privateIds.has(s.recipeId)));
      const m = await call("POST", "/api/suggestions/generate", "member");
      memberSawPrivate ||= (m.json.suggestions as any[]).some((s) => s.recipeId && privateIds.has(s.recipeId));
    }
    assert.ok(memberSawPrivate, "a member can be suggested club recipes");
  });

  test("the suggestion endpoints take no client-supplied visibility or identity", async () => {
    const r = await fetch(`http://127.0.0.1:${(server.address() as AddressInfo).port}/api/suggestions/today?userId=${ids.member}&visible=true`, { headers: { "x-user-id": ids.member } });
    assert.equal(r.status, 401);
  });
}
