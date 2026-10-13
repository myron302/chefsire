/**
 * Meal-social initialization against a REAL PostgreSQL, through the real `server/app.ts` and the real drizzle/Neon `db` object.
 *
 * What the other suites fake (the database), this one does not: the unchanged `CREATE TABLE/INDEX IF NOT EXISTS` statements run for
 * real, and the "database is down" phase is a failure injected at the DRIVER boundary (`pool.connect`/`pool.query` reject), so the
 * error travels the same path a refused connection does in production: driver -> drizzle -> the initializer -> the guard.
 *
 * Set TEST_DATABASE_URL to a loopback database whose name contains "test" (see docs/catering-square-payments-phase2q.md); the suite is
 * skipped otherwise. It works inside its own schema and drops it afterwards. No migration is run and nothing outside that schema is touched.
 */
import "../test-support/accept-test-sessions";
import { testAuthHeader } from "../test-support/auth-test-env";
import test from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import type { AddressInfo } from "node:net";
import pg from "pg";
import { parseLocalTestDatabaseUrl } from "../test-support/local-test-database";

process.env.NODE_ENV = "test";
process.env.DATABASE_URL ||= "postgres://u:p@meal-social-recovery-tests.invalid/none";

const URL_ENV = process.env.TEST_DATABASE_URL?.trim();

