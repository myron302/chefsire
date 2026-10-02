/**
 * CS-CL-07: DELETE /api/drinks/drink-photos/:id as real HTTP against the real router and storage layer,
 * with the rendered SQL executed by a REAL PostgreSQL (set CS_TEST_PG_URL; skipped otherwise).
 * CS_TEST_PG_URL is validated by the hardened loopback-only guard before any client exists.
 */
import "../test-support/accept-test-sessions";
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
const tok = (id: string) => ({ authorization: `Bearer ${signAuthToken({ id, av: 1 } as any)}` });

if (!PG_URL) {
  test("custom-drink photo delete authorization (skipped: CS_TEST_PG_URL not set)", { skip: true }, () => {});
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
    await local.query(`INSERT INTO custom_drinks (id, user_id, is_public) VALUES ('A-public','${A}',true), ('A-private','${A}',false), ('B-private','${B}',false)`);
    // Sequential, guessable ids on purpose: knowing an id must never be sufficient.
    await local.query(`INSERT INTO drink_photos (id, drink_id, user_id, image_url) VALUES
      ('1','A-public','${A}','/u/1.jpg'), ('2','A-private','${A}','/u/2.jpg'), ('3','B-private','${B}','/u/3.jpg')`);
  };
  const rowExists = async (id: string) => (await local.query(`SELECT 1 FROM drink_photos WHERE id=$1`, [id])).rowCount === 1;

  const { default: drinksRouter } = await import("./drinks");
  const app = express();
  app.use(express.json());
  app.use("/api/drinks", drinksRouter);
  const server = app.listen(0);
  test.after(async () => { server.close(); await local.end(); });
  const del = async (id: string, headers: Record<string, string> = {}) => {
    const r = await fetch(`http://127.0.0.1:${(server.address() as AddressInfo).port}/api/drinks/drink-photos/${id}`, { method: "DELETE", headers });
    const text = await r.text();
    return { status: r.status, text };
  };
  const post = async (id: string, headers: Record<string, string>) => {
    const r = await fetch(`http://127.0.0.1:${(server.address() as AddressInfo).port}/api/drinks/custom-drinks/${id}/photo`, {
      method: "POST", headers: { ...headers, "content-type": "application/json" }, body: JSON.stringify({ imageUrl: "/u/new.jpg" }),
    });
    return { status: r.status, text: await r.text() };
  };
  test.beforeEach(reset);

  test("A deletes photo on A-public: succeeds, row gone", async () => {
    const r = await del("1", tok(A));
    assert.equal(r.status, 200);
    assert.equal(await rowExists("1"), false);
    assert.equal(await rowExists("2"), true);
  });

  test("A deletes photo on A-private: succeeds, row gone", async () => {
    assert.equal((await del("2", tok(A))).status, 200);
    assert.equal(await rowExists("2"), false);
  });

  test("owner deleting twice: second is 404", async () => {
    assert.equal((await del("1", tok(A))).status, 200);
    assert.equal((await del("1", tok(A))).status, 404);
  });

  for (const id of ["1", "2"]) {
    test(`B (valid sequential id ${id} known) cannot delete A's photo: same response as nonexistent, row intact`, async () => {
      const r = await del(id, tok(B));
      const ghost = await del("999", tok(B));
      assert.equal(r.status, 404);
      assert.equal(r.status, ghost.status);
      assert.equal(r.text, ghost.text);
      assert.doesNotMatch(r.text, /private|public|authorized|forbidden|owner|exists|user-a|violat|constraint|sql/i);
      assert.equal(await rowExists(id), true);
    });
  }

  test("anonymous cannot delete (401), rows intact", async () => {
    for (const id of ["1", "2", "3"]) {
      assert.equal((await del(id)).status, 401);
      assert.equal(await rowExists(id), true);
    }
  });

  test("A cannot delete B's photo either (symmetry); B can delete own", async () => {
    assert.equal((await del("3", tok(A))).status, 404);
    assert.equal(await rowExists("3"), true);
    assert.equal((await del("3", tok(B))).status, 200);
    assert.equal(await rowExists("3"), false);
  });

  test("user id in query/body/header is never trusted as the actor", async () => {
    const r = await fetch(`http://127.0.0.1:${(server.address() as AddressInfo).port}/api/drinks/drink-photos/1?userId=${A}`, {
      method: "DELETE", headers: { ...tok(B), "content-type": "application/json", "x-user-id": A }, body: JSON.stringify({ userId: A, ownerId: A }),
    });
    assert.equal(r.status, 404);
    assert.equal(await rowExists("1"), true);
  });

  test("a photo row whose own user_id is B but parent drink is A's cannot be deleted by B (ownership = parent drink)", async () => {
    await local.query(`UPDATE drink_photos SET user_id='${B}' WHERE id='1'`);
    assert.equal((await del("1", tok(B))).status, 404);
    assert.equal(await rowExists("1"), true);
  });

  test("owner deleting a custom drink still cascades its photos (FK behavior unchanged)", async () => {
    const r = await fetch(`http://127.0.0.1:${(server.address() as AddressInfo).port}/api/drinks/custom-drinks/A-public`, { method: "DELETE", headers: tok(A) });
    assert.equal(r.status, 200);
    assert.equal(await rowExists("1"), false);
    assert.equal(await rowExists("2"), true);
  });

  test("POST photo (CS-CL-08): non-owned existing vs nonexistent drink are identical 404s", async () => {
    const existing = await post("A-private", tok(B));
    const ghost = await post("does-not-exist", tok(B));
    assert.equal(existing.status, 404);
    assert.equal(existing.status, ghost.status);
    assert.equal(existing.text, ghost.text);
  });
}
