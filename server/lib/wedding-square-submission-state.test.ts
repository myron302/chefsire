import assert from "node:assert/strict";
import { test } from "node:test";
import { createWeddingSquareSubmissionStateService, WeddingSquareSubmissionStateError } from "./wedding-square-submission-state";

const attemptId = "b5cb4c11-d000-4000-8000-0cdb457e1990";
async function withSandbox(fn: () => Promise<void>) {
  const before = { env: process.env.SQUARE_ENV, enabled: process.env.WEDDING_SQUARE_SANDBOX_ENROLLMENT_ENABLED };
  process.env.SQUARE_ENV = "sandbox";
  process.env.WEDDING_SQUARE_SANDBOX_ENROLLMENT_ENABLED = "true";
  try { await fn(); } finally {
    if (before.env === undefined) delete process.env.SQUARE_ENV; else process.env.SQUARE_ENV = before.env;
    if (before.enabled === undefined) delete process.env.WEDDING_SQUARE_SANDBOX_ENROLLMENT_ENABLED;
    else process.env.WEDDING_SQUARE_SANDBOX_ENROLLMENT_ENABLED = before.enabled;
  }
}

test("atomic one-way claim binds authenticated owner, sandbox and reserved status", async () => withSandbox(async () => {
  const calls: { sql: string; params: unknown[] }[] = [];
  const db = { query: async (sql: string, params: unknown[]) => {
    calls.push({ sql, params });
    return { rows: [{ id: attemptId, idempotency_key: "saved-key", request_fingerprint: "saved-sha256" }] };
  } };
  const claimed = await createWeddingSquareSubmissionStateService(db as any).claim(attemptId, "user-1");
  assert.equal(claimed.persistedIdempotencyKey, "saved-key");
  assert.deepEqual(calls[0].params, [attemptId, "user-1"]);
  assert.match(calls[0].sql, /status = 'reserved'/);
  assert.match(calls[0].sql, /square_environment = 'sandbox'/);
}));

test("duplicate or nonexistent claim is rejected, never issued a new idempotency key", async () => withSandbox(async () => {
  const db = { query: async () => ({ rows: [] }) };
  await assert.rejects(createWeddingSquareSubmissionStateService(db as any).claim(attemptId, "user-1"), WeddingSquareSubmissionStateError);
}));

test("ambiguous submission transitions only from submitting to needs_reconciliation", async () => withSandbox(async () => {
  let sql = "";
  const db = { query: async (statement: string) => { sql = statement; return { rows: [{ id: attemptId }] }; } };
  const result = await createWeddingSquareSubmissionStateService(db as any).markUnknown(attemptId, "user-1");
  assert.equal(result.status, "needs_reconciliation");
  assert.match(sql, /status = 'submitting'/);
  assert.match(sql, /status = 'needs_reconciliation'/);
}));

test("database errors are sanitized without leaking connection details", async () => withSandbox(async () => {
  const db = { query: async () => { throw Error("postgres connection secret"); } };
  await assert.rejects(createWeddingSquareSubmissionStateService(db as any).claim(attemptId, "user-1"),
    (error: unknown) => error instanceof WeddingSquareSubmissionStateError && !error.message.includes("secret"));
}));

test("environment switch disables all write operations", async () => {
  const old = process.env.WEDDING_SQUARE_SANDBOX_ENROLLMENT_ENABLED;
  delete process.env.WEDDING_SQUARE_SANDBOX_ENROLLMENT_ENABLED;
  let called = false;
  try {
    const db = { query: async () => { called = true; return { rows: [] }; } };
    await assert.rejects(createWeddingSquareSubmissionStateService(db as any).claim(attemptId, "user-1"), WeddingSquareSubmissionStateError);
    assert.equal(called, false);
  } finally {
    if (old !== undefined) process.env.WEDDING_SQUARE_SANDBOX_ENROLLMENT_ENABLED = old;
  }
});
