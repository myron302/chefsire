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
  const { default: billingRouter } = await import("./catering-booking-billing");
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
    app.use("/api/catering", billingRouter);
    app.use("/api/catering", createCateringSquarePaymentsRouter(h.payments, { webhookConfig: () => null, payLimiter: (_req, _res, next) => next(), statusLimiter: (_req, _res, next) => next() }));
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
      // A later sweep retries (after its backoff), and only then records the confirmation.
      h.fake.state.linkDeleteFailure = undefined;
      h.setClock(new Date(Date.now() + 60_000));
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
      h.setClock(new Date(Date.now() + 60_000));
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

/* ------------------------------------------------------------------------------------------------------------- *
 * Codex repair pass 2: a locally closed attempt keeps retrying its Square link removal until Square confirms
 * ------------------------------------------------------------------------------------------------------------- */

if (URL_ENV) {
  const { pool: globalPool } = await import("../db/index");
  const { createCateringSquarePaymentsRouter } = await import("./catering-square-payments");
  const { default: bookingsRouter } = await import("./catering-bookings");
  const { default: billingRouter } = await import("./catering-booking-billing");
  const { cateringSquarePayments } = await import("../services/catering-square-payments-instance");

  async function withCleanupApp(fn: (ctx: { h: CateringSquareHarness; base: string }) => Promise<void>) {
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
      app.use("/api/catering", billingRouter);
      app.use("/api/catering", createCateringSquarePaymentsRouter(h.payments, { webhookConfig: () => null, payLimiter: (_req, _res, next) => next(), statusLimiter: (_req, _res, next) => next() }));
      server = app.listen(0);
      await fn({ h, base: `http://127.0.0.1:${(server.address() as AddressInfo).port}` });
    } finally { server?.close(); await h.cleanup(); }
  }
  async function cancelledDuringOutage(h: CateringSquareHarness, base: string) {
    const providerId = await h.user("provider");
    const customerId = await h.user("customer");
    const connection = await h.connectProvider(providerId);
    const { bookingId, invoiceIds } = await h.booking({ providerId, customerId, invoices: [{ kind: "deposit", amountCents: 40000 }] });
    const created = await (await post(`${base}/api/catering/bookings/${bookingId}/billing/invoices/${invoiceIds[0]}/pay`, tok(customerId))).json();
    const attemptId = created.attempt.id as string;
    const row = await h.attempt(attemptId);
    h.fake.state.linkDeleteFailure = 503;
    const cancelled = await post(`${base}/api/catering/bookings/${bookingId}/cancel`, tok(providerId), {});
    return { providerId, customerId, bookingId, connection, attemptId, orderId: row.square_order_id as string, linkId: row.square_payment_link_id as string, cancelled };
  }
  const deleteCalls = (h: CateringSquareHarness) => h.fake.requests.filter((request) => request.method === "DELETE").length;
  const later = (h: CateringSquareHarness, seconds: number) => h.setClock(new Date(Date.now() + seconds * 1000));
  const statusOf = (base: string, s: { bookingId: string; attemptId: string }, userId: string) =>
    fetch(`${base}/api/catering/bookings/${s.bookingId}/billing/payment-attempts/${s.attemptId}`, { headers: tok(userId) });
  const until = async (condition: () => Promise<boolean>) => { for (let i = 0; i < 100; i += 1) { if (await condition()) return true; await new Promise((resolve) => setTimeout(resolve, 50)); } return false; };

  test("P1: a Square outage during cancellation leaves the attempt locally cancelled with external cleanup UNCONFIRMED, and the cancellation stands", async () => {
    await withCleanupApp(async ({ h, base }) => {
      const s = await cancelledDuringOutage(h, base);
      assert.equal(s.cancelled.status, 200);
      const row = await h.attempt(s.attemptId);
      assert.equal(row.state, "cancelled");
      assert.equal(row.square_link_closed_at, null);
      assert.equal(Number(row.square_link_close_attempts), 1);
      assert.equal(h.fake.links.get(s.linkId)!.deleted, false, "the saved checkout URL is still live at Square");
    });
  });

  test("P1: a later customer status check retries the Square deletion although the attempt is already cancelled, and only then records closure", async () => {
    await withCleanupApp(async ({ h, base }) => {
      const s = await cancelledDuringOutage(h, base);
      h.fake.state.linkDeleteFailure = undefined;
      later(h, 60);
      const status = await (await statusOf(base, s, s.customerId)).json();
      assert.equal(status.attempt.state, "cancelled");
      assert.equal(status.attempt.checkoutUrl, undefined);
      assert.equal(h.fake.links.get(s.linkId)!.deleted, true, "the live link was finally closed");
      const row = await h.attempt(s.attemptId);
      assert.ok(row.square_link_closed_at);
      assert.equal(Number(row.square_link_close_attempts), 2);
    });
  });

  test("P1: a provider's status read and a billing read by either participant are retry paths too", async () => {
    await withCleanupApp(async ({ h, base }) => {
      const a = await cancelledDuringOutage(h, base);
      h.fake.state.linkDeleteFailure = undefined;
      later(h, 60);
      assert.equal((await statusOf(base, a, a.providerId)).status, 200);
      assert.equal(h.fake.links.get(a.linkId)!.deleted, true, "provider status read");

      const b = await cancelledDuringOutage(h, base);
      h.fake.state.linkDeleteFailure = undefined;
      later(h, 7200);
      assert.equal((await fetch(`${base}/api/catering/bookings/${b.bookingId}/billing`, { headers: tok(b.customerId) })).status, 200);
      assert.ok(await until(async () => Boolean((await h.attempt(b.attemptId)).square_link_closed_at)), "customer billing read");

      const c = await cancelledDuringOutage(h, base);
      h.fake.state.linkDeleteFailure = undefined;
      later(h, 14400);
      assert.equal((await fetch(`${base}/api/catering/bookings/${c.bookingId}/billing`, { headers: tok(c.providerId) })).status, 200);
      assert.ok(await until(async () => Boolean((await h.attempt(c.attemptId)).square_link_closed_at)), "provider billing read");
    });
  });

  test("P1: retries are rate-limited with growing backoff, never hammer Square, yet never stop while the link is unconfirmed", async () => {
    await withCleanupApp(async ({ h, base }) => {
      const s = await cancelledDuringOutage(h, base);
      assert.equal(deleteCalls(h), 1);
      for (let i = 0; i < 5; i += 1) await statusOf(base, s, s.customerId);
      assert.equal(deleteCalls(h), 1, "inside the backoff window no further call is made");
      later(h, 31);
      await statusOf(base, s, s.customerId);
      assert.equal(deleteCalls(h), 2, "after 30s one retry");
      later(h, 31 + 31);
      await statusOf(base, s, s.customerId);
      assert.equal(deleteCalls(h), 2, "the second backoff is 60s, not 30s");
      later(h, 31 + 61);
      await statusOf(base, s, s.customerId);
      assert.equal(deleteCalls(h), 3);
      later(h, 100_000);
      for (let i = 0; i < 3; i += 1) await statusOf(base, s, s.customerId);
      assert.equal(deleteCalls(h), 4, "capped at 15 minutes, and still retrying long after");
      assert.equal(Number((await h.attempt(s.attemptId)).square_link_close_attempts), 4);
    });
  });

  test("P1: concurrent sweeps share one Square call, and a repeat after success is a no-op (idempotent)", async () => {
    await withCleanupApp(async ({ h, base }) => {
      const s = await cancelledDuringOutage(h, base);
      h.fake.state.linkDeleteFailure = undefined;
      later(h, 60);
      const results = await Promise.all(Array.from({ length: 6 }, () => h.payments.sweepClosedLinks(s.bookingId)));
      assert.equal(results.reduce((total, n) => total + n, 0), 1);
      assert.equal(deleteCalls(h), 2, "the failed first call and exactly one retry");
      const closedAt = (await h.attempt(s.attemptId)).square_link_closed_at;
      later(h, 100_000);
      assert.equal(await h.payments.sweepClosedLinks(s.bookingId), 0);
      assert.equal(deleteCalls(h), 2);
      assert.deepEqual((await h.attempt(s.attemptId)).square_link_closed_at, closedAt);
    });
  });

  test("P1: Square reporting the link already gone (404) closes the external state; any other refusal keeps it open", async () => {
    await withCleanupApp(async ({ h, base }) => {
      const s = await cancelledDuringOutage(h, base);
      h.fake.state.linkDeleteFailure = 422;
      later(h, 60);
      await statusOf(base, s, s.customerId);
      assert.equal((await h.attempt(s.attemptId)).square_link_closed_at, null);
      h.fake.state.linkDeleteFailure = 404;
      later(h, 200);
      await statusOf(base, s, s.customerId);
      assert.ok((await h.attempt(s.attemptId)).square_link_closed_at);
    });
  });

  test("P1: a supersession and a withdrawn invoice also leave retryable external state, not just a cancellation", async () => {
    await withCleanupApp(async ({ h, base }) => {
      const providerId = await h.user("provider");
      const customerId = await h.user("customer");
      await h.connectProvider(providerId);
      const { bookingId, invoiceIds } = await h.booking({ providerId, customerId, invoices: [{ kind: "deposit", amountCents: 40000 }, { kind: "balance", amountCents: 60000 }] });
      const open = async (index: number) => (await (await post(`${base}/api/catering/bookings/${bookingId}/billing/invoices/${invoiceIds[index]}/pay`, tok(customerId))).json()).attempt.id as string;
      const first = await open(0);
      h.fake.state.linkDeleteFailure = 503;
      await h.recordProviderPayment(bookingId, invoiceIds[0], providerId, 10000);
      const second = await open(0); // supersedes `first`; its link removal fails
      assert.equal((await h.attempt(first)).state, "superseded");
      assert.equal((await h.attempt(first)).square_link_closed_at, null);
      const balance = await open(1);
      await h.voidInvoice(invoiceIds[1], providerId);
      await h.payments.closeStaleOpenAttempts(bookingId);
      assert.equal((await h.attempt(balance)).state, "cancelled");
      assert.equal((await h.attempt(balance)).square_link_closed_at, null);
      h.fake.state.linkDeleteFailure = undefined;
      later(h, 3600);
      await h.payments.sweepClosedLinks(bookingId);
      assert.ok((await h.attempt(first)).square_link_closed_at && (await h.attempt(balance)).square_link_closed_at);
      assert.equal((await h.attempt(second)).square_link_closed_at, null, "an attempt that is still open is untouched");
      assert.equal((await h.attempt(second)).state, "pending");
    });
  });

  test("P1: if money moves before a cleanup retry succeeds the authoritative evidence goes to reconciliation: one record, no credit, no refund, no clamp", async () => {
    await withCleanupApp(async ({ h, base }) => {
      const s = await cancelledDuringOutage(h, base);
      const payment = h.fake.payOrder(s.orderId);
      h.fake.state.linkDeleteFailure = undefined;
      later(h, 60);
      await Promise.all([statusOf(base, s, s.customerId), statusOf(base, s, s.customerId), h.payments.settleAttempt(s.attemptId)]);
      const row = await h.attempt(s.attemptId);
      assert.equal(row.state, "reconciliation_required");
      assert.equal(row.reconciliation_reason, "booking_cancelled");
      assert.equal(row.square_payment_id, payment.id);
      assert.equal(Number(row.processor_amount_cents), 40000);
      assert.equal((await h.ledger(s.bookingId)).length, 0);
      assert.equal(h.fake.requests.some((request) => request.method === "POST" && /refund/.test(request.path)), false);
      const provider = await (await statusOf(base, s, s.providerId)).json();
      assert.equal(provider.attempt.squarePaymentId, payment.id);
      assert.equal(provider.attempt.processorAmountCents, 40000);
    });
  });

  test("P1: no token or secret appears in any log, response or row during the failed and retried cleanup", async () => {
    await withCleanupApp(async ({ h, base }) => {
      const s = await cancelledDuringOutage(h, base);
      h.fake.state.linkDeleteFailure = undefined;
      later(h, 60);
      const body = JSON.stringify([await (await statusOf(base, s, s.customerId)).json(), await (await statusOf(base, s, s.providerId)).json(), h.logs, await h.attempts(s.bookingId)]);
      assert.equal(body.includes(s.connection.accessToken), false);
      assert.equal(body.includes(`refresh-${s.providerId}`), false);
    });
  });
}

