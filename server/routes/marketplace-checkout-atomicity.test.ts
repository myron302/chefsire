import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { isDigitalMarketplaceProduct, resolveMarketplaceShippingCost } from "../../shared/marketplace-fulfillment";
import { buildSquareCaptureRequest, createCaptureRequestSnapshot, evaluateSquareCapturePayment, toClientOrder } from "../lib/marketplace-payment";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const read = (file: string) => fs.readFileSync(path.join(root, file), "utf8");
const orders = read("server/routes/orders.ts");
const payments = read("server/routes/payments.ts");
const schema = read("shared/schema/domains/commerce-billing.ts");
const commissionSchema = read("shared/schema/domains/ops-wedding.ts");
const migration = read("server/migrations/20260922_atomic_marketplace_checkout.sql");
const client = read("client/src/pages/checkout/CheckoutPage.tsx");
const reconciliationService = read("server/services/marketplace-checkout-reconciliation.ts");
const cronFile = read("server/cron.ts");

test("order checkout never mutates inventory or creates financial accounting", () => {
  const checkout = orders.slice(orders.indexOf('router.post("/checkout"'), orders.indexOf('router.get("/my-purchases"'));
  assert.doesNotMatch(checkout, /update\(products\)|insert\(commissions\)|monthlyRevenue/);
  assert.match(checkout, /inventoryStatus: "unreserved"/);
  assert.doesNotMatch(checkout, /body\.price|body\.subtotal|body\.total|body\.sellerId|body\.commission|body\.payment/);
});

