/**
 * The initialization primitive that replaced the "cache the promise forever" pattern.
 *
 * What is asserted is the externally visible contract: success is cached, a burst shares ONE run, failure is not cached but IS
 * rate limited (so there is neither a permanently dead feature nor a retry storm), nobody waits forever, and no driver text ever
 * reaches a caller. The clock is injected, so the backoff arithmetic is exact and nothing sleeps.
 */
import test from "node:test";
import assert from "node:assert/strict";
import type { Request, Response } from "express";
import { createRetryableInit, initGuard, InitializationUnavailableError } from "./retryable-init";

const quiet = () => undefined;

function gate() {
  let open!: () => void;
  const opened = new Promise<void>((resolve) => { open = resolve; });
  return { opened, open };
}

function fakeClock(start = 1_000_000) {
  let t = start;
  return { now: () => t, advance: (ms: number) => { t += ms; } };
}

/** An initializer whose behavior the test flips between failing and succeeding. */
function flaky(options: Partial<Parameters<typeof createRetryableInit>[0]> = {}) {
  const clock = fakeClock();
  const state = { down: true, runs: 0 };
  const init = createRetryableInit({
    name: "unit",
    now: clock.now,
    logger: quiet,
    run: async () => {
      state.runs += 1;
      if (state.down) throw new Error('connect ECONNREFUSED ep-private-host.neon.tech:5432 role "neondb_owner" password authentication failed');
    },
    ...options,
  });
  return { init, clock, state };
}

test("success is cached: the work runs once however many callers there are", async () => {
  const { init, state } = flaky();
  state.down = false;
  await Promise.all(Array.from({ length: 50 }, () => init.ensure()));
  await init.ensure();
  await init.ensure();
  assert.equal(state.runs, 1);
  assert.equal(init.isReady(), true);
});

test("a burst of concurrent callers shares ONE run (no concurrent DDL)", async () => {
  const g = gate();
  let running = 0;
  let maxRunning = 0;
  let runs = 0;
  const init = createRetryableInit({
    name: "burst",
    logger: quiet,
    run: async () => {
      runs += 1;
      running += 1;
      maxRunning = Math.max(maxRunning, running);
      await g.opened;
      running -= 1;
    },
  });
  const callers = Array.from({ length: 200 }, () => init.ensure());
  assert.equal(init.stats().running, true);
  g.open();
  await Promise.all(callers);
  assert.equal(runs, 1);
  assert.equal(maxRunning, 1);
});

test("initial failure rejects every caller of that attempt with an opaque error", async () => {
  const { init, state } = flaky();
  const results = await Promise.allSettled(Array.from({ length: 10 }, () => init.ensure()));
  assert.equal(state.runs, 1, "ten concurrent callers, one attempt");
  for (const result of results) {
    assert.equal(result.status, "rejected");
    const reason = (result as PromiseRejectedResult).reason;
    assert.ok(reason instanceof InitializationUnavailableError);
    assert.equal(reason.code, "initialization_unavailable");
  }
});

test("a failure is NOT cached: after the backoff window the next call runs the work again and heals", async () => {
  const { init, clock, state } = flaky();
  await assert.rejects(init.ensure(), InitializationUnavailableError);
  assert.equal(state.runs, 1);

  state.down = false; // the database comes back
  // Still inside the window: refused without touching the database, even though it is healthy again.
  await assert.rejects(init.ensure(), InitializationUnavailableError);
  assert.equal(state.runs, 1);

  clock.advance(1_000);
  await init.ensure();
  assert.equal(state.runs, 2);
  assert.equal(init.isReady(), true);
  assert.equal(init.stats().consecutiveFailures, 0);

  // Healed means healed: no further runs, ever.
  await init.ensure();
  assert.equal(state.runs, 2);
});

test("no retry storm: thousands of calls inside the backoff window make exactly zero further attempts", async () => {
  const { init, clock, state } = flaky();
  await assert.rejects(init.ensure(), InitializationUnavailableError);
  for (let i = 0; i < 5_000; i += 1) {
    clock.advance(0);
    await assert.rejects(init.ensure(), InitializationUnavailableError);
  }
  assert.equal(state.runs, 1);
});

