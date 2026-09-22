import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { buildSquareRefundRequest, canonicalizeMarketplaceRefundReason, CAPTURE_RECONCILIATION_CLOCK_SKEW_MS, findSquarePaymentByReference, getCaptureReconciliationWindow, getDefinitiveSquarePaymentFailure, getDefinitiveSquareRefundFailure, hasLegacyPaymentIndicators, isVerifiedMarketplaceEarning, requireCompletedSquarePayment, requireSquareRefundEvidence } from "../lib/marketplace-payment";
import { executeRecoverableProviderOperation, ProviderReconciliationRequiredError } from "../lib/provider-reconciliation";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const ordersRoute = fs.readFileSync(path.join(root, "server/routes/orders.ts"), "utf8");
const paymentsRoute = fs.readFileSync(path.join(root, "server/routes/payments.ts"), "utf8");
const payoutRoute = fs.readFileSync(path.join(root, "server/routes/payouts.ts"), "utf8");
const schema = fs.readFileSync(path.join(root, "shared/schema/domains/commerce-billing.ts"), "utf8");
const migration = fs.readFileSync(path.join(root, "server/migrations/20260920_marketplace_payment_fulfillment.sql"), "utf8");
const pushSchema = fs.readFileSync(path.join(root, "server/scripts/push-schema.ts"), "utf8");
const revenueEnforcement = fs.readFileSync(path.join(root, "server/scripts/enforce-marketplace-revenue-integrity.ts"), "utf8");

