/**
 * Back office part 3a: a member's data survives a lapsed plan and a deactivation, and comes back when they return.
 *
 * Myron: "if i resubscribe i want all the info to sync back up ... not just wedding planner the meal planner pantry etc".
 * Real routers (sign-in, users, wedding planner, marketplace) on a real local PostgreSQL with the production DDL. The
 * whole database is counted table by table before and after: lapse + deactivate + reactivate deletes nothing.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import express from "express";
import cookieParser from "cookie-parser";
import type { AddressInfo } from "node:net";
import { PG_URL, connectLocalPg, ddl, makeCaller } from "../test-support/authz-pg-harness";
import { testAuthHeader } from "../test-support/auth-test-env";
import { BACK_OFFICE_SQL, CLEAN_UP_BACK_OFFICE, DROP_BACK_OFFICE, makeStaff, makeStaffCaller } from "../test-support/staff-portal-harness";

const DEACTIVATION_SQL = readFileSync(new URL("../../docs/ops/2026-11-10-account-deactivation.sql", import.meta.url), "utf8");
const TRIALS_SQL = readFileSync(new URL("../../docs/ops/2026-11-09-nutrition-intro-trials.sql", import.meta.url), "utf8");

if (!PG_URL) {
  test("Account deactivation (requires CS_TEST_PG_URL)", { skip: true }, () => {});
} else {
  test("lapse, deactivate and come back: every planner, pantry, meal plan and store record is still there", async () => {
    const local = await connectLocalPg();
    const schema = await import("../../shared/schema");
    const { default: auth } = await import("./auth");
    const { default: users } = await import("./users");
    const { default: marketplace } = await import("./marketplace");
    const { default: budget } = await import("./wedding-budget-settings");
    const { default: tasks } = await import("./wedding-planning-tasks");
    const { createOpsRouter } = await import("./ops");
    const { hasNutritionPremium } = await import("../lib/nutrition-entitlement");
    const { default: bcryptjs } = await import("bcryptjs");
    const app = express();
    app.set("trust proxy", true);
    app.use(express.json());
    app.use(cookieParser());
    app.use("/api", auth);
    app.use("/api/users", users);
    app.use("/api/marketplace", marketplace);
    app.use("/api/wedding", budget);
    app.use("/api/wedding", tasks);
    app.use("/api/ops", createOpsRouter());
    const server = app.listen(0, "127.0.0.1");
    const TABLES = ["users", "products", "stores", "orders", "notifications", "pantry_items", "meal_plans", "meal_plan_entries",
      "nutrition_intro_trials", "wedding_budget_settings", "wedding_planning_tasks"];
    try {
      await local.query(`
        ${DROP_BACK_OFFICE}
        DROP TABLE IF EXISTS ${TABLES.slice().reverse().join(", ")} CASCADE;
        ${ddl(schema.users, "users")};
        ${ddl(schema.products, "products")};
        ${ddl(schema.stores, "stores")};
        ${ddl(schema.orders, "orders")};
        ${ddl(schema.notifications, "notifications")};
        ${ddl(schema.pantryItems, "pantry_items")};
        ${ddl(schema.mealPlans, "meal_plans")};
        ${ddl(schema.mealPlanEntries, "meal_plan_entries")};
        ${TRIALS_SQL}
        ${BACK_OFFICE_SQL}
        ${DEACTIVATION_SQL}
      `);
      const ids: Record<string, string> = {};
      for (const name of ["planner", "friend"]) {
        ids[name] = (await local.query(
          `INSERT INTO users (username, email, display_name, password, auth_version, email_verified_at, email_verified_via, is_private)
           VALUES ($1, $2, $1, $3, 1, now(), 'email_link', false) RETURNING id`,
          [name, `${name}@example.test`, await bcryptjs.hash("member-password", 4)],
        )).rows[0].id;
      }
      const base = () => `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
      const call = makeCaller(base, (who) => ids[who]);
      const helper = await makeStaff(local, "helper", { groups: ["grp-support"] });
      const staffCall = makeStaffCaller(base, () => helper.cookie);
      const login = () => call("POST", "/api/auth/login", "anon", { email: "planner@example.test", password: "member-password" });

      // The planner's world: wedding planner (through its own routes), pantry, meal plans, a store and a product.
      const allocations = [{ key: "venue", label: "Venue", percentage: 30 }];
      assert.equal((await call("POST", "/api/wedding/budget-settings", "planner", { budgetMin: 9000, budgetMax: 30000, guestCount: 120, allocations })).status, 200);
      const plannerTasks = [{ id: "t1", title: "Book the venue", completed: false }];
      const savedTasks = await call("POST", "/api/wedding/planning-tasks", "planner", { tasks: plannerTasks });
      assert.equal(savedTasks.status, 200, savedTasks.text);
      const tasksBefore = (await call("GET", "/api/wedding/planning-tasks", "planner")).json;
      await local.query("INSERT INTO pantry_items (user_id, name, quantity, unit) VALUES ($1, 'Arborio rice', 2, 'kg'), ($1, 'Saffron', 1, 'g')", [ids.planner]);
      const plan = (await local.query("INSERT INTO meal_plans (user_id, name, start_date, end_date) VALUES ($1, 'Wedding week', now(), now() + interval '7 days') RETURNING id", [ids.planner])).rows[0];
      await local.query("INSERT INTO meal_plan_entries (meal_plan_id, date, meal_type, custom_name) VALUES ($1, now(), 'dinner', 'Risotto')", [plan.id]);
      await local.query("INSERT INTO stores (user_id, handle, name, published) VALUES ($1, 'planner-shop', 'Planner Shop', true)", [ids.planner]);
      const product = (await local.query(`
        INSERT INTO products (seller_id, name, price, category, inventory, shipping_enabled, local_pickup_enabled, is_digital, in_store_only)
        VALUES ($1, 'Favor boxes', 4.50, 'general', 20, false, true, false, false) RETURNING id`, [ids.planner])).rows[0];
      const productVisible = async () => (await call("GET", "/api/marketplace/products", "friend")).json.products.some((p: any) => p.id === product.id);
      assert.equal(await productVisible(), true);

      // The plan lapses: a 30-day Nutrition trial started and ran out.
      assert.equal((await call("POST", `/api/users/${ids.planner}/nutrition/trial`, "planner", {})).status, 200);
      await local.query("UPDATE nutrition_intro_trials SET activated_at = activated_at - interval '31 days', expires_at = expires_at - interval '31 days' WHERE user_id = $1", [ids.planner]);
      assert.equal(await hasNutritionPremium(ids.planner), false, "lapsed");

      const counts = async () => {
        const out: Record<string, number> = {};
        for (const t of TABLES) out[t] = (await local.query(`SELECT count(*)::int n FROM ${t}`)).rows[0].n;
        return out;
      };
      const before = await counts();

      // Only the member can deactivate their own account.
      assert.equal((await call("POST", `/api/users/${ids.planner}/deactivate`, "friend")).status, 403);
      assert.equal((await call("POST", `/api/users/${ids.planner}/deactivate`, "anon")).status, 401);
      const off = await call("POST", `/api/users/${ids.planner}/deactivate`, "planner");
      assert.equal(off.status, 200, off.text);

      // Deactivated: signed out everywhere, hidden from others, staff can see it (and why), nothing deleted.
      assert.equal((await call("GET", "/api/wedding/budget-settings", "planner")).status, 401, "the old session ended");
      assert.equal(await productVisible(), false);
      assert.equal((await call("GET", "/api/users/planner", "friend")).status, 404);
      const record = (await staffCall("GET", `/api/ops/admin/members/${ids.planner}`, "helper")).json;
      assert.deepEqual([record.status.status, record.status.reason], ["deactivated", "Deactivated by the member"]);
      assert.equal((await staffCall("POST", `/api/ops/admin/members/${ids.planner}/status`, "helper", { status: "deactivated", reason: "Trying" })).status, 400,
        "deactivation is the member's choice, not a staff action");
      assert.deepEqual(await counts(), before, "deactivating deletes nothing");

      // Coming back: signing in reactivates the account; everything is exactly as it was. (The new session carries the
      // account's new sign-in version; the one from before deactivating stays dead.)
      const back = await login();
      const now = async (path: string) => {
        const res = await fetch(base() + path, { headers: testAuthHeader(ids.planner, { av: 2 } as any) });
        return { status: res.status, json: await res.json().catch(() => null) };
      };
      assert.equal(back.status, 200, back.text);
      assert.equal((await local.query("SELECT count(*)::int n FROM account_status WHERE user_id = $1", [ids.planner])).rows[0].n, 0);
      assert.equal((await call("GET", "/api/wedding/budget-settings", "planner")).status, 401, "the pre-deactivation session is still ended");
      assert.deepEqual((await now("/api/wedding/budget-settings")).json.settings, { budgetMin: 9000, budgetMax: 30000, guestCount: 120, allocations });
      assert.deepEqual((await now("/api/wedding/planning-tasks")).json, tasksBefore);
      assert.equal(await productVisible(), true);
      assert.equal((await call("GET", "/api/users/planner", "friend")).status, 200);
      assert.deepEqual(await counts(), before, "coming back restores without recreating or losing anything");
      assert.deepEqual((await local.query("SELECT name FROM pantry_items WHERE user_id = $1 ORDER BY name", [ids.planner])).rows.map((r) => r.name), ["Arborio rice", "Saffron"]);

      // Resubscribing works on the same account (the lapsed trial is history; a paid plan would attach to the same data).
      assert.equal((await local.query("SELECT count(*)::int n FROM nutrition_intro_trials WHERE user_id = $1", [ids.planner])).rows[0].n, 1, "the lapsed plan's record is kept");

      // The audit trail shows both of the member's own actions.
      const history = (await staffCall("GET", `/api/ops/admin/members/${ids.planner}`, "helper")).json.history.map((h: any) => h.action);
      assert.deepEqual(history.slice(0, 2), ["member.reactivated", "member.deactivated"]);

      // A suspended member can't deactivate (or sign in to undo a suspension); staff decisions aren't lifted by signing in.
      assert.equal((await staffCall("POST", `/api/ops/admin/members/${ids.planner}/status`, "helper", { status: "restricted", reason: "Review" })).status, 200);
      assert.equal((await login()).status, 200, "restricted members can sign in");
      assert.equal((await local.query("SELECT status FROM account_status WHERE user_id = $1", [ids.planner])).rows[0].status, "restricted", "signing in doesn't lift a restriction");
      const tryDeactivate = await fetch(base() + `/api/users/${ids.planner}/deactivate`, { method: "POST", headers: testAuthHeader(ids.planner, { av: 2 } as any) });
      assert.equal(tryDeactivate.status, 403, "restricted: writes refused");
    } finally {
      await new Promise<void>((resolve) => server.close(() => resolve()));
      await local.query(`${CLEAN_UP_BACK_OFFICE} DROP TABLE IF EXISTS ${TABLES.slice().reverse().join(", ")} CASCADE;`);
      await local.end();
    }
  });

  test("deleting an account that has transaction records is refused with a clear message, never a silent loss", async () => {
    const local = await connectLocalPg();
    const schema = await import("../../shared/schema");
    const { default: users } = await import("./users");
    const app = express();
    app.use(express.json());
    app.use("/api/users", users);
    const server = app.listen(0, "127.0.0.1");
    try {
      await local.query(`
        DROP TABLE IF EXISTS orders, products, users CASCADE;
        ${ddl(schema.users, "users")};
        ${ddl(schema.products, "products")};
        ${ddl(schema.orders, "orders")};
      `);
      const ids: Record<string, string> = {};
      for (const name of ["buyer", "seller", "lurker"]) {
        ids[name] = (await local.query(
          "INSERT INTO users (username, email, display_name, password, auth_version) VALUES ($1, $2, $1, 'x', 1) RETURNING id",
          [name, `${name}@example.test`],
        )).rows[0].id;
      }
      const product = (await local.query(`INSERT INTO products (seller_id, name, price, category, inventory) VALUES ($1, 'Jam', 5, 'general', 3) RETURNING id`, [ids.seller])).rows[0];
      await local.query(`INSERT INTO orders (buyer_id, seller_id, product_id, quantity, total_amount, platform_fee, seller_amount, fulfillment_method, status)
        VALUES ($1, $2, $3, 1, 5, 0.5, 4.5, 'local_pickup', 'delivered')`, [ids.buyer, ids.seller, product.id]);
      const call = makeCaller(() => `http://127.0.0.1:${(server.address() as AddressInfo).port}`, (who) => ids[who]);
      for (const who of ["buyer", "seller"]) {
        const res = await call("DELETE", `/api/users/${ids[who]}`, who);
        assert.equal(res.status, 409, res.text);
        assert.equal(res.json.code, "ACCOUNT_HAS_RECORDS");
        assert.match(res.json.message, /deactivate it instead/);
      }
      assert.equal((await local.query("SELECT count(*)::int n FROM orders")).rows[0].n, 1, "the order record is untouched");
      // An account with no transaction records isn't refused for records (deletion itself is unchanged by this release).
      assert.notEqual((await call("DELETE", `/api/users/${ids.lurker}`, "lurker")).status, 409);
    } finally {
      await new Promise<void>((resolve) => server.close(() => resolve()));
      await local.query("DROP TABLE IF EXISTS orders, products, users CASCADE; CREATE TABLE IF NOT EXISTS account_status (user_id varchar PRIMARY KEY, status text NOT NULL, reason text, changed_by varchar, changed_at timestamptz NOT NULL DEFAULT now())");
      await local.end();
    }
  });

  test("a suspension that lands while a deactivated member is signing in wins: no session, still suspended", async () => {
    const local = await connectLocalPg();
    const schema = await import("../../shared/schema");
    const { default: auth } = await import("./auth");
    const { signInBlock } = await import("../lib/account-status");
    const { default: bcryptjs } = await import("bcryptjs");
    const app = express();
    app.set("trust proxy", true);
    app.use(express.json());
    app.use(cookieParser());
    app.use("/api", auth);
    const server = app.listen(0, "127.0.0.1");
    try {
      await local.query(`${DROP_BACK_OFFICE} DROP TABLE IF EXISTS users CASCADE; ${ddl(schema.users, "users")}; ${BACK_OFFICE_SQL} ${DEACTIVATION_SQL}`);
      const id = (await local.query(
        `INSERT INTO users (username, email, display_name, password, auth_version, email_verified_at, email_verified_via)
         VALUES ('racer', 'racer@example.test', 'racer', $1, 2, now(), 'email_link') RETURNING id`,
        [await bcryptjs.hash("member-password", 4)],
      )).rows[0].id;
      const deactivate = () => local.query("INSERT INTO account_status (user_id, status, reason, changed_by) VALUES ($1, 'deactivated', 'Deactivated by the member', $1) ON CONFLICT (user_id) DO UPDATE SET status = 'deactivated'", [id]);

      /** Staff suspend the account while holding the account-row lock; `during` runs while the lock is held. */
      const suspendWhile = async <T>(during: () => Promise<T>, waitingQuery: string) => {
        const holder = await local.connect();
        let committed = false;
        try {
          await holder.query("BEGIN");
          await holder.query("SELECT id FROM users WHERE id = $1 FOR UPDATE", [id]);
          await holder.query("UPDATE account_status SET status = 'suspended', reason = 'Fraud' WHERE user_id = $1", [id]);
          await holder.query("UPDATE users SET auth_version = auth_version + 1 WHERE id = $1", [id]);
          const racing = during();
          const started = Date.now();
          for (;;) {
            const n = (await local.query(
              "SELECT count(*)::int AS n FROM pg_stat_activity WHERE wait_event_type = 'Lock' AND query ILIKE $1", [waitingQuery],
            )).rows[0].n;
            if (n >= 1) break;
            if (Date.now() - started > 10_000) throw new Error("the sign-in never reached the account lock");
            await new Promise((r) => setTimeout(r, 25));
          }
          await holder.query("COMMIT");
          committed = true;
          return await racing;
        } finally {
          if (!committed) await holder.query("ROLLBACK").catch(() => {});
          holder.release();
        }
      };

      // Password sign-in (HTTP): read deactivated -> staff suspend commits -> the sign-in must be refused.
      await deactivate();
      const res = await suspendWhile(() => fetch(`http://127.0.0.1:${(server.address() as AddressInfo).port}/api/auth/login`, {
        method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ email: "racer@example.test", password: "member-password" }),
      }), "%from users where id = $1 for update%");
      assert.equal(res.status, 403, await res.clone().text());
      assert.equal((await res.json()).code, "ACCOUNT_SUSPENDED");
      assert.equal(res.headers.get("set-cookie"), null, "no session cookie");
      assert.equal((await local.query("SELECT status FROM account_status WHERE user_id = $1", [id])).rows[0].status, "suspended");

      // The shared gate every sign-in method uses (password, Google, Facebook, TikTok), same interleaving.
      await local.query("UPDATE account_status SET status = 'deactivated' WHERE user_id = $1", [id]);
      const verdict = await suspendWhile(() => signInBlock(id), "%from users where id = $1 for update%");
      assert.equal(verdict?.code, "ACCOUNT_SUSPENDED");
      assert.equal((await local.query("SELECT status FROM account_status WHERE user_id = $1", [id])).rows[0].status, "suspended");
      assert.equal((await local.query("SELECT count(*)::int n FROM admin_audit_log WHERE action = 'member.reactivated'")).rows[0].n, 0, "never reactivated");

      // Without a race, signing in reactivates (and is audited once).
      await local.query("UPDATE account_status SET status = 'deactivated' WHERE user_id = $1", [id]);
      assert.equal(await signInBlock(id), null);
      assert.equal((await local.query("SELECT count(*)::int n FROM account_status WHERE user_id = $1", [id])).rows[0].n, 0);
      assert.equal((await local.query("SELECT count(*)::int n FROM admin_audit_log WHERE action = 'member.reactivated'")).rows[0].n, 1);
    } finally {
      await new Promise<void>((resolve) => server.close(() => resolve()));
      await local.query(`${CLEAN_UP_BACK_OFFICE} DROP TABLE IF EXISTS users CASCADE;`);
      await local.end();
    }
  });
}
