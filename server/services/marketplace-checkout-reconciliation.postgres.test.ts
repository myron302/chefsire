/**
 * Behavioral tests for the marketplace capture lifecycle. The real service code
 * runs against an isolated PostgreSQL schema whose tables are generated from
 * the production Drizzle schema and hardened by the production P1-05 migration
 * (lifecycle/evidence CHECKs, commissions_order_uidx). Square is a fake that
 * models idempotency the way the repository relies on it: the same key with the
 * identical request returns the original outcome; a reused key with a
 * different request is rejected.
 */
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import { getTableConfig } from "drizzle-orm/pg-core";
import { eq } from "drizzle-orm";
import * as dbSchema from "../../shared/schema";
import { orders, commissions } from "../../shared/schema";
import { enforceMarketplaceCheckoutAtomicity } from "../scripts/marketplace-checkout-atomicity-enforcement";
import { buildSquareCaptureRequest } from "../lib/marketplace-payment";
import { ProviderReconciliationRequiredError } from "../lib/provider-reconciliation";
import {
  completeMarketplaceCapture,
  reconcileAbandonedCheckoutReservations,
  reconcileStalledCaptureOrder,
  reserveMarketplaceCapture,
  settleMarketplaceCaptureFailure,
  type CheckoutDeps,
  type SquarePaymentsClient,
} from "./marketplace-checkout-reconciliation";

const here = path.dirname(fileURLToPath(import.meta.url));
const migration = fs.readFileSync(path.join(here, "../migrations/20260922_atomic_marketplace_checkout.sql"), "utf8");
const connectionString = process.env.TEST_DATABASE_URL?.trim() || null;
const postgresTest = connectionString ? test : test.skip;
if (!connectionString) console.log("# TEST_DATABASE_URL unavailable -- marketplace capture lifecycle PostgreSQL tests skipped safely");

const MINUTE = 60_000;
type OrderRow = typeof orders.$inferSelect;

function tableDdl(table: any) {
  const config = getTableConfig(table);
  const columns = config.columns.map((column: any) => `"${column.name}" ${column.getSQLType()}${column.primary ? " PRIMARY KEY" : ""}`);
  return `CREATE TABLE "${config.name}" (${columns.join(", ")})`;
}

const stringify = (value: unknown) => JSON.stringify(value, (_key, v) => (typeof v === "bigint" ? `${v}n` : v));

/** Square as the repository relies on it: one payment per idempotency key. */
class FakeSquare {
  ledger = new Map<string, { request: any; payment: any; error?: any }>();
  createCalls: any[] = [];
  listCalls = 0;
  unavailable = false;
  configMissing = false;
  listVisible = true;
  declineNext: string | null = null;
  crashBeforeSendOnce = false;
  loseResponseOnce = false;

  completedCharges() {
    return [...this.ledger.values()].filter((entry) => entry.payment?.status === "COMPLETED").length;
  }

  client(): SquarePaymentsClient {
    return {
      paymentsApi: {
        createPayment: async (request: any) => {
          if (this.crashBeforeSendOnce) {
            // The process dies after every durable local write but before a
            // single byte reaches Square.
            this.crashBeforeSendOnce = false;
            throw new Error("process exited before dispatch");
          }
          this.createCalls.push(request);
          if (this.unavailable) throw new Error("connect ECONNREFUSED");
          const existing = this.ledger.get(request.idempotencyKey);
          if (existing) {
            if (stringify(existing.request) !== stringify(request)) {
              throw { errors: [{ category: "INVALID_REQUEST_ERROR", code: "IDEMPOTENCY_KEY_REUSED" }] };
            }
            if (existing.error) throw existing.error;
            return { result: { payment: existing.payment } };
          }
          const base = { referenceId: request.referenceId, totalMoney: request.amountMoney, createdAt: new Date().toISOString() };
          let entry: { request: any; payment: any; error?: any };
          if (this.declineNext) {
            entry = {
              request,
              payment: { ...base, id: `sq-failed-${this.ledger.size + 1}`, status: "FAILED" },
              error: { errors: [{ category: "PAYMENT_METHOD_ERROR", code: this.declineNext }] },
            };
            this.declineNext = null;
          } else {
            entry = { request, payment: { ...base, id: `sq-${this.ledger.size + 1}`, status: "COMPLETED" } };
          }
          this.ledger.set(request.idempotencyKey, entry);
          if (this.loseResponseOnce) {
            // Square processed it; the response never came back.
            this.loseResponseOnce = false;
            throw new Error("socket hang up");
          }
          if (entry.error) throw entry.error;
          return { result: { payment: entry.payment } };
        },
        listPayments: async () => {
          this.listCalls += 1;
          if (this.unavailable) throw new Error("connect ECONNREFUSED");
          const payments = this.listVisible ? [...this.ledger.values()].map((entry) => entry.payment) : [];
          return { result: { payments } };
        },
      },
    };
  }
}

