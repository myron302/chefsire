import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { test } from "node:test";
import express from "express";
import type { AddressInfo } from "node:net";
import {
  createWeddingSquareWebhookIntake,
  createWeddingSquareWebhookRouter,
  WeddingSquareWebhookIntakeError,
  type WeddingSquareWebhookSink,
} from "./wedding-square-webhook";

const url = "https://chefsire.com/api/wedding/subscription/webhooks/square";
const key = "wedding-signature-test-key-0123456789-abcdef";
const validEvent = {
  event_id: "event-1",
  type: "subscription.updated",
  merchant_id: "wedding-merchant",
  data: { object: { subscription: { status: "ACTIVE", customer_id: "UNTRUSTED" } } },
};
function sign(body: string, destination = url, secret = key) {
  return createHmac("sha256", secret).update(destination + body).digest("base64");
}
async function env<T>(run: () => Promise<T>): Promise<T> {
  const settings = {
    SQUARE_ENV: "sandbox",
    WEDDING_SQUARE_SANDBOX_ENROLLMENT_ENABLED: "true",
    WEDDING_SQUARE_SANDBOX_WEBHOOK_ENABLED: "true",
    WEDDING_SQUARE_SANDBOX_MERCHANT_ID: "wedding-merchant",
    WEDDING_SQUARE_WEBHOOK_NOTIFICATION_URL: url,
    WEDDING_SQUARE_WEBHOOK_SIGNATURE_KEY: key,
  };
  const before = Object.fromEntries(Object.keys(settings).map((k) => [k, process.env[k]]));
  Object.assign(process.env, settings);
  try { return await run(); }
  finally {
    for (const [name, value] of Object.entries(before)) {
      if (value === undefined) delete process.env[name]; else process.env[name] = value;
    }
  }
}
async function appTest(
  sink: WeddingSquareWebhookSink,
  run: (send: (body: string, signature?: string) => Promise<Response>) => Promise<void>,
) {
  const app = express();
  app.use(express.json({
    verify: (req, _res, bytes) => {
      (req as express.Request & { rawBody?: string }).rawBody = bytes.toString("utf8");
    },
  }));
  app.use("/api/wedding", createWeddingSquareWebhookRouter(sink));
  const server = app.listen(0, "127.0.0.1");
  await new Promise<void>((resolve) => server.once("listening", () => resolve()));
  try {
    const port = (server.address() as AddressInfo).port;
    await run((body, signature = sign(body)) => fetch(
      `http://127.0.0.1:${port}/api/wedding/subscription/webhooks/square`, {
        method: "POST", headers: {
          "Content-Type": "application/json",
          "x-square-hmacsha256-signature": signature,
        },
        body,
      },
    ));
  } finally {
    await new Promise<void>((resolve, reject) =>
      server.close((error) => error ? reject(error) : resolve()));
  }
}

test("real Square HMAC over raw body and configured HTTPS URL queues event, not entitlement", () =>
  env(async () => {
    const recorded: unknown[] = [];
    await appTest({ record: async (entry) => { recorded.push(entry); return "recorded"; } }, async (send) => {
      const response = await send(JSON.stringify(validEvent));
      assert.equal(response.status, 202);
      assert.deepEqual(await response.json(), { ok: true, queued: true });
      assert.equal(response.headers.get("cache-control"), "no-store");
    });
    assert.deepEqual(recorded, [{
      eventId: "event-1", eventType: "subscription.updated", merchantId: "wedding-merchant",
    }]);
    assert.equal("data" in (recorded[0] as object), false);
  }));

test("tampered body, signature key and configured notification URL reject without DB writes", () =>
  env(async () => {
    let calls = 0;
    await appTest({ record: async () => { calls++; return "recorded"; } }, async (send) => {
      const original = JSON.stringify(validEvent);
      const forged = JSON.stringify({ ...validEvent, event_id: "event-tampered" });
      assert.equal((await send(forged, sign(original))).status, 401);
      assert.equal((await send(original, sign(original, url, "different-secret"))).status, 401);
      assert.equal((await send(original, sign(original, "https://other.test/api/wedding/subscription/webhooks/square"))).status, 401);
      assert.equal((await send(original, "invalid-base64")).status, 401);
    });
    assert.equal(calls, 0);
  }));

