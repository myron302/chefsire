import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import express from "express";
import type { AddressInfo } from "node:net";
import { PG_URL, connectLocalPg, ddl, makeCaller } from "../test-support/authz-pg-harness";

// Both meal-planner gates (settings "premium" and week generation) use the same server-verified check.
test("meal planner premium gates use the server-verified trial", () => {
  const src = readFileSync(new URL("./meal-planner-week.ts", import.meta.url), "utf8");
  assert.match(src, /premium: await hasNutritionPremium\(u\.id\)/);
  assert.match(src, /if \(!\(await hasNutritionPremium\(u\.id\)\)\) \{/);
  assert.doesNotMatch(src, /assertPremiumNutrition\(/);
  const nutrition = readFileSync(new URL("./nutrition.ts", import.meta.url), "utf8");
  assert.match(nutrition, /await revokeNutritionTrial\(userId\)/, "downgrading to Free ends the trial");
  assert.match(readFileSync(new URL("./auth.ts", import.meta.url), "utf8"), /await withNutritionEntitlement\(serializeAuthenticatedUser\(user\)\)/);
});

if (!PG_URL) {
  test("Nutrition trial (requires CS_TEST_PG_URL)", { skip: true }, () => {});
} else {
  test("a cardless 30-day Nutrition trial: once per account, server-dated, unlocks premium, ends on downgrade", async () => {
    const local = await connectLocalPg();
    const schema = await import("../../shared/schema");
    const { default: usersRouter } = await import("./users");
    const { nutritionEntitlement, hasNutritionPremium } = await import("../lib/nutrition-entitlement");
    const app = express();
    app.use(express.json());
    app.use("/api/users", usersRouter);
    const server = app.listen(0, "127.0.0.1");
    try {
      await local.query(`
        DROP TABLE IF EXISTS nutrition_intro_trials, users CASCADE;
        ${ddl(schema.users, "users")};
        ${readFileSync(new URL("../../docs/ops/2026-11-09-nutrition-intro-trials.sql", import.meta.url), "utf8")}
      `);
      const ids: Record<string, string> = {};
      for (const name of ["member", "other", "legacy"]) {
        ids[name] = (await local.query(
          "INSERT INTO users (username, email, display_name, password, auth_version) VALUES ($1, $2, $1, 'fixture', 1) RETURNING id",
          [name, `${name}@example.test`],
        )).rows[0].id;
      }
      // A legacy self-set flag is not evidence.
      await local.query("UPDATE users SET nutrition_premium = true, nutrition_trial_ends_at = now() + interval '300 days' WHERE id = $1", [ids.legacy]);
      assert.equal(await hasNutritionPremium(ids.legacy), false);

      const call = makeCaller(() => `http://127.0.0.1:${(server.address() as AddressInfo).port}`, (who) => ids[who]);
      const start = (who: string, target = who) => call("POST", `/api/users/${ids[target]}/nutrition/trial`, who, {});
      const premium = (who: string) => hasNutritionPremium(ids[who]);

      assert.equal(await premium("member"), false);
      assert.equal((await start("other", "member")).status, 403, "nobody starts someone else's trial");
      assert.equal((await start("anon", "member")).status, 401);

      const first = await start("member");
      assert.equal(first.status, 200, first.text);
      const span = new Date(first.json.trialEndsAt).getTime() - new Date(first.json.trial.activatedAt).getTime();
      assert.equal(span, 30 * 24 * 3600 * 1000, "exactly 30 days, set by the database");
      assert.equal(await premium("member"), true);
      assert.equal((await nutritionEntitlement(ids.member)).premium, true);

      const again = await start("member");
      assert.equal(again.status, 409, "one trial per account; never extended");
      assert.equal(again.json.code, "NUTRITION_TRIAL_USED");
      const stored = (await local.query("SELECT count(*)::int n, max(expires_at) e FROM nutrition_intro_trials WHERE user_id = $1", [ids.member])).rows[0];
      assert.equal(stored.n, 1);
      assert.equal(new Date(stored.e).getTime(), new Date(first.json.trialEndsAt).getTime());

      // Concurrent first requests from another account create exactly one trial.
      const both = await Promise.all([start("other"), start("other")]);
      assert.deepEqual(both.map((r) => r.status).sort(), [200, 409]);

      // An expired trial no longer grants access (shift the whole row 31 days back; the CHECK keeps the 30-day span).
      await local.query("UPDATE nutrition_intro_trials SET activated_at = activated_at - interval '31 days', expires_at = expires_at - interval '31 days' WHERE user_id = $1", [ids.other]);
      assert.equal(await hasNutritionPremium(ids.other), false);
      assert.equal((await nutritionEntitlement(ids.other)).trial.status, "expired");

      // Clients can't set the dates or the span.
      await assert.rejects(local.query("UPDATE nutrition_intro_trials SET expires_at = expires_at + interval '1 day' WHERE user_id = $1", [ids.member]));
    } finally {
      await new Promise<void>((resolve) => server.close(() => resolve()));
      await local.query("DROP TABLE IF EXISTS nutrition_intro_trials, users CASCADE");
      await local.end();
    }
  });

  test("entitlement reads fail closed when the trials table is unavailable", async () => {
    const local = await connectLocalPg();
    try {
      await local.query("DROP TABLE IF EXISTS nutrition_intro_trials CASCADE");
      const { hasNutritionPremium, withNutritionEntitlement } = await import("../lib/nutrition-entitlement");
      assert.equal(await hasNutritionPremium("00000000-0000-0000-0000-000000000000"), false);
      const u = await withNutritionEntitlement({ id: "00000000-0000-0000-0000-000000000000", nutritionPremium: true } as any);
      assert.equal(u.nutritionPremium, false);
    } finally {
      await local.end();
    }
  });
}
