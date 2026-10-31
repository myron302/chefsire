import assert from "node:assert/strict";
import { test } from "node:test";
import { createWeddingSquareReconciliationReadback, WeddingSquareReconciliationReadbackError } from "./wedding-square-reconciliation-readback";
const attemptId = "b5cb4c11-d000-4000-8000-0cdb457e1990";
const row = {
  id: attemptId, status: "needs_reconciliation", idempotency_key: "durable-key",
  request_fingerprint: "a".repeat(64), provider_subscription_id: null,
  square_customer_id: "customer", square_card_id: "card",
  square_location_id: "location", square_plan_variation_id: "plan",
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
}));
test("unknown, malformed, or unconfirmed records fail closed", async () => sandbox(async () => {
  for (const bad of [null, { ...row, status: "reserved" }, { ...row, request_fingerprint: "" }, { ...row, status: "confirmed" }]) {
    const db = { query: async () => ({ rows: bad ? [bad] : [] }) };
    await assert.rejects(createWeddingSquareReconciliationReadback(db as any).inspect(attemptId, "user-1"), WeddingSquareReconciliationReadbackError);
  }
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
