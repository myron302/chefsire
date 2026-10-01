/**
 * CS-CL-06: like/unlike/save/unsave of custom drinks as real HTTP against the real router and storage layer,
 * with the rendered SQL executed by a REAL PostgreSQL (set CS_TEST_PG_URL; the suite is skipped otherwise).
 * Only the pool transport is redirected from Neon to a local pg connection. Never point this at production.
 */
import "../test-support/auth-test-env";
import test from "node:test";
import assert from "node:assert/strict";
import express from "express";
import pg from "pg";
import type { AddressInfo } from "node:net";
import { signAuthToken } from "../lib/jwt-config";

process.env.DATABASE_URL ||= "postgres://u:p@custom-drink-tests.invalid/none";
const PG_URL = process.env.CS_TEST_PG_URL;
const A = "user-a";
const B = "user-b";
const tok = (id: string) => ({ authorization: `Bearer ${signAuthToken({ id } as any)}` });

if (!PG_URL) {
  test("custom-drink engagement authorization (skipped: CS_TEST_PG_URL not set)", { skip: true }, () => {});
} else {
  assert.ok(/localhost|127\.0\.0\.1|^postgres:\/\/[^@]*@?\/|host=\/|\/tmp/.test(PG_URL) && !/neon\.tech/.test(PG_URL), "refusing non-local database");
  const local = new pg.Pool({ connectionString: PG_URL });
  const { pool } = await import("../db/index");
  (pool as any).query = (q: any, params?: any[]) => (typeof q === "string" ? local.query(q, params) : local.query(params ? { ...q, values: params } : q));

  await local.query(`
    DROP TABLE IF EXISTS drink_likes, drink_saves, custom_drinks, users CASCADE;
    CREATE TABLE users (id varchar PRIMARY KEY, username text);
    CREATE TABLE custom_drinks (id varchar PRIMARY KEY, user_id varchar NOT NULL REFERENCES users(id), is_public boolean DEFAULT false,
      likes_count integer DEFAULT 0, saves_count integer DEFAULT 0);
    CREATE TABLE drink_likes (id varchar PRIMARY KEY DEFAULT gen_random_uuid(), user_id varchar NOT NULL REFERENCES users(id),
      drink_id varchar NOT NULL REFERENCES custom_drinks(id) ON DELETE CASCADE, created_at timestamp NOT NULL DEFAULT now());
    CREATE UNIQUE INDEX ON drink_likes (user_id, drink_id);
    CREATE TABLE drink_saves (id varchar PRIMARY KEY DEFAULT gen_random_uuid(), user_id varchar NOT NULL REFERENCES users(id),
      drink_id varchar NOT NULL REFERENCES custom_drinks(id) ON DELETE CASCADE, created_at timestamp NOT NULL DEFAULT now());
    CREATE UNIQUE INDEX ON drink_saves (user_id, drink_id);
  `);
  const reset = async () => {
    await local.query(`TRUNCATE drink_likes, drink_saves, custom_drinks, users CASCADE`);
    await local.query(`INSERT INTO users VALUES ('${A}'), ('${B}')`);
    await local.query(`INSERT INTO custom_drinks (id, user_id, is_public) VALUES
      ('A-public','${A}',true), ('A-private','${A}',false), ('A-null','${A}',NULL), ('B-private','${B}',false)`);
  };
  const state = async (id: string) => ({
    drink: (await local.query(`SELECT likes_count, saves_count FROM custom_drinks WHERE id=$1`, [id])).rows[0],
    likes: (await local.query(`SELECT user_id FROM drink_likes WHERE drink_id=$1 ORDER BY 1`, [id])).rows.map((r) => r.user_id),
    saves: (await local.query(`SELECT user_id FROM drink_saves WHERE drink_id=$1 ORDER BY 1`, [id])).rows.map((r) => r.user_id),
  });

  const { default: drinksRouter } = await import("./drinks");
  const app = express();
  app.use(express.json());
  app.use("/api/drinks", drinksRouter);
  const server = app.listen(0);
  test.after(async () => { server.close(); await local.end(); });
  const call = async (method: string, id: string, action: "like" | "save", headers: Record<string, string> = {}) => {
    const r = await fetch(`http://127.0.0.1:${(server.address() as AddressInfo).port}/api/drinks/custom-drinks/${id}/${action}`, { method, headers });
    const text = await r.text();
    return { status: r.status, text, body: JSON.parse(text) };
  };
  const ACTIONS: Array<[string, "like" | "save"]> = [["POST", "like"], ["DELETE", "like"], ["POST", "save"], ["DELETE", "save"]];
  test.beforeEach(reset);

  for (const id of ["A-private", "A-null"]) {
    for (const [method, action] of ACTIONS) {
      test(`B ${method} ${action} on ${id}: same response as nonexistent id, no rows, no counter change`, async () => {
        const before = await state(id);
        const r = await call(method, id, action, tok(B));
        const ghost = await call(method, "does-not-exist", action, tok(B));
        assert.equal(r.status, 404);
        assert.equal(r.status, ghost.status);
        assert.equal(r.text, ghost.text);
        assert.doesNotMatch(r.text, /private|authorized|exists|forbidden|violat|constraint|sql/i);
        assert.deepEqual(await state(id), before);
      });
    }
  }

  test("B's pre-existing engagement on a drink that later went private is not removed/changed by unauthorized unlike/unsave", async () => {
    await local.query(`INSERT INTO drink_likes (user_id, drink_id) VALUES ('${B}','A-private')`);
    await local.query(`INSERT INTO drink_saves (user_id, drink_id) VALUES ('${B}','A-private')`);
    await local.query(`UPDATE custom_drinks SET likes_count=1, saves_count=1 WHERE id='A-private'`);
    const before = await state("A-private");
    for (const [m, a] of [["DELETE", "like"], ["DELETE", "save"]] as const) assert.equal((await call(m, "A-private", a, tok(B))).status, 404);
    assert.deepEqual(await state("A-private"), before);
  });

  test("anonymous callers cannot mutate (401), nothing written", async () => {
    for (const id of ["A-public", "A-private"]) for (const [m, a] of ACTIONS) {
      assert.equal((await call(m, id, a, {})).status, 401);
    }
    assert.deepEqual(await state("A-public"), { drink: { likes_count: 0, saves_count: 0 }, likes: [], saves: [] });
  });

  for (const action of ["like", "save"] as const) {
    const col = action === "like" ? "likes_count" : "saves_count";
    const rows = action === "like" ? "likes" : "saves";
    test(`B ${action}s A-public: create, duplicate is idempotent, remove, repeat remove 404; counter exact`, async () => {
      const first = await call("POST", "A-public", action, tok(B));
      assert.equal(first.status, 201);
      assert.equal(first.body.ok, true);
      assert.deepEqual((await state("A-public")).drink[col], 1);
      const dup = await call("POST", "A-public", action, tok(B));
      assert.equal(dup.status, 200);
      assert.equal(dup.body[action].id, first.body[action].id);
      let s: any = await state("A-public");
      assert.equal(s.drink[col], 1);
      assert.deepEqual(s[rows], [B]);
      assert.equal((await call("DELETE", "A-public", action, tok(B))).status, 200);
      s = await state("A-public");
      assert.equal(s.drink[col], 0);
      assert.deepEqual(s[rows], []);
      assert.equal((await call("DELETE", "A-public", action, tok(B))).status, 404);
      assert.equal((await state("A-public")).drink[col], 0);
    });

    test(`concurrent duplicate ${action}s count once`, async () => {
      const rs = await Promise.all(Array.from({ length: 8 }, () => call("POST", "A-public", action, tok(B))));
      assert.ok(rs.every((r) => r.status === 200 || r.status === 201));
      assert.equal(rs.filter((r) => r.status === 201).length, 1);
      assert.equal((await state("A-public")).drink[col], 1);
    });

    test(`owner ${action}/un${action} own private drink keeps working (owner semantics preserved)`, async () => {
      assert.equal((await call("POST", "A-private", action, tok(A))).status, 201);
      assert.equal((await state("A-private")).drink[col], 1);
      assert.equal((await call("DELETE", "A-private", action, tok(A))).status, 200);
      assert.equal((await state("A-private")).drink[col], 0);
    });

    test(`${action}: visibility revoked -> next action fails closed (no TOCTOU window beyond the statement)`, async () => {
      assert.equal((await call("POST", "A-public", action, tok(B))).status, 201);
      await local.query(`UPDATE custom_drinks SET is_public=false WHERE id='A-public'`);
      const before = await state("A-public");
      assert.equal((await call("POST", "A-public", action, tok(B))).status, 404);
      assert.equal((await call("DELETE", "A-public", action, tok(B))).status, 404);
      assert.deepEqual(await state("A-public"), before);
    });
  }
}
