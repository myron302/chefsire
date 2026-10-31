import assert from "node:assert/strict";
import { test } from "node:test";
import { createWeddingSquareConfirmationPersistence, WeddingSquareConfirmationPersistenceError } from "./wedding-square-confirmation-persistence";

const attemptId = "b5cb4c11-d000-4000-8000-0cdb457e1990";
const response = {
  providerSubscriptionId: "square-sub-1", providerStatus: "PENDING" as const,
  verifiedLocationId: "sandbox-loc", verifiedPlanVariationId: "premium-plan",
};
const input = {
  attemptId, authenticatedUserId: "user-1", persistedIdempotencyKey: "saved-key",
  persistedRequestFingerprint: "a".repeat(64), verifiedResponse: response,
};

async function sandbox(fn: () => Promise<void>) {
  const before = { env: process.env.SQUARE_ENV, enabled: process.env.WEDDING_SQUARE_SANDBOX_ENROLLMENT_ENABLED };
  process.env.SQUARE_ENV = "sandbox";
  process.env.WEDDING_SQUARE_SANDBOX_ENROLLMENT_ENABLED = "true";
  try { await fn(); } finally {
    if (before.env === undefined) delete process.env.SQUARE_ENV; else process.env.SQUARE_ENV = before.env;
    if (before.enabled === undefined) delete process.env.WEDDING_SQUARE_SANDBOX_ENROLLMENT_ENABLED;
    else process.env.WEDDING_SQUARE_SANDBOX_ENROLLMENT_ENABLED = before.enabled;
  }
}

test("confirmation binds owner, sandbox, claimed state and exact persisted evidence", async () => sandbox(async () => {
  let statement = "";
  let args: unknown[] = [];
  const database = { query: async (sql: string, params: unknown[]) => {
    statement = sql; args = params;
    return { rows: [{ id: attemptId, provider_subscription_id: "square-sub-1" }] };
  } };
  const confirmed = await createWeddingSquareConfirmationPersistence(database as any).confirm(input);
  assert.deepEqual(confirmed, { attemptId, status: "confirmed", providerSubscriptionId: "square-sub-1" });
  assert.deepEqual(args, [attemptId, "user-1", "saved-key", "a".repeat(64), "square-sub-1", "sandbox-loc", "premium-plan"]);
  for (const required of ["user_id = $2", "square_environment = 'sandbox'", "status = 'submitting'",
    "idempotency_key = $3", "request_fingerprint = $4", "square_location_id = $6",
    "square_plan_variation_id = $7", "provider_subscription_id IS NULL"]) {
    assert.ok(statement.includes(required), required);
  }
  assert.equal("entitlement" in confirmed, false);
}));

test("duplicate, stale, or changed attempts fail closed", async () => sandbox(async () => {
  const database = { query: async () => ({ rows: [] }) };
  await assert.rejects(createWeddingSquareConfirmationPersistence(database as any).confirm(input), WeddingSquareConfirmationPersistenceError);
}));

test("database errors are sanitized and require reconciliation", async () => sandbox(async () => {
  const database = { query: async () => { throw Error("private neon connection detail"); } };
  await assert.rejects(createWeddingSquareConfirmationPersistence(database as any).confirm(input),
    (error: unknown) => error instanceof WeddingSquareConfirmationPersistenceError && !error.message.includes("neon"));
}));

test("sandbox kill switch prevents any database mutation", async () => {
  const old = process.env.WEDDING_SQUARE_SANDBOX_ENROLLMENT_ENABLED;
  delete process.env.WEDDING_SQUARE_SANDBOX_ENROLLMENT_ENABLED;
  let writes = 0;
  try {
    const database = { query: async () => { writes++; return { rows: [] }; } };
    await assert.rejects(createWeddingSquareConfirmationPersistence(database as any).confirm(input), WeddingSquareConfirmationPersistenceError);
    assert.equal(writes, 0);
  } finally {
    if (old !== undefined) process.env.WEDDING_SQUARE_SANDBOX_ENROLLMENT_ENABLED = old;
  }
});

test("unverified provider response fields cannot be omitted", async () => sandbox(async () => {
  let writes = 0;
  const database = { query: async () => { writes++; return { rows: [] }; } };
  await assert.rejects(createWeddingSquareConfirmationPersistence(database as any).confirm({
    ...input, verifiedResponse: { ...response, providerSubscriptionId: "" },
  }), WeddingSquareConfirmationPersistenceError);
  assert.equal(writes, 0);
}));
