import assert from "node:assert/strict";
import { test } from "node:test";
import {
  createWeddingSquareConfirmationPersistence,
  WeddingSquareConfirmationPersistenceError,
} from "./wedding-square-confirmation-persistence";
import { WEDDING_CONSENT_VERSION } from "./wedding-square-billing-policy";

const attemptId = "b5cb4c11-d000-4000-8000-0cdb457e1990";
const response = {
  providerSubscriptionId: "square-sub-1", providerStatus: "PENDING" as const,
  verifiedLocationId: "sandbox-loc", verifiedPlanVariationId: "premium-plan",
};
const input = {
  attemptId, authenticatedUserId: "user-1", persistedIdempotencyKey: "saved-key",
  persistedRequestFingerprint: "a".repeat(64), verifiedResponse: response,
};
const saved = {
  id: attemptId, user_id: "user-1", tier: "premium",
  square_location_id: "sandbox-loc", square_plan_variation_id: "premium-plan",
  square_customer_id: "customer-1", square_card_id: "card-1",
  consent_terms_version: WEDDING_CONSENT_VERSION,
  consented_at: new Date("2026-11-01T13:00:00Z"),
  consented_amount_cents: 2499, consented_currency: "USD",
  requested_start_date: "2026-11-16", requested_timezone: "UTC",
};
async function sandbox(fn: () => Promise<void>) {
  const names = ["SQUARE_ENV", "WEDDING_SQUARE_SANDBOX_ENROLLMENT_ENABLED",
    "WEDDING_SQUARE_SANDBOX_MERCHANT_ID", "SQUARE_LOCATION_ID"] as const;
  const previous = names.map(n => process.env[n]);
  Object.assign(process.env, {
    SQUARE_ENV: "sandbox", WEDDING_SQUARE_SANDBOX_ENROLLMENT_ENABLED: "true",
    WEDDING_SQUARE_SANDBOX_MERCHANT_ID: "merchant-1", SQUARE_LOCATION_ID: "sandbox-loc",
  });
  try { await fn(); } finally {
    names.forEach((n, i) => {
      if (previous[i] === undefined) delete process.env[n]; else process.env[n] = previous[i];
    });
  }
}
function fixture(opts: { saved?: unknown; fail?: "select"|"insert"|"update"|"commit"|"rollback";
  duplicate?: boolean; wrongConfirmation?: boolean } = {}) {
  const operations: string[] = [];
  const sql: string[] = [];
  const args: unknown[][] = [];
  const released: unknown[] = [];
  const db = {
    connect: async () => ({
      query: async (query: string, parameters: unknown[] = []) => {
        sql.push(query); args.push(parameters);
        const operation = query.trim().split(/\s+/)[0].toUpperCase();
        operations.push(operation);
        if (operation.toLowerCase() === opts.fail) throw Error("private neon failure");
        if (operation === "SELECT") return { rows: opts.saved === undefined ? [saved] : opts.saved === null ? [] : [opts.saved] };
        if (operation === "INSERT") return { rows: opts.duplicate ? [] : [{ id: "sub-row-1", square_subscription_id: "square-sub-1" }] };
        if (operation === "UPDATE") return { rows: opts.wrongConfirmation ? [] : [{ id: attemptId, provider_subscription_id: "square-sub-1" }] };
        return { rows: [] };
      },
      release: (reason?: Error) => { released.push(reason); },
    }),
  };
  return { service: createWeddingSquareConfirmationPersistence(db as any), operations, sql, args, released };
}
test("transaction binds saved owner, tier, explicit consent and provider subscription before confirmation", () =>
  sandbox(async () => {
    const x = fixture();
    assert.deepEqual(await x.service.confirm(input), {
      attemptId, status: "confirmed", providerSubscriptionId: "square-sub-1",
    });
    assert.deepEqual(x.operations, ["BEGIN", "SELECT", "INSERT", "UPDATE", "COMMIT"]);
    assert.deepEqual(x.args[1], [attemptId, "user-1", "saved-key", "a".repeat(64), "sandbox-loc", "premium-plan"]);
    assert.match(x.sql[1], /FOR UPDATE/);
    assert.match(x.sql[1], /status = 'submitting'/);
    assert.match(x.sql[1], /request_fingerprint = \$4/);
    assert.match(x.sql[2], /INSERT INTO wedding_square_subscriptions/);
    assert.match(x.sql[2], /ON CONFLICT DO NOTHING/);
    assert.deepEqual(x.args[2], [
      "user-1", "premium", "merchant-1", "sandbox-loc", "customer-1", "premium-plan",
      "square-sub-1", "card-1", saved.consented_at, WEDDING_CONSENT_VERSION, 2499,
      "2026-11-16", "PENDING",
    ]);
    assert.match(x.sql[3], /UPDATE wedding_square_enrollment_attempts/);
    assert.deepEqual(x.args[3], [
      attemptId, "user-1", "saved-key", "a".repeat(64), "square-sub-1", "sandbox-loc", "premium-plan",
    ]);
    assert.equal(x.released.length, 1);
    assert.equal(x.released[0], undefined);
    assert.doesNotMatch(x.sql[2], /verified_paid_through|payment_id|entitlement/i);
  }));