test("the delay doubles per consecutive failure and is capped, so retries are bounded for any outage length", async () => {
  const { init, clock, state } = flaky({ initialBackoffMs: 1_000, maxBackoffMs: 8_000 });
  const delays: number[] = [];
  for (let i = 0; i < 7; i += 1) {
    const before = clock.now();
    await assert.rejects(init.ensure(), InitializationUnavailableError);
    const { retryNotBeforeMs } = init.stats();
    delays.push(retryNotBeforeMs - before);
    // One millisecond short of the window: still refused, no attempt.
    clock.advance(retryNotBeforeMs - before - 1);
    const runsBefore = state.runs;
    await assert.rejects(init.ensure(), InitializationUnavailableError);
    assert.equal(state.runs, runsBefore, "refused inside the window");
    clock.advance(1);
  }
  assert.deepEqual(delays, [1_000, 2_000, 4_000, 8_000, 8_000, 8_000, 8_000]);
  assert.equal(state.runs, 7, "exactly one attempt per window");
});

test("over a long outage the attempt rate stays at or below one per maxBackoff", async () => {
  const { init, clock, state } = flaky({ initialBackoffMs: 1_000, maxBackoffMs: 30_000 });
  const start = clock.now();
  // Ten minutes of outage, a request every 100ms.
  for (let elapsed = 0; elapsed < 600_000; elapsed += 100) {
    await init.ensure().catch(() => undefined);
    clock.advance(100);
  }
  const minutes = (clock.now() - start) / 60_000;
  // 1 + 2 + 4 + 8 + 16 s of ramp, then every 30 s: well under 3 per minute on average, never "per request".
  assert.ok(state.runs <= 1 + 4 + Math.ceil(minutes * 2), `attempted ${state.runs} times in ${minutes} minutes`);
  assert.ok(state.runs >= 3);
});

test("errors reaching callers carry no driver text; the real error stays on `cause` and in the server log", async () => {
  const logged: unknown[] = [];
  const { init } = flaky({ logger: (_message, error) => { logged.push(error); } });
  const error = await init.ensure().then(() => null, (e) => e as InitializationUnavailableError);
  assert.ok(error instanceof InitializationUnavailableError);
  const surface = `${error.message} ${error.name} ${JSON.stringify(error)}`;
  for (const secret of ["ECONNREFUSED", "neon.tech", "neondb_owner", "password", "5432"]) {
    assert.ok(!surface.includes(secret), `caller-visible error leaked ${secret}`);
  }
  assert.match(String((error as { cause?: Error }).cause?.message), /ECONNREFUSED/);
  assert.equal(logged.length, 1);
  assert.match(String((logged[0] as Error).message), /ECONNREFUSED/);
});

test("a synchronous throw from the work is an ordinary failure, not a crash", async () => {
  const init = createRetryableInit({ name: "sync", logger: quiet, run: (() => { throw new Error("boom"); }) as () => Promise<void> });
  await assert.rejects(init.ensure(), InitializationUnavailableError);
  assert.equal(init.stats().consecutiveFailures, 1);
});

test("a hung attempt releases callers at the timeout and does not start a concurrent second run", async () => {
  const g = gate();
  let runs = 0;
  const init = createRetryableInit({
    name: "hung",
    logger: quiet,
    attemptTimeoutMs: 25,
    abandonAfterMs: 60_000,
    run: async () => { runs += 1; await g.opened; },
  });
  const started = Date.now();
  await assert.rejects(init.ensure(), InitializationUnavailableError);
  assert.ok(Date.now() - started < 1_000, "the caller was not held for the life of the hung attempt");
  await assert.rejects(init.ensure(), InitializationUnavailableError);
  await new Promise((resolve) => setTimeout(resolve, 40));
  await assert.rejects(init.ensure(), InitializationUnavailableError, "an overdue attempt answers immediately");
  assert.equal(runs, 1, "no second attempt while the first is still running");
  g.open();
  await new Promise((resolve) => setImmediate(resolve));
  await init.ensure(); // the hung attempt eventually finished: ready
  assert.equal(runs, 1);
});

