/**
 * Stability Phase 2C (Codex P1-2): a stalled authentication lookup must not keep its pooled connection forever.
 *
 * `withReadTimeout` used to stop WAITING for the query while the query -- and the pool client running it -- carried on. The pool has 5 clients, so five
 * stalled session lookups exhausted it: every later request (even one needing no `users` row, even after the network recovered) failed on connection
 * timeout. The tests below measure the RESOURCE (pool clients in use, backends on the server), not just the HTTP status.
 *
 * Two stalls, both injected deterministically:
 *   - SERVER-side: another session holds ACCESS EXCLUSIVE on `users`, so the lookup's SELECT waits on a lock (network healthy).
 *   - NETWORK-side: replies are swallowed after the connection is established (the client waits forever for an answer that will never arrive).
 * Needs TEST_DATABASE_URL (loopback-only); skipped otherwise.
 */
import test from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import type { AddressInfo } from "node:net";
import pg from "pg";
import { parseLocalTestDatabaseUrl } from "../test-support/local-test-database";
import { createScratchDatabase } from "../test-support/scratch-database";
import { signTestAuthToken } from "../test-support/auth-test-env";

const RAW = process.env.TEST_DATABASE_URL;

if (!RAW) {
  test("authentication lookup resource exhaustion (skipped: TEST_DATABASE_URL not set)", { skip: true }, () => {});
} else {
  const scratch = await createScratchDatabase(RAW, "p2c_exhaust");
  const local = parseLocalTestDatabaseUrl(scratch.url);
  const { startFaultProxy, useNeonFaultProxy } = await import("../test-support/neon-fault-proxy");
  const proxy = await startFaultProxy({ host: local.host, port: local.port });
  useNeonFaultProxy(proxy.port);
  process.env.DATABASE_URL = scratch.url;
  process.env.NODE_ENV = "test";
  process.env.AUTH_LOOKUP_TIMEOUT_MS = "1500";
  process.env.DB_CONNECT_TIMEOUT_MS = "2500";
  const direct = new pg.Pool({ ...local, max: 3 });
  const { getTableColumns } = await import("drizzle-orm");
  const { users } = await import("../../shared/schema");
  const cols = Object.values(getTableColumns(users)).map((c: any) =>
    c.name === "id" ? `id varchar PRIMARY KEY DEFAULT gen_random_uuid()`
      : c.name === "username" || c.name === "email" ? `${c.name} text NOT NULL UNIQUE`
      : c.name === "auth_version" ? `auth_version integer NOT NULL DEFAULT 1`
      : `${c.name} ${c.columnType === "PgTimestamp" ? "timestamp" : c.columnType === "PgBoolean" ? "boolean" : "text"}`);
  await direct.query(`CREATE TABLE users (${cols.join(",")}); CREATE TABLE ledger_probe (id serial primary key, note text);`);
  await direct.query(`INSERT INTO users (id, username, email, auth_version) VALUES ('u-valid','valid','valid@example.test',1)`);

  const { default: app } = await import("../app");
  const { pool } = await import("../db");
  const server = http.createServer(app);
  await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
  const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  const realError = console.error;
  console.error = () => {};
  const uncaught: unknown[] = [];
  const unhandled: unknown[] = [];
  process.on("uncaughtException", (e) => uncaught.push(e));
  process.on("unhandledRejection", (e) => unhandled.push(e));
  test.after(async () => {
    console.error = realError;
    proxy.muteReplies = false;
    server.close(); server.closeAllConnections?.();
    await pool.end().catch(() => {});
    await direct.end();
    await proxy.close();
    await scratch.drop();
  });
  test.beforeEach(async () => { proxy.mode = "pass"; proxy.muteReplies = false; await new Promise((r) => setTimeout(r, 100)); });

  const token = () => signTestAuthToken({ id: "u-valid", av: 1 });
  const me = async () => {
    const t = Date.now();
    const r = await fetch(`${base}/api/auth/me`, { headers: { cookie: `auth_token=${token()}` } });
    return { status: r.status, ms: Date.now() - t };
  };
  const poolBusy = () => (pool as any).totalCount - (pool as any).idleCount;
  const settled = async (predicate: () => boolean | Promise<boolean>, ms: number) => {
    const end = Date.now() + ms;
    while (Date.now() < end) { if (await predicate()) return true; await new Promise((r) => setTimeout(r, 50)); }
    return predicate();
  };
  const appBackendsWaitingOnUsers = async () =>
    (await direct.query(`select count(*)::int as n from pg_stat_activity where datname = current_database() and pid <> pg_backend_pid() and wait_event_type = 'Lock' and query ilike '%from "users"%'`)).rows[0].n as number;

  test("healthy baseline: a valid session is accepted and the pool is idle afterwards", async () => {
    assert.equal((await me()).status, 200);
    assert.ok(await settled(() => poolBusy() === 0, 1000));
  });

  test("SERVER-side stall (lock wait on users): 503s are bounded, AND the stalled backends are cancelled and the pool clients recovered while the stall persists", async () => {
    const blocker = await direct.connect();
    await blocker.query("BEGIN");
    await blocker.query("LOCK TABLE users IN ACCESS EXCLUSIVE MODE");
    try {
      const results = await Promise.all(Array.from({ length: 8 }, () => me()));
      assert.ok(results.every((r) => r.status === 503), results.map((r) => r.status).join(","));
      assert.ok(Math.max(...results.map((r) => r.ms)) < 6000);
      // The measurable part: nothing is left behind -- on the server or in the pool -- though the lock is STILL held.
      assert.ok(await settled(async () => (await appBackendsWaitingOnUsers()) === 0, 4000), `${await appBackendsWaitingOnUsers()} backends still waiting on the lock`);
      assert.ok(await settled(() => poolBusy() === 0, 4000), `${poolBusy()} pool clients still checked out`);
      // A request that needs a connection but NOT the users table works right now.
      const t = Date.now();
      const r = await pool.query("select 1 as one");
      assert.equal(r.rows[0].one, 1);
      assert.ok(Date.now() - t < 1500, "connection acquisition did not queue behind stalled lookups");
    } finally {
      await blocker.query("ROLLBACK");
      blocker.release();
    }
    assert.equal((await me()).status, 200, "and authentication works again as soon as the stall ends");
  });

  test("NETWORK-side stall (replies swallowed after connect): bounded 503s, the pool's clients are destroyed (not left waiting forever), and the pool serves again once the network is back", async () => {
    // Warm the pool so there are established connections whose replies can be swallowed.
    await Promise.all(Array.from({ length: 5 }, () => pool.query("select pg_sleep(0.3)")));
    proxy.muteReplies = true;
    const results = await Promise.all(Array.from({ length: 8 }, () => me()));
    assert.ok(results.every((r) => r.status === 503), results.map((r) => r.status).join(","));
    assert.ok(await settled(() => poolBusy() === 0, 4000), `${poolBusy()} pool clients still checked out after the lookups gave up`);
    proxy.muteReplies = false; // the network recovers; the connections that lost their replies never will get them
    const t = Date.now();
    const r = await pool.query("select 2 as two");
    assert.equal(r.rows[0].two, 2);
    assert.ok(Date.now() - t < 2000, `${Date.now() - t}ms`);
    assert.equal((await me()).status, 200);
  });

  test("repeated stall waves do not leak: after 3 waves the pool is back to its idle baseline", async () => {
    for (let wave = 0; wave < 3; wave++) {
      const blocker = await direct.connect();
      await blocker.query("BEGIN");
      await blocker.query("LOCK TABLE users IN ACCESS EXCLUSIVE MODE");
      try { await Promise.all(Array.from({ length: 6 }, () => me())); } finally { await blocker.query("ROLLBACK"); blocker.release(); }
      assert.ok(await settled(() => poolBusy() === 0, 4000), `wave ${wave}: ${poolBusy()} clients in use`);
    }
    assert.ok((pool as any).totalCount <= 5, `pool size ${(pool as any).totalCount}`);
    assert.equal((await me()).status, 200);
  });

  test("the lookup's statement_timeout does not leak onto the connection afterwards (shared with payment writes): every pool client reports no timeout", async () => {
    await Promise.all(Array.from({ length: 5 }, () => me()));
    await settled(() => poolBusy() === 0, 2000);
    const shown = await Promise.all(Array.from({ length: 5 }, () => pool.query("show statement_timeout")));
    assert.deepEqual(shown.map((r: any) => r.rows[0].statement_timeout), ["0", "0", "0", "0", "0"]);
  });

  test("scope: writes and transactions are NOT subject to the lookup deadline -- a long-running write transaction on the same pool completes", async () => {
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      await client.query("insert into ledger_probe (note) values ('credit')");
      await client.query("select pg_sleep(2.2)"); // longer than AUTH_LOOKUP_TIMEOUT_MS: must not be cut
      await client.query("COMMIT");
    } finally { client.release(); }
    assert.equal((await direct.query("select count(*)::int as n from ledger_probe")).rows[0].n, 1);
  });

  test("destroying stalled connections raised no uncaught exception and no unhandled rejection", () => {
    assert.deepEqual(uncaught.map(String), []);
    assert.deepEqual(unhandled.map(String), []);
  });
}
