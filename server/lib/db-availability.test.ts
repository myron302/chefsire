import test from "node:test";
import assert from "node:assert/strict";
import { DatabaseTimeoutError, describeDatabaseError, isDatabaseUnavailableError, withReadTimeout, SERVICE_UNAVAILABLE_BODY } from "./db-availability";

const err = (props: Record<string, unknown>, message = "x") => Object.assign(new Error(message), props);

test("connectivity signatures are 'unavailable'", () => {
  for (const code of ["ECONNREFUSED", "ECONNRESET", "ETIMEDOUT", "ENOTFOUND", "EAI_AGAIN", "EPIPE", "57P01", "57P03", "53300", "08006", "08001", "DB_TIMEOUT"]) {
    assert.equal(isDatabaseUnavailableError(err({ code })), true, code);
  }
  for (const message of ["Connection terminated unexpectedly", "Connection terminated due to connection timeout", "timeout exceeded when trying to connect", "socket hang up", "Client has encountered a connection error and is not queryable", "Cannot use a pool after calling end on the pool"]) {
    assert.equal(isDatabaseUnavailableError(new Error(message)), true, message);
  }
  assert.equal(isDatabaseUnavailableError(Object.assign(new Error("Database not configured (set DATABASE_URL)."), { status: 503 })), true);
  assert.equal(isDatabaseUnavailableError(new DatabaseTimeoutError("x", 5)), true);
});

test("causes and AggregateError members are inspected", () => {
  assert.equal(isDatabaseUnavailableError(new Error("wrapper", { cause: err({ code: "ECONNREFUSED" }) })), true);
  assert.equal(isDatabaseUnavailableError(new AggregateError([new Error("a"), err({ code: "ETIMEDOUT" })])), true);
});

test("application faults are NOT 'unavailable' (they keep their own handling)", () => {
  for (const code of ["23505", "42P01", "42601", "22P02", "40001", "40P01"]) assert.equal(isDatabaseUnavailableError(err({ code })), false, code);
  assert.equal(isDatabaseUnavailableError(new TypeError("x is not a function")), false);
  assert.equal(isDatabaseUnavailableError(null), false);
  assert.equal(isDatabaseUnavailableError("ECONNREFUSED"), false);
  const cyclic: any = new Error("loop"); cyclic.cause = cyclic;
  assert.equal(isDatabaseUnavailableError(cyclic), false);
});

test("withReadTimeout rejects with DatabaseTimeoutError, passes results through, and never leaves an unhandled rejection", async () => {
  const unhandled: unknown[] = [];
  const onUnhandled = (r: unknown) => unhandled.push(r);
  process.on("unhandledRejection", onUnhandled);
  try {
    assert.equal(await withReadTimeout(Promise.resolve(7), 1000, "q"), 7);
    await assert.rejects(withReadTimeout(new Promise((r) => setTimeout(r, 200)), 20, "slow"), (e: any) => e instanceof DatabaseTimeoutError && e.code === "DB_TIMEOUT");
    const late = new Promise((_, rej) => setTimeout(() => rej(new Error("late failure")), 60));
    await assert.rejects(withReadTimeout(late, 10, "late"), DatabaseTimeoutError);
    await new Promise((r) => setTimeout(r, 120));
    assert.equal(unhandled.length, 0, "the abandoned operation's later rejection is swallowed");
    await assert.rejects(withReadTimeout(Promise.reject(new Error("real")), 1000, "q"), /real/);
  } finally { process.off("unhandledRejection", onUnhandled); }
});

test("log descriptions carry the code but never a connection string", () => {
  const e = err({ code: "ECONNREFUSED" }, "connect failed for postgres://app:hunter2@ep-secret.neon.tech/db?sslmode=require");
  const d = describeDatabaseError(e);
  assert.match(d, /ECONNREFUSED/);
  assert.ok(!/hunter2|ep-secret|neon\.tech/.test(d), d);
});

test("the outage body is fixed, retryable and detail-free", () => {
  assert.deepEqual({ ...SERVICE_UNAVAILABLE_BODY }, { error: "Service temporarily unavailable. Please try again in a moment.", code: "SERVICE_UNAVAILABLE", retryable: true });
});