type Harness = {
  deps: CheckoutDeps;
  db: any;
  square: FakeSquare;
  pool: pg.Pool;
  admin: pg.Client;
  schema: string;
};

let sequence = 0;
async function setup(initialInventory = 10): Promise<Harness> {
  const admin = new pg.Client({ connectionString: connectionString! });
  await admin.connect();
  const schema = `capture_lifecycle_${process.pid}_${Date.now()}_${sequence++}`;
  await admin.query(`CREATE SCHEMA ${schema}`);
  await admin.query(`SET search_path TO ${schema}`);
  await admin.query(`
    CREATE TABLE products (id varchar PRIMARY KEY, inventory integer, is_active boolean NOT NULL DEFAULT true, sales_count integer DEFAULT 0);
    CREATE TABLE users (id varchar PRIMARY KEY, monthly_revenue numeric(10,2) DEFAULT 0);
  `);
  await admin.query(tableDdl(orders));
  await admin.query(tableDdl(commissions));
  await admin.query(`ALTER TABLE commissions ALTER COLUMN id SET DEFAULT gen_random_uuid()`);
  // The production P1-05 migration adds every lifecycle/evidence invariant and
  // commissions_order_uidx on top of the schema-derived tables.
  await enforceMarketplaceCheckoutAtomicity(admin, migration, false);
  await admin.query(`INSERT INTO products (id, inventory) VALUES ('product', $1)`, [initialInventory]);
  await admin.query(`INSERT INTO users (id) VALUES ('seller')`);

  const pool = new pg.Pool({ connectionString: connectionString!, options: `-c search_path=${schema}`, max: 8 });
  const db = drizzle(pool, { schema: dbSchema });
  const square = new FakeSquare();
  const deps: CheckoutDeps = {
    db,
    getSquareClient: () => {
      if (square.configMissing) throw new Error("SQUARE_ACCESS_TOKEN not configured");
      return square.client();
    },
  };
  return { deps, db, square, pool, admin, schema };
}

async function teardown(h: Harness) {
  await h.pool.end();
  await h.admin.query("RESET search_path");
  await h.admin.query(`DROP SCHEMA IF EXISTS ${h.schema} CASCADE`);
  await h.admin.end();
}

async function seedOrder(h: Harness, id: string, overrides: Partial<OrderRow> = {}) {
  const [row] = await h.db.insert(orders).values({
    id,
    buyerId: "buyer",
    sellerId: "seller",
    productId: "product",
    quantity: 2,
    totalAmount: "100.00",
    platformFee: "10.00",
    sellerAmount: "90.00",
    checkoutIdempotencyKey: `checkout-${id}`,
    sellerTierSnapshot: "free",
    commissionRateSnapshot: "10.00",
    inventoryStatus: "unreserved",
    deliveryMethod: "shipped",
    fulfillmentMethod: "shipping",
    status: "pending",
    paymentStatus: "unverified",
    sellerRevenueStatus: "uncredited",
    ...overrides,
  }).returning();
  return row as OrderRow;
}

