import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { test } from "node:test";
import { createWeddingSquarePreclaimService, WeddingSquarePreclaimError } from "./wedding-square-preclaim";

const attemptId = "b5cb4c11-d000-4000-8000-0cdb457e1990";
const request = {
  idempotencyKey: "durable-key", locationId: "sandbox-loc",
  planVariationId: "premium-plan", customerId: "customer",
  cardId: "card", timezone: "UTC", startDate: "2026-11-11",
};
const row = {
  id: attemptId, tier: "premium", square_location_id: request.locationId,
  square_plan_variation_id: request.planVariationId,
  square_customer_id: request.customerId, square_card_id: request.cardId,
  requested_timezone: "UTC", requested_start_date: request.startDate,
  idempotency_key: request.idempotencyKey,
  request_fingerprint: createHash("sha256").update(JSON.stringify(request)).digest("hex"),
  consented_amount_cents: 2499, consented_currency: "USD",
};
async function sandbox(run: () => Promise<void>) {
  const variables = {
    SQUARE_ENV: "sandbox",
    WEDDING_SQUARE_SANDBOX_ENROLLMENT_ENABLED: "true",
    SQUARE_ACCESS_TOKEN: "test",
    SQUARE_LOCATION_ID: "sandbox-loc",
    WEDDING_SQUARE_SANDBOX_PREMIUM_PLAN_VARIATION_ID: "premium-plan",
    WEDDING_SQUARE_SANDBOX_ELITE_PLAN_VARIATION_ID: "elite-plan",
  };
  const original = Object.fromEntries(Object.keys(variables).map(key => [key, process.env[key]]));
  Object.assign(process.env, variables);
  try { await run(); } finally {
    for (const [key, value] of Object.entries(original)) {
      if (value === undefined) delete process.env[key]; else process.env[key] = value;
    }
  }
}
test("read-only check validates owner, sandbox, reservation and exact persisted request", async () => sandbox(async () => {
  const calls: { sql: string; params: unknown[] }[] = [];
  const database = { query: async (sql: string, params: unknown[]) => {
    calls.push({ sql, params }); return { rows: [row] };
  } };
  const result = await createWeddingSquarePreclaimService(database as any).inspect(attemptId, "user-1");
  assert.deepEqual(result.request, request);
  assert.deepEqual(calls[0].params, [attemptId, "user-1"]);
  assert.match(calls[0].sql, /user_id\s*=\s*\$2/);
  assert.match(calls[0].sql, /square_environment = 'sandbox'/);
  assert.match(calls[0].sql, /status = 'reserved'/);
  assert.match(calls[0].sql, /^SELECT/);
  assert.match(calls[0].sql, /requested_start_date::text AS requested_start_date/);
}));
test("changed plan, owner-visible card or price fails before claim", async () => sandbox(async () => {
  for (const patch of [{ square_card_id: "other" }, { square_plan_variation_id: "elite-plan" },
                       { consented_amount_cents: 4999 }, { requested_start_date: "2026-11-12" }]) {
    const database = { query: async () => ({ rows: [{ ...row, ...patch }] }) };
    await assert.rejects(createWeddingSquarePreclaimService(database as any).inspect(attemptId, "user-1"), WeddingSquarePreclaimError);
  }
}));
test("missing records or DB errors fail closed", async () => sandbox(async () => {
  for (const query of [async () => ({ rows: [] }), async () => { throw Error("secret db string"); }]) {
    await assert.rejects(createWeddingSquarePreclaimService({ query } as any).inspect(attemptId, "user-1"),
      (error: unknown) => error instanceof WeddingSquarePreclaimError && !error.message.includes("secret"));
  }
}));
test("disabled sandbox performs no read", async () => {
  const old = process.env.WEDDING_SQUARE_SANDBOX_ENROLLMENT_ENABLED;
  delete process.env.WEDDING_SQUARE_SANDBOX_ENROLLMENT_ENABLED;
  let reads = 0;
  try {
    const database = { query: async () => { reads++; return { rows: [row] }; } };
    await assert.rejects(createWeddingSquarePreclaimService(database as any).inspect(attemptId, "user-1"), WeddingSquarePreclaimError);
    assert.equal(reads, 0);
  } finally {
    if (old !== undefined) process.env.WEDDING_SQUARE_SANDBOX_ENROLLMENT_ENABLED = old;
  }
});


test("PostgreSQL DATE is selected as text to prevent local timezone day shifts", async () => sandbox(async () => {
  const queries: string[] = [];
  const database = { query: async (sql: string) => {
    queries.push(sql);
    // PostgreSQL returns the exact calendar date due to DATE::text cast.
    return { rows: [{ ...row, requested_start_date: "2026-11-11" }] };
  } };
  const verified = await createWeddingSquarePreclaimService(database as any).inspect(attemptId, "user-1");
  assert.equal(verified.request.startDate, "2026-11-11");
  assert.match(queries[0], /requested_start_date::text AS requested_start_date/);
}));

test("unexpected Date objects are rejected instead of being converted across timezones", async () => sandbox(async () => {
  const database = { query: async () => ({ rows: [{ ...row, requested_start_date: new Date("2026-11-11T00:00:00+09:00") }] }) };
  await assert.rejects(createWeddingSquarePreclaimService(database as any).inspect(attemptId, "user-1"), WeddingSquarePreclaimError);
}));
