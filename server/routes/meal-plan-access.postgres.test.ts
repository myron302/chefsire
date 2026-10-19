/**
 * Phase 3C: meal-plan access control.
 *
 * Real HTTP, real routers, real SQL on a local PostgreSQL (CS_TEST_PG_URL; skipped otherwise).
 * Invariants: draft/unpublished plans exist only for their creator (and holders of an entitlement); a published plan's
 * contents (`version.mealStructure`) go only to the creator or to a viewer holding a verified_paid / free_acquired
 * entitlement; everyone else gets the storefront preview. Social actions on a plan follow the same visibility rule.
 */
import test from "node:test";
import assert from "node:assert/strict";
import express from "express";
import type { AddressInfo } from "node:net";
import { PG_URL, connectLocalPg, ddl, makeCaller } from "../test-support/authz-pg-harness";

const SECRET = "SECRET-MEAL-STRUCTURE";

if (!PG_URL) {
  test("meal-plan access (skipped: CS_TEST_PG_URL not set)", { skip: true }, () => {});
} else {
  const local = await connectLocalPg();
  const schema = await import("../../shared/schema");
  await local.query(`
    DROP TABLE IF EXISTS users, follows, meal_plan_blueprints, blueprint_versions, meal_plan_purchases, meal_plan_reviews,
      meal_plan_likes, meal_plan_saves, meal_plan_comments, shared_week_likes, shared_week_saves, shared_week_comments,
      meal_plan_creator_profiles, meal_planner_analytics_events CASCADE;
    ${ddl(schema.users, "users", ", UNIQUE (username), UNIQUE (email)")};
    ${ddl(schema.follows, "follows")};
    ${ddl(schema.mealPlanBlueprints, "meal_plan_blueprints")};
    ${ddl(schema.blueprintVersions, "blueprint_versions")};
    ${ddl(schema.mealPlanPurchases, "meal_plan_purchases")};
    ${ddl(schema.mealPlanReviews, "meal_plan_reviews")};
  `);
  // Owned by the meal-planner-advanced schema; only the columns the saved-items query reads.
  await local.query(`DROP TABLE IF EXISTS meal_plan_week_shares; CREATE TABLE meal_plan_week_shares (id text PRIMARY KEY DEFAULT gen_random_uuid(), user_id text, week_anchor date, visibility text, public_share_token text, updated_at timestamp DEFAULT now())`);
  const { default: mealPlansRouter } = await import("./meal-plans");
  const { default: mealSocialRouter, ensureMealSocialSchema } = await import("./meal-social");
  await ensureMealSocialSchema();
  const app = express();
  app.use(express.json());
  app.use("/api", mealPlansRouter);
  app.use("/api", mealSocialRouter);
  const server = app.listen(0);
  test.after(async () => { server.close(); await local.end(); });

  const ids: Record<string, string> = {};
  const plan: Record<string, string> = {};
  const call = makeCaller(() => `http://127.0.0.1:${(server.address() as AddressInfo).port}`, (who) => ids[who]);

  test.beforeEach(async () => {
    await local.query(`TRUNCATE users, follows, meal_plan_blueprints, blueprint_versions, meal_plan_purchases, meal_plan_reviews CASCADE`);
    for (const name of ["creator", "buyer", "freebie", "stranger", "legacy"]) {
      ids[name] = (await local.query(`INSERT INTO users (username, email, display_name, password) VALUES ($1, $2, $1, 'x') RETURNING id`, [name, `${name}@example.com`])).rows[0].id;
    }
    const mk = async (key: string, status: string, priceInCents: number) => {
      plan[key] = (await local.query(
        `INSERT INTO meal_plan_blueprints (creator_id, title, price_in_cents, status) VALUES ($1, $2, $3, $4) RETURNING id`,
        [ids.creator, `${key}-title`, priceInCents, status],
      )).rows[0].id;
      await local.query(`INSERT INTO blueprint_versions (blueprint_id, version, meal_structure) VALUES ($1, 1, $2)`, [plan[key], `${SECRET}-${key}`]);
    };
    await mk("paid", "published", 1500);
    await mk("free", "published", 0);
    await mk("draft", "draft", 1500);
    await mk("unpublished", "published", 1500);
    await local.query(`INSERT INTO meal_plan_purchases (user_id, blueprint_id, price_paid_cents, payment_status, acquisition_type, payment_provider, provider_payment_id, provider_payment_status, payment_verified_at)
      VALUES ($1, $2, 1500, 'verified_paid', 'paid', 'square', 'pay_1', 'COMPLETED', now())`, [ids.buyer, plan.paid]);
    await local.query(`INSERT INTO meal_plan_purchases (user_id, blueprint_id, price_paid_cents, payment_status, acquisition_type) VALUES ($1, $2, 0, 'free_acquired', 'free')`, [ids.freebie, plan.free]);
    // A historical, unverified row: it is NOT an entitlement.
    await local.query(`INSERT INTO meal_plan_purchases (user_id, blueprint_id, price_paid_cents, payment_status, acquisition_type) VALUES ($1, $2, 1500, 'legacy_unverified', 'legacy_unverified')`, [ids.legacy, plan.paid]);
    // The buyer bought this plan, then the creator unpublished it.
    await local.query(`INSERT INTO meal_plan_purchases (user_id, blueprint_id, price_paid_cents, payment_status, acquisition_type, payment_provider, provider_payment_id, provider_payment_status, payment_verified_at)
      VALUES ($1, $2, 1500, 'verified_paid', 'paid', 'square', 'pay_2', 'COMPLETED', now())`, [ids.buyer, plan.unpublished]);
    await local.query(`UPDATE meal_plan_blueprints SET status = 'draft' WHERE id = $1`, [plan.unpublished]);
  });

  const get = (key: string, as: string) => call("GET", `/api/meal-plans/${plan[key]}`, as);

  test("anonymous viewers get the storefront preview of a published plan, never its contents", async () => {
    for (const key of ["paid", "free"]) {
      const r = await get(key, "anon");
      assert.equal(r.status, 200);
      assert.equal(r.json.plan.blueprint.title, `${key}-title`);
      assert.equal(r.json.version, null);
      assert.equal(r.json.access.contentLocked, true);
      assert.ok(!r.text.includes(SECRET), `${key} contents leaked to anonymous viewer`);
    }
  });

  test("non-purchasers (and unverified legacy rows) get the preview without contents", async () => {
    for (const who of ["stranger", "legacy"]) {
      const r = await get("paid", who);
      assert.equal(r.status, 200);
      assert.equal(r.json.version, null);
      assert.ok(!r.text.includes(SECRET), `${who} saw paid contents`);
    }
    const free = await get("free", "stranger");
    assert.equal(free.json.version, null, "a free plan's contents need the free acquisition");
    assert.ok(!free.text.includes(SECRET));
  });

  test("the creator, a verified purchaser and a free-acquirer keep full access", async () => {
    for (const [key, who] of [["paid", "creator"], ["draft", "creator"], ["free", "creator"], ["paid", "buyer"], ["free", "freebie"]] as const) {
      const r = await get(key, who);
      assert.equal(r.status, 200, `${who} ${key}`);
      assert.equal(r.json.version.mealStructure, `${SECRET}-${key}`);
      assert.equal(r.json.access.contentLocked, false);
    }
  });

  test("a verified purchaser keeps the contents they bought after the creator unpublishes it", async () => {
    const r = await get("unpublished", "buyer");
    assert.equal(r.status, 200);
    assert.equal(r.json.version.mealStructure, `${SECRET}-unpublished`);
    assert.equal((await get("unpublished", "stranger")).status, 404);
  });

  test("draft plans are invisible (404, same as a missing id) to anonymous users and non-creators", async () => {
    const missing = await call("GET", "/api/meal-plans/does-not-exist", "anon");
    for (const who of ["anon", "stranger", "buyer", "freebie"]) {
      const r = await get("draft", who);
      assert.equal(r.status, 404, who);
      assert.deepEqual(r.json, missing.json);
      assert.ok(!r.text.includes(SECRET) && !r.text.includes("draft-title"));
    }
  });

  test("alternate endpoints do not expose draft plans", async () => {
    for (const who of ["anon", "stranger"]) {
      assert.equal((await call("GET", `/api/meal-plans/${plan.draft}/comments`, who)).status, 404);
    }
    assert.equal((await call("POST", `/api/meal-plans/${plan.draft}/like`, "stranger")).status, 404);
    assert.equal((await call("POST", `/api/meal-plans/${plan.draft}/save`, "stranger")).status, 404);
    assert.equal((await call("POST", `/api/meal-plans/${plan.draft}/comments`, "stranger", { comment: "hi" })).status, 404);
    assert.equal((await call("POST", "/api/meal-planner/events", "stranger", { eventType: "marketplace_plan_save", mealPlanId: plan.draft })).status, 404);
    // Browse, discovery and the creator storefront list published plans only.
    for (const path of ["/api/meal-plans", "/api/meal-plans/discovery/sections", `/api/meal-plan-creators/${ids.creator}/plans`]) {
      const r = await call("GET", path, "stranger");
      assert.ok(!r.text.includes("draft-title") && !r.text.includes(SECRET), path);
    }
    // The creator still reaches their own draft through the social surface.
    assert.equal((await call("GET", `/api/meal-plans/${plan.draft}/comments`, "creator")).status, 200);
  });

  test("a draft saved before it was unpublished does not leak through the saved-items list", async () => {
    await local.query(`INSERT INTO meal_plan_saves (user_id, blueprint_id) VALUES ($1, $2)`, [ids.stranger, plan.draft]);
    const r = await call("GET", "/api/me/saved-meal-planner-items", "stranger");
    assert.equal(r.status, 200);
    assert.ok(!r.text.includes("draft-title"));
  });

  test("published plans stay publicly commentable and savable (social sharing is unchanged)", async () => {
    assert.equal((await call("GET", `/api/meal-plans/${plan.paid}/comments`, "anon")).status, 200);
    assert.equal((await call("POST", `/api/meal-plans/${plan.paid}/like`, "stranger")).status, 200);
    assert.equal((await call("POST", `/api/meal-plans/${plan.paid}/save`, "stranger")).status, 200);
  });

  test("storefront browse and my-purchases contracts are unchanged", async () => {
    const browse = await call("GET", "/api/meal-plans", "anon");
    assert.equal(browse.status, 200);
    assert.deepEqual(browse.json.plans.map((p: any) => p.blueprint.title).sort(), ["free-title", "paid-title"]);
    const mine = await call("GET", "/api/my-purchases", "buyer");
    assert.equal(mine.status, 200);
    assert.equal(mine.json.purchases.length, 2);
  });
}
