/**
 * Catering Phase 2Q over real HTTP: the real router, real authentication, the real settlement code, a REAL PostgreSQL built from the
 * Drizzle schema, the REAL Gate 0 connection service and the REAL `square` SDK against a local fake Square. Set TEST_DATABASE_URL to a
 * loopback database whose name contains "test"; skipped otherwise.
 */
import "../test-support/placeholder-database-url";
import "../test-support/accept-test-sessions";
import "../test-support/auth-test-env";
import test from "node:test";
import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import type { AddressInfo } from "node:net";
import express from "express";
import cookieParser from "cookie-parser";
import { signAuthToken } from "../lib/jwt-config";
import { prepareCateringSquareEnvironment, createCateringSquareHarness, type CateringSquareHarness } from "../test-support/catering-square-harness";

prepareCateringSquareEnvironment();
process.env.DATABASE_URL ||= "postgres://u:p@catering-square-http.invalid/none";
const URL_ENV = process.env.TEST_DATABASE_URL?.trim();
const tok = (id: string) => ({ authorization: `Bearer ${signAuthToken({ id, av: 1 } as never)}` });

const WEBHOOK_URL = "https://chefsire.test/api/catering/webhooks/square";
const WEBHOOK_KEY = "catering-webhook-signature-key";
const post = (url: string, headers: Record<string, string>, body: unknown = {}) =>
  fetch(url, { method: "POST", headers: { "content-type": "application/json", ...headers }, body: JSON.stringify(body) });
const sign = (body: string, url = WEBHOOK_URL, key = WEBHOOK_KEY) => createHmac("sha256", key).update(url + body).digest("base64");