/** A P1-03-era capture_pending row: no request snapshot, only a search identity. */
async function seedLegacyPending(h: Harness, id: string, attemptedAt: Date) {
  return seedOrder(h, id, {
    paymentStatus: "capture_pending",
    paymentProvider: "square",
    inventoryStatus: "reserved",
    captureIdempotencyKey: `legacy-key-${id}`,
    captureAttemptedAt: attemptedAt,
    checkoutIdempotencyKey: `p1-03:${id}`,
    sellerTierSnapshot: "legacy_p1_03",
  });
}

async function load(h: Harness, id: string) {
  const [row] = await h.db.select().from(orders).where(eq(orders.id, id));
  return row as OrderRow;
}

async function snapshot(h: Harness, id: string) {
  const order = await load(h, id);
  const product = (await h.admin.query(`SELECT inventory, sales_count FROM products WHERE id = 'product'`)).rows[0];
  const commissionCount = (await h.admin.query(`SELECT count(*)::int AS n FROM commissions WHERE order_id = $1`, [id])).rows[0].n;
  const revenue = Number((await h.admin.query(`SELECT monthly_revenue FROM users WHERE id = 'seller'`)).rows[0].monthly_revenue);
  return { order, inventory: product.inventory as number, salesCount: product.sales_count as number, commissionCount, revenue };
}

const reservationRequest = { sourceId: "cnon:buyer-original-token", verificationToken: "verf:original", buyerEmailAddress: "buyer@example.com", locationId: "LOC-1" };

/** The request path's first attempt, exactly as the route drives the service. */
async function firstAttempt(h: Harness, id: string) {
  const reserved = await reserveMarketplaceCapture(h.deps, await load(h, id), reservationRequest);
  try {
    return { order: await completeMarketplaceCapture(h.deps, reserved, { isNewCaptureAttempt: true }), settled: null };
  } catch (error) {
    return { order: null, error, settled: await settleMarketplaceCaptureFailure(h.deps, reserved, error) };
  }
}

const later = (minutes: number) => new Date(Date.now() + minutes * MINUTE);

function assertFinalizedOnce(state: Awaited<ReturnType<typeof snapshot>>, square: FakeSquare, expected: { inventory: number; salesCount?: number }) {
  assert.equal(state.order.paymentStatus, "captured");
  assert.equal(state.order.inventoryStatus, "sold");
  assert.equal(state.order.sellerRevenueStatus, "credited");
  assert.equal(state.order.captureRequestSnapshot, null, "the single-use payment token is not retained after capture");
  assert.equal(state.inventory, expected.inventory, "stock is decremented exactly once");
  assert.equal(state.salesCount, expected.salesCount ?? 1);
  assert.equal(state.commissionCount, 1, "exactly one commission");
  assert.equal(state.revenue, 90, "seller revenue credited exactly once");
  assert.equal(square.completedCharges(), 1, "exactly one Square charge");
}

function assertStillReservedWithoutEvidence(state: Awaited<ReturnType<typeof snapshot>>, inventory: number) {
  assert.equal(state.order.paymentStatus, "capture_pending");
  assert.equal(state.order.inventoryStatus, "reserved");
  assert.equal(state.order.squarePaymentId, null, "no provider evidence is fabricated");
  assert.equal(state.order.sellerRevenueStatus, "uncredited");
  assert.equal(state.inventory, inventory, "the reservation is neither released nor duplicated");
  assert.equal(state.commissionCount, 0, "no commission without verified capture");
  assert.equal(state.revenue, 0, "no seller revenue without verified capture");
}

// ---------------------------------------------------------------- Finding 1

postgresTest("happy path: first attempt charges once and finalizes accounting once", async () => {
  const h = await setup();
  try {
    await seedOrder(h, "happy");
    const { order } = await firstAttempt(h, "happy");
    assert.ok(order);
    assertFinalizedOnce(await snapshot(h, "happy"), h.square, { inventory: 8 });
    assert.equal(h.square.createCalls[0].idempotencyKey, (await load(h, "happy")).captureIdempotencyKey);
  } finally {
    await teardown(h);
  }
});