test("one failed or conflicting subscription record rolls back the confirmation", () =>
  sandbox(async () => {
    for (const option of [{ duplicate: true }, { fail: "insert" as const },
      { fail: "update" as const }, { wrongConfirmation: true },
      { fail: "commit" as const }]) {
      const x = fixture(option);
      await assert.rejects(x.service.confirm(input), WeddingSquareConfirmationPersistenceError);
      assert.ok(x.operations.includes("ROLLBACK"), JSON.stringify(option));
      assert.ok(!x.operations.includes("COMMIT") || option.fail === "commit");
      assert.ok(x.released[0] instanceof Error, "discard ambiguous connection");
    }
  }));

test("wrong consent, owner, price, merchant location or plan never inserts a subscription", () =>
  sandbox(async () => {
    for (const change of [
      { user_id: "another-user" }, { tier: "free" }, { tier: "elite" },
      { consented_amount_cents: 2500 }, { consented_currency: "EUR" },
      { consent_terms_version: "outdated" },
      { square_card_id: "" }, { square_customer_id: "wrong customer" },
      { requested_timezone: "America/New_York" },
      { square_location_id: "other-location" },
      { square_plan_variation_id: "other-plan" },
      { consented_at: "invalid" }, { requested_start_date: "tomorrow" },
    ]) {
      const x = fixture({ saved: { ...saved, ...change } });
      await assert.rejects(x.service.confirm(input), WeddingSquareConfirmationPersistenceError);
      assert.deepEqual(x.operations, ["BEGIN", "SELECT", "ROLLBACK"]);
    }
  }));

test("cannot write in production or without configured sandbox merchant", () =>
  sandbox(async () => {
    for (const [key, value] of [
      ["SQUARE_ENV", "production"],
      ["WEDDING_SQUARE_SANDBOX_ENROLLMENT_ENABLED", "false"],
      ["WEDDING_SQUARE_SANDBOX_MERCHANT_ID", ""],
      ["SQUARE_LOCATION_ID", "wrong-location"],
    ] as const) {
      const original = process.env[key];
      process.env[key] = value;
      try {
        const x = fixture();
        await assert.rejects(x.service.confirm(input), WeddingSquareConfirmationPersistenceError);
        assert.deepEqual(x.operations, []);
      } finally {
        if (original === undefined) delete process.env[key]; else process.env[key] = original;
      }
    }
  }));
test("no-trial immediate charge start remains NULL; Square ACTIVE is not paid evidence", () =>
  sandbox(async () => {
    const x = fixture({ saved: { ...saved, requested_start_date: null } });
    await x.service.confirm({ ...input, verifiedResponse: { ...response, providerStatus: "ACTIVE" } });
    assert.equal(x.args[2][11], null);
    assert.equal(x.args[2][12], "ACTIVE");
    assert.doesNotMatch(x.sql[2], /verified_paid_through/i);
  }));