test("a wedged attempt is written off after abandonAfterMs, bounded by the normal backoff, and a late success still counts", async () => {
  const clock = fakeClock();
  const g = gate();
  let runs = 0;
  const init = createRetryableInit({
    name: "wedged",
    logger: quiet,
    now: clock.now,
    attemptTimeoutMs: 10,
    abandonAfterMs: 60_000,
    initialBackoffMs: 1_000,
    run: async () => {
      runs += 1;
      if (runs === 1) await g.opened; // never settles during the test body
    },
  });
  await assert.rejects(init.ensure(), InitializationUnavailableError);
  assert.equal(runs, 1);

  clock.advance(59_999);
  await assert.rejects(init.ensure(), InitializationUnavailableError);
  assert.equal(runs, 1, "still inside abandonAfterMs");

  clock.advance(1); // 60 000 ms: written off, backoff starts now
  await assert.rejects(init.ensure(), InitializationUnavailableError);
  assert.equal(runs, 1, "written off, but the backoff window applies before the next attempt");

  clock.advance(1_000);
  await init.ensure();
  assert.equal(runs, 2);
  assert.equal(init.isReady(), true);

  g.open(); // the first attempt finally settles; harmless
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(init.isReady(), true);
});

test("a late success of a written-off attempt heals the initializer", async () => {
  const clock = fakeClock();
  const g = gate();
  let runs = 0;
  const init = createRetryableInit({
    name: "late-success",
    logger: quiet,
    now: clock.now,
    attemptTimeoutMs: 10,
    abandonAfterMs: 1_000,
    run: async () => { runs += 1; await g.opened; },
  });
  await assert.rejects(init.ensure(), InitializationUnavailableError);
  clock.advance(1_000);
  await assert.rejects(init.ensure(), InitializationUnavailableError); // written off
  g.open();
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(init.isReady(), true);
  await init.ensure();
  assert.equal(runs, 1);
});

test("a rejection nobody is waiting on never becomes an unhandled rejection (this process exits on those)", async () => {
  const unhandled: unknown[] = [];
  const onUnhandled = (reason: unknown) => { unhandled.push(reason); };
  process.on("unhandledRejection", onUnhandled);
  try {
    const g = gate();
    const init = createRetryableInit({
      name: "orphan",
      logger: quiet,
      attemptTimeoutMs: 5,
      run: async () => { await g.opened; throw new Error("late failure after every caller gave up"); },
    });
    await assert.rejects(init.ensure(), InitializationUnavailableError);
    g.open();
    await new Promise((resolve) => setTimeout(resolve, 20));
    assert.deepEqual(unhandled, []);
  } finally {
    process.off("unhandledRejection", onUnhandled);
  }
});

// ---------------------------------------------------------------------------------------------------------------------
// initGuard
// ---------------------------------------------------------------------------------------------------------------------

function fakeResponse() {
  const res = {
    statusCode: 200,
    headers: {} as Record<string, string>,
    body: undefined as unknown,
    setHeader(name: string, value: string) { res.headers[name.toLowerCase()] = value; return res; },
    status(code: number) { res.statusCode = code; return res; },
    json(body: unknown) { res.body = body; return res; },
  };
  return res;
}

test("initGuard answers 503 + Retry-After with a fixed body and never calls next while unavailable", async () => {
  const { init } = flaky();
  const guard = initGuard(init, { message: "Not ready", code: "feature_unavailable" });
  const res = fakeResponse();
  let nextCalled = false;
  await guard({} as Request, res as unknown as Response, () => { nextCalled = true; });
  assert.equal(nextCalled, false);
  assert.equal(res.statusCode, 503);
  assert.equal(res.headers["retry-after"], "1");
  assert.deepEqual(res.body, { message: "Not ready", code: "feature_unavailable", retryable: true });
  assert.ok(!JSON.stringify(res.body).includes("ECONNREFUSED"));
});

test("initGuard calls next() once initialization has succeeded and never touches the response", async () => {
  const { init, state } = flaky();
  state.down = false;
  const guard = initGuard(init, { message: "Not ready", code: "feature_unavailable" });
  const res = fakeResponse();
  let nextCalls = 0;
  await guard({} as Request, res as unknown as Response, () => { nextCalls += 1; });
  assert.equal(nextCalls, 1);
  assert.equal(res.statusCode, 200);
  assert.equal(res.body, undefined);
});
