/**
 * Stability Phase 2C: how the REAL ChefSire pool (server/db, @neondatabase/serverless) behaves when the database fails.
 *
 * Every failure is injected deterministically by a WebSocket<->TCP bridge in front of a disposable local PostgreSQL
 * (test-support/neon-fault-proxy). Needs TEST_DATABASE_URL (loopback-only, database name containing "test"); skipped otherwise.
 *
 * Measured on main before this change (same bridge): refused -> "socket hang up" in ~20ms; black hole -> pending after 20s (never settles);
 * connection cut while a query runs -> "Connection terminated unexpectedly" in ~0.5s; an idle pooled connection dropped -> UNCAUGHT exception
 * (server/index.ts exits on those); delayed handshake (3s) -> ok after 3s; recovery -> next query ok.
 */
import test from "node:test";
import assert from "node:assert/strict";
import pg from "pg";
import { parseLocalTestDatabaseUrl } from "../test-support/local-test-database";

const RAW = process.env.TEST_DATABASE_URL;

if (!RAW) {
  test("database outage behaviour (skipped: TEST_DATABASE_URL not set)", { skip: true }, () => {});
} else {
  const local = parseLocalTestDatabaseUrl(RAW);
  const { startFaultProxy, useNeonFaultProxy } = await import("../test-support/neon-fault-proxy");
  const proxy = await startFaultProxy({ host: local.host, port: local.port });
  useNeonFaultProxy(proxy.port);
  process.env.NODE_ENV = "test";
  process.env.DATABASE_URL = RAW;
  process.env.DB_CONNECT_TIMEOUT_MS = "1500";
  process.env.DB_STATEMENT_TIMEOUT_MS = "1000";
  const { pool } = await import("./index");
  const { isDatabaseUnavailableError } = await import("../lib/db-availability");
  const direct = new pg.Pool({ ...local, max: 2 }); // inspects the database without going through the faulty bridge

  const uncaught: unknown[] = [];
  const unhandled: unknown[] = [];
  process.on("uncaughtException", (e) => uncaught.push(e));
  process.on("unhandledRejection", (e) => unhandled.push(e));
  const timed = async <T>(p: Promise<T>) => { const t = Date.now(); try { return { ok: true as const, value: await p, ms: Date.now() - t }; } catch (error) { return { ok: false as const, error: error as any, ms: Date.now() - t }; } };
  const reset = () => { proxy.mode = "pass"; proxy.delayMs = 0; proxy.muteReplies = false; proxy.cutAll(); };

  test.after(async () => { reset(); await pool.end().catch(() => {}); await direct.end(); await proxy.close(); });
  // After severing connections, give the pool a moment to notice (it learns of a dead idle socket from the socket close event).
  test.beforeEach(async () => { reset(); await new Promise((r) => setTimeout(r, 150)); });

  test("baseline: a healthy database answers through the real pool", async () => {
    const r = await timed(pool.query("select 1 as one"));
    assert.ok(r.ok && r.value.rows[0].one === 1);
  });

  test("connection refused: rejects promptly with a connectivity error (no hang)", async () => {
    proxy.mode = "refuse";
    const r = await timed(pool.query("select 1"));
    assert.equal(r.ok, false);
    assert.ok(r.ms < 1400, `${r.ms}ms`);
    assert.equal(isDatabaseUnavailableError(r.error), true, r.error?.message);
  });

  test("unreachable / black-holed endpoint: the connection timeout rejects the request at ~DB_CONNECT_TIMEOUT_MS instead of hanging forever", async () => {
    proxy.mode = "blackhole";
    const r = await timed(pool.query("select 1"));
    assert.equal(r.ok, false);
    assert.ok(r.ms >= 1300 && r.ms < 3500, `${r.ms}ms`);
    assert.equal(isDatabaseUnavailableError(r.error), true, r.error?.message);
    assert.match(r.error.message, /timeout/i);
  });

  test("delayed connection establishment shorter than the timeout succeeds (the timeout is not a hair trigger)", async () => {
    proxy.delayMs = 600;
    const r = await timed(pool.query("select 2 as two"));
    assert.ok(r.ok && r.value.rows[0].two === 2, String((r as any).error?.message));
    assert.ok(r.ms >= 550 && r.ms < 1500, `${r.ms}ms`);
  });

  test("database lost during a request: the query rejects (no hang, no crash) with a connectivity error", async () => {
    const q = timed(pool.query("select pg_sleep(5)"));
    await new Promise((r) => setTimeout(r, 300));
    proxy.cutAll();
    const r = await q;
    assert.equal(r.ok, false);
    assert.ok(r.ms < 2500, `${r.ms}ms`);
    assert.equal(isDatabaseUnavailableError(r.error), true, r.error?.message);
  });

  test("an IDLE pooled connection dropped by the network does not raise an uncaught exception (it used to end the process)", async () => {
    await pool.query("select 1");
    const before = uncaught.length;
    proxy.cutAll();
    await new Promise((r) => setTimeout(r, 800));
    assert.equal(uncaught.length, before, "no uncaughtException");
    const next = await timed(pool.query("select 3 as three"));
    assert.ok(next.ok && next.value.rows[0].three === 3, "and the next request simply opens a new connection");
  });

  test("recovery without restart: refuse -> fail; pass -> the same pool works again; a later outage fails again; and recovers again", async () => {
    proxy.mode = "refuse";
    assert.equal((await timed(pool.query("select 1"))).ok, false);
    proxy.mode = "pass";
    assert.equal((await timed(pool.query("select 1"))).ok, true);
    proxy.mode = "refuse"; proxy.cutAll();
    assert.equal((await timed(pool.query("select 1"))).ok, false);
    proxy.mode = "pass";
    assert.equal((await timed(pool.query("select 1"))).ok, true);
  });

  test("no retry storm: 25 concurrent requests during a black hole all settle within the bound and open at most one attempt each; nothing continues afterwards", async () => {
    proxy.mode = "blackhole";
    const before = proxy.accepted;
    const results = await Promise.all(Array.from({ length: 25 }, () => timed(pool.query("select 1"))));
    assert.ok(results.every((r) => !r.ok), "all rejected");
    assert.ok(Math.max(...results.map((r) => r.ms)) < 5000, `slowest ${Math.max(...results.map((r) => r.ms))}ms`);
    const attempts = proxy.accepted - before;
    assert.ok(attempts <= 25, `${attempts} connection attempts for 25 requests`);
    await new Promise((r) => setTimeout(r, 2500));
    assert.equal(proxy.accepted - before, attempts, "no background retry loop");
    proxy.mode = "pass";
    assert.equal((await timed(pool.query("select 1"))).ok, true, "and the pool is usable afterwards");
  });

  test("pool exhaustion is bounded too: requests queued behind busy connections time out instead of waiting forever", async () => {
    const holders = await Promise.all(Array.from({ length: 5 }, () => pool.connect()));
    try {
      const r = await timed(pool.query("select 1"));
      assert.equal(r.ok, false);
      assert.ok(r.ms >= 1300 && r.ms < 3500, `${r.ms}ms`);
    } finally { holders.forEach((c: any) => c.release()); }
  });

  test("opt-in server-side statement_timeout: Postgres itself cancels the statement (definitive failure), and nothing keeps running", async () => {
    const r = await timed(pool.query("select pg_sleep(4)"));
    assert.equal(r.ok, false);
    assert.equal(r.error.code, "57014", r.error?.message);
    assert.ok(r.ms < 2500, `${r.ms}ms`);
    const active = await direct.query("select count(*)::int as n from pg_stat_activity where query like 'select pg_sleep(4)%' and state = 'active'");
    assert.equal(active.rows[0].n, 0, "the server-side statement is gone");
  });

  test("statement_timeout aborts a transaction atomically: nothing from the failed transaction is committed", async () => {
    await direct.query("drop table if exists phase2c_ledger; create table phase2c_ledger (id serial primary key, note text)");
    const client = await pool.connect();
    try {
      await client.query("begin");
      await client.query("insert into phase2c_ledger (note) values ('credit')");
      await assert.rejects(client.query("select pg_sleep(4)"), (e: any) => e.code === "57014");
      await client.query("rollback").catch(() => {});
    } finally { client.release(); }
    assert.equal((await direct.query("select count(*)::int as n from phase2c_ledger")).rows[0].n, 0);
  });

  test("UNCERTAIN outcome: COMMIT executed, reply lost -> the client never sees success, and the data IS committed (why no client-side query timeout and no automatic retry exist)", async () => {
    await direct.query("drop table if exists phase2c_ledger; create table phase2c_ledger (id serial primary key, note text)");
    const client = await pool.connect();
    let outcome: "pending" | "resolved" | "rejected" = "pending";
    try {
      await client.query("begin");
      await client.query("insert into phase2c_ledger (note) values ('payment-credit')");
      proxy.muteReplies = true; // the server will execute COMMIT; its reply is swallowed
      client.query("commit").then(() => { outcome = "resolved"; }, () => { outcome = "rejected"; });
      await new Promise((r) => setTimeout(r, 1500));
      assert.equal(outcome, "pending", "the caller cannot tell: not resolved, not rejected");
      const committed = await direct.query("select count(*)::int as n from phase2c_ledger");
      assert.equal(committed.rows[0].n, 1, "the transaction DID commit");
    } finally {
      proxy.muteReplies = false;
      (client as any).release(new Error("discard uncertain connection"));
      proxy.cutAll();
    }
    // The application's rule: never replay this write on the strength of the missing reply. A replay would double-credit.
    assert.equal(outcome === "resolved", false);
  });

  test("handled database failures produced no uncaught exception and no unhandled rejection in this process", () => {
    assert.deepEqual(uncaught.map(String), []);
    assert.deepEqual(unhandled.map(String), []);
  });
}
