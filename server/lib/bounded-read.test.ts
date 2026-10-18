import test from "node:test";
import assert from "node:assert/strict";
import { runBoundedRead } from "./bounded-read";
import { DatabaseTimeoutError } from "./db-availability";

type Call = { sql: string };
function fakePool(opts: { connectDelayMs?: number; hang?: boolean; failOn?: RegExp; stallOn?: RegExp; slowOn?: { re: RegExp; ms: number } } = {}) {
  const log: string[] = [];
  const state = { released: [] as boolean[], connected: 0 };
  const listeners = new Set<() => void>();
  const client = {
    query: (sql: string) => {
      log.push(sql);
      if (opts.failOn?.test(sql)) return Promise.reject(Object.assign(new Error("boom"), { code: "57014" }));
      if (opts.stallOn?.test(sql)) return new Promise(() => {});
      if (opts.slowOn?.re.test(sql)) return new Promise((r) => setTimeout(() => r({ rows: [] }), opts.slowOn!.ms));
      if (opts.hang && !/^COMMIT|BEGIN/.test(sql)) return new Promise(() => {});
      return Promise.resolve({ rows: [] });
    },
    release: (destroy?: boolean | Error) => { state.released.push(!!destroy); },
    on: (_e: string, l: () => void) => { listeners.add(l); },
    removeListener: (_e: string, l: () => void) => { listeners.delete(l); },
  };
  const pool = { connect: () => new Promise<typeof client>((r) => setTimeout(() => { state.connected++; r(client); }, opts.connectDelayMs ?? 0)) };
  return { pool, client, log, state, listeners };
}
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

test("success: one read-only transaction with a server-side cancel, then COMMIT off the critical path, then a NORMAL release", async () => {
  const f = fakePool();
  const out = await runBoundedRead(f.pool, async (c) => { await c.query("select 1"); return 42; }, { timeoutMs: 1000, label: "t" });
  assert.equal(out, 42);
  assert.match(f.log[0], /^BEGIN READ ONLY; SET LOCAL statement_timeout = 750$/);
  await wait(20);
  assert.deepEqual(f.log.slice(1), ["select 1", "COMMIT"]);
  assert.deepEqual(f.state.released, [false], "healthy connection goes back to the pool");
});

test("a stalled query: rejects with DatabaseTimeoutError at the deadline AND the connection is destroyed (release(true)), not left checked out", async () => {
  const f = fakePool({ hang: true });
  const t = Date.now();
  await assert.rejects(runBoundedRead(f.pool, async (c) => c.query("select slow"), { timeoutMs: 120, label: "t" }), (e) => e instanceof DatabaseTimeoutError);
  assert.ok(Date.now() - t < 400);
  assert.deepEqual(f.state.released, [true]);
});

test("a query that fails (e.g. cancelled by the server, 57014) destroys the connection and surfaces the error", async () => {
  const f = fakePool({ failOn: /select boom/ });
  await assert.rejects(runBoundedRead(f.pool, async (c) => c.query("select boom"), { timeoutMs: 1000, label: "t" }), (e: any) => e.code === "57014");
  assert.deepEqual(f.state.released, [true]);
});

test("a connection that arrives AFTER the deadline is released immediately and used for nothing", async () => {
  const f = fakePool({ connectDelayMs: 150 });
  await assert.rejects(runBoundedRead(f.pool, async (c) => c.query("select 1"), { timeoutMs: 50, label: "t" }), DatabaseTimeoutError);
  await wait(250);
  assert.deepEqual(f.state.released, [false], "healthy but unwanted: back to the pool");
  assert.deepEqual(f.log, [], "no query was run on it");
});

test("no unhandled rejection from an abandoned attempt that fails later", async () => {
  const seen: unknown[] = [];
  const on = (e: unknown) => seen.push(e);
  process.on("unhandledRejection", on);
  try {
    const f = fakePool();
    await assert.rejects(runBoundedRead(f.pool, () => new Promise((_, rej) => setTimeout(() => rej(new Error("late")), 120)), { timeoutMs: 30, label: "t" }), DatabaseTimeoutError);
    await wait(250);
    assert.deepEqual(seen, []);
  } finally { process.off("unhandledRejection", on); }
});