postgresTest("boundary A: crash right after the reservation commits, before any provider call, is recovered -- not stranded", async () => {
  const h = await setup();
  try {
    await seedOrder(h, "crash-a");
    // Reservation + identity + immutable request commit, then the process dies.
    const reserved = await reserveMarketplaceCapture(h.deps, await load(h, "crash-a"), reservationRequest);
    assert.equal(reserved.captureRequestSnapshot?.idempotencyKey, reserved.captureIdempotencyKey);
    assertStillReservedWithoutEvidence(await snapshot(h, "crash-a"), 8);

    const run = await reconcileAbandonedCheckoutReservations({ deps: h.deps, now: later(3) });
    assert.equal(run.finalized, 1);
    assertFinalizedOnce(await snapshot(h, "crash-a"), h.square, { inventory: 8 });
    assert.equal(h.square.createCalls[0].sourceId, reservationRequest.sourceId, "replay carries the buyer's original request, not new input");
  } finally {
    await teardown(h);
  }
});

postgresTest("boundary B (Codex repro): every durable local write done, process dies before the Square client is invoked -- recovered, not stranded", async () => {
  const h = await setup();
  try {
    await seedOrder(h, "crash-b");
    h.square.crashBeforeSendOnce = true;
    const attempt = await firstAttempt(h, "crash-b");
    assert.equal(attempt.order, null);
    assert.equal(h.square.ledger.size, 0, "nothing reached Square");
    assert.notEqual(attempt.settled?.kind, "declined", "a local crash is never treated as a provider decline");
    assertStillReservedWithoutEvidence(await snapshot(h, "crash-b"), 8);

    // The earlier design wrote a "submitted" marker here, so recovery searched,
    // found nothing forever and stranded the stock. Replaying the immutable
    // request under the original key lets Square itself decide.
    const run = await reconcileAbandonedCheckoutReservations({ deps: h.deps, now: later(3) });
    assert.equal(run.finalized, 1);
    assert.equal(run.ambiguous, 0);
    assertFinalizedOnce(await snapshot(h, "crash-b"), h.square, { inventory: 8 });
  } finally {
    await teardown(h);
  }
});

postgresTest("boundaries C/D: Square processed the request but the response was lost -- replay returns the original payment, no second charge", async () => {
  const h = await setup();
  try {
    await seedOrder(h, "lost-response");
    h.square.loseResponseOnce = true;
    const attempt = await firstAttempt(h, "lost-response");
    assert.equal(attempt.settled?.kind, "unknown", "a transport failure is not a decline and releases nothing");
    assertStillReservedWithoutEvidence(await snapshot(h, "lost-response"), 8);
    assert.equal(h.square.completedCharges(), 1, "Square already holds the one charge");

    // Even with the list API not yet showing it, replay under the same key is authoritative.
    h.square.listVisible = false;
    const run = await reconcileAbandonedCheckoutReservations({ deps: h.deps, now: later(3) });
    assert.equal(run.finalized, 1);
    assertFinalizedOnce(await snapshot(h, "lost-response"), h.square, { inventory: 8 });
    const keys = new Set(h.square.createCalls.map((call) => call.idempotencyKey));
    assert.equal(keys.size, 1, "every dispatch and replay used the one original idempotency key");
  } finally {
    await teardown(h);
  }
});

postgresTest("boundary E: Square captured and responded, process died before persisting evidence -- finalized once from Square's evidence", async () => {
  const h = await setup();
  try {
    await seedOrder(h, "crash-e");
    const reserved = await reserveMarketplaceCapture(h.deps, await load(h, "crash-e"), reservationRequest);
    // Our process sent it and got the payment back, then died before any DB write.
    await h.square.client().paymentsApi.createPayment(buildSquareCaptureRequest(reserved));
    assertStillReservedWithoutEvidence(await snapshot(h, "crash-e"), 8);

    const run = await reconcileAbandonedCheckoutReservations({ deps: h.deps, now: later(3) });
    assert.equal(run.finalized, 1);
    assertFinalizedOnce(await snapshot(h, "crash-e"), h.square, { inventory: 8 });
    assert.equal(h.square.createCalls.length, 1, "search found the payment; no replay was even needed");
  } finally {
    await teardown(h);
  }
});