if (!URL_ENV) {
  test("Catering Square payments over HTTP (skipped: TEST_DATABASE_URL not set)", { skip: true }, () => {});
} else {
  const { createCateringSquarePaymentsRouter } = await import("./catering-square-payments");

  async function withApp(fn: (ctx: { h: CateringSquareHarness; base: string; configured: { value: boolean } }) => Promise<void>) {
    const h = await createCateringSquareHarness(URL_ENV!);
    const configured = { value: true };
    const app = express();
    app.use(cookieParser());
    app.use(express.json({ verify: (req, _res, buf) => { (req as { rawBody?: string }).rawBody = buf.toString("utf8"); } }));
    app.use("/api/catering", createCateringSquarePaymentsRouter(h.payments, { webhookConfig: () => (configured.value ? { signatureKey: WEBHOOK_KEY, notificationUrl: WEBHOOK_URL } : null) }));
    const server = app.listen(0);
    try { await fn({ h, base: `http://127.0.0.1:${(server.address() as AddressInfo).port}`, configured }); }
    finally { server.close(); await h.cleanup(); }
  }

  async function scene(h: CateringSquareHarness) {
    const providerId = await h.user("provider");
    const customerId = await h.user("customer");
    const connection = await h.connectProvider(providerId);
    const { bookingId, invoiceIds } = await h.booking({ providerId, customerId, invoices: [{ kind: "deposit", amountCents: 40000 }, { kind: "balance", amountCents: 60000 }] });
    return { providerId, customerId, bookingId, invoiceIds, connection };
  }
  const event = (id: string, merchantId: string, orderId: string, type = "payment.updated") => JSON.stringify({
    merchant_id: merchantId, type, event_id: id, created_at: new Date().toISOString(),
    data: { type: "payment", id: "PAYMENT_X", object: { payment: { id: "PAYMENT_X", order_id: orderId, status: "COMPLETED", amount_money: { amount: 999999, currency: "USD" } } } },
  });
  const deliver = (base: string, body: string, signature: string | null = sign(body)) =>
    fetch(`${base}/api/catering/webhooks/square`, { method: "POST", headers: { "content-type": "application/json", ...(signature ? { "x-square-hmacsha256-signature": signature } : {}) }, body });

  /* ----------------------------------------------------------------------------------------------------------- *
   * Pay and status endpoints
   * ----------------------------------------------------------------------------------------------------------- */

  test("POST pay: unauthenticated is refused; the customer gets a safe view; a provider is forbidden; a stranger is not-found; a body may carry no amount", async () => {
    await withApp(async ({ h, base }) => {
      const s = await scene(h);
      const stranger = await h.user("stranger");
      const url = `${base}/api/catering/bookings/${s.bookingId}/billing/invoices/${s.invoiceIds[0]}/pay`;

      assert.equal((await post(url, {})).status, 401);
      assert.equal((await post(url, tok(s.providerId))).status, 403);
      assert.equal((await post(url, tok(stranger))).status, 404);
      assert.equal((await post(url, tok(s.customerId), { amount: 1 })).status, 400, "an amount in the body is refused outright");
      assert.equal((await fetch(url, { method: "POST", headers: { ...tok(s.customerId), "content-type": "text/plain" }, body: "{}" })).status, 415);
      assert.equal((await h.attempts(s.bookingId)).length, 0, "none of those created anything");

      const ok = await post(url, tok(s.customerId));
      assert.equal(ok.status, 200);
      assert.equal(ok.headers.get("cache-control"), "no-store");
      const body = await ok.json();
      assert.equal(body.attempt.state, "pending");
      assert.equal(body.attempt.amountCents, 40000);
      assert.match(body.attempt.checkoutUrl, /^https:\/\/sandbox\.fake\.square\/checkout\//);
      const text = JSON.stringify(body);
      assert.equal(/idempotency|merchant|location|order_id|orderId|paymentLink|squarePaymentId|access|token/i.test(text), false, "no Square internals or credential reach the browser");
      // a second press is the same checkout
      const again = await (await post(url, tok(s.customerId))).json();
      assert.equal(again.attempt.id, body.attempt.id);
      assert.equal(again.reused, true);
      // another booking's invoice id through this booking's path is a plain 404
      const wrong = await post(`${base}/api/catering/bookings/${s.bookingId}/billing/invoices/not-an-invoice/pay`, tok(s.customerId));
      assert.equal(wrong.status, 404);
    });
  });

  test("POST pay answers a refusal with a code a screen can act on, and 202 while Square's answer is uncertain", async () => {
    await withApp(async ({ h, base }) => {
      const s = await scene(h);
      await h.recordProviderPayment(s.bookingId, s.invoiceIds[0], s.providerId, 40000);
      const full = await post(`${base}/api/catering/bookings/${s.bookingId}/billing/invoices/${s.invoiceIds[0]}/pay`, tok(s.customerId));
      assert.equal(full.status, 409);
      assert.equal((await full.json()).code, "catering_square_payment_state");

      h.fake.state.checkoutCreateLosesResponse = true;
      const uncertain = await post(`${base}/api/catering/bookings/${s.bookingId}/billing/invoices/${s.invoiceIds[1]}/pay`, tok(s.customerId));
      assert.equal(uncertain.status, 202);
      const view = await uncertain.json();
      assert.equal(view.attempt.state, "creating");
      assert.equal(view.attempt.checkoutUrl, undefined);
    });
  });

  test("GET status: the customer's check asks Square and credits only on confirmed evidence; the provider reads without triggering Square and sees the Square reference", async () => {
    await withApp(async ({ h, base }) => {
      const s = await scene(h);
      const created = await (await post(`${base}/api/catering/bookings/${s.bookingId}/billing/invoices/${s.invoiceIds[0]}/pay`, tok(s.customerId))).json();
      const status = (userId: string, id = created.attempt.id) => fetch(`${base}/api/catering/bookings/${s.bookingId}/billing/payment-attempts/${id}`, { headers: tok(userId) });

      assert.equal((await status(s.customerId)).status, 200);
      assert.equal((await (await status(s.customerId)).json()).attempt.state, "pending", "the customer returning from Square without a payment is still pending");
      assert.equal((await h.ledger(s.bookingId)).length, 0);

      const order = h.fake.lastOrder()!;
      h.fake.payOrder(order.id);
      const reads = () => h.fake.requests.filter((request) => request.path.startsWith("/v2/orders/")).length;
      const before = reads();
      const asProvider = await (await status(s.providerId)).json();
      assert.equal(asProvider.attempt.state, "pending", "a provider's read does not go to Square");
      assert.equal(reads(), before);

      const done = await (await status(s.customerId)).json();
      assert.equal(done.attempt.state, "completed");
      assert.equal(done.attempt.squarePaymentId, undefined, "a customer is never given a Square id");
      const providerDone = await (await status(s.providerId)).json();
      assert.match(providerDone.attempt.squarePaymentId, /^PAYMENT_/);
      assert.equal(providerDone.attempt.checkoutUrl, undefined);

      assert.equal((await fetch(`${base}/api/catering/bookings/${s.bookingId}/billing/payment-attempts/${created.attempt.id}`)).status, 401);
      assert.equal((await status(await h.user("stranger"))).status, 404);
      assert.equal((await status(s.customerId, "no-such-attempt")).status, 404);
      assert.equal((await h.processorLedger(s.bookingId)).length, 1);
    });
  });

  /* ----------------------------------------------------------------------------------------------------------- *
   * Webhook
   * ----------------------------------------------------------------------------------------------------------- */

  test("webhook: a signature is required, and must be over the exact body, the exact configured URL and the configured key", async () => {
    await withApp(async ({ h, base, configured }) => {
      const s = await scene(h);
      const created = await (await post(`${base}/api/catering/bookings/${s.bookingId}/billing/invoices/${s.invoiceIds[0]}/pay`, tok(s.customerId))).json();
      void created;
      const order = h.fake.lastOrder()!;
      h.fake.payOrder(order.id);
      const body = event("evt-sig", s.connection.merchantId, order.id);

      assert.equal((await deliver(base, body, null)).status, 401, "no signature");
      assert.equal((await deliver(base, body, "AAAA")).status, 401, "garbage signature");
      assert.equal((await deliver(base, body, sign(body, WEBHOOK_URL + "/x"))).status, 401, "signature over another URL");
      assert.equal((await deliver(base, body, sign(body, WEBHOOK_URL, "another-key"))).status, 401, "signature under another key");
      assert.equal((await deliver(base, body, sign(body + " "))).status, 401, "signature over a different body");
      assert.equal((await h.ledger(s.bookingId)).length, 0);
      assert.equal((await h.q(`SELECT 1 FROM catering_square_webhook_events`)).length, 0, "an unsigned delivery is not even recorded");

      configured.value = false;
      assert.equal((await deliver(base, body)).status, 503, "no configured key/URL: fail closed");
      assert.equal((await h.ledger(s.bookingId)).length, 0);
      configured.value = true;
      assert.equal((await deliver(base, body)).status, 200);
      assert.equal((await h.processorLedger(s.bookingId)).length, 1);
    });
  });

  test("webhook: a verified delivery is a TRIGGER; the ledger records what fresh Square evidence says, not what the payload claims", async () => {
    await withApp(async ({ h, base }) => {
      const s = await scene(h);
      await post(`${base}/api/catering/bookings/${s.bookingId}/billing/invoices/${s.invoiceIds[0]}/pay`, tok(s.customerId));
      const order = h.fake.lastOrder()!;
      // The payload claims a completed $9,999.99 payment. Square (asked fresh) shows nothing paid.
      const claim = event("evt-claim", s.connection.merchantId, order.id);
      assert.equal((await deliver(base, claim)).status, 200);
      assert.equal((await h.ledger(s.bookingId)).length, 0);
      // Now Square really has a $400 payment. A NEW delivery credits $400 -- the payload's figure is never used.
      h.fake.payOrder(order.id);
      assert.equal((await deliver(base, event("evt-real", s.connection.merchantId, order.id))).status, 200);
      const ledger = await h.processorLedger(s.bookingId);
      assert.equal(ledger.length, 1);
      assert.equal(Number(ledger[0].amount_cents), 40000);
    });
  });

  test("webhook: a replay of the same event id is acknowledged and never processed twice", async () => {
    await withApp(async ({ h, base }) => {
      const s = await scene(h);
      await post(`${base}/api/catering/bookings/${s.bookingId}/billing/invoices/${s.invoiceIds[0]}/pay`, tok(s.customerId));
      const order = h.fake.lastOrder()!;
      h.fake.payOrder(order.id);
      const body = event("evt-replay", s.connection.merchantId, order.id);
      const reads = () => h.fake.requests.filter((request) => request.path.startsWith("/v2/orders/")).length;
      assert.equal((await deliver(base, body)).status, 200);
      const after = reads();
      for (let i = 0; i < 3; i += 1) assert.equal((await deliver(base, body)).status, 200);
      assert.equal(reads(), after, "a replay does not go back to Square");
      assert.equal((await h.processorLedger(s.bookingId)).length, 1);
      const rows = await h.q(`SELECT event_id, state, attempt_count, outcome FROM catering_square_webhook_events`);
      assert.deepEqual(rows.map((row) => ({ ...row })), [{ event_id: "evt-replay", state: "processed", attempt_count: 1, outcome: "completed" }]);
    });
  });

  test("webhook: concurrent deliveries of different events for one payment produce one ledger credit", async () => {
    await withApp(async ({ h, base }) => {
      const s = await scene(h);
      await post(`${base}/api/catering/bookings/${s.bookingId}/billing/invoices/${s.invoiceIds[0]}/pay`, tok(s.customerId));
      const order = h.fake.lastOrder()!;
      h.fake.payOrder(order.id);
      const responses = await Promise.all(Array.from({ length: 6 }, (_, i) => deliver(base, event(`evt-c-${i}`, s.connection.merchantId, order.id, i % 2 ? "payment.updated" : "order.updated"))));
      assert.ok(responses.every((response) => response.status === 200));
      assert.equal((await h.processorLedger(s.bookingId)).length, 1);
      assert.equal((await h.activity(s.bookingId)).length, 1);
    });
  });

  test("webhook: unrelated, unsupported and wrong-merchant deliveries are acknowledged and change nothing", async () => {
    await withApp(async ({ h, base }) => {
      const s = await scene(h);
      await post(`${base}/api/catering/bookings/${s.bookingId}/billing/invoices/${s.invoiceIds[0]}/pay`, tok(s.customerId));
      const order = h.fake.lastOrder()!;
      h.fake.payOrder(order.id);
      assert.equal((await deliver(base, event("evt-unknown", s.connection.merchantId, "ORDER_NOT_OURS"))).status, 200);
      assert.equal((await deliver(base, event("evt-type", s.connection.merchantId, order.id, "refund.created"))).status, 200);
      assert.equal((await deliver(base, event("evt-merchant", "MERCHANT_ELSEWHERE", order.id))).status, 200);
      assert.equal((await h.ledger(s.bookingId)).length, 0);
      const outcomes = Object.fromEntries((await h.q(`SELECT event_id, state, outcome FROM catering_square_webhook_events`)).map((row) => [row.event_id, `${row.state}:${row.outcome}`]));
      assert.deepEqual(outcomes, { "evt-unknown": "ignored:no_matching_attempt", "evt-type": "ignored:unsupported_event_type", "evt-merchant": "ignored:merchant_mismatch" });
      assert.equal((await deliver(base, "not json")).status, 400);
    });
  });

  test("webhook: when the provider's connection is unavailable the delivery is a retryable 503, and the same event settles once it is back", async () => {
    await withApp(async ({ h, base }) => {
      const s = await scene(h);
      await post(`${base}/api/catering/bookings/${s.bookingId}/billing/invoices/${s.invoiceIds[0]}/pay`, tok(s.customerId));
      const order = h.fake.lastOrder()!;
      h.fake.payOrder(order.id);
      await h.connections.disconnect(s.providerId);
      const body = event("evt-retry", s.connection.merchantId, order.id);
      assert.equal((await deliver(base, body)).status, 503);
      assert.equal((await h.ledger(s.bookingId)).length, 0);
      assert.deepEqual((await h.q(`SELECT state, attempt_count FROM catering_square_webhook_events`)).map((row) => ({ ...row })), [{ state: "failed", attempt_count: 1 }]);

      await h.connectProvider(s.providerId, s.connection.merchantId, { access: "access-back", refresh: "refresh-back" });
      assert.equal((await deliver(base, body)).status, 200, "Square's redelivery of the same event now succeeds");
      assert.equal((await h.processorLedger(s.bookingId)).length, 1);
      assert.deepEqual((await h.q(`SELECT state, attempt_count FROM catering_square_webhook_events`)).map((row) => ({ ...row })), [{ state: "processed", attempt_count: 2 }]);
    });
  });

  test("webhook: with Square configured for production it refuses to process anything", async () => {
    await withApp(async ({ h, base }) => {
      const s = await scene(h);
      await post(`${base}/api/catering/bookings/${s.bookingId}/billing/invoices/${s.invoiceIds[0]}/pay`, tok(s.customerId));
      const order = h.fake.lastOrder()!;
      h.fake.payOrder(order.id);
      process.env.SQUARE_ENV = "production";
      try {
        const before = h.fake.requests.length;
        assert.equal((await deliver(base, event("evt-prod", s.connection.merchantId, order.id))).status, 503);
        assert.equal((await post(`${base}/api/catering/bookings/${s.bookingId}/billing/invoices/${s.invoiceIds[1]}/pay`, tok(s.customerId))).status, 503);
        assert.equal(h.fake.requests.length, before);
      } finally { process.env.SQUARE_ENV = "sandbox"; }
      assert.equal((await h.ledger(s.bookingId)).length, 0);
    });
  });

  test("webhook table keeps identifiers only: no payload, credential or amount is stored", async () => {
    await withApp(async ({ h }) => {
      const columns = (await h.q(`SELECT column_name FROM information_schema.columns WHERE table_name = 'catering_square_webhook_events' ORDER BY column_name`)).map((row) => row.column_name);
      assert.deepEqual(columns, ["attempt_count", "attempt_id", "event_id", "event_type", "id", "merchant_id", "outcome", "processed_at", "received_at", "square_order_id", "square_payment_id", "state", "updated_at"]);
    });
  });
}

/* ------------------------------------------------------------------------------------------------------------- *
 * Booking cancellation closes open Square checkouts (Codex repair pass 1)
 * ------------------------------------------------------------------------------------------------------------- */

if (URL_ENV) {
  const { pool: globalPool } = await import("../db/index");
  const { createCateringSquarePaymentsRouter } = await import("./catering-square-payments");
  const { default: bookingsRouter } = await import("./catering-bookings");
  const { cateringSquarePayments } = await import("../services/catering-square-payments-instance");

  /** The REAL booking router and the REAL cancel route, pointed at the harness database and the fake-Square-backed payment service. */
  async function withBookingApp(fn: (ctx: { h: CateringSquareHarness; base: string }) => Promise<void>) {
    const h = await createCateringSquareHarness(URL_ENV!);
    let server: ReturnType<ReturnType<typeof express>["listen"]> | undefined;
    try {
    (globalPool as never as { connect: unknown }).connect = () => h.pool.connect();
    (globalPool as never as { query: unknown }).query = (q: unknown, params?: unknown[]) => h.pool.query(q as string, params);
    Object.assign(cateringSquarePayments, h.payments);
    const app = express();
    app.use(cookieParser());
    app.use(express.json());
    app.use("/api/catering", bookingsRouter);
    app.use("/api/catering", createCateringSquarePaymentsRouter(h.payments, { webhookConfig: () => null }));
    server = app.listen(0);
    await fn({ h, base: `http://127.0.0.1:${(server.address() as AddressInfo).port}` });
    } finally { server?.close(); await h.cleanup(); }
  }
  async function pendingScene(h: CateringSquareHarness, base: string) {
    const providerId = await h.user("provider");
    const customerId = await h.user("customer");
    const connection = await h.connectProvider(providerId);
    const { bookingId, invoiceIds } = await h.booking({ providerId, customerId, invoices: [{ kind: "deposit", amountCents: 40000 }, { kind: "balance", amountCents: 60000 }] });
    const created = await (await post(`${base}/api/catering/bookings/${bookingId}/billing/invoices/${invoiceIds[0]}/pay`, tok(customerId))).json();
    return { providerId, customerId, bookingId, invoiceIds, connection, attemptId: created.attempt.id as string, orderId: h.fake.lastOrder()!.id, linkId: (await h.attempt(created.attempt.id)).square_payment_link_id as string };
  }
  const cancel = (base: string, bookingId: string, userId: string) => post(`${base}/api/catering/bookings/${bookingId}/cancel`, tok(userId), {});
  const deletes = (h: CateringSquareHarness) => h.fake.requests.filter((request) => request.method === "DELETE").length;

  test("cancelling a booking closes its pending Square attempt in the same commit and removes the Square link", async () => {
    await withBookingApp(async ({ h, base }) => {
      const s = await pendingScene(h, base);
      assert.equal((await h.attempt(s.attemptId)).state, "pending");
      const response = await cancel(base, s.bookingId, s.providerId);
      assert.equal(response.status, 200);
      const row = await h.attempt(s.attemptId);
      assert.equal(row.state, "cancelled");
      assert.ok(row.closed_at);
      assert.equal(h.fake.links.get(s.linkId)!.deleted, true, "Square was asked to close the checkout");
      assert.ok(row.square_link_closed_at, "recorded only because Square confirmed it");
      assert.equal((await h.q(`SELECT status FROM catering_bookings WHERE id = $1`, [s.bookingId]))[0].status, "cancelled");
    });
  });

  test("after cancellation the customer is no longer offered 'Continue to Square checkout': no open attempt and no checkout URL", async () => {
    await withBookingApp(async ({ h, base }) => {
      const s = await pendingScene(h, base);
      await cancel(base, s.bookingId, s.customerId);
      const status = await (await fetch(`${base}/api/catering/bookings/${s.bookingId}/billing/payment-attempts/${s.attemptId}`, { headers: tok(s.customerId) })).json();
      assert.equal(status.attempt.state, "cancelled");
      assert.equal(status.attempt.checkoutUrl, undefined);
      const attempts = await h.payments.attemptsForBooking(h.db as never, s.bookingId);
      assert.equal(attempts.some((attempt: { state: string }) => attempt.state === "pending" || attempt.state === "creating"), false);
      const again = await post(`${base}/api/catering/bookings/${s.bookingId}/billing/invoices/${s.invoiceIds[0]}/pay`, tok(s.customerId));
      assert.equal(again.status, 409, "and a new checkout cannot be opened");
    });
  });

  test("a Square outage during cleanup does not block or undo the cancellation, and the closure is NOT recorded as confirmed", async () => {
    await withBookingApp(async ({ h, base }) => {
      const s = await pendingScene(h, base);
      h.fake.state.linkDeleteFailure = 503;
      const response = await cancel(base, s.bookingId, s.providerId);
      assert.equal(response.status, 200, "cancellation is authoritative");
      const row = await h.attempt(s.attemptId);
      assert.equal(row.state, "cancelled");
      assert.equal(row.square_link_closed_at, null, "unconfirmed: never claimed closed");
      assert.equal(h.fake.links.get(s.linkId)!.deleted, false);
      // A later sweep retries, and only then records the confirmation.
      h.fake.state.linkDeleteFailure = undefined;
      assert.equal(await h.payments.sweepClosedLinks(s.bookingId), 1);
      assert.ok((await h.attempt(s.attemptId)).square_link_closed_at);
      assert.equal(h.fake.links.get(s.linkId)!.deleted, true);
    });
  });

  test("Square's 'already gone' (404) counts as confirmed; any other refusal does not", async () => {
    await withBookingApp(async ({ h, base }) => {
      const s = await pendingScene(h, base);
      h.fake.state.linkDeleteFailure = 422;
      await cancel(base, s.bookingId, s.providerId);
      assert.equal((await h.attempt(s.attemptId)).square_link_closed_at, null);
      h.fake.state.linkDeleteFailure = 404;
      assert.equal(await h.payments.sweepClosedLinks(s.bookingId), 1);
      assert.ok((await h.attempt(s.attemptId)).square_link_closed_at);
    });
  });

  test("cancellation and cleanup are idempotent: a repeat is refused, and a repeated sweep makes no further Square calls", async () => {
    await withBookingApp(async ({ h, base }) => {
      const s = await pendingScene(h, base);
      assert.equal((await cancel(base, s.bookingId, s.providerId)).status, 200);
      const after = deletes(h);
      assert.equal(after, 1);
      assert.equal((await cancel(base, s.bookingId, s.providerId)).status, 409);
      assert.equal(await h.payments.sweepClosedLinks(s.bookingId), 0);
      assert.equal(await h.payments.closeStaleOpenAttempts(s.bookingId), 0);
      assert.equal(deletes(h), after, "nothing is deleted twice");
      assert.equal((await h.attempts(s.bookingId)).length, 1);
    });
  });

  test("a webhook or poll after cancellation with no money moved stays terminal and credits nothing", async () => {
    await withBookingApp(async ({ h, base }) => {
      const s = await pendingScene(h, base);
      await cancel(base, s.bookingId, s.providerId);
      for (let i = 0; i < 2; i += 1) {
        assert.equal((await h.payments.handleWebhookEvent({ eventId: `evt-nomoney-${i}`, eventType: "payment.updated", merchantId: s.connection.merchantId, orderId: s.orderId, paymentId: null })).kind, "processed");
        await h.payments.getAttempt({ bookingId: s.bookingId, attemptId: s.attemptId, userId: s.customerId });
      }
      assert.equal((await h.attempt(s.attemptId)).state, "cancelled");
      assert.equal((await h.ledger(s.bookingId)).length, 0);
    });
  });

  test("money confirmed after cancellation (the link could not be closed in time) keeps its evidence and enters reconciliation, once", async () => {
    await withBookingApp(async ({ h, base }) => {
      const s = await pendingScene(h, base);
      h.fake.state.linkDeleteFailure = 503;
      await cancel(base, s.bookingId, s.providerId);
      const payment = h.fake.payOrder(s.orderId);
      const results = await Promise.all([1, 2, 3].map(() => h.payments.settleAttempt(s.attemptId)));
      assert.ok(results.every((result) => result.outcome === "reconciliation_required" || result.outcome === "already_settled"));
      const row = await h.attempt(s.attemptId);
      assert.equal(row.state, "reconciliation_required");
      assert.equal(row.reconciliation_reason, "booking_cancelled");
      assert.equal(row.square_payment_id, payment.id);
      assert.equal(Number(row.processor_amount_cents), 40000);
      assert.equal((await h.ledger(s.bookingId)).length, 0, "no normal credit against a cancelled booking, and no duplicate");
      assert.equal(h.fake.requests.some((request) => request.method === "POST" && /refund/.test(request.path)), false);
    });
  });

  test("cancellation racing a settlement ends consistently: one credit or one reconciliation, never both, never two", async () => {
    await withBookingApp(async ({ h, base }) => {
      const s = await pendingScene(h, base);
      h.fake.payOrder(s.orderId);
      const [cancelled] = await Promise.all([cancel(base, s.bookingId, s.providerId), h.payments.settleAttempt(s.attemptId), h.payments.settleAttempt(s.attemptId)]);
      assert.equal(cancelled.status, 200);
      const row = await h.attempt(s.attemptId);
      assert.ok(row.state === "completed" || row.state === "reconciliation_required", row.state);
      const credits = await h.processorLedger(s.bookingId);
      assert.equal(credits.length, row.state === "completed" ? 1 : 0);
    });
  });
}
