/**
 * CS-CL-06: like/unlike/save/unsave of custom drinks as real HTTP against the real router and storage layer,
 * with the rendered SQL executed by a REAL PostgreSQL (set CS_TEST_PG_URL; the suite is skipped otherwise).
 * Only the pool transport is redirected from Neon to a local pg connection.
 *
 * This suite DROPs/TRUNCATEs tables, so CS_TEST_PG_URL is validated structurally BEFORE any client exists
 * (see server/test-support/local-test-database.ts): loopback host only (localhost, 127.0.0.1, [::1]), no query
 * string, no Unix sockets, and the database name must contain "test" (e.g. postgres://127.0.0.1:5432/chefsire_test).
 * An invalid URL throws here and the suite refuses to run.
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
  test("custom-drink engagement authorization (skipped: CS_TEST_PG_URL not set)", { skip: true }, () => {});
} else {
  const DB = parseLocalTestDatabaseUrl(PG_URL); // throws (fail closed) before any connection or DDL
  const local = new pg.Pool(DB);
  const { pool } = await import("../db/index");
  // db.transaction() checks out a client from the pool: hand it a real local connection, never a Neon one.
  (pool as any).connect = () => local.connect();
  (pool as any).query = (q: any, params?: any[]) => (typeof q === "string" ? local.query(q, params) : local.query(params ? { ...q, values: params } : q));

  await local.query(`
    DROP TABLE IF EXISTS drink_likes, drink_saves, custom_drinks, users CASCADE; DROP FUNCTION IF EXISTS park();
    CREATE TABLE users (id varchar PRIMARY KEY, username text);
    CREATE TABLE custom_drinks (id varchar PRIMARY KEY, user_id varchar NOT NULL REFERENCES users(id), is_public boolean DEFAULT false,
      likes_count integer DEFAULT 0, saves_count integer DEFAULT 0);
    CREATE TABLE drink_likes (id varchar PRIMARY KEY DEFAULT gen_random_uuid(), user_id varchar NOT NULL REFERENCES users(id),
      drink_id varchar NOT NULL REFERENCES custom_drinks(id) ON DELETE CASCADE, created_at timestamp NOT NULL DEFAULT now());
    CREATE UNIQUE INDEX ON drink_likes (user_id, drink_id);
    CREATE TABLE drink_saves (id varchar PRIMARY KEY DEFAULT gen_random_uuid(), user_id varchar NOT NULL REFERENCES users(id),
      drink_id varchar NOT NULL REFERENCES custom_drinks(id) ON DELETE CASCADE, created_at timestamp NOT NULL DEFAULT now());
    CREATE UNIQUE INDEX ON drink_saves (user_id, drink_id);
    -- Test-only hook: lets a test park an engagement statement AFTER it has taken its custom_drinks row lock
    -- (the statement blocks on advisory lock 777 inside the INSERT/DELETE) to prove ordering vs a privacy flip.
    CREATE FUNCTION park() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN PERFORM pg_advisory_xact_lock(777); RETURN COALESCE(NEW, OLD); END $$;
    CREATE TRIGGER park_likes BEFORE INSERT OR DELETE ON drink_likes FOR EACH ROW EXECUTE FUNCTION park();
    CREATE TRIGGER park_saves BEFORE INSERT OR DELETE ON drink_saves FOR EACH ROW EXECUTE FUNCTION park();
  `);
  const MANY = Array.from({ length: 10 }, (_, i) => `user-${i}`);
  const reset = async () => {
    await local.query(`TRUNCATE drink_likes, drink_saves, custom_drinks, users CASCADE`);
    await local.query(`INSERT INTO users VALUES ('${A}'), ('${B}')` + MANY.map((u) => `, ('${u}')`).join(""));
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

  /* ---------------- real multi-session concurrency (separate connections) ---------------- */
  const synced = async (id: string, kind: "like" | "save") => {
    const t = kind === "like" ? "drink_likes" : "drink_saves";
    const col = kind === "like" ? "likes_count" : "saves_count";
    const rows = Number((await local.query(`SELECT count(*) FROM ${t} WHERE drink_id=$1`, [id])).rows[0].count);
    const cnt = (await local.query(`SELECT ${col} AS c FROM custom_drinks WHERE id=$1`, [id])).rows[0].c;
    assert.ok(cnt >= 0, "counter never negative");
    assert.equal(cnt, rows, `${col} == number of ${t} rows`);
    return rows;
  };
  const ok2xx = (rs: Array<{ status: number }>) => rs.every((r) => r.status === 200 || r.status === 201);
  const waitFor = async (sqlText: string, what: string) => {
    for (let i = 0; i < 100; i++) {
      if ((await local.query(sqlText)).rowCount) return;
      await new Promise((r) => setTimeout(r, 50));
    }
    assert.fail(`timed out waiting for ${what}`);
  };
  const waitingOn = (needle: string) =>
    `SELECT 1 FROM pg_stat_activity WHERE wait_event_type = 'Lock' AND query ILIKE '%${needle}%' AND pid <> pg_backend_pid()`;
  const session = async () => { const c = new pg.Client(DB); await c.connect(); return c; };

  for (const kind of ["like", "save"] as const) {
    const rowsOf = kind === "like" ? "likes" : "saves";
    test(`${kind}: many users engage the SAME public drink simultaneously, repeatedly: no deadlock/500, exact counter`, async () => {
      for (let round = 0; round < 15; round++) {
        await reset();
        const rs = await Promise.all(MANY.map((u) => call("POST", "A-public", kind, tok(u))));
        assert.ok(ok2xx(rs), `round ${round}: ${JSON.stringify(rs.map((r) => r.status))}`);
        assert.equal(await synced("A-public", kind), MANY.length);
      }
    });

    test(`${kind}: duplicate simultaneous requests from mixed users: exactly one row per user, counter exact, no 500`, async () => {
      for (let round = 0; round < 10; round++) {
        await reset();
        const users = [...MANY, ...MANY.slice(0, 5), B, B];
        const rs = await Promise.all(users.map((u) => call("POST", "A-public", kind, tok(u))));
        assert.ok(ok2xx(rs), `round ${round}: ${JSON.stringify(rs.map((r) => r.status))}`);
        assert.equal(rs.filter((r) => r.status === 201).length, MANY.length + 1);
        assert.equal(await synced("A-public", kind), MANY.length + 1);
      }
    });

    test(`${kind}: simultaneous removals by many users, and duplicate removals by one user: no deadlock/500, never negative, final 0`, async () => {
      for (let round = 0; round < 10; round++) {
        await reset();
        await Promise.all(MANY.map((u) => call("POST", "A-public", kind, tok(u))));
        await call("POST", "A-public", kind, tok(B));
        assert.equal(await synced("A-public", kind), MANY.length + 1);
        const reqs = [...MANY, ...MANY, B, B, B].map((u) => call("DELETE", "A-public", kind, tok(u)));
        const rs = await Promise.all(reqs);
        assert.ok(rs.every((r) => r.status === 200 || r.status === 404), `round ${round}: ${JSON.stringify(rs.map((r) => r.status))}`);
        assert.equal(rs.filter((r) => r.status === 200).length, MANY.length + 1, "each engagement removed exactly once");
        assert.equal(await synced("A-public", kind), 0);
      }
    });

    test(`${kind}: simultaneous engage + remove by the same and different users: no deadlock/500, counter == rows`, async () => {
      for (let round = 0; round < 10; round++) {
        await reset();
        await Promise.all(MANY.slice(0, 5).map((u) => call("POST", "A-public", kind, tok(u))));
        const reqs = [
          ...MANY.slice(0, 5).map((u) => call("DELETE", "A-public", kind, tok(u))),
          ...MANY.map((u) => call("POST", "A-public", kind, tok(u))),
        ];
        const rs = await Promise.all(reqs);
        assert.ok(rs.every((r) => [200, 201, 404].includes(r.status)), `round ${round}: ${JSON.stringify(rs.map((r) => r.status))}`);
        await synced("A-public", kind);
      }
    });

    test(`${kind}: privacy flip COMMITS first -> in-flight engagement re-checks visibility and fails closed (404, no row, no count)`, async () => {
      await reset();
      const flip = await session();
      try {
        await flip.query("BEGIN");
        await flip.query(`UPDATE custom_drinks SET is_public=false WHERE id='A-public'`); // holds the row lock, uncommitted
        const inflight = call("POST", "A-public", kind, tok(B)); // blocks at the visibility CTE (row lock)
        await waitFor(waitingOn("custom_drinks"), "engagement blocked behind privacy flip");
        await flip.query("COMMIT");
        const r = await inflight;
        assert.equal(r.status, 404);
        assert.deepEqual(await state("A-public"), { drink: { likes_count: 0, saves_count: 0 }, likes: [], saves: [] });
        assert.equal((await call("POST", "A-public", kind, tok(B))).status, 404);
      } finally { await flip.query("ROLLBACK").catch(() => {}); await flip.end(); }
    });

    test(`${kind}: privacy flip COMMITS first -> in-flight REMOVAL by non-owner fails closed (404, existing row kept)`, async () => {
      await reset();
      await call("POST", "A-public", kind, tok(B));
      const flip = await session();
      try {
        await flip.query("BEGIN");
        await flip.query(`UPDATE custom_drinks SET is_public=false WHERE id='A-public'`);
        const inflight = call("DELETE", "A-public", kind, tok(B));
        await waitFor(waitingOn("custom_drinks"), "removal blocked behind privacy flip");
        await flip.query("COMMIT");
        assert.equal((await inflight).status, 404);
        const s: any = await state("A-public");
        assert.deepEqual(s[rowsOf], [B]);
        assert.equal(await synced("A-public", kind), 1);
      } finally { await flip.query("ROLLBACK").catch(() => {}); await flip.end(); }
    });

    test(`${kind}: engagement statement already past authorization -> privacy flip waits for it (no mid-statement revoke), later attempts denied`, async () => {
      await reset();
      const holder = await session();
      let flipDone = false;
      try {
        await holder.query("SELECT pg_advisory_lock(777)"); // parks the engagement statement inside its INSERT, after its row lock
        const inflight = call("POST", "A-public", kind, tok(B));
        await waitFor(`SELECT 1 FROM pg_locks WHERE locktype='advisory' AND NOT granted`, "engagement parked after authorization");
        const flip = local.query(`UPDATE custom_drinks SET is_public=false WHERE id='A-public'`).then(() => { flipDone = true; });
        await waitFor(waitingOn("is_public"), "privacy flip queued behind the authorized statement");
        assert.equal(flipDone, false, "flip must not slip in between authorization and mutation");
        await holder.query("SELECT pg_advisory_unlock(777)");
        const r = await inflight;
        await flip;
        assert.equal(r.status, 201, "authorized while public: serialized BEFORE the flip");
        assert.equal(await synced("A-public", kind), 1);
        // after the flip committed: no further engagement for another viewer
        assert.equal((await call("POST", "A-public", kind, tok(MANY[0]))).status, 404);
        assert.equal(await synced("A-public", kind), 1);
      } finally { await holder.query("SELECT pg_advisory_unlock_all()").catch(() => {}); await holder.end(); }
    });
  }

  /* -------- duplicate POST racing DELETE by the SAME user (the "second, unlocked lookup" race) -------- */
  const parkedStatement = `SELECT 1 FROM pg_locks WHERE locktype='advisory' AND NOT granted`;
  const queuedBehindRowLock = (needle: string) =>
    `SELECT 1 FROM pg_stat_activity WHERE wait_event_type = 'Lock' AND wait_event <> 'advisory' AND query ILIKE '%${needle}%' AND pid <> pg_backend_pid()`;
  for (const kind of ["like", "save"] as const) {
    const rowsOf = kind === "like" ? "likes" : "saves";

    test(`${kind}: duplicate POST holds the drink lock, DELETE queues behind it -> POST returns the EXISTING row (200), then DELETE removes it`, async () => {
      await reset();
      const first = await call("POST", "A-public", kind, tok(B));
      assert.equal(first.status, 201);
      const existingId = first.body[kind].id;
      const holder = await session();
      try {
        await holder.query("SELECT pg_advisory_lock(777)"); // parks the next engagement INSERT after it took the drink lock
        const dup = call("POST", "A-public", kind, tok(B));
        await waitFor(parkedStatement, "duplicate POST parked while holding the drink lock");
        const del = call("DELETE", "A-public", kind, tok(B));
        await waitFor(queuedBehindRowLock("FOR UPDATE"), "DELETE queued behind the duplicate POST's drink lock");
        await holder.query("SELECT pg_advisory_unlock(777)");
        const [d, r] = await Promise.all([dup, del]);
        assert.equal(d.status, 200, "duplicate POST must not turn into 404/500");
        assert.equal(d.body[kind].id, existingId, "returns the engagement as it existed at its serialization point");
        assert.equal(r.status, 200, "DELETE serialized after the POST removes it");
        const s: any = await state("A-public");
        assert.deepEqual(s[rowsOf], []);
        assert.equal(await synced("A-public", kind), 0);
      } finally { await holder.query("SELECT pg_advisory_unlock_all()").catch(() => {}); await holder.end(); }
    });

    test(`${kind}: DELETE holds the drink lock, duplicate POST queues behind it -> POST creates a fresh row (201), never a false 404`, async () => {
      await reset();
      await call("POST", "A-public", kind, tok(B));
      const holder = await session();
      try {
        await holder.query("SELECT pg_advisory_lock(777)");
        const del = call("DELETE", "A-public", kind, tok(B));
        await waitFor(parkedStatement, "DELETE parked while holding the drink lock");
        const dup = call("POST", "A-public", kind, tok(B));
        await waitFor(queuedBehindRowLock("FOR UPDATE"), "duplicate POST queued behind the DELETE's drink lock");
        await holder.query("SELECT pg_advisory_unlock(777)");
        const [r, d] = await Promise.all([del, dup]);
        assert.equal(r.status, 200);
        assert.equal(d.status, 201, "engagement did not exist at the POST's serialization point -> created, not 404");
        const s: any = await state("A-public");
        assert.deepEqual(s[rowsOf], [B]);
        assert.equal(await synced("A-public", kind), 1);
      } finally { await holder.query("SELECT pg_advisory_unlock_all()").catch(() => {}); await holder.end(); }
    });

    test(`${kind}: duplicate POSTs racing DELETEs (same user, repeated): POST is always 200/201, DELETE 200/404, counter == rows`, async () => {
      for (let round = 0; round < 25; round++) {
        await reset();
        await call("POST", "A-public", kind, tok(B));
        const reqs = [
          ...Array.from({ length: 4 }, () => call("POST", "A-public", kind, tok(B))),
          ...Array.from({ length: 4 }, () => call("DELETE", "A-public", kind, tok(B))),
        ];
        const rs = await Promise.all(reqs);
        const posts = rs.slice(0, 4);
        const dels = rs.slice(4);
        assert.ok(posts.every((r) => r.status === 200 || r.status === 201), `round ${round}: POST ${JSON.stringify(posts.map((r) => r.status))}`);
        assert.ok(dels.every((r) => r.status === 200 || r.status === 404), `round ${round}: DELETE ${JSON.stringify(dels.map((r) => r.status))}`);
        // the count of successful removals must equal the count of creations (initial row + 201s) minus what is left
        const created = 1 + posts.filter((r) => r.status === 201).length;
        const removed = dels.filter((r) => r.status === 200).length;
        assert.equal(await synced("A-public", kind), created - removed, `round ${round}: rows == creations - removals`);
      }
    });
  }
}