postgresTest("boundary E': evidence persisted, crash inside the accounting transaction -- finalized from stored evidence even with Square down", async () => {
  const h = await setup();
  try {
    await seedOrder(h, "crash-accounting");
    const reserved = await reserveMarketplaceCapture(h.deps, await load(h, "crash-accounting"), reservationRequest);
    const crashingDb = new Proxy(h.db, {
      get(target, prop) {
        if (prop === "transaction") return async () => { throw new Error("process crashed mid-accounting"); };
        const value = Reflect.get(target, prop);
        return typeof value === "function" ? value.bind(target) : value;
      },
    });
    await assert.rejects(
      completeMarketplaceCapture({ ...h.deps, db: crashingDb }, reserved, { isNewCaptureAttempt: true }),
      (error) => error instanceof ProviderReconciliationRequiredError,
    );
    const midway = await snapshot(h, "crash-accounting");
    assert.equal(midway.order.paymentStatus, "capture_reconciliation");
    assert.equal(midway.order.captureRequestSnapshot, null, "token dropped as soon as provider evidence is durable");
    assert.equal(midway.commissionCount, 0);

    h.square.configMissing = true;
    const run = await reconcileAbandonedCheckoutReservations({ deps: h.deps, now: later(1) });
    assert.equal(run.finalized, 1, "capture_reconciliation needs no Square call and no age threshold");
    assertFinalizedOnce(await snapshot(h, "crash-accounting"), h.square, { inventory: 8 });
  } finally {
    await teardown(h);
  }
});

postgresTest("boundary F: a definitive decline releases stock exactly once, including across repeated and concurrent settlement", async () => {
  const h = await setup();
  try {
    await seedOrder(h, "declined");
    h.square.crashBeforeSendOnce = true;
    await firstAttempt(h, "declined");
    h.square.declineNext = "CARD_DECLINED";
    const reserved = await load(h, "declined");

    const outcomes = await Promise.all([
      reconcileStalledCaptureOrder(h.deps, reserved),
      reconcileStalledCaptureOrder(h.deps, reserved),
      reconcileAbandonedCheckoutReservations({ deps: h.deps, now: later(3) }),
    ]);
    const state = await snapshot(h, "declined");
    assert.equal(state.order.paymentStatus, "unverified");
    assert.equal(state.order.inventoryStatus, "released");
    // Whichever concurrent path won, the code comes from Square: the replay's
    // decline code or the searched payment's terminal FAILED status.
    assert.ok(["CARD_DECLINED", "FAILED"].includes(state.order.lastPaymentFailureCode!));
    assert.equal(state.order.captureIdempotencyKey, null);
    assert.equal(state.order.captureRequestSnapshot, null);
    assert.equal(state.inventory, 10, "restocked exactly once despite three concurrent settlements");
    assert.equal(state.commissionCount, 0);
    assert.equal(state.revenue, 0);
    assert.equal(h.square.completedCharges(), 0);
    assert.ok(outcomes.length === 3);

    await reconcileAbandonedCheckoutReservations({ deps: h.deps, now: later(10) });
    assert.equal((await snapshot(h, "declined")).inventory, 10, "a released order never re-enters reconciliation");
  } finally {
    await teardown(h);
  }
});

postgresTest("boundary G: provider unavailable during reconciliation leaves the reservation intact, then recovers exactly once", async () => {
  const h = await setup();
  try {
    await seedOrder(h, "outage");
    await reserveMarketplaceCapture(h.deps, await load(h, "outage"), reservationRequest);

    h.square.configMissing = true;
    let run = await reconcileAbandonedCheckoutReservations({ deps: h.deps, now: later(3) });
    assert.equal(run.errors, 1);
    assertStillReservedWithoutEvidence(await snapshot(h, "outage"), 8);

    h.square.configMissing = false;
    h.square.unavailable = true;
    run = await reconcileAbandonedCheckoutReservations({ deps: h.deps, now: later(8) });
    assert.equal(run.finalized + run.declined, 0);
    assertStillReservedWithoutEvidence(await snapshot(h, "outage"), 8);
    assert.equal(h.square.completedCharges(), 0);

    h.square.unavailable = false;
    run = await reconcileAbandonedCheckoutReservations({ deps: h.deps, now: later(13) });
    assert.equal(run.finalized, 1);
    assertFinalizedOnce(await snapshot(h, "outage"), h.square, { inventory: 8 });
  } finally {
    await teardown(h);
  }
});

