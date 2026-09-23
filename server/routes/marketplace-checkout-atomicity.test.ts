import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const read = (file: string) => fs.readFileSync(path.join(root, file), "utf8");
const orders = read("server/routes/orders.ts");
const payments = read("server/routes/payments.ts");
const schema = read("shared/schema/domains/commerce-billing.ts");
const commissionSchema = read("shared/schema/domains/ops-wedding.ts");
const migration = read("server/migrations/20260922_atomic_marketplace_checkout.sql");
const client = read("client/src/pages/checkout/CheckoutPage.tsx");

test("order checkout never mutates inventory or creates financial accounting", () => {
  const checkout = orders.slice(orders.indexOf('router.post("/checkout"'), orders.indexOf('router.get("/my-purchases"'));
  assert.doesNotMatch(checkout, /update\(products\)|insert\(commissions\)|monthlyRevenue/);
  assert.match(checkout, /inventoryStatus: "unreserved"/);
  assert.doesNotMatch(checkout, /body\.price|body\.subtotal|body\.total|body\.sellerId|body\.commission|body\.payment/);
});

test("payment preparation atomically reserves stock and capture_pending", () => {
  const prepare = payments.slice(payments.indexOf("const prepared = await db.transaction"), payments.indexOf("order = prepared"));
  assert.match(prepare, /tx\.update\(products\)/);
  assert.match(prepare, /gte\(products\.inventory, order\.quantity\)/);
  assert.match(prepare, /tx\.update\(orders\)/);
  assert.match(prepare, /paymentStatus: "capture_pending"/);
  assert.match(prepare, /inventoryStatus: "reserved"/);
  assert.match(prepare, /eq\(orders\.inventoryStatus, "unreserved"\)/);
  assert.match(schema, /products_inventory_nonnegative_check/);
});

test("checkout retries bind one key to immutable inputs", () => {
  assert.match(client, /useState\(\(\) => crypto\.randomUUID\(\)\)/);
  assert.match(orders, /checkoutInputsMatch/);
  assert.match(orders, /CHECKOUT_IDEMPOTENCY_CONFLICT/);
  assert.match(schema, /orders_buyer_checkout_idempotency_uidx/);
  assert.match(migration, /CREATE UNIQUE INDEX IF NOT EXISTS orders_buyer_checkout_idempotency_uidx/);
});

test("only verified capture sells inventory and applies accounting atomically once", () => {
  const localCapture = payments.slice(payments.indexOf("applyLocally: async (paymentEvidence)"), payments.indexOf("res.json({", payments.indexOf("applyLocally: async (paymentEvidence)")));
  assert.match(localCapture, /db\.transaction/);
  assert.match(localCapture, /inventoryStatus: "sold"/);
  assert.match(localCapture, /sellerRevenueStatus: "credited"/);
  assert.match(localCapture, /tx\.insert\(commissions\)/);
  assert.match(localCapture, /monthlyRevenue/);
  assert.match(localCapture, /salesCount/);
  assert.match(localCapture, /eq\(orders\.inventoryStatus, "reserved"\)/);
  assert.match(commissionSchema, /commissions_order_uidx/);
});

test("definitive failure releases stock while ambiguous capture remains reserved", () => {
  assert.match(payments, /definitiveFailure[\s\S]*db\.transaction[\s\S]*inventoryStatus: "released"/);
  assert.match(payments, /CAPTURE_OUTCOME_AMBIGUOUS/);
  assert.doesNotMatch(payments, /CAPTURE_OUTCOME_AMBIGUOUS[\s\S]{0,500}inventoryStatus: "released"/);
  assert.match(migration, /orders_inventory_payment_lifecycle_check/);
});

test("legacy and client-provided accounting cannot enter the trusted path", () => {
  assert.match(migration, /ELSE 'legacy_unverified'/);
  assert.match(migration, /THEN 'p1-03:' \|\| id/);
  assert.match(payments, /LEGACY_INVENTORY_RECONCILIATION_REQUIRED/);
  assert.match(orders, /LEGACY_INVENTORY_RECONCILIATION_REQUIRED/);
  assert.match(orders, /const deliveryMethod = isDigital/);
  assert.match(orders, /sellerTierSnapshot: sellerTier/);
  assert.match(payments, /const tier = order\.sellerTierSnapshot/);
  assert.match(payments, /const commissionRate = order\.commissionRateSnapshot/);
  assert.match(migration, /orders_sold_inventory_payment_evidence_check/);
});

test("an unpaid order cannot enter processing, shipment, or delivery", () => {
  assert.match(orders, /\["processing", "shipped", "delivered"\]\.includes\(status\)/);
  assert.match(orders, /!isVerifiedMarketplaceEarning\(order\)/);
  assert.match(orders, /PAYMENT_CAPTURE_UNVERIFIED/);
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