if (!URL_ENV) {
  test("meal-social recovery on PostgreSQL (skipped: TEST_DATABASE_URL not set)", { skip: true }, () => {});
} else {
  const SCHEMA = `meal_social_recovery_${process.pid}`;
  const local = new pg.Pool({ ...parseLocalTestDatabaseUrl(URL_ENV), options: `-c search_path=${SCHEMA}`, max: 10 });
  const { pool } = await import("../db/index");

  // Driver-level switch: "down" rejects exactly as a refused connection does; "up" talks to the real local database.
  let driver: "down" | "up" = "up";
  const refused = () => Object.assign(new Error('connect ECONNREFUSED ep-private-host.neon.tech:5432 role "neondb_owner"'), { code: "ECONNREFUSED" });
  (pool as never as { connect: unknown }).connect = () => (driver === "down" ? Promise.reject(refused()) : local.connect());
  (pool as never as { query: unknown }).query = (q: unknown, params?: unknown[]) => (driver === "down" ? Promise.reject(refused()) : local.query(q as string, params));

  await local.query(`DROP SCHEMA IF EXISTS ${SCHEMA} CASCADE; CREATE SCHEMA ${SCHEMA};`);
  // Only what the social tables reference, and what the routes under test read.
  await local.query(`CREATE TABLE users (id varchar PRIMARY KEY, username text, display_name text, avatar text)`);
  await local.query(`CREATE TABLE meal_plan_blueprints (id varchar PRIMARY KEY)`);
  await local.query(`INSERT INTO users (id, username, display_name) VALUES ('user-1', 'one', 'User One'), ('user-2', 'two', 'User Two')`);
  await local.query(`INSERT INTO meal_plan_blueprints (id) VALUES ('plan-1')`);

  const { default: app } = await import("../app");
  const { mealSocialSchema } = await import("./meal-social");
  const server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  test.after(async () => {
    server.close();
    server.closeAllConnections?.();
    await local.query(`DROP SCHEMA IF EXISTS ${SCHEMA} CASCADE`);
    await local.end();
  });

  const call = async (method: string, path: string, headers: Record<string, string> = {}, body?: unknown) => {
    const response = await fetch(base + path, {
      method,
      headers: { ...headers, ...(body === undefined ? {} : { "content-type": "application/json" }) },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const text = await response.text();
    let json: any;
    try { json = JSON.parse(text); } catch { /* not JSON */ }
    return { status: response.status, headers: response.headers, text, json };
  };
  const tableExists = async (name: string) => (await local.query(`SELECT to_regclass($1) AS t`, [`${SCHEMA}.${name}`])).rows[0].t !== null;
  const SOCIAL_TABLES = ["meal_plan_likes", "meal_plan_saves", "meal_plan_comments", "shared_week_likes", "shared_week_saves", "shared_week_comments", "meal_plan_creator_profiles"];

  test("initial connection failure, then recovery on real PostgreSQL, without a restart", async () => {
    mealSocialSchema.resetForTests();
    let clock = 1_000_000;
    mealSocialSchema.setClockForTests(() => clock);
    const user = testAuthHeader("user-1");

    // The database cannot be reached. Meal-social answers 503 with nothing from the driver; everything else is unaffected.
    driver = "down";
    const down = await call("POST", "/api/meal-plans/plan-1/like", user);
    assert.equal(down.status, 503, down.text);
    assert.deepEqual(down.json, { message: "Meal planner social schema is not ready", code: "meal_planner_social_unavailable", retryable: true });
    for (const secret of ["ECONNREFUSED", "neon.tech", "neondb_owner"]) assert.ok(!down.text.includes(secret));
    assert.equal((await call("GET", "/api")).status, 200);
    assert.equal((await call("GET", "/api/definitely-not-a-route")).status, 404);
    assert.equal((await call("GET", "/api/dm/threads")).status, 401);
    for (const table of SOCIAL_TABLES) assert.equal(await tableExists(table), false, `${table} must not exist yet`);

    // The database is reachable again. The window has not elapsed, so nothing is attempted yet (bounded, not a retry per request).
    driver = "up";
    assert.equal((await call("POST", "/api/meal-plans/plan-1/like", user)).status, 503);
    assert.equal(mealSocialSchema.stats().attempts, 1);

    // After the window the next request initializes for real and the feature works.
    clock += 1_000;
    const liked = await call("POST", "/api/meal-plans/plan-1/like", user);
    assert.equal(liked.status, 200, liked.text);
    assert.equal(liked.json.likeCount, 1);
    assert.equal(liked.json.viewerHasLiked, true);
    for (const table of SOCIAL_TABLES) assert.equal(await tableExists(table), true, `${table} created`);
    assert.equal(mealSocialSchema.stats().attempts, 2);

    // And it is healed for good: no further initialization, and the writes are really in the database.
    const again = await call("POST", "/api/meal-plans/plan-1/like", user);
    assert.equal(again.status, 200);
    assert.equal(again.json.likeCount, 1, "ON CONFLICT DO NOTHING keeps the like idempotent");
    assert.equal(mealSocialSchema.stats().attempts, 2);
    assert.equal((await local.query(`SELECT count(*)::int AS n FROM meal_plan_likes`)).rows[0].n, 1);

    const commented = await call("POST", "/api/meal-plans/plan-1/comments", user, { comment: "looks great" });
    assert.equal(commented.status, 201, commented.text);
    const listed = await call("GET", "/api/meal-plans/plan-1/comments", user);
    assert.equal(listed.status, 200);
    assert.equal(listed.json.comments.length, 1);
    assert.equal(listed.json.comments[0].user.id, "user-1");
  });

  test("the unchanged DDL is idempotent on a database that already has the tables, and re-running it does not disturb data", async () => {
    mealSocialSchema.resetForTests();
    mealSocialSchema.setClockForTests(null);
    driver = "up";
    const before = (await local.query(`SELECT count(*)::int AS n FROM meal_plan_likes`)).rows[0].n;
    assert.equal(before, 1);

    const response = await call("GET", "/api/meal-plans/plan-1/comments", testAuthHeader("user-2"));
    assert.equal(response.status, 200, response.text);
    assert.equal(mealSocialSchema.stats().attempts, 1);
    assert.equal((await local.query(`SELECT count(*)::int AS n FROM meal_plan_likes`)).rows[0].n, before);
    assert.equal(response.json.social.likeCount, 1);
    assert.equal(response.json.social.viewerHasLiked, false);
  });

  test("a comment can only be deleted by its author", async () => {
    mealSocialSchema.resetForTests();
    const comments = (await call("GET", "/api/meal-plans/plan-1/comments", testAuthHeader("user-1"))).json.comments;
    const id = comments[0].id;

    const stranger = await call("DELETE", `/api/meal-plans/plan-1/comments/${id}`, testAuthHeader("user-2"));
    assert.equal(stranger.status, 404);
    assert.equal(stranger.json.message, "Comment not found or not owned by viewer");
    assert.equal((await local.query(`SELECT count(*)::int AS n FROM meal_plan_comments WHERE deleted_at IS NULL`)).rows[0].n, 1);

    const owner = await call("DELETE", `/api/meal-plans/plan-1/comments/${id}`, testAuthHeader("user-1"));
    assert.equal(owner.status, 200, owner.text);
    assert.equal((await local.query(`SELECT count(*)::int AS n FROM meal_plan_comments WHERE deleted_at IS NULL`)).rows[0].n, 0);
  });

  test("concurrent first requests against a real database initialize once and all succeed", async () => {
    // A fresh schema state: drop the social tables so the first burst really has to create them.
    await local.query(`DROP TABLE meal_plan_likes, meal_plan_saves, meal_plan_comments, shared_week_likes, shared_week_saves, shared_week_comments, meal_plan_creator_profiles`);
    mealSocialSchema.resetForTests();
    const before = mealSocialSchema.stats().attempts;
    const responses = await Promise.all(Array.from({ length: 30 }, (_, i) =>
      call("POST", "/api/meal-plans/plan-1/save", testAuthHeader(i % 2 ? "user-1" : "user-2"))));
    assert.ok(responses.every((r) => r.status === 200), responses.map((r) => r.status).join(","));
    assert.equal(mealSocialSchema.stats().attempts - before, 1, "thirty concurrent requests, one initialization");
    assert.equal((await local.query(`SELECT count(*)::int AS n FROM meal_plan_saves`)).rows[0].n, 2);
  });
}
