/**
 * Catering Square checkout readiness: checkout is enabled only when Square is the SANDBOX and the Catering webhook -- the durable server-side
 * completion path -- is configured with a valid https notification URL and a signature key. One contract, shared with the webhook route.
 */
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { cateringSquarePaymentsEnabled, cateringSquareSandboxReady, cateringSquareWebhookConfig } from "./square-checkout";

const URL_KEY = "SQUARE_CATERING_WEBHOOK_NOTIFICATION_URL";
const SECRET_KEY = "SQUARE_CATERING_WEBHOOK_SIGNATURE_KEY";
const VALID_URL = "https://chefsire.example/api/catering/webhooks/square";
const SECRET = "very-secret-signature-key-value";
const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "..");

function withEnv(values: Record<string, string | undefined>, fn: () => void) {
  const saved = Object.fromEntries(Object.keys(values).map((key) => [key, process.env[key]]));
  try {
    for (const [key, value] of Object.entries(values)) { if (value === undefined) delete process.env[key]; else process.env[key] = value; }
    fn();
  } finally {
    for (const [key, value] of Object.entries(saved)) { if (value === undefined) delete process.env[key]; else process.env[key] = value; }
  }
}
const sandbox = { SQUARE_ENV: "sandbox" };

test("Sandbox + a valid https webhook URL + a signature key: Catering Square payments are enabled", () => {
  withEnv({ ...sandbox, [URL_KEY]: VALID_URL, [SECRET_KEY]: SECRET }, () => {
    assert.equal(cateringSquarePaymentsEnabled(), true);
    assert.deepEqual(cateringSquareWebhookConfig(), { signatureKey: SECRET, notificationUrl: VALID_URL }, "the exact configured URL, untouched");
  });
});

test("a missing webhook notification URL disables checkout", () => {
  withEnv({ ...sandbox, [URL_KEY]: undefined, [SECRET_KEY]: SECRET }, () => assert.equal(cateringSquarePaymentsEnabled(), false));
  withEnv({ ...sandbox, [URL_KEY]: "   ", [SECRET_KEY]: SECRET }, () => assert.equal(cateringSquarePaymentsEnabled(), false));
});

test("a missing webhook signature key disables checkout", () => {
  withEnv({ ...sandbox, [URL_KEY]: VALID_URL, [SECRET_KEY]: undefined }, () => assert.equal(cateringSquarePaymentsEnabled(), false));
  withEnv({ ...sandbox, [URL_KEY]: VALID_URL, [SECRET_KEY]: "" }, () => assert.equal(cateringSquarePaymentsEnabled(), false));
});

test("a malformed, relative, non-https or credential-bearing webhook URL disables checkout", () => {
  for (const bad of ["not a url", "/api/catering/webhooks/square", "chefsire.example/api", "http://chefsire.example/api/catering/webhooks/square", "ftp://chefsire.example/x", "https://user:pw@chefsire.example/x", "https://chefsire.example/x#frag", "https://"]) {
    withEnv({ ...sandbox, [URL_KEY]: bad, [SECRET_KEY]: SECRET }, () => {
      assert.equal(cateringSquareWebhookConfig(), null, bad);
      assert.equal(cateringSquarePaymentsEnabled(), false, bad);
    });
  }
});

test("production Square stays disabled even with a complete webhook configuration, and an invalid environment name fails closed", () => {
  withEnv({ SQUARE_ENV: "production", [URL_KEY]: VALID_URL, [SECRET_KEY]: SECRET }, () => {
    assert.equal(cateringSquarePaymentsEnabled(), false);
    assert.equal(cateringSquareSandboxReady(), false);
  });
  withEnv({ SQUARE_ENV: "staging", [URL_KEY]: VALID_URL, [SECRET_KEY]: SECRET }, () => assert.equal(cateringSquarePaymentsEnabled(), false));
});

test("cleanup and settlement of what already exists need only the sandbox: missing webhook configuration never stops closing a live link", () => {
  withEnv({ ...sandbox, [URL_KEY]: undefined, [SECRET_KEY]: undefined }, () => {
    assert.equal(cateringSquareSandboxReady(), true);
    assert.equal(cateringSquarePaymentsEnabled(), false);
  });
});

test("the webhook secret is never logged or returned by the readiness helpers", () => {
  const captured: string[] = [];
  const originals = { log: console.log, warn: console.warn, error: console.error, info: console.info };
  console.log = console.warn = console.error = console.info = (...args: unknown[]) => { captured.push(args.map(String).join(" ")); };
  try {
    withEnv({ ...sandbox, [URL_KEY]: "http://bad", [SECRET_KEY]: SECRET }, () => { cateringSquarePaymentsEnabled(); cateringSquareWebhookConfig(); });
    withEnv({ ...sandbox, [URL_KEY]: VALID_URL, [SECRET_KEY]: SECRET }, () => { assert.equal(typeof cateringSquarePaymentsEnabled(), "boolean"); });
  } finally { Object.assign(console, originals); }
  assert.equal(captured.join("\n").includes(SECRET), false);
  withEnv({ ...sandbox, [URL_KEY]: "http://bad", [SECRET_KEY]: SECRET }, () => assert.equal(JSON.stringify(cateringSquareWebhookConfig()).includes(SECRET), false, "invalid config returns nothing"));
});

test("the webhook route and the readiness helper use ONE config contract; the billing view and pay path both ask the same readiness", () => {
  const read = (relative: string) => fs.readFileSync(path.join(root, relative), "utf8");
  const route = read("server/routes/catering-square-payments.ts");
  assert.ok(route.includes("cateringSquareWebhookConfig") && route.includes("../lib/square-checkout"));
  assert.equal(route.includes("process.env.SQUARE_CATERING_WEBHOOK"), false, "the route does not read the variables itself");
  assert.ok(route.includes("const config = webhookConfig();") && route.includes("notificationUrl: config.notificationUrl"), "verification uses the exact configured URL");
  const billing = read("server/routes/catering-booking-billing.ts");
  assert.ok(billing.includes("squareCheckout: { enabled: cateringSquarePaymentsEnabled() }"), "the billing view advertises checkout only when it is really available");
  const service = read("server/services/catering-square-payments.ts");
  assert.ok(service.includes('if (!enabled()) return { kind: "unavailable" };'), "creating a payment refuses first");
});