test("release happens exactly once even if COMMIT and the failure path both fire", async () => {
  const f = fakePool();
  await runBoundedRead(f.pool, async () => 1, { timeoutMs: 500, label: "t" });
  await wait(30);
  assert.equal(f.state.released.length, 1);
});

test("the server-side cancel is never longer than the client deadline and has a floor", async () => {
  const f = fakePool();
  await runBoundedRead(f.pool, async () => 1, { timeoutMs: 300, label: "t" });
  assert.match(f.log[0], /statement_timeout = 250$/);
});

test("a checked-out client always has an error listener (so a dying connection cannot raise an uncaught exception); a healthy release removes it, a destroyed client keeps it", async () => {
  const ok = fakePool();
  await runBoundedRead(ok.pool, async () => 1, { timeoutMs: 500, label: "t" });
  await wait(30);
  assert.equal(ok.listeners.size, 0, "removed on healthy release");
  const hung = fakePool({ hang: true });
  const p = runBoundedRead(hung.pool, async (c) => c.query("select slow"), { timeoutMs: 60, label: "t" });
  await wait(20);
  assert.equal(hung.listeners.size, 1, "attached while in use");
  await assert.rejects(p, DatabaseTimeoutError);
  assert.equal(hung.listeners.size, 1, "kept on a destroyed client: it may still emit while closing");
});

// ---- Codex P1-3: every phase releases or destroys its client within a bound ---------------------------------------------------------------
test("STALLED COMMIT: the request already has its answer, but the connection is destroyed at the commit deadline instead of being held forever", async () => {
  const f = fakePool({ stallOn: /^COMMIT$/ });
  const out = await runBoundedRead(f.pool, async () => "answer", { timeoutMs: 1000, label: "t", commitTimeoutMs: 80 });
  assert.equal(out, "answer", "the caller is not delayed by the COMMIT");
  assert.deepEqual(f.state.released, [], "still checked out for the moment");
  await wait(160);
  assert.deepEqual(f.state.released, [true], "destroyed once the commit deadline passed");
});

test("a COMMIT that completes late (after the deadline destroyed the client) does not release twice", async () => {
  const f = fakePool({ slowOn: { re: /^COMMIT$/, ms: 120 } });
  await runBoundedRead(f.pool, async () => 1, { timeoutMs: 1000, label: "t", commitTimeoutMs: 40 });
  await wait(250);
  assert.deepEqual(f.state.released, [true]);
});

test("a COMMIT that completes within its deadline returns the client normally and leaves no timer behind", async () => {
  const f = fakePool({ slowOn: { re: /^COMMIT$/, ms: 20 } });
  await runBoundedRead(f.pool, async () => 1, { timeoutMs: 1000, label: "t", commitTimeoutMs: 500 });
  await wait(80);
  assert.deepEqual(f.state.released, [false]);
  await wait(600);
  assert.deepEqual(f.state.released, [false], "the commit-deadline timer was cleared");
});

test("a COMMIT that fails destroys the client", async () => {
  const f = fakePool({ failOn: /^COMMIT$/ });
  await runBoundedRead(f.pool, async () => 1, { timeoutMs: 1000, label: "t" });
  await wait(30);
  assert.deepEqual(f.state.released, [true]);
});

test("a stalled transaction start (BEGIN … SET LOCAL) is bounded by the overall deadline and destroys the client", async () => {
  const f = fakePool({ stallOn: /^BEGIN READ ONLY/ });
  await assert.rejects(runBoundedRead(f.pool, async (c) => c.query("select 1"), { timeoutMs: 100, label: "t" }), DatabaseTimeoutError);
  assert.deepEqual(f.state.released, [true]);
  assert.ok(!f.log.includes("select 1"));
});

test("five concurrent requests whose COMMITs all stall free all five clients (pool of five cannot be exhausted permanently)", async () => {
  const pools = Array.from({ length: 5 }, () => fakePool({ stallOn: /^COMMIT$/ }));
  await Promise.all(pools.map((f) => runBoundedRead(f.pool, async () => 1, { timeoutMs: 1000, label: "t", commitTimeoutMs: 60 })));
  await wait(150);
  assert.deepEqual(pools.map((f) => f.state.released), [[true], [true], [true], [true], [true]]);
});
