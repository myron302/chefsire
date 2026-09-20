import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { isVerifiedMarketplaceEarning, requireCompletedSquarePayment } from "../lib/marketplace-payment";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const ordersRoute = fs.readFileSync(path.join(root, "server/routes/orders.ts"), "utf8");
const paymentsRoute = fs.readFileSync(path.join(root, "server/routes/payments.ts"), "utf8");
const payoutRoute = fs.readFileSync(path.join(root, "server/routes/payouts.ts"), "utf8");
const schema = fs.readFileSync(path.join(root, "shared/schema/domains/commerce-billing.ts"), "utf8");
const migration = fs.readFileSync(path.join(root, "server/migrations/20260920_marketplace_payment_fulfillment.sql"), "utf8");

test("delivered without provider evidence is not verified earnings", () => {
  assert.equal(isVerifiedMarketplaceEarning({ paymentStatus: "unverified" }), false);
  assert.equal(isVerifiedMarketplaceEarning({
    paymentStatus: "captured",
    paymentProvider: "square",
    squarePaymentId: "payment-1",
    providerPaymentStatus: "COMPLETED",
    paymentCapturedAt: new Date(),
  }), true);
  assert.match(ordersRoute, /verifiedSales = sales\.filter/);
  assert.doesNotMatch(ordersRoute, /status\s*===\s*["']delivered["'][\s\S]{0,80}(?:Revenue|earning|payout)/i);
});

test("fulfillment input is strict and cannot mass-assign payment evidence", () => {
  assert.match(ordersRoute, /trackingNumber:[\s\S]*?\.strict\(\)/);
  assert.doesNotMatch(ordersRoute.slice(ordersRoute.indexOf('router.patch("/:id/status"')), /paymentStatus\s*[,}]/);
  assert.doesNotMatch(ordersRoute.slice(ordersRoute.indexOf('router.patch("/:id/status"')), /squarePaymentId\s*[,}]/);
});

test("only the owning seller can update fulfillment and concurrent changes fail", () => {
  assert.match(ordersRoute, /order\.sellerId !== userId/);
  assert.match(ordersRoute, /and\(eq\(orders\.id, orderId\), eq\(orders\.status, order\.status!\)\)/);
  assert.match(ordersRoute, /FULFILLMENT_STATE_CONFLICT/);
});

test("Square capture evidence must match status, amount, currency and timestamp", () => {
  const evidence = requireCompletedSquarePayment({
    id: "square-payment",
    status: "COMPLETED",
    totalMoney: { amount: 1234n, currency: "USD" },
    createdAt: "2026-09-20T00:00:00.000Z",
  }, 1234n);
  assert.equal(evidence.paymentStatus, "captured");
  for (const invalid of [
    { id: "square-payment", status: "APPROVED", totalMoney: { amount: 1234n, currency: "USD" }, createdAt: "2026-09-20T00:00:00.000Z" },
    { id: "square-payment", status: "COMPLETED", totalMoney: { amount: 1n, currency: "USD" }, createdAt: "2026-09-20T00:00:00.000Z" },
    { id: "square-payment", status: "COMPLETED", totalMoney: { amount: 1234n, currency: "CAD" }, createdAt: "2026-09-20T00:00:00.000Z" },
  ]) assert.throws(() => requireCompletedSquarePayment(invalid, 1234n), /verifiable/);
});

test("payment capture fails closed without Square and has no simulation fallback", () => {
  assert.match(paymentsRoute, /PAYMENT_PROVIDER_UNAVAILABLE/);
  assert.doesNotMatch(paymentsRoute, /sq_payment_sim|using simulation|status:\s*["']paid["']/);
  assert.match(paymentsRoute, /eq\(orders\.paymentStatus, "unverified"\)/);
  assert.match(paymentsRoute, /db\.transaction/);
});

test("database and legacy migration require evidence for captured state", () => {
  for (const source of [schema, migration]) {
    assert.match(source, /orders_captured_payment_evidence_check/);
    assert.match(source, /payment_(?:status|Status)[^]*captured/);
    assert.match(source, /square_(?:payment_id|PaymentId)|squarePaymentId/);
    assert.match(source, /COMPLETED/);
  }
  assert.match(migration, /DEFAULT 'unverified'/);
  assert.match(migration, /NOT VALID/);
  assert.doesNotMatch(migration, /\b(?:DELETE|UPDATE)\s+(?:FROM\s+)?orders\b/i);
});

test("PR #1293 payout execution containment remains fail closed", () => {
  assert.match(payoutRoute, /PAYOUT_ELIGIBILITY_UNVERIFIABLE/);
  assert.match(payoutRoute, /rejectUnavailablePayout/);
  assert.doesNotMatch(payoutRoute, /payout_(?:sim|\$\{Date\.now)/);
});