test("delivered without provider evidence is not verified earnings", () => {
  assert.equal(isVerifiedMarketplaceEarning({ paymentStatus: "unverified" }), false);
  assert.equal(isVerifiedMarketplaceEarning({
    paymentStatus: "captured",
    paymentProvider: "square",
    squarePaymentId: "payment-1",
    providerPaymentStatus: "COMPLETED",
    paymentCapturedAt: new Date(),
    sellerRevenueStatus: "credited",
  }), true);
  assert.match(ordersRoute, /verifiedSales = sales\.filter/);
  assert.doesNotMatch(ordersRoute, /status\s*===\s*["']delivered["'][\s\S]{0,80}(?:Revenue|earning|payout)/i);
});

test("store stats shares the verified marketplace earning boundary", () => {
  const storesRoute = fs.readFileSync(path.join(root, "server/routes/stores-crud.ts"), "utf8");
  assert.match(storesRoute, /verifiedMarketplaceEarningWhere\(orders\)/);
  for (const paymentStatus of ["unverified", "capture_pending", "capture_reconciliation", "refund_pending", "refund_reconciliation", "refunded"]) {
    assert.equal(isVerifiedMarketplaceEarning({ paymentStatus, sellerRevenueStatus: "credited" }), false);
  }
  assert.equal(isVerifiedMarketplaceEarning({
    paymentStatus: "captured", paymentProvider: "square", squarePaymentId: "p",
    providerPaymentStatus: "COMPLETED", paymentCapturedAt: new Date(), sellerRevenueStatus: "credited",
  }), true);
  assert.equal(isVerifiedMarketplaceEarning({
    paymentStatus: "captured", paymentProvider: "square", squarePaymentId: "p",
    providerPaymentStatus: "COMPLETED", paymentCapturedAt: new Date(), sellerRevenueStatus: "legacy_unverified",
  }), false);
});

test("fulfillment input is strict and cannot mass-assign payment evidence", () => {
  assert.match(ordersRoute, /trackingNumber:[\s\S]*?\.strict\(\)/);
  const routeStart = ordersRoute.indexOf('router.patch("/:id/status"');
  const fulfillmentSet = ordersRoute.slice(
    ordersRoute.indexOf(".set({", routeStart),
    ordersRoute.indexOf(".where(and(", routeStart),
  );
  assert.doesNotMatch(fulfillmentSet, /paymentStatus|squarePaymentId|squareRefundId|paymentCapturedAt/);
});

test("only the owning seller can update fulfillment and concurrent changes fail", () => {
  assert.match(ordersRoute, /order\.sellerId !== userId/);
  assert.match(ordersRoute, /eq\(orders\.status, order\.status!\)/);
  assert.match(ordersRoute, /FULFILLMENT_STATE_CONFLICT/);
  assert.match(ordersRoute, /cancellablePaymentStates = \["unverified", "refunded"\]/);
  assert.match(ordersRoute, /inArray\(orders\.paymentStatus, cancellablePaymentStates\)/);
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

test("all fallible local capture preparation precedes capture_pending", () => {
  const pendingWrite = paymentsRoute.indexOf('paymentStatus: "capture_pending"');
  assert.ok(paymentsRoute.indexOf('if (!seller)', paymentsRoute.indexOf('router.post("/create-payment"')) < pendingWrite);
  assert.ok(paymentsRoute.indexOf('getSquareClient()', paymentsRoute.indexOf('router.post("/create-payment"')) < pendingWrite);
  assert.ok(paymentsRoute.indexOf('PAYMENT_AMOUNT_INVALID', paymentsRoute.indexOf('router.post("/create-payment"')) < pendingWrite);
  assert.ok(paymentsRoute.indexOf('LEGACY_REVENUE_RECONCILIATION_REQUIRED') < pendingWrite);
  assert.match(paymentsRoute, /if \(!isNewCaptureAttempt\)[\s\S]*CAPTURE_OUTCOME_AMBIGUOUS/);
  assert.doesNotMatch(paymentsRoute, /CAPTURE_OUTCOME_AMBIGUOUS[\s\S]{0,400}paymentStatus: "unverified"/);
});

test("seller revenue accounting is order-scoped and exactly once", () => {
  assert.match(paymentsRoute, /sellerRevenueStatus: "credited"[\s\S]*eq\(orders\.sellerRevenueStatus, "uncredited"\)/);
  assert.match(paymentsRoute, /sellerRevenueStatus: "reversed"[\s\S]*eq\(orders\.sellerRevenueStatus, "credited"\)/);
  assert.match(paymentsRoute, /LEGACY_REVENUE_RECONCILIATION_REQUIRED/);
  assert.match(migration, /seller_revenue_status = CASE[\s\S]*legacy_unverified/);
  assert.match(migration, /payment_status IN \('captured', 'refund_pending'\) THEN 'credited'/);
  assert.match(migration, /payment_status = 'refunded' THEN 'reversed'/);
  assert.doesNotMatch(migration, /(?:DELETE|UPDATE)\s+commissions/i);
});

test("db push classifies legacy revenue before and after Drizzle synchronization", () => {
  const pre = pushSchema.indexOf('enforce-marketplace-revenue-integrity.ts", "--allow-missing"');
  const drizzle = pushSchema.indexOf('drizzle-kit", "push"');
  const post = pushSchema.lastIndexOf('enforce-marketplace-revenue-integrity.ts"');
  assert.ok(pre >= 0 && pre < drizzle && post > drizzle);
  assert.match(revenueEnforcement, /ADD COLUMN IF NOT EXISTS seller_revenue_status text/);
  assert.match(revenueEnforcement, /legacy_unverified/);
  assert.match(revenueEnforcement, /WHERE seller_revenue_status IS NULL/);
  assert.match(revenueEnforcement, /SET DEFAULT 'uncredited'/);
  assert.match(revenueEnforcement, /SET NOT NULL/);
});

async function simulateInterruptedOperation(operation: "capture" | "refund") {
  const providerOperations = new Map<string, { id: string }>();
  let providerSideEffects = 0;
  let localSideEffects = 0;
  let durableProviderEvidence: { id: string } | undefined;
  let failApply = true;
  const idempotencyKey = `${operation}-stable-key`;
  const run = () => executeRecoverableProviderOperation({
    operation,
    idempotencyKey,
    invokeProvider: async (key) => {
      if (!providerOperations.has(key)) {
        providerOperations.set(key, { id: `${operation}-provider-id` });
        providerSideEffects++;
      }
      return providerOperations.get(key)!;
    },
    persistProviderEvidence: async (evidence) => {
      durableProviderEvidence = evidence;
      return evidence;
    },
    applyLocally: async (evidence) => {
      if (failApply) {
        failApply = false;
        throw new Error("simulated local transaction rollback");
      }
      localSideEffects++;
      return evidence;
    },
  });

  await assert.rejects(run(), ProviderReconciliationRequiredError);
  assert.equal(durableProviderEvidence?.id, `${operation}-provider-id`, "provider evidence must survive local accounting failure");
  const recovered = await run();
  assert.equal(recovered.id, `${operation}-provider-id`);
  assert.equal(providerSideEffects, 1, "stable key must not duplicate the provider operation");
  assert.equal(localSideEffects, 1, "reconciliation must apply local accounting once");
}

test("capture provider success survives local failure and retries without a second charge", async () => {
  await simulateInterruptedOperation("capture");
  assert.match(paymentsRoute, /paymentStatus: "capture_pending"/);
  assert.match(paymentsRoute, /paymentStatus: "capture_reconciliation"/);
  assert.match(paymentsRoute, /captureIdempotencyKey/);
});

test("capture_pending reconciles by provider reference and never replays a new source", () => {
  assert.match(paymentsRoute, /if \(!isNewCaptureAttempt\)[\s\S]*findSquarePaymentByReference\([\s\S]*referenceId: order\.captureIdempotencyKey/);
  assert.match(paymentsRoute, /if \(!isNewCaptureAttempt\)[\s\S]*CAPTURE_OUTCOME_AMBIGUOUS[\s\S]*createPayment\(/);
  assert.match(paymentsRoute, /referenceId: captureIdempotencyKey/);
  assert.doesNotMatch(paymentsRoute, /capture_pending[\s\S]{0,500}createPayment\([\s\S]{0,200}sourceId/);
});

test("capture reconciliation follows every Square cursor and trusts only its reference", async () => {
  const target = { id: "target", referenceId: "capture-ref", status: "COMPLETED" };
  const firstPage = await findSquarePaymentByReference({
    referenceId: "capture-ref",
    listPage: async () => ({ payments: [target] }),
  });
  assert.equal(firstPage?.id, "target");

  const visited: Array<string | undefined> = [];
  const laterPage = await findSquarePaymentByReference({
    referenceId: "capture-ref",
    listPage: async (cursor) => {
      visited.push(cursor);
      return cursor
        ? { payments: [{ id: "same-amount-2", referenceId: "other-2" }, target] }
        : { payments: [{ id: "same-amount-1", referenceId: "other-1" }], cursor: "page-2" };
    },
  });
  assert.equal(laterPage?.id, "target");
  assert.deepEqual(visited, [undefined, "page-2"]);

  const exhausted = await findSquarePaymentByReference({
    referenceId: "capture-ref",
    listPage: async (cursor) => cursor
      ? { payments: [{ id: "unrelated-2", referenceId: "other-2" }] }
      : { payments: [{ id: "unrelated-1", referenceId: "other-1" }], cursor: "last" },
  });
  assert.equal(exhausted, null);

  await assert.rejects(findSquarePaymentByReference({
    referenceId: "capture-ref",
    listPage: async (cursor) => {
      if (cursor) throw new Error("provider pagination failed");
      return { payments: [{ id: "unrelated", referenceId: "other" }], cursor: "page-2" };
    },
  }), /pagination failed/);
});

test("capture reconciliation uses a bounded clock-skew window without weakening identity", async () => {
  const attemptedAt = new Date("2026-09-22T12:00:00.000Z");
  const window = getCaptureReconciliationWindow(attemptedAt);
  assert.equal(Date.parse(window.beginTime), attemptedAt.getTime() - CAPTURE_RECONCILIATION_CLOCK_SKEW_MS);
  assert.equal(Date.parse(window.endTime), attemptedAt.getTime() + CAPTURE_RECONCILIATION_CLOCK_SKEW_MS);
  assert.equal(Date.parse(window.endTime) - Date.parse(window.beginTime), 2 * CAPTURE_RECONCILIATION_CLOCK_SKEW_MS);

  const skewedMatchingPayment = {
    id: "matching-payment",
    referenceId: "capture-reference",
    status: "COMPLETED",
    createdAt: "2026-09-22T11:59:30.000Z",
    totalMoney: { amount: 1234n, currency: "USD" },
  };
  assert.ok(Date.parse(skewedMatchingPayment.createdAt) < attemptedAt.getTime());
  const visited: Array<string | undefined> = [];
  const matched = await findSquarePaymentByReference({
    referenceId: "capture-reference",
    listPage: async (cursor) => {
      visited.push(cursor);
      return cursor
        ? { payments: [skewedMatchingPayment] }
        : { payments: [{ ...skewedMatchingPayment, id: "unrelated", referenceId: "another-reference" }], cursor: "next" };
    },
  });
  assert.equal(matched?.id, "matching-payment");
  assert.deepEqual(visited, [undefined, "next"]);
  assert.equal(requireCompletedSquarePayment(matched, 1234n).squarePaymentId, "matching-payment");

  assert.match(paymentsRoute, /getCaptureReconciliationWindow\(order\.captureAttemptedAt\)/);
  assert.match(paymentsRoute, /reconciliationWindow\.beginTime,[\s\S]*reconciliationWindow\.endTime/);
});

test("ambiguous capture remains blocked while definitive decline releases a new attempt", () => {
  const decline = { errors: [{ category: "PAYMENT_METHOD_ERROR", code: "CARD_DECLINED" }] };
  const timeout = { errors: [{ category: "API_ERROR", code: "GATEWAY_TIMEOUT" }] };
  assert.equal(getDefinitiveSquarePaymentFailure(decline), "CARD_DECLINED");
  assert.equal(getDefinitiveSquarePaymentFailure({ errors: [{ category: "PAYMENT_METHOD_ERROR", code: "CARD_DECLINED_VERIFICATION_REQUIRED" }] }), "CARD_DECLINED_VERIFICATION_REQUIRED");
  assert.equal(getDefinitiveSquarePaymentFailure({ errors: [{ category: "PAYMENT_METHOD_ERROR", code: "CARD_NOT_SUPPORTED" }] }), "CARD_NOT_SUPPORTED");
  assert.equal(getDefinitiveSquarePaymentFailure(timeout), null);
  assert.equal(getDefinitiveSquarePaymentFailure(new Error("network reset")), null);
  assert.match(paymentsRoute, /lastPaymentFailureCode: definitiveFailure/);
  assert.match(paymentsRoute, /captureIdempotencyKey: null/);
  assert.match(paymentsRoute, /code: "PAYMENT_DECLINED"/);
  assert.match(paymentsRoute, /original Square capture outcome is ambiguous; a new charge is blocked/);
});

test("legacy possibly-paid orders cannot enter a fresh capture", () => {
  assert.match(paymentsRoute, /hasLegacyPaymentIndicators\(order\)/);
  assert.match(paymentsRoute, /LEGACY_PAYMENT_RECONCILIATION_REQUIRED/);
  assert.equal(isVerifiedMarketplaceEarning({ paymentStatus: "unverified", squarePaymentId: "legacy" }), false);
});

test("capture and cancellation share one legacy possibly-paid classification", () => {
  assert.equal(hasLegacyPaymentIndicators({ status: "pending", squarePaymentId: null }), false);
  assert.equal(hasLegacyPaymentIndicators({ status: "paid", squarePaymentId: null }), true);
  assert.equal(hasLegacyPaymentIndicators({ status: "pending", squarePaymentId: "square-legacy" }), true);
  assert.equal(hasLegacyPaymentIndicators({ status: "delivered", squarePaymentId: "  " }), true);
  assert.match(paymentsRoute, /paymentStatus === "unverified" && hasLegacyPaymentIndicators\(order\)/);
  assert.match(ordersRoute, /paymentStatus === "unverified" && hasLegacyPaymentIndicators\(order\)/);
  assert.match(ordersRoute, /LEGACY_PAYMENT_RECONCILIATION_REQUIRED/);
});

test("refund provider success survives local failure and retries one logical refund", async () => {
  await simulateInterruptedOperation("refund");
  assert.match(paymentsRoute, /paymentStatus: "refund_pending"/);
  assert.match(paymentsRoute, /paymentStatus: "refund_reconciliation"/);
  assert.match(paymentsRoute, /refundIdempotencyKey/);
  assert.doesNotMatch(paymentsRoute, /refund[^\n]*Date\.now|Date\.now[^\n]*refund/);
});

test("refund retries reconstruct one immutable provider request from durable state", () => {
  assert.equal(canonicalizeMarketplaceRefundReason("  Item unavailable  "), "Item unavailable");
  assert.equal(canonicalizeMarketplaceRefundReason(undefined), "Customer requested refund");
  assert.throws(() => canonicalizeMarketplaceRefundReason("x".repeat(193)), /at most 192/);

  const durableAttempt = {
    refundIdempotencyKey: "refund-key-1",
    refundAttemptPaymentId: "payment-1",
    refundAttemptAmountCents: 1234,
    refundAttemptCurrency: "USD",
    refundAttemptReason: "Customer requested refund",
  };
  const first = buildSquareRefundRequest(durableAttempt);
  // Retry HTTP bodies are deliberately not inputs to the request builder.
  assert.deepEqual(buildSquareRefundRequest(durableAttempt), first);
  assert.deepEqual(buildSquareRefundRequest(durableAttempt), first);
  assert.deepEqual(first, {
    idempotencyKey: "refund-key-1",
    paymentId: "payment-1",
    amountMoney: { amount: 1234n, currency: "USD" },
    reason: "Customer requested refund",
  });
  assert.throws(() => buildSquareRefundRequest({ ...durableAttempt, refundAttemptReason: null }), /immutable provider request/);

  assert.match(paymentsRoute, /refundIdempotencyKey,[\s\S]*refundAttemptPaymentId: order\.squarePaymentId,[\s\S]*refundAttemptAmountCents: fullRefundAmountCents,[\s\S]*refundAttemptCurrency: "USD",[\s\S]*refundAttemptReason/);
  assert.match(paymentsRoute, /refundPayment\(refundRequest\)/);
  assert.doesNotMatch(paymentsRoute, /refundPayment\([\s\S]{0,300}reason\s*:\s*reason/);
  assert.match(paymentsRoute, /refundAttemptReason: null/);
  for (const field of ["refund_attempt_payment_id", "refund_attempt_amount_cents", "refund_attempt_currency", "refund_attempt_reason"]) {
    assert.match(migration, new RegExp(field));
  }
});

test("pending Square refunds retain provider evidence and remain non-earning", () => {
  const evidence = requireSquareRefundEvidence({
    id: "square-refund",
    status: "PENDING",
    amountMoney: { amount: 1234n, currency: "USD" },
  }, 1234n);
  assert.equal(evidence.providerRefundStatus, "PENDING");
  assert.match(paymentsRoute, /squareRefundId: refundEvidence\.squareRefundId/);
  assert.match(paymentsRoute, /getPaymentRefund\(order\.squareRefundId\)/);
  assert.equal(isVerifiedMarketplaceEarning({ paymentStatus: "refund_pending" }), false);
});

test("terminal failed refunds restore captured and release a new logical attempt", () => {
  for (const status of ["FAILED", "REJECTED"] as const) {
    const evidence = requireSquareRefundEvidence({
      id: `refund-${status}`,
      status,
      amountMoney: { amount: 1234n, currency: "USD" },
    }, 1234n);
    assert.equal(evidence.providerRefundStatus, status);
  }
  assert.match(paymentsRoute, /paymentStatus: "captured"[\s\S]*providerPaymentStatus: "COMPLETED"/);
  assert.match(paymentsRoute, /refundIdempotencyKey: null/);
  assert.match(paymentsRoute, /lastFailedRefundId: refundEvidence\.squareRefundId/);
  assert.match(paymentsRoute, /code: "REFUND_FAILED"/);
  assert.throws(() => requireSquareRefundEvidence({
    id: "unknown-refund",
    status: "UNKNOWN",
    amountMoney: { amount: 1234n, currency: "USD" },
  }, 1234n), /ambiguous/);
});

test("synchronous refund rejection releases only provider-confirmed terminal errors", () => {
  for (const code of ["PAYMENT_NOT_REFUNDABLE", "REFUND_AMOUNT_INVALID", "REFUND_DECLINED"]) {
    assert.equal(getDefinitiveSquareRefundFailure({ errors: [{ category: "REFUND_ERROR", code }] }), code);
  }
  assert.equal(getDefinitiveSquareRefundFailure({ errors: [{ category: "API_ERROR", code: "GATEWAY_TIMEOUT" }] }), null);
  assert.equal(getDefinitiveSquareRefundFailure({ errors: [{ category: "REFUND_ERROR", code: "REFUND_ALREADY_PENDING" }] }), null);
  assert.match(paymentsRoute, /code: "REFUND_REJECTED"/);
  assert.match(paymentsRoute, /lastRefundFailureStatus: definitiveFailure/);
});

test("fulfillment cancellation distinguishes unpaid, captured, pending refund and completed refund", () => {
  assert.match(ordersRoute, /cancellablePaymentStates = \["unverified", "refunded"\]/);
  assert.doesNotMatch(ordersRoute, /cancellablePaymentStates[^\n]*captured/);
  assert.doesNotMatch(ordersRoute, /cancellablePaymentStates[^\n]*refund_pending/);
  const routeStart = ordersRoute.indexOf('router.patch("/:id/status"');
  const fulfillmentSet = ordersRoute.slice(
    ordersRoute.indexOf(".set({", routeStart),
    ordersRoute.indexOf(".where(and(", routeStart),
  );
  assert.doesNotMatch(fulfillmentSet, /paymentStatus|providerPaymentStatus|squareRefundId/);
});

test("database and legacy migration require evidence for captured state", () => {
  for (const source of [schema, migration]) {
    assert.match(source, /orders_captured_payment_evidence_check/);
    assert.match(source, /payment_(?:status|Status)[^]*captured/);
    assert.match(source, /square_(?:payment_id|PaymentId)|squarePaymentId/);
    assert.match(source, /COMPLETED/);
    assert.match(source, /capture_(?:idempotency_key|IdempotencyKey)/);
  }
  assert.match(migration, /DEFAULT 'unverified'/);
  assert.match(migration, /NOT VALID/);
  assert.doesNotMatch(migration, /\bDELETE\s+FROM\s+orders\b/i);
  assert.doesNotMatch(migration, /\b(?:DELETE|UPDATE)\s+(?:FROM\s+)?(?:commissions|payouts|users)\b/i);
});

test("PR #1293 payout execution containment remains fail closed", () => {
  assert.match(payoutRoute, /PAYOUT_ELIGIBILITY_UNVERIFIABLE/);
  assert.match(payoutRoute, /rejectUnavailablePayout/);
  assert.doesNotMatch(payoutRoute, /payout_(?:sim|\$\{Date\.now)/);
});
