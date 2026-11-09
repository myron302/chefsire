import test from "node:test";
import assert from "node:assert/strict";
import express from "express";
import type { AddressInfo } from "node:net";
import { PG_URL, connectLocalPg, ddl, makeCaller } from "../test-support/authz-pg-harness";

if (!PG_URL) {
  test("Wedding budget settings (requires CS_TEST_PG_URL)", { skip: true }, () => {});
} else {
  test("budget settings save and reload on the production table shape (no created_at column)", async () => {
    const local = await connectLocalPg();
    const schema = await import("../../shared/schema");
    const { default: router } = await import("./wedding-budget-settings");
    const app = express();
    app.use(express.json());
    app.use("/api/wedding", router);
    const server = app.listen(0, "127.0.0.1");
    try {
      // The live table as it exists in production (2026-11-09): user_id text, no created_at, no FK.
      await local.query(`
        DROP TABLE IF EXISTS wedding_budget_settings, users CASCADE;
        ${ddl(schema.users, "users")};
        CREATE TABLE wedding_budget_settings (
          user_id text PRIMARY KEY,
          budget_min integer NOT NULL DEFAULT 5000,
          budget_max integer NOT NULL DEFAULT 50000,
          guest_count integer NOT NULL DEFAULT 100,
          allocations jsonb,
          updated_at timestamptz NOT NULL DEFAULT now()
        );
      `);
      const ids: Record<string, string> = {};
      for (const name of ["planner", "other"]) {
        ids[name] = (await local.query(
          "INSERT INTO users (username, email, display_name, password, auth_version) VALUES ($1, $2, $1, 'fixture', 1) RETURNING id",
          [name, `${name}@example.test`],
        )).rows[0].id;
      }
      const call = makeCaller(() => `http://127.0.0.1:${(server.address() as AddressInfo).port}`, (who) => ids[who]);
      assert.equal((await call("GET", "/api/wedding/budget-settings", "planner")).json.settings, null);
      const allocations = [{ key: "catering", label: "Catering & Bar", percentage: 40 }, { key: "venue", label: "Venue", percentage: 20 }];
      const saved = await call("POST", "/api/wedding/budget-settings", "planner", { budgetMin: 8000, budgetMax: 30000, guestCount: 120, allocations });
      assert.equal(saved.status, 200, saved.text);
      const again = await call("POST", "/api/wedding/budget-settings", "planner", { budgetMin: 9000, budgetMax: 30000, guestCount: 150, allocations });
      assert.equal(again.status, 200, again.text);
      const loaded = await call("GET", "/api/wedding/budget-settings", "planner");
      assert.deepEqual(loaded.json.settings, { budgetMin: 9000, budgetMax: 30000, guestCount: 150, allocations });
      assert.equal((await call("GET", "/api/wedding/budget-settings", "other")).json.settings, null, "each planner sees only their own");
      assert.equal((await call("POST", "/api/wedding/budget-settings", "anon", { budgetMin: 1, budgetMax: 2, guestCount: 1 })).status, 401);
      assert.equal((await call("POST", "/api/wedding/budget-settings", "planner", { budgetMin: 5, budgetMax: 1, guestCount: 1 })).status, 400);
    } finally {
      await new Promise<void>((resolve) => server.close(() => resolve()));
      await local.query("DROP TABLE IF EXISTS wedding_budget_settings, users CASCADE");
      await local.end();
    }
  });
}
