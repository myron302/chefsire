/**
 * Catering Phase 2Q against REAL PostgreSQL (built from the Drizzle schema), the REAL Gate 0 connection service with real sealed
 * credentials, the REAL settlement code and the REAL `square` SDK talking to a local fake Square. Set TEST_DATABASE_URL to a loopback
 * database whose name contains "test"; skipped otherwise. Never production.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { prepareCateringSquareEnvironment, withCateringSquareHarness, withTimeout, type CateringSquareHarness } from "../test-support/catering-square-harness";
import { createSquareCheckoutApi, SquareSandboxOnlyError } from "../lib/square-checkout";
import { CATERING_SQUARE_RECONCILIATION_COPY, CATERING_SQUARE_NOTIFICATIONS } from "../../shared/catering-square-payments";
import { CATERING_SQUARE_COPY } from "../../shared/catering-square-payments";
import { cateringSquareDisplay } from "../../client/src/pages/services/catering-square-payment-state";
import { SquareCredentialDiscardBlockedError } from "../lib/square-connection-service";
import { cateringAttemptNeedsReturnReview, serializeCateringPaymentAttempt, visibleCateringPaymentAttempts } from "../serializers/catering-booking-payment-attempt";

prepareCateringSquareEnvironment();
const URL_ENV = process.env.TEST_DATABASE_URL?.trim();

if (!URL_ENV) {
  test("Catering Square payments (skipped: TEST_DATABASE_URL not set)", { skip: true }, () => {});
} else {
  const run = (fn: (h: CateringSquareHarness) => Promise<void>) => withCateringSquareHarness(URL_ENV, {}, fn);
  type Invoices = { kind: "deposit" | "balance" | "adjustment"; amountCents: number }[];

  /** A confirmed $1000 booking with a $400 deposit and a $600 balance ISSUED, a Square-ready provider, and a customer. */
  async function scene(h: CateringSquareHarness, invoices: Invoices = [{ kind: "deposit", amountCents: 40000 }, { kind: "balance", amountCents: 60000 }]) {
    const providerId = await h.user("provider");
    const customerId = await h.user("customer");
    const connection = await h.connectProvider(providerId);
    const { bookingId, invoiceIds } = await h.booking({ providerId, customerId, invoices });
    return { providerId, customerId, bookingId, invoiceIds, connection };
  }
  type Scene = Awaited<ReturnType<typeof scene>>;
  const pay = (h: CateringSquareHarness, s: Scene, invoiceIndex = 0, userId = s.customerId) =>
    h.payments.createPayment({ bookingId: s.bookingId, invoiceId: s.invoiceIds[invoiceIndex], userId });
  async function open(h: CateringSquareHarness, s: Scene, invoiceIndex = 0) {
    const created = await pay(h, s, invoiceIndex);
    assert.equal(created.kind, "ok");
    if (created.kind !== "ok") throw new Error("not ok");
    assert.equal(created.attempt.state, "pending");
    return created.attempt;
  }
  const squareCalls = (h: CateringSquareHarness) => h.fake.requests.filter((request) => request.path.startsWith("/v2/orders") || request.path.startsWith("/v2/payments") || request.path.startsWith("/v2/online-checkout"));

  /* ----------------------------------------------------------------------------------------------------------- *
   * Authorization
   * ----------------------------------------------------------------------------------------------------------- */

  test("the booking's customer can create an attempt on the provider's own Square account, with the provider's verified merchant and location", async () => {
    await run(async (h) => {
      const s = await scene(h);
      const attempt = await open(h, s);
      assert.equal(attempt.customerId, s.customerId);
      assert.equal(attempt.providerId, s.providerId);
      assert.equal(attempt.merchantId, s.connection.merchantId);
      assert.equal(attempt.locationId, s.connection.locationId);
      assert.equal(attempt.processor, "square");
      assert.equal(attempt.processorEnvironment, "sandbox");
      assert.match(attempt.checkoutUrl ?? "", /^https:\/\/sandbox\.fake\.square\/checkout\//);
      // The checkout was created with the PROVIDER's own OAuth credential and ChefSire's own reference on the order.
      const create = h.fake.requests.find((request) => request.path === "/v2/online-checkout/payment-links")!;
      assert.equal(create.authorization, `Bearer ${s.connection.accessToken}`);
      const body = JSON.parse(create.body);
      assert.equal(body.idempotency_key, attempt.idempotencyKey);
      assert.equal(body.order.reference_id, attempt.id);
      assert.equal(body.order.location_id, s.connection.locationId);
      assert.equal(Number(body.order.line_items[0].base_price_money.amount), 40000);
      assert.equal(body.checkout_options.allow_tipping, false);
      assert.equal(body.checkout_options.redirect_url.startsWith("https://app.test/"), true);
    });
  });

  test("the provider cannot create a customer's payment, and nothing is written or sent to Square", async () => {
    await run(async (h) => {
      const s = await scene(h);
      const before = h.fake.requests.length;
      assert.deepEqual(await pay(h, s, 0, s.providerId), { kind: "forbidden" });
      assert.equal((await h.attempts(s.bookingId)).length, 0);
      assert.equal(h.fake.requests.length, before);
    });
  });

  test("a stranger gets the same not-found as a missing booking and creates nothing", async () => {
    await run(async (h) => {
      const s = await scene(h);
      const stranger = await h.user("stranger");
      assert.deepEqual(await pay(h, s, 0, stranger), { kind: "not_found" });
      assert.deepEqual(await h.payments.createPayment({ bookingId: "no-such-booking", invoiceId: s.invoiceIds[0], userId: s.customerId }), { kind: "not_found" });
      assert.equal((await h.attempts(s.bookingId)).length, 0);
    });
  });

  test("an invoice that belongs to another booking is rejected as not found, never paid", async () => {
    await run(async (h) => {
      const s = await scene(h);
      const other = await h.booking({ providerId: s.providerId, customerId: s.customerId, invoices: [{ kind: "deposit", amountCents: 10000 }] });
      assert.deepEqual(await h.payments.createPayment({ bookingId: s.bookingId, invoiceId: other.invoiceIds[0], userId: s.customerId }), { kind: "not_found" });
      assert.deepEqual(await h.payments.createPayment({ bookingId: s.bookingId, invoiceId: "no-such-invoice", userId: s.customerId }), { kind: "not_found" });
      assert.equal((await h.attempts(s.bookingId)).length + (await h.attempts(other.bookingId)).length, 0);
    });
  });

  test("status reads: a customer sees only their own attempt, the provider sees the booking's, a stranger and a mismatched booking see nothing", async () => {
    await run(async (h) => {
      const s = await scene(h);
      const attempt = await open(h, s);
      const stranger = await h.user("stranger");
      const otherCustomer = await h.user("other-customer");
      const otherBooking = await h.booking({ providerId: s.providerId, customerId: otherCustomer, invoices: [{ kind: "deposit", amountCents: 10000 }] });
      assert.equal((await h.payments.getAttempt({ bookingId: s.bookingId, attemptId: attempt.id, userId: s.customerId })).kind, "ok");
      const asProvider = await h.payments.getAttempt({ bookingId: s.bookingId, attemptId: attempt.id, userId: s.providerId });
      assert.equal(asProvider.kind, "ok");
      assert.equal((await h.payments.getAttempt({ bookingId: s.bookingId, attemptId: attempt.id, userId: stranger })).kind, "not_found");
      // another customer, on their own booking, cannot name this attempt through their own booking id
      assert.equal((await h.payments.getAttempt({ bookingId: otherBooking.bookingId, attemptId: attempt.id, userId: otherCustomer })).kind, "not_found");
      assert.equal((await h.payments.getAttempt({ bookingId: s.bookingId, attemptId: "no-such-attempt", userId: s.customerId })).kind, "not_found");
    });
  });

  /* ----------------------------------------------------------------------------------------------------------- *
   * Amount
   * ----------------------------------------------------------------------------------------------------------- */

  test("the amount is the server-derived effective payable of THAT invoice: deposit and balance each ask for their own", async () => {
    await run(async (h) => {
      const s = await scene(h);
      assert.equal((await open(h, s, 0)).amountCents, 40000);
      assert.equal((await open(h, s, 1)).amountCents, 60000);
    });
  });

  test("adjustments are reflected: a credit shrinks what the later invoice asks for, from the same allocation the ledger shows", async () => {
    await run(async (h) => {
      const s = await scene(h);
      await h.adjustment(s.bookingId, s.providerId, "credit", 30000);
      assert.equal((await open(h, s, 0)).amountCents, 40000);
      assert.equal((await open(h, s, 1)).amountCents, 30000);
    });
  });

  test("a provider-recorded payment already received is subtracted: the checkout asks for what is LEFT", async () => {
    await run(async (h) => {
      const s = await scene(h);
      await h.recordProviderPayment(s.bookingId, s.invoiceIds[0], s.providerId, 15000);
      assert.equal((await open(h, s, 0)).amountCents, 25000);
    });
  });

  test("zero payable is refused and opens nothing: fully paid, fully credited, withdrawn or cancelled", async () => {
    await run(async (h) => {
      const paid = await scene(h);
      await h.recordProviderPayment(paid.bookingId, paid.invoiceIds[0], paid.providerId, 40000);
      const outcome = await pay(h, paid, 0);
      assert.equal(outcome.kind, "refused");
      assert.equal((await h.attempts(paid.bookingId)).length, 0);

      const credited = await scene(h);
      await h.adjustment(credited.bookingId, credited.providerId, "credit", 100000);
      assert.equal((await pay(h, credited, 0)).kind, "refused");
      assert.equal((await pay(h, credited, 1)).kind, "refused");

      const withdrawn = await scene(h);
      await h.voidInvoice(withdrawn.invoiceIds[0], withdrawn.providerId);
      assert.equal((await pay(h, withdrawn, 0)).kind, "refused");

      const cancelled = await scene(h);
      await h.cancelBooking(cancelled.bookingId);
      const refused = await pay(h, cancelled, 0);
      assert.equal(refused.kind, "refused");
      if (refused.kind === "refused") assert.equal(refused.code, "catering_billing_not_available");
      for (const x of [credited, withdrawn, cancelled]) assert.equal((await h.attempts(x.bookingId)).length, 0);
    });
  });

  test("USD only: another currency is refused before anything is created, and the database refuses a non-USD attempt outright", async () => {
    await run(async (h) => {
      const s = await scene(h);
      await h.q(`UPDATE catering_bookings SET currency = 'EUR' WHERE id = $1`, [s.bookingId]);
      await h.q(`UPDATE catering_booking_invoices SET currency = 'EUR' WHERE booking_id = $1`, [s.bookingId]);
      assert.equal((await pay(h, s, 0)).kind, "refused");
      assert.equal((await h.attempts(s.bookingId)).length, 0);
      const t = await scene(h);
      await assert.rejects(h.q(
        `INSERT INTO catering_booking_payment_attempts (booking_id, invoice_id, customer_id, provider_id, merchant_id, location_id, currency, amount_cents, idempotency_key)
         VALUES ($1, $2, $3, $4, 'M', 'L', 'EUR', 100, 'k-eur')`, [t.bookingId, t.invoiceIds[0], t.customerId, t.providerId]), /catering_attempt_currency_check/);
    });
  });

  test("no field of the pay request can carry an amount: the schema is strict, and the service takes no amount at all", async () => {
    const { cateringSquarePayRequestSchema } = await import("@shared/catering-square-payments");
    assert.deepEqual(cateringSquarePayRequestSchema.parse({}), {});
    for (const body of [{ amount: 1 }, { amountCents: 1 }, { currency: "USD" }, { merchantId: "x" }, { locationId: "x" }, { customerId: "x" }]) {
      assert.throws(() => cateringSquarePayRequestSchema.parse(body));
    }
  });

  test("a provider that is not Square-ready cannot take payment: nothing is created and nothing is sent", async () => {
    await run(async (h) => {
      const providerId = await h.user("provider");
      const customerId = await h.user("customer");
      const { bookingId, invoiceIds } = await h.booking({ providerId, customerId, invoices: [{ kind: "deposit", amountCents: 40000 }] });
      const outcome = await h.payments.createPayment({ bookingId, invoiceId: invoiceIds[0], userId: customerId });
      assert.equal(outcome.kind, "refused");
      if (outcome.kind === "refused") assert.equal(outcome.code, "catering_square_provider_not_ready");
      assert.equal((await h.attempts(bookingId)).length, 0);
      assert.equal(squareCalls(h).length, 0);
    });
  });

  /* ----------------------------------------------------------------------------------------------------------- *
   * Idempotency
   * ----------------------------------------------------------------------------------------------------------- */

  test("a retry returns the existing compatible attempt: one attempt, one Square checkout", async () => {
    await run(async (h) => {
      const s = await scene(h);
      const first = await open(h, s);
      const second = await pay(h, s, 0);
      assert.equal(second.kind, "ok");
      if (second.kind !== "ok") return;
      assert.equal(second.reused, true);
      assert.equal(second.attempt.id, first.id);
      assert.equal(second.attempt.squareOrderId, first.squareOrderId);
      assert.equal((await h.attempts(s.bookingId)).length, 1);
      assert.equal(h.fake.links.size, 1);
    });
  });

  test("concurrent creates cannot open duplicate attempts or duplicate Square checkouts", async () => {
    await run(async (h) => {
      const s = await scene(h);
      h.fake.state.checkoutCreateDelayMs = 80;
      const results = await withTimeout(Promise.all(Array.from({ length: 8 }, () => pay(h, s, 0))), "concurrent creates");
      assert.ok(results.every((result) => result.kind === "ok"));
      const ids = new Set(results.map((result) => result.kind === "ok" ? result.attempt.id : ""));
      assert.equal(ids.size, 1);
      assert.equal((await h.attempts(s.bookingId)).length, 1);
      assert.equal(h.fake.links.size, 1, "Square's idempotency key returned one link to every concurrent create");
      assert.equal((await h.attempts(s.bookingId))[0].state, "pending");
    });
  });

  test("an uncertain Square result leaves the attempt creating, and the retry reconciles to the SAME checkout instead of creating another", async () => {
    await run(async (h) => {
      const s = await scene(h);
      h.fake.state.checkoutCreateLosesResponse = true;
      const first = await pay(h, s, 0);
      assert.equal(first.kind, "ok");
      if (first.kind !== "ok") return;
      assert.equal(first.attempt.state, "creating");
      assert.equal(first.attempt.checkoutUrl, null, "no checkout is shown until Square's answer is known");
      assert.equal(h.fake.links.size, 1, "Square DID create it; ChefSire just never heard");

      h.fake.state.checkoutCreateLosesResponse = false;
      const retried = await pay(h, s, 0);
      assert.equal(retried.kind, "ok");
      if (retried.kind !== "ok") return;
      assert.equal(retried.attempt.id, first.attempt.id);
      assert.equal(retried.attempt.state, "pending");
      assert.equal(h.fake.links.size, 1, "reconciled onto the link Square already had, not a second one");
      assert.equal((await h.attempts(s.bookingId)).length, 1);
    });
  });

  test("a Square 5xx and a Square 4xx are told apart: only the refusal closes the attempt", async () => {
    await run(async (h) => {
      const s = await scene(h);
      h.fake.state.checkoutCreateFailure = 503;
      const uncertain = await pay(h, s, 0);
      assert.equal(uncertain.kind === "ok" && uncertain.attempt.state, "creating");
      h.fake.state.checkoutCreateFailure = 422;
      const refused = await pay(h, s, 0);
      assert.equal(refused.kind === "ok" && refused.attempt.state, "failed");
      h.fake.state.checkoutCreateFailure = undefined;
      const again = await pay(h, s, 0);
      assert.equal(again.kind === "ok" && again.attempt.state, "pending");
      assert.equal(again.kind === "ok" && again.reused, false, "a failed attempt is not reused");
    });
  });

  test("if what is payable changed, the stale open attempt is superseded (its link deleted) and a new one opens for the new amount", async () => {
    await run(async (h) => {
      const s = await scene(h);
      const first = await open(h, s, 0);
      await h.recordProviderPayment(s.bookingId, s.invoiceIds[0], s.providerId, 10000);
      const second = await open(h, s, 0);
      assert.notEqual(second.id, first.id);
      assert.equal(second.amountCents, 30000);
      const rows = await h.attempts(s.bookingId);
      assert.deepEqual(rows.map((row) => row.state), ["superseded", "pending"]);
      assert.equal(h.fake.links.get(first.squarePaymentLinkId!)!.deleted, true);
    });
  });

  test("the database allows at most one open attempt per invoice, one attempt per Square order and idempotency key", async () => {
    await run(async (h) => {
      const s = await scene(h);
      const attempt = await open(h, s);
      const insert = (key: string, state = "creating") => h.q(
        `INSERT INTO catering_booking_payment_attempts (booking_id, invoice_id, customer_id, provider_id, merchant_id, location_id, currency, amount_cents, idempotency_key, state)
         VALUES ($1, $2, $3, $4, 'M', 'L', 'USD', 100, $5, $6)`, [s.bookingId, s.invoiceIds[0], s.customerId, s.providerId, key, state]);
      await assert.rejects(insert("another-key"), /catering_attempts_open_invoice_uidx/);
      await assert.rejects(insert(attempt.idempotencyKey, "failed"), /catering_attempts_idempotency_uidx/);
      await assert.rejects(h.q(
        `INSERT INTO catering_booking_payment_attempts (booking_id, invoice_id, customer_id, provider_id, merchant_id, location_id, currency, amount_cents, idempotency_key, state, square_order_id, square_payment_link_id, checkout_url)
         VALUES ($1, $2, $3, $4, 'M', 'L', 'USD', 100, 'k2', 'pending', $5, 'LINK_X', 'u')`, [s.bookingId, s.invoiceIds[1], s.customerId, s.providerId, attempt.squareOrderId]), /catering_attempts_order_uidx/);
    });
  });

  /* ----------------------------------------------------------------------------------------------------------- *
   * Processor evidence
   * ----------------------------------------------------------------------------------------------------------- */

  test("a browser return alone credits nothing: checking status while Square shows no payment leaves the ledger untouched", async () => {
    await run(async (h) => {
      const s = await scene(h);
      const attempt = await open(h, s);
      for (let i = 0; i < 3; i += 1) {
        const status = await h.payments.getAttempt({ bookingId: s.bookingId, attemptId: attempt.id, userId: s.customerId });
        assert.equal(status.kind === "ok" && status.attempt.state, "pending");
      }
      assert.equal((await h.ledger(s.bookingId)).length, 0);
    });
  });

  test("a webhook alone credits nothing: its payload claims a completed payment, Square (asked fresh) shows none", async () => {
    await run(async (h) => {
      const s = await scene(h);
      const attempt = await open(h, s);
      const result = await h.payments.handleWebhookEvent({ eventId: "evt-claim", eventType: "payment.updated", merchantId: s.connection.merchantId, orderId: attempt.squareOrderId, paymentId: "PAYMENT_FORGED" });
      assert.deepEqual(result, { kind: "processed", outcome: "awaiting" });
      assert.equal((await h.ledger(s.bookingId)).length, 0);
      assert.equal((await h.attempt(attempt.id)).state, "pending");
    });
  });

  test("settlement reads FRESH Square state with the provider's credential before crediting: the order, then its payment", async () => {
    await run(async (h) => {
      const s = await scene(h);
      const attempt = await open(h, s);
      h.fake.payOrder(attempt.squareOrderId!);
      const before = h.fake.requests.length;
      assert.equal((await h.payments.settleAttempt(attempt.id)).outcome, "completed");
      const reads = h.fake.requests.slice(before).filter((request) => request.path.startsWith("/v2/orders/") || request.path.startsWith("/v2/payments/"));
      assert.deepEqual(reads.map((request) => request.path.split("/")[2]), ["orders", "payments"]);
      assert.ok(reads.every((request) => request.authorization === `Bearer ${s.connection.accessToken}`));
    });
  });

  test("wrong location: a payment or an order at another location is rejected and never credited", async () => {
    await run(async (h) => {
      const s = await scene(h);
      const a = await open(h, s, 0);
      h.fake.payOrder(a.squareOrderId!, { location_id: "LOC_SOMEONE_ELSE" });
      const outcome = await h.payments.settleAttempt(a.id);
      assert.equal(outcome.outcome, "rejected");
      assert.equal(outcome.outcome === "rejected" && outcome.code, "payment_location_mismatch");
      assert.equal((await h.attempt(a.id)).state, "pending");

      const b = await open(h, s, 1);
      h.fake.orders.get(b.squareOrderId!)!.location_id = "LOC_SOMEONE_ELSE";
      h.fake.payOrder(b.squareOrderId!, { location_id: "LOC_SOMEONE_ELSE" });
      const second = await h.payments.settleAttempt(b.id);
      assert.equal(second.outcome === "rejected" && second.code, "location_mismatch");
      assert.equal((await h.ledger(s.bookingId)).length, 0);
    });
  });

  test("wrong reference: an order that does not carry this attempt's ChefSire reference is never trusted", async () => {
    await run(async (h) => {
      const s = await scene(h);
      const attempt = await open(h, s);
      h.fake.orders.get(attempt.squareOrderId!)!.reference_id = "some-other-attempt";
      h.fake.payOrder(attempt.squareOrderId!);
      const outcome = await h.payments.settleAttempt(attempt.id);
      assert.equal(outcome.outcome === "rejected" && outcome.code, "reference_mismatch");
      assert.equal((await h.ledger(s.bookingId)).length, 0);
      assert.equal((await h.attempt(attempt.id)).state, "pending");
    });
  });

  test("wrong merchant: a webhook for another merchant is ignored, and a provider now connected to a different merchant is never used to judge the attempt", async () => {
    await run(async (h) => {
      const s = await scene(h);
      const attempt = await open(h, s);
      h.fake.payOrder(attempt.squareOrderId!);
      const ignored = await h.payments.handleWebhookEvent({ eventId: "evt-other-merchant", eventType: "payment.updated", merchantId: "MERCHANT_SOMEONE_ELSE", orderId: attempt.squareOrderId, paymentId: null });
      assert.deepEqual(ignored, { kind: "ignored", reason: "merchant_mismatch" });
      assert.equal((await h.ledger(s.bookingId)).length, 0);

      await h.dropConnection(s.providerId); // (replacing a live connection goes through the guard, which would first record the paid order)
      await h.connectProvider(s.providerId, "MERCHANT_OTHER_ACCOUNT", { access: "access-other", refresh: "refresh-other" });
      const before = h.fake.requests.length;
      const outcome = await h.payments.settleAttempt(attempt.id);
      assert.deepEqual(outcome.outcome === "unavailable" && outcome.reason, "merchant_changed");
      assert.equal(h.fake.requests.slice(before).some((request) => request.path.startsWith("/v2/orders") || request.path.startsWith("/v2/payments")), false, "the other merchant's credential never read the order");
      assert.equal((await h.ledger(s.bookingId)).length, 0);
    });
  });

  test("wrong status: approved/pending is processing, failed is awaiting, a cancelled order closes the checkout; none credits", async () => {
    await run(async (h) => {
      const s = await scene(h);
      const a = await open(h, s, 0);
      h.fake.payOrder(a.squareOrderId!, { status: "APPROVED", orderState: "OPEN" });
      assert.equal((await h.payments.settleAttempt(a.id)).outcome, "processing");

      const b = await open(h, s, 1);
      h.fake.payOrder(b.squareOrderId!, { status: "FAILED", orderState: "OPEN" });
      assert.equal((await h.payments.settleAttempt(b.id)).outcome, "awaiting");
      h.fake.orders.get(b.squareOrderId!)!.state = "CANCELED";
      h.fake.orders.get(b.squareOrderId!)!.tenders = [];
      assert.equal((await h.payments.settleAttempt(b.id)).outcome, "cancelled");
      assert.equal((await h.attempt(b.id)).state, "cancelled");
      assert.equal((await h.ledger(s.bookingId)).length, 0);
    });
  });

  test("the same Square payment id can never be credited twice, by the ledger, by another attempt, or by the database", async () => {
    await run(async (h) => {
      const s = await scene(h);
      const a = await open(h, s, 0);
      const payment = h.fake.payOrder(a.squareOrderId!);
      assert.equal((await h.payments.settleAttempt(a.id)).outcome, "completed");
      // A second attempt whose order is (maliciously or by mistake) shown with the SAME payment id.
      const b = await open(h, s, 1);
      const order = h.fake.orders.get(b.squareOrderId!)!;
      order.tenders.push({ id: "T_DUP", payment_id: payment.id });
      h.fake.payments.set(payment.id, { ...payment, order_id: b.squareOrderId!, total_money: { ...order.total_money }, amount_money: { ...order.total_money } });
      const outcome = await h.payments.settleAttempt(b.id);
      assert.equal(outcome.outcome === "rejected" && outcome.code, "payment_already_consumed");
      assert.equal((await h.processorLedger(s.bookingId)).length, 1);
      assert.equal((await h.attempt(b.id)).state, "pending");
      await assert.rejects(h.q(
        `INSERT INTO catering_booking_payments (booking_id, invoice_id, amount_cents, currency, payment_method, payment_source, status, received_on, processor, processor_payment_id)
         VALUES ($1, $2, 100, 'USD', 'card_online', 'processor', 'recorded', current_date, 'square', $3)`, [s.bookingId, s.invoiceIds[1], payment.id]), /catering_payments_processor_uidx/);
    });
  });

  /* ----------------------------------------------------------------------------------------------------------- *
   * Atomic ledger credit, convergence and concurrency
   * ----------------------------------------------------------------------------------------------------------- */

  test("settlement writes the processor payment, completes the attempt and records the activity in one commit, with the provenance the ledger requires", async () => {
    await run(async (h) => {
      const s = await scene(h);
      const attempt = await open(h, s);
      const payment = h.fake.payOrder(attempt.squareOrderId!);
      const outcome = await h.payments.settleAttempt(attempt.id);
      assert.equal(outcome.outcome, "completed");
      const [ledger] = await h.processorLedger(s.bookingId);
      assert.equal(ledger.processor, "square");
      assert.equal(ledger.processor_payment_id, payment.id);
      assert.equal(ledger.payment_method, "card_online");
      assert.equal(ledger.payment_source, "processor");
      assert.equal(ledger.recorded_by, null);
      assert.equal(ledger.idempotency_key, null);
      assert.equal(Number(ledger.amount_cents), 40000);
      assert.equal(ledger.invoice_id, s.invoiceIds[0]);
      const row = await h.attempt(attempt.id);
      assert.equal(row.state, "completed");
      assert.equal(row.payment_id, ledger.id);
      assert.equal(row.square_payment_id, payment.id);
      assert.equal(Number(row.processor_amount_cents), 40000);
      const activity = await h.activity(s.bookingId);
      assert.deepEqual(activity.map((event) => event.event_type), ["billing_processor_payment_confirmed"]);
      assert.deepEqual(activity[0].metadata, { amountCents: 40000, currency: "USD" }, "amount and currency only: no Square identifier in the shared feed");
      assert.deepEqual(h.notifications.map((n) => n.type).sort(), ["catering_booking_square_payment_confirmed", "catering_booking_square_payment_received"]);
    });
  });

  test("webhook + poll + retry race to ONE ledger credit, one activity row and one pair of notifications", async () => {
    await run(async (h) => {
      const s = await scene(h);
      const attempt = await open(h, s);
      h.fake.payOrder(attempt.squareOrderId!);
      const event = (id: string) => h.payments.handleWebhookEvent({ eventId: id, eventType: "payment.updated", merchantId: s.connection.merchantId, orderId: attempt.squareOrderId, paymentId: null });
      await withTimeout(Promise.all([
        event("evt-1"), event("evt-2"), event("evt-2"),
        h.payments.getAttempt({ bookingId: s.bookingId, attemptId: attempt.id, userId: s.customerId }),
        h.payments.getAttempt({ bookingId: s.bookingId, attemptId: attempt.id, userId: s.customerId }),
        h.payments.settleAttempt(attempt.id), h.payments.settleAttempt(attempt.id), h.payments.settleAttempt(attempt.id),
      ]), "settlement race");
      assert.equal((await h.processorLedger(s.bookingId)).length, 1);
      assert.equal((await h.activity(s.bookingId)).length, 1);
      assert.equal(h.notifications.filter((n) => n.type === "catering_booking_square_payment_confirmed").length, 1);
      assert.equal((await h.attempt(attempt.id)).state, "completed");
    });
  });

  test("two pollers produce one ledger payment", async () => {
    await run(async (h) => {
      const s = await scene(h);
      const attempt = await open(h, s);
      h.fake.payOrder(attempt.squareOrderId!);
      const polls = await withTimeout(Promise.all(Array.from({ length: 6 }, () => h.payments.getAttempt({ bookingId: s.bookingId, attemptId: attempt.id, userId: s.customerId }))), "pollers");
      assert.ok(polls.every((poll) => poll.kind === "ok"));
      assert.equal((await h.processorLedger(s.bookingId)).length, 1);
      assert.equal((await h.attempt(attempt.id)).state, "completed");
    });
  });

  test("a payment that settles first (here, recorded by the provider) leaves the later Square payment as reconciliation, never a second credit", async () => {
    await run(async (h) => {
      const s = await scene(h);
      const attempt = await open(h, s);
      await h.recordProviderPayment(s.bookingId, s.invoiceIds[0], s.providerId, 40000);
      h.fake.payOrder(attempt.squareOrderId!);
      const outcome = await h.payments.settleAttempt(attempt.id);
      assert.equal(outcome.outcome, "reconciliation_required");
      const row = await h.attempt(attempt.id);
      assert.equal(row.reconciliation_reason, "payable_changed");
      assert.equal((await h.processorLedger(s.bookingId)).length, 0);
    });
  });

  /* ----------------------------------------------------------------------------------------------------------- *
   * Money moved but the payable changed
   * ----------------------------------------------------------------------------------------------------------- */

  test("Square confirms $600 but only $300 is now payable: no clamp, no refund, no normal credit; the attempt keeps the evidence", async () => {
    await run(async (h) => {
      const s = await scene(h);
      const attempt = await open(h, s, 1);
      assert.equal(attempt.amountCents, 60000);
      await h.adjustment(s.bookingId, s.providerId, "credit", 30000); // payable on the balance is now $300
      const payment = h.fake.payOrder(attempt.squareOrderId!);
      const before = h.fake.requests.length;
      const outcome = await h.payments.settleAttempt(attempt.id);
      assert.equal(outcome.outcome, "reconciliation_required");

      assert.equal((await h.ledger(s.bookingId)).length, 0, "nothing credited: not $600, and not a clamped $300");
      const row = await h.attempt(attempt.id);
      assert.equal(row.state, "reconciliation_required");
      assert.equal(row.reconciliation_reason, "payable_changed");
      assert.equal(row.square_payment_id, payment.id);
      assert.equal(Number(row.processor_amount_cents), 60000, "the evidence says $600 moved");
      assert.equal(row.processor_currency, "USD");
      assert.equal(row.payment_id, null);
      assert.equal(h.fake.requests.slice(before).some((request) => request.method !== "GET"), false, "no refund, no write of any kind was sent to Square");
      assert.equal((await h.activity(s.bookingId)).length, 0, "nothing was announced as a payment");
      assert.deepEqual(h.notifications.map((n) => n.type).sort(), ["catering_booking_square_payment_reconciliation", "catering_booking_square_payment_reconciliation_required"]);
      // terminal: it never flips to a credit later, however often it is settled again
      assert.equal((await h.payments.settleAttempt(attempt.id)).outcome, "already_settled");
      assert.equal((await h.ledger(s.bookingId)).length, 0);
    });
  });

  test("the provider sees the reconciliation evidence, the customer sees a safe explanation; neither sees Square internals they do not need", async () => {
    await run(async (h) => {
      const s = await scene(h);
      const attempt = await open(h, s, 1);
      await h.adjustment(s.bookingId, s.providerId, "credit", 30000);
      const payment = h.fake.payOrder(attempt.squareOrderId!);
      await h.payments.settleAttempt(attempt.id);
      const asProvider = await h.payments.getAttempt({ bookingId: s.bookingId, attemptId: attempt.id, userId: s.providerId });
      const asCustomer = await h.payments.getAttempt({ bookingId: s.bookingId, attemptId: attempt.id, userId: s.customerId });
      assert.ok(asProvider.kind === "ok" && asCustomer.kind === "ok");
      if (asProvider.kind !== "ok" || asCustomer.kind !== "ok") return;
      const providerView = serializeCateringPaymentAttempt(asProvider.attempt, "provider");
      const customerView = serializeCateringPaymentAttempt(asCustomer.attempt, "customer");
      assert.equal(providerView.state, "reconciliation_required");
      assert.equal(providerView.processorAmountCents, 60000);
      assert.equal(providerView.squarePaymentId, payment.id);
      assert.equal(providerView.reconciliationReason, "payable_changed");
      assert.equal(customerView.squarePaymentId, undefined);
      assert.equal(customerView.checkoutUrl, undefined);
      assert.equal(customerView.reconciliationReason, "payable_changed");
    });
  });

  test("amount and currency that differ from what was asked are kept as reconciliation evidence, never credited", async () => {
    await run(async (h) => {
      const s = await scene(h);
      const wrongAmount = await open(h, s, 0);
      h.fake.payOrder(wrongAmount.squareOrderId!, { total_money: { amount: 45000, currency: "USD" }, amount_money: { amount: 45000, currency: "USD" } });
      assert.equal((await h.payments.settleAttempt(wrongAmount.id)).outcome, "reconciliation_required");
      const amountRow = await h.attempt(wrongAmount.id);
      assert.equal(amountRow.reconciliation_reason, "amount_mismatch");
      assert.equal(Number(amountRow.processor_amount_cents), 45000);

      const wrongCurrency = await open(h, s, 1);
      h.fake.payOrder(wrongCurrency.squareOrderId!, { total_money: { amount: 60000, currency: "CAD" }, amount_money: { amount: 60000, currency: "CAD" } });
      assert.equal((await h.payments.settleAttempt(wrongCurrency.id)).outcome, "reconciliation_required");
      const currencyRow = await h.attempt(wrongCurrency.id);
      assert.equal(currencyRow.reconciliation_reason, "currency_mismatch");
      assert.equal(currencyRow.processor_currency, "CAD");
      assert.equal((await h.ledger(s.bookingId)).length, 0);
    });
  });

  test("a tip added at checkout is money that moved but was not asked for: reconciliation, not a credit of the invoice amount", async () => {
    await run(async (h) => {
      const s = await scene(h);
      const attempt = await open(h, s);
      h.fake.payOrder(attempt.squareOrderId!, { total_money: { amount: 42000, currency: "USD" }, tip_money: { amount: 2000, currency: "USD" } });
      assert.equal((await h.payments.settleAttempt(attempt.id)).outcome, "reconciliation_required");
      assert.equal((await h.attempt(attempt.id)).reconciliation_reason, "amount_mismatch");
      assert.equal((await h.ledger(s.bookingId)).length, 0);
    });
  });

  /* ----------------------------------------------------------------------------------------------------------- *
   * Cancellation, void and connection races
   * ----------------------------------------------------------------------------------------------------------- */

  test("a customer's status check after the booking was cancelled closes the open checkout and deletes its Square link", async () => {
    await run(async (h) => {
      const s = await scene(h);
      const attempt = await open(h, s);
      await h.cancelBooking(s.bookingId);
      const status = await h.payments.getAttempt({ bookingId: s.bookingId, attemptId: attempt.id, userId: s.customerId });
      assert.equal(status.kind === "ok" && status.attempt.state, "cancelled");
      assert.equal(h.fake.links.get(attempt.squarePaymentLinkId!)!.deleted, true);
      assert.equal((await h.ledger(s.bookingId)).length, 0);
    });
  });

  test("a payment confirmed AFTER cancellation keeps its evidence and enters reconciliation, even from a checkout ChefSire had closed", async () => {
    await run(async (h) => {
      const s = await scene(h);
      const attempt = await open(h, s);
      await h.cancelBooking(s.bookingId);
      await h.payments.getAttempt({ bookingId: s.bookingId, attemptId: attempt.id, userId: s.customerId }); // closes it
      assert.equal((await h.attempt(attempt.id)).state, "cancelled");
      const payment = h.fake.payOrder(attempt.squareOrderId!); // the customer still had the page open and paid
      const outcome = await h.payments.settleAttempt(attempt.id);
      assert.equal(outcome.outcome, "reconciliation_required");
      const row = await h.attempt(attempt.id);
      assert.equal(row.reconciliation_reason, "booking_cancelled");
      assert.equal(row.square_payment_id, payment.id);
      assert.equal(Number(row.processor_amount_cents), 40000);
      assert.equal((await h.ledger(s.bookingId)).length, 0);
    });
  });

  test("a withdrawn invoice: the checkout is closed on the next sweep, and a payment that still lands is kept as reconciliation", async () => {
    await run(async (h) => {
      const s = await scene(h);
      const closing = await open(h, s, 0);
      await h.voidInvoice(s.invoiceIds[0], s.providerId);
      assert.equal(await h.payments.closeStaleOpenAttempts(s.bookingId), 1);
      assert.equal((await h.attempt(closing.id)).state, "cancelled");

      const racing = await open(h, s, 1);
      await h.voidInvoice(s.invoiceIds[1], s.providerId);
      h.fake.payOrder(racing.squareOrderId!);
      assert.equal((await h.payments.settleAttempt(racing.id)).outcome, "reconciliation_required");
      assert.equal((await h.attempt(racing.id)).reconciliation_reason, "invoice_not_payable");
    });
  });

  test("an invoice that became fully paid elsewhere has its checkout closed so the customer is not asked to pay twice", async () => {
    await run(async (h) => {
      const s = await scene(h);
      const attempt = await open(h, s, 0);
      await h.recordProviderPayment(s.bookingId, s.invoiceIds[0], s.providerId, 40000);
      assert.equal(await h.payments.closeStaleOpenAttempts(s.bookingId), 1);
      assert.equal((await h.attempt(attempt.id)).state, "cancelled");
      assert.equal(h.fake.links.get(attempt.squarePaymentLinkId!)!.deleted, true);
    });
  });

  test("a lower payable closes only the checkouts that could no longer be credited in full; one that still fits stays open", async () => {
    await run(async (h) => {
      const s = await scene(h);
      const deposit = await open(h, s, 0);
      const balance = await open(h, s, 1);
      await h.adjustment(s.bookingId, s.providerId, "credit", 30000); // balance payable 600 -> 300; deposit unchanged
      assert.equal(await h.payments.closeStaleOpenAttempts(s.bookingId), 1);
      assert.equal((await h.attempt(deposit.id)).state, "pending");
      assert.equal((await h.attempt(balance.id)).state, "cancelled");
    });
  });

  test("provider connection unavailable at settlement: money that already moved is not lost, and is recognised once the same merchant is reconnected", async () => {
    await run(async (h) => {
      const s = await scene(h);
      const attempt = await open(h, s);
      h.fake.payOrder(attempt.squareOrderId!);
      await h.dropConnection(s.providerId); // lost without the disconnect guard (which would have recorded the payment first)
      const outcome = await h.payments.settleAttempt(attempt.id);
      assert.deepEqual(outcome.outcome === "unavailable" && outcome.reason, "connection_not_ready");
      // money that had ALREADY moved is still recognised once the same merchant is back
      assert.equal((await h.attempt(attempt.id)).state, "pending");
      assert.equal((await h.ledger(s.bookingId)).length, 0);

      await h.connectProvider(s.providerId, s.connection.merchantId, { access: "access-reconnected", refresh: "refresh-reconnected" });
      assert.equal((await h.payments.settleAttempt(attempt.id)).outcome, "completed");
      assert.equal((await h.processorLedger(s.bookingId)).length, 1);
    });
  });

  test("Square unreachable while verifying is retryable and changes nothing", async () => {
    await run(async (h) => {
      const s = await scene(h);
      const attempt = await open(h, s);
      h.fake.payOrder(attempt.squareOrderId!);
      h.fake.state.evidenceFailure = 503;
      const outcome = await h.payments.settleAttempt(attempt.id);
      assert.deepEqual(outcome.outcome === "unavailable" && outcome.reason, "square_unreachable");
      assert.equal((await h.attempt(attempt.id)).state, "pending");
      h.fake.state.evidenceFailure = undefined;
      assert.equal((await h.payments.settleAttempt(attempt.id)).outcome, "completed");
    });
  });

  /* ----------------------------------------------------------------------------------------------------------- *
   * Security and the sandbox boundary
   * ----------------------------------------------------------------------------------------------------------- */

  test("no credential is ever stored on, serialized from, or logged by the payment path; the provider's credential stays sealed at rest", async () => {
    await run(async (h) => {
      const s = await scene(h);
      const attempt = await open(h, s);
      h.fake.payOrder(attempt.squareOrderId!);
      await h.payments.settleAttempt(attempt.id);
      h.fake.state.evidenceFailure = 503;
      const second = await open(h, s, 1);
      await h.payments.settleAttempt(second.id);

      const columns = (await h.q(`SELECT column_name FROM information_schema.columns WHERE table_name IN ('catering_booking_payment_attempts', 'catering_square_webhook_events')`)).map((row) => String(row.column_name));
      assert.equal(columns.some((name) => /token|secret|credential|cipher|refresh/i.test(name)), false);
      const everything = JSON.stringify({ attempts: await h.attempts(s.bookingId), ledger: await h.ledger(s.bookingId), logs: h.logs, notifications: h.notifications });
      assert.equal(everything.includes(s.connection.accessToken), false);
      assert.equal(everything.includes(`refresh-${s.providerId}`), false);
      for (const role of ["customer", "provider"] as const) {
        for (const id of [attempt.id, second.id]) {
          const status = await h.payments.getAttempt({ bookingId: s.bookingId, attemptId: id, userId: role === "customer" ? s.customerId : s.providerId });
          assert.equal(status.kind, "ok");
          if (status.kind !== "ok") continue;
          const view = JSON.stringify(serializeCateringPaymentAttempt(status.attempt, role));
          assert.equal(view.includes(s.connection.accessToken), false);
          assert.equal(/idempotency|merchant|location|order_id|squareOrderId|paymentLink|chefsire-cat/i.test(view), false, "no Square internals reach a client");
        }
      }
      const [sealed] = await h.q(`SELECT encrypted_access_token, encrypted_refresh_token FROM payment_methods WHERE user_id = $1`, [s.providerId]);
      assert.match(String(sealed.encrypted_access_token), /^sqenc:v1:/);
      assert.equal(String(sealed.encrypted_access_token).includes(s.connection.accessToken), false);
    });
  });

  test("the sandbox boundary: with Square configured for production nothing is created, verified or sent, at any layer", async () => {
    await run(async (h) => {
      const s = await scene(h);
      const attempt = await open(h, s);
      h.fake.payOrder(attempt.squareOrderId!);
      const before = h.fake.requests.length;
      const original = process.env.SQUARE_ENV;
      process.env.SQUARE_ENV = "production";
      try {
        const { cateringSquarePaymentsEnabled } = await import("../lib/square-checkout");
        assert.equal(cateringSquarePaymentsEnabled(), false);
        assert.deepEqual(await pay(h, s, 1), { kind: "unavailable" });
        const settled = await h.payments.settleAttempt(attempt.id);
        assert.deepEqual(settled.outcome === "unavailable" && settled.reason, "sandbox_only");
        assert.deepEqual(await h.payments.handleWebhookEvent({ eventId: "evt-prod", eventType: "payment.updated", merchantId: s.connection.merchantId, orderId: attempt.squareOrderId, paymentId: null }), { kind: "retry", reason: "sandbox_only" });
        const api = createSquareCheckoutApi({ baseUrl: h.fake.baseUrl });
        await assert.rejects(api.createPaymentLink("t", { idempotencyKey: "k", locationId: "L", referenceId: "r", itemName: "n", amountCents: 100, currency: "USD" }), SquareSandboxOnlyError);
        await assert.rejects(api.retrieveOrder("t", "O"), SquareSandboxOnlyError);
        await assert.rejects(api.retrievePayment("t", "P"), SquareSandboxOnlyError);
        await assert.rejects(api.deletePaymentLink("t", "L"), SquareSandboxOnlyError);
        process.env.SQUARE_ENV = "banana";
        assert.equal(cateringSquarePaymentsEnabled(), false, "an invalid SQUARE_ENV is a refusal, never a guess");
      } finally {
        process.env.SQUARE_ENV = original;
      }
      assert.equal(h.fake.requests.length, before, "not one request reached Square while production was configured");
      assert.equal((await h.ledger(s.bookingId)).length, 0);
      assert.equal(process.env.SQUARE_ENV, "sandbox");
    });
  });

  test("the database itself refuses an attempt that is not sandbox, not Square, or not USD", async () => {
    await run(async (h) => {
      const s = await scene(h);
      const insert = (columns: string, values: string) => h.q(
        `INSERT INTO catering_booking_payment_attempts (booking_id, invoice_id, customer_id, provider_id, merchant_id, location_id, amount_cents, idempotency_key, ${columns})
         VALUES ($1, $2, $3, $4, 'M', 'L', 100, $5, ${values})`, [s.bookingId, s.invoiceIds[0], s.customerId, s.providerId, `k-${Math.random()}`]);
      await assert.rejects(insert("currency, processor_environment", "'USD', 'production'"), /catering_attempt_environment_check/);
      await assert.rejects(insert("currency, processor", "'USD', 'stripe'"), /catering_attempt_processor_check/);
    });
  });

  test("the attempt state checks fail closed: completed needs its ledger row, a ledger link needs completed, reconciliation keeps its evidence", async () => {
    await run(async (h) => {
      const s = await scene(h);
      const base = (state: string, extra = "") => h.q(
        `INSERT INTO catering_booking_payment_attempts (booking_id, invoice_id, customer_id, provider_id, merchant_id, location_id, currency, amount_cents, idempotency_key, state ${extra ? ", " + extra.split("|")[0] : ""})
         VALUES ($1, $2, $3, $4, 'M', 'L', 'USD', 100, $5, '${state}' ${extra ? ", " + extra.split("|")[1] : ""})`, [s.bookingId, s.invoiceIds[0], s.customerId, s.providerId, `k-${Math.random()}`]);
      await assert.rejects(base("completed"), /catering_attempt_(completed|payment_count)_check/);
      await assert.rejects(base("pending"), /catering_attempt_pending_check/);
      await assert.rejects(base("reconciliation_required"), /catering_attempt_(reconciliation|payment_count)_check/);
      await assert.rejects(base("reconciliation_required", "processor_payment_count, square_payment_id, processor_amount_cents, processor_currency, reconciliation_reason|2, 'ONE_OF_TWO', 100, 'USD', 'multiple_payments'"), /catering_attempt_reconciliation_check/, "several payments never name one of them as THE payment");
      await assert.rejects(base("failed", "processor_payment_count|1"), /catering_attempt_payment_count_check/, "a non-money state carries no payments");
      await assert.rejects(base("failed", "square_payment_id|'PAY'"), /catering_attempt_payment_evidence_check/);
      await assert.rejects(base("banana"), /catering_attempt_state_check/);
    });
  });

  test("a provider can neither record nor forge a processor payment: card_online and source processor imply each other", async () => {
    await run(async (h) => {
      const s = await scene(h);
      const insert = (method: string, source: string, processorColumns: string) => h.q(
        `INSERT INTO catering_booking_payments (booking_id, invoice_id, amount_cents, currency, payment_method, payment_source, status, received_on, recorded_by, idempotency_key ${processorColumns ? ", processor, processor_payment_id" : ""})
         VALUES ($1, $2, 100, 'USD', '${method}', '${source}', 'recorded', current_date, $3, $4 ${processorColumns ? ", " + processorColumns : ""})`, [s.bookingId, s.invoiceIds[0], s.providerId, `k-${Math.random()}`]);
      await assert.rejects(insert("card_online", "provider_recorded", ""), /catering_payment_(online_method|provenance)_check/);
      await assert.rejects(insert("cash", "processor", "'square', 'P1'"), /catering_payment_online_method_check/);
      await assert.rejects(insert("card_online", "processor", "'stripe', 'P2'"), /catering_payment_processor_check/);
    });
  });

  /* ----------------------------------------------------------------------------------------------------------- *
   * Codex repair pass 2 (P2): unresolved reconciliation can never be hidden by the history cap
   * ----------------------------------------------------------------------------------------------------------- */

  const ATTEMPT_COLUMNS = "booking_id, invoice_id, customer_id, provider_id, merchant_id, location_id, currency, amount_cents, idempotency_key, state, created_at";
  const RECONCILIATION_COLUMNS = "square_payment_id, processor_amount_cents, processor_currency, reconciliation_reason, processor_payment_count";
  /** Inserts historical attempts directly (the open-invoice index only constrains creating/pending, so closed ones may be many). */
  async function seedHistory(h: CateringSquareHarness, s: Scene, count: number, state: string, startDaysAgo: number) {
    for (let i = 0; i < count; i += 1) {
      await h.q(`INSERT INTO catering_booking_payment_attempts (${ATTEMPT_COLUMNS}) VALUES ($1, $2, $3, $4, 'M', 'L', 'USD', 100, $5, $6, now() - ($7 * interval '1 minute'))`,
        [s.bookingId, s.invoiceIds[0], s.customerId, s.providerId, `hist-${state}-${startDaysAgo}-${i}-${Math.random()}`, state, startDaysAgo - i]);
    }
  }
  async function seedReconciliation(h: CateringSquareHarness, s: Scene, label: string, minutesAgo: number, amountCents = 60000) {
    const row = await h.q(`INSERT INTO catering_booking_payment_attempts (${ATTEMPT_COLUMNS}, ${RECONCILIATION_COLUMNS})
      VALUES ($1, $2, $3, $4, 'M', 'L', 'USD', $5, $6, 'reconciliation_required', now() - ($7 * interval '1 minute'), $8, $5, 'USD', 'payable_changed', 1) RETURNING id`,
      [s.bookingId, s.invoiceIds[1], s.customerId, s.providerId, amountCents, `recon-${label}`, minutesAgo, `PAYMENT_${label}`]);
    return row[0].id as string;
  }

  test("P2: more than 50 newer attempts cannot hide an older unresolved reconciliation: it is listed, with every field the provider needs", async () => {
    await run(async (h) => {
      const s = await scene(h);
      const oldReconciliation = await seedReconciliation(h, s, "OLD", 100_000);
      await seedHistory(h, s, 60, "superseded", 5_000);
      await seedHistory(h, s, 30, "failed", 4_000);
      await seedHistory(h, s, 30, "cancelled", 3_000);
      const total = Number((await h.q(`SELECT count(*) AS n FROM catering_booking_payment_attempts WHERE booking_id = $1`, [s.bookingId]))[0].n);
      assert.equal(total, 121);
      const listed = await h.payments.attemptsForBooking(h.db as never, s.bookingId);
      assert.ok(listed.some((row: { id: string }) => row.id === oldReconciliation), "the older reconciliation is still listed");
      const view = serializeCateringPaymentAttempt(listed.find((row: { id: string }) => row.id === oldReconciliation), "provider");
      assert.equal(view.state, "reconciliation_required");
      assert.equal(view.processorAmountCents, 60000);
      assert.equal(view.currency, "USD");
      assert.equal(view.reconciliationReason, "payable_changed");
      assert.equal(view.squarePaymentId, "PAYMENT_OLD");
      assert.ok(view.createdAt && view.updatedAt && view.id === oldReconciliation);
    });
  });

  test("P2: every unresolved reconciliation is listed, however many there are and however old", async () => {
    await run(async (h) => {
      const s = await scene(h);
      const ids: string[] = [];
      for (let i = 0; i < 7; i += 1) ids.push(await seedReconciliation(h, s, `R${i}`, 200_000 + i));
      await seedHistory(h, s, 80, "cancelled", 1_000);
      const listed = await h.payments.attemptsForBooking(h.db as never, s.bookingId);
      for (const id of ids) assert.ok(listed.some((row: { id: string }) => row.id === id), id);
    });
  });

  test("P2: ordinary history stays bounded, newest first, whatever its size", async () => {
    await run(async (h) => {
      const s = await scene(h);
      await seedHistory(h, s, 200, "superseded", 10_000);
      const listed = await h.payments.attemptsForBooking(h.db as never, s.bookingId);
      assert.equal(listed.length, 50, "bounded");
      const times = listed.map((row: { createdAt: Date }) => row.createdAt.getTime());
      assert.deepEqual([...times].sort((a, b) => b - a), times, "newest first");
      const withRecon = await seedReconciliation(h, s, "X", 500_000);
      const again = await h.payments.attemptsForBooking(h.db as never, s.bookingId);
      assert.equal(again.length, 51, "the cap bounds history only; exceptions are added on top");
      assert.ok(again.some((row: { id: string }) => row.id === withRecon));
    });
  });

  test("P2: the customer's own reconciliation is still shown to them without provider-only fields, and others' are not", async () => {
    await run(async (h) => {
      const s = await scene(h);
      const mine = await seedReconciliation(h, s, "MINE", 100_000);
      const otherCustomer = await h.user("other-customer");
      await h.q(`INSERT INTO catering_booking_payment_attempts (${ATTEMPT_COLUMNS}, ${RECONCILIATION_COLUMNS})
        VALUES ($1, $2, $3, $4, 'M', 'L', 'USD', 500, 'recon-theirs', 'reconciliation_required', now(), 'PAYMENT_THEIRS', 500, 'USD', 'payable_changed', 1)`, [s.bookingId, s.invoiceIds[1], otherCustomer, s.providerId]);
      await seedHistory(h, s, 60, "cancelled", 1_000);
      const { visibleCateringPaymentAttempts } = await import("../serializers/catering-booking-payment-attempt");
      const listed = await h.payments.attemptsForBooking(h.db as never, s.bookingId);
      const customerRows = visibleCateringPaymentAttempts(listed, "customer", s.customerId);
      assert.ok(customerRows.some((row) => row.id === mine));
      assert.equal(customerRows.some((row) => row.customerId === otherCustomer), false);
      const customerView = customerRows.filter((row) => row.id === mine).map((row) => serializeCateringPaymentAttempt(row, "customer"))[0];
      assert.equal(customerView.squarePaymentId, undefined);
      assert.equal(customerView.reconciliationReason, "payable_changed");
      const providerRows = visibleCateringPaymentAttempts(listed, "provider", s.providerId);
      assert.ok(providerRows.some((row) => row.customerId === otherCustomer), "the provider sees all");
    });
  });

  test("P2: only safe fields leave the service: no credential, idempotency key, Square order/link id or merchant/location", async () => {
    await run(async (h) => {
      const s = await scene(h);
      await seedReconciliation(h, s, "SAFE", 100_000);
      const listed = await h.payments.attemptsForBooking(h.db as never, s.bookingId);
      for (const role of ["provider", "customer"] as const) {
        const text = JSON.stringify(listed.map((row: never) => serializeCateringPaymentAttempt(row, role)));
        assert.equal(/idempotency|recon-SAFE|merchantId|locationId|squareOrderId|squarePaymentLinkId|accessToken|refresh/i.test(text), false, role);
        assert.equal(text.includes(s.connection.accessToken), false);
      }
    });
  });

  /* ----------------------------------------------------------------------------------------------------------- *
   * Codex repair pass 3: every completed Square payment is preserved; Square's date is the accounting date
   * ----------------------------------------------------------------------------------------------------------- */

  const receivedOn = async (h: CateringSquareHarness, bookingId: string) => String((await h.q(`SELECT received_on::text AS d FROM catering_booking_payments WHERE booking_id = $1 AND payment_source = 'processor'`, [bookingId]))[0].d);
  const evidenceRows = (h: CateringSquareHarness, attemptId: string) => h.q(`SELECT * FROM catering_attempt_square_payments WHERE attempt_id = $1 ORDER BY completed_at, square_payment_id`, [attemptId]);

  test("P1: two completed Square payments on one order are BOTH preserved, with their own ids, amounts and times, and the attempt is reconciliation_required", async () => {
    await run(async (h) => {
      const s = await scene(h);
      const attempt = await open(h, s);
      const first = h.fake.payOrder(attempt.squareOrderId!, { id: "PAY_FIRST", updated_at: "2030-05-01T10:00:00Z", created_at: "2030-05-01T10:00:00Z" });
      const second = h.fake.payOrder(attempt.squareOrderId!, { id: "PAY_SECOND", total_money: { amount: 15000, currency: "USD" }, amount_money: { amount: 15000, currency: "USD" }, updated_at: "2030-05-01T11:30:00Z", created_at: "2030-05-01T11:30:00Z" });
      h.setClock(new Date("2030-05-02T09:00:00Z"));
      const outcome = await h.payments.settleAttempt(attempt.id);
      assert.equal(outcome.outcome, "reconciliation_required");
      const row = await h.attempt(attempt.id);
      assert.equal(row.state, "reconciliation_required");
      assert.equal(row.reconciliation_reason, "multiple_payments");
      assert.equal(Number(row.processor_payment_count), 2);
      assert.equal(row.square_payment_id, null, "no single payment is named as THE payment");
      assert.equal(Number(row.processor_amount_cents), 55000, "the total that moved, summed from the evidence");
      const evidence = await evidenceRows(h, attempt.id);
      assert.deepEqual(evidence.map((entry) => [entry.square_payment_id, Number(entry.amount_cents), entry.currency, entry.completed_at.toISOString()]), [
        [first.id, 40000, "USD", "2030-05-01T10:00:00.000Z"], [second.id, 15000, "USD", "2030-05-01T11:30:00.000Z"],
      ]);
      assert.equal((await h.ledger(s.bookingId)).length, 0, "neither payment was credited, and the invoice is NOT marked paid");
      assert.equal((await h.activity(s.bookingId)).length, 0);
      // the provider is shown exactly what Square says moved; the customer is not given Square ids
      const asProvider = await h.payments.getAttempt({ bookingId: s.bookingId, attemptId: attempt.id, userId: s.providerId });
      const asCustomer = await h.payments.getAttempt({ bookingId: s.bookingId, attemptId: attempt.id, userId: s.customerId });
      assert.ok(asProvider.kind === "ok" && asCustomer.kind === "ok");
      if (asProvider.kind !== "ok" || asCustomer.kind !== "ok") return;
      const providerView = serializeCateringPaymentAttempt(asProvider.attempt, "provider");
      const customerView = serializeCateringPaymentAttempt(asCustomer.attempt, "customer");
      assert.equal(providerView.squarePaymentId, undefined);
      assert.deepEqual(providerView.processorPayments?.map((payment) => [payment.squarePaymentId, payment.amountCents, payment.completedAt]), [["PAY_FIRST", 40000, "2030-05-01T10:00:00.000Z"], ["PAY_SECOND", 15000, "2030-05-01T11:30:00.000Z"]]);
      assert.equal(providerView.processorPaymentCount, 2);
      assert.deepEqual(customerView.processorPayments?.map((payment) => payment.amountCents), [40000, 15000]);
      assert.equal(JSON.stringify(customerView).includes("PAY_FIRST"), false);
    });
  });

  test("P1: replaying the webhook, the poll and the settlement over a multiple-payment attempt creates no duplicate evidence and loses none", async () => {
    await run(async (h) => {
      const s = await scene(h);
      const attempt = await open(h, s);
      h.fake.payOrder(attempt.squareOrderId!, { id: "PAY_A" });
      h.fake.payOrder(attempt.squareOrderId!, { id: "PAY_B", total_money: { amount: 1000, currency: "USD" }, amount_money: { amount: 1000, currency: "USD" } });
      await h.payments.settleAttempt(attempt.id);
      const before = await evidenceRows(h, attempt.id);
      for (let i = 0; i < 3; i += 1) {
        await h.payments.handleWebhookEvent({ eventId: `evt-multi-${i}`, eventType: "payment.updated", merchantId: s.connection.merchantId, orderId: attempt.squareOrderId, paymentId: null });
        await h.payments.handleWebhookEvent({ eventId: "evt-multi-0", eventType: "payment.updated", merchantId: s.connection.merchantId, orderId: attempt.squareOrderId, paymentId: null });
        await h.payments.settleAttempt(attempt.id);
        await h.payments.getAttempt({ bookingId: s.bookingId, attemptId: attempt.id, userId: s.customerId });
      }
      await Promise.all([h.payments.settleAttempt(attempt.id), h.payments.settleAttempt(attempt.id), h.payments.settleAttempt(attempt.id)]);
      const after = await evidenceRows(h, attempt.id);
      assert.equal(after.length, 2);
      assert.deepEqual(after.map((entry) => entry.id), before.map((entry) => entry.id), "the same rows, untouched");
      assert.equal((await h.ledger(s.bookingId)).length, 0);
      assert.equal(h.notifications.filter((n) => n.type === "catering_booking_square_payment_reconciliation_required").length, 1, "one notification, not one per replay");
    });
  });

  test("P1: a second completed payment that shows up AFTER the attempt was credited is preserved; the credited ledger row is never touched", async () => {
    await run(async (h) => {
      const s = await scene(h);
      const attempt = await open(h, s);
      h.fake.payOrder(attempt.squareOrderId!, { id: "PAY_CREDITED" });
      assert.equal((await h.payments.settleAttempt(attempt.id)).outcome, "completed");
      const ledgerBefore = await h.processorLedger(s.bookingId);
      assert.equal(ledgerBefore.length, 1);
      assert.equal((await evidenceRows(h, attempt.id)).length, 1, "the credited payment is evidence too");

      h.fake.payOrder(attempt.squareOrderId!, { id: "PAY_LATE", total_money: { amount: 40000, currency: "USD" }, amount_money: { amount: 40000, currency: "USD" } });
      // a NEW webhook for the order makes ChefSire look again, although the attempt is terminal
      const result = await h.payments.handleWebhookEvent({ eventId: "evt-late", eventType: "payment.updated", merchantId: s.connection.merchantId, orderId: attempt.squareOrderId, paymentId: "PAY_LATE" });
      assert.deepEqual(result, { kind: "processed", outcome: "reconciliation_required" });
      const row = await h.attempt(attempt.id);
      assert.equal(row.state, "reconciliation_required");
      assert.equal(row.reconciliation_reason, "multiple_payments");
      assert.equal(Number(row.processor_payment_count), 2);
      assert.equal(row.payment_id, ledgerBefore[0].id, "the ledger link to the credited payment is kept");
      assert.deepEqual((await evidenceRows(h, attempt.id)).map((entry) => entry.square_payment_id).sort(), ["PAY_CREDITED", "PAY_LATE"]);
      assert.deepEqual(await h.processorLedger(s.bookingId), ledgerBefore, "the ledger is byte-for-byte what it was");
      // replays of the audit add nothing
      await h.payments.handleWebhookEvent({ eventId: "evt-late-2", eventType: "payment.updated", merchantId: s.connection.merchantId, orderId: attempt.squareOrderId, paymentId: null });
      await h.payments.settleAttempt(attempt.id);
      assert.equal((await evidenceRows(h, attempt.id)).length, 2);
      assert.equal((await h.processorLedger(s.bookingId)).length, 1);
    });
  });

  test("P1: a second payment arriving after a single-payment RECONCILIATION is kept too, and cannot turn the attempt into a credit", async () => {
    await run(async (h) => {
      const s = await scene(h);
      const attempt = await open(h, s, 1);
      await h.adjustment(s.bookingId, s.providerId, "credit", 30000);
      h.fake.payOrder(attempt.squareOrderId!, { id: "PAY_ONE" });
      assert.equal((await h.payments.settleAttempt(attempt.id)).outcome, "reconciliation_required");
      assert.equal((await h.attempt(attempt.id)).square_payment_id, "PAY_ONE");
      h.fake.payOrder(attempt.squareOrderId!, { id: "PAY_TWO", total_money: { amount: 500, currency: "USD" }, amount_money: { amount: 500, currency: "USD" } });
      await h.payments.handleWebhookEvent({ eventId: "evt-two", eventType: "payment.updated", merchantId: s.connection.merchantId, orderId: attempt.squareOrderId, paymentId: null });
      const row = await h.attempt(attempt.id);
      assert.equal(row.state, "reconciliation_required");
      assert.equal(Number(row.processor_payment_count), 2);
      assert.equal(row.square_payment_id, null);
      assert.equal(Number(row.processor_amount_cents), 60500);
      assert.deepEqual((await evidenceRows(h, attempt.id)).map((entry) => entry.square_payment_id).sort(), ["PAY_ONE", "PAY_TWO"]);
      assert.equal((await h.ledger(s.bookingId)).length, 0);
    });
  });

  test("P1: a Square payment already recorded as evidence for another attempt cannot be claimed by this one, by the audit or by settlement", async () => {
    await run(async (h) => {
      const s = await scene(h);
      const a = await open(h, s, 0);
      const b = await open(h, s, 1);
      h.fake.payOrder(a.squareOrderId!, { id: "PAY_SHARED" });
      await h.payments.settleAttempt(a.id);
      // order B is (wrongly) shown with A's payment id
      const order = h.fake.orders.get(b.squareOrderId!)!;
      order.tenders.push({ id: "T_X", payment_id: "PAY_SHARED" });
      h.fake.payments.set("PAY_SHARED", { ...h.fake.payments.get("PAY_SHARED")!, order_id: b.squareOrderId!, total_money: { ...order.total_money }, amount_money: { ...order.total_money } });
      assert.equal((await h.payments.settleAttempt(b.id)).outcome, "rejected");
      assert.equal((await evidenceRows(h, b.id)).length, 0);
      await assert.rejects(h.q(`INSERT INTO catering_attempt_square_payments (attempt_id, square_payment_id, amount_cents, currency) VALUES ($1, 'PAY_SHARED', 100, 'USD')`, [b.id]), /catering_attempt_square_payments_payment_uidx/);
    });
  });

  test("P2: Square completed the payment before midnight and ChefSire verified after it: received-on is the SQUARE date, in the provider's calendar", async () => {
    await run(async (h) => {
      const s = await scene(h);
      const attempt = await open(h, s);
      h.fake.payOrder(attempt.squareOrderId!, { updated_at: "2030-06-01T23:50:00Z", created_at: "2030-06-01T23:50:00Z" });
      h.setClock(new Date("2030-06-02T00:40:00Z"));
      assert.equal((await h.payments.settleAttempt(attempt.id)).outcome, "completed");
      assert.equal(await receivedOn(h, s.bookingId), "2030-06-01", "not 2030-06-02, the day ChefSire verified it");
      const [evidence] = await evidenceRows(h, attempt.id);
      assert.equal(evidence.completed_at.toISOString(), "2030-06-01T23:50:00.000Z", "the full Square timestamp is kept for audit");
      assert.equal(evidence.square_created_at.toISOString(), "2030-06-01T23:50:00.000Z");
    });
  });

  test("P2: the provider's own timezone decides the date: a payment at 03:00Z is still the previous evening for a Los Angeles caterer", async () => {
    await run(async (h) => {
      const s = await scene(h);
      await h.q(`INSERT INTO catering_availability_settings (provider_id, timezone) VALUES ($1, 'America/Los_Angeles')`, [s.providerId]);
      const attempt = await open(h, s);
      h.fake.payOrder(attempt.squareOrderId!, { updated_at: "2030-06-02T03:00:00Z", created_at: "2030-06-02T03:00:00Z" });
      h.setClock(new Date("2030-06-02T20:00:00Z"));
      assert.equal((await h.payments.settleAttempt(attempt.id)).outcome, "completed");
      assert.equal(await receivedOn(h, s.bookingId), "2030-06-01");
    });
  });



  test("P2: a missing, malformed or future Square time is never replaced by ChefSire's date: the money is kept as payment_timestamp_invalid reconciliation", async () => {
    await run(async (h) => {
      const s = await scene(h);
      h.setClock(new Date("2030-06-02T00:40:00Z"));
      // One invoice per case: an invoice already under review refuses another checkout, so the third case uses the provider's other booking.
      const third = await h.booking({ providerId: s.providerId, customerId: s.customerId, invoices: [{ kind: "deposit", amountCents: 40000 }] });
      for (const [index, times] of ([[{ updated_at: "not-a-date", created_at: "also bad" }], [{ updated_at: "", created_at: "" }], [{ updated_at: "2031-01-01T00:00:00Z", created_at: "2031-01-01T00:00:00Z" }]] as const).entries()) {
        const attempt = index < 2 ? await open(h, s, index) : await (async () => {
          const created = await h.payments.createPayment({ bookingId: third.bookingId, invoiceId: third.invoiceIds[0], userId: s.customerId });
          assert.equal(created.kind, "ok");
          if (created.kind !== "ok") throw new Error("not ok");
          return created.attempt;
        })();
        h.fake.payOrder(attempt.squareOrderId!, times[0]);
        const outcome = await h.payments.settleAttempt(attempt.id);
        assert.equal(outcome.outcome, "reconciliation_required", JSON.stringify(times));
        const row = await h.attempt(attempt.id);
        assert.equal(row.reconciliation_reason, "payment_timestamp_invalid");
        assert.equal(Number(row.processor_amount_cents), Number(row.amount_cents), "the money that moved is kept");
        assert.equal((await evidenceRows(h, attempt.id)).length, 1);
      }
      assert.equal((await h.ledger(s.bookingId)).length, 0, "nothing was dated by ChefSire's clock");
    });
  });

  test("P2: with several payments each keeps its OWN Square time, independently", async () => {
    await run(async (h) => {
      const s = await scene(h);
      const attempt = await open(h, s);
      h.fake.payOrder(attempt.squareOrderId!, { id: "T1", updated_at: "2030-06-01T23:59:00Z", created_at: "2030-06-01T23:59:00Z" });
      h.fake.payOrder(attempt.squareOrderId!, { id: "T2", updated_at: "garbage", created_at: "garbage" });
      h.setClock(new Date("2030-06-03T00:00:00Z"));
      await h.payments.settleAttempt(attempt.id);
      const evidence = await h.q(`SELECT square_payment_id, completed_at FROM catering_attempt_square_payments WHERE attempt_id = $1 ORDER BY square_payment_id`, [attempt.id]);
      assert.equal(evidence[0].completed_at.toISOString(), "2030-06-01T23:59:00.000Z");
      assert.equal(evidence[1].completed_at, null, "an unusable time is stored as unusable, not borrowed from its sibling or from the clock");
    });
  });

  /* ----------------------------------------------------------------------------------------------------------- *
   * Codex repair pass 3 (round 3): a consumed attempt never discards fresher Square evidence
   * ----------------------------------------------------------------------------------------------------------- */

  /** Lets ONE settlement read Square, then stops it just before it locks anything, while other settlements run to completion. */
  function raceControl() {
    const ctl = {
      pauseOn: null as string | null,
      hidden: new Set<string>(),
      reached: Promise.resolve(),
      release: () => undefined as void,
      armed: null as { reached: () => void; gate: Promise<void> } | null,
      wrap: (api: ReturnType<typeof createSquareCheckoutApi>): ReturnType<typeof createSquareCheckoutApi> => ({
        ...api,
        retrieveOrder: async (token, id) => {
          const order = await api.retrieveOrder(token, id);
          return ctl.hidden.size ? { ...order, paymentIds: order.paymentIds.filter((paymentId) => !ctl.hidden.has(paymentId)) } : order;
        },
        retrievePayment: async (token, id) => {
          const payment = await api.retrievePayment(token, id);
          if (ctl.armed && ctl.pauseOn === id) {
            const { reached, gate } = ctl.armed;
            ctl.armed = null;
            reached();
            await gate;
          }
          return payment;
        },
      }),
      arm(paymentId: string) {
        ctl.pauseOn = paymentId;
        ctl.reached = new Promise<void>((resolve) => {
          const gate = new Promise<void>((open) => { ctl.release = open as () => void; });
          ctl.armed = { reached: resolve, gate };
        });
      },
    };
    return ctl;
  }
  const raceRun = (fn: (h: CateringSquareHarness, ctl: ReturnType<typeof raceControl>) => Promise<void>) => {
    const ctl = raceControl();
    return withCateringSquareHarness(URL_ENV!, { wrapCheckout: ctl.wrap }, (h) => fn(h, ctl));
  };
  const second = { total_money: { amount: 15000, currency: "USD" }, amount_money: { amount: 15000, currency: "USD" }, updated_at: "2030-05-01T11:30:00Z", created_at: "2030-05-01T11:30:00Z" };
  const first = { updated_at: "2030-05-01T10:00:00Z", created_at: "2030-05-01T10:00:00Z" };

  /** B reads P1+P2; A reads only P1 and commits first; B then takes the locks second. `finishB` releases B and returns what it settled to. */
  async function lostRace(h: CateringSquareHarness, ctl: ReturnType<typeof raceControl>, how: "poll" | "webhook") {
    const s = await scene(h);
    const attempt = await open(h, s);
    h.setClock(new Date("2030-05-02T09:00:00Z"));
    h.fake.payOrder(attempt.squareOrderId!, { id: "RACE_P1", ...first });
    h.fake.payOrder(attempt.squareOrderId!, { id: "RACE_P2", ...second });
    ctl.arm("RACE_P2");
    const webhook = (eventId: string) => h.payments.handleWebhookEvent({ eventId, eventType: "payment.updated", merchantId: s.connection.merchantId, orderId: attempt.squareOrderId, paymentId: null });
    const b = how === "poll" ? h.payments.settleAttempt(attempt.id) : webhook("evt-race-b");
    await withTimeout(ctl.reached, "B reached Square");
    ctl.hidden.add("RACE_P2"); // A's read of Square shows only P1
    const a = await withTimeout(h.payments.settleAttempt(attempt.id), "A settles");
    ctl.hidden.clear();
    assert.equal(a.outcome, "completed", "A holds only P1 and credits it");
    ctl.release();
    return { s, attempt, b: await withTimeout(b, "B settles"), webhook };
  }

  test("RACE: B (P1+P2) locks second after A committed P1 and STILL audits P2; P1 is credited once, P2 is evidence and never a credit", async () => {
    await raceRun(async (h, ctl) => {
      const { s, attempt, b } = await lostRace(h, ctl, "poll");
      assert.equal((b as { outcome: string }).outcome, "reconciliation_required", "not reduced to already_settled");
      const ledger = await h.processorLedger(s.bookingId);
      assert.equal(ledger.length, 1, "P1 credited exactly once");
      assert.equal(ledger[0].processor_payment_id, "RACE_P1");
      assert.equal(Number(ledger[0].amount_cents), 40000);
      assert.equal((await h.ledger(s.bookingId)).length, 1, "P2 got no normal credit, was not clamped or merged into P1");
      const row = await h.attempt(attempt.id);
      assert.equal(row.state, "reconciliation_required");
      assert.equal(row.reconciliation_reason, "multiple_payments");
      assert.equal(row.payment_id, ledger[0].id, "the link to the original credit is kept");
      assert.equal(Number(row.processor_payment_count), 2);
      const evidence = await evidenceRows(h, attempt.id);
      assert.deepEqual(evidence.map((entry) => [entry.square_payment_id, Number(entry.amount_cents), entry.currency, entry.completed_at.toISOString()]), [
        ["RACE_P1", 40000, "USD", "2030-05-01T10:00:00.000Z"], ["RACE_P2", 15000, "USD", "2030-05-01T11:30:00.000Z"],
      ]);
      // the provider's reconciliation view exposes P2 with its own reference and amount
      const asProvider = await h.payments.getAttempt({ bookingId: s.bookingId, attemptId: attempt.id, userId: s.providerId });
      assert.ok(asProvider.kind === "ok");
      if (asProvider.kind !== "ok") return;
      const view = serializeCateringPaymentAttempt(asProvider.attempt, "provider");
      assert.deepEqual(view.processorPayments?.map((payment) => [payment.squarePaymentId, payment.amountCents]), [["RACE_P1", 40000], ["RACE_P2", 15000]]);
      assert.equal(h.notifications.filter((n) => n.type === "catering_booking_square_payment_reconciliation_required").length, 1);
      // repeating B (poll, webhook, concurrently) duplicates nothing
      await Promise.all([h.payments.settleAttempt(attempt.id), h.payments.settleAttempt(attempt.id)]);
      assert.equal((await evidenceRows(h, attempt.id)).length, 2);
      assert.equal((await h.processorLedger(s.bookingId)).length, 1);
      assert.equal(h.notifications.filter((n) => n.type === "catering_booking_square_payment_reconciliation_required").length, 1, "one notification, not one per replay");
    });
  });

  test("RACE: the WEBHOOK that lost the race is recorded as processed/reconciliation_required, never as harmless already_settled; replays are idempotent", async () => {
    await raceRun(async (h, ctl) => {
      const { s, attempt, b, webhook } = await lostRace(h, ctl, "webhook");
      assert.deepEqual(b, { kind: "processed", outcome: "reconciliation_required" });
      const stored = await h.q(`SELECT * FROM catering_square_webhook_events WHERE event_id = 'evt-race-b'`);
      assert.equal(stored.length, 1);
      assert.equal(stored[0].state, "processed");
      assert.equal(stored[0].outcome, "reconciliation_required");
      assert.equal((await evidenceRows(h, attempt.id)).length, 2);
      const again = await webhook("evt-race-b");
      assert.equal((await evidenceRows(h, attempt.id)).length, 2, "the same event again changes nothing");
      void again;
      const fresh = await webhook("evt-race-c");
      assert.deepEqual(fresh, { kind: "processed", outcome: "already_settled" }, "with NO new evidence the outcome is the quiet one");
      assert.equal((await h.processorLedger(s.bookingId)).length, 1);
    });
  });

  test("RACE: a later P1+P2+P3 preserves P3 exactly once, and the same id arriving by webhook and by poll is one row", async () => {
    await raceRun(async (h, ctl) => {
      const { s, attempt } = await lostRace(h, ctl, "poll");
      h.fake.payOrder(attempt.squareOrderId!, { id: "RACE_P3", total_money: { amount: 700, currency: "USD" }, amount_money: { amount: 700, currency: "USD" }, updated_at: "2030-05-01T12:00:00Z", created_at: "2030-05-01T12:00:00Z" });
      const hook = () => h.payments.handleWebhookEvent({ eventId: `evt-p3-${Math.random()}`, eventType: "payment.updated", merchantId: s.connection.merchantId, orderId: attempt.squareOrderId, paymentId: "RACE_P3" });
      const results = await Promise.all([hook(), h.payments.settleAttempt(attempt.id), hook(), h.payments.settleAttempt(attempt.id)]);
      assert.ok(results.length === 4);
      assert.deepEqual((await evidenceRows(h, attempt.id)).map((entry) => entry.square_payment_id), ["RACE_P1", "RACE_P2", "RACE_P3"]);
      assert.equal(Number((await h.attempt(attempt.id)).processor_amount_cents), 40000 + 15000 + 700);
      assert.equal((await h.processorLedger(s.bookingId)).length, 1);
    });
  });

  test("RACE: concurrent webhook + poll settling P1 and P2 together lose nothing and credit once", async () => {
    await run(async (h) => {
      const s = await scene(h);
      const attempt = await open(h, s);
      h.setClock(new Date("2030-05-02T09:00:00Z"));
      h.fake.payOrder(attempt.squareOrderId!, { id: "CC_P1", ...first });
      const hook = (id: string) => h.payments.handleWebhookEvent({ eventId: id, eventType: "payment.updated", merchantId: s.connection.merchantId, orderId: attempt.squareOrderId, paymentId: null });
      const early = Promise.all([hook("cc-1"), h.payments.settleAttempt(attempt.id), hook("cc-2")]);
      h.fake.payOrder(attempt.squareOrderId!, { id: "CC_P2", ...second });
      await early;
      await Promise.all([hook("cc-3"), h.payments.settleAttempt(attempt.id), hook("cc-4"), h.payments.settleAttempt(attempt.id)]);
      const ids = (await evidenceRows(h, attempt.id)).map((entry) => entry.square_payment_id);
      assert.ok(ids.includes("CC_P1") && ids.includes("CC_P2") || (await h.processorLedger(s.bookingId)).length === 0, "every completed payment is evidence");
      assert.equal(new Set(ids).size, ids.length);
      assert.ok((await h.processorLedger(s.bookingId)).length <= 1, "never two normal credits");
      assert.ok(ids.includes("CC_P2"), "P2 was never lost");
    });
  });

  test("RACE: wrong reference / location / currency / status evidence is still rejected on a consumed attempt, and no secret is stored or logged", async () => {
    await raceRun(async (h, ctl) => {
      const { s, attempt } = await lostRace(h, ctl, "poll");
      const before = await evidenceRows(h, attempt.id);
      // a foreign payment (other location) appears on the order: the whole read is rejected, nothing is added
      h.fake.payOrder(attempt.squareOrderId!, { id: "RACE_BAD_LOC", location_id: "SOME_OTHER_LOCATION", ...second });
      const rejected = await h.payments.settleAttempt(attempt.id);
      assert.equal(rejected.outcome, "already_settled");
      // an unfinished payment is not money in hand
      h.fake.payOrder(attempt.squareOrderId!, { id: "RACE_PENDING", status: "PENDING", ...second });
      await h.payments.settleAttempt(attempt.id);
      const ids = (await evidenceRows(h, attempt.id)).map((entry) => entry.square_payment_id);
      assert.deepEqual(ids, before.map((entry) => entry.square_payment_id));
      assert.equal(ids.includes("RACE_BAD_LOC") || ids.includes("RACE_PENDING"), false);
      const everything = JSON.stringify([await h.q(`SELECT * FROM catering_attempt_square_payments`), await h.q(`SELECT * FROM catering_square_webhook_events`), h.logs]);
      assert.equal(everything.includes(s.connection.accessToken), false);
      assert.equal(/refresh-|access_token|accessToken/.test(everything), false);
    });
  });

  test("RACE (static): the consumed branch audits the evidence it already holds, under the held locks, with no Square call", async () => {
    const { readFileSync } = await import("node:fs");
    const source = readFileSync(new URL("./catering-square-payments.ts", import.meta.url), "utf8");
    const confirmed = source.slice(source.indexOf("async function recordConfirmedPayment"), source.indexOf("async function recordAdditionalPayments"));
    assert.match(confirmed, /if \(CONSUMED\.includes\(attempt\.state\)\) \{\s*const audited = await auditAdditionalPaymentsInTx\(tx, attempt, confirmed\.payments\)/);
    assert.equal(/return \{ kind: "already", attempt \};\s*\n\s*\n\s*\/\/ A Square payment/.test(confirmed), false, "no unconditional early return before the audit");
    const audit = source.slice(source.indexOf("async function auditAdditionalPaymentsInTx"), source.indexOf("async function notifyCompleted"));
    assert.equal(/checkout\.|fetchEvidence|retrieveOrder|retrievePayment/.test(audit), false, "no Square network call inside the locks");
  });

  /* ----------------------------------------------------------------------------------------------------------- *
   * Codex repair pass 4, finding 1: unreadable Square evidence is never "already settled"
   * ----------------------------------------------------------------------------------------------------------- */

  const hook = (h: CateringSquareHarness, s: Scene, attempt: { squareOrderId: string | null }, eventId: string, paymentId: string | null = null) =>
    h.payments.handleWebhookEvent({ eventId, eventType: "payment.updated", merchantId: s.connection.merchantId, orderId: attempt.squareOrderId, paymentId });
  const eventRow = async (h: CateringSquareHarness, eventId: string) => (await h.q(`SELECT * FROM catering_square_webhook_events WHERE event_id = $1`, [eventId]))[0];
  const p2Body = { total_money: { amount: 15000, currency: "USD" }, amount_money: { amount: 15000, currency: "USD" }, updated_at: "2030-05-01T11:30:00Z", created_at: "2030-05-01T11:30:00Z" };

  test("EVIDENCE: completed attempt + webhook + Square read succeeds with NO new payment -> already_settled (no new evidence), event processed", async () => {
    await run(async (h) => {
      const s = await scene(h);
      const attempt = await open(h, s);
      h.setClock(new Date("2030-05-02T09:00:00Z"));
      h.fake.payOrder(attempt.squareOrderId!, { id: "EV_P1", ...first });
      assert.equal((await h.payments.settleAttempt(attempt.id)).outcome, "completed");
      assert.deepEqual(await hook(h, s, attempt, "evt-nonew"), { kind: "processed", outcome: "already_settled" });
      assert.equal((await eventRow(h, "evt-nonew")).state, "processed");
      assert.equal((await h.processorLedger(s.bookingId)).length, 1);
      assert.equal((await evidenceRows(h, attempt.id)).length, 1);
    });
  });

  test("EVIDENCE: completed attempt + webhook + a NEW payment -> preserved exactly once, event processed as reconciliation_required, no second credit", async () => {
    await run(async (h) => {
      const s = await scene(h);
      const attempt = await open(h, s);
      h.setClock(new Date("2030-05-02T09:00:00Z"));
      h.fake.payOrder(attempt.squareOrderId!, { id: "EV_P1", ...first });
      await h.payments.settleAttempt(attempt.id);
      h.fake.payOrder(attempt.squareOrderId!, { id: "EV_P2", ...p2Body });
      assert.deepEqual(await hook(h, s, attempt, "evt-new", "EV_P2"), { kind: "processed", outcome: "reconciliation_required" });
      assert.equal((await eventRow(h, "evt-new")).state, "processed");
      assert.deepEqual((await evidenceRows(h, attempt.id)).map((row) => row.square_payment_id), ["EV_P1", "EV_P2"]);
      assert.equal((await h.processorLedger(s.bookingId)).length, 1);
    });
  });

  for (const consumedAs of ["completed", "reconciliation_required"] as const) {
    test(`EVIDENCE: ${consumedAs} attempt + webhook + transient Square failure -> RETRYABLE (not already_settled); the event is NOT processed; a later retry audits the new payment; retries are idempotent`, async () => {
      await run(async (h) => {
        const s = await scene(h);
        const attempt = await open(h, s, consumedAs === "completed" ? 0 : 1);
        h.setClock(new Date("2030-05-02T09:00:00Z"));
        if (consumedAs === "reconciliation_required") await h.adjustment(s.bookingId, s.providerId, "credit", 30000);
        h.fake.payOrder(attempt.squareOrderId!, { id: "RT_P1", ...(consumedAs === "completed" ? first : { updated_at: "2030-05-01T10:00:00Z", created_at: "2030-05-01T10:00:00Z", total_money: { amount: 60000, currency: "USD" }, amount_money: { amount: 60000, currency: "USD" } }) });
        await h.payments.settleAttempt(attempt.id);
        assert.equal((await h.attempt(attempt.id)).state, consumedAs);
        const ledgerBefore = await h.processorLedger(s.bookingId);

        // a NEW payment lands, but the fresh read fails
        h.fake.payOrder(attempt.squareOrderId!, { id: "RT_P2", ...p2Body });
        h.fake.state.evidenceFailure = 503;
        const direct = await h.payments.settleAttempt(attempt.id);
        assert.equal(direct.outcome === "unavailable" && direct.reason, "square_unreachable", "not already_settled");
        const failed = await hook(h, s, attempt, "evt-retry", "RT_P2");
        assert.deepEqual(failed, { kind: "retry", reason: "square_unreachable" });
        const stored = await eventRow(h, "evt-retry");
        assert.equal(stored.state, "failed", "NOT processed: Square will redeliver");
        assert.equal(stored.processed_at, null);
        assert.deepEqual((await evidenceRows(h, attempt.id)).map((row) => row.square_payment_id), ["RT_P1"], "nothing was lost or invented while Square was unreadable");

        // Square is readable again: the SAME event is retried and now audits P2
        h.fake.state.evidenceFailure = undefined;
        assert.deepEqual(await hook(h, s, attempt, "evt-retry", "RT_P2"), { kind: "processed", outcome: "reconciliation_required" });
        assert.equal((await eventRow(h, "evt-retry")).state, "processed");
        assert.deepEqual((await evidenceRows(h, attempt.id)).map((row) => row.square_payment_id), ["RT_P1", "RT_P2"]);
        // idempotent: the same event again, a fresh event and a poll add nothing
        assert.deepEqual(await hook(h, s, attempt, "evt-retry", "RT_P2"), { kind: "duplicate" });
        assert.deepEqual(await hook(h, s, attempt, "evt-retry-2"), { kind: "processed", outcome: "already_settled" });
        await h.payments.settleAttempt(attempt.id);
        assert.equal((await evidenceRows(h, attempt.id)).length, 2);
        assert.deepEqual(await h.processorLedger(s.bookingId), consumedAs === "completed" ? ledgerBefore : [], "no duplicate normal credit");
        assert.equal((await h.processorLedger(s.bookingId)).length, consumedAs === "completed" ? 1 : 0);
      });
    });
  }

  test("EVIDENCE: a consumed attempt whose connection is not ready, or now belongs to another merchant, is also retryable rather than already_settled", async () => {
    await run(async (h) => {
      const s = await scene(h);
      const attempt = await open(h, s);
      h.setClock(new Date("2030-05-02T09:00:00Z"));
      h.fake.payOrder(attempt.squareOrderId!, { id: "NR_P1", ...first });
      await h.payments.settleAttempt(attempt.id);
      await h.q(`UPDATE payment_methods SET account_status = 'needs_reauthorization', encrypted_access_token = NULL, encrypted_refresh_token = NULL, token_expires_at = NULL WHERE user_id = $1`, [s.providerId]);
      const outcome = await h.payments.settleAttempt(attempt.id);
      assert.equal(outcome.outcome === "unavailable" && outcome.reason, "connection_not_ready");
      assert.equal((await hook(h, s, attempt, "evt-nr")).kind, "retry");
      assert.equal((await eventRow(h, "evt-nr")).state, "failed");
    });
  });

  /* ----------------------------------------------------------------------------------------------------------- *
   * Codex repair pass 4, finding 2: a credential that is on file is never discarded while a live link depends on it
   * ----------------------------------------------------------------------------------------------------------- */

  /** An attempt that is locally closed but whose Square link removal is NOT confirmed (the state a failed delete leaves). */
  async function unconfirmedLink(h: CateringSquareHarness, s: Scene, invoiceIndex = 0) {
    const attempt = await open(h, s, invoiceIndex);
    await h.q(`UPDATE catering_booking_payment_attempts SET state = 'cancelled', closed_at = now() WHERE id = $1`, [attempt.id]);
    assert.equal((await h.attempt(attempt.id)).square_link_closed_at, null);
    return attempt;
  }
  const stillConnected = async (h: CateringSquareHarness, s: Scene) => {
    const row = await h.row(s.providerId);
    assert.equal(row.account_status, "active");
    assert.ok(row.encrypted_access_token && row.encrypted_refresh_token, "the credential was kept for a later retry");
  };

  test("DISPOSAL: a live checkout + a ready credential -> the link is closed WITH the credential before it is discarded", async () => {
    await run(async (h) => {
      const s = await scene(h);
      const attempt = await open(h, s);
      const result = await h.connections.disconnect(s.providerId);
      assert.equal(result.changed, true);
      assert.equal(h.fake.links.get(attempt.squarePaymentLinkId!)!.deleted, true);
      assert.ok((await h.attempt(attempt.id)).square_link_closed_at);
      assert.equal((await h.row(s.providerId)).account_status, "disconnected");
    });
  });

  const notReady: { name: string; apply: (h: CateringSquareHarness, s: Scene) => Promise<() => Promise<void> | void> }[] = [
    {
      name: "verification temporarily unavailable",
      apply: async (h, s) => {
        await h.q(`UPDATE payment_methods SET last_verified_at = now() - interval '2 days' WHERE user_id = $1`, [s.providerId]);
        h.fake.state.failures.merchant = 503; h.fake.state.failures.tokenStatus = 503; h.fake.state.failures.locations = 503;
        return () => { h.fake.state.failures.merchant = undefined; h.fake.state.failures.tokenStatus = undefined; h.fake.state.failures.locations = undefined; };
      },
    },
    {
      name: "token refresh failing",
      apply: async (h, s) => {
        await h.q(`UPDATE payment_methods SET token_expires_at = now() + interval '1 hour' WHERE user_id = $1`, [s.providerId]);
        h.fake.state.failures.token = 503;
        return () => { h.fake.state.failures.token = undefined; };
      },
    },
    {
      name: "configuration_error with the encrypted credential still persisted",
      apply: async () => {
        const saved = process.env.SQUARE_APPLICATION_SECRET;
        delete process.env.SQUARE_APPLICATION_SECRET;
        return () => { process.env.SQUARE_APPLICATION_SECRET = saved; };
      },
    },
  ];
  for (const scenario of notReady) {
    test(`DISPOSAL: an unconfirmed link + ${scenario.name} (credentials not obtainable) -> disconnect and merchant replacement are BLOCKED, the credential is kept, and a later retry succeeds`, async () => {
      await run(async (h) => {
        const s = await scene(h);
        const attempt = await unconfirmedLink(h, s);
        const undo = await scenario.apply(h, s);
        assert.equal(await h.connections.getReadyConnectedCredentials(s.providerId).catch(() => null), null, "precondition: not payment-ready");
        await assert.rejects(h.connections.disconnect(s.providerId), SquareCredentialDiscardBlockedError);
        await assert.rejects(h.connections.disconnect(s.providerId), SquareCredentialDiscardBlockedError, "repeating stays refused");
        assert.deepEqual(await h.connections.guardCredentialReplacement(s.providerId, "MERCHANT_NEW"), { allowed: false }, "a replacement cannot orphan the live link either");
        assert.equal(h.fake.links.get(attempt.squarePaymentLinkId!)!.deleted, false);
        assert.equal((await h.attempt(attempt.id)).square_link_closed_at, null);
        const row = await h.row(s.providerId);
        assert.equal(row.account_status === "disconnected", false);
        assert.ok(row.encrypted_access_token && row.encrypted_refresh_token, "the credential is preserved for cleanup and reconciliation");
        assert.equal(JSON.stringify({ logs: h.logs }).includes(s.connection.accessToken), false, "no secret leaks into logs");

        await undo();
        const result = await h.connections.disconnect(s.providerId);
        assert.equal(result.changed, true, "the retry proceeds once the credential works");
        assert.equal(h.fake.links.get(attempt.squarePaymentLinkId!)!.deleted, true);
        assert.ok((await h.attempt(attempt.id)).square_link_closed_at);
        assert.equal((await h.connections.disconnect(s.providerId)).changed, false, "repeat after success is a no-op");
      });
    });
  }

  test("DISPOSAL: a failed cleanup with a READY credential also preserves the credential for a later retry", async () => {
    await run(async (h) => {
      const s = await scene(h);
      const attempt = await unconfirmedLink(h, s);
      h.fake.state.linkDeleteFailure = 503;
      await assert.rejects(h.connections.disconnect(s.providerId), SquareCredentialDiscardBlockedError);
      await stillConnected(h, s);
      h.fake.state.linkDeleteFailure = undefined;
      assert.equal((await h.connections.disconnect(s.providerId)).changed, true);
      assert.ok((await h.attempt(attempt.id)).square_link_closed_at);
    });
  });

  test("DISPOSAL: no Catering checkout at all -> disconnect proceeds under the Gate 0 rules, even when the credential is not ready", async () => {
    await run(async (h) => {
      const s = await scene(h);
      await h.q(`UPDATE payment_methods SET token_expires_at = now() + interval '1 hour' WHERE user_id = $1`, [s.providerId]);
      h.fake.state.failures.token = 503;
      const result = await h.connections.disconnect(s.providerId);
      assert.equal(result.changed, true);
      assert.equal((await h.row(s.providerId)).account_status, "disconnected");
    });
  });

  test("DISPOSAL: every link already confirmed closed -> disconnect proceeds even when the credential is not ready", async () => {
    await run(async (h) => {
      const s = await scene(h);
      const attempt = await open(h, s);
      await h.q(`UPDATE catering_booking_payment_attempts SET state = 'cancelled', closed_at = now(), square_link_closed_at = now(), last_checked_at = now() + interval '1 second', closure_verified_at = now() + interval '1 second' WHERE id = $1`, [attempt.id]);
      await h.q(`UPDATE payment_methods SET token_expires_at = now() + interval '1 hour' WHERE user_id = $1`, [s.providerId]);
      h.fake.state.failures.token = 503;
      assert.equal((await h.connections.disconnect(s.providerId)).changed, true);
    });
  });

  test("DISPOSAL: persisted state proving NO credential is on file (needs re-authorization) never traps the provider, even with an unconfirmed link", async () => {
    await run(async (h) => {
      const s = await scene(h);
      await unconfirmedLink(h, s);
      await h.q(`UPDATE payment_methods SET account_status = 'needs_reauthorization', encrypted_access_token = NULL, encrypted_refresh_token = NULL, token_expires_at = NULL WHERE user_id = $1`, [s.providerId]);
      assert.deepEqual(await h.connections.storedCredentialState(s.providerId), { present: false, merchantId: null });
      assert.deepEqual(await h.payments.closeProviderCheckouts(s.providerId), { safe: true });
      assert.equal((await h.connections.disconnect(s.providerId)).changed, true);
    });
  });

  test("DISPOSAL: storedCredentialState reports only presence and merchant, never a token", async () => {
    await run(async (h) => {
      const s = await scene(h);
      const state = await h.connections.storedCredentialState(s.providerId);
      assert.deepEqual(state, { present: true, merchantId: s.connection.merchantId });
      assert.equal(JSON.stringify(state).includes(s.connection.accessToken), false);
    });
  });

  /* ----------------------------------------------------------------------------------------------------------- *
   * Codex repair pass 4, finding 3: checkout needs the webhook configured
   * ----------------------------------------------------------------------------------------------------------- */

  async function withoutWebhookConfig<T>(variable: string, fn: () => Promise<T>): Promise<T> {
    const saved = process.env[variable];
    delete process.env[variable];
    try { return await fn(); } finally { process.env[variable] = saved; }
  }
  for (const variable of ["SQUARE_CATERING_WEBHOOK_NOTIFICATION_URL", "SQUARE_CATERING_WEBHOOK_SIGNATURE_KEY"]) {
    test(`READINESS: without ${variable} the pay path fails closed: no attempt, no Square link, no request to Square`, async () => {
      await run(async (h) => {
        const s = await scene(h);
        const callsBefore = h.fake.requests.length;
        const outcome = await withoutWebhookConfig(variable, () => pay(h, s));
        assert.equal(outcome.kind, "unavailable");
        assert.equal((await h.attempts(s.bookingId)).length, 0);
        assert.equal(h.fake.links.size, 0);
        assert.equal(h.fake.requests.length, callsBefore, "Square was not called at all");
        // and with the configuration present it works again
        assert.equal((await pay(h, s)).kind, "ok");
      });
    });
  }

  test("READINESS: missing webhook configuration stops NEW checkouts but never stops closing a live link or recognising money that already moved", async () => {
    await run(async (h) => {
      const s = await scene(h);
      const attempt = await open(h, s);
      h.setClock(new Date("2030-05-02T09:00:00Z"));
      h.fake.payOrder(attempt.squareOrderId!, { id: "CFG_P1", ...first });
      const second = await unconfirmedLink(h, s, 1);
      await withoutWebhookConfig("SQUARE_CATERING_WEBHOOK_SIGNATURE_KEY", async () => {
        assert.equal(h.payments.enabled(), false);
        assert.equal((await h.payments.settleAttempt(attempt.id)).outcome, "completed", "existing evidence is still recognised");
        assert.equal(await h.payments.sweepClosedLinks(s.bookingId, { force: true }), 1, "the live link is still closed");
        assert.equal(h.fake.links.get(second.squarePaymentLinkId!)!.deleted, true);
      });
    });
  });

  /* ----------------------------------------------------------------------------------------------------------- *
   * Codex repair pass 5: a credential is never discarded while a checkout CREATE call may still produce a live link
   * ----------------------------------------------------------------------------------------------------------- */

  /** Holds the Square create call in flight (after the durable marker is committed, before Square is reached) until `release()`. */
  function createHold() {
    const ctl = {
      held: false,
      entered: Promise.resolve(),
      release: () => undefined as void,
      arm() {
        ctl.held = true;
        ctl.entered = new Promise<void>((resolve) => { ctl.enter = resolve; });
        return new Promise<void>((open) => { ctl.release = open as () => void; });
      },
      enter: () => undefined as void,
      gate: Promise.resolve(),
      wrap: (api: ReturnType<typeof createSquareCheckoutApi>): ReturnType<typeof createSquareCheckoutApi> => ({
        ...api,
        createPaymentLink: async (token, input) => {
          if (ctl.held) { ctl.held = false; ctl.enter(); await ctl.gate; }
          return api.createPaymentLink(token, input);
        },
      }),
    };
    return ctl;
  }
  const holdRun = (fn: (h: CateringSquareHarness, ctl: ReturnType<typeof createHold>) => Promise<void>) => {
    const ctl = createHold();
    return withCateringSquareHarness(URL_ENV!, { wrapCheckout: ctl.wrap }, (h) => fn(h, ctl));
  };
  const hold = (ctl: ReturnType<typeof createHold>) => { ctl.gate = ctl.arm(); };
  const creatingRow = async (h: CateringSquareHarness, bookingId: string) => (await h.attempts(bookingId))[0];

  test("INFLIGHT: while Square's create is held, disconnect and merchant replacement are BLOCKED; when it succeeds the link is kept, closed with the OLD credential, and only then may the credential go", async () => {
    await holdRun(async (h, ctl) => {
      const s = await scene(h);
      hold(ctl);
      const paying = pay(h, s);                       // 1-2: attempt created, Square call in flight
      await withTimeout(ctl.entered, "create in flight");
      const inflight = await creatingRow(h, s.bookingId);
      assert.equal(inflight.state, "creating");
      assert.equal(inflight.square_payment_link_id, null, "4: no link id exists yet");
      assert.ok(inflight.square_create_started_at, "the external call is durably marked");
      assert.equal(inflight.square_create_resolved_at, null);

      // 3, 5, 15, 16: B starts; the guard cannot rely on a link id, and refuses
      await assert.rejects(h.connections.disconnect(s.providerId), SquareCredentialDiscardBlockedError);
      assert.deepEqual(await h.connections.guardCredentialReplacement(s.providerId, "MERCHANT_NEW"), { allowed: false });
      await assert.rejects(h.connections.disconnect(s.providerId), SquareCredentialDiscardBlockedError, "14: repeated attempts stay refused");
      assert.equal((await h.attempt(inflight.id)).state, "cancelled", "locally non-payable already");
      const row = await h.row(s.providerId);
      assert.equal(row.account_status, "active");
      assert.ok(row.encrypted_access_token && row.encrypted_refresh_token, "16: the old credential is untouched");
      assert.equal(row.provider_id, s.connection.merchantId);

      ctl.release();                                   // 6: Square returns the link
      const created = await withTimeout(paying, "create completes");
      assert.equal(created.kind, "ok");
      const after = await h.attempt(inflight.id);
      assert.ok(after.square_payment_link_id && after.square_order_id, "7: identifiers persisted on the closed attempt");
      assert.ok(after.square_create_resolved_at, "creation is resolved");
      assert.equal(after.state, "cancelled");
      assert.equal(h.fake.links.get(after.square_payment_link_id)!.deleted, true, "8-9: cleaned up with the old credential still present");
      assert.ok(after.square_link_closed_at);
      assert.equal(after.checkout_url, null, "the stale checkout is never exposed to the customer");
      if (created.kind === "ok") assert.equal(serializeCateringPaymentAttempt({ ...(created.attempt as never), processorPayments: [] } as never, "customer").checkoutUrl, undefined);

      assert.equal((await h.connections.disconnect(s.providerId)).changed, true, "10: now disposal may proceed");
      assert.equal((await h.connections.disconnect(s.providerId)).changed, false, "14: idempotent");
      assert.equal(h.fake.links.size, 1, "17: one checkout, never a duplicate");
      assert.equal((await h.ledger(s.bookingId)).length, 0, "18");
      assert.equal(JSON.stringify({ logs: h.logs, a: await h.attempts(s.bookingId) }).includes(s.connection.accessToken), false, "20");
    });
  });

  test("INFLIGHT: a create that Square definitively refuses resolves the marker, and disposal may then proceed", async () => {
    await holdRun(async (h, ctl) => {
      const s = await scene(h);
      hold(ctl);
      const paying = pay(h, s);
      await withTimeout(ctl.entered, "create in flight");
      await assert.rejects(h.connections.disconnect(s.providerId), SquareCredentialDiscardBlockedError);
      h.fake.state.checkoutCreateFailure = 400;
      ctl.release();
      await withTimeout(paying, "create completes");
      const row = await creatingRow(h, s.bookingId);
      assert.ok(row.square_create_resolved_at, "11: the refusal resolves the creation");
      assert.equal(row.square_payment_link_id, null);
      assert.equal(h.fake.links.size, 0, "no external object exists");
      assert.equal((await h.connections.disconnect(s.providerId)).changed, true);
    });
  });

  test("INFLIGHT: an UNCERTAIN create keeps disposal blocked; once stale it is reconciled with the SAME idempotency key (no second link), cleaned up, and only then may the credential go", async () => {
    await run(async (h) => {
      const s = await scene(h);
      h.fake.state.checkoutCreateLosesResponse = true;       // Square creates the link but the answer is lost
      const created = await pay(h, s);
      assert.ok(created.kind === "ok");
      const row = await creatingRow(h, s.bookingId);
      assert.equal(row.state, "creating");
      assert.equal(row.square_payment_link_id, null);
      assert.equal(row.square_create_resolved_at, null, "uncertain is never resolved");
      assert.equal(h.fake.links.size, 1, "Square did create one");

      // recent: presumed in flight, waited for
      await assert.rejects(h.connections.disconnect(s.providerId), SquareCredentialDiscardBlockedError);
      assert.equal(h.fake.links.size, 1);
      // stale, and Square still unreachable: reconcile is uncertain too, so it stays blocked
      await h.q(`UPDATE catering_booking_payment_attempts SET square_create_started_at = now() - interval '10 minutes' WHERE id = $1`, [row.id]);
      h.fake.state.checkoutCreateFailure = 503;
      h.fake.state.checkoutCreateLosesResponse = false;
      await assert.rejects(h.connections.disconnect(s.providerId), SquareCredentialDiscardBlockedError, "12");
      assert.equal((await h.row(s.providerId)).account_status, "active");
      assert.equal((await h.attempt(row.id)).square_create_resolved_at, null);

      // Square answers again: the same key returns the existing link (13), which is closed before the credential goes
      h.fake.state.checkoutCreateFailure = undefined;
      const result = await h.connections.disconnect(s.providerId);
      assert.equal(result.changed, true);
      const after = await h.attempt(row.id);
      assert.ok(after.square_payment_link_id && after.square_create_resolved_at && after.square_link_closed_at);
      assert.equal(h.fake.links.size, 1, "17: the SAME link, no duplicate checkout");
      assert.equal(h.fake.links.get(after.square_payment_link_id)!.deleted, true);
      assert.equal(after.state, "cancelled");
    });
  });

  test("INFLIGHT: a customer who pays on the held link before cleanup completes is preserved by authoritative evidence and never lost", async () => {
    await holdRun(async (h, ctl) => {
      const s = await scene(h);
      hold(ctl);
      h.setClock(new Date("2030-05-02T09:00:00Z"));
      const paying = pay(h, s);
      await withTimeout(ctl.entered, "create in flight");
      await assert.rejects(h.connections.disconnect(s.providerId), SquareCredentialDiscardBlockedError);
      h.fake.state.linkDeleteFailure = 503;            // cleanup cannot finish
      ctl.release();
      await withTimeout(paying, "create completes");
      const row = await creatingRow(h, s.bookingId);
      assert.ok(row.square_payment_link_id);
      assert.equal(row.square_link_closed_at, null, "the delete failed, so the link is still live");
      await assert.rejects(h.connections.disconnect(s.providerId), SquareCredentialDiscardBlockedError, "still blocked: a live link remains");
      h.fake.payOrder(row.square_order_id, { id: "INFL_PAY", ...first });
      const settled = await h.payments.settleAttempt(row.id);
      assert.ok(settled.outcome === "completed" || settled.outcome === "reconciliation_required", settled.outcome);
      assert.deepEqual((await evidenceRows(h, row.id)).map((entry) => entry.square_payment_id), ["INFL_PAY"], "19: moved money is preserved");
      assert.ok((await h.processorLedger(s.bookingId)).length <= 1, "18: never a duplicate credit");
    });
  });

  test("INFLIGHT: the second question inside the credential transaction refuses a change the first question missed (disconnect and merchant replacement)", async () => {
    await run(async (h) => {
      const s = await scene(h);
      const attempt = await open(h, s);
      // a guard that wrongly says "safe": only the in-transaction re-check stands between the credential and its destruction
      h.connections.setCredentialDiscardGuard(async () => ({ safe: true }), (context) => h.payments.credentialStillNeeded(context));
      await assert.rejects(h.connections.disconnect(s.providerId), SquareCredentialDiscardBlockedError);
      await assert.rejects(h.connectProvider(s.providerId, "MERCHANT_NEW", { access: "access-new", refresh: "refresh-new" }), SquareCredentialDiscardBlockedError);
      const row = await h.row(s.providerId);
      assert.equal(row.account_status, "active");
      assert.equal(row.provider_id, s.connection.merchantId, "the old merchant is never replaced while still needed");
      assert.equal((await h.attempt(attempt.id)).state, "pending");
    });
  });

  test("INFLIGHT: a checkout is never created with a credential that was discarded after it was read: the attempt fails without calling Square", async () => {
    let afterCredentials: (() => Promise<void>) | null = null;
    await withCateringSquareHarness(URL_ENV!, {
      wrapConnections: (connections) => new Proxy(connections, {
        get(target, property, receiver) {
          const value = Reflect.get(target, property, receiver);
          if (property !== "getReadyConnectedCredentials") return value;
          return async (...args: unknown[]) => {
            const result = await (value as (...inner: unknown[]) => Promise<unknown>).apply(target, args);
            if (afterCredentials) { const run = afterCredentials; afterCredentials = null; await run(); }
            return result;
          };
        },
      }),
    }, async (h) => {
      const s = await scene(h);
      afterCredentials = async () => { await h.connections.disconnect(s.providerId); };
      const createCalls = () => h.fake.requests.filter((request) => request.path.startsWith("/v2/online-checkout")).length;
      const before = createCalls();
      const outcome = await pay(h, s);
      assert.ok(outcome.kind === "ok" && outcome.attempt.state === "failed");
      assert.equal(createCalls(), before, "Square was never asked");
      assert.equal(h.fake.links.size, 0);
      assert.equal((await creatingRow(h, s.bookingId)).failure_code, "provider_credential_changed");
    });
  });

  test("INFLIGHT: the new columns are durable bookkeeping only: no secret, and nothing about them reaches a client view", async () => {
    await run(async (h) => {
      const s = await scene(h);
      const attempt = await open(h, s);
      const status = await h.payments.getAttempt({ bookingId: s.bookingId, attemptId: attempt.id, userId: s.providerId });
      assert.ok(status.kind === "ok");
      if (status.kind === "ok") assert.equal(/create_?started|create_?resolved|squareCreate/i.test(JSON.stringify(serializeCateringPaymentAttempt(status.attempt, "provider"))), false);
    });
  });

  /* ----------------------------------------------------------------------------------------------------------- *
   * Codex repair pass 6: what the provider is told about currency and about which payment is in the ledger
   * ----------------------------------------------------------------------------------------------------------- */

  const providerView = async (h: CateringSquareHarness, s: Scene, attemptId: string) => {
    const status = await h.payments.getAttempt({ bookingId: s.bookingId, attemptId, userId: s.providerId });
    assert.ok(status.kind === "ok");
    if (status.kind !== "ok") throw new Error("not ok");
    return serializeCateringPaymentAttempt(status.attempt, "provider");
  };
  const customerView = async (h: CateringSquareHarness, s: Scene, attemptId: string) => {
    const status = await h.payments.getAttempt({ bookingId: s.bookingId, attemptId, userId: s.customerId });
    assert.ok(status.kind === "ok");
    if (status.kind !== "ok") throw new Error("not ok");
    return serializeCateringPaymentAttempt(status.attempt, "customer");
  };

  test("VIEW: a USD invoice that Square took in EUR is reported in EUR, with nothing credited", async () => {
    await run(async (h) => {
      const s = await scene(h);
      const attempt = await open(h, s);
      h.setClock(new Date("2030-05-02T09:00:00Z"));
      h.fake.payOrder(attempt.squareOrderId!, { id: "EUR_PAY", ...first, total_money: { amount: 40000, currency: "EUR" }, amount_money: { amount: 40000, currency: "EUR" } });
      assert.equal((await h.payments.settleAttempt(attempt.id)).outcome, "reconciliation_required");
      const view = await providerView(h, s, attempt.id);
      assert.equal(view.reconciliationReason, "currency_mismatch");
      assert.equal(view.currency, "USD");
      assert.equal(view.processorAmountCents, 40000);
      assert.equal(view.processorCurrency, "EUR", "the processor amount is never read in the invoice's currency");
      assert.deepEqual(view.processorPayments?.map((payment) => [payment.amountCents, payment.currency]), [[40000, "EUR"]]);
      assert.equal(view.ledgerCredited, undefined, "nothing from this attempt is in the ledger");
      assert.equal(view.processorPayments?.[0].creditedToLedger, undefined);
      assert.equal((await h.ledger(s.bookingId)).length, 0);
      const customer = await customerView(h, s, attempt.id);
      assert.equal(JSON.stringify(customer).includes("EUR_PAY"), false);
      assert.equal(customer.ledgerCredited, undefined);
    });
  });

  test("VIEW: P1 credited, then P2 and P3 discovered: only P1 is ledger-backed (by stored id, not amount); P2 and P3 are additional; the accounting is unchanged", async () => {
    await run(async (h) => {
      const s = await scene(h);
      const attempt = await open(h, s);
      h.setClock(new Date("2030-05-02T09:00:00Z"));
      h.fake.payOrder(attempt.squareOrderId!, { id: "V_P1", ...first });
      assert.equal((await h.payments.settleAttempt(attempt.id)).outcome, "completed");
      const completedView = await providerView(h, s, attempt.id);
      assert.equal(completedView.ledgerCredited, true);
      assert.deepEqual(completedView.processorPayments?.map((payment) => [payment.squarePaymentId, payment.creditedToLedger === true]), [["V_P1", true]]);

      // P2 has EXACTLY P1's amount: amount alone must not make it look credited
      h.fake.payOrder(attempt.squareOrderId!, { id: "V_P2", updated_at: "2030-05-01T11:00:00Z", created_at: "2030-05-01T11:00:00Z" });
      h.fake.payOrder(attempt.squareOrderId!, { id: "V_P3", total_money: { amount: 700, currency: "USD" }, amount_money: { amount: 700, currency: "USD" }, updated_at: "2030-05-01T12:00:00Z", created_at: "2030-05-01T12:00:00Z" });
      assert.equal((await h.payments.settleAttempt(attempt.id)).outcome, "reconciliation_required");
      const ledgerBefore = await h.processorLedger(s.bookingId);
      const view = await providerView(h, s, attempt.id);
      assert.equal(view.state, "reconciliation_required");
      assert.equal(view.ledgerCredited, true, "something WAS credited");
      assert.equal(view.paymentId, ledgerBefore[0].id);
      assert.deepEqual(view.processorPayments?.map((payment) => [payment.squarePaymentId, Number(payment.amountCents), payment.creditedToLedger === true]), [["V_P1", 40000, true], ["V_P2", 40000, false], ["V_P3", 700, false]]);
      assert.equal(view.processorCurrency, "USD");
      // listing view (the billing panel's source) agrees
      const listed = (await h.payments.attemptsForBooking(h.db as never, s.bookingId)).find((row) => row.id === attempt.id)!;
      assert.deepEqual(serializeCateringPaymentAttempt(listed, "provider").processorPayments?.map((payment) => payment.creditedToLedger === true), [true, false, false]);
      // presentation only: one credit, no new ledger row, evidence untouched
      assert.equal(ledgerBefore.length, 1);
      assert.equal(Number(ledgerBefore[0].amount_cents), 40000);
      assert.equal((await h.ledger(s.bookingId)).length, 1);
      assert.equal((await evidenceRows(h, attempt.id)).length, 3);
      // the customer's view is safe and non-enumerating
      const customer = await customerView(h, s, attempt.id);
      const text = JSON.stringify(customer);
      assert.equal(/V_P[123]|creditedToLedger|ledgerCredited|creditedSquarePaymentId/.test(text), false);
      assert.equal(customer.state, "reconciliation_required");
    });
  });

  test("VIEW: a single reconciled payment that was never credited has no ledger-backed row", async () => {
    await run(async (h) => {
      const s = await scene(h);
      const attempt = await open(h, s, 1);
      await h.adjustment(s.bookingId, s.providerId, "credit", 30000);
      h.setClock(new Date("2030-05-02T09:00:00Z"));
      h.fake.payOrder(attempt.squareOrderId!, { id: "NC_P1", ...first, total_money: { amount: 60000, currency: "USD" }, amount_money: { amount: 60000, currency: "USD" } });
      await h.payments.settleAttempt(attempt.id);
      const view = await providerView(h, s, attempt.id);
      assert.equal(view.state, "reconciliation_required");
      assert.equal(view.ledgerCredited, undefined);
      assert.equal(view.processorPayments?.some((payment) => payment.creditedToLedger), false);
      const text = JSON.stringify(view);
      assert.equal(text.includes(s.connection.accessToken), false);
      assert.equal(/idempotency|merchantId|locationId|squareOrderId|squarePaymentLink/i.test(text), false);
    });
  });

  /* ----------------------------------------------------------------------------------------------------------- *
   * Codex repair pass 7: long Square identifiers persist, settle and survive lookups
   * ----------------------------------------------------------------------------------------------------------- */

  for (const length of [128, 129, 192]) {
    test(`LONGID: a ${length}-character Square payment id settles, is credited once, is stored in full on the ledger and evidence, and is shown to the provider`, async () => {
      await run(async (h) => {
        const s = await scene(h);
        const attempt = await open(h, s);
        h.setClock(new Date("2030-05-02T09:00:00Z"));
        const paymentId = `PAY_${"p".repeat(length)}`.slice(0, length);
        assert.equal(paymentId.length, length);
        h.fake.payOrder(attempt.squareOrderId!, { id: paymentId, ...first });
        assert.equal((await h.payments.settleAttempt(attempt.id)).outcome, "completed");
        const ledger = await h.processorLedger(s.bookingId);
        assert.equal(ledger.length, 1, "credited exactly once");
        assert.equal(ledger[0].processor_payment_id, paymentId);
        assert.deepEqual((await evidenceRows(h, attempt.id)).map((row) => row.square_payment_id), [paymentId]);
        const view = await providerView(h, s, attempt.id);
        assert.equal(view.squarePaymentId, paymentId);
        assert.equal(view.processorPayments?.[0].squarePaymentId, paymentId);
        assert.equal(view.processorPayments?.[0].creditedToLedger, true);
        // replays do not credit again
        await h.payments.settleAttempt(attempt.id);
        await hook(h, s, attempt, `evt-long-pay-${length}`, paymentId);
        assert.equal((await h.processorLedger(s.bookingId)).length, 1);
      });
    });
  }

  test("LONGID: a duplicate long payment id on another attempt is still refused by the uniqueness invariant, and never credited twice", async () => {
    await run(async (h) => {
      const s = await scene(h);
      const one = await open(h, s, 0);
      const two = await open(h, s, 1);
      h.setClock(new Date("2030-05-02T09:00:00Z"));
      const paymentId = `PAY_${"d".repeat(188)}`;
      h.fake.payOrder(one.squareOrderId!, { id: paymentId, ...first });
      assert.equal((await h.payments.settleAttempt(one.id)).outcome, "completed");
      h.fake.payOrder(two.squareOrderId!, { id: paymentId, total_money: { amount: 60000, currency: "USD" }, amount_money: { amount: 60000, currency: "USD" } });
      const outcome = await h.payments.settleAttempt(two.id);
      assert.equal(outcome.outcome === "rejected" && outcome.code, "payment_already_consumed");
      assert.equal((await h.processorLedger(s.bookingId)).length, 1);
      assert.equal((await h.attempt(two.id)).state, "pending");
      // and the database itself blocks it
      await assert.rejects(h.pool.query(
        `INSERT INTO catering_booking_payments (booking_id, invoice_id, amount_cents, currency, payment_method, payment_source, status, received_on, processor, processor_payment_id)
         VALUES ($1, $2, 100, 'USD', 'card_online', 'processor', 'recorded', current_date, 'square', $3)`, [s.bookingId, s.invoiceIds[1], paymentId]), /catering_payments_processor_uidx/);
    });
  });

  test("LONGID: 192-character order and payment-link ids from Square are stored, found by webhook, and closed with the link", async () => {
    await run(async (h) => {
      h.fake.state.orderIdLength = 192;
      h.fake.state.linkIdLength = 192;
      const s = await scene(h);
      const attempt = await open(h, s);
      assert.equal(attempt.squareOrderId!.length, 192);
      assert.equal(attempt.squarePaymentLinkId!.length, 192);
      assert.equal((await h.attempt(attempt.id)).square_order_id.length, 192);
      assert.deepEqual(await hook(h, s, attempt, "evt-long-order"), { kind: "processed", outcome: "awaiting" });
      await h.q(`UPDATE catering_booking_payment_attempts SET state = 'cancelled', closed_at = now() WHERE id = $1`, [attempt.id]);
      assert.equal(await h.payments.sweepClosedLinks(s.bookingId, { force: true }), 1);
      assert.equal(h.fake.links.get(attempt.squarePaymentLinkId!)!.deleted, true);
    });
  });

  /* ----------------------------------------------------------------------------------------------------------- *
   * Codex repair pass 8: the aggregate is optional metadata; payments are dated from created_at
   * ----------------------------------------------------------------------------------------------------------- */

  const money = (amount: number, currency = "USD") => ({ total_money: { amount, currency }, amount_money: { amount, currency } });
  const at = (iso: string) => ({ created_at: iso, updated_at: iso });

  test("AGGREGATE: one payment stores its amount; two same-currency payments within the ceiling store the sum, exactly at the ceiling included", async () => {
    await run(async (h) => {
      const s = await scene(h);
      const one = await open(h, s, 0);
      h.setClock(new Date("2030-05-02T09:00:00Z"));
      h.fake.payOrder(one.squareOrderId!, { id: "AG_ONE", ...first });
      await h.payments.settleAttempt(one.id);
      assert.equal(Number((await h.attempt(one.id)).processor_amount_cents), 40000);

      const two = await open(h, s, 1);
      h.fake.payOrder(two.squareOrderId!, { id: "AG_A", ...at("2030-05-01T10:00:00Z"), ...money(5_000_000_000) });
      h.fake.payOrder(two.squareOrderId!, { id: "AG_B", ...at("2030-05-01T11:00:00Z"), ...money(4_999_999_999) });
      assert.equal((await h.payments.settleAttempt(two.id)).outcome, "reconciliation_required");
      const row = await h.attempt(two.id);
      assert.equal(Number(row.processor_amount_cents), 9_999_999_999, "exactly at the ceiling is accepted");
      assert.equal(row.processor_currency, "USD");
      assert.equal((await evidenceRows(h, two.id)).length, 2);
    });
  });

  test("AGGREGATE: two 6,000,000,000-cent payments persist as reconciliation with a NULL aggregate and BOTH evidence rows; replays are idempotent and nothing is credited", async () => {
    await run(async (h) => {
      const s = await scene(h);
      const attempt = await open(h, s);
      h.setClock(new Date("2030-05-02T09:00:00Z"));
      h.fake.payOrder(attempt.squareOrderId!, { id: "OV_A", ...at("2030-05-01T10:00:00Z"), ...money(6_000_000_000) });
      h.fake.payOrder(attempt.squareOrderId!, { id: "OV_B", ...at("2030-05-01T11:00:00Z"), ...money(6_000_000_000) });
      assert.equal((await h.payments.settleAttempt(attempt.id)).outcome, "reconciliation_required", "persists; the summary overflow does not roll the evidence back");
      const row = await h.attempt(attempt.id);
      assert.equal(row.state, "reconciliation_required");
      assert.equal(row.reconciliation_reason, "multiple_payments");
      assert.equal(Number(row.processor_payment_count), 2);
      assert.equal(row.processor_amount_cents, null);
      const evidence = await evidenceRows(h, attempt.id);
      assert.deepEqual(evidence.map((entry) => [entry.square_payment_id, Number(entry.amount_cents), entry.currency, entry.completed_at.toISOString()]), [["OV_A", 6_000_000_000, "USD", "2030-05-01T10:00:00.000Z"], ["OV_B", 6_000_000_000, "USD", "2030-05-01T11:00:00.000Z"]]);
      // the provider sees each payment and no invented total
      const view = await providerView(h, s, attempt.id);
      assert.equal(view.processorAmountCents, undefined);
      assert.equal(view.processorCurrency, undefined);
      assert.deepEqual(view.processorPayments?.map((payment) => [payment.squarePaymentId, payment.amountCents]), [["OV_A", 6_000_000_000], ["OV_B", 6_000_000_000]]);
      // repeated webhook / poll / concurrent: the same rows, still no credit
      for (let i = 0; i < 2; i += 1) await hook(h, s, attempt, `evt-ov-${i}`);
      await Promise.all([h.payments.settleAttempt(attempt.id), h.payments.settleAttempt(attempt.id)]);
      assert.deepEqual((await evidenceRows(h, attempt.id)).map((entry) => entry.id), evidence.map((entry) => entry.id));
      assert.equal((await h.ledger(s.bookingId)).length, 0);
    });
  });

  test("AGGREGATE: one cent over the ceiling, and mixed currencies, store no aggregate and keep every evidence row; a later payment pushing a stored total over the ceiling nulls it without losing anything", async () => {
    await run(async (h) => {
      const s = await scene(h);
      const over = await open(h, s, 0);
      h.setClock(new Date("2030-05-02T09:00:00Z"));
      h.fake.payOrder(over.squareOrderId!, { id: "OC_A", ...at("2030-05-01T10:00:00Z"), ...money(5_000_000_000) });
      h.fake.payOrder(over.squareOrderId!, { id: "OC_B", ...at("2030-05-01T11:00:00Z"), ...money(5_000_000_000) });
      await h.payments.settleAttempt(over.id);
      assert.equal((await h.attempt(over.id)).processor_amount_cents, null);
      assert.equal((await evidenceRows(h, over.id)).length, 2);

      const mixed = await open(h, s, 1);
      h.fake.payOrder(mixed.squareOrderId!, { id: "MX_A", ...at("2030-05-01T10:00:00Z"), ...money(10000, "EUR") });
      h.fake.payOrder(mixed.squareOrderId!, { id: "MX_B", ...at("2030-05-01T11:00:00Z"), ...money(5000, "USD") });
      await h.payments.settleAttempt(mixed.id);
      const mixedRow = await h.attempt(mixed.id);
      assert.equal(mixedRow.processor_amount_cents, null);
      assert.equal(mixedRow.processor_currency, null);
      assert.deepEqual((await evidenceRows(h, mixed.id)).map((entry) => [entry.square_payment_id, entry.currency]), [["MX_A", "EUR"], ["MX_B", "USD"]]);
    });
    await run(async (h) => {
      // audit path: a single mismatched payment is already reconciled with its amount; a second one takes the total past the ceiling
      const s = await scene(h);
      const attempt = await open(h, s);
      h.setClock(new Date("2030-05-02T09:00:00Z"));
      h.fake.payOrder(attempt.squareOrderId!, { id: "AU_A", ...at("2030-05-01T10:00:00Z"), ...money(6_000_000_000) });
      await h.payments.settleAttempt(attempt.id);
      assert.equal(Number((await h.attempt(attempt.id)).processor_amount_cents), 6_000_000_000);
      h.fake.payOrder(attempt.squareOrderId!, { id: "AU_B", ...at("2030-05-01T11:00:00Z"), ...money(6_000_000_000) });
      assert.deepEqual(await hook(h, s, attempt, "evt-au"), { kind: "processed", outcome: "reconciliation_required" });
      const row = await h.attempt(attempt.id);
      assert.equal(row.processor_amount_cents, null);
      assert.equal(Number(row.processor_payment_count), 2);
      assert.equal((await evidenceRows(h, attempt.id)).length, 2);
      assert.equal((await h.ledger(s.bookingId)).length, 0);
    });
  });

  test("DATE: updated_at never dates a payment: created Monday, later updated Tuesday (customer association, metadata, refund bookkeeping) is still Monday, even verified a day later", async () => {
    await run(async (h) => {
      const s = await scene(h);
      const attempt = await open(h, s);
      h.fake.payOrder(attempt.squareOrderId!, { id: "D_1", created_at: "2030-06-03T23:55:00Z", updated_at: "2030-06-04T09:00:00Z" });
      h.setClock(new Date("2030-06-04T15:00:00Z"));
      assert.equal((await h.payments.settleAttempt(attempt.id)).outcome, "completed");
      assert.equal(await receivedOn(h, s.bookingId), "2030-06-03", "Monday, not Tuesday");
      const [evidence] = await evidenceRows(h, attempt.id);
      assert.equal(evidence.completed_at.toISOString(), "2030-06-03T23:55:00.000Z");
      assert.equal(evidence.square_updated_at.toISOString(), "2030-06-04T09:00:00.000Z", "updated_at is kept as evidence only");
    });
  });

  test("DATE: created and updated on the same day agree; a later unrelated update does not move the original date; a Los Angeles caterer's midnight is honoured", async () => {
    await run(async (h) => {
      const s = await scene(h);
      const attempt = await open(h, s, 0);
      h.fake.payOrder(attempt.squareOrderId!, { id: "D_SAME", ...at("2030-06-03T12:00:00Z") });
      h.setClock(new Date("2030-06-03T13:00:00Z"));
      await h.payments.settleAttempt(attempt.id);
      assert.equal(await receivedOn(h, s.bookingId), "2030-06-03");
    });
    await run(async (h) => {
      const s = await scene(h);
      await h.q(`INSERT INTO catering_availability_settings (provider_id, timezone) VALUES ($1, 'America/Los_Angeles')`, [s.providerId]);
      const attempt = await open(h, s);
      // 06:30Z on the 4th is 23:30 on the 3rd in Los Angeles; the later refund-related update (the 9th) must not matter
      h.fake.payOrder(attempt.squareOrderId!, { id: "D_LA", created_at: "2030-06-04T06:30:00Z", updated_at: "2030-06-09T12:00:00Z" });
      h.setClock(new Date("2030-06-10T12:00:00Z"));
      await h.payments.settleAttempt(attempt.id);
      assert.equal(await receivedOn(h, s.bookingId), "2030-06-03");
    });
  });

  test("DATE: a missing or malformed created_at is never replaced by updated_at or ChefSire's clock: payment_timestamp_invalid reconciliation, nothing credited", async () => {
    await run(async (h) => {
      const s = await scene(h);
      const attempt = await open(h, s);
      h.setClock(new Date("2030-06-02T00:40:00Z"));
      h.fake.payOrder(attempt.squareOrderId!, { id: "D_BAD", created_at: "garbage", updated_at: "2030-06-01T12:00:00Z" });
      assert.equal((await h.payments.settleAttempt(attempt.id)).outcome, "reconciliation_required");
      const row = await h.attempt(attempt.id);
      assert.equal(row.reconciliation_reason, "payment_timestamp_invalid");
      assert.equal((await evidenceRows(h, attempt.id)).length, 1, "the money is kept");
      assert.equal((await h.ledger(s.bookingId)).length, 0);
    });
  });

  /* ----------------------------------------------------------------------------------------------------------- *
   * Codex repair pass 9: one external create per attempt; no late link is ever left unrecorded
   * ----------------------------------------------------------------------------------------------------------- */

  const createRequests = (h: CateringSquareHarness) => h.fake.requests.filter((request) => request.method === "POST" && request.path === "/v2/online-checkout/payment-links");

  test("CREATE-RACE A: while one create call is in flight a retry issues NO second Square create; when it succeeds the link is recorded and the attempt is pending; no orphan", async () => {
    await holdRun(async (h, ctl) => {
      const s = await scene(h);
      hold(ctl);
      const first = pay(h, s);
      await withTimeout(ctl.entered, "create in flight");
      const attempt = await creatingRow(h, s.bookingId);
      for (let i = 0; i < 3; i += 1) {
        const retry = await pay(h, s);                     // the customer presses Pay again
        assert.ok(retry.kind === "ok" && retry.reused && retry.attempt.id === attempt.id && retry.attempt.state === "creating");
      }
      assert.equal(createRequests(h).length, 0, "no second external create while the first is unresolved");
      ctl.release();
      const done = await withTimeout(first, "first create completes");
      assert.ok(done.kind === "ok" && done.attempt.state === "pending");
      const row = await h.attempt(attempt.id);
      assert.ok(row.square_payment_link_id && row.square_order_id && row.checkout_url, "link and order identifiers persisted");
      assert.ok(row.square_create_resolved_at);
      assert.equal(h.fake.links.size, 1, "one checkout");
      assert.equal(createRequests(h).length, 1);
      const again = await pay(h, s);
      assert.ok(again.kind === "ok" && again.attempt.id === attempt.id && again.attempt.state === "pending");
      assert.equal(createRequests(h).length, 1, "a pending attempt is never re-created");
      assert.equal((await h.ledger(s.bookingId)).length, 0);
    });
  });

  for (const terminal of ["failed", "cancelled", "superseded", "expired"] as const) {
    test(`CREATE-RACE: a LATE Square success after the attempt became ${terminal} is persisted and its link is cleaned up with the old credential; the checkout is never offered`, async () => {
      await holdRun(async (h, ctl) => {
        const s = await scene(h);
        hold(ctl);
        const paying = pay(h, s);
        await withTimeout(ctl.entered, "create in flight");
        const attempt = await creatingRow(h, s.bookingId);
        await h.q(`UPDATE catering_booking_payment_attempts SET state = $2, closed_at = now() WHERE id = $1`, [attempt.id, terminal]);
        ctl.release();
        await withTimeout(paying, "create completes");
        const row = await h.attempt(attempt.id);
        assert.equal(row.state, terminal, "not reactivated");
        assert.ok(row.square_payment_link_id && row.square_order_id, "the late link is recorded, so a charge on it can be matched");
        assert.ok(row.square_create_resolved_at);
        assert.equal(row.checkout_url, null, "never offered to the customer");
        assert.equal(h.fake.links.get(row.square_payment_link_id)!.deleted, true, "cleaned up");
        assert.ok(row.square_link_closed_at);
        // a charge that still lands on it is routed into authoritative settlement, never lost
        const settled = await h.payments.settleAttempt(attempt.id);
        assert.equal(settled.outcome, "awaiting");
        assert.equal((await h.connections.disconnect(s.providerId)).changed, true, "once resolved and cleaned up, disposal proceeds");
        assert.equal(JSON.stringify({ logs: h.logs, row }).includes(s.connection.accessToken), false);
      });
    });
  }

  test("CREATE-RACE B: a second call (lease long over) that Square REFUSES does not lose a late success from the first: the link is still recorded and removed", async () => {
    await holdRun(async (h, ctl) => {
      const s = await scene(h);
      hold(ctl);
      const first = pay(h, s);
      await withTimeout(ctl.entered, "A in flight");
      const attempt = await creatingRow(h, s.bookingId);
      await h.q(`UPDATE catering_booking_payment_attempts SET square_create_started_at = now() - interval '10 minutes' WHERE id = $1`, [attempt.id]);
      h.fake.state.checkoutCreateFailure = 422;            // call B starts (the lease has passed) and is definitively refused
      const second = await pay(h, s);
      assert.ok(second.kind === "ok" && second.attempt.state === "failed");
      h.fake.state.checkoutCreateFailure = undefined;
      ctl.release();                                       // call A, still outstanding, now succeeds at Square
      await withTimeout(first, "A completes");
      const row = await h.attempt(attempt.id);
      assert.equal(row.state, "failed");
      assert.ok(row.square_payment_link_id && row.square_order_id, "A's late link was NOT dropped because B failed the attempt");
      assert.equal(h.fake.links.get(row.square_payment_link_id)!.deleted, true);
      assert.ok(row.square_link_closed_at);
      assert.equal(h.fake.links.size, 1);
    });
  });

  test("CREATE-RACE: a lone definitive refusal fails the attempt and resolves creation; a refusal after an earlier UNCERTAIN call (a refusal about the request) accounts for it and resolves too", async () => {
    await run(async (h) => {
      const s = await scene(h);
      h.fake.state.checkoutCreateFailure = 422;
      const refused = await pay(h, s, 0);
      assert.ok(refused.kind === "ok" && refused.attempt.state === "failed");
      const lone = await h.attempt(refused.attempt.id);
      assert.ok(lone.square_create_resolved_at);
      assert.equal(lone.square_create_uncertain_at, null);
      assert.equal(h.fake.links.size, 0);
      assert.equal((await h.connections.disconnect(s.providerId)).changed, true);
    });
    await run(async (h) => {
      const s = await scene(h);
      h.fake.state.checkoutCreateFailure = 503;
      const uncertain = await pay(h, s, 0);
      assert.ok(uncertain.kind === "ok" && uncertain.attempt.state === "creating");
      const before = await h.attempt(uncertain.attempt.id);
      assert.ok(before.square_create_uncertain_at && before.square_create_resolved_at === null);
      h.fake.state.checkoutCreateFailure = 422;
      const refused = await pay(h, s, 0);
      assert.ok(refused.kind === "ok" && refused.attempt.id === before.id && refused.attempt.state === "failed");
      const row = await h.attempt(before.id);
      assert.ok(row.square_create_resolved_at, "all possible calls are accounted for");
      assert.equal((await h.connections.disconnect(s.providerId)).changed, true, "and disposal is no longer blocked");
    });
  });

  test("CREATE-RACE: a CREDENTIAL refusal after an earlier uncertain call is inconclusive: the attempt is not failed and creation stays unresolved", async () => {
    await run(async (h) => {
      const s = await scene(h);
      h.fake.state.checkoutCreateLosesResponse = true;
      const uncertain = await pay(h, s, 0);
      assert.ok(uncertain.kind === "ok" && uncertain.attempt.state === "creating");
      assert.equal(h.fake.links.size, 1, "Square DID create a link ChefSire has not recorded");
      h.fake.state.checkoutCreateLosesResponse = false;
      h.fake.state.checkoutCreateFailure = 401;
      await pay(h, s, 0);
      const row = await h.attempt(uncertain.attempt.id);
      assert.equal(row.state, "creating", "not failed: that would orphan the link");
      assert.equal(row.square_create_resolved_at, null);
      assert.ok(row.square_create_uncertain_at);
    });
  });

  test("CREATE-RACE: repeated retries after an uncertain call recover the SAME link under the SAME idempotency key; never a duplicate checkout or ledger credit", async () => {
    await run(async (h) => {
      const s = await scene(h);
      h.fake.state.checkoutCreateLosesResponse = true;
      const uncertain = await pay(h, s, 0);
      assert.ok(uncertain.kind === "ok");
      h.fake.state.checkoutCreateLosesResponse = false;
      for (let i = 0; i < 3; i += 1) {
        const retry = await pay(h, s, 0);
        assert.ok(retry.kind === "ok" && retry.attempt.id === uncertain.attempt.id && retry.attempt.state === "pending");
      }
      assert.equal(h.fake.links.size, 1);
      const keys = new Set(createRequests(h).map((request) => (JSON.parse(request.body) as { idempotency_key: string }).idempotency_key));
      assert.deepEqual([...keys], [`chefsire-cat-${uncertain.attempt.id}`], "one durable identity for every call");
      assert.equal(createRequests(h).length, 2, "the lost one and ONE recovery");
      assert.equal((await h.attempts(s.bookingId)).length, 1);
      assert.equal((await h.ledger(s.bookingId)).length, 0);
      const row = await h.attempt(uncertain.attempt.id);
      assert.equal(h.fake.links.get(row.square_payment_link_id)!.order_id, row.square_order_id, "order and link recorded for webhook matching");
    });
  });

  /* ----------------------------------------------------------------------------------------------------------- *
   * Codex repair pass 11: refunded Square payments never auto-credit
   * ----------------------------------------------------------------------------------------------------------- */

  const refundShapes: { name: string; overrides: Record<string, unknown> }[] = [
    { name: "partial refund (refund id and refunded money)", overrides: { refund_ids: ["R_PART"], refunded_money: { amount: 20000, currency: "USD" } } },
    { name: "full refund (refund id and refunded money)", overrides: { refund_ids: ["R_FULL"], refunded_money: { amount: 40000, currency: "USD" } } },
    { name: "refund id only", overrides: { refund_ids: ["R_ID"] } },
    { name: "refunded money only", overrides: { refunded_money: { amount: 100, currency: "USD" } } },
  ];

  for (const shape of refundShapes) {
    test(`REFUND: a COMPLETED payment with a ${shape.name} is NOT auto-credited: payment_refunded reconciliation, evidence kept, no ledger row, no pay-again advice`, async () => {
      await run(async (h) => {
        const s = await scene(h);
        const attempt = await open(h, s);
        h.setClock(new Date("2030-05-02T09:00:00Z"));
        h.fake.payOrder(attempt.squareOrderId!, { id: "RF_P1", ...first, ...shape.overrides });
        assert.equal((await h.payments.settleAttempt(attempt.id)).outcome, "reconciliation_required");
        const row = await h.attempt(attempt.id);
        assert.equal(row.state, "reconciliation_required");
        assert.equal(row.reconciliation_reason, "payment_refunded");
        assert.equal(row.payment_id, null);
        assert.equal(Number(row.processor_amount_cents), 40000, "the original amount is evidence, not a net figure");
        assert.equal((await h.ledger(s.bookingId)).length, 0, "no normal ledger payment");
        const [evidence] = await evidenceRows(h, attempt.id);
        assert.equal(evidence.has_refunds, true);
        assert.equal(Number(evidence.amount_cents), 40000);
        const view = await providerView(h, s, attempt.id);
        assert.equal(view.reconciliationReason, "payment_refunded");
        assert.equal(view.processorPayments?.[0].refunded, true);
        assert.equal(view.ledgerCredited, undefined);
        const customer = await customerView(h, s, attempt.id);
        const text = JSON.stringify(customer);
        assert.equal(/RF_P1|R_PART|R_FULL|R_ID|\"refunded\"|creditedToLedger/.test(text), false, "no Square internals reach the customer");
        assert.equal(/pay again|try again/i.test(JSON.stringify(CATERING_SQUARE_RECONCILIATION_COPY.payment_refunded)), false);
        assert.equal(JSON.stringify({ view, logs: h.logs }).includes(s.connection.accessToken), false);
      });
    });
  }

  test("REFUND: the webhook path and the browser-poll path both see the refund and neither credits; replays are idempotent", async () => {
    await run(async (h) => {
      const s = await scene(h);
      const viaWebhook = await open(h, s, 0);
      h.setClock(new Date("2030-05-02T09:00:00Z"));
      h.fake.payOrder(viaWebhook.squareOrderId!, { id: "RF_W", ...first, refund_ids: ["R1"], refunded_money: { amount: 40000, currency: "USD" } });
      assert.deepEqual(await hook(h, s, viaWebhook, "evt-refund-w", "RF_W"), { kind: "processed", outcome: "reconciliation_required" });
      for (let i = 0; i < 2; i += 1) await hook(h, s, viaWebhook, `evt-refund-w-${i}`);
      await Promise.all([h.payments.settleAttempt(viaWebhook.id), h.payments.settleAttempt(viaWebhook.id)]);

      const viaPoll = await open(h, s, 1);
      h.fake.payOrder(viaPoll.squareOrderId!, { id: "RF_P", ...first, ...money(60000), refund_ids: ["R2"], refunded_money: { amount: 20000, currency: "USD" } });
      await h.q(`UPDATE catering_booking_payment_attempts SET last_checked_at = NULL WHERE id = $1`, [viaPoll.id]);
      const polled = await h.payments.getAttempt({ bookingId: s.bookingId, attemptId: viaPoll.id, userId: s.customerId });
      assert.ok(polled.kind === "ok" && polled.attempt.state === "reconciliation_required" && polled.attempt.reconciliationReason === "payment_refunded");

      assert.equal((await h.ledger(s.bookingId)).length, 0, "neither path credited");
      assert.equal((await evidenceRows(h, viaWebhook.id)).length, 1, "replays add nothing");
      assert.equal((await evidenceRows(h, viaPoll.id)).length, 1);
    });
  });

  test("REFUND: a clean payment already credited stays credited exactly once; a later refunded additional payment is kept as evidence only; a later refund of the credited payment is flagged, never reversed", async () => {
    await run(async (h) => {
      const s = await scene(h);
      const attempt = await open(h, s);
      h.setClock(new Date("2030-05-02T09:00:00Z"));
      h.fake.payOrder(attempt.squareOrderId!, { id: "CR_P1", ...first });
      assert.equal((await h.payments.settleAttempt(attempt.id)).outcome, "completed");
      const ledgerBefore = await h.processorLedger(s.bookingId);
      assert.equal(ledgerBefore.length, 1);

      h.fake.payOrder(attempt.squareOrderId!, { id: "CR_P2", ...at("2030-05-01T11:00:00Z"), refund_ids: ["R3"], refunded_money: { amount: 40000, currency: "USD" } });
      assert.equal((await h.payments.settleAttempt(attempt.id)).outcome, "reconciliation_required");
      // P1 is refunded afterwards in Square
      h.fake.payments.set("CR_P1", { ...h.fake.payments.get("CR_P1")!, refund_ids: ["R4"], refunded_money: { amount: 40000, currency: "USD" } } as never);
      await h.payments.settleAttempt(attempt.id);

      assert.deepEqual(await h.processorLedger(s.bookingId), ledgerBefore, "the original ledger row is untouched and not duplicated");
      const rows = await evidenceRows(h, attempt.id);
      assert.deepEqual(rows.map((row) => [row.square_payment_id, row.has_refunds]), [["CR_P1", true], ["CR_P2", true]]);
      const view = await providerView(h, s, attempt.id);
      assert.equal(view.ledgerCredited, true);
      assert.deepEqual(view.processorPayments?.map((payment) => [payment.squarePaymentId, payment.creditedToLedger === true, payment.refunded === true]), [["CR_P1", true, true], ["CR_P2", false, true]]);
      // replays do not move anything
      for (let i = 0; i < 2; i += 1) await h.payments.settleAttempt(attempt.id);
      assert.equal((await h.processorLedger(s.bookingId)).length, 1);
      assert.equal((await evidenceRows(h, attempt.id)).length, 2);
    });
  });

  test("REFUND: processor payment uniqueness still holds for a refunded payment seen on a second attempt", async () => {
    await run(async (h) => {
      const s = await scene(h);
      const one = await open(h, s, 0);
      const two = await open(h, s, 1);
      h.setClock(new Date("2030-05-02T09:00:00Z"));
      h.fake.payOrder(one.squareOrderId!, { id: "UQ_P", ...first, refund_ids: ["R5"] });
      await h.payments.settleAttempt(one.id);
      h.fake.payOrder(two.squareOrderId!, { id: "UQ_P", ...first, ...money(60000), refund_ids: ["R5"] });
      const outcome = await h.payments.settleAttempt(two.id);
      assert.equal(outcome.outcome === "rejected" && outcome.code, "payment_already_consumed");
      await assert.rejects(h.q(`INSERT INTO catering_attempt_square_payments (attempt_id, square_payment_id, amount_cents, currency) VALUES ($1, 'UQ_P', 100, 'USD')`, [two.id]), /catering_attempt_square_payments_payment_uidx/);
    });
  });

  /* ----------------------------------------------------------------------------------------------------------- *
   * Post-merge hotfix 1: payments are verified BEFORE a credential is discarded
   * ----------------------------------------------------------------------------------------------------------- */

  const evidenceCount = async (h: CateringSquareHarness, s: Scene) => Number((await h.q(`SELECT count(*)::int AS n FROM catering_attempt_square_payments e JOIN catering_booking_payment_attempts a ON a.id = e.attempt_id WHERE a.booking_id = $1`, [s.bookingId]))[0].n);

  test("HOTFIX disconnect: a payment COMPLETED in Square but not yet heard of (webhook delayed) is recorded before the credential is discarded; deleting the link is not what settles it", async () => {
    await run(async (h) => {
      const s = await scene(h);
      const attempt = await open(h, s);
      h.setClock(new Date("2030-05-02T09:00:00Z"));
      h.fake.payOrder(attempt.squareOrderId!, { id: "HF_P1", ...first });
      assert.equal((await h.attempt(attempt.id)).state, "pending", "ChefSire has not heard of it");
      const result = await h.connections.disconnect(s.providerId);
      assert.equal(result.changed, true);
      assert.equal((await h.attempt(attempt.id)).state, "completed", "settled from fresh evidence, not cancelled");
      assert.equal((await h.processorLedger(s.bookingId)).length, 1, "credited exactly once");
      assert.equal(await evidenceCount(h, s), 1, "no lost evidence");
      assert.equal((await h.row(s.providerId)).account_status, "disconnected");
      assert.equal((await h.connections.disconnect(s.providerId)).changed, false, "repeat is idempotent");
      assert.equal((await h.processorLedger(s.bookingId)).length, 1);
      assert.equal(JSON.stringify({ logs: h.logs, notifications: h.notifications }).includes(s.connection.accessToken), false);
    });
  });

  test("HOTFIX merchant replacement: a payment completed before the replacement is recorded first, and the new merchant is never used to judge the old order", async () => {
    await run(async (h) => {
      const s = await scene(h);
      const attempt = await open(h, s);
      h.setClock(new Date("2030-05-02T09:00:00Z"));
      h.fake.payOrder(attempt.squareOrderId!, { id: "HF_M1", ...first });
      assert.deepEqual(await h.connections.guardCredentialReplacement(s.providerId, "MERCHANT_NEW"), { allowed: true });
      assert.equal((await h.attempt(attempt.id)).state, "completed");
      assert.equal((await h.processorLedger(s.bookingId)).length, 1);
      await h.connectProvider(s.providerId, "MERCHANT_NEW", { access: "access-new", refresh: "refresh-new" });
      assert.equal((await h.processorLedger(s.bookingId)).length, 1);
      assert.equal((await h.row(s.providerId)).provider_id, "MERCHANT_NEW");
    });
  });

  test("HOTFIX disconnect: Square unavailable while verifying FAILS CLOSED, keeps the credential, loses nothing, and the retry records the payment", async () => {
    await run(async (h) => {
      const s = await scene(h);
      const attempt = await open(h, s);
      h.setClock(new Date("2030-05-02T09:00:00Z"));
      h.fake.payOrder(attempt.squareOrderId!, { id: "HF_U1", ...first });
      h.fake.state.evidenceFailure = 503;
      await assert.rejects(h.connections.disconnect(s.providerId), SquareCredentialDiscardBlockedError);
      await assert.rejects(h.connections.disconnect(s.providerId), SquareCredentialDiscardBlockedError, "repeating stays refused");
      const row = await h.row(s.providerId);
      assert.equal(row.account_status, "active");
      assert.ok(row.encrypted_access_token && row.encrypted_refresh_token, "credential kept");
      assert.equal((await h.processorLedger(s.bookingId)).length, 0);
      h.fake.state.evidenceFailure = undefined;
      assert.equal((await h.connections.disconnect(s.providerId)).changed, true);
      assert.equal((await h.processorLedger(s.bookingId)).length, 1, "the payment was not lost");
      assert.equal(await evidenceCount(h, s), 1);
    });
  });

  test("HOTFIX disconnect: a pending checkout with NO payment disconnects normally, with its link deleted; a payment still PROCESSING refuses", async () => {
    await run(async (h) => {
      const s = await scene(h);
      const attempt = await open(h, s);
      assert.equal((await h.connections.disconnect(s.providerId)).changed, true);
      const row = await h.attempt(attempt.id);
      assert.equal(row.state, "cancelled");
      assert.equal(h.fake.links.get(row.square_payment_link_id)!.deleted, true);
      assert.equal((await h.ledger(s.bookingId)).length, 0);
    });
    await run(async (h) => {
      const s = await scene(h);
      const attempt = await open(h, s);
      h.fake.payOrder(attempt.squareOrderId!, { id: "HF_PROC", status: "APPROVED", orderState: "OPEN" });
      await assert.rejects(h.connections.disconnect(s.providerId), SquareCredentialDiscardBlockedError, "money may still be moving");
      assert.equal((await h.row(s.providerId)).account_status, "active");
    });
  });

  test("HOTFIX disconnect: a payment that completes while the disconnect is running (after the first read, before the link is deleted) is still recorded by the read after the deletion", async () => {
    let beforeDelete: (() => void) | null = null;
    await withCateringSquareHarness(URL_ENV!, {
      wrapCheckout: (api) => ({ ...api, deletePaymentLink: async (token, id) => { if (beforeDelete) { const fire = beforeDelete; beforeDelete = null; fire(); } return api.deletePaymentLink(token, id); } }),
    }, async (h) => {
      const s = await scene(h);
      const attempt = await open(h, s);
      h.setClock(new Date("2030-05-02T09:00:00Z"));
      beforeDelete = () => { h.fake.payOrder(attempt.squareOrderId!, { id: "HF_RACE", ...first }); };
      assert.equal((await h.connections.disconnect(s.providerId)).changed, true);
      const row = await h.attempt(attempt.id);
      assert.equal(h.fake.links.get(row.square_payment_link_id)!.deleted, true, "the link was deleted successfully");
      assert.equal((await h.processorLedger(s.bookingId)).length, 1, "and the payment that landed first was still found and credited");
      assert.ok(row.payment_id);
      assert.equal(await evidenceCount(h, s), 1);
    });
  });

  test("HOTFIX disconnect: a credential that needs refreshing is refreshed and used to verify; a failing refresh refuses and keeps the credential", async () => {
    await run(async (h) => {
      const s = await scene(h);
      const attempt = await open(h, s);
      h.setClock(new Date("2030-05-02T09:00:00Z"));
      h.fake.payOrder(attempt.squareOrderId!, { id: "HF_REF", ...first });
      await h.q(`UPDATE payment_methods SET token_expires_at = now() + interval '1 hour' WHERE user_id = $1`, [s.providerId]);
      h.fake.state.failures.token = 503;
      await assert.rejects(h.connections.disconnect(s.providerId), SquareCredentialDiscardBlockedError);
      assert.equal((await h.row(s.providerId)).account_status, "active");
      h.fake.state.failures.token = undefined;
      assert.equal((await h.connections.disconnect(s.providerId)).changed, true);
      assert.equal((await h.processorLedger(s.bookingId)).length, 1);
    });
  });

  test("HOTFIX disconnect: concurrent disconnects and webhooks over one paid-but-unrecorded order credit it exactly once and lose nothing", async () => {
    await run(async (h) => {
      const s = await scene(h);
      const attempt = await open(h, s);
      h.setClock(new Date("2030-05-02T09:00:00Z"));
      h.fake.payOrder(attempt.squareOrderId!, { id: "HF_CONC", ...first });
      const results = await Promise.allSettled([
        h.connections.disconnect(s.providerId), h.connections.disconnect(s.providerId),
        hook(h, s, attempt, "evt-hf-1"), hook(h, s, attempt, "evt-hf-2"), h.payments.settleAttempt(attempt.id),
      ]);
      for (const result of results) assert.ok(result.status === "fulfilled" || result.reason instanceof SquareCredentialDiscardBlockedError, String((result as { reason?: unknown }).reason));
      assert.equal((await h.processorLedger(s.bookingId)).length, 1);
      assert.equal(await evidenceCount(h, s), 1);
      assert.equal((await h.attempt(attempt.id)).state, "completed");
    });
  });

  /* ----------------------------------------------------------------------------------------------------------- *
   * Post-merge hotfix 2: refund activity found AFTER a payment was credited
   * ----------------------------------------------------------------------------------------------------------- */

  const refundNotifications = (h: CateringSquareHarness) => h.notifications.filter((n) => n.type === "catering_booking_square_payment_refund_review");
  const refundFor = (id: string, cents: number) => ({ refund_ids: [`R_${id}`], refunded_money: { amount: cents, currency: "USD" } });
  const refundExisting = (h: CateringSquareHarness, id: string, cents: number) => h.fake.payments.set(id, { ...h.fake.payments.get(id)!, ...refundFor(id, cents) } as never);

  for (const [name, cents] of [["partial", 15000], ["full", 40000]] as const) {
    test(`HOTFIX refund: a ${name} refund AFTER the payment was credited marks the attempt for review, notifies the provider once, and leaves state, ledger and evidence untouched`, async () => {
      await run(async (h) => {
        const s = await scene(h);
        const attempt = await open(h, s);
        h.setClock(new Date("2030-05-02T09:00:00Z"));
        h.fake.payOrder(attempt.squareOrderId!, { id: "RV_P1", ...first });
        assert.equal((await h.payments.settleAttempt(attempt.id)).outcome, "completed");
        const ledgerBefore = await h.processorLedger(s.bookingId);
        assert.equal((await h.attempt(attempt.id)).refund_review_at, null);
        assert.equal(refundNotifications(h).length, 0);

        refundExisting(h, "RV_P1", cents);
        assert.deepEqual(await hook(h, s, attempt, "evt-rv-1", "RV_P1"), { kind: "processed", outcome: "refund_review_required" });
        const row = await h.attempt(attempt.id);
        assert.equal(row.state, "completed", "no invalid state transition");
        assert.ok(row.refund_review_at, "durable review mark");
        assert.deepEqual(await h.processorLedger(s.bookingId), ledgerBefore, "the ledger payment is not duplicated, changed or deleted");
        const [evidence] = await evidenceRows(h, attempt.id);
        assert.equal(evidence.has_refunds, true);
        assert.equal(Number(evidence.amount_cents), 40000, "historical evidence kept");
        assert.equal(refundNotifications(h).length, 1);
        assert.equal(refundNotifications(h)[0].userId, s.providerId);

        await hook(h, s, attempt, "evt-rv-1", "RV_P1");
        await Promise.all([hook(h, s, attempt, "evt-rv-2"), h.payments.settleAttempt(attempt.id), h.payments.settleAttempt(attempt.id)]);
        assert.equal(refundNotifications(h).length, 1, "exactly one notification");
        assert.equal((await h.processorLedger(s.bookingId)).length, 1);
        assert.equal((await h.attempt(attempt.id)).refund_review_at.getTime(), row.refund_review_at.getTime(), "the mark is set once");
      });
    });
  }

  test("HOTFIX refund: both actors see an unresolved discrepancy; the customer's 'paid' wording is qualified; nothing leaks", async () => {
    await run(async (h) => {
      const s = await scene(h);
      const attempt = await open(h, s);
      h.setClock(new Date("2030-05-02T09:00:00Z"));
      h.fake.payOrder(attempt.squareOrderId!, { id: "VW_P1", ...first });
      await h.payments.settleAttempt(attempt.id);
      const clean = await customerView(h, s, attempt.id);
      assert.equal(clean.refundReview, undefined);
      assert.equal(cateringSquareDisplay(clean, "customer").label, CATERING_SQUARE_COPY.completed);

      refundExisting(h, "VW_P1", 40000);
      await h.payments.settleAttempt(attempt.id);
      const asCustomer = await customerView(h, s, attempt.id);
      const asProvider = await providerView(h, s, attempt.id);
      assert.equal(asCustomer.refundReview, true);
      assert.equal(asProvider.refundReview, true);
      assert.equal(asCustomer.state, "completed");
      assert.equal(cateringSquareDisplay(asCustomer, "customer").label, CATERING_SQUARE_COPY.completedRefundReviewCustomer);
      assert.equal(cateringSquareDisplay(asProvider, "provider").label, CATERING_SQUARE_COPY.completedRefundReviewProvider);
      assert.equal(asProvider.processorPayments?.[0].refunded, true);
      assert.equal(asProvider.processorPayments?.[0].creditedToLedger, true);
      assert.equal(/VW_P1|R_VW_P1|"refunded"|creditedToLedger|ledgerCredited/.test(JSON.stringify(asCustomer)), false, "no Square ids or provider-only flags reach the customer");
      assert.equal(JSON.stringify({ asProvider, logs: h.logs }).includes(s.connection.accessToken), false);
      const listed = (await h.payments.attemptsForBooking(h.db as never, s.bookingId)).filter(cateringAttemptNeedsReturnReview);
      assert.deepEqual(listed.map((row) => row.id), [attempt.id]);
      assert.ok((await h.attempt(attempt.id)).refund_review_at, "persisted");
    });
  });

  test("HOTFIX refund: a credited payment refunded later and an additional refunded payment coexist: one credit, both flagged, one reconciliation", async () => {
    await run(async (h) => {
      const s = await scene(h);
      const attempt = await open(h, s);
      h.setClock(new Date("2030-05-02T09:00:00Z"));
      h.fake.payOrder(attempt.squareOrderId!, { id: "CO_P1", ...first });
      await h.payments.settleAttempt(attempt.id);
      h.fake.payOrder(attempt.squareOrderId!, { id: "CO_P2", ...at("2030-05-01T11:00:00Z"), ...money(5000), ...refundFor("CO_P2", 5000) });
      refundExisting(h, "CO_P1", 10000);
      assert.equal((await h.payments.settleAttempt(attempt.id)).outcome, "reconciliation_required");
      const row = await h.attempt(attempt.id);
      assert.equal(row.state, "reconciliation_required");
      assert.ok(row.refund_review_at);
      assert.deepEqual((await evidenceRows(h, attempt.id)).map((entry) => [entry.square_payment_id, entry.has_refunds]), [["CO_P1", true], ["CO_P2", true]]);
      assert.equal((await h.processorLedger(s.bookingId)).length, 1, "the original credit stands, once");
      assert.equal(h.notifications.filter((n) => n.type === "catering_booking_square_payment_reconciliation_required").length, 1);
      assert.equal(refundNotifications(h).length, 0, "the reconciliation notification already covers it");
      const view = await providerView(h, s, attempt.id);
      assert.equal(view.refundReview, true);
      assert.equal(view.ledgerCredited, true);
    });
  });

  test("HOTFIX refund: a refund seen BEFORE the first credit is still a payment_refunded reconciliation and never credits; a clean payment credits normally", async () => {
    await run(async (h) => {
      const s = await scene(h);
      const clean = await open(h, s, 0);
      const refunded = await open(h, s, 1);
      h.setClock(new Date("2030-05-02T09:00:00Z"));
      h.fake.payOrder(clean.squareOrderId!, { id: "BF_CLEAN", ...first });
      h.fake.payOrder(refunded.squareOrderId!, { id: "BF_REF", ...first, ...money(60000), ...refundFor("BF_REF", 20000) });
      assert.equal((await h.payments.settleAttempt(clean.id)).outcome, "completed");
      assert.equal((await h.payments.settleAttempt(refunded.id)).outcome, "reconciliation_required");
      assert.equal((await h.attempt(refunded.id)).reconciliation_reason, "payment_refunded");
      assert.equal((await h.processorLedger(s.bookingId)).length, 1);
      assert.equal(refundNotifications(h).length, 0);
    });
  });

  /* ----------------------------------------------------------------------------------------------------------- *
   * Post-merge hotfix pass 2: no repeat checkout while a payment on the invoice is under reconciliation
   * ----------------------------------------------------------------------------------------------------------- */

  const pass2Creates = (h: CateringSquareHarness) => h.fake.requests.filter((request) => request.path === "/v2/online-checkout/payment-links" && request.method === "POST");
  const reviewRefusal = { kind: "refused", status: 409, code: "catering_square_payment_review", message: CATERING_SQUARE_COPY.paymentReview };
  /** Drives an attempt on invoice `index` into `reconciliation_required` for the named reason, through the real settlement code. */
  async function intoReview(h: CateringSquareHarness, s: Scene, reason: "amount_mismatch" | "payment_refunded" | "currency_mismatch" | "multiple_payments", index = 0) {
    const attempt = await open(h, s, index);
    const cents = index === 0 ? 40000 : 60000;
    h.setClock(new Date("2030-05-02T09:00:00Z"));
    if (reason === "amount_mismatch") h.fake.payOrder(attempt.squareOrderId!, { id: "RV_A", ...first, ...money(cents + 500) });
    if (reason === "currency_mismatch") h.fake.payOrder(attempt.squareOrderId!, { id: "RV_C", ...first, ...money(cents, "CAD") });
    if (reason === "payment_refunded") h.fake.payOrder(attempt.squareOrderId!, { id: "RV_R", ...first, ...money(cents), ...refundFor("RV_R", 1000) });
    if (reason === "multiple_payments") {
      h.fake.payOrder(attempt.squareOrderId!, { id: "RV_M1", ...first, ...money(cents) });
      h.fake.payOrder(attempt.squareOrderId!, { id: "RV_M2", ...at("2030-05-01T11:00:00Z"), ...money(1000) });
    }
    assert.equal((await h.payments.settleAttempt(attempt.id)).outcome, "reconciliation_required");
    assert.equal((await h.attempt(attempt.id)).reconciliation_reason, reason);
    return attempt;
  }

  test("PASS2: a creating or pending checkout prevents a duplicate: the same attempt comes back, with one create call", async () => {
    await run(async (h) => {
      const s = await scene(h);
      const opened = await open(h, s);
      const again = await pay(h, s);
      assert.equal(again.kind, "ok");
      if (again.kind === "ok") assert.equal(again.attempt.id, opened.id);
      assert.equal(pass2Creates(h).length, 1);
      assert.equal((await h.attempts(s.bookingId)).length, 1);
    });
  });

  test("PASS2: an invoice with a reconciliation_required attempt refuses another checkout with an explicit 409: no new row, no Square call, nothing cleared", async () => {
    await run(async (h) => {
      const s = await scene(h);
      const reviewed = await intoReview(h, s, "amount_mismatch");
      const rowsBefore = (await h.attempts(s.bookingId)).length;
      const callsBefore = h.fake.requests.length;
      assert.deepEqual(await pay(h, s), reviewRefusal);
      assert.equal((await h.attempts(s.bookingId)).length, rowsBefore, "no attempt row was created");
      assert.equal(h.fake.requests.length, callsBefore, "no Square call of any kind was made");
      assert.equal(pass2Creates(h).length, 1, "only the original create");
      const row = await h.attempt(reviewed.id);
      assert.equal(row.state, "reconciliation_required", "the review is not cleared by the refusal, nor because the checkout is closed");
      assert.equal(row.reconciliation_reason, "amount_mismatch");
      assert.equal((await h.processorLedger(s.bookingId)).length, 0);
    });
  });

  for (const reason of ["amount_mismatch", "payment_refunded", "currency_mismatch", "multiple_payments"] as const) {
    test(`PASS2: a ${reason} reconciliation prevents a repeat checkout on that invoice`, async () => {
      await run(async (h) => {
        const s = await scene(h);
        await intoReview(h, s, reason);
        const creates = pass2Creates(h).length;
        assert.deepEqual(await pay(h, s), reviewRefusal);
        assert.equal(pass2Creates(h).length, creates);
        assert.equal((await h.attempts(s.bookingId)).length, 1);
      });
    });
  }

  test("PASS2: concurrent pay requests cannot bypass the review: every one is refused, no link is created, no row is added", async () => {
    await run(async (h) => {
      const s = await scene(h);
      await intoReview(h, s, "amount_mismatch");
      const creates = pass2Creates(h).length;
      const results = await Promise.all(Array.from({ length: 8 }, () => pay(h, s)));
      for (const result of results) assert.deepEqual(result, reviewRefusal);
      assert.equal(pass2Creates(h).length, creates, "no Square link was created");
      assert.equal((await h.attempts(s.bookingId)).length, 1, "no extra attempt row");
    });
  });

  test("PASS2: a pay request racing the settlement that creates the review ends consistently: afterwards every pay is refused and no second checkout exists", async () => {
    await run(async (h) => {
      const s = await scene(h);
      const attempt = await open(h, s);
      h.fake.payOrder(attempt.squareOrderId!, { id: "RACE_A", ...first, ...money(45000) });
      await Promise.all([h.payments.settleAttempt(attempt.id), pay(h, s), pay(h, s), h.payments.settleAttempt(attempt.id)]);
      assert.equal((await h.attempt(attempt.id)).state, "reconciliation_required");
      assert.equal((await h.attempts(s.bookingId)).length, 1);
      assert.equal(pass2Creates(h).length, 1, "the racing pay reused or was refused: it never created a second checkout");
      assert.deepEqual(await pay(h, s), reviewRefusal);
      assert.equal((await h.processorLedger(s.bookingId)).length, 0);
    });
  });

  test("PASS2: an unrelated invoice on the same booking, and another booking of the same provider, remain payable", async () => {
    await run(async (h) => {
      const s = await scene(h);
      await intoReview(h, s, "amount_mismatch", 0);
      assert.deepEqual(await pay(h, s, 0), reviewRefusal);
      assert.equal((await pay(h, s, 1)).kind, "ok", "the balance invoice is a different payable");
      const second = await h.booking({ providerId: s.providerId, customerId: s.customerId, invoices: [{ kind: "deposit", amountCents: 20000 }] });
      const elsewhere = await h.payments.createPayment({ bookingId: second.bookingId, invoiceId: second.invoiceIds[0], userId: s.customerId });
      assert.equal(elsewhere.kind, "ok");
    });
  });

  test("PASS2: the provider cannot bypass the review or start a customer's checkout; manipulated client input changes nothing", async () => {
    await run(async (h) => {
      const s = await scene(h);
      await intoReview(h, s, "amount_mismatch");
      const rows = (await h.attempts(s.bookingId)).length;
      const calls = h.fake.requests.length;
      assert.deepEqual(await pay(h, s, 0, s.providerId), { kind: "forbidden" });
      const forged = await h.payments.createPayment({ bookingId: s.bookingId, invoiceId: s.invoiceIds[0], userId: s.customerId, amountCents: 1, state: "completed", force: true } as never);
      assert.deepEqual(forged, reviewRefusal);
      assert.equal((await h.attempts(s.bookingId)).length, rows);
      assert.equal(h.fake.requests.length, calls);
    });
  });

  test("PASS2: a clean completed payment is unaffected: it credits once, and the refusal that follows is not a review", async () => {
    await run(async (h) => {
      const s = await scene(h);
      const attempt = await open(h, s);
      h.setClock(new Date("2030-05-02T09:00:00Z"));
      h.fake.payOrder(attempt.squareOrderId!, { id: "CL_P1", ...first });
      assert.equal((await h.payments.settleAttempt(attempt.id)).outcome, "completed");
      assert.equal((await h.processorLedger(s.bookingId)).length, 1);
      const next = await pay(h, s, 0);
      assert.equal(next.kind, "refused");
      if (next.kind === "refused") assert.notEqual(next.code, "catering_square_payment_review");
      assert.equal((await pay(h, s, 1)).kind, "ok");
    });
  });

  test("PASS2: a credited payment later found refunded (completed + review mark) does not block the invoice machinery, and its review mark is preserved", async () => {
    await run(async (h) => {
      const s = await scene(h);
      const attempt = await open(h, s);
      h.setClock(new Date("2030-05-02T09:00:00Z"));
      h.fake.payOrder(attempt.squareOrderId!, { id: "PR_P1", ...first });
      await h.payments.settleAttempt(attempt.id);
      refundExisting(h, "PR_P1", 40000);
      assert.deepEqual(await hook(h, s, attempt, "evt-pr-1", "PR_P1"), { kind: "processed", outcome: "refund_review_required" });
      const row = await h.attempt(attempt.id);
      assert.equal(row.state, "completed");
      assert.ok(row.refund_review_at);
      const credited = await pay(h, s, 0);
      if (credited.kind === "refused") assert.notEqual(credited.code, "catering_square_payment_review");
      assert.equal((await pay(h, s, 1)).kind, "ok", "the other invoice remains payable");
      assert.ok((await h.attempt(attempt.id)).refund_review_at, "the review mark survives");
    });
  });

  test("PASS2: replaying settlement, polling and the webhook over a reviewed attempt is idempotent: one record, no new notification, still blocked", async () => {
    await run(async (h) => {
      const s = await scene(h);
      const reviewed = await intoReview(h, s, "amount_mismatch");
      const notes = h.notifications.length;
      const creates = pass2Creates(h).length;
      for (let i = 0; i < 3; i += 1) {
        assert.equal((await h.payments.settleAttempt(reviewed.id)).outcome, "already_settled");
        await hook(h, s, reviewed, `evt-p2-${i}`, "RV_A");
        assert.deepEqual(await pay(h, s), reviewRefusal);
      }
      assert.equal(h.notifications.length, notes, "no repeated notification");
      assert.equal(pass2Creates(h).length, creates);
      assert.equal((await h.attempt(reviewed.id)).state, "reconciliation_required");
      assert.equal((await h.attempts(s.bookingId)).length, 1);
    });
  });

  test("PASS2: the customer's review wording says not to pay again, the billing list always carries the reviewed attempt, and no Square id reaches the customer", async () => {
    await run(async (h) => {
      const s = await scene(h);
      const reviewed = await intoReview(h, s, "amount_mismatch");
      const view = await customerView(h, s, reviewed.id);
      assert.equal(view.state, "reconciliation_required");
      assert.match(CATERING_SQUARE_COPY.paymentReview, /do not make another payment/i);
      assert.equal(/RV_A/.test(JSON.stringify(view)), false);
      const listed = await h.payments.attemptsForBooking(h.db as never, s.bookingId);
      assert.deepEqual(listed.map((row) => row.id), [reviewed.id]);
    });
  });

  /* Pass 3: reason-neutral reconciliation wording, end to end for every reason */
  for (const reason of ["multiple_payments", "currency_mismatch", "amount_mismatch", "payment_refunded", "payment_timestamp_invalid"] as const) {
    test(`PASS3: a ${reason} reconciliation shows the customer neutral wording that agrees with the notifications, never claims the balance changed, and tells them not to pay again`, async () => {
      await run(async (h) => {
        const s = await scene(h);
        const attempt = reason === "payment_timestamp_invalid"
          ? await (async () => { const a = await open(h, s); h.fake.payOrder(a.squareOrderId!, { id: "N3", updated_at: "not-a-date", created_at: "not-a-date" }); assert.equal((await h.payments.settleAttempt(a.id)).outcome, "reconciliation_required"); return a; })()
          : await intoReview(h, s, reason);
        assert.equal((await h.attempt(attempt.id)).reconciliation_reason, reason);
        const view = await customerView(h, s, attempt.id);
        const display = cateringSquareDisplay(view, "customer");
        assert.equal(display.label, CATERING_SQUARE_COPY.reconciliation);
        const detail = CATERING_SQUARE_RECONCILIATION_COPY[reason].customer;
        for (const text of [display.label, detail, CATERING_SQUARE_COPY.paymentReview]) {
          assert.match(text, /do not make another payment until the review is complete/i);
          assert.equal(/what you owe|amount (you owe|owed|payable)|balance changed/i.test(text), false, `${reason}: ${text}`);
        }
        const mine = h.notifications.filter((n) => n.userId === s.customerId && n.type === "catering_booking_square_payment_reconciliation");
        assert.equal(mine.length, 1);
        assert.equal(mine[0].message, display.label, "the customer's notification and the visible banner agree");
        const providerNote = h.notifications.filter((n) => n.userId === s.providerId && n.type === "catering_booking_square_payment_reconciliation_required");
        assert.equal(providerNote.length, 1);
        assert.equal(/what you owe|refund(ed)? (was )?issued/i.test(providerNote[0].message), false);
        assert.equal(JSON.stringify([mine, providerNote, view]).includes(s.connection.accessToken), false);
        assert.deepEqual(await pay(h, s), reviewRefusal, "still blocked");
        assert.equal(reviewRefusal.message, display.label);
        assert.equal((await h.processorLedger(s.bookingId)).length, 0, "behaviour unchanged: nothing credited");
      });
    });
  }

  /* ----------------------------------------------------------------------------------------------------------- *
   * Pass 5: Square payment links past their lifetime are retired safely before a replacement
   * ----------------------------------------------------------------------------------------------------------- */

  const DAY = 24 * 60 * 60 * 1000;
  const T0 = new Date("2030-01-01T00:00:00Z");
  const MAX_AGE = 180 * DAY;
  const p5Creates = (h: CateringSquareHarness) => h.fake.requests.filter((request) => request.method === "POST" && request.path === "/v2/online-checkout/payment-links").length;
  const p5Deletes = (h: CateringSquareHarness) => h.fake.requests.filter((request) => request.method === "DELETE").length;
  /** An open checkout created at T0 on the deterministic clock. */
  async function p5Open(h: CateringSquareHarness, s: Scene, index = 0) { h.setClock(T0); return open(h, s, index); }

  test("PASS5: a checkout younger than the lifetime is reused: same attempt, no Square call, no delete", async () => {
    await run(async (h) => {
      const s = await scene(h);
      const old = await p5Open(h, s);
      h.setClock(new Date(T0.getTime() + MAX_AGE - 1));
      const calls = squareCalls(h).length;
      const again = await pay(h, s);
      assert.equal(again.kind, "ok");
      if (again.kind === "ok") assert.equal(again.attempt.id, old.id);
      assert.equal(squareCalls(h).length, calls, "no checkout, order or payment call (credential checks aside)");
      assert.equal(p5Deletes(h), 0);
      assert.equal((await h.attempt(old.id)).state, "pending");
    });
  });

  for (const [name, offset] of [["exactly at", 0], ["beyond", 20 * DAY]] as const) {
    test(`PASS5: a checkout ${name} the lifetime is verified, retired as expired, its link removed, and exactly one replacement is created`, async () => {
      await run(async (h) => {
        const s = await scene(h);
        const old = await p5Open(h, s);
        const oldRow = await h.attempt(old.id);
        h.setClock(new Date(T0.getTime() + MAX_AGE + offset));
        const replacement = await pay(h, s);
        assert.equal(replacement.kind, "ok");
        if (replacement.kind !== "ok") throw new Error("not ok");
        assert.notEqual(replacement.attempt.id, old.id);
        assert.equal(replacement.attempt.state, "pending");
        assert.notEqual(replacement.attempt.checkoutUrl, oldRow.checkout_url, "never the dead link");
        const retired = await h.attempt(old.id);
        assert.equal(retired.state, "expired");
        assert.ok(retired.closure_verified_at, "verified after the link was removed");
        assert.ok(retired.square_link_closed_at, "link removal confirmed");
        assert.equal(h.fake.links.get(oldRow.square_payment_link_id)!.deleted, true);
        assert.equal((await h.attempts(s.bookingId)).length, 2);
        assert.equal(p5Creates(h), 2);
        assert.equal((await h.ledger(s.bookingId)).length, 0);
        // replay: the replacement is reused, nothing more is created or deleted
        const deletes = p5Deletes(h);
        const replay = await pay(h, s);
        assert.equal(replay.kind === "ok" && replay.attempt.id, replacement.attempt.id);
        assert.equal(p5Creates(h), 2);
        assert.equal(p5Deletes(h), deletes);
      });
    });
  }

  test("PASS5: an old link that was already PAID is credited, not expired, and no replacement is created", async () => {
    await run(async (h) => {
      const s = await scene(h);
      const old = await p5Open(h, s);
      h.fake.payOrder(old.squareOrderId!, { id: "EX_PAID", created_at: "2030-01-02T00:00:00Z", updated_at: "2030-01-02T00:00:00Z" });
      h.setClock(new Date(T0.getTime() + MAX_AGE + DAY));
      const result = await pay(h, s);
      assert.equal(result.kind, "refused", "the invoice is paid: nothing new to pay");
      assert.equal((await h.attempt(old.id)).state, "completed");
      assert.equal((await h.processorLedger(s.bookingId)).length, 1);
      assert.equal((await h.attempts(s.bookingId)).length, 1);
      assert.equal(p5Creates(h), 1);
    });
  });

  test("PASS5: a link Square reports cancelled is closed as cancelled (no payment) and replaced once", async () => {
    await run(async (h) => {
      const s = await scene(h);
      const old = await p5Open(h, s);
      h.fake.orders.get(old.squareOrderId!)!.state = "CANCELED";
      h.setClock(new Date(T0.getTime() + MAX_AGE));
      const replacement = await pay(h, s);
      assert.equal(replacement.kind, "ok");
      assert.equal((await h.attempt(old.id)).state, "cancelled");
      assert.equal((await h.attempts(s.bookingId)).length, 2);
    });
  });

  test("PASS5: payment still PROCESSING or unattributable on an old link fails closed: nothing expired, deleted or created", async () => {
    await run(async (h) => {
      const s = await scene(h);
      const old = await p5Open(h, s);
      h.fake.payOrder(old.squareOrderId!, { id: "EX_PROC", status: "APPROVED", created_at: "2030-01-02T00:00:00Z", updated_at: "2030-01-02T00:00:00Z" });
      h.setClock(new Date(T0.getTime() + MAX_AGE));
      const deletes = p5Deletes(h);
      const result = await pay(h, s);
      assert.equal(result.kind, "refused");
      if (result.kind === "refused") { assert.equal(result.status, 503); assert.equal(result.code, "catering_square_verification_unavailable"); assert.match(result.message, /do not pay again/i); }
      assert.equal((await h.attempt(old.id)).state, "pending", "age alone never expires an attempt");
      assert.equal(p5Deletes(h), deletes);
      assert.equal((await h.attempts(s.bookingId)).length, 1);
      assert.equal(p5Creates(h), 1);
    });
  });

  test("PASS5: a Square outage during verification fails closed; recovery then retires and replaces exactly once", async () => {
    await run(async (h) => {
      const s = await scene(h);
      const old = await p5Open(h, s);
      h.setClock(new Date(T0.getTime() + MAX_AGE));
      h.fake.state.evidenceFailure = 503;
      for (let i = 0; i < 3; i += 1) {
        const result = await pay(h, s);
        assert.equal(result.kind === "refused" && result.status, 503);
      }
      assert.equal((await h.attempt(old.id)).state, "pending");
      assert.equal(p5Creates(h), 1);
      assert.equal(p5Deletes(h), 0);
      h.fake.state.evidenceFailure = undefined;
      assert.equal((await pay(h, s)).kind, "ok");
      assert.equal((await h.attempt(old.id)).state, "expired");
      assert.equal((await h.attempts(s.bookingId)).length, 2);
      assert.equal(p5Creates(h), 2);
    });
  });

  test("PASS5: if the old link cannot be removed the expired attempt stays UNVERIFIED and no replacement is created; once removable it is verified and replaced", async () => {
    await run(async (h) => {
      const s = await scene(h);
      const old = await p5Open(h, s);
      h.setClock(new Date(T0.getTime() + MAX_AGE));
      h.fake.state.linkDeleteFailure = 500;
      const blocked = await pay(h, s);
      assert.equal(blocked.kind === "refused" && blocked.status, 503);
      const mid = await h.attempt(old.id);
      assert.equal(mid.state, "expired");
      assert.equal(mid.closure_verified_at, null);
      assert.equal(mid.square_link_closed_at, null);
      assert.equal(p5Creates(h), 1);
      const again = await pay(h, s);
      assert.equal(again.kind === "refused" && again.status, 503, "still no replacement while unverified");
      h.fake.state.linkDeleteFailure = undefined;
      assert.equal((await pay(h, s)).kind, "ok");
      assert.ok((await h.attempt(old.id)).closure_verified_at);
      assert.equal(p5Creates(h), 2);
    });
  });

  test("PASS5: an unverified expired attempt, as left by a concurrent request, is never silently superseded: the locked check refuses and makes no Square call", async () => {
    await run(async (h) => {
      const s = await scene(h);
      const old = await p5Open(h, s);
      await h.q(`UPDATE catering_booking_payment_attempts SET state = 'expired', closed_at = now(), square_link_closed_at = NULL WHERE id = $1`, [old.id]);
      h.fake.state.linkDeleteFailure = 500;
      const calls = p5Creates(h);
      const result = await pay(h, s);
      assert.equal(result.kind === "refused" && result.status, 503);
      assert.equal(p5Creates(h), calls);
      assert.equal((await h.attempts(s.bookingId)).length, 1);
    });
  });

  test("PASS5: a provider credential that is unavailable or gone blocks everything: no verification claim, no replacement", async () => {
    await run(async (h) => {
      const s = await scene(h);
      const old = await p5Open(h, s);
      h.setClock(new Date(T0.getTime() + MAX_AGE));
      await h.dropConnection(s.providerId);
      const result = await pay(h, s);
      assert.equal(result.kind, "refused");
      assert.equal((await h.attempt(old.id)).state, "pending");
      assert.equal((await h.attempts(s.bookingId)).length, 1);
      assert.equal(p5Creates(h), 1);
    });
  });

  test("PASS5: an unresolved reconciliation still blocks the invoice at and beyond the lifetime", async () => {
    await run(async (h) => {
      const s = await scene(h);
      await intoReview(h, s, "amount_mismatch");
      h.setClock(new Date(T0.getTime() + MAX_AGE + 5 * DAY));
      assert.deepEqual(await pay(h, s), reviewRefusal);
      assert.equal((await h.attempts(s.bookingId)).length, 1);
    });
  });

  test("PASS5: concurrent pay requests at the boundary produce exactly one replacement, one retirement, no extra rows and no ledger credit", async () => {
    await run(async (h) => {
      const s = await scene(h);
      const old = await p5Open(h, s);
      h.setClock(new Date(T0.getTime() + MAX_AGE));
      const results = await Promise.all(Array.from({ length: 6 }, () => pay(h, s)));
      for (const result of results) assert.ok(result.kind === "ok" || (result.kind === "refused" && ["catering_square_checkout_verifying", "catering_square_verification_unavailable"].includes(result.code)), JSON.stringify(result));
      // whichever requests were told to retry, one more request settles it
      const final = await pay(h, s);
      assert.equal(final.kind, "ok");
      const rows = await h.attempts(s.bookingId);
      assert.equal(rows.length, 2);
      assert.equal(rows.filter((row) => row.state === "pending").length, 1);
      assert.equal((await h.attempt(old.id)).state, "expired");
      assert.equal(p5Creates(h), 2);
      assert.equal((await h.ledger(s.bookingId)).length, 0);
    });
  });

  test("PASS5: a payment, webhook and poll racing the retirement end with one credit, no replacement and no duplicate", async () => {
    await run(async (h) => {
      const s = await scene(h);
      const old = await p5Open(h, s);
      h.fake.payOrder(old.squareOrderId!, { id: "EX_RACE", created_at: "2030-01-02T00:00:00Z", updated_at: "2030-01-02T00:00:00Z" });
      h.setClock(new Date(T0.getTime() + MAX_AGE));
      await Promise.all([pay(h, s), hook(h, s, old, "evt-ex-1", "EX_RACE"), h.payments.settleAttempt(old.id), pay(h, s)]);
      assert.equal((await h.processorLedger(s.bookingId)).length, 1, "exactly one credit");
      assert.equal((await h.attempt(old.id)).state, "completed");
      assert.equal((await h.attempts(s.bookingId)).length, 1);
      assert.equal(p5Creates(h), 1);
    });
  });

  test("PASS5: other invoices are unaffected, and an expired attempt keeps its record (never rewritten into a different state)", async () => {
    await run(async (h) => {
      const s = await scene(h);
      const old = await p5Open(h, s, 0);
      h.setClock(new Date(T0.getTime() + MAX_AGE));
      assert.equal((await pay(h, s, 1)).kind, "ok", "an invoice with no old checkout simply gets one");
      assert.equal((await h.attempt(old.id)).state, "pending", "retiring is per invoice");
      assert.equal((await pay(h, s, 0)).kind, "ok");
      const row = await h.attempt(old.id);
      assert.equal(row.state, "expired");
      assert.ok(row.square_order_id && row.square_payment_link_id && row.amount_cents, "the historical record is preserved");
    });
  });

  /* ----------------------------------------------------------------------------------------------------------- *
   * Pass 6a: a request can only ever touch the attempts of the booking it names
   * ----------------------------------------------------------------------------------------------------------- */

  /** A second booking of the same provider, owned by `customerId`, with one deposit invoice. */
  async function otherBooking(h: CateringSquareHarness, s: Scene, customerId = s.customerId) {
    const created = await h.booking({ providerId: s.providerId, customerId, invoices: [{ kind: "deposit", amountCents: 20000 }] });
    return { bookingId: created.bookingId, invoiceId: created.invoiceIds[0], customerId };
  }
  const snapshot = async (h: CateringSquareHarness) => JSON.stringify(await h.q(`SELECT id, state, closed_at, square_link_closed_at, closure_verified_at, updated_at FROM catering_booking_payment_attempts ORDER BY id`));

  for (const [label, sameOwner] of [["the same customer owns both bookings", true], ["different customers own the bookings", false]] as const) {
    test(`PASS6: booking A submitted with booking B's invoice (${label}) is not found: no Square call, no state change, B's aged checkout untouched`, async () => {
      await run(async (h) => {
        const s = await scene(h);
        const otherCustomer = sameOwner ? s.customerId : await h.user("customer");
        const b = await otherBooking(h, s, otherCustomer);
        h.setClock(T0);
        const created = await h.payments.createPayment({ bookingId: b.bookingId, invoiceId: b.invoiceId, userId: b.customerId });
        assert.equal(created.kind, "ok");
        if (created.kind !== "ok") throw new Error("not ok");
        h.setClock(new Date(T0.getTime() + MAX_AGE + DAY));
        const before = await snapshot(h);
        const calls = h.fake.requests.length;
        // booking A (the requester's own) + booking B's invoice id
        const result = await h.payments.createPayment({ bookingId: s.bookingId, invoiceId: b.invoiceId, userId: s.customerId });
        assert.deepEqual(result, { kind: "not_found" });
        assert.equal(h.fake.requests.length, calls, "no Square call of any kind (not even a credential check)");
        assert.equal(await snapshot(h), before, "no row changed");
        assert.equal((await h.attempt(created.attempt.id)).state, "pending");
        assert.equal(p5Deletes(h), 0);
        // the legitimate owner of B, with B's own invoice, still retires and replaces it
        const legit = await h.payments.createPayment({ bookingId: b.bookingId, invoiceId: b.invoiceId, userId: b.customerId });
        assert.equal(legit.kind, "ok");
        assert.equal((await h.attempt(created.attempt.id)).state, "expired");
      });
    });
  }

  test("PASS6: malicious invoice-id substitution (random, other booking's, other provider's) never reaches Square or any attempt; concurrent cross-booking requests change nothing", async () => {
    await run(async (h) => {
      const s = await scene(h);
      const b = await otherBooking(h, s);
      const other = await otherBooking(h, s, await h.user("customer"));
      h.setClock(T0);
      const mine = await open(h, s, 0);
      const theirs = await h.payments.createPayment({ bookingId: b.bookingId, invoiceId: b.invoiceId, userId: s.customerId });
      assert.equal(theirs.kind, "ok");
      h.setClock(new Date(T0.getTime() + MAX_AGE));
      const before = await snapshot(h);
      const calls = h.fake.requests.length;
      const attempts = [
        ["00000000-0000-4000-8000-000000000000", s.bookingId, s.customerId],
        [b.invoiceId, s.bookingId, s.customerId],
        [s.invoiceIds[0], b.bookingId, s.customerId],
        [other.invoiceId, s.bookingId, s.customerId],
        [s.invoiceIds[1], other.bookingId, s.customerId],
        [b.invoiceId, s.bookingId, s.providerId],
      ] as const;
      const results = await Promise.all(Array.from({ length: 4 }, () => attempts.map(([invoiceId, bookingId, userId]) => h.payments.createPayment({ bookingId, invoiceId, userId }))).flat());
      for (const result of results) assert.ok(result.kind === "not_found" || result.kind === "forbidden", JSON.stringify(result));
      assert.equal(h.fake.requests.length, calls);
      assert.equal(await snapshot(h), before);
      assert.equal((await h.attempt(mine.id)).state, "pending");
      assert.equal((await h.ledger(s.bookingId)).length + (await h.ledger(b.bookingId)).length, 0);
    });
  });

  /* ----------------------------------------------------------------------------------------------------------- *
   * Pass 6b: only an authoritative Square read counts as "verified after the link was closed"
   * ----------------------------------------------------------------------------------------------------------- */

  /** An attempt closed locally with its link confirmed removed an hour ago, and a poll that merely ASKED (last_checked_at is newer). */
  async function closedButPolled(h: CateringSquareHarness, s: Scene, index = 0) {
    const attempt = await open(h, s, index);
    await h.q(`UPDATE catering_booking_payment_attempts SET state = 'cancelled', closed_at = now() - interval '2 hours', square_link_closed_at = now() - interval '1 hour', last_checked_at = now(), closure_verified_at = NULL WHERE id = $1`, [attempt.id]);
    return attempt;
  }

  test("PASS6: a poll timestamp newer than the link closure is NOT verification: with Square unavailable the disconnect is refused and the credential kept", async () => {
    await run(async (h) => {
      const s = await scene(h);
      const attempt = await closedButPolled(h, s);
      h.fake.state.evidenceFailure = 503;
      for (let i = 0; i < 3; i += 1) await assert.rejects(h.connections.disconnect(s.providerId), SquareCredentialDiscardBlockedError, "repeated failed checks stay refused");
      const row = await h.row(s.providerId);
      assert.equal(row.account_status, "active");
      assert.ok(row.encrypted_access_token && row.encrypted_refresh_token);
      assert.equal((await h.attempt(attempt.id)).closure_verified_at, null, "an unavailable read never sets the mark");
    });
  });

  test("PASS6: a payment made before the link was deleted but discovered AFTER is recorded once at disconnect, and the mark is only set by a successful read", async () => {
    await run(async (h) => {
      const s = await scene(h);
      const attempt = await closedButPolled(h, s);
      h.setClock(new Date("2030-05-02T09:00:00Z"));
      h.fake.payOrder(attempt.squareOrderId!, { id: "LATE_1", ...first });
      assert.equal((await h.processorLedger(s.bookingId)).length, 0);
      const result = await h.connections.disconnect(s.providerId);
      assert.equal(result.changed, true);
      assert.equal((await h.processorLedger(s.bookingId)).length, 1, "recorded, not lost");
      assert.equal((await h.attempt(attempt.id)).state, "completed");
      assert.equal((await h.processorLedger(s.bookingId)).length, 1);
    });
  });

  test("PASS6: a successful read after closure sets the mark once, and then the disconnect no longer needs the credential for that attempt", async () => {
    await run(async (h) => {
      const s = await scene(h);
      const attempt = await closedButPolled(h, s);
      assert.equal((await h.payments.settleAttempt(attempt.id)).outcome, "awaiting", "Square shows the order open with no payment");
      const marked = await h.attempt(attempt.id);
      assert.ok(marked.closure_verified_at, "authoritative read succeeded");
      const readsBefore = h.fake.requests.filter((r) => r.path.startsWith("/v2/orders/")).length;
      assert.equal((await h.connections.disconnect(s.providerId)).changed, true);
      assert.equal(h.fake.requests.filter((r) => r.path.startsWith("/v2/orders/")).length, readsBefore, "not read again");
    });
  });

  test("PASS6: a credential REPLACEMENT after a failed verification is refused too; recovery then allows it with the payment recorded", async () => {
    await run(async (h) => {
      const s = await scene(h);
      const attempt = await closedButPolled(h, s);
      h.setClock(new Date("2030-05-02T09:00:00Z"));
      h.fake.payOrder(attempt.squareOrderId!, { id: "LATE_2", ...first });
      h.fake.state.evidenceFailure = 503;
      const refused = await h.connections.guardCredentialReplacement(s.providerId, "MERCHANT_NEW");
      assert.notDeepEqual(refused, { allowed: true });
      assert.equal((await h.processorLedger(s.bookingId)).length, 0);
      h.fake.state.evidenceFailure = undefined;
      assert.deepEqual(await h.connections.guardCredentialReplacement(s.providerId, "MERCHANT_NEW"), { allowed: true });
      assert.equal((await h.processorLedger(s.bookingId)).length, 1);
      assert.equal((await h.attempt(attempt.id)).state, "completed");
    });
  });

  test("PASS6: concurrent polling, webhooks and disconnects over a paid-but-unrecorded closed link lose nothing and credit exactly once", async () => {
    await run(async (h) => {
      const s = await scene(h);
      const attempt = await closedButPolled(h, s);
      h.setClock(new Date("2030-05-02T09:00:00Z"));
      h.fake.payOrder(attempt.squareOrderId!, { id: "LATE_3", ...first });
      const results = await Promise.allSettled([
        h.connections.disconnect(s.providerId), h.connections.disconnect(s.providerId),
        h.payments.getAttempt({ bookingId: s.bookingId, attemptId: attempt.id, userId: s.customerId }),
        hook(h, s, attempt, "evt-p6-1", "LATE_3"), h.payments.settleAttempt(attempt.id),
      ]);
      for (const result of results) assert.ok(result.status === "fulfilled" || result.reason instanceof SquareCredentialDiscardBlockedError, String((result as { reason?: unknown }).reason));
      assert.equal((await h.processorLedger(s.bookingId)).length, 1, "exactly one credit");
      assert.equal((await h.attempt(attempt.id)).state, "completed");
    });
  });

  test("PASS6: a poll's claim and a payment still PROCESSING never mark an attempt verified", async () => {
    await run(async (h) => {
      const s = await scene(h);
      const attempt = await closedButPolled(h, s);
      h.fake.payOrder(attempt.squareOrderId!, { id: "PROC_1", status: "APPROVED", created_at: "2030-01-02T00:00:00Z", updated_at: "2030-01-02T00:00:00Z" });
      assert.equal((await h.payments.settleAttempt(attempt.id)).outcome, "processing");
      assert.equal((await h.attempt(attempt.id)).closure_verified_at, null);
      await assert.rejects(h.connections.disconnect(s.providerId), SquareCredentialDiscardBlockedError);
    });
  });

  /* ----------------------------------------------------------------------------------------------------------- *
   * Pass 6c: unresolved refund reviews stay visible beyond the history cap
   * ----------------------------------------------------------------------------------------------------------- */

  async function oldReviewedPayment(h: CateringSquareHarness, s: Scene, index: number, label: string, review: boolean) {
    const attempt = await open(h, s, index);
    h.setClock(new Date("2030-05-02T09:00:00Z"));
    h.fake.payOrder(attempt.squareOrderId!, { id: label, ...first });
    assert.equal((await h.payments.settleAttempt(attempt.id)).outcome, "completed");
    await h.q(`UPDATE catering_booking_payment_attempts SET created_at = now() - interval '900000 minutes', refund_review_at = ${review ? "now()" : "NULL"} WHERE id = $1`, [attempt.id]);
    return attempt.id;
  }
  const viewOf = (h: CateringSquareHarness, s: Scene, role: "customer" | "provider") => h.payments.attemptsForBooking(h.db as never, s.bookingId)
    .then((rows) => visibleCateringPaymentAttempts(rows, role, role === "customer" ? s.customerId : s.providerId));

  test("PASS6: with fewer than 50 attempts everything is listed, and an old reviewed payment is flagged for both actors", async () => {
    await run(async (h) => {
      const s = await scene(h);
      const id = await oldReviewedPayment(h, s, 0, "RV6_A", true);
      for (const role of ["customer", "provider"] as const) {
        const rows = await viewOf(h, s, role);
        assert.ok(rows.some((row) => row.id === id));
        assert.equal(rows.filter(cateringAttemptNeedsReturnReview).length, 1, role);
      }
    });
  });

  test("PASS6: past the 50-attempt cap an old completed payment with an unresolved refund review is STILL listed and counted for customer and provider; several are all kept", async () => {
    await run(async (h) => {
      const s = await scene(h);
      const a = await oldReviewedPayment(h, s, 0, "RV6_B", true);
      const b = await oldReviewedPayment(h, s, 1, "RV6_C", true);
      await seedHistory(h, s, 70, "superseded", 5_000);
      await seedHistory(h, s, 30, "cancelled", 3_000);
      for (const role of ["customer", "provider"] as const) {
        const rows = await viewOf(h, s, role);
        assert.ok(rows.some((row) => row.id === a) && rows.some((row) => row.id === b), `${role}: both reviewed payments listed`);
        assert.equal(rows.filter(cateringAttemptNeedsReturnReview).length, 2, `${role}: the warning count covers all of them`);
        assert.ok(rows.length <= 50 + 2, "the ordinary history is still capped");
        const serialized = serializeCateringPaymentAttempt(rows.find((row) => row.id === a)!, role);
        assert.equal(serialized.refundReview, true);
        assert.equal(serialized.state, "completed");
      }
    });
  });

  test("PASS6: a resolved review (no mark) returns to ordinary history and falls off the cap; privacy: a stranger sees no attempt", async () => {
    await run(async (h) => {
      const s = await scene(h);
      const id = await oldReviewedPayment(h, s, 0, "RV6_D", false);
      await seedHistory(h, s, 60, "superseded", 5_000);
      const rows = await viewOf(h, s, "provider");
      assert.equal(rows.some((row) => row.id === id), false, "an old payment with no unresolved review is ordinary history");
      assert.equal(rows.filter(cateringAttemptNeedsReturnReview).length, 0);
      const stranger = await h.user("stranger");
      const all = await h.payments.attemptsForBooking(h.db as never, s.bookingId);
      assert.deepEqual(visibleCateringPaymentAttempts(all, "customer", stranger), []);
      const other = await scene(h);
      assert.deepEqual((await viewOf(h, other, "customer")).filter(cateringAttemptNeedsReturnReview), [], "another booking's reviews are not in this view");
    });
  });

  /* ----------------------------------------------------------------------------------------------------------- *
   * Pass 7: the FINAL check under the connection row's exclusive lock enforces the same closure-verification rule
   * ----------------------------------------------------------------------------------------------------------- */

  /**
   * Re-registers the REAL production guard with one change: after the preliminary verification (closeProviderCheckouts) has finished, `race` runs --
   * exactly the window in which a concurrent process can close and delete a checkout. The in-transaction final check is the real production query.
   */
  function raceAfterPreliminary(h: CateringSquareHarness, race: () => Promise<void>) {
    let raced = false;
    h.connections.setCredentialDiscardGuard(
      async (context: { userId: string }) => {
        const result = await h.payments.closeProviderCheckouts(context.userId);
        if (!raced) { raced = true; await race(); }
        return result;
      },
      (context: never) => h.payments.credentialStillNeeded(context),
    );
  }
  /** What a concurrent closeStaleOpenAttempts + sweepClosedLinks leaves behind: closed, link deleted, but NO authoritative read afterwards. */
  const closeAndDeleteWithoutVerification = (h: CateringSquareHarness, attemptId: string) => h.q(
    `UPDATE catering_booking_payment_attempts SET state = 'cancelled', closed_at = now(), square_link_closed_at = now(), last_checked_at = now() + interval '1 second', closure_verified_at = NULL WHERE id = $1`, [attemptId]);

  test("PASS7: a checkout closed and deleted AFTER the preliminary verification but BEFORE the credential lock still blocks the DISCONNECT (real final query)", async () => {
    await run(async (h) => {
      const s = await scene(h);
      const attempt = await open(h, s);
      // The preliminary verification winds the pending attempt down and verifies it; THEN a concurrent process leaves it closed, deleted and unverified.
      raceAfterPreliminary(h, async () => { await closeAndDeleteWithoutVerification(h, attempt.id); });
      await assert.rejects(h.connections.disconnect(s.providerId), SquareCredentialDiscardBlockedError);
      const row = await h.row(s.providerId);
      assert.equal(row.account_status, "active");
      assert.ok(row.encrypted_access_token && row.encrypted_refresh_token, "credentials kept");
    });
  });

  test("PASS7: the same race during MERCHANT REPLACEMENT refuses the replacement and keeps the old merchant", async () => {
    await run(async (h) => {
      const s = await scene(h);
      const attempt = await open(h, s);
      await h.q(`UPDATE catering_booking_payment_attempts SET state = 'cancelled', closed_at = now(), square_link_closed_at = now() - interval '1 hour', closure_verified_at = now() WHERE id = $1`, [attempt.id]); // verified: not a blocker yet
      raceAfterPreliminary(h, async () => { await h.q(`UPDATE catering_booking_payment_attempts SET closure_verified_at = NULL WHERE id = $1`, [attempt.id]); });
      // The replacement itself (preliminary guard, then the in-transaction final check) -- not the preliminary guard alone.
      await assert.rejects(h.connectProvider(s.providerId, "MERCHANT_NEW", { access: "access-new", refresh: "refresh-new" }), SquareCredentialDiscardBlockedError);
      const row = await h.row(s.providerId);
      assert.equal(row.provider_id, s.connection.merchantId, "the old merchant is kept");
      assert.ok(row.encrypted_access_token && row.encrypted_refresh_token);
    });
  });

  test("PASS7: the final query itself: an already-deleted link with closure_verified_at NULL needs the credential; a verified one, a consumed one and another provider's do not", async () => {
    await run(async (h) => {
      const s = await scene(h);
      const attempt = await open(h, s);
      const needed = async () => (await h.payments.credentialStillNeeded({ userId: s.providerId, merchantId: s.connection.merchantId, query: (text, params) => h.pool.query(text, params as never) as never })).safe === false;
      await closeAndDeleteWithoutVerification(h, attempt.id);
      assert.equal(await needed(), true, "closed + link deleted + not verified = still needed");
      await h.q(`UPDATE catering_booking_payment_attempts SET last_checked_at = now() + interval '1 day' WHERE id = $1`, [attempt.id]);
      assert.equal(await needed(), true, "a newer poll timestamp changes nothing");
      await h.q(`UPDATE catering_booking_payment_attempts SET closure_verified_at = now() WHERE id = $1`, [attempt.id]);
      assert.equal(await needed(), false, "authoritatively verified after closure: no longer needed");
      await h.q(`UPDATE catering_booking_payment_attempts SET closure_verified_at = NULL, state = 'completed' WHERE id = $1`, [attempt.id]).catch(() => undefined);
      assert.equal(await h.payments.credentialStillNeeded({ userId: s.providerId, merchantId: "SOME_OTHER_MERCHANT", query: (text, params) => h.pool.query(text, params as never) as never }).then((r) => r.safe), true, "scoped to the merchant");
    });
  });

  test("PASS7: after an authoritative post-deletion read the disconnect succeeds; with Square unavailable it is refused and credentials are preserved", async () => {
    await run(async (h) => {
      const s = await scene(h);
      const attempt = await open(h, s);
      await closeAndDeleteWithoutVerification(h, attempt.id);
      h.fake.state.evidenceFailure = 503;
      await assert.rejects(h.connections.disconnect(s.providerId), SquareCredentialDiscardBlockedError);
      assert.ok((await h.row(s.providerId)).encrypted_access_token, "credentials preserved");
      assert.equal((await h.attempt(attempt.id)).closure_verified_at, null);
      h.fake.state.evidenceFailure = undefined;
      assert.equal((await h.connections.disconnect(s.providerId)).changed, true, "no permanent blocker once verification completes");
      assert.ok((await h.attempt(attempt.id)).closure_verified_at);
    });
  });

  test("PASS7: a payment made before the deletion, settled concurrently with the disconnect, is accounted for exactly once and the credential is not lost early", async () => {
    await run(async (h) => {
      const s = await scene(h);
      const attempt = await open(h, s);
      h.setClock(new Date("2030-05-02T09:00:00Z"));
      h.fake.payOrder(attempt.squareOrderId!, { id: "P7_B", ...first });
      raceAfterPreliminary(h, async () => { await closeAndDeleteWithoutVerification(h, attempt.id); });
      const results = await Promise.allSettled([
        h.connections.disconnect(s.providerId), h.payments.settleAttempt(attempt.id),
        hook(h, s, attempt, "evt-p7-1", "P7_B"), h.payments.getAttempt({ bookingId: s.bookingId, attemptId: attempt.id, userId: s.customerId }),
      ]);
      for (const result of results) assert.ok(result.status === "fulfilled" || result.reason instanceof SquareCredentialDiscardBlockedError, String((result as { reason?: unknown }).reason));
      assert.equal((await h.processorLedger(s.bookingId)).length, 1, "exactly one credit, none missed");
      assert.equal((await h.attempt(attempt.id)).state, "completed");
    });
  });

  /* ----------------------------------------------------------------------------------------------------------- *
   * Pass 8: refund-review wording never claims a ledger credit that does not exist
   * ----------------------------------------------------------------------------------------------------------- */

  const CLAIMS_CREDIT = /credited|already recorded|record any return/i;

  test("PASS8: a reconciliation_required attempt with NO ledger payment that later shows refund activity is described ledger-neutrally everywhere, and nothing financial changes", async () => {
    await run(async (h) => {
      const s = await scene(h);
      const attempt = await intoReview(h, s, "amount_mismatch");
      const before = await h.attempt(attempt.id);
      assert.equal(before.payment_id, null);
      assert.equal(before.refund_review_at, null);
      const evidenceBefore = JSON.stringify((await evidenceRows(h, attempt.id)).map((row) => [row.square_payment_id, row.amount_cents]));
      refundExisting(h, "RV_A", 1000);
      const outcome = await h.payments.settleAttempt(attempt.id);
      assert.equal(outcome.outcome, "refund_review_required");
      const row = await h.attempt(attempt.id);
      assert.ok(row.refund_review_at, "the review mark is set");
      assert.equal(row.payment_id, null, "still no ledger payment");
      assert.equal(row.state, "reconciliation_required");
      assert.equal((await h.processorLedger(s.bookingId)).length, 0);
      assert.equal((await h.ledger(s.bookingId)).length, 0);
      assert.equal(JSON.stringify((await evidenceRows(h, attempt.id)).map((entry) => [entry.square_payment_id, entry.amount_cents])), evidenceBefore, "settlement and evidence amounts unchanged");

      // notification: ledger-neutral, one only (idempotent across replays)
      const notes = refundNotifications(h);
      assert.equal(notes.length, 1);
      assert.equal(notes[0].userId, s.providerId);
      assert.equal(CLAIMS_CREDIT.test(`${notes[0].title} ${notes[0].message}`), false, `${notes[0].title} ${notes[0].message}`);
      assert.equal(notes[0].message, CATERING_SQUARE_NOTIFICATIONS.providerRefundReviewNoLedger.message);
      assert.match(notes[0].message, /compare them with the booking's recorded payments before making any ledger adjustments/);
      await h.payments.settleAttempt(attempt.id);
      await hook(h, s, attempt, "evt-p8-1", "RV_A");
      assert.equal(refundNotifications(h).length, 1, "replays do not notify again");

      // banner and provider card: neither claims a credit nor tells the provider to record a return
      assert.equal(CLAIMS_CREDIT.test(CATERING_SQUARE_COPY.returnReviewNoticeProvider), false);
      const providerCard = cateringSquareDisplay(await providerView(h, s, attempt.id), "provider");
      assert.equal(providerCard.label, CATERING_SQUARE_COPY.reconciliationProviderNothingCredited, "the card truthfully says nothing was credited");
      assert.equal(/record any return/i.test(providerCard.label), false);
      assert.equal((await providerView(h, s, attempt.id)).ledgerCredited, undefined);

      // customer wording stays accurate and says nothing about the ledger
      assert.equal(CLAIMS_CREDIT.test(CATERING_SQUARE_COPY.returnReviewNoticeCustomer), false);
      assert.equal(cateringSquareDisplay(await customerView(h, s, attempt.id), "customer").label, CATERING_SQUARE_COPY.reconciliation);
    });
  });

  test("PASS8: a completed payment WITH a ledger payment keeps its accurate credited wording in the notification and card, while the generic banner stays ledger-neutral", async () => {
    await run(async (h) => {
      const s = await scene(h);
      const attempt = await open(h, s);
      h.setClock(new Date("2030-05-02T09:00:00Z"));
      h.fake.payOrder(attempt.squareOrderId!, { id: "P8_C", ...first });
      assert.equal((await h.payments.settleAttempt(attempt.id)).outcome, "completed");
      refundExisting(h, "P8_C", 40000);
      assert.equal((await h.payments.settleAttempt(attempt.id)).outcome, "refund_review_required");
      const row = await h.attempt(attempt.id);
      assert.ok(row.payment_id, "a real ledger payment");
      const [note] = refundNotifications(h);
      assert.equal(note.message, CATERING_SQUARE_NOTIFICATIONS.providerRefundReview.message);
      assert.match(note.message, /already recorded on this booking/);
      assert.equal(cateringSquareDisplay(await providerView(h, s, attempt.id), "provider").label, CATERING_SQUARE_COPY.completedRefundReviewProvider);
      assert.match(CATERING_SQUARE_COPY.completedRefundReviewProvider, /credited to the Catering ledger/);
      assert.equal(CLAIMS_CREDIT.test(CATERING_SQUARE_COPY.returnReviewNoticeProvider), false, "the shared banner never assumes a credit");
      assert.equal((await h.processorLedger(s.bookingId)).length, 1, "the ledger is unchanged");
      assert.equal(refundNotifications(h).length, 1);
    });
  });
}
