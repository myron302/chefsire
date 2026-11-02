import assert from "node:assert/strict";
import { test } from "node:test";
import { assessWeddingSquareSandboxReadiness } from "./wedding-square-sandbox-readiness.mjs";

const tables = ["wedding_square_enrollment_attempts", "wedding_square_subscriptions",
  "wedding_square_invoice_evidence", "wedding_square_webhook_events"];
const columns = [
  { table_name: "wedding_square_subscriptions", column_name: "last_renewal_scan_at" },
  { table_name: "wedding_square_subscriptions", column_name: "provider_status" },
  { table_name: "wedding_square_invoice_evidence", column_name: "last_payment_reconciled_at" },
  { table_name: "wedding_square_invoice_evidence", column_name: "payment_revoked_at" },
];
const env = {
  SQUARE_ENV: "sandbox",
  SQUARE_ACCESS_TOKEN: "sandbox-test-token",
  SQUARE_APPLICATION_ID: "sandbox-test-app",
  WEDDING_SQUARE_WEBHOOK_NOTIFICATION_URL: "https://chefsire.example/api/wedding/square/webhook",
  WEDDING_SQUARE_WEBHOOK_SIGNATURE_KEY: "sandbox-test-signature",
  SQUARE_LIVE_PAYMENTS_ENABLED: "false",
  WEDDING_SQUARE_SANDBOX_MERCHANT_ID: "merchant-test",
  SQUARE_LOCATION_ID: "location-test",
  WEDDING_SQUARE_SANDBOX_PREMIUM_PLAN_VARIATION_ID: "premium-test",
  WEDDING_SQUARE_SANDBOX_ELITE_PLAN_VARIATION_ID: "elite-test",
  WEDDING_SQUARE_ALLOWED_ORIGIN: "https://chefsire.example",
  WEDDING_SQUARE_SANDBOX_ENROLLMENT_ENABLED: "true",
  WEDDING_SQUARE_SANDBOX_SUBMIT_ENABLED: "true",
  WEDDING_SQUARE_SANDBOX_EVIDENCE_WRITE_ENABLED: "true",
  WEDDING_SQUARE_SANDBOX_RECONCILIATION_ENABLED: "true",
  WEDDING_SQUARE_SANDBOX_RECONCILIATION_BATCH_ENABLED: "true",
  WEDDING_SQUARE_SANDBOX_RENEWAL_SCAN_ENABLED: "true",
  WEDDING_SQUARE_VERIFIED_PAID_ENTITLEMENTS_ENABLED: "true",
};
const input = () => ({ env: { ...env }, tables: [...tables], columns: [...columns], counts: {} });

test("ready only means eligible to start acceptance, never payment verified", () => {
  const out = assessWeddingSquareSandboxReadiness(input());
  assert.equal(out.safeToAttemptSandboxAcceptance, true);
  assert.equal(out.sandboxTransactionVerified, false);
  assert.equal(out.liveBillingActivatedByAudit, false);
});
test("absent migration or a disabled reconciliation gate fails closed", () => {
  const x = input();
  x.columns = x.columns.slice(1);
  x.env.WEDDING_SQUARE_SANDBOX_RENEWAL_SCAN_ENABLED = "false";
  const out = assessWeddingSquareSandboxReadiness(x);
  assert.equal(out.safeToAttemptSandboxAcceptance, false);
  assert.match(out.blockers.join(" "), /last_renewal_scan_at/);
  assert.match(out.blockers.join(" "), /RENEWAL_SCAN_ENABLED/);
});
test("production and live flag are always blocked", () => {
  const x = input();
  x.env.SQUARE_ENV = "production";
  x.env.SQUARE_LIVE_PAYMENTS_ENABLED = "true";
  assert.equal(assessWeddingSquareSandboxReadiness(x).safeToAttemptSandboxAcceptance, false);
});
test("reject noncanonical origin without ever printing confidential values", () => {
  const x = input();
  x.env.WEDDING_SQUARE_ALLOWED_ORIGIN = "https://wrong.example/path?token=confidential";
  const out = assessWeddingSquareSandboxReadiness(x);
  assert.equal(out.safeToAttemptSandboxAcceptance, false);
  assert.doesNotMatch(JSON.stringify(out), /confidential|wrong.example/);
});
test("the audit reports counts without exposing individual owner rows", () => {
  const x = input();
  x.counts = { wedding_square_subscriptions: 3 };
  const out = assessWeddingSquareSandboxReadiness(x);
  assert.equal(out.rowCounts.wedding_square_subscriptions, 3);
  assert.equal(out.rowCounts.wedding_square_webhook_events, 0);
});
