import assert from "node:assert/strict";
import { test } from "node:test";
import { SquareClient, SquareEnvironment } from "square";
import {
  createWeddingSquareRawSubscriptionApi,
  WeddingSquareRawCreateError,
} from "./wedding-square-sandbox-subscription-http";

const request = {
  idempotencyKey: "durable-key",
  locationId: "location-1",
  planVariationId: "premium-plan",
  customerId: "customer-1",
  cardId: "card-1",
  timezone: "UTC",
  startDate: "2026-11-22",
} as const;
const raw = {
  subscription: {
    id: "sub-1", location_id: "location-1",
    plan_variation_id: "premium-plan", customer_id: "customer-1",
    card_id: "card-1", timezone: "UTC",
    start_date: "2026-11-22", status: "PENDING",
  },
};

async function sandbox(run: () => Promise<void>) {
  const names = ["SQUARE_ENV", "WEDDING_SQUARE_SANDBOX_ENROLLMENT_ENABLED", "SQUARE_ACCESS_TOKEN", "SQUARE_LOCATION_ID"] as const;
  const old = names.map((n) => process.env[n]);
  process.env.SQUARE_ENV = "sandbox";
  process.env.WEDDING_SQUARE_SANDBOX_ENROLLMENT_ENABLED = "true";
  process.env.SQUARE_ACCESS_TOKEN = "offline-only-token";
  process.env.SQUARE_LOCATION_ID = "location-1";
  try { await run(); } finally {
    names.forEach((n, i) => { if (old[i] === undefined) delete process.env[n]; else process.env[n] = old[i]; });
  }
}
function ok(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

test("raw Square REST POST preserves one exact SDK-v43 request and strict provider identity", () =>
  sandbox(async () => {
    const urls: string[] = [];
    const api = createWeddingSquareRawSubscriptionApi(async (url, init) => {
      urls.push(url);
      assert.equal(init.method, "POST");
      assert.equal((init.headers as Record<string, string>)["Square-Version"], "2025-10-16");
      assert.equal((init.headers as Record<string, string>).Authorization, "Bearer offline-only-token");
      assert.deepEqual(JSON.parse(String(init.body)), {
        idempotency_key: "durable-key", location_id: "location-1",
        plan_variation_id: "premium-plan", customer_id: "customer-1",
        card_id: "card-1", timezone: "UTC", start_date: "2026-11-22",
      });
      assert.ok(init.signal);
      return ok(raw);
    });
    const result = await api.create(request);
    assert.deepEqual(urls, ["https://connect.squareupsandbox.com/v2/subscriptions"]);
    assert.deepEqual(result, {
      subscription: {
        id: "sub-1", locationId: "location-1", planVariationId: "premium-plan",
        customerId: "customer-1", cardId: "card-1", timezone: "UTC",
        startDate: "2026-11-22", status: "PENDING",
      },
    });
    assert.equal(Object.isFrozen(result), true);
  }));

test("raw 2xx malformed errors are rejected BEFORE normalization (never confirmed)", () =>
  sandbox(async () => {
    for (const errorValue of [null, false, {}, "invalid", [null], [{ code: "INVALID_REQUEST_ERROR" }]]) {
      let requests = 0;
      const api = createWeddingSquareRawSubscriptionApi(async () => {
        requests++;
        return ok({ ...raw, errors: errorValue });
      });
      await assert.rejects(api.create(request), WeddingSquareRawCreateError);
      assert.equal(requests, 1);
    }
    // Fully absent errors and an explicitly empty errors array are both valid.
    for (const success of [raw, { ...raw, errors: [] }]) {
      const api = createWeddingSquareRawSubscriptionApi(async () => ok(success));
      assert.equal((await api.create(request)).subscription.id, "sub-1");
    }
  }));

test("real Square SDK v43 normalizes errors:null on a valid-looking 2xx envelope", async () => {
  // Confirms why the raw validation is necessary, not a speculative edge case.
  const previous = globalThis.fetch;
  let seen = 0;
  globalThis.fetch = async () => {
    seen++;
    return ok({
      errors: null, subscription: raw.subscription,
    });
  };
  try {
    const client = new SquareClient({
      token: "offline-test-only", environment: SquareEnvironment.Sandbox,
    });
    const normalized = await client.subscriptions.create({
      idempotencyKey: "offline-test-only", locationId: "location-1",
      planVariationId: "premium-plan", customerId: "customer-1",
      cardId: "card-1", timezone: "UTC", startDate: "2026-11-22",
    }, { maxRetries: 0 });
    assert.equal(seen, 1);
    assert.equal(normalized.errors, undefined);
    assert.equal(normalized.subscription?.id, "sub-1");
  } finally {
    globalThis.fetch = previous;
  }
});

test("no retries on transient status/timeout and no provider details leaked", () =>
  sandbox(async () => {
    for (const status of [400, 429, 500, 503]) {
      let calls = 0;
      const api = createWeddingSquareRawSubscriptionApi(async () => {
        calls++;
        return ok({ errors: [{ detail: "secret-token-card" }] }, status);
      });
      await assert.rejects(api.create(request), (error: unknown) => {
        assert.ok(error instanceof WeddingSquareRawCreateError);
        assert.doesNotMatch(error.message, /secret-token-card|customer-1|card-1/);
        return true;
      });
      assert.equal(calls, 1);
    }
    let calls = 0;
    const api = createWeddingSquareRawSubscriptionApi(async () => {
      calls++;
      throw new Error("unexpected secret token");
    });
    await assert.rejects(api.create(request), WeddingSquareRawCreateError);
    assert.equal(calls, 1);
  }));

test("malformed provider body, excessive response and invalid fields fail shut", () =>
  sandbox(async () => {
    const cases: Response[] = [
      new Response("not-json", { status: 200 }),
      ok({ subscription: { ...raw.subscription, id: null } }),
      ok({ subscription: { ...raw.subscription, status: "FAILED" } }),
      ok({ subscription: { ...raw.subscription, card_id: "" } }),
      new Response("x".repeat(65537), { status: 200 }),
      new Response(JSON.stringify(raw), { status: 200, headers: { "content-length": "999999" } }),
    ];
    for (const body of cases) {
      const api = createWeddingSquareRawSubscriptionApi(async () => body);
      await assert.rejects(api.create(request), WeddingSquareRawCreateError);
    }
  }));

test("no-trial Square requests omit start_date and never silently add a delayed charge date", () =>
  sandbox(async () => {
    const { startDate: _absent, ...withoutStart } = request;
    let body: Record<string, unknown> | undefined;
    const api = createWeddingSquareRawSubscriptionApi(async (_url, init) => {
      body = JSON.parse(String(init.body));
      return ok({ subscription: { ...raw.subscription, start_date: "2026-11-01" } });
    });
    await api.create(withoutStart as typeof request);
    assert.equal(body?.start_date, undefined);
  }));

test("production, disabled or invalid merchant/location/IDs send zero HTTP requests", () =>
  sandbox(async () => {
    for (const [name, value] of [
      ["SQUARE_ENV", "production"],
      ["WEDDING_SQUARE_SANDBOX_ENROLLMENT_ENABLED", "false"],
      ["SQUARE_ACCESS_TOKEN", ""],
      ["SQUARE_ACCESS_TOKEN", "bad token"],
      ["SQUARE_LOCATION_ID", "wrong-location"],
    ] as const) {
      const previous = process.env[name]; process.env[name] = value;
      try {
        let requests = 0;
        const api = createWeddingSquareRawSubscriptionApi(async () => {
          requests++;
          return ok(raw);
        });
        await assert.rejects(api.create(request), WeddingSquareRawCreateError);
        assert.equal(requests, 0);
      } finally {
        if (previous === undefined) delete process.env[name]; else process.env[name] = previous;
      }
    }
  }));