postgresTest("boundary H: a legacy P1-03 attempt with a search no-match stays reserved and is never re-charged", async () => {
  const h = await setup();
  try {
    await h.admin.query(`UPDATE products SET inventory = 8`);
    await seedLegacyPending(h, "legacy", new Date(Date.now() - 30 * MINUTE));
    for (const minutes of [0, 5, 10]) {
      const run = await reconcileAbandonedCheckoutReservations({ deps: h.deps, now: later(minutes) });
      assert.equal(run.ambiguous, 1);
    }
    assertStillReservedWithoutEvidence(await snapshot(h, "legacy"), 8);
    assert.equal(h.square.createCalls.length, 0, "no new charge is ever attempted without the original immutable request");
    assert.ok(h.square.listCalls >= 3);
  } finally {
    await teardown(h);
  }
});

postgresTest("manual retry replays the original immutable request under the original key, never new HTTP input", async () => {
  const h = await setup();
  try {
    await seedOrder(h, "retry");
    h.square.loseResponseOnce = true;
    await firstAttempt(h, "retry");
    const pending = await load(h, "retry");
    // The buyer clicks Pay again; the retry path is driven with the stored
    // order only (the route never passes a new source for capture_pending).
    const retried = await completeMarketplaceCapture(h.deps, pending, { isNewCaptureAttempt: false });
    assert.equal(retried.paymentStatus, "captured");
    assert.ok(h.square.createCalls.length >= 1);
    for (const call of h.square.createCalls) {
      assert.equal(call.idempotencyKey, pending.captureIdempotencyKey);
      assert.equal(call.sourceId, reservationRequest.sourceId);
      assert.equal(stringify(call), stringify(h.square.createCalls[0]), "byte-identical request on every dispatch");
    }
    assertFinalizedOnce(await snapshot(h, "retry"), h.square, { inventory: 8 });
  } finally {
    await teardown(h);
  }
});

postgresTest("repeated and concurrent reconciliation of one order finalizes and charges exactly once", async () => {
  const h = await setup();
  try {
    await seedOrder(h, "race");
    await reserveMarketplaceCapture(h.deps, await load(h, "race"), reservationRequest);
    const stale = await load(h, "race");
    const outcomes = await Promise.all([
      reconcileStalledCaptureOrder(h.deps, stale),
      reconcileStalledCaptureOrder(h.deps, stale),
      reconcileStalledCaptureOrder(h.deps, stale),
      reconcileAbandonedCheckoutReservations({ deps: h.deps, now: later(3) }),
      reconcileAbandonedCheckoutReservations({ deps: h.deps, now: later(3) }),
    ]);
    assert.ok(outcomes.length === 5);
    for (const minutes of [10, 20]) await reconcileAbandonedCheckoutReservations({ deps: h.deps, now: later(minutes) });
    assertFinalizedOnce(await snapshot(h, "race"), h.square, { inventory: 8 });
  } finally {
    await teardown(h);
  }
});

