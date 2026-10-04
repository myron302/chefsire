/**
 * Phase 2Q Gate 0 is connection security and readiness ONLY. These assertions keep it that way: nothing here may create a
 * Catering payment, a payment session or link, a Catering webhook, a processor refund, a payout or a platform fee.
 */
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const read = (file: string) => fs.readFileSync(path.join(root, file), "utf8");
const code = (source: string) => source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of fs.readdirSync(path.join(root, dir), { withFileTypes: true })) {
    const relative = path.posix.join(dir, entry.name);
    if (entry.isDirectory()) walk(relative, out);
    else if (/\.(ts|tsx)$/.test(entry.name)) out.push(relative);
  }
  return out;
}

const GATE0_SERVER = ["server/lib/secret-box.ts", "server/lib/square-integration.ts", "server/lib/square-connection-service.ts", "server/lib/square-connection.ts", "server/routes/square-connection.ts", "server/scripts/migrate-square-oauth-tokens.ts"];

test("no Catering source (server, shared or client) uses the Square connection, so no Catering payment path exists", () => {
  const catering = [...walk("server"), ...walk("shared"), ...walk("client/src")]
    .filter((file) => /catering/i.test(file) && !/\.test\.tsx?$/.test(file));
  assert.ok(catering.length > 20);
  for (const file of catering) {
    const body = code(read(file));
    for (const forbidden of ["square-connection", "square-integration", "secret-box", "getSquarePaymentReadiness", "squareConnections", "payment_methods"]) {
      assert.equal(body.includes(forbidden), false, `${file} references ${forbidden}`);
    }
  }
});

test("the Catering billing migrations and the payment ledger are untouched by Gate 0", () => {
  const migration = code(read("server/migrations/20261007_square_connection_hardening.sql").replace(/^--.*$/gm, ""));
  assert.doesNotMatch(migration, /catering_/i);
  assert.match(read("server/migrations/20260913_catering_booking_billing.sql"), /processor_payment_id varchar\(128\)/);
});

test("Gate 0 code creates no payment, checkout, refund, payout, webhook or platform fee", () => {
  for (const file of GATE0_SERVER) {
    const body = code(read(file));
    for (const forbidden of ["payments.create", "paymentLinks", "refundPayment", "refunds.", "payouts.", "appFeeMoney", "WebhooksHelper", "verifySignature", "processor_payment_id", "createPayment", "payment-session", "/webhook"]) {
      assert.equal(body.includes(forbidden), false, `${file} contains ${forbidden}`);
    }
  }
});

test("the new routes are exactly status, recheck and disconnect, and take no id of any kind", () => {
  const body = code(read("server/routes/square-connection.ts"));
  assert.deepEqual([...body.matchAll(/router\.(get|post|put|patch|delete)\("([^"]+)"/g)].map((match) => `${match[1]} ${match[2]}`), ["get /status", "post /recheck", "post /disconnect"]);
  assert.doesNotMatch(body, /req\.(params|body|query)/);
});

test("Gate 0 does not import payment logic from the drinks monolith", () => {
  for (const file of [...GATE0_SERVER, "server/lib/square-client.ts", "server/routes/payouts.ts"]) {
    assert.doesNotMatch(read(file), /from "\.\.?\/(?:routes\/)?drinks"/, file);
  }
});

test("no source anywhere still reaches for the legacy Square root exports that v43 does not have", () => {
  const legacy = /const\s*\{[^}]*\b(?:Client|Environment)\b[^}]*\}\s*=\s*square\b|\b(?:paymentsApi|refundsApi)\b\.|\.merchantsApi\b|\.locationsApi\b|\.oAuthApi\b/;
  const offenders = walk("server").filter((file) => !/\.test\.tsx?$/.test(file) && legacy.test(code(read(file))));
  // The marketplace code keeps the legacy CALL SHAPE (paymentsApi/refundsApi) on purpose, served by the adapter in
  // server/lib/square-client.ts; nothing else may.
  assert.deepEqual(offenders.sort(), ["server/routes/payments.ts", "server/services/marketplace-checkout-reconciliation.ts"]);
  assert.doesNotMatch(code(read("server/lib/square-client.ts")), /from "square";\s*\nconst \{/);
  assert.doesNotMatch(read("server/routes/payouts.ts"), /import square from "square"/);
});