/* ------------------------------------------------------------------------------------------------------------- *
 * Codex repair pass 4: amendments, disconnect/reconnect and the stale-checkout lifecycle
 * ------------------------------------------------------------------------------------------------------------- */

if (URL_ENV) {
  const { pool: globalPool } = await import("../db/index");
  const { createCateringSquarePaymentsRouter } = await import("./catering-square-payments");
  const { default: bookingsRouter } = await import("./catering-bookings");
  const { default: billingRouter } = await import("./catering-booking-billing");
  const { default: amendmentsRouter } = await import("./catering-booking-amendments");
  const { cateringSquarePayments } = await import("../services/catering-square-payments-instance");
  const { SquareCredentialDiscardBlockedError } = await import("../lib/square-connection-service");
  const { randomUUID } = await import("node:crypto");

  async function withLifecycleApp(fn: (ctx: { h: CateringSquareHarness; base: string }) => Promise<void>) {
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
      app.use("/api/catering", billingRouter);
      app.use("/api/catering", amendmentsRouter);
      app.use("/api/catering", createCateringSquarePaymentsRouter(h.payments, { webhookConfig: () => null, payLimiter: (_req, _res, next) => next(), statusLimiter: (_req, _res, next) => next() }));
      server = app.listen(0);
      await fn({ h, base: `http://127.0.0.1:${(server.address() as AddressInfo).port}` });
    } finally { server?.close(); await h.cleanup(); }
  }
  async function scene(h: CateringSquareHarness, base: string) {
    const providerId = await h.user("provider");
    const customerId = await h.user("customer");
    const connection = await h.connectProvider(providerId);
    const { bookingId, invoiceIds } = await h.booking({ providerId, customerId, invoices: [{ kind: "deposit", amountCents: 40000 }, { kind: "balance", amountCents: 60000 }] });
    const open = async (index: number) => (await (await post(`${base}/api/catering/bookings/${bookingId}/billing/invoices/${invoiceIds[index]}/pay`, tok(customerId))).json()).attempt.id as string;
    return { providerId, customerId, connection, bookingId, invoiceIds, open };
  }
  const amend = async (base: string, s: { bookingId: string; providerId: string; customerId: string }, body: Record<string, unknown>) => {
    const proposed = await post(`${base}/api/catering/bookings/${s.bookingId}/amendments`, tok(s.providerId), { expectedBaseAmendmentId: null, clientRequestId: randomUUID(), ...body });
    assert.ok(proposed.status === 201, `proposal ${proposed.status}`);
    const { amendments } = await proposed.json() as { amendments: { pending: { id: string } } };
    const id = amendments.pending.id;
    const accepted = await post(`${base}/api/catering/bookings/${s.bookingId}/amendments/${id}/accept`, tok(s.customerId), {});
    if (accepted.status !== 200 && process.env.DEBUG_AMEND) console.error(await accepted.clone().text());
    return { id, accepted };
  };
  const billingView = async (base: string, bookingId: string, userId: string) => (await fetch(`${base}/api/catering/bookings/${bookingId}/billing`, { headers: tok(userId) })).json() as Promise<{ paymentAttempts: { id: string; state: string; checkoutUrl?: string }[]; invoices: { id: string; payableCents: number }[] }>;
  const later = (h: CateringSquareHarness, seconds: number) => h.setClock(new Date(Date.now() + seconds * 1000));

  // NOTE on what an amendment can and cannot do: billing refuses a price change that would leave the live invoices asking for more than is owed
  // (`billing_reconciliation_blocked`), so an accepted price REDUCTION never takes an invoice's payable below its remaining balance. What an accepted
  // amendment can do is change the ledger under a checkout that an earlier credit/payment had already made stale without a sweep having run. The
  // hook judges every open checkout against the NEW ledger after the amendment commits, and these tests prove exactly that, plus that a reduction
  // that leaves a checkout valid does not destroy it.

  test("P1 amendment: accepting an amendment closes a checkout the ledger no longer supports (local state and the Square link), and a fresh one uses the new amount", async () => {
    await withLifecycleApp(async ({ h, base }) => {
      const s = await scene(h, base);
      const balance = await s.open(1);
      const row = await h.attempt(balance);
      assert.equal(Number(row.amount_cents), 60000);
      // a credit lands WITHOUT any sweep running (written straight to the ledger), so the $600 checkout is stale and still live
      await h.adjustment(s.bookingId, s.providerId, "credit", 30000);
      assert.equal((await h.attempt(balance)).state, "pending");
      const { accepted } = await amend(base, s, { guestCount: 120 }); // any accepted amendment re-judges the booking's open checkouts
      assert.equal(accepted.status, 200);
      const after = await h.attempt(balance);
      assert.equal(after.state, "cancelled", "the stale checkout was identified against the NEW ledger and closed");
      assert.equal(h.fake.links.get(row.square_payment_link_id)!.deleted, true);
      assert.ok(after.square_link_closed_at);
      const view = await billingView(base, s.bookingId, s.customerId);
      assert.equal(view.paymentAttempts.some((attempt) => attempt.state === "pending" || attempt.checkoutUrl), false, "never offered again");
      const fresh = await s.open(1);
      assert.notEqual(fresh, balance);
      assert.equal(Number((await h.attempt(fresh)).amount_cents), view.invoices.find((invoice) => invoice.id === s.invoiceIds[1])!.payableCents);
      assert.equal((await h.attempt(fresh)).state, "pending");
    });
  });

  test("P1 amendment: a price reduction that leaves the checkout valid does NOT destroy it, and replaying the acceptance or the cleanup changes nothing", async () => {
    await withLifecycleApp(async ({ h, base }) => {
      const providerId = await h.user("provider");
      const customerId = await h.user("customer");
      const connection = await h.connectProvider(providerId);
      const { bookingId, invoiceIds } = await h.booking({ providerId, customerId, invoices: [{ kind: "deposit", amountCents: 40000 }] });
      const s = { providerId, customerId, bookingId, connection };
      const deposit = (await (await post(`${base}/api/catering/bookings/${bookingId}/billing/invoices/${invoiceIds[0]}/pay`, tok(customerId))).json()).attempt.id as string;
      const { id, accepted } = await amend(base, s, { priceCents: 50000 }); // $1000 -> $500: still covers the $400 deposit
      assert.equal(accepted.status, 200);
      const credits = await h.q(`SELECT entry_kind, amount_cents FROM catering_booking_adjustments WHERE booking_id = $1`, [bookingId]);
      assert.deepEqual(credits.map((entry) => [entry.entry_kind, Number(entry.amount_cents)]), [["credit", 50000]]);
      assert.equal((await h.attempt(deposit)).state, "pending", "still exactly what is payable, so it stays");
      const replay = await post(`${base}/api/catering/bookings/${bookingId}/amendments/${id}/accept`, tok(customerId), {});
      assert.equal(replay.status, 200);
      for (let i = 0; i < 3; i += 1) { await h.payments.closeStaleOpenAttempts(bookingId); await billingView(base, bookingId, customerId); }
      assert.equal(Number((await h.q(`SELECT count(*) AS n FROM catering_booking_adjustments WHERE booking_id = $1`, [bookingId]))[0].n), 1, "no duplicate credit");
      assert.equal((await h.attempt(deposit)).state, "pending");
      assert.equal(h.fake.requests.filter((request) => request.method === "DELETE").length, 0);
      assert.equal((await h.attempts(bookingId)).length, 1);
    });
  });

  test("P1 amendment: an amendment that changes nothing money-related leaves every valid checkout open; only the stale one is closed", async () => {
    await withLifecycleApp(async ({ h, base }) => {
      const s = await scene(h, base);
      const deposit = await s.open(0);
      const balance = await s.open(1);
      await amend(base, s, { guestCount: 80 });
      assert.equal((await h.attempt(deposit)).state, "pending");
      assert.equal((await h.attempt(balance)).state, "pending");
      await h.adjustment(s.bookingId, s.providerId, "credit", 30000); // makes only the balance checkout stale
      const latest = (await h.q(`SELECT id FROM catering_booking_amendments WHERE booking_id = $1 ORDER BY amendment_number DESC LIMIT 1`, [s.bookingId]))[0].id;
      const second = await post(`${base}/api/catering/bookings/${s.bookingId}/amendments`, tok(s.providerId), { expectedBaseAmendmentId: latest, clientRequestId: randomUUID(), guestCount: 90 });
      assert.equal(second.status, 201);
      const pendingId = (await second.json() as { amendments: { pending: { id: string } } }).amendments.pending.id;
      assert.equal((await post(`${base}/api/catering/bookings/${s.bookingId}/amendments/${pendingId}/accept`, tok(s.customerId), {})).status, 200);
      assert.equal((await h.attempt(deposit)).state, "pending", "the deposit checkout is still exactly what is payable");
      assert.equal((await h.attempt(balance)).state, "cancelled");
    });
  });

  test("P1 amendment: if Square cannot be reached the stale checkout is still closed locally, never shown as current, and its link keeps being retried", async () => {
    await withLifecycleApp(async ({ h, base }) => {
      const s = await scene(h, base);
      const balance = await s.open(1);
      await h.adjustment(s.bookingId, s.providerId, "credit", 30000);
      h.fake.state.linkDeleteFailure = 503;
      await amend(base, s, { guestCount: 120 });
      const row = await h.attempt(balance);
      assert.equal(row.state, "cancelled");
      assert.equal(row.square_link_closed_at, null, "unconfirmed, and not claimed otherwise");
      assert.equal((await billingView(base, s.bookingId, s.customerId)).paymentAttempts.some((attempt) => attempt.checkoutUrl), false);
      h.fake.state.linkDeleteFailure = undefined;
      later(h, 60);
      await billingView(base, s.bookingId, s.customerId);
      await new Promise((resolve) => setTimeout(resolve, 300));
      assert.ok((await h.attempt(balance)).square_link_closed_at);
    });
  });

  test("a billing view never OFFERS an open checkout the ledger no longer supports, even before the sweep has closed it", async () => {
    await withLifecycleApp(async ({ h, base }) => {
      const s = await scene(h, base);
      const balance = await s.open(1);
      await h.adjustment(s.bookingId, s.providerId, "credit", 30000);
      // read through the view WITHOUT the stale sweep having a chance: the snapshot itself filters
      const { snapshotBillingView } = await import("./catering-booking-billing");
      const view = await snapshotBillingView({ id: s.bookingId, userId: s.customerId, asOfDate: "2030-01-01" }) as { paymentAttempts: { id: string }[] };
      assert.equal(view.paymentAttempts.some((attempt) => attempt.id === balance), false);
      const providerView = await snapshotBillingView({ id: s.bookingId, userId: s.providerId, asOfDate: "2030-01-01" }) as { paymentAttempts: { id: string }[] };
      assert.equal(providerView.paymentAttempts.some((attempt) => attempt.id === balance), true, "the provider still sees it, truthfully");
    });
  });

  test("P1 cross-cutting: a credit, a recorded payment and an invoice withdrawal each leave no obsolete checkout on offer", async () => {
    await withLifecycleApp(async ({ h, base }) => {
      const s = await scene(h, base);
      const deposit = await s.open(0);
      const balance = await s.open(1);
      await h.adjustment(s.bookingId, s.providerId, "credit", 30000);       // balance payable 600 -> 300
      await h.recordProviderPayment(s.bookingId, s.invoiceIds[0], s.providerId, 40000); // deposit paid elsewhere
      const view = await billingView(base, s.bookingId, s.customerId);
      assert.equal(view.paymentAttempts.some((attempt) => (attempt.id === deposit || attempt.id === balance) && (attempt.state === "pending" || attempt.checkoutUrl !== undefined)), false);
      assert.equal((await h.attempt(deposit)).state, "cancelled");
      assert.equal((await h.attempt(balance)).state, "cancelled");
      const third = await s.open(1);
      await h.voidInvoice(s.invoiceIds[1], s.providerId);
      await billingView(base, s.bookingId, s.customerId);
      assert.equal((await h.attempt(third)).state, "cancelled");
    });
  });

  /* ------------------------------- disconnect / reconnect ------------------------------- */

  test("P1 disconnect: a live pending checkout is closed with the OLD credential BEFORE it is discarded, the attempt is non-payable, and the customer is not handed it", async () => {
    await withLifecycleApp(async ({ h, base }) => {
      const s = await scene(h, base);
      const attemptId = await s.open(0);
      const row = await h.attempt(attemptId);
      const result = await h.connections.disconnect(s.providerId);
      assert.equal(result.changed, true);
      const del = h.fake.requests.find((request) => request.method === "DELETE")!;
      assert.equal(del.authorization, `Bearer ${s.connection.accessToken}`, "deleted with the provider's OLD credential");
      const revokeIndex = h.fake.requests.findIndex((request) => request.path === "/oauth2/revoke");
      assert.ok(h.fake.requests.indexOf(del) < revokeIndex, "the link was deleted before the credential was revoked");
      const after = await h.attempt(attemptId);
      assert.equal(after.state, "cancelled");
      assert.ok(after.square_link_closed_at);
      assert.equal(h.fake.links.get(row.square_payment_link_id)!.deleted, true);
      const status = await (await fetch(`${base}/api/catering/bookings/${s.bookingId}/billing/payment-attempts/${attemptId}`, { headers: tok(s.customerId) })).json();
      assert.equal(status.attempt.state, "cancelled");
      assert.equal(status.attempt.checkoutUrl, undefined);
      assert.equal((await post(`${base}/api/catering/bookings/${s.bookingId}/billing/invoices/${s.invoiceIds[0]}/pay`, tok(s.customerId))).status, 409, "and nothing new can be opened on a disconnected provider");
    });
  });

  test("P1 disconnect: if the checkout cannot be closed the disconnect is REFUSED, the credential is untouched, and nothing is orphaned; it succeeds once Square answers", async () => {
    await withLifecycleApp(async ({ h, base }) => {
      const s = await scene(h, base);
      const attemptId = await s.open(0);
      const before = await h.row(s.providerId);
      h.fake.state.linkDeleteFailure = 503;
      await assert.rejects(h.connections.disconnect(s.providerId), SquareCredentialDiscardBlockedError);
      const after = await h.row(s.providerId);
      assert.equal(after.account_status, "active");
      assert.equal(after.encrypted_access_token, before.encrypted_access_token, "the old credential was not discarded");
      assert.equal(h.fake.calls("/oauth2/revoke"), 0, "nothing was revoked at Square");
      assert.equal((await h.attempt(attemptId)).state, "cancelled", "locally non-payable already");
      assert.equal((await h.attempt(attemptId)).square_link_closed_at, null);
      // refused again, still safely (repeated disconnect)
      await assert.rejects(h.connections.disconnect(s.providerId), SquareCredentialDiscardBlockedError);
      h.fake.state.linkDeleteFailure = undefined;
      const result = await h.connections.disconnect(s.providerId);
      assert.equal(result.changed, true);
      assert.ok((await h.attempt(attemptId)).square_link_closed_at);
      assert.equal((await h.connections.disconnect(s.providerId)).changed, false, "a repeat after success is a no-op");
    });
  });

  test("P1 disconnect over HTTP: the provider is told it is refused with a stable code, and no token is exposed", async () => {
    await withLifecycleApp(async ({ h, base }) => {
      const s = await scene(h, base);
      await s.open(0);
      h.fake.state.linkDeleteFailure = 503;
      const { createSquareConnectionRouter } = await import("./square-connection");
      const app = express();
      app.use(express.json());
      app.use("/api/square-connection", createSquareConnectionRouter(h.connections));
      const server = app.listen(0);
      try {
        const url = `http://127.0.0.1:${(server.address() as AddressInfo).port}/api/square-connection/disconnect`;
        const response = await fetch(url, { method: "POST", headers: { "content-type": "application/json", ...tok(s.providerId) }, body: "{}" });
        assert.equal(response.status, 409);
        const body = await response.json();
        assert.equal(body.code, "connection_in_use");
        assert.equal(JSON.stringify(body).includes(s.connection.accessToken), false);
        assert.equal((await h.row(s.providerId)).account_status, "active");
      } finally { server.close(); }
    });
  });

  test("P1 reconnect to a DIFFERENT merchant: the old checkout is closed with the old credential first and can never be used or settled under the new merchant", async () => {
    await withLifecycleApp(async ({ h, base }) => {
      const s = await scene(h, base);
      const attemptId = await s.open(0);
      const row = await h.attempt(attemptId);
      h.fake.payOrder(row.square_order_id);
      // the callback's guard, exactly as the route calls it
      assert.deepEqual(await h.connections.guardCredentialReplacement(s.providerId, "MERCHANT_NEW"), { allowed: true });
      assert.equal(h.fake.links.get(row.square_payment_link_id)!.deleted, true, "closed under the OLD merchant");
      const after = await h.attempt(attemptId);
      assert.equal(after.state, "cancelled");
      assert.equal(after.merchant_id, s.connection.merchantId, "the attempt keeps the merchant it was created for");
      await h.connectProvider(s.providerId, "MERCHANT_NEW", { access: "access-new", refresh: "refresh-new" });
      const settled = await h.payments.settleAttempt(attemptId);
      assert.equal(settled.outcome === "unavailable" && settled.reason, "merchant_changed", "the new merchant's credential is never used to judge the old order");
      assert.equal((await h.ledger(s.bookingId)).length, 0);
      const fresh = await (await post(`${base}/api/catering/bookings/${s.bookingId}/billing/invoices/${s.invoiceIds[0]}/pay`, tok(s.customerId))).json();
      assert.notEqual(fresh.attempt.id, attemptId);
      assert.equal((await h.attempt(fresh.attempt.id)).merchant_id, "MERCHANT_NEW");
    });
  });

  test("P1 reconnect to a different merchant is refused while the old checkout cannot be closed, and the old connection stays exactly as it was", async () => {
    await withLifecycleApp(async ({ h, base }) => {
      const s = await scene(h, base);
      await s.open(0);
      h.fake.state.linkDeleteFailure = 503;
      assert.deepEqual(await h.connections.guardCredentialReplacement(s.providerId, "MERCHANT_NEW"), { allowed: false });
      const row = await h.row(s.providerId);
      assert.equal(row.provider_id, s.connection.merchantId);
      assert.equal(row.account_status, "active");
    });
  });

  test("P1 reconnect: re-authorizing the SAME merchant never closes or revives anything, and repeating the callback is harmless", async () => {
    await withLifecycleApp(async ({ h, base }) => {
      const s = await scene(h, base);
      const live = await s.open(0);
      const closed = await s.open(1);
      await h.q(`UPDATE catering_booking_payment_attempts SET state = 'cancelled', closed_at = now() WHERE id = $1`, [closed]);
      for (let i = 0; i < 3; i += 1) {
        assert.deepEqual(await h.connections.guardCredentialReplacement(s.providerId, s.connection.merchantId), { allowed: true });
        await h.connectProvider(s.providerId, s.connection.merchantId, { access: `access-again-${i}`, refresh: `refresh-again-${i}` });
      }
      assert.equal((await h.attempt(live)).state, "pending", "a same-merchant re-authorization does not touch a live checkout");
      assert.equal((await h.attempt(closed)).state, "cancelled", "and never revives a closed one");
      assert.equal(h.fake.requests.filter((request) => request.method === "DELETE").length, 0);
      // and the live checkout can still be settled with the new credential, because it is the same merchant
      h.fake.payOrder((await h.attempt(live)).square_order_id);
      assert.equal((await h.payments.settleAttempt(live)).outcome, "completed");
    });
  });

  test("P1 isolation: one provider's disconnect never closes or touches another provider's checkouts or connection", async () => {
    await withLifecycleApp(async ({ h, base }) => {
      const a = await scene(h, base);
      const b = await scene(h, base);
      const attemptA = await a.open(0);
      const attemptB = await b.open(0);
      await h.connections.disconnect(a.providerId);
      assert.equal((await h.attempt(attemptA)).state, "cancelled");
      assert.equal((await h.attempt(attemptB)).state, "pending");
      assert.equal((await h.row(b.providerId)).account_status, "active");
      assert.deepEqual(await h.connections.guardCredentialReplacement(b.providerId, b.connection.merchantId), { allowed: true });
    });
  });

  test("P1 disconnect: a provider with no usable credential can still disconnect (nothing to close with), and its attempts are non-payable", async () => {
    await withLifecycleApp(async ({ h, base }) => {
      const s = await scene(h, base);
      const attemptId = await s.open(0);
      await h.q(`UPDATE payment_methods SET account_status = 'needs_reauthorization', encrypted_access_token = NULL, encrypted_refresh_token = NULL WHERE user_id = $1`, [s.providerId]);
      const result = await h.connections.disconnect(s.providerId);
      assert.equal(result.changed, true);
      assert.equal((await h.attempt(attemptId)).state, "cancelled");
    });
  });

  test("P1: no token or secret appears in any log, row or response across the amendment and disconnect cleanup", async () => {
    await withLifecycleApp(async ({ h, base }) => {
      const s = await scene(h, base);
      await s.open(1);
      h.fake.state.linkDeleteFailure = 503;
      await amend(base, s, { priceCents: 90000 });
      await assert.rejects(h.connections.disconnect(s.providerId), SquareCredentialDiscardBlockedError);
      const everything = JSON.stringify([h.logs, await h.attempts(s.bookingId), await billingView(base, s.bookingId, s.customerId)]);
      assert.equal(everything.includes(s.connection.accessToken), false);
      assert.equal(everything.includes(`refresh-${s.providerId}`), false);
    });
  });
}