postgresTest("unverifiable provider evidence fabricates nothing and releases nothing", async () => {
  const h = await setup();
  try {
    await seedOrder(h, "wrong-amount");
    const reserved = await reserveMarketplaceCapture(h.deps, await load(h, "wrong-amount"), reservationRequest);
    // Square reports a payment for this reference but for a different amount.
    h.square.ledger.set(reserved.captureIdempotencyKey!, {
      request: buildSquareCaptureRequest(reserved),
      payment: { id: "sq-mismatch", status: "COMPLETED", referenceId: reserved.captureIdempotencyKey, totalMoney: { amount: 1n, currency: "USD" }, createdAt: new Date().toISOString() },
    });
    const outcome = await reconcileStalledCaptureOrder(h.deps, reserved);
    assert.equal(outcome.kind, "error");
    assertStillReservedWithoutEvidence(await snapshot(h, "wrong-amount"), 8);
  } finally {
    await teardown(h);
  }
});

postgresTest("migrated P1-03 order finalized by replay-free reconciliation does not recount the legacy sale", async () => {
  const h = await setup();
  try {
    await h.admin.query(`UPDATE products SET inventory = 8, sales_count = 1`);
    await seedOrder(h, "legacy-evidence", {
      paymentStatus: "capture_reconciliation",
      paymentProvider: "square",
      inventoryStatus: "reserved",
      captureIdempotencyKey: "legacy-key",
      captureAttemptedAt: new Date(Date.now() - 30 * MINUTE),
      squarePaymentId: "sq-legacy",
      providerPaymentStatus: "COMPLETED",
      paymentCapturedAt: new Date(Date.now() - 30 * MINUTE),
      checkoutIdempotencyKey: "p1-03:legacy-evidence",
      sellerTierSnapshot: "legacy_p1_03",
    });
    const run = await reconcileAbandonedCheckoutReservations({ deps: h.deps, now: later(0) });
    assert.equal(run.finalized, 1);
    const state = await snapshot(h, "legacy-evidence");
    assert.equal(state.order.paymentStatus, "captured");
    assert.equal(state.salesCount, 1, "legacy checkout already counted this sale");
    assert.equal(state.commissionCount, 1);
    assert.equal(state.inventory, 8);
  } finally {
    await teardown(h);
  }
});

// ---------------------------------------------------------------- Finding 2

async function seedAmbiguousBacklog(h: Harness, count: number) {
  const attemptedAt = new Date(Date.now() - 60 * MINUTE);
  for (let i = 0; i < count; i += 1) await seedLegacyPending(h, `a-${String(i).padStart(3, "0")}`, attemptedAt);
}

async function attemptedIds(h: Harness) {
  return new Set((await h.admin.query(`SELECT id FROM orders WHERE reconciliation_attempted_at IS NOT NULL`)).rows.map((row) => row.id as string));
}

postgresTest("a capture_reconciliation row behind 30 permanently ambiguous rows is finalized in the first run", async () => {
  const h = await setup();
  try {
    await seedAmbiguousBacklog(h, 30);
    await seedOrder(h, "z-evidence", {
      paymentStatus: "capture_reconciliation",
      paymentProvider: "square",
      inventoryStatus: "reserved",
      captureIdempotencyKey: "z-key",
      captureAttemptedAt: new Date(Date.now() - 60 * MINUTE),
      squarePaymentId: "sq-z",
      providerPaymentStatus: "COMPLETED",
      paymentCapturedAt: new Date(Date.now() - 60 * MINUTE),
    });
    const run = await reconcileAbandonedCheckoutReservations({ deps: h.deps, now: later(0), limit: 25 });
    assert.equal(run.finalized, 1);
    assert.equal(run.ambiguous, 25, "the pending queue still used its full budget");
    assert.equal((await load(h, "z-evidence")).paymentStatus, "captured");
  } finally {
    await teardown(h);
  }
});

