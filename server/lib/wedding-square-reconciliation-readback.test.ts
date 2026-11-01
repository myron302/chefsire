import assert from "node:assert/strict";
import { test } from "node:test";
import { createWeddingSquareReconciliationReadback, WeddingSquareReconciliationReadbackError } from "./wedding-square-reconciliation-readback";
const attemptId = "b5cb4c11-d000-4000-8000-0cdb457e1990";
const row = {
  id: attemptId, status: "needs_reconciliation", idempotency_key: "durable-key",
  request_fingerprint: "a".repeat(64), provider_subscription_id: null,
  square_customer_id: "customer", square_card_id: "card",
  square_location_id: "location", square_plan_variation_id: "plan",
  requested_start_date: "2026-11-11", requested_timezone: "UTC",
};
async function sandbox(run: () => Promise<void>) {
  const old = [process.env.SQUARE_ENV, process.env.WEDDING_SQUARE_SANDBOX_ENROLLMENT_ENABLED];
  process.env.SQUARE_ENV = "sandbox"; process.env.WEDDING_SQUARE_SANDBOX_ENROLLMENT_ENABLED = "true";
  try { await run(); } finally {
    if (old[0] === undefined) delete process.env.SQUARE_ENV; else process.env.SQUARE_ENV = old[0];
    if (old[1] === undefined) delete process.env.WEDDING_SQUARE_SANDBOX_ENROLLMENT_ENABLED; else process.env.WEDDING_SQUARE_SANDBOX_ENROLLMENT_ENABLED = old[1];
  }
}
test("readback is strictly read-only, bound to user and sandbox and returns original evidence", async () => sandbox(async () => {
  const calls: { sql: string; params: unknown[] }[] = [];
  const db = { query: async (sql: string, params: unknown[]) => { calls.push({ sql, params }); return { rows: [row] }; } };
  const result = await createWeddingSquareReconciliationReadback(db as any).inspect(attemptId, "user-1");
  assert.deepEqual(calls[0].params, [attemptId, "user-1"]);
  assert.match(calls[0].sql, /^SELECT/);
  assert.match(calls[0].sql, /user_id = \$2/);
  assert.match(calls[0].sql, /square_environment = 'sandbox'/);
  assert.match(calls[0].sql, /'needs_reconciliation'/);
  assert.equal(result.persistedIdempotencyKey, "durable-key");
  assert.equal(result.status, "needs_reconciliation");
  assert.equal(result.requestedStartDate, "2026-11-11");
  assert.equal(result.requestedTimezone, "UTC");
  assert.match(calls[0].sql, /requested_start_date::text AS requested_start_date/);
}));
test("unknown, malformed, or unconfirmed records fail closed", async () => sandbox(async () => {
  for (const bad of [null, { ...row, status: "reserved" }, { ...row, request_fingerprint: "" }, { ...row, status: "confirmed" }]) {
    const db = { query: async () => ({ rows: bad ? [bad] : [] }) };
    await assert.rejects(createWeddingSquareReconciliationReadback(db as any).inspect(attemptId, "user-1"), WeddingSquareReconciliationReadbackError);
  }
}));
test("malformed or non-UTC saved start dates never become reconciliation evidence", async () => sandbox(async () => {
  for (const bad of [
    { requested_timezone: "America/New_York" },
    { requested_timezone: null },
    { requested_start_date: "2026-02-30" },
    { requested_start_date: "2026-11-11T00:00:00Z" },
    { requested_start_date: undefined },
  ]) {
    const db = { query: async () => ({ rows: [{ ...row, ...bad }] }) };
    await assert.rejects(createWeddingSquareReconciliationReadback(db as any).inspect(attemptId, "user-1"), WeddingSquareReconciliationReadbackError);
  }
  const db = { query: async () => ({ rows: [{ ...row, requested_start_date: null }] }) };
  assert.equal((await createWeddingSquareReconciliationReadback(db as any).inspect(attemptId, "user-1")).requestedStartDate, null);
}));

test("a confirmed subscription ID can be inspected but never grants entitlement", async () => sandbox(async () => {
  const db = { query: async () => ({ rows: [{ ...row, status: "confirmed", provider_subscription_id: "sub-1" }] }) };
  const result = await createWeddingSquareReconciliationReadback(db as any).inspect(attemptId, "user-1");
  assert.equal(result.providerSubscriptionId, "sub-1");
  assert.equal("entitlement" in result, false);
}));
test("disabled configuration and raw database faults cannot expose connection details", async () => sandbox(async () => {
  const db = { query: async () => { throw Error("secret neon connection"); } };
  await assert.rejects(createWeddingSquareReconciliationReadback(db as any).inspect(attemptId, "user-1"),
    (e: unknown) => e instanceof WeddingSquareReconciliationReadbackError && !e.message.includes("secret"));
  const previous = process.env.WEDDING_SQUARE_SANDBOX_ENROLLMENT_ENABLED;
  delete process.env.WEDDING_SQUARE_SANDBOX_ENROLLMENT_ENABLED;
  let called = false;
  try {
    const disabled = { query: async () => { called = true; return { rows: [row] }; } };
    await assert.rejects(createWeddingSquareReconciliationReadback(disabled as any).inspect(attemptId, "user-1"), WeddingSquareReconciliationReadbackError);
    assert.equal(called, false);
  } finally {
    if (previous !== undefined) process.env.WEDDING_SQUARE_SANDBOX_ENROLLMENT_ENABLED = previous;
  }
}));

test("malformed reconciliation owner and attempt IDs fail before any SELECT", async () => sandbox(async () => {
  let reads = 0;
  const db = { query: async () => { reads++; return { rows: [row] }; } };
  const service = createWeddingSquareReconciliationReadback(db as any);
  const nul = String.fromCharCode(0);
  const del = String.fromCharCode(127);
  for (const [id, userId] of [
    [attemptId + nul, "user-1"],
    [attemptId, "user" + del + "-1"],
    [" " + attemptId, "user-1"],
    [attemptId, "user-1" + String.fromCharCode(9)],
    [attemptId, null],
  ] as const) {
    await assert.rejects(service.inspect(id as string, userId as string), WeddingSquareReconciliationReadbackError);
  }
  assert.equal(reads, 0);
}));

test("malformed persisted reconciliation identities never become readback evidence", async () => sandbox(async () => {
  const nul = String.fromCharCode(0);
  const tab = String.fromCharCode(9);
  for (const patch of [
    { id: "other-attempt" },
    { idempotency_key: "key" + nul },
    { square_customer_id: "customer" + tab + "other" },
    { square_card_id: "card" + nul },
    { square_location_id: "location" + nul },
    { square_plan_variation_id: "plan" + nul },
    { provider_subscription_id: "sub" + nul + "1" },
    { status: "confirmed", provider_subscription_id: "sub" + tab + "1" },
  ]) {
    let reads = 0;
    const db = { query: async () => { reads++; return { rows: [{ ...row, ...patch }] }; } };
    await assert.rejects(
      createWeddingSquareReconciliationReadback(db as any).inspect(attemptId, "user-1"),
      WeddingSquareReconciliationReadbackError,
    );
    assert.equal(reads, 1);
  }
}));
