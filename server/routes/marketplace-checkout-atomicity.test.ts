import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const read = (file: string) => fs.readFileSync(path.join(root, file), "utf8");
const orders = read("server/routes/orders.ts");
const payments = read("server/routes/payments.ts");
const reconciliation = read("server/services/marketplace-inventory-reconciliation.ts");
const schema = read("shared/schema/domains/commerce-billing.ts");
const migration = read("server/migrations/20260922_atomic_marketplace_checkout.sql");
const client = read("client/src/pages/checkout/CheckoutPage.tsx");

test("checkout reserves finite inventory atomically and never performs a stale absolute write", () => {
  assert.match(orders, /db\.transaction[\s\S]*inventory: sql`\$\{products\.inventory\} - \$\{body\.quantity\}`/);
  assert.match(orders, /gte\(products\.inventory, body\.quantity\)/);
  assert.doesNotMatch(orders, /inventory:\s*product\.inventory\s*-/);
  assert.match(schema, /products_inventory_nonnegative_check/);
  assert.match(migration, /CHECK \(inventory IS NULL OR inventory >= 0\)/);
  assert.match(schema, /orders_sold_inventory_payment_evidence_check/);
  assert.match(migration, /inventory_status <> 'sold' OR \([\s\S]*payment_provider = 'square'/);
});

test("checkout retries reuse one immutable order and reservation", () => {
  assert.match(client, /useState\(\(\) => crypto\.randomUUID\(\)\)/);
  assert.match(orders, /CHECKOUT_IDEMPOTENCY_CONFLICT/);
  assert.match(orders, /eq\(orders\.checkoutIdempotencyKey, body\.checkoutIdempotencyKey\)/);
  assert.match(schema, /orders_buyer_checkout_idempotency_uidx/);
  assert.match(migration, /CREATE UNIQUE INDEX IF NOT EXISTS orders_buyer_checkout_idempotency_uidx/);
});

test("only verified capture sells inventory and applies all accounting atomically", () => {
  const localCapture = payments.slice(payments.indexOf("applyLocally: async (paymentEvidence)"), payments.indexOf("res.json({", payments.indexOf("applyLocally: async (paymentEvidence)")));
  assert.match(localCapture, /db\.transaction/);
  assert.match(localCapture, /inventoryStatus: "sold"/);
  assert.match(localCapture, /sellerRevenueStatus: "credited"/);
  assert.match(localCapture, /tx\.insert\(commissions\)/);
  assert.match(localCapture, /monthlyRevenue/);
  assert.match(localCapture, /salesCount/);
  assert.match(localCapture, /eq\(orders\.inventoryStatus, "reserved"\)/);
});

test("decline, cancellation and abandonment release reservations without guessing ambiguous capture", () => {
  assert.match(payments, /definitiveFailure[\s\S]*db\.transaction[\s\S]*inventoryStatus: "released"/);
  assert.match(orders, /status === "cancelled"[\s\S]*inventoryStatus: "released"/);
  assert.match(reconciliation, /payment_status = 'unverified'/);
  assert.match(reconciliation, /FOR UPDATE SKIP LOCKED/);
  assert.match(reconciliation, /WHERE inventory_status = 'reserved'\s+AND payment_status = 'unverified'/);
  assert.match(payments, /CAPTURE_OUTCOME_AMBIGUOUS/);
});

test("legacy inventory and client accounting remain outside the trusted path", () => {
  assert.match(migration, /SET inventory_status = 'legacy_unverified'/);
  assert.match(payments, /LEGACY_INVENTORY_RECONCILIATION_REQUIRED/);
  assert.match(orders, /LEGACY_INVENTORY_RECONCILIATION_REQUIRED/);
  assert.doesNotMatch(orders, /body\.price|body\.subtotal|body\.total|body\.sellerId|body\.commission|body\.payment/);
  assert.match(orders, /const deliveryMethod = isDigital/);
  assert.match(orders, /sellerTierSnapshot: sellerTier/);
  assert.match(payments, /const tier = order\.sellerTierSnapshot/);
  assert.match(payments, /const commissionRate = order\.commissionRateSnapshot/);
});