postgresTest("a recoverable reservation behind 30 permanently ambiguous rows is reached; the whole backlog rotates", async () => {
  const h = await setup();
  try {
    await seedAmbiguousBacklog(h, 30);
    await seedOrder(h, "z-recoverable");
    await reserveMarketplaceCapture(h.deps, await load(h, "z-recoverable"), reservationRequest);

    const first = await reconcileAbandonedCheckoutReservations({ deps: h.deps, now: later(3), limit: 25 });
    assert.equal(first.scanned, 25);
    assert.equal(first.ambiguous, 25, "the first full batch stays ambiguous");
    assert.equal((await load(h, "z-recoverable")).paymentStatus, "capture_pending");

    // Rows not yet attempted come before every row already attempted.
    const second = await reconcileAbandonedCheckoutReservations({ deps: h.deps, now: later(8), limit: 25 });
    assert.equal(second.finalized, 1, "the later recoverable reservation makes progress");
    assert.equal((await load(h, "z-recoverable")).paymentStatus, "captured");
    assert.equal((await attemptedIds(h)).size, 31, "every eligible row has now been attempted at least once");

    // Continued runs keep cycling the ambiguous rows without any accounting.
    const seenAcrossRuns = new Set<string>();
    for (const minutes of [13, 18]) {
      const run = await reconcileAbandonedCheckoutReservations({ deps: h.deps, now: later(minutes), limit: 25 });
      run.outcomes.forEach((outcome) => seenAcrossRuns.add(outcome.orderId));
    }
    assert.equal(seenAcrossRuns.size, 30, "two more runs cover all 30 ambiguous rows again -- none is skipped forever");
    assert.equal((await h.admin.query(`SELECT count(*)::int AS n FROM commissions`)).rows[0].n, 1);
    assert.equal(h.square.completedCharges(), 1);
  } finally {
    await teardown(h);
  }
});

postgresTest("a just-attempted row is backed off; untouched rows are claimed first", async () => {
  const h = await setup();
  try {
    await seedAmbiguousBacklog(h, 30);
    await reconcileAbandonedCheckoutReservations({ deps: h.deps, now: later(0), limit: 25 });
    const soon = await reconcileAbandonedCheckoutReservations({ deps: h.deps, now: later(1), limit: 25 });
    assert.equal(soon.scanned, 5, "within the retry interval only the 5 never-attempted rows are eligible");
    assert.ok(soon.outcomes.every((outcome) => ["a-025", "a-026", "a-027", "a-028", "a-029"].includes(outcome.orderId)));
  } finally {
    await teardown(h);
  }
});

postgresTest("concurrent workers claim disjoint batches and never duplicate accounting", async () => {
  const h = await setup(100);
  try {
    await seedAmbiguousBacklog(h, 20);
    for (let i = 0; i < 10; i += 1) {
      const id = `r-${i}`;
      await seedOrder(h, id, { quantity: 1 });
      await reserveMarketplaceCapture(h.deps, await load(h, id), reservationRequest);
    }
    const now = later(3);
    const [a, b, c] = await Promise.all([
      reconcileAbandonedCheckoutReservations({ deps: h.deps, now, limit: 12 }),
      reconcileAbandonedCheckoutReservations({ deps: h.deps, now, limit: 12 }),
      reconcileAbandonedCheckoutReservations({ deps: h.deps, now, limit: 12 }),
    ]);
    const claimed = [...a.outcomes, ...b.outcomes, ...c.outcomes].map((outcome) => outcome.orderId);
    assert.equal(new Set(claimed).size, claimed.length, "no order was claimed by two workers");
    // A worker may claim fewer rows when PostgreSQL re-checks a row another
    // worker just stamped; that only defers it, it never double-claims it.
    assert.ok(claimed.length <= 30);

    for (const minutes of [8, 13]) await reconcileAbandonedCheckoutReservations({ deps: h.deps, now: later(minutes), limit: 12 });
    assert.equal((await attemptedIds(h)).size, 30, "follow-up runs cover every row the concurrent round deferred");
    const captured = (await h.admin.query(`SELECT count(*)::int AS n FROM orders WHERE payment_status = 'captured'`)).rows[0].n;
    assert.equal(captured, 10);
    assert.equal((await h.admin.query(`SELECT count(*)::int AS n FROM commissions`)).rows[0].n, 10, "one commission per captured order");
    assert.equal(h.square.completedCharges(), 10, "one Square charge per order");
    assert.equal((await h.admin.query(`SELECT inventory FROM products`)).rows[0].inventory, 90, "10 units sold, each decremented once");
  } finally {
    await teardown(h);
  }
});
