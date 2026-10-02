/**
 * CS-CL-08: owner-only custom-drink mutations (PATCH /custom-drinks/:id, DELETE /custom-drinks/:id, POST /custom-drinks/:id/photo) as real HTTP against the real router and storage layer,
 * with the rendered SQL executed by a REAL PostgreSQL (set CS_TEST_PG_URL; skipped otherwise).
 * CS_TEST_PG_URL is validated by the hardened loopback-only guard before any client exists.
 */
import "../test-support/auth-test-env";
import test from "node:test";
import assert from "node:assert/strict";
import express from "express";
import pg from "pg";
import type { AddressInfo } from "node:net";
import { signAuthToken } from "../lib/jwt-config";
import { parseLocalTestDatabaseUrl } from "../test-support/local-test-database";

process.env.DATABASE_URL ||= "postgres://u:p@custom-drink-tests.invalid/none";
const PG_URL = process.env.CS_TEST_PG_URL;
const A = "user-a";
const B = "user-b";
const tok = (id: string) => ({ authorization: `Bearer ${signAuthToken({ id } as any)}` });

if (!PG_URL) {
  test("custom-drink existence non-enumeration (skipped: CS_TEST_PG_URL not set)", { skip: true }, () => {});
} else {
  const DB = parseLocalTestDatabaseUrl(PG_URL);
  const local = new pg.Pool(DB);
  const { pool } = await import("../db/index");
  (pool as any).connect = () => local.connect();
  (pool as any).query = (q: any, params?: any[]) => (typeof q === "string" ? local.query(q, params) : local.query(params ? { ...q, values: params } : q));

  await local.query(`
    DROP TABLE IF EXISTS drink_photos, custom_drinks, users CASCADE;
    CREATE TABLE users (id varchar PRIMARY KEY, username text);
    CREATE TABLE custom_drinks (id varchar PRIMARY KEY, user_id varchar NOT NULL REFERENCES users(id), is_public boolean DEFAULT false,
      name text NOT NULL DEFAULT 'drink', category text NOT NULL DEFAULT 'smoothies', drink_type text, ingredients jsonb DEFAULT '[]',
      calories integer NOT NULL DEFAULT 0, protein decimal NOT NULL DEFAULT 0, carbs decimal NOT NULL DEFAULT 0, fiber decimal NOT NULL DEFAULT 0,
      fat decimal NOT NULL DEFAULT 0, description text, image_url text, fitness_goal text, difficulty text, prep_time integer, rating integer DEFAULT 5,
      likes_count integer DEFAULT 0, saves_count integer DEFAULT 0, shares_count integer DEFAULT 0,
      created_at timestamp NOT NULL DEFAULT now(), updated_at timestamp NOT NULL DEFAULT now());
    CREATE TABLE drink_photos (id varchar PRIMARY KEY DEFAULT gen_random_uuid(), drink_id varchar NOT NULL REFERENCES custom_drinks(id) ON DELETE CASCADE,
      user_id varchar NOT NULL REFERENCES users(id), image_url text NOT NULL, caption text, likes_count integer DEFAULT 0,
      created_at timestamp NOT NULL DEFAULT now());
  `);
  const reset = async () => {
    await local.query(`TRUNCATE drink_photos, custom_drinks, users CASCADE`);
    await local.query(`INSERT INTO users VALUES ('${A}'), ('${B}')`);
    await local.query(`INSERT INTO custom_drinks (id, user_id, is_public, name) VALUES
      ('A-public','${A}',true,'orig'), ('A-private','${A}',false,'orig'), ('B-private','${B}',false,'orig')`);
    await local.query(`INSERT INTO custom_drinks (id, user_id, is_public, name) VALUES ('A-null','${A}',NULL,'orig')`);
    await local.query(`INSERT INTO drink_photos (id, drink_id, user_id, image_url) VALUES ('1','A-private','${A}','/u/1.jpg')`);
  };
  const snapshot = async () => JSON.stringify({
    d: (await local.query(`SELECT * FROM custom_drinks ORDER BY id`)).rows,
    p: (await local.query(`SELECT * FROM drink_photos ORDER BY id`)).rows,
  });

  const { default: drinksRouter } = await import("./drinks");
  const app = express();
  app.use(express.json());
  app.use("/api/drinks", drinksRouter);
  const server = app.listen(0);
  test.after(async () => { server.close(); await local.end(); });
  const call = async (method: string, path: string, headers: Record<string, string> = {}, body?: unknown) => {
    const r = await fetch(`http://127.0.0.1:${(server.address() as AddressInfo).port}/api/drinks${path}`, {
      method, headers: { ...headers, "content-type": "application/json" }, body: body === undefined ? undefined : JSON.stringify(body),
    });
    return { status: r.status, text: await r.text(), ct: r.headers.get("content-type"), etag: r.headers.get("etag") };
  };
  test.beforeEach(reset);

  const ops: Record<string, (id: string, h?: Record<string, string>) => Promise<{ status: number; text: string; ct: string | null; etag: string | null }>> = {
    PATCH: (id, h) => call("PATCH", `/custom-drinks/${id}`, h, { name: "hacked" }),
    DELETE: (id, h) => call("DELETE", `/custom-drinks/${id}`, h),
    PHOTO: (id, h) => call("POST", `/custom-drinks/${id}/photo`, h, { imageUrl: "/u/new.jpg" }),
  };
  const LEAK = /private|public|authorized|forbidden|owner|exists|user-a|violat|constraint|sql|orig/i;

  for (const [name, op] of Object.entries(ops)) {
    test(`${name}: B on A-public/A-private/A-NULL is indistinguishable from nonexistent; DB unchanged`, async () => {
      const before = await snapshot();
      const ghost = await op("does-not-exist", tok(B));
      assert.equal(ghost.status, 404);
      for (const id of ["A-public", "A-private", "A-null"]) {
        const r = await op(id, tok(B));
        assert.equal(r.status, 404, id);
        assert.equal(r.status, ghost.status);
        assert.equal(r.text, ghost.text, id);
        assert.equal(r.ct, ghost.ct);
        assert.equal(r.etag, ghost.etag);
        assert.doesNotMatch(r.text, LEAK);
      }
      assert.equal(await snapshot(), before);
    });

    test(`${name}: anonymous is 401 before any mutation`, async () => {
      const before = await snapshot();
      for (const id of ["A-public", "A-private", "A-null", "does-not-exist"]) assert.equal((await op(id)).status, 401, id);
      assert.equal(await snapshot(), before);
    });
  }

  test("PATCH: owner updates public, private, NULL drinks", async () => {
    for (const id of ["A-public", "A-private", "A-null"]) {
      const r = await call("PATCH", `/custom-drinks/${id}`, tok(A), { name: "renamed" });
      assert.equal(r.status, 200, id);
      assert.equal((await local.query(`SELECT name FROM custom_drinks WHERE id=$1`, [id])).rows[0].name, "renamed");
    }
  });

  test("DELETE: owner deletes public/private/NULL; second delete is 404", async () => {
    for (const id of ["A-public", "A-private", "A-null"]) {
      assert.equal((await ops.DELETE(id, tok(A))).status, 200, id);
      assert.equal((await local.query(`SELECT 1 FROM custom_drinks WHERE id=$1`, [id])).rowCount, 0);
    }
    assert.equal((await ops.DELETE("A-public", tok(A))).status, 404);
  });

  test("PHOTO: owner adds photo (public/private/NULL), actor recorded as owner, drink image set once", async () => {
    for (const id of ["A-public", "A-private", "A-null"]) {
      const r = await call("POST", `/custom-drinks/${id}/photo`, tok(A), { imageUrl: "/u/new.jpg", userId: B, drinkId: "B-private" });
      assert.equal(r.status, 201, id);
      const row = (await local.query(`SELECT user_id, drink_id FROM drink_photos WHERE drink_id=$1 AND image_url='/u/new.jpg'`, [id])).rows[0];
      assert.deepEqual(row, { user_id: A, drink_id: id });
      assert.equal((await local.query(`SELECT image_url FROM custom_drinks WHERE id=$1`, [id])).rows[0].image_url, "/u/new.jpg");
    }
    await call("POST", `/custom-drinks/A-public/photo`, tok(A), { imageUrl: "/u/second.jpg" });
    assert.equal((await local.query(`SELECT image_url FROM custom_drinks WHERE id='A-public'`)).rows[0].image_url, "/u/new.jpg");
  });

  test("PHOTO: invalid body is 400 for owner, non-owner and nonexistent alike", async () => {
    const rs = await Promise.all(["A-private", "does-not-exist"].map((id) => call("POST", `/custom-drinks/${id}/photo`, tok(B), {})));
    assert.equal(rs[0].status, 400);
    assert.equal(rs[0].text, rs[1].text);
  });

  test("actor identity is never taken from query/body/header", async () => {
    const before = await snapshot();
    const h = { ...tok(B), "x-user-id": A };
    assert.equal((await call("DELETE", `/custom-drinks/A-public?userId=${A}`, h, { userId: A })).status, 404);
    assert.equal((await call("PATCH", `/custom-drinks/A-public?userId=${A}`, h, { name: "x" })).status, 404);
    assert.equal((await call("POST", `/custom-drinks/A-public/photo?userId=${A}`, h, { imageUrl: "/x.jpg", userId: A })).status, 404);
    assert.equal(await snapshot(), before);
  });

  test("CS-CL-07 regression: B cannot delete A's photo, nonexistent identical", async () => {
    const r = await call("DELETE", "/drink-photos/1", tok(B));
    const g = await call("DELETE", "/drink-photos/999", tok(B));
    assert.equal(r.status, 404);
    assert.equal(r.text, g.text);
    assert.equal((await local.query(`SELECT 1 FROM drink_photos WHERE id='1'`)).rowCount, 1);
    assert.equal((await call("DELETE", "/drink-photos/1", tok(A))).status, 200);
  });

  test("race: concurrent owner photo insert and delete never leaves an orphan or a 5xx", async () => {
    const [p, d] = await Promise.all([ops.PHOTO("A-public", tok(A)), ops.DELETE("A-public", tok(A))]);
    assert.ok([201, 404].includes(p.status), String(p.status));
    assert.equal(d.status, 200);
    assert.equal((await local.query(`SELECT 1 FROM drink_photos WHERE drink_id='A-public'`)).rowCount, 0);
  });
}