test("payment preparation atomically reserves stock, capture_pending, and the immutable request", () => {
  const prepare = reconciliationService.slice(
    reconciliationService.indexOf("export async function reserveMarketplaceCapture"),
    reconciliationService.indexOf("export async function releaseMarketplaceReservation"),
  );
  assert.match(prepare, /deps\.db\.transaction/);
  assert.match(prepare, /tx\.update\(products\)/);
  assert.match(prepare, /gte\(products\.inventory, order\.quantity\)/);
  assert.match(prepare, /tx\.update\(orders\)/);
  assert.match(prepare, /paymentStatus: "capture_pending"/);
  assert.match(prepare, /inventoryStatus: "reserved"/);
  assert.match(prepare, /eq\(orders\.inventoryStatus, "unreserved"\)/);
  // The full CreatePayment request is written in the SAME transaction as the
  // reservation and its idempotency key -- never in a separate statement.
  assert.match(prepare, /captureIdempotencyKey,\s*captureAttemptedAt,\s*captureRequestSnapshot,/);
  assert.match(payments, /reserveMarketplaceCapture\(/);
  assert.match(schema, /products_inventory_nonnegative_check/);
});

test("checkout retries bind one key to immutable inputs", () => {
  assert.match(client, /useState\(\(\) => crypto\.randomUUID\(\)\)/);
  assert.match(orders, /checkoutInputsMatch/);
  assert.match(orders, /CHECKOUT_IDEMPOTENCY_CONFLICT/);
  assert.match(schema, /orders_buyer_checkout_idempotency_uidx/);
  assert.match(migration, /CREATE UNIQUE INDEX IF NOT EXISTS orders_buyer_checkout_idempotency_uidx/);
});

const localCapture = reconciliationService.slice(
  reconciliationService.indexOf("applyLocally: async (paymentEvidence)"),
  reconciliationService.indexOf("export type CaptureFailureSettlement"),
);

test("only verified capture sells inventory and applies accounting atomically once", () => {
  assert.match(localCapture, /deps\.db\.transaction/);
  assert.match(localCapture, /inventoryStatus: "sold"/);
  assert.match(localCapture, /sellerRevenueStatus: "credited"/);
  assert.match(localCapture, /tx\.insert\(commissions\)/);
  assert.match(localCapture, /monthlyRevenue/);
  assert.match(localCapture, /salesCount/);
  assert.match(localCapture, /eq\(orders\.inventoryStatus, "reserved"\)/);
  assert.match(commissionSchema, /commissions_order_uidx/);
  // There is exactly one accounting implementation for both the request path
  // and the background reconciler.
  assert.doesNotMatch(payments, /tx\.insert\(commissions\)|salesCount|inventoryStatus: "sold"/);
});

test("migrated P1-03 orders do not double-count a sale the legacy checkout already counted", () => {
  // The salesCount increment must be conditioned on NOT being the migration's
  // legacy-provenance sentinel, and the monthlyRevenue/commission credit above
  // it must remain unconditional -- only the count, never the accounting, is skipped.
  assert.match(localCapture, /sellerTierSnapshot\s*!==\s*["']legacy_p1_03["'][\s\S]{0,200}salesCount/);
  assert.match(localCapture, /monthlyRevenue[\s\S]*sellerTierSnapshot\s*!==\s*["']legacy_p1_03["']/);
  assert.match(migration, /THEN 'legacy_p1_03'/);
});

test("definitive failure releases stock while ambiguous capture remains reserved", () => {
  assert.match(reconciliationService, /definitiveFailure[\s\S]*deps\.db\.transaction[\s\S]*inventoryStatus: "released"/);
  assert.match(reconciliationService, /CAPTURE_OUTCOME_AMBIGUOUS/);
  assert.doesNotMatch(reconciliationService, /CAPTURE_OUTCOME_AMBIGUOUS[\s\S]{0,500}inventoryStatus: "released"/);
  // Release is reachable only from a definitive provider failure.
  const settle = reconciliationService.slice(reconciliationService.indexOf("export async function settleMarketplaceCaptureFailure"));
  assert.match(settle, /if \(definitiveFailure\) \{[\s\S]{0,200}releaseMarketplaceReservation/);
  assert.equal((reconciliationService.match(/releaseMarketplaceReservation\(/g) ?? []).length, 2, "one definition, one definitive-failure caller");
  assert.match(migration, /orders_inventory_payment_lifecycle_check/);
});

test("legacy and client-provided accounting cannot enter the trusted path", () => {
  assert.match(migration, /ELSE 'legacy_unverified'/);
  assert.match(migration, /THEN 'p1-03:' \|\| id/);
  assert.match(payments, /LEGACY_INVENTORY_RECONCILIATION_REQUIRED/);
  assert.match(orders, /LEGACY_INVENTORY_RECONCILIATION_REQUIRED/);
  assert.match(orders, /const deliveryMethod = isDigital/);
  assert.match(orders, /sellerTierSnapshot: sellerTier/);
  assert.match(reconciliationService, /const tier = order\.sellerTierSnapshot/);
  assert.match(reconciliationService, /const commissionRate = order\.commissionRateSnapshot/);
  assert.match(migration, /orders_sold_inventory_payment_evidence_check/);
});

test("an unpaid order cannot enter processing, shipment, or delivery", () => {
  assert.match(orders, /\["processing", "shipped", "delivered"\]\.includes\(status\)/);
  assert.match(orders, /!isVerifiedMarketplaceEarning\(order\)/);
  assert.match(orders, /PAYMENT_CAPTURE_UNVERIFIED/);
});

test("uncertain dispatch is recovered by replaying the one immutable request, never by a local marker", () => {
  // No marker written before or after the network call is used as evidence.
  for (const source of [payments, reconciliationService, schema, migration]) {
    assert.doesNotMatch(source, /captureRequestSubmittedAt|capture_request_submitted_at|CAPTURE_NEVER_SUBMITTED/);
  }
  // Every dispatch -- first attempt or recovery -- is built from the stored
  // snapshot, and there is exactly one createPayment call site.
  assert.equal((reconciliationService.match(/createPayment\(/g) ?? []).length, 2, "one type signature, one call site");
  assert.match(reconciliationService, /paymentsApi\.createPayment\(buildSquareCaptureRequest\(order\)\)/);
  assert.doesNotMatch(payments, /createPayment\(/);
  // A legacy attempt with no stored request is never re-charged.
  assert.match(reconciliationService, /if \(!order\.captureRequestSnapshot\) \{[\s\S]{0,400}CAPTURE_OUTCOME_AMBIGUOUS/);
  assert.match(schema, /captureRequestSnapshot: jsonb\("capture_request_snapshot"\)/);
});

test("abandoned reservations are reconciled automatically in rotating, bounded batches", () => {
  assert.match(cronFile, /reconcileAbandonedCheckoutReservations/);
  assert.match(cronFile, /cron\.schedule\([^,]+,\s*async \(\) => \{[\s\S]{0,200}reconcileAbandonedCheckoutReservations/);
  // Least-recently-attempted first, disjoint across workers, separate budget
  // for rows that already hold durable provider evidence.
  assert.match(reconciliationService, /ORDER BY reconciliation_attempted_at ASC NULLS FIRST, id ASC/);
  assert.match(reconciliationService, /FOR UPDATE SKIP LOCKED/);
  assert.match(reconciliationService, /claimReconciliationBatch\(deps, "capture_reconciliation"/);
  assert.match(reconciliationService, /claimReconciliationBatch\(deps, "capture_pending"/);
  assert.match(schema, /reconciliationAttemptedAt: timestamp\("reconciliation_attempted_at"\)/);
  // The request path and the reconciler share one lifecycle implementation.
  assert.match(payments, /completeMarketplaceCapture\(productionCheckoutDeps/);
  assert.match(payments, /settleMarketplaceCaptureFailure\(productionCheckoutDeps/);
});

test("digital checkout total agrees with the server-authoritative amount Square is charged", () => {
  // Server and client must derive shipping from the exact same shared rule --
  // never their own inline copy that can silently diverge.
  assert.match(orders, /isDigitalMarketplaceProduct\(/);
  assert.match(orders, /resolveMarketplaceShippingCost\(/);
  assert.doesNotMatch(orders, /\["digital", "cookbook", "course"\]\.includes/);
  assert.match(client, /isDigitalMarketplaceProduct\(/);
  assert.match(client, /resolveMarketplaceShippingCost\(/);
  // Once an order exists, the payment step must render/charge the server's
  // persisted totalAmount, never a client recomputation that could diverge.
  assert.match(client, /setOrderTotal\(parseFloat\(data\.order\.totalAmount\)\)/);
  assert.match(client, /amount=\{orderTotal \?\? calculateTotal\(\)\}/);
  assert.doesNotMatch(client.slice(client.indexOf('step === "payment"')), /amount=\{calculateTotal\(\)\}/);

  const digitalProduct = { isDigital: false, productCategory: "cookbook", shippingCost: "6.00" };
  assert.equal(isDigitalMarketplaceProduct(digitalProduct), true);
  assert.equal(resolveMarketplaceShippingCost(digitalProduct, "shipping"), 0);
});

test("db:push classifies existing orders from their own evidence before Drizzle can default them", () => {
  const pushSchema = read("server/scripts/push-schema.ts");
  // The checkout-atomicity backfill depends on seller_revenue_status already
  // being backfilled, and must run before drizzle-kit push ever gets a chance
  // to stamp every existing row 'legacy_unverified' via its own NOT NULL
  // DEFAULT -- otherwise the evidence those rows carry is never consulted.
  assert.match(
    pushSchema,
    /enforce-marketplace-revenue-integrity\.ts", "--allow-missing"\][\s\S]*enforce-marketplace-checkout-atomicity\.ts", "--allow-missing"\][\s\S]*drizzle-kit[\s\S]*enforce-marketplace-revenue-integrity[\s\S]*enforce-marketplace-checkout-atomicity/
  );
  const enforcement = read("server/scripts/marketplace-checkout-atomicity-enforcement.ts");
  assert.match(enforcement, /WHERE inventory_status IS NULL OR inventory_status = 'legacy_unverified'|splitPostgresStatements/);
  assert.match(migration, /WHERE inventory_status IS NULL OR inventory_status = 'legacy_unverified'/);
  // The broadened WHERE clause must still be evidence-gated by the same CASE,
  // never a blind rewrite of every legacy_unverified row.
  assert.doesNotMatch(migration, /SET inventory_status = 'reserved' WHERE inventory_status = 'legacy_unverified'/);
  assert.doesNotMatch(migration, /SET inventory_status = 'sold' WHERE inventory_status = 'legacy_unverified'/);
});

test("capture replay is rebuilt only from an intact snapshot bound to the order's own key and amount", () => {
  const snapshot = createCaptureRequestSnapshot({
    idempotencyKey: "key-1", referenceId: "key-1", sourceId: "cnon:token", verificationToken: "verf",
    amountCents: 10000, locationId: "LOC", orderId: "order-1", buyerEmailAddress: "b@example.com",
  });
  const order = { captureIdempotencyKey: "key-1", captureRequestSnapshot: snapshot, totalAmount: "100.00" };
  const first = buildSquareCaptureRequest(order);
  assert.deepEqual(buildSquareCaptureRequest(order), first, "every rebuild is identical");
  assert.equal(first.idempotencyKey, "key-1");
  assert.equal(first.referenceId, "key-1");
  assert.equal(first.amountMoney.amount, 10000n);
  assert.equal(first.sourceId, "cnon:token");

  const rejects = (candidate: object) => assert.throws(() => buildSquareCaptureRequest({ ...order, ...candidate }),
    (error: any) => error.code === "PAYMENT_RECONCILIATION_REQUIRED");
  rejects({ captureRequestSnapshot: null });
  rejects({ captureIdempotencyKey: "different-key" });
  rejects({ totalAmount: "100.01" });
  rejects({ captureRequestSnapshot: { ...snapshot, sourceId: "" } });
  rejects({ captureRequestSnapshot: { ...snapshot, referenceId: "other" } });
  rejects({ captureRequestSnapshot: { ...snapshot, currency: "EUR" } });

  assert.throws(() => evaluateSquareCapturePayment({ id: "p", status: "FAILED" }, 10000n),
    (error: any) => error.code === "CAPTURE_DEFINITIVE_FAILURE" && error.providerCode === "FAILED");
  assert.throws(() => evaluateSquareCapturePayment({ id: "p", status: "APPROVED", totalMoney: { amount: 10000n, currency: "USD" }, createdAt: new Date().toISOString() }, 10000n),
    (error: any) => error.code === "PAYMENT_CAPTURE_UNVERIFIED", "a non-terminal payment is neither success nor failure");
  assert.throws(() => evaluateSquareCapturePayment(undefined, 10000n), (error: any) => error.code === "PAYMENT_CAPTURE_UNVERIFIED");
});

test("the stored capture request (buyer payment token, email) never reaches a buyer or seller response", () => {
  const redacted = toClientOrder({ id: "o", captureRequestSnapshot: { sourceId: "cnon:secret", buyerEmailAddress: "b@example.com" } });
  assert.equal("captureRequestSnapshot" in redacted, false);
  assert.equal(JSON.stringify(redacted).includes("cnon:secret"), false);

  // Seller- and buyer-facing listings select only client-safe columns...
  assert.doesNotMatch(orders, /order: orders,/);
  assert.equal((orders.match(/order: clientOrderColumns,/g) ?? []).length, 4, "my-purchases, my-sales (x2), and order details");
  assert.match(orders, /const \{ captureRequestSnapshot: _serverOnlyCaptureRequest, \.\.\.clientOrderColumns \} = getTableColumns\(orders\)/);
  // ...and every full-row response is redacted.
  for (const source of [orders, payments]) {
    for (const [, value] of source.matchAll(/(?:^[ \t]+|, )order: ([^,\n}]+)/gm)) {
      // "{" is the checkout response whose body spreads toClientOrder(newOrder);
      // orderDetails is built from the clientOrderColumns select (both asserted below).
      assert.ok(value.startsWith("toClientOrder(") || ["clientOrderColumns", "{", "orderDetails"].includes(value.trim()),
        `unredacted order response: order: ${value}`);
    }
  }
  assert.match(orders, /order: \{\s*\.\.\.toClientOrder\(newOrder\),/);
  assert.match(orders, /const \[orderDetails\] = await db\s*\.select\(\{\s*order: clientOrderColumns,/);
});
