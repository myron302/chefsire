/**
 * P2-2: unauthenticated / cross-user disclosure of private user-scoped data by client-supplied user id.
 *
 * Real HTTP against the real routers, the real storage layer and the real (auth_version-aware) requireAuth, with the
 * rendered SQL executed by a REAL local PostgreSQL (set CS_TEST_PG_URL; skipped otherwise). The URL goes through the
 * loopback-only guard first. No session-lookup test double is installed: every token is checked against users.auth_version.
 *
 * Invariant: private self-service data is selected by the authenticated actor (req.user), never by a path/query/body/header id.
 */
import "../test-support/auth-test-env";
import test from "node:test";
import assert from "node:assert/strict";
import express from "express";
import pg from "pg";
import type { AddressInfo } from "node:net";
import { getTableColumns, type SQL } from "drizzle-orm";
import { PgDialect } from "drizzle-orm/pg-core";
import { readFileSync } from "node:fs";
import { parseLocalTestDatabaseUrl } from "../test-support/local-test-database";
import { testAuthHeader } from "../test-support/auth-test-env";

process.env.DATABASE_URL ||= "postgres://u:p@p22-tests.invalid/none";
const PG_URL = process.env.CS_TEST_PG_URL;

if (!PG_URL) {
  test("user-scoped private reads (skipped: CS_TEST_PG_URL not set)", { skip: true }, () => {});
} else {
  const local = new pg.Pool(parseLocalTestDatabaseUrl(PG_URL));
  const { pool } = await import("../db/index");
  (pool as any).connect = () => local.connect();
  (pool as any).query = (q: any, params?: any[]) => (typeof q === "string" ? local.query(q, params) : local.query(params ? { ...q, values: params } : q));

  const schema = await import("../../shared/schema");
  const dialect = new PgDialect();
  const ddl = (table: any, name: string, extra = "") => {
    const cols = Object.values(getTableColumns(table)).map((c: any) => {
      const type = ({ PgInteger: "integer", PgBoolean: "boolean", PgTimestamp: "timestamp", PgJsonb: "jsonb", PgNumeric: "numeric", PgReal: "real", PgSerial: "serial" } as Record<string, string>)[c.columnType] ?? "text";
      let def = "";
      if (c.hasDefault && c.default !== undefined) {
        def = typeof c.default === "object" && c.default !== null && "queryChunks" in c.default
          ? ` DEFAULT ${dialect.sqlToQuery(c.default as SQL).sql}`
          : typeof c.default === "string" ? ` DEFAULT '${c.default.replace(/'/g, "''")}'` : ` DEFAULT ${c.default}`;
      }
      const pk = c.primary ? " PRIMARY KEY" : "";
      return `${c.name} ${type}${pk}${def}`;
    });
    return `CREATE TABLE ${name} (${cols.join(",")}${extra})`;
  };
  await local.query(`
    DROP TABLE IF EXISTS users, pantry_items, posts, recipes, recipe_saves, stores, user_drink_stats, custom_drinks, drink_saves,
      cook_together_sessions, cook_together_participants CASCADE;
    ${ddl(schema.users, "users", ", UNIQUE (username), UNIQUE (email)")};
    ${ddl(schema.pantryItems, "pantry_items")};
    ${ddl(schema.posts, "posts")};
    ${ddl(schema.recipes, "recipes")};
    ${ddl(schema.recipeSaves, "recipe_saves")};
    ${ddl(schema.stores, "stores", ", UNIQUE (user_id), UNIQUE (handle)")};
    ${ddl(schema.userDrinkStats, "user_drink_stats", ", UNIQUE (user_id)")};
    ${ddl(schema.customDrinks, "custom_drinks")};
    ${ddl(schema.drinkSaves, "drink_saves")};
    CREATE TABLE cook_together_sessions (id text PRIMARY KEY DEFAULT gen_random_uuid(), recipe_id text, host_user_id text, room_code text);
    CREATE TABLE cook_together_participants (id text PRIMARY KEY DEFAULT gen_random_uuid(), session_id text, user_id text, completed boolean, rating integer, joined_at timestamp DEFAULT now());
  `);

  const { default: pantryRouter } = await import("./pantry");
  const { default: recipesRouter } = await import("./recipes");
  const { default: usersRouter } = await import("./users");
  const { default: storesRouter } = await import("./stores-crud");
  const { default: cookTogetherRouter } = await import("./cook-together");
  const { default: drinksRouter } = await import("./drinks");

  const app = express();
  app.use(express.json());
  app.use("/api/pantry", pantryRouter);
  app.use("/api/recipes", recipesRouter);
  app.use("/api/users", usersRouter);
  app.use("/api/stores", storesRouter);
  app.use("/api/cook-together", cookTogetherRouter);
  app.use("/api/drinks", drinksRouter);
  const server = app.listen(0);
  test.after(async () => { server.close(); await local.end(); });

  const base = () => `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  const ids = { A: "", B: "" };

  test.beforeEach(async () => {
    await local.query(`TRUNCATE users, pantry_items, posts, recipes, recipe_saves, stores, user_drink_stats, custom_drinks, drink_saves, cook_together_sessions, cook_together_participants`);
    for (const [key, name] of [["A", "alice"], ["B", "bob"]] as const) {
      ids[key] = (await local.query(
        `INSERT INTO users (username, email, display_name, password, subscription_tier, monthly_revenue, google_id)
         VALUES ($1, $2, $1, $3, 'professional', '4321.00', $4) RETURNING id`,
        [name, `${name}@example.com`, `$2a$10$${name}-HASH-SECRET`, `cus_${name}_SECRET`],
      )).rows[0].id;
    }
    for (const key of ["A", "B"] as const) {
      const tag = `${key}-secret-item`;
      await local.query(`INSERT INTO pantry_items (user_id, name, expiration_date) VALUES ($1, $2, now() + interval '2 days')`, [ids[key], tag]);
      const post = (await local.query(`INSERT INTO posts (user_id, caption) VALUES ($1, 'p') RETURNING id`, [ids[key]])).rows[0].id;
      const recipe = (await local.query(`INSERT INTO recipes (post_id, title, ingredients) VALUES ($1, $2, $3::jsonb) RETURNING id`, [post, `${key}-recipe`, JSON.stringify([tag])])).rows[0].id;
      await local.query(`INSERT INTO recipe_saves (user_id, recipe_id) VALUES ($1, $2)`, [ids[key], recipe]);
      await local.query(`INSERT INTO user_drink_stats (user_id, total_points, badges) VALUES ($1, $2, '[]'::jsonb)`, [ids[key], key === "A" ? 111 : 222]);
      const drink = (await local.query(`INSERT INTO custom_drinks (user_id, name, category, is_public) VALUES ($1, $2, 'smoothies', true) RETURNING id`, [ids[key], `${key}-public-drink`])).rows[0].id;
      await local.query(`INSERT INTO drink_saves (user_id, drink_id) VALUES ($1, $2)`, [ids[key], drink]);
      const session = (await local.query(`INSERT INTO cook_together_sessions (recipe_id, host_user_id, room_code) VALUES ($1, $2, $3) RETURNING id`, [recipe, ids[key], `${key}-ROOM`])).rows[0].id;
      await local.query(`INSERT INTO cook_together_participants (session_id, user_id, completed, rating) VALUES ($1, $2, true, 5)`, [session, ids[key]]);
    }
    await local.query(`INSERT INTO stores (user_id, handle, name, published) VALUES ($1, 'alice-draft', 'A-draft-store', false), ($2, 'bob-live', 'B-live-store', true)`, [ids.A, ids.B]);
  });

  type As = "A" | "B" | "anon" | { stale: "A" };
  const headersFor = (as: As, extra: Record<string, string> = {}) => ({
    ...(as === "anon" ? {} : typeof as === "string" ? testAuthHeader(ids[as]) : testAuthHeader(ids.A, { av: 0 } as any)),
    ...extra,
  });
  async function call(method: string, path: string, as: As = "anon", opts: { body?: unknown; headers?: Record<string, string> } = {}) {
    const res = await fetch(base() + path, {
      method,
      headers: { ...(opts.body !== undefined ? { "content-type": "application/json" } : {}), ...headersFor(as, opts.headers) },
      body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
    });
    const text = await res.text();
    return { status: res.status, text, json: (() => { try { return JSON.parse(text); } catch { return null; } })() };
  }
  const leaks = (r: { text: string }, ...needles: string[]) => needles.filter((n) => r.text.includes(n));

  /** One private self-data read: [label, path template where {id} is the id segment, marker for A's data, marker for B's data]. */
  const families: Array<[string, (id: string) => string, string, string]> = [
    ["pantry list", (id) => `/api/pantry/users/${id}/pantry`, "A-secret-item", "B-secret-item"],
    ["pantry expiring", (id) => `/api/pantry/users/${id}/pantry/expiring?days=7`, "A-secret-item", "B-secret-item"],
    ["pantry recipe-suggestions", (id) => `/api/pantry/users/${id}/pantry/recipe-suggestions?maxMissingIngredients=3&limit=50`, "A-recipe", "B-recipe"],
    ["saved recipes", (id) => `/api/recipes/users/${id}/saved-recipes`, "A-recipe", "B-recipe"],
    ["subscription info", (id) => `/api/users/${id}/subscription/info`, "4321", "4321"],
    ["drink stats", (id) => `/api/drinks/user-drink-stats/${id}`, "111", "222"],
    ["saved custom drinks", (id) => `/api/drinks/custom-drinks/saved/${id}`, "A-public-drink", "B-public-drink"],
    ["cook-together history", (id) => `/api/cook-together/user/${id}/history`, "A-ROOM", "B-ROOM"],
  ];

  for (const [label, path, markA, markB] of families) {
    // `subscription info` shares a marker value between users, and recipe-suggestions legitimately lists other
    // authors' public recipes that match the CALLER's pantry, so only the pantry-derived marker is user-specific there.
    const crossCheck = label !== "subscription info" && label !== "pantry recipe-suggestions";

    test(`${label}: A anonymous caller is denied (path names a real user)`, async () => {
      for (const target of ["A", "B"] as const) {
        const r = await call("GET", path(ids[target]));
        assert.equal(r.status, 401, `${path(ids[target])} -> ${r.status} ${r.text.slice(0, 200)}`);
        assert.deepEqual(leaks(r, "A-secret", "B-secret", "A-recipe", "B-recipe", "A-ROOM", "B-ROOM"), []);
      }
    });

    test(`${label}: B/D owner reads own data`, async () => {
      const a = await call("GET", path(ids.A), "A");
      assert.equal(a.status, 200, a.text.slice(0, 300));
      assert.ok(a.text.includes(markA), `A response should contain ${markA}: ${a.text.slice(0, 300)}`);
      const b = await call("GET", path(ids.B), "B");
      assert.equal(b.status, 200, b.text.slice(0, 300));
      assert.ok(b.text.includes(markB));
      if (crossCheck) {
        assert.ok(!a.text.includes(markB));
        assert.ok(!b.text.includes(markA));
      }
    });

    test(`${label}: C/H A cannot select B (existing or nonexistent target) and the denial is identical`, async () => {
      const other = await call("GET", path(ids.B), "A");
      const missing = await call("GET", path("00000000-0000-0000-0000-000000000000"), "A");
      assert.equal(other.status, 403);
      assert.equal(missing.status, 403);
      assert.equal(other.text, missing.text, "denial for an existing and a nonexistent target must be indistinguishable");
      if (crossCheck) assert.deepEqual(leaks(other, markB), []);
      assert.deepEqual(leaks(other, "B-secret", "bob@example.com", "SECRET"), []);
    });

    test(`${label}: E/G identity via query or header cannot replace the actor (self alias "me")`, async () => {
      const spoofed = await call("GET", path("me") + (path("me").includes("?") ? "&" : "?") + `userId=${ids.B}&currentUserId=${ids.B}&user_id=${ids.B}`, "A",
        { headers: { "x-user-id": ids.B, "x-userid": ids.B } });
      assert.equal(spoofed.status, 200, spoofed.text.slice(0, 300));
      assert.ok(spoofed.text.includes(markA));
      if (crossCheck) assert.deepEqual(leaks(spoofed, markB), []);
      const anonSpoof = await call("GET", path("me") + (path("me").includes("?") ? "&" : "?") + `userId=${ids.B}`, "anon", { headers: { "x-user-id": ids.B } });
      assert.equal(anonSpoof.status, 401);
    });

    test(`${label}: a session invalidated by auth_version is denied`, async () => {
      await local.query(`UPDATE users SET auth_version = 2 WHERE id = $1`, [ids.A]);
      const r = await call("GET", path(ids.A), "A");
      assert.equal(r.status, 401);
    });
  }

  test("recipe-suggestions never returns another account's raw user row (password hash / email)", async () => {
    const r = await call("GET", `/api/pantry/users/${ids.A}/pantry/recipe-suggestions?maxMissingIngredients=9&limit=50`, "A");
    assert.equal(r.status, 200);
    assert.deepEqual(leaks(r, "HASH-SECRET", "@example.com", "cus_", "password", "stripe"), []);
  });

  test("subscription info returns only the commission/entitlement fields the client uses", async () => {
    const r = await call("GET", `/api/users/${ids.A}/subscription/info`, "A");
    assert.equal(r.status, 200);
    assert.deepEqual(Object.keys(r.json).sort(), ["currentCommissionRate", "monthlyRevenue", "subscriptionEndsAt", "subscriptionStatus", "subscriptionTier", "tierPricing"]);
  });

  test("F: body identity cannot choose whose stats get a badge", async () => {
    const other = await call("POST", `/api/drinks/user-drink-stats/${ids.B}/badge`, "A", { body: { badge: "forged", userId: ids.B } });
    assert.equal(other.status, 403);
    const own = await call("POST", `/api/drinks/user-drink-stats/me/badge`, "A", { body: { badge: "mine", userId: ids.B } });
    assert.equal(own.status, 200);
    const rows = (await local.query(`SELECT user_id, badges FROM user_drink_stats ORDER BY user_id`)).rows;
    const byUser = Object.fromEntries(rows.map((r) => [r.user_id, r.badges]));
    assert.deepEqual(byUser[ids.B], [], "B must not have received any badge");
    assert.deepEqual(byUser[ids.A], ["mine"]);
  });

  test("drink-stats GET for another/nonexistent id does not create a stats row", async () => {
    await local.query(`DELETE FROM user_drink_stats WHERE user_id = $1`, [ids.B]);
    const r = await call("GET", `/api/drinks/user-drink-stats/${ids.B}`, "anon");
    assert.equal(r.status, 401);
    const r2 = await call("GET", `/api/drinks/user-drink-stats/${ids.B}`, "A");
    assert.equal(r2.status, 403);
    assert.equal((await local.query(`SELECT 1 FROM user_drink_stats WHERE user_id = $1`, [ids.B])).rowCount, 0);
  });

  test("I: stores/user/:userId stays public for published stores only; drafts are owner-only and indistinguishable from none", async () => {
    // B's published store is public.
    const pub = await call("GET", `/api/stores/user/${ids.B}`, "anon");
    assert.equal(pub.status, 200);
    assert.equal(pub.json.store?.handle, "bob-live");
    // A's draft is hidden from anonymous callers and from B, exactly like a user with no store.
    const none = await call("GET", `/api/stores/user/00000000-0000-0000-0000-000000000000`, "anon");
    for (const as of ["anon", "B"] as const) {
      const r = await call("GET", `/api/stores/user/${ids.A}`, as);
      assert.equal(r.status, 200);
      assert.equal(r.json.store, null);
      assert.ok(!r.text.includes("A-draft-store"));
      assert.deepEqual({ ...r.json, socialProof: undefined }, { ...none.json, socialProof: undefined });
    }
    // The owner still sees the draft.
    const own = await call("GET", `/api/stores/user/${ids.A}`, "A");
    assert.equal(own.json.store?.handle, "alice-draft");
    // Spoofed identity cannot unlock the draft.
    const spoof = await call("GET", `/api/stores/user/${ids.A}?userId=${ids.A}&currentUserId=${ids.A}`, "B", { headers: { "x-user-id": ids.A } });
    assert.equal(spoof.json.store, null);
  });

  test("I: users/:id/suggested stays public but exposes only the public projection and ignores a path identity", async () => {
    await local.query(`UPDATE users SET is_chef = true`);
    const anon = await call("GET", `/api/users/${ids.A}/suggested?limit=5`);
    assert.equal(anon.status, 200);
    assert.deepEqual(leaks(anon, "HASH-SECRET", "@example.com", "cus_", "stripe", "password"), []);
    assert.ok(Array.isArray(anon.json) && anon.json.length > 0);
    for (const u of anon.json) assert.ok(u.id && u.username);
    // The path id is not the viewer: A viewing "B's" suggestions is still excluded from their own list only.
    const asA = await call("GET", `/api/users/${ids.B}/suggested`, "A", { headers: { "x-user-id": ids.B } });
    assert.ok(!asA.json.some((u: any) => u.id === ids.A));
  });

  test("owner profile writes do not echo the raw account row", async () => {
    const put = await call("PUT", `/api/users/${ids.A}`, "A", { body: { bio: "hello" } });
    assert.equal(put.status, 200);
    assert.deepEqual(leaks(put, "HASH-SECRET", "cus_", "stripe", "password"), []);
  });

  test("the production router mounts the audited routers where the tests assume", () => {
    const index = readFileSync(new URL("./index.ts", import.meta.url), "utf8");
    for (const m of [/r\.use\("\/pantry", pantryRouter\)/, /r\.use\("\/recipes", recipesRouter\)/, /r\.use\("\/users", usersRouter\)/, /r\.use\("\/stores", storeRouter\)/, /r\.use\("\/cook-together", cookTogetherRouter\)/, /r\.use\("\/drinks", drinksRouter\)/])
      assert.match(index, m);
  });
}