test("cross-merchant payload is refused after signature validation", () =>
  env(async () => {
    let calls = 0;
    await appTest({ record: async () => { calls++; return "recorded"; } }, async (send) => {
      const body = JSON.stringify({ ...validEvent, merchant_id: "foreign-merchant" });
      assert.equal((await send(body)).status, 400);
      assert.equal((await send(JSON.stringify({ ...validEvent, event_id: "" }))).status, 400);
    });
    assert.equal(calls, 0);
  }));

test("signed unrelated event types are ignored, not enqueued as paid evidence", () =>
  env(async () => {
    let calls = 0;
    await appTest({ record: async () => { calls++; return "recorded"; } }, async (send) => {
      assert.equal((await send(JSON.stringify({ ...validEvent, type: "customer.updated" }))).status, 204);
    });
    assert.equal(calls, 0);
  }));

test("durable insert and unique duplicate acknowledgment use only event metadata", () =>
  env(async () => {
    const statements: { sql: string; params: string[] }[] = [];
    let seen = false;
    const service = createWeddingSquareWebhookIntake({
      query: async (sql, params) => {
        statements.push({ sql, params });
        if (seen) return { rowCount: 0 };
        seen = true;
        return { rowCount: 1 };
      },
    });
    const event = { eventId: "event-1", eventType: "invoice.payment_made", merchantId: "wedding-merchant" };
    assert.equal(await service.record(event), "recorded");
    assert.equal(await service.record(event), "duplicate");
    assert.equal(statements.length, 2);
    for (const entry of statements) {
      assert.match(entry.sql, /ON CONFLICT \(square_environment, square_merchant_id, event_id\) DO NOTHING/);
      assert.deepEqual(entry.params, ["event-1", "wedding-merchant", "invoice.payment_made"]);
      assert.doesNotMatch(entry.sql, /verified_paid_through|subscription_history/);
    }
  }));

test("failed or ambiguous Neon persistence causes 503, never 2xx acknowledgment", () =>
  env(async () => {
    for (const state of ["throw", "unknown"] as const) {
      const sink = createWeddingSquareWebhookIntake({
        query: async () => {
          if (state === "throw") throw new Error("private DB credentials");
          return { rowCount: null };
        },
      });
      await assert.rejects(sink.record({
        eventId: "event-1", eventType: "subscription.updated", merchantId: "wedding-merchant",
      }), (error: unknown) => {
        assert.ok(error instanceof WeddingSquareWebhookIntakeError);
        assert.doesNotMatch(error.message, /credentials|event-1/);
        return true;
      });
      await appTest(sink, async (send) => {
        const response = await send(JSON.stringify(validEvent));
        assert.equal(response.status, 503);
        assert.equal(response.headers.get("retry-after"), "5");
      });
    }
  }));

test("sandbox-only feature defaults OFF, including with valid signed requests", () =>
  env(async () => {
    for (const [name, value] of [
      ["WEDDING_SQUARE_SANDBOX_WEBHOOK_ENABLED", "false"],
      ["SQUARE_ENV", "production"],
      ["WEDDING_SQUARE_SANDBOX_ENROLLMENT_ENABLED", "false"],
      ["WEDDING_SQUARE_WEBHOOK_NOTIFICATION_URL", "http://chefsire.com/api/wedding/subscription/webhooks/square"],
      ["WEDDING_SQUARE_WEBHOOK_NOTIFICATION_URL", "https://other.test/incorrect"],
      ["WEDDING_SQUARE_WEBHOOK_SIGNATURE_KEY", ""],
      ["WEDDING_SQUARE_SANDBOX_MERCHANT_ID", ""],
    ] as const) {
      const previous = process.env[name]; process.env[name] = value;
      try {
        let calls = 0;
        await appTest({ record: async () => { calls++; return "recorded"; } }, async (send) => {
          assert.equal((await send(JSON.stringify(validEvent))).status, 503);
        });
        assert.equal(calls, 0);
      } finally {
        if (previous === undefined) delete process.env[name]; else process.env[name] = previous;
      }
    }
  }));
