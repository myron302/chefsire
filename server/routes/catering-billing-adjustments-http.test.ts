/**
 * Phase 2P: post-confirmation billing adjustments, credits and external refund records as real HTTP against the real
 * catering routers, every rendered SQL statement executed by a REAL PostgreSQL. Tables are built from the repository's own
 * catering migrations, so the additive ledger migration (table, constraints, unique indexes, immutability trigger and the
 * widened invoice kind) is exercised too.
 *
 * Races here are real: concurrent requests are separate HTTP calls on separate pooled connections contending for the
 * same booking row lock. Nothing is mocked pseudo-concurrency.
 *
 * Set CATERING_TEST_PG_URL to a loopback database whose name contains "test"; the suite is skipped otherwise. The
 * suite's own schema is dropped and rebuilt on every run, which is why the loopback guard exists.
 */
import "../test-support/accept-test-sessions";
import "../test-support/auth-test-env";
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { fileURLToPath } from "node:url";
import express from "express";
import pg from "pg";
import type { AddressInfo } from "node:net";
import { signAuthToken } from "../lib/jwt-config";
import { parseLocalTestDatabaseUrl } from "../test-support/local-test-database";

process.env.DATABASE_URL ||= "postgres://u:p@catering-amendment-tests.invalid/none";
const PG_URL = process.env.CATERING_TEST_PG_URL;
const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(here, "..", "..");

const CUSTOMER_A = "customer-a";
const CUSTOMER_B = "customer-b";
const PROVIDER = "provider-1";
const OTHER_PROVIDER = "provider-2";
const tok = (id: string) => ({ authorization: `Bearer ${signAuthToken({ id, av: 1 } as never)}` });

if (!PG_URL) {
  test("catering billing adjustments over HTTP (skipped: CATERING_TEST_PG_URL not set)", { skip: true }, () => {});
} else {
  // Its own schema, so this file can run beside the other real-Postgres catering suites that reset `public` in the same database.
  const SCHEMA = "catering_adjustment_tests";
  const local = new pg.Pool({ ...parseLocalTestDatabaseUrl(PG_URL), options: `-c search_path=${SCHEMA}` });
  const { pool } = await import("../db/index");
  // A one-shot gate on the adjustment-ledger read, applied to the connection itself so the production code carries no test hook:
  // when armed, the next SELECT from catering_booking_adjustments announces that it has been reached and waits to be released.
  // That holds a GET between its booking read and its amendment read while a real writer commits on another connection.
  const gate: { armed: boolean; pattern: RegExp; reached: () => void; release: Promise<void> | null } = { armed: false, pattern: /^\s*select\b[\s\S]*\bfrom "catering_booking_adjustments"/i, reached: () => undefined, release: null };
  (pool as never as { connect: unknown }).connect = async () => {
    const client = await local.connect();
    const query = client.query.bind(client) as (...args: unknown[]) => unknown;
    (client as unknown as { query: unknown }).query = async (...args: unknown[]) => {
      const text = typeof args[0] === "string" ? args[0] : (args[0] as { text?: string })?.text ?? "";
      if (gate.armed && gate.pattern.test(text)) {
        gate.armed = false;
        gate.reached();
        await gate.release;
      }
      return query(...args);
    };
    return client;
  };
  (pool as never as { query: unknown }).query = (q: unknown, params?: unknown[]) =>
    typeof q === "string" ? local.query(q, params) : local.query(params ? { ...(q as object), values: params } as never : q as never);

  const sqlFile = (relative: string) => fs.readFileSync(path.join(root, relative), "utf8");
  await local.query(`DROP SCHEMA IF EXISTS ${SCHEMA} CASCADE; CREATE SCHEMA ${SCHEMA};`);
  await local.query(`
    CREATE TABLE users (id varchar PRIMARY KEY, username text, display_name text);
    CREATE TABLE catering_inquiries (
      id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
      customer_id varchar NOT NULL REFERENCES users(id), chef_id varchar NOT NULL REFERENCES users(id),
      event_date timestamp NOT NULL, guest_count integer, event_type text, cuisine_preferences jsonb DEFAULT '[]'::jsonb,
      budget numeric(10,2), message text, status text DEFAULT 'pending', created_at timestamp DEFAULT now());
    CREATE TABLE notifications (
      id varchar PRIMARY KEY DEFAULT gen_random_uuid(), user_id varchar NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      type text NOT NULL, title text NOT NULL, message text NOT NULL, image_url text, link_url text,
      metadata jsonb DEFAULT '{}'::jsonb, read boolean DEFAULT false, read_at timestamp, priority text DEFAULT 'normal',
      created_at timestamp DEFAULT now());
  `);
  for (const file of ["migrations/010_create_catering_packages.sql", "server/migrations/20260812_catering_availability.sql", "server/migrations/20260827_catering_bookings.sql", "server/migrations/20260829_catering_booking_operations.sql", "server/migrations/20261003_catering_inquiry_contact.sql", "server/migrations/20260913_catering_booking_billing.sql"]) {
    await local.query(sqlFile(file));
  }
  await local.query(sqlFile("server/migrations/20261004_catering_offer_negotiation.sql"));
  const amendmentMigration = sqlFile("server/migrations/20261005_catering_booking_amendments.sql");
  await local.query(amendmentMigration);
  const adjustmentMigration = sqlFile("server/migrations/20261006_catering_billing_adjustments.sql");
  await local.query(adjustmentMigration);
  await local.query(sqlFile("server/migrations/20261006_catering_billing_adjustments.sql"));

  const { default: cateringRouter } = await import("./catering");
  const { default: bookingsRouter } = await import("./catering-bookings");
  const { default: offersRouter } = await import("./catering-booking-offers");
  const { default: amendmentsRouter } = await import("./catering-booking-amendments");
  const { default: billingRouter } = await import("./catering-booking-billing");
  const { default: adjustmentsRouter } = await import("./catering-booking-adjustments");
  const app = express();
  app.use(express.json());
  app.use("/api/catering", cateringRouter);
  app.use("/api/catering", bookingsRouter);
  app.use("/api/catering", offersRouter);
  app.use("/api/catering", amendmentsRouter);
  app.use("/api/catering", billingRouter);
  app.use("/api/catering", adjustmentsRouter);
  const server = app.listen(0);
  test.after(async () => { server.close(); await local.query(`DROP SCHEMA IF EXISTS ${SCHEMA} CASCADE`); await local.end(); });
  const base = () => `http://127.0.0.1:${(server.address() as AddressInfo).port}/api/catering`;
  const call = async (method: string, route: string, headers: Record<string, string> = {}, body?: unknown) => {
    const response = await fetch(`${base()}${route}`, { method, headers: { ...headers, ...(body === undefined ? {} : { "content-type": "application/json" }) }, body: body === undefined ? undefined : JSON.stringify(body) });
    const text = await response.text();
    return { status: response.status, text, body: text ? JSON.parse(text) : null };
  };

  let sequence = 0;
  async function inquiry(input: { customer?: string; provider?: string; status?: string } = {}) {
    const id = `00000000-0000-4000-8000-${String(++sequence).padStart(12, "0")}`;
    await local.query(
      `INSERT INTO catering_inquiries (id, customer_id, chef_id, event_date, guest_count, event_type, message, status, customer_email, customer_phone)
       VALUES ($1, $2, $3, '2099-05-20', 40, 'wedding', 'customer note', $4, 'ann@example.com', '555 123 4567')`,
      [id, input.customer ?? CUSTOMER_A, input.provider ?? PROVIDER, input.status ?? "accepted"]);
    return id;
  }
  /** A real first offer through the real route: booking + revision 1. */
  async function offered(terms: Record<string, unknown> = { priceCents: 150000, note: "Buffet for 40" }, input: { customer?: string; provider?: string } = {}) {
    const inquiryId = await inquiry(input);
    const response = await call("POST", `/inquiries/${inquiryId}/provider-confirm`, tok(input.provider ?? PROVIDER), terms);
    assert.equal(response.status, 201, response.text);
    const bookingId = response.body.booking.id as string;
    const revisionId = (await local.query(`SELECT id FROM catering_offer_revisions WHERE booking_id = $1 AND revision_number = 1`, [bookingId])).rows[0].id as string;
    return { inquiryId, bookingId, revisionId };
  }
  /** A pre-2N offer: a pending_confirmation booking that has no revision rows. */
  async function legacyOffer(customer = CUSTOMER_A, provider = PROVIDER) {
    const inquiryId = await inquiry({ customer, provider });
    const { rows } = await local.query(
      `INSERT INTO catering_bookings (inquiry_id, provider_id, customer_id, event_date, event_type, guest_count, agreed_price, currency, status, provider_confirmed_at)
       VALUES ($1, $2, $3, '2099-05-20', 'wedding', 40, 1200.00, 'USD', 'pending_confirmation', now()) RETURNING id`, [inquiryId, provider, customer]);
    return { inquiryId, bookingId: rows[0].id as string };
  }
  const revise = (bookingId: string, expected: string | null, terms: Record<string, unknown> = { priceCents: 160000 }, extra: Record<string, unknown> = {}, who = PROVIDER) =>
    call("POST", `/bookings/${bookingId}/offer/revisions`, tok(who), { expectedRevisionId: expected, clientRequestId: randomUUID(), ...terms, ...extra });
  const accept = (bookingId: string, revisionId: string | null | undefined, who = CUSTOMER_A) =>
    call("POST", `/bookings/${bookingId}/customer-confirm`, tok(who), revisionId === undefined ? {} : { revisionId });
  const changeRequest = (bookingId: string, revisionId: string | null, message = "Can we lower the price?", extra: Record<string, unknown> = {}, who = CUSTOMER_A) =>
    call("POST", `/bookings/${bookingId}/offer/change-requests`, tok(who), { revisionId, message, clientRequestId: randomUUID(), ...extra });
  const view = async (bookingId: string, who = CUSTOMER_A) => (await call("GET", `/bookings/${bookingId}/offer`, tok(who)));
  const bookingRow = async (id: string) => (await local.query(`SELECT * FROM catering_bookings WHERE id = $1`, [id])).rows[0];
  const revisionRows = async (bookingId: string) => (await local.query(`SELECT * FROM catering_offer_revisions WHERE booking_id = $1 ORDER BY revision_number`, [bookingId])).rows;
  const bookingCount = async () => Number((await local.query(`SELECT count(*) FROM catering_bookings`)).rows[0].count);
  const notificationsFor = async (userId: string, type: string) => (await local.query(`SELECT title, message, link_url FROM notifications WHERE user_id = $1 AND type = $2`, [userId, type])).rows;

  test.beforeEach(async () => {
    await local.query(`ALTER TABLE notifications DROP CONSTRAINT IF EXISTS no_adjustment_notifications`);
    await local.query(`TRUNCATE notifications, catering_booking_adjustments, catering_booking_amendments, catering_offer_revisions, catering_availability_exceptions, catering_booking_payments, catering_booking_invoices, catering_booking_billing, catering_booking_activity, catering_booking_details, catering_bookings, catering_inquiries, users CASCADE`);
    await local.query(`INSERT INTO users (id, username, display_name) VALUES ($1, 'ann', 'Ann A'), ($2, 'bob', 'Bob B'), ($3, 'chef1', 'Chef One'), ($4, 'chef2', NULL)`, [CUSTOMER_A, CUSTOMER_B, PROVIDER, OTHER_PROVIDER]);
  });

  // ------------------------------------------------------------------------------------------------ helpers
  async function confirmed(terms: Record<string, unknown> = { priceCents: 250000, guestCount: 100, note: "Buffet for 100" }, input: { customer?: string; provider?: string } = {}) {
    const made = await offered(terms, input);
    const accepted = await accept(made.bookingId, made.revisionId, input.customer ?? CUSTOMER_A);
    assert.equal(accepted.status, 200, accepted.text);
    return made.bookingId;
  }
  const propose = (bookingId: string, changes: Record<string, unknown>, who = CUSTOMER_A) =>
    call("POST", `/bookings/${bookingId}/amendments`, tok(who), { expectedBaseAmendmentId: null, clientRequestId: randomUUID(), ...changes });
  const respond = (bookingId: string, amendmentId: string, action: "accept" | "decline" | "withdraw", who: string) =>
    call("POST", `/bookings/${bookingId}/amendments/${amendmentId}/${action}`, tok(who), {});
  const billing = (bookingId: string, who = PROVIDER) => call("GET", `/bookings/${bookingId}/billing`, tok(who));
  const issue = (bookingId: string, kind: string, who = PROVIDER) => call("POST", `/bookings/${bookingId}/billing/invoices`, tok(who), { kind });
  const pay = (bookingId: string, invoiceId: string, amount: string, who = PROVIDER, key = randomUUID()) =>
    call("POST", `/bookings/${bookingId}/billing/payments`, tok(who), { invoiceId, amount, method: "bank_transfer", receivedOn: "2020-01-01", idempotencyKey: key });
  const adjust = (bookingId: string, body: Record<string, unknown>, who = PROVIDER) =>
    call("POST", `/bookings/${bookingId}/billing/adjustments`, tok(who), { currency: "USD", reason: "Agreed with the customer", idempotencyKey: randomUUID(), ...body });
  const reverse = (bookingId: string, entryId: string, who = PROVIDER, body: Record<string, unknown> = { reason: "Entered in error" }) =>
    call("POST", `/bookings/${bookingId}/billing/adjustments/${entryId}/reverse`, tok(who), body);
  const ledgerPayments = async (bookingId: string) => Number((await local.query(`SELECT count(*) FROM catering_booking_payments WHERE booking_id = $1`, [bookingId])).rows[0].count);
  const setStatus = (bookingId: string, status: string) => local.query(`UPDATE catering_bookings SET status = $2 WHERE id = $1`, [bookingId, status]);
  const ledger = async (bookingId: string) => (await local.query(`SELECT * FROM catering_booking_adjustments WHERE booking_id = $1 ORDER BY created_at, id`, [bookingId])).rows;
  const rows = async (table: string, bookingId: string) => (await local.query(`SELECT * FROM ${table} WHERE booking_id = $1 ORDER BY 1`, [bookingId])).rows;
  /** A booking confirmed at $2,500 with the balance requested and $1,000 recorded as received. */
  async function billed(paid = "1000.00") {
    const bookingId = await confirmed();
    const invoice = await issue(bookingId, "balance");
    assert.equal(invoice.status, 200, invoice.text);
    const invoiceId = invoice.body.invoices[0].id as string;
    if (paid !== "0") assert.equal((await pay(bookingId, invoiceId, paid)).status, 200);
    return { bookingId, invoiceId };
  }

  // ------------------------------------------------------------------------------------------------ authority
  test("a provider adds a charge, and BOTH participants read the same entry and the same derived summary", async () => {
    const { bookingId } = await billed();
    const created = await adjust(bookingId, { kind: "charge", amountCents: 40000, reason: "Extra 20 guests" });
    assert.equal(created.status, 201, created.text);
    const provider = await billing(bookingId, PROVIDER);
    const customer = await billing(bookingId, CUSTOMER_A);
    for (const response of [provider, customer]) {
      assert.deepEqual(response.body.adjustments.map((entry: { kind: string; amountCents: number; status: string; reason: string; source: string }) => [entry.kind, entry.amountCents, entry.status, entry.reason, entry.source]), [["charge", 40000, "posted", "Extra 20 guests", "provider_recorded"]]);
    }
    assert.deepEqual(provider.body.summary, customer.body.summary, "one derivation, two identical summaries");
    assert.deepEqual([provider.body.summary.agreedTotalCents, provider.body.summary.obligationCents, provider.body.summary.adjustmentChargesCents], [250000, 290000, 40000]);
  });

  test("a customer cannot add a charge, a credit or a refund record, and nothing is written", async () => {
    const { bookingId } = await billed();
    for (const body of [{ kind: "charge", amountCents: 100 }, { kind: "credit", amountCents: 100 }, { kind: "refund", amountCents: 100 }]) {
      const refused = await adjust(bookingId, body, CUSTOMER_A);
      assert.equal(refused.status, 403, refused.text);
    }
    assert.equal((await ledger(bookingId)).length, 0);
    const entry = await adjust(bookingId, { kind: "charge", amountCents: 100 });
    assert.equal((await reverse(bookingId, entry.body.adjustments[0].id, CUSTOMER_A)).status, 403);
    assert.equal((await ledger(bookingId))[0].status, "posted");
  });

  test("a stranger, a wrong provider and a guessed booking id all get the same non-enumerating 404", async () => {
    const { bookingId } = await billed();
    const guessed = await adjust(randomUUID(), { kind: "charge", amountCents: 100 }, PROVIDER);
    const stranger = await adjust(bookingId, { kind: "charge", amountCents: 100 }, CUSTOMER_B);
    const otherProvider = await adjust(bookingId, { kind: "credit", amountCents: 100 }, OTHER_PROVIDER);
    for (const response of [guessed, stranger, otherProvider]) assert.deepEqual([response.status, response.body], [404, guessed.body]);
    assert.equal((await ledger(bookingId)).length, 0);
    const malformed = await adjust("not-a-booking", { kind: "charge", amountCents: 100 });
    assert.equal(malformed.status, 404);
  });

  test("a guessed ledger entry id is a 404, and another booking's entry cannot be reversed through this one", async () => {
    const mine = await billed();
    const other = await confirmed({ priceCents: 90000 }, { customer: CUSTOMER_B });
    const foreign = await adjust(other, { kind: "charge", amountCents: 500 });
    assert.equal((await reverse(mine.bookingId, randomUUID())).status, 404);
    assert.equal((await reverse(mine.bookingId, foreign.body.adjustments[0].id)).status, 404);
    assert.equal((await reverse(mine.bookingId, "not-a-uuid")).status, 404);
    assert.equal((await ledger(other))[0].status, "posted", "untouched");
  });

  test("an actor, role or provider named in the body is rejected, and the session decides who is acting", async () => {
    const { bookingId } = await billed();
    for (const extra of [{ providerId: PROVIDER }, { userId: PROVIDER }, { role: "provider" }, { recordedBy: PROVIDER }, { status: "posted" }, { source: "amendment" }]) {
      const refused = await adjust(bookingId, { kind: "charge", amountCents: 100, ...extra }, CUSTOMER_A);
      assert.notEqual(refused.status, 201, JSON.stringify(extra));
      assert.equal((await adjust(bookingId, { kind: "charge", amountCents: 100, ...extra }, PROVIDER)).status, 400, JSON.stringify(extra));
    }
    assert.equal((await ledger(bookingId)).length, 0);
    await adjust(bookingId, { kind: "charge", amountCents: 100 });
    assert.equal((await ledger(bookingId))[0].recorded_by, PROVIDER);
  });

  // ------------------------------------------------------------------------------------------------ money validation
  test("amounts are whole positive cents and the currency is explicit and must match the booking", async () => {
    const { bookingId } = await billed();
    for (const amountCents of [10.5, 0, -5, "100", null, 1e12, Number.NaN]) {
      const refused = await adjust(bookingId, { kind: "charge", amountCents });
      assert.equal(refused.status, 400, String(amountCents));
    }
    assert.equal((await adjust(bookingId, { kind: "charge", amountCents: 100, currency: "usd" })).status, 400);
    const missing = await call("POST", `/bookings/${bookingId}/billing/adjustments`, tok(PROVIDER), { kind: "charge", amountCents: 100, reason: "x", idempotencyKey: randomUUID() });
    assert.equal(missing.status, 400, "no implicit currency");
    const mismatch = await adjust(bookingId, { kind: "charge", amountCents: 100, currency: "EUR" });
    assert.deepEqual([mismatch.status, mismatch.body.code], [409, "catering_billing_state"]);
    assert.match(mismatch.body.message, /does not convert/);
    assert.equal((await adjust(bookingId, { kind: "charge", amountCents: 100, reason: "   " })).status, 400);
    assert.equal((await adjust(bookingId, { kind: "charge", amountCents: 100, paymentId: randomUUID() })).status, 400, "a payment is for a refund only");
    assert.equal((await ledger(bookingId)).length, 0);
  });

  // ------------------------------------------------------------------------------------------------ charges
  test("an additional charge is not paid by being posted, never edits an invoice, and never removes a payment", async () => {
    const { bookingId } = await billed();
    const invoicesBefore = await rows("catering_booking_invoices", bookingId);
    const paymentsBefore = await rows("catering_booking_payments", bookingId);
    await adjust(bookingId, { kind: "charge", amountCents: 40000 });
    assert.deepEqual(await rows("catering_booking_invoices", bookingId), invoicesBefore, "historical invoice unchanged");
    assert.deepEqual(await rows("catering_booking_payments", bookingId), paymentsBefore, "historical payment unchanged");
    const { summary, invoices } = (await billing(bookingId)).body;
    assert.equal(summary.paidTotalCents, 100000, "the charge was not marked paid");
    assert.equal(summary.balanceDueCents, 190000);
    assert.equal(invoices[0].amountCents, 250000);
  });

  test("a charge is collected by an `adjustment` request for exactly what was added, once, without touching the balance request", async () => {
    const { bookingId, invoiceId } = await billed("2500.00");
    assert.equal((await billing(bookingId)).body.summary.status, "settled");
    assert.deepEqual((await billing(bookingId)).body.issuable, []);
    await adjust(bookingId, { kind: "charge", amountCents: 40000 });
    const view = await billing(bookingId);
    assert.deepEqual(view.body.issuable, ["adjustment"]);
    assert.deepEqual(view.body.issuablePreview, [{ kind: "adjustment", amountCents: 40000 }]);
    const issued = await issue(bookingId, "adjustment");
    assert.equal(issued.status, 200, issued.text);
    assert.deepEqual(issued.body.invoices.map((row: { kind: string; amountCents: number }) => [row.kind, row.amountCents]), [["balance", 250000], ["adjustment", 40000]]);
    assert.deepEqual((await issue(bookingId, "adjustment")).status, 409, "nothing more to request");
    const adjustmentInvoice = issued.body.invoices[1];
    assert.equal((await pay(bookingId, adjustmentInvoice.id, "400.00")).status, 200);
    const done = (await billing(bookingId)).body;
    assert.deepEqual([done.summary.status, done.summary.balanceDueCents, done.summary.paidTotalCents], ["settled", 0, 290000]);
    assert.equal(done.invoices.find((row: { id: string }) => row.id === invoiceId).amountCents, 250000);
  });

  test("a withdrawn deposit leaves headroom that is NOT an addition: no adjustment request is offered for it", async () => {
    const bookingId = await confirmed();
    const deposit = await call("PUT", `/bookings/${bookingId}/billing/deposit-terms`, tok(PROVIDER), { mode: "fixed", amount: "500" });
    assert.equal(deposit.status, 200, deposit.text);
    const invoiced = await issue(bookingId, "deposit");
    await issue(bookingId, "balance");
    const withdraw = await call("POST", `/bookings/${bookingId}/billing/invoices/${invoiced.body.invoices[0].id}/void`, tok(PROVIDER), { expectedUpdatedAt: invoiced.body.invoices[0].updatedAt });
    assert.equal(withdraw.status, 200, withdraw.text);
    assert.deepEqual((await billing(bookingId)).body.issuable, []);
  });

  // ------------------------------------------------------------------------------------------------ credits
  test("a credit reduces the obligation exactly once and is not evidence that money was returned", async () => {
    const { bookingId } = await billed();
    const credited = await adjust(bookingId, { kind: "credit", amountCents: 20000, reason: "Dessert course dropped" });
    assert.equal(credited.status, 201, credited.text);
    const { summary } = credited.body;
    assert.deepEqual([summary.obligationCents, summary.adjustmentCreditsCents, summary.refundsRecordedCents, summary.netReceivedCents, summary.balanceDueCents], [230000, 20000, 0, 100000, 130000]);
    const replay = await adjust(bookingId, { kind: "credit", amountCents: 20000, reason: "Dessert course dropped", idempotencyKey: (await ledger(bookingId))[0].idempotency_key });
    assert.deepEqual([replay.status, replay.body.duplicate, replay.body.summary.obligationCents], [200, true, 230000], "applied once");
    assert.equal((await ledger(bookingId)).length, 1);
  });

  test("a credit may reach zero and never goes below it, and a credit on money already paid asks for a refund without claiming one", async () => {
    const { bookingId } = await billed("2500.00");
    const tooMuch = await adjust(bookingId, { kind: "credit", amountCents: 250001 });
    assert.deepEqual([tooMuch.status, tooMuch.body.code], [409, "catering_billing_state"]);
    assert.match(tooMuch.body.message, /cannot be more than what your customer currently owes/);
    const credit = await adjust(bookingId, { kind: "credit", amountCents: 20000 });
    assert.equal(credit.status, 201, credit.text);
    assert.deepEqual([credit.body.summary.obligationCents, credit.body.summary.refundPotentiallyDueCents, credit.body.summary.refundsRecordedCents, credit.body.summary.balanceDueCents], [230000, 20000, 0, 0]);
    assert.equal((await adjust(bookingId, { kind: "credit", amountCents: 230001 })).status, 409);
    assert.equal((await adjust(bookingId, { kind: "credit", amountCents: 230000 })).status, 201, "all the way to zero");
    assert.equal((await adjust(bookingId, { kind: "credit", amountCents: 1 })).status, 409, "and no further");
    assert.equal((await billing(bookingId)).body.summary.obligationCents, 0);
  });

  test("a credit and a charge need an agreed price", async () => {
    const bookingId = await confirmed({ guestCount: 40, note: "No price yet" });
    assert.equal((await bookingRow(bookingId)).agreed_price, null);
    for (const kind of ["charge", "credit"]) {
      const refused = await adjust(bookingId, { kind, amountCents: 100 });
      assert.deepEqual([refused.status, refused.body.code], [409, "catering_billing_state"], kind);
    }
  });

  test("two simultaneous credits cannot take the obligation below zero", async () => {
    const { bookingId } = await billed();
    const results = await Promise.all([adjust(bookingId, { kind: "credit", amountCents: 150000 }), adjust(bookingId, { kind: "credit", amountCents: 150000 })]);
    assert.deepEqual(results.map((response) => response.status).sort(), [201, 409]);
    assert.equal((await billing(bookingId)).body.summary.obligationCents, 100000);
  });

  test("two simultaneous charges are both recorded, each exactly once", async () => {
    const { bookingId } = await billed();
    const results = await Promise.all([adjust(bookingId, { kind: "charge", amountCents: 10000 }), adjust(bookingId, { kind: "charge", amountCents: 20000 })]);
    assert.deepEqual(results.map((response) => response.status), [201, 201]);
    assert.equal((await billing(bookingId)).body.summary.obligationCents, 280000);
    assert.equal((await ledger(bookingId)).length, 2);
  });

  // ------------------------------------------------------------------------------------------------ refunds
  test("a provider records an eligible external refund: net received falls once, the obligation does not, and the payment row is untouched", async () => {
    const { bookingId } = await billed();
    const paymentsBefore = await rows("catering_booking_payments", bookingId);
    const refund = await adjust(bookingId, { kind: "refund", amountCents: 30000, reason: "Returned by bank transfer", reference: "BANK-REF-77" });
    assert.equal(refund.status, 201, refund.text);
    const { summary } = refund.body;
    assert.deepEqual([summary.paidTotalCents, summary.refundsRecordedCents, summary.netReceivedCents, summary.obligationCents, summary.balanceDueCents], [100000, 30000, 70000, 250000, 180000]);
    assert.deepEqual(await rows("catering_booking_payments", bookingId), paymentsBefore, "the recorded payment is never rewritten");
    const entry = (await ledger(bookingId))[0];
    assert.deepEqual([entry.entry_kind, entry.source, entry.idempotency_key !== null], ["refund", "provider_recorded", true]);
    assert.equal(entry.processor ?? null, null, "no processor identity exists to fabricate");
  });

  test("a refund cannot exceed money recorded as received and not already recorded as returned", async () => {
    const { bookingId } = await billed();
    assert.equal((await adjust(bookingId, { kind: "refund", amountCents: 100001 })).status, 409);
    assert.equal((await adjust(bookingId, { kind: "refund", amountCents: 70000 })).status, 201);
    const over = await adjust(bookingId, { kind: "refund", amountCents: 30001 });
    assert.deepEqual([over.status, over.body.code], [409, "catering_billing_state"]);
    assert.match(over.body.message, /already recorded as received and not yet recorded as returned/);
    assert.equal((await adjust(bookingId, { kind: "refund", amountCents: 30000 })).status, 201, "exactly the remainder");
    assert.equal((await adjust(bookingId, { kind: "refund", amountCents: 1 })).status, 409);
    assert.equal((await billing(bookingId)).body.summary.netReceivedCents, 0);
  });

  test("nothing received means nothing to refund", async () => {
    const { bookingId } = await billed("0");
    assert.equal((await adjust(bookingId, { kind: "refund", amountCents: 1 })).status, 409);
  });

  test("two simultaneous refunds against the same received money cannot over-refund", async () => {
    const { bookingId } = await billed();
    const results = await Promise.all([adjust(bookingId, { kind: "refund", amountCents: 60000 }), adjust(bookingId, { kind: "refund", amountCents: 60000 })]);
    assert.deepEqual(results.map((response) => response.status).sort(), [201, 409]);
    const total = (await ledger(bookingId)).filter((row: { status: string }) => row.status === "posted").reduce((sum: number, row: { amount_cents: string }) => sum + Number(row.amount_cents), 0);
    assert.equal(total, 60000);
    assert.ok(total <= 100000);
  });

  test("a refund may name a payment, is bounded by that payment, and the payment cannot be taken back while it stands", async () => {
    const { bookingId, invoiceId } = await billed();
    const paymentId = (await billing(bookingId)).body.payments[0].id as string;
    const second = await pay(bookingId, invoiceId, "500.00");
    assert.equal(second.status, 200);
    assert.equal((await adjust(bookingId, { kind: "refund", amountCents: 100001, paymentId })).status, 409, "more than that payment");
    assert.equal((await adjust(bookingId, { kind: "refund", amountCents: 40000, paymentId })).status, 201);
    assert.equal((await adjust(bookingId, { kind: "refund", amountCents: 60001, paymentId })).status, 409);
    assert.equal((await adjust(bookingId, { kind: "refund", amountCents: 100, paymentId: randomUUID() })).status, 409, "a payment that is not on this booking");
    const voided = await call("POST", `/bookings/${bookingId}/billing/payments/${paymentId}/void`, tok(PROVIDER), {});
    assert.equal(voided.status, 409, voided.text);
    assert.match(voided.body.message, /Reverse that refund record first/);
    assert.equal((await rows("catering_booking_payments", bookingId)).every((row: { status: string }) => row.status === "recorded"), true);
  });

  test("a payment that the refunds no longer cover cannot be taken back, so refunds never exceed what was received", async () => {
    const { bookingId } = await billed();
    const paymentId = (await billing(bookingId)).body.payments[0].id as string;
    assert.equal((await adjust(bookingId, { kind: "refund", amountCents: 40000 })).status, 201);
    const refused = await call("POST", `/bookings/${bookingId}/billing/payments/${paymentId}/void`, tok(PROVIDER), {});
    assert.equal(refused.status, 409);
    const entryId = (await ledger(bookingId))[0].id;
    assert.equal((await reverse(bookingId, entryId)).status, 200);
    assert.equal((await call("POST", `/bookings/${bookingId}/billing/payments/${paymentId}/void`, tok(PROVIDER), {})).status, 200, "once the refund record is reversed");
  });

  test("a refund and a new payment racing resolve coherently: every refund fits the money received at the moment it commits", async () => {
    const { bookingId, invoiceId } = await billed();
    const [refund, payment] = await Promise.all([adjust(bookingId, { kind: "refund", amountCents: 100000 }), pay(bookingId, invoiceId, "250.00")]);
    assert.equal(refund.status, 201);
    assert.equal(payment.status, 200);
    const { summary } = (await billing(bookingId)).body;
    assert.deepEqual([summary.paidTotalCents, summary.refundsRecordedCents, summary.netReceivedCents], [125000, 100000, 25000]);
  });

  // ------------------------------------------------------------------------------------------------ idempotency
  test("an exact retry is safe: one row, one notification; the same key with a changed payload is a conflict", async () => {
    const { bookingId } = await billed();
    const body = { kind: "charge", amountCents: 12345, reason: "Extra linen", idempotencyKey: "retry-key-0001" };
    const first = await adjust(bookingId, body);
    const second = await adjust(bookingId, body);
    assert.deepEqual([first.status, first.body.duplicate, second.status, second.body.duplicate], [201, false, 200, true]);
    assert.equal((await ledger(bookingId)).length, 1);
    assert.equal((await notificationsFor(CUSTOMER_A, "catering_booking_adjustment_posted")).length, 1, "a retry is not news");
    for (const changed of [{ amountCents: 12346 }, { reason: "Different" }, { kind: "credit" }, { currency: "EUR" }]) {
      const conflict = await adjust(bookingId, { ...body, ...changed });
      assert.deepEqual([conflict.status, conflict.body.code], [409, "catering_billing_state"], JSON.stringify(changed));
      assert.match(conflict.body.message, /already recorded with different details/);
    }
    assert.equal((await ledger(bookingId)).length, 1);
    assert.equal((await billing(bookingId)).body.summary.obligationCents, 262345);
  });

  test("concurrent retries of one attempt create one entry", async () => {
    const { bookingId } = await billed();
    const body = { kind: "credit", amountCents: 5000, reason: "Goodwill", idempotencyKey: "concurrent-retry-1" };
    const results = await Promise.all([adjust(bookingId, body), adjust(bookingId, body), adjust(bookingId, body)]);
    assert.deepEqual(results.map((response) => response.status).sort(), [200, 200, 201]);
    assert.equal((await ledger(bookingId)).length, 1);
    assert.equal((await notificationsFor(CUSTOMER_A, "catering_booking_adjustment_posted")).length, 1);
  });

  test("a replay is answered from what happened, even after the booking has moved on", async () => {
    const { bookingId } = await billed();
    const body = { kind: "refund", amountCents: 1000, reason: "Returned", idempotencyKey: "replay-after-cancel" };
    assert.equal((await adjust(bookingId, body)).status, 201);
    await setStatus(bookingId, "cancelled");
    const replay = await adjust(bookingId, body);
    assert.deepEqual([replay.status, replay.body.duplicate], [200, true]);
  });

  // ------------------------------------------------------------------------------------------------ reversal
  test("a reversal keeps the entry visible, stops it counting, and is idempotent by state", async () => {
    const { bookingId } = await billed();
    const created = await adjust(bookingId, { kind: "charge", amountCents: 40000, reason: "Extra guests" });
    const entryId = created.body.adjustments[0].id as string;
    const reversed = await reverse(bookingId, entryId, PROVIDER, { reason: "Wrong booking" });
    assert.equal(reversed.status, 200, reversed.text);
    const view = (await billing(bookingId, CUSTOMER_A)).body;
    assert.deepEqual(view.adjustments.map((entry: { status: string; reversalReason: string | null; amountCents: number }) => [entry.status, entry.reversalReason, entry.amountCents]), [["reversed", "Wrong booking", 40000]], "still historically visible");
    assert.deepEqual([view.summary.obligationCents, view.summary.adjustmentChargesCents], [250000, 0], "no longer counts");
    const again = await reverse(bookingId, entryId);
    assert.deepEqual([again.status, again.body.duplicate], [200, true]);
    assert.equal((await notificationsFor(CUSTOMER_A, "catering_booking_adjustment_reversed")).length, 1);
    assert.equal((await ledger(bookingId)).length, 1, "reversal appends nothing and deletes nothing");
    assert.equal((await reverse(bookingId, entryId, PROVIDER, { reason: "" })).status, 400, "a reason is required");
  });

  test("a reversal that would leave the ledger incoherent is refused, and a credit can be reversed to restore the obligation", async () => {
    const { bookingId } = await billed("0");
    const charge = (await adjust(bookingId, { kind: "charge", amountCents: 100000 })).body.adjustments[0].id;
    const credit = await adjust(bookingId, { kind: "credit", amountCents: 340000 });
    assert.equal(credit.status, 201, credit.text);
    assert.equal(credit.body.summary.obligationCents, 10000);
    const refused = await reverse(bookingId, charge);
    assert.deepEqual([refused.status, refused.body.code], [409, "catering_billing_state"]);
    assert.match(refused.body.message, /cannot be more than what your customer currently owes/);
    const creditId = (await ledger(bookingId)).find((row: { entry_kind: string }) => row.entry_kind === "credit").id;
    assert.equal((await reverse(bookingId, creditId)).status, 200);
    assert.equal((await billing(bookingId)).body.summary.obligationCents, 350000);
  });

  test("a reversal racing a new credit leaves a coherent ledger", async () => {
    const { bookingId } = await billed("0");
    const charge = (await adjust(bookingId, { kind: "charge", amountCents: 100000 })).body.adjustments[0].id;
    await Promise.all([reverse(bookingId, charge), adjust(bookingId, { kind: "credit", amountCents: 340000 })]);
    const { summary } = (await billing(bookingId)).body;
    assert.ok(summary.obligationCents >= 0, `obligation ${summary.obligationCents}`);
  });

  test("a refund record can be reversed, restoring net received, and an unpaid request cannot outlive the obligation that justified it", async () => {
    const { bookingId } = await billed("2500.00");
    await adjust(bookingId, { kind: "charge", amountCents: 40000 });
    const adjustmentRequest = await issue(bookingId, "adjustment");
    assert.equal(adjustmentRequest.status, 200, adjustmentRequest.text);
    const chargeId = (await ledger(bookingId))[0].id;
    const refused = await reverse(bookingId, chargeId);
    assert.deepEqual([refused.status, refused.body.code], [409, "catering_billing_state"]);
    assert.match(refused.body.message, /Withdraw that request first/);
    const refund = await adjust(bookingId, { kind: "refund", amountCents: 10000 });
    assert.equal((await reverse(bookingId, refund.body.adjustments[1].id)).status, 200);
    assert.equal((await billing(bookingId)).body.summary.netReceivedCents, 250000);
  });

  // ------------------------------------------------------------------------------------------------ booking status
  test("cancellation preserves every record, still accepts refund records, and refuses new charges and credits", async () => {
    const { bookingId } = await billed();
    await adjust(bookingId, { kind: "charge", amountCents: 40000 });
    await adjust(bookingId, { kind: "credit", amountCents: 10000 });
    await setStatus(bookingId, "cancelled");
    const customerView = await billing(bookingId, CUSTOMER_A);
    assert.equal(customerView.status, 200);
    assert.equal(customerView.body.adjustments.length, 2, "history stays readable");
    for (const kind of ["charge", "credit"]) {
      const refused = await adjust(bookingId, { kind, amountCents: 100 });
      assert.deepEqual([refused.status, refused.body.code], [409, "catering_billing_state"], kind);
      assert.match(refused.body.message, /cancelled/);
    }
    const refund = await adjust(bookingId, { kind: "refund", amountCents: 100000, reason: "Event cancelled; returned in full" });
    assert.equal(refund.status, 201, refund.text);
    assert.deepEqual([refund.body.summary.netReceivedCents, refund.body.adjustments.length], [0, 3]);
    assert.equal((await issue(bookingId, "balance")).status, 409, "Phase 2L billing writes stay closed by cancellation");
    const chargeId = (await ledger(bookingId)).find((row: { entry_kind: string }) => row.entry_kind === "charge").id;
    assert.equal((await reverse(bookingId, chargeId)).status, 409, "a cancelled booking only reverses refund records");
    assert.equal((await ledger(bookingId)).every((row: { status: string }) => row.status === "posted"), true);
  });

  test("a completed booking keeps readable history and accepts only reconciliation: credits and refunds, not a new charge", async () => {
    const { bookingId } = await billed();
    const charge = await adjust(bookingId, { kind: "charge", amountCents: 40000 });
    await setStatus(bookingId, "completed");
    assert.equal((await billing(bookingId, CUSTOMER_A)).body.adjustments.length, 1);
    const refusedCharge = await adjust(bookingId, { kind: "charge", amountCents: 100 });
    assert.deepEqual([refusedCharge.status, refusedCharge.body.code], [409, "catering_billing_state"]);
    assert.match(refusedCharge.body.message, /complete/);
    assert.equal((await adjust(bookingId, { kind: "credit", amountCents: 5000 })).status, 201);
    assert.equal((await adjust(bookingId, { kind: "refund", amountCents: 5000 })).status, 201);
    assert.equal((await reverse(bookingId, charge.body.adjustments[0].id)).status, 200, "undoing a charge only lowers what is owed");
    const creditId = (await ledger(bookingId)).find((row: { entry_kind: string }) => row.entry_kind === "credit").id;
    assert.equal((await reverse(bookingId, creditId)).status, 409, "undoing a credit would raise what is owed after the event");
    assert.equal((await bookingRow(bookingId)).status, "completed", "the operational lifecycle is never touched");
  });

  test("a charge racing a cancellation is either recorded and then cancelled, or refused: never a charge added to a cancelled booking", async () => {
    for (let round = 0; round < 6; round += 1) {
      const { bookingId } = await billed();
      const [charge, cancelled] = await Promise.all([adjust(bookingId, { kind: "charge", amountCents: 100 }), call("POST", `/bookings/${bookingId}/cancel`, tok(CUSTOMER_A), {})]);
      assert.equal(cancelled.status, 200, cancelled.text);
      assert.ok([201, 409].includes(charge.status), charge.text);
      const entries = await ledger(bookingId);
      const booking = await bookingRow(bookingId);
      assert.equal(booking.status, "cancelled");
      // The charge answered 201 if and only if its row exists, and it was refused for the cancellation if it lost the race:
      // the booking row lock is what makes "judged against the booking as it is NOW" true.
      if (charge.status === 409) { assert.equal(entries.length, 0); assert.match(charge.body.message, /cancelled/); }
      else assert.deepEqual(entries.map((row: { entry_kind: string }) => row.entry_kind), ["charge"]);
      assert.equal((await billing(bookingId, CUSTOMER_A)).status, 200, "history stays readable either way");
    }
  });

  test("before confirmation only refund records are possible: price changes go through the offer", async () => {
    const made = await offered();
    for (const kind of ["charge", "credit"]) assert.equal((await adjust(made.bookingId, { kind, amountCents: 100 })).status, 409, kind);
  });

  // ------------------------------------------------------------------------------------------------ amendments
  test("a price-INCREASING amendment after billing records exactly one charge atomically and leaves the invoice alone", async () => {
    const { bookingId, invoiceId } = await billed();
    const invoicesBefore = await rows("catering_booking_invoices", bookingId);
    const created = await propose(bookingId, { priceCents: 290000 }, CUSTOMER_A);
    assert.equal(created.status, 201, created.text);
    const accepted = await respond(bookingId, created.body.amendments.pending.id, "accept", PROVIDER);
    assert.equal(accepted.status, 200, accepted.text);
    assert.equal((await bookingRow(bookingId)).agreed_price, "2900.00");
    const entries = await ledger(bookingId);
    assert.deepEqual(entries.map((row: { entry_kind: string; source: string; amount_cents: string; status: string }) => [row.entry_kind, row.source, Number(row.amount_cents), row.status]), [["charge", "amendment", 40000, "posted"]]);
    assert.deepEqual(await rows("catering_booking_invoices", bookingId), invoicesBefore);
    const { body } = await billing(bookingId, CUSTOMER_A);
    assert.deepEqual([body.summary.agreedTotalCents, body.summary.originalAgreedCents, body.summary.obligationCents, body.summary.adjustmentChargesCents, body.summary.balanceDueCents], [290000, 250000, 290000, 40000, 190000], "the 400 is explained, not added twice");
    assert.equal(body.adjustments[0].amendmentNumber, 1);
    assert.equal(body.invoices.find((row: { id: string }) => row.id === invoiceId).amountCents, 250000);
    assert.deepEqual(body.adjustments[0].paymentId, null);
  });

  test("a price-DECREASING amendment after billing records one credit, claims no refund, and flags a refund as potentially due", async () => {
    const { bookingId } = await billed("2500.00");
    const created = await propose(bookingId, { priceCents: 230000 }, PROVIDER);
    assert.equal((await respond(bookingId, created.body.amendments.pending.id, "accept", CUSTOMER_A)).status, 200);
    const entries = await ledger(bookingId);
    assert.deepEqual(entries.map((row: { entry_kind: string; source: string; amount_cents: string }) => [row.entry_kind, row.source, Number(row.amount_cents)]), [["credit", "amendment", 20000]]);
    const { summary } = (await billing(bookingId)).body;
    assert.deepEqual([summary.obligationCents, summary.refundsRecordedCents, summary.refundPotentiallyDueCents, summary.paidTotalCents], [230000, 0, 20000, 250000]);
    assert.equal((await adjust(bookingId, { kind: "refund", amountCents: 20000, reason: "Returned the difference" })).status, 201);
    assert.equal((await billing(bookingId)).body.summary.refundsRecordedCents, 20000);
  });

  test("an amendment that would leave an unpaid request asking for more than is owed is refused whole and stays pending", async () => {
    const { bookingId, invoiceId } = await billed("0");
    const version = (await billing(bookingId)).body.invoices[0].updatedAt as string;
    const created = await propose(bookingId, { priceCents: 230000 }, PROVIDER);
    const refused = await respond(bookingId, created.body.amendments.pending.id, "accept", CUSTOMER_A);
    assert.deepEqual([refused.status, refused.body.code], [409, "billing_reconciliation_blocked"]);
    assert.equal((await bookingRow(bookingId)).agreed_price, "2500.00");
    assert.equal((await ledger(bookingId)).length, 0, "nothing half-written");
    const withdrawn = await call("POST", `/bookings/${bookingId}/billing/invoices/${invoiceId}/void`, tok(PROVIDER), { expectedUpdatedAt: version });
    assert.equal(withdrawn.status, 200, withdrawn.text);
    assert.equal((await respond(bookingId, created.body.amendments.pending.id, "accept", CUSTOMER_A)).status, 200, "once the request is withdrawn");
    assert.equal((await bookingRow(bookingId)).agreed_price, "2300.00");
    assert.deepEqual(await ledger(bookingId), [], "a withdrawn request with no payment is no ledger activity, so there is nothing to reconcile");
  });

  test("a currency amendment, or clearing the price, stays fail-closed once any ledger activity exists, adjustments included", async () => {
    const { bookingId } = await billed();
    for (const change of [{ currency: "EUR" }, { priceCents: null }]) {
      const refused = await propose(bookingId, change, PROVIDER);
      assert.deepEqual([refused.status, refused.body.code], [409, "billing_terms_locked"], JSON.stringify(change));
    }
    // Ledger activity from an adjustment alone is enough: here no invoice or payment exists at all.
    const second = await confirmed({ priceCents: 100000 }, { customer: CUSTOMER_B });
    assert.equal((await propose(second, { currency: "EUR" }, PROVIDER)).status, 201, "no ledger activity yet: legal");
    const third = await confirmed({ priceCents: 100000 }, { customer: CUSTOMER_B });
    await adjust(third, { kind: "charge", amountCents: 100 });
    const refused = await propose(third, { currency: "EUR" }, PROVIDER, );
    assert.deepEqual([refused.status, refused.body.code], [409, "billing_terms_locked"]);
  });

  test("the amendments view reports that billing has started, so the currency control stays locked", async () => {
    const { bookingId } = await billed();
    const view = await call("GET", `/bookings/${bookingId}/amendments`, tok(CUSTOMER_A));
    assert.equal(view.body.amendments.billingTermsLocked, true);
  });

  test("duplicate and concurrent acceptance create exactly one ledger entry, and a retry cannot double count", async () => {
    const { bookingId } = await billed();
    const created = await propose(bookingId, { priceCents: 290000 }, PROVIDER);
    const amendmentId = created.body.amendments.pending.id as string;
    const results = await Promise.all([respond(bookingId, amendmentId, "accept", CUSTOMER_A), respond(bookingId, amendmentId, "accept", CUSTOMER_A), respond(bookingId, amendmentId, "accept", CUSTOMER_A)]);
    assert.equal(results.every((response) => response.status === 200), true, JSON.stringify(results.map((response) => response.text)));
    assert.equal((await ledger(bookingId)).length, 1);
    assert.equal((await respond(bookingId, amendmentId, "accept", CUSTOMER_A)).status, 200, "a late retry is a no-op");
    assert.equal((await ledger(bookingId)).length, 1);
    assert.equal((await billing(bookingId)).body.summary.obligationCents, 290000);
  });

  test("the same amendment cannot create a second ledger entry: the database refuses it", async () => {
    const { bookingId } = await billed();
    const created = await propose(bookingId, { priceCents: 290000 }, PROVIDER);
    const amendmentId = created.body.amendments.pending.id as string;
    await respond(bookingId, amendmentId, "accept", CUSTOMER_A);
    await assert.rejects(local.query(`INSERT INTO catering_booking_adjustments (booking_id, entry_kind, source, amount_cents, currency, reason, amendment_id, recorded_by) VALUES ($1, 'charge', 'amendment', 40000, 'USD', 'again', $2, $3)`, [bookingId, amendmentId, PROVIDER]), /catering_adjustments_amendment_uidx/);
  });

  test("an acceptance and its financial effect cannot half-commit: a failure rolls back the price, the acceptance and the entry together", async () => {
    const { bookingId } = await billed();
    const created = await propose(bookingId, { priceCents: 290000 }, PROVIDER);
    const amendmentId = created.body.amendments.pending.id as string;
    // A row already bound to this amendment makes the ledger insert violate its unique index INSIDE the acceptance.
    await local.query(`INSERT INTO catering_booking_adjustments (booking_id, entry_kind, source, amount_cents, currency, reason, amendment_id, recorded_by) VALUES ($1, 'charge', 'amendment', 1, 'USD', 'pre-existing', $2, $3)`, [bookingId, amendmentId, PROVIDER]);
    const response = await fetch(`${base()}/bookings/${bookingId}/amendments/${amendmentId}/accept`, { method: "POST", headers: { ...tok(CUSTOMER_A), "content-type": "application/json" }, body: "{}" });
    assert.equal(response.status, 500);
    assert.equal((await bookingRow(bookingId)).agreed_price, "2500.00", "the price did not move");
    assert.equal((await local.query(`SELECT status FROM catering_booking_amendments WHERE id = $1`, [amendmentId])).rows[0].status, "pending", "the amendment is still pending");
    assert.equal((await ledger(bookingId)).length, 1, "only the row that was already there");
  });

  test("an invoice and an amendment racing leave a coherent ledger whichever commits first", async () => {
    const bookingId = await confirmed();
    await call("PUT", `/bookings/${bookingId}/billing/deposit-terms`, tok(PROVIDER), { mode: "fixed", amount: "500" });
    assert.equal((await issue(bookingId, "deposit")).status, 200);
    const created = await propose(bookingId, { priceCents: 290000 }, PROVIDER);
    const [accepted, invoiced] = await Promise.all([respond(bookingId, created.body.amendments.pending.id, "accept", CUSTOMER_A), issue(bookingId, "balance")]);
    assert.equal(accepted.status, 200, accepted.text);
    assert.equal(invoiced.status, 200, invoiced.text);
    const { body } = await billing(bookingId);
    const live = body.invoices.filter((row: { status: string }) => row.status === "issued").reduce((sum: number, row: { amountCents: number }) => sum + row.amountCents, 0);
    assert.equal(body.summary.obligationCents, 290000);
    assert.ok(live <= 290000, `live invoices ${live}`);
    assert.equal((await ledger(bookingId)).length, 1);
    // Whatever the balance request was derived from, anything the obligation still has beyond it is requestable exactly once.
    for (const kind of body.issuable as string[]) assert.equal(kind, "adjustment");
  });

  test("a price amendment before any billing needs no ledger entry, and its history is untouched by later adjustments", async () => {
    const bookingId = await confirmed();
    const created = await propose(bookingId, { priceCents: 290000 }, PROVIDER);
    assert.equal((await respond(bookingId, created.body.amendments.pending.id, "accept", CUSTOMER_A)).status, 200);
    assert.equal((await ledger(bookingId)).length, 0, "nothing was billed, so there is nothing to reconcile");
    assert.equal((await billing(bookingId)).body.summary.originalAgreedCents, 290000);
  });

  // ------------------------------------------------------------------------------------------------ unrelated history
  test("Phase 2N offer history, Phase 2O amendment history and operational data are unchanged by ledger activity", async () => {
    const { bookingId } = await billed();
    const created = await propose(bookingId, { priceCents: 290000 }, PROVIDER);
    await respond(bookingId, created.body.amendments.pending.id, "accept", CUSTOMER_A);
    const snapshot = async () => ({
      offers: await rows("catering_offer_revisions", bookingId),
      amendments: await rows("catering_booking_amendments", bookingId),
      details: await rows("catering_booking_details", bookingId),
      activity: (await rows("catering_booking_activity", bookingId)).length,
    });
    const before = await snapshot();
    const booking = await bookingRow(bookingId);
    await adjust(bookingId, { kind: "charge", amountCents: 100 });
    await adjust(bookingId, { kind: "credit", amountCents: 100 });
    await adjust(bookingId, { kind: "refund", amountCents: 100 });
    assert.deepEqual(await snapshot(), before);
    const after = await bookingRow(bookingId);
    assert.deepEqual([after.agreed_price, after.status, after.guest_count, after.currency], [booking.agreed_price, booking.status, booking.guest_count, booking.currency], "the confirmed booking projection stays authoritative");
  });

  test("a booking that predates the ledger works unchanged and fabricates no rows", async () => {
    const bookingId = await confirmed();
    await local.query(`INSERT INTO catering_booking_invoices (booking_id, invoice_number, invoice_kind, amount_cents, currency, status, issued_at) VALUES ($1, 1, 'deposit', 50000, 'USD', 'issued', now())`, [bookingId]);
    const invoiceId = (await local.query(`SELECT id FROM catering_booking_invoices WHERE booking_id = $1`, [bookingId])).rows[0].id;
    await local.query(`INSERT INTO catering_booking_payments (booking_id, invoice_id, amount_cents, currency, payment_method, received_on, recorded_by, idempotency_key) VALUES ($1, $2, 20000, 'USD', 'cash', '2020-01-01', $3, 'legacy-key-0001')`, [bookingId, invoiceId, PROVIDER]);
    const view = await billing(bookingId, CUSTOMER_A);
    assert.equal(view.status, 200);
    assert.deepEqual(view.body.adjustments, []);
    const { summary } = view.body;
    assert.deepEqual([summary.agreedTotalCents, summary.originalAgreedCents, summary.obligationCents, summary.paidTotalCents, summary.netReceivedCents, summary.remainingOfAgreedCents, summary.balanceDueCents, summary.refundPotentiallyDueCents], [250000, 250000, 250000, 20000, 20000, 230000, 230000, 0]);
    assert.equal((await ledger(bookingId)).length, 0, "reading billing never writes an adjustment");
    assert.equal((await pay(bookingId, invoiceId, "300.00")).status, 200, "Phase 2L payments behave exactly as before");
    assert.equal((await ledger(bookingId)).length, 0);
  });

  // ------------------------------------------------------------------------------------------------ privacy
  test("the provider's reference and internal attribution never reach the customer, and no raw row is exposed", async () => {
    const { bookingId } = await billed();
    await adjust(bookingId, { kind: "refund", amountCents: 5000, reason: "Returned", reference: "PRIVATE-BANK-REF-991" });
    const customer = await billing(bookingId, CUSTOMER_A);
    const provider = await billing(bookingId, PROVIDER);
    assert.equal(customer.text.includes("PRIVATE-BANK-REF-991"), false);
    assert.equal(customer.body.adjustmentActions, undefined, "no provider-only object at all");
    assert.equal("reference" in customer.body.adjustments[0], false);
    for (const leaked of ["recordedBy", "recorded_by", "idempotency", "reversedBy", PROVIDER, "processor"]) assert.equal(customer.text.includes(leaked), false, leaked);
    assert.equal(provider.body.adjustments[0].reference, "PRIVATE-BANK-REF-991");
    assert.equal(provider.text.includes("recorded_by"), false);
    assert.deepEqual(Object.keys(customer.body.adjustments[0]).sort(), ["amendmentNumber", "amountCents", "createdAt", "currency", "id", "kind", "paymentId", "reason", "reversalReason", "reversedAt", "source", "status"]);
  });

  test("notifications go to the customer once, name no amount, reason or payment detail, and a failure never un-posts the entry", async () => {
    const { bookingId } = await billed();
    await adjust(bookingId, { kind: "refund", amountCents: 4321, reason: "Secret reason text", reference: "REF-ABC" });
    const sent = await notificationsFor(CUSTOMER_A, "catering_booking_adjustment_posted");
    assert.equal(sent.length, 1);
    for (const text of [sent[0].title, sent[0].message]) {
      for (const leaked of ["4321", "43.21", "Secret reason text", "REF-ABC", "refund"]) assert.equal(text.toLowerCase().includes(leaked.toLowerCase()), false, leaked);
    }
    assert.match(sent[0].link_url, /#billing$/);
    assert.equal((await notificationsFor(PROVIDER, "catering_booking_adjustment_posted")).length, 0, "the actor is not told about their own action");
    await local.query(`ALTER TABLE notifications ADD CONSTRAINT no_adjustment_notifications CHECK (type NOT LIKE 'catering_booking_adjustment%') NOT VALID`);
    const survived = await adjust(bookingId, { kind: "charge", amountCents: 700, reason: "Added while notifications are failing" });
    assert.equal(survived.status, 201, survived.text);
    assert.equal((await ledger(bookingId)).length, 2, "the committed entry stands");
    assert.equal((await notificationsFor(CUSTOMER_A, "catering_booking_adjustment_posted")).length, 1, "and the failed notification was not retried into a duplicate");
  });

  // ------------------------------------------------------------------------------------------------ one snapshot (Codex 1)
  /** Starts the ordinary billing GET, holds it AFTER its booking read and BEFORE its ledger read, runs `during`, then lets it finish. */
  async function readBillingDuring(bookingId: string, who: string, during: () => Promise<unknown>) {
    let reached!: () => void;
    const arrived = new Promise<void>((resolve) => { reached = resolve; });
    let release!: () => void;
    gate.release = new Promise<void>((resolve) => { release = resolve; });
    gate.reached = reached;
    gate.armed = true;
    const pendingRead = billing(bookingId, who);
    await arrived;
    try { await during(); } finally { release(); }
    const read = await pendingRead;
    gate.armed = false;
    return read;
  }

  test("snapshot: a price amendment committing between the GET's booking read and its ledger read cannot produce a mixed projection", async () => {
    for (const reader of [CUSTOMER_A, PROVIDER]) {
      const { bookingId } = await billed();
      const created = await propose(bookingId, { priceCents: 290000 }, PROVIDER);
      const amendmentId = created.body.amendments.pending.id as string;
      let accepted: Awaited<ReturnType<typeof respond>> | undefined;
      const read = await readBillingDuring(bookingId, reader, async () => { accepted = await respond(bookingId, amendmentId, "accept", CUSTOMER_A); });
      assert.equal(accepted?.status, 200, "the writer really committed inside the GET's window");
      assert.equal((await bookingRow(bookingId)).agreed_price, "2900.00");
      assert.equal((await ledger(bookingId)).length, 1, "and its ledger entry is committed too");
      // The GET's snapshot predates the commit, so it is wholly BEFORE: the old price and no entry. Never the old price with
      // the new reconciliation entry (which would claim an original of 2,100 and an obligation of 2,500 that never existed).
      const { summary, adjustments } = read.body;
      assert.deepEqual([summary.agreedTotalCents, summary.originalAgreedCents, summary.obligationCents, summary.adjustmentChargesCents, adjustments.length], [250000, 250000, 250000, 0, 0]);
      const next = (await billing(bookingId, reader)).body;
      assert.deepEqual([next.summary.agreedTotalCents, next.summary.originalAgreedCents, next.summary.obligationCents, next.summary.adjustmentChargesCents, next.adjustments.length], [290000, 250000, 290000, 40000, 1], "a later read is wholly AFTER");
    }
  });

  test("snapshot: a response is always internally coherent whichever side of the transition it lands on", async () => {
    const { bookingId } = await billed();
    const created = await propose(bookingId, { priceCents: 290000 }, PROVIDER);
    const amendmentId = created.body.amendments.pending.id as string;
    const accept = respond(bookingId, amendmentId, "accept", CUSTOMER_A);
    const reads = await Promise.all(Array.from({ length: 12 }, () => billing(bookingId, CUSTOMER_A)));
    await accept;
    for (const { body } of reads) {
      const { summary, adjustments } = body;
      assert.equal(summary.originalAgreedCents + summary.adjustmentChargesCents - summary.adjustmentCreditsCents, summary.obligationCents, JSON.stringify(summary));
      assert.deepEqual([summary.agreedTotalCents, adjustments.length], summary.agreedTotalCents === 250000 ? [250000, 0] : [290000, 1], "price and ledger from the same moment");
    }
  });

  test("snapshot: authorization stays non-enumerating, and a stranger gets the same 404 as a guessed id, even while a transition is in flight", async () => {
    const { bookingId } = await billed();
    const guessed = await billing(randomUUID(), CUSTOMER_B);
    const quiet = await billing(bookingId, CUSTOMER_B);
    assert.deepEqual([quiet.status, quiet.body], [404, guessed.body]);
    const created = await propose(bookingId, { priceCents: 290000 }, PROVIDER);
    // A participant's read is held mid-snapshot while a transition commits; a stranger asking in that window learns nothing.
    let duringStranger: Awaited<ReturnType<typeof billing>> | undefined;
    const held = await readBillingDuring(bookingId, CUSTOMER_A, async () => {
      await respond(bookingId, created.body.amendments.pending.id, "accept", CUSTOMER_A);
      duringStranger = await billing(bookingId, CUSTOMER_B);
    });
    assert.equal(held.status, 200);
    assert.deepEqual([duringStranger?.status, duringStranger?.body], [404, guessed.body]);
    assert.equal(duringStranger?.text.includes("2900") || duringStranger?.text.includes("290000"), false, "no amount reaches a stranger");
    assert.equal((await billing("not-a-booking", CUSTOMER_B)).status, 400, "a malformed id is rejected exactly as before");
  });

  // ------------------------------------------------------------------------------------------------ deposit basis (Codex 2)
  const depositFor = async (priceCents: number, adjust_: (bookingId: string) => Promise<void> = async () => undefined, percent = "50") => {
    const bookingId = await confirmed({ priceCents, guestCount: 10, note: "Deposit basis" });
    const saved = await call("PUT", `/bookings/${bookingId}/billing/deposit-terms`, tok(PROVIDER), { mode: "percentage", percent });
    assert.equal(saved.status, 200, saved.text);
    await adjust_(bookingId);
    const view = (await billing(bookingId)).body;
    return { bookingId, view, saved: saved.body.terms.requiredCents as number };
  };

  test("deposit: 50% of a $1,000 obligation is $500, and legacy bookings with no adjustments behave exactly as before", async () => {
    const { view, saved, bookingId } = await depositFor(100000);
    assert.deepEqual([saved, view.terms.requiredCents, view.issuablePreview], [50000, 50000, [{ kind: "deposit", amountCents: 50000 }, { kind: "balance", amountCents: 100000 }]]);
    assert.equal(view.summary.depositRequiredCents, 50000);
    const issued = await issue(bookingId, "deposit");
    assert.equal(issued.body.invoices[0].amountCents, 50000);
    assert.equal((await ledger(bookingId)).length, 0, "no adjustment row was fabricated");
  });

  test("deposit: a $200 charge makes the obligation $1,200 and the 50% deposit $600 in the preview, the serialized terms AND the invoice", async () => {
    const { view, bookingId } = await depositFor(100000, async (id) => { assert.equal((await adjust(id, { kind: "charge", amountCents: 20000 })).status, 201); });
    assert.equal(view.summary.obligationCents, 120000);
    assert.deepEqual([view.terms.requiredCents, view.issuablePreview.find((row: { kind: string }) => row.kind === "deposit").amountCents, view.summary.depositRequiredCents], [60000, 60000, 60000], "one basis everywhere");
    const issued = await issue(bookingId, "deposit");
    assert.equal(issued.status, 200, issued.text);
    assert.equal(issued.body.invoices[0].amountCents, 60000, "and the issued invoice agrees");
    assert.equal(issued.body.terms.requiredCents, 60000);
    const resaved = await call("PUT", `/bookings/${bookingId}/billing/deposit-terms`, tok(PROVIDER), { mode: "percentage", percent: "50", expectedUpdatedAt: issued.body.terms.updatedAt });
    assert.equal(resaved.body.terms.requiredCents, 60000, "the terms-save answer uses the same basis");
  });

  test("deposit: a $200 credit makes the obligation $800 and the 50% deposit $400 everywhere", async () => {
    const { view, bookingId } = await depositFor(100000, async (id) => { assert.equal((await adjust(id, { kind: "credit", amountCents: 20000 })).status, 201); });
    assert.equal(view.summary.obligationCents, 80000);
    assert.deepEqual([view.terms.requiredCents, view.issuablePreview.find((row: { kind: string }) => row.kind === "deposit").amountCents], [40000, 40000]);
    assert.equal((await issue(bookingId, "deposit")).body.invoices[0].amountCents, 40000);
  });

  test("deposit: a reversed charge and a reversed credit no longer affect the required deposit", async () => {
    const charged = await depositFor(100000, async (id) => {
      const entry = await adjust(id, { kind: "charge", amountCents: 20000 });
      assert.equal((await reverse(id, entry.body.adjustments[0].id)).status, 200);
    });
    assert.deepEqual([charged.view.terms.requiredCents, charged.view.summary.obligationCents], [50000, 100000]);
    assert.equal((await issue(charged.bookingId, "deposit")).body.invoices[0].amountCents, 50000);
    const credited = await depositFor(100000, async (id) => {
      const entry = await adjust(id, { kind: "credit", amountCents: 20000 });
      assert.equal((await reverse(id, entry.body.adjustments[0].id)).status, 200);
    });
    assert.deepEqual([credited.view.terms.requiredCents, credited.view.summary.obligationCents], [50000, 100000]);
  });

  test("deposit: an amendment-generated charge is already in the agreed price, so the deposit is derived from the obligation exactly once", async () => {
    const bookingId = await confirmed({ priceCents: 100000, guestCount: 10, note: "x" });
    await call("PUT", `/bookings/${bookingId}/billing/deposit-terms`, tok(PROVIDER), { mode: "percentage", percent: "50" });
    assert.equal((await issue(bookingId, "balance")).status, 200);
    const created = await propose(bookingId, { priceCents: 120000 }, PROVIDER);
    assert.equal((await respond(bookingId, created.body.amendments.pending.id, "accept", CUSTOMER_A)).status, 200);
    const view = (await billing(bookingId)).body;
    assert.deepEqual([view.summary.obligationCents, view.terms.requiredCents], [120000, 60000], "not 70,000: the +200 is not counted twice");
  });

  test("deposit: a fixed deposit keeps its established meaning and is capped by the obligation", async () => {
    const bookingId = await confirmed({ priceCents: 100000, guestCount: 10, note: "x" });
    const saved = await call("PUT", `/bookings/${bookingId}/billing/deposit-terms`, tok(PROVIDER), { mode: "fixed", amount: "300" });
    assert.equal(saved.body.terms.requiredCents, 30000);
    await adjust(bookingId, { kind: "charge", amountCents: 20000 });
    assert.equal((await billing(bookingId)).body.terms.requiredCents, 30000, "a fixed amount is not a percentage of anything");
    await adjust(bookingId, { kind: "credit", amountCents: 100000 });
    assert.equal((await billing(bookingId)).body.terms.requiredCents, 20000, "but never more than what is owed");
  });

  // ------------------------------------------------------------------------------------------------ payable cap (Codex 3)
  const capOf = (body: { invoices: { id: string; maxPaymentCents?: number; remainingCents: number }[] }, id: string) => body.invoices.find((row) => row.id === id)!;

  test("payable cap: invoice remaining equals booking balance, so the cap is the invoice remaining; a customer is never given it", async () => {
    const { bookingId, invoiceId } = await billed("0");
    const provider = (await billing(bookingId, PROVIDER)).body;
    assert.deepEqual([capOf(provider, invoiceId).maxPaymentCents, capOf(provider, invoiceId).remainingCents], [250000, 250000]);
    const customer = (await billing(bookingId, CUSTOMER_A)).body;
    assert.equal("maxPaymentCents" in capOf(customer, invoiceId), false);
  });

  test("payable cap: a credit lowers the cap below the invoice remaining, the server rejects more, and reversing the credit restores it", async () => {
    const { bookingId, invoiceId } = await billed("0");
    const credit = await adjust(bookingId, { kind: "credit", amountCents: 220000 });
    assert.equal(credit.status, 201);
    const view = (await billing(bookingId)).body;
    assert.deepEqual([capOf(view, invoiceId).remainingCents, capOf(view, invoiceId).maxPaymentCents, view.summary.balanceDueCents], [250000, 30000, 30000]);
    const over = await pay(bookingId, invoiceId, "500.00");
    assert.equal(over.status, 409, over.text);
    assert.match(over.body.message, /more than your customer now owes/);
    assert.equal((await ledgerPayments(bookingId)), 0, "nothing was recorded");
    await reverse(bookingId, credit.body.adjustments[0].id);
    assert.equal(capOf((await billing(bookingId)).body, invoiceId).maxPaymentCents, 250000, "a reversed credit restores the cap");
    assert.equal((await pay(bookingId, invoiceId, "300.00")).status, 200);
  });

  test("payable cap: a smaller invoice is capped by itself, and a charge cannot raise an existing invoice's cap", async () => {
    const bookingId = await confirmed();
    await call("PUT", `/bookings/${bookingId}/billing/deposit-terms`, tok(PROVIDER), { mode: "fixed", amount: "200" });
    const deposit = (await issue(bookingId, "deposit")).body.invoices[0];
    const before = capOf((await billing(bookingId)).body, deposit.id);
    assert.deepEqual([before.remainingCents, before.maxPaymentCents], [20000, 20000], "invoice remaining 200, booking balance 2,500");
    await adjust(bookingId, { kind: "charge", amountCents: 50000 });
    const after = capOf((await billing(bookingId)).body, deposit.id);
    assert.equal(after.maxPaymentCents, 20000, "the new money is collected by its own request, not by overpaying this one");
    assert.equal((await pay(bookingId, deposit.id, "201.00")).status, 409);
    assert.equal((await pay(bookingId, deposit.id, "200.00")).status, 200);
  });

  test("payable cap: a credit to zero means no positive payment can be recorded, and nothing is marked paid", async () => {
    const { bookingId, invoiceId } = await billed("0");
    await adjust(bookingId, { kind: "credit", amountCents: 250000 });
    const view = (await billing(bookingId)).body;
    assert.deepEqual([capOf(view, invoiceId).maxPaymentCents, view.summary.balanceDueCents, view.summary.paidTotalCents], [0, 0, 0]);
    assert.equal(view.invoices[0].state, "issued", "not paid merely because nothing is owed");
    assert.equal((await pay(bookingId, invoiceId, "0.01")).status, 409);
    assert.equal((await pay(bookingId, invoiceId, "2500.00")).status, 409);
  });

  test("payable cap: a stale form that was valid when it opened is still rejected by the server after a concurrent credit", async () => {
    const { bookingId, invoiceId } = await billed("0");
    const staleCap = capOf((await billing(bookingId)).body, invoiceId).maxPaymentCents;
    assert.equal(staleCap, 250000);
    await adjust(bookingId, { kind: "credit", amountCents: 200000 });
    const stale = await pay(bookingId, invoiceId, "2500.00");
    assert.equal(stale.status, 409, stale.text);
    assert.equal(await ledgerPayments(bookingId), 0);
    const [credit, payment] = await Promise.all([adjust(bookingId, { kind: "credit", amountCents: 20000 }), pay(bookingId, invoiceId, "500.00")]);
    assert.equal(credit.status, 201);
    assert.equal(payment.status, 409, "500 against a 300 balance, whichever order the two commit");
  });

  test("payable cap: ordinary Phase 2L payment recording is unchanged on a booking with no adjustments", async () => {
    const { bookingId, invoiceId } = await billed("1000.00");
    const view = (await billing(bookingId)).body;
    assert.deepEqual([capOf(view, invoiceId).maxPaymentCents, capOf(view, invoiceId).remainingCents], [150000, 150000]);
    assert.equal((await pay(bookingId, invoiceId, "1501.00")).status, 409);
    assert.equal((await pay(bookingId, invoiceId, "1500.00")).status, 200);
    assert.equal(capOf((await billing(bookingId)).body, invoiceId).maxPaymentCents, 0);
  });

  // ------------------------------------------------------------------------------------------------ refund collectibility (Codex 4)
  const dueOf = (body: { invoices: { id: string; kind: string; amountCents: number; remainingCents: number }[] }) => body.invoices.filter((row) => row.remainingCents > 0).reduce((sum, row) => sum + row.remainingCents, 0);
  const frozen = async (bookingId: string) => [await rows("catering_booking_invoices", bookingId), await rows("catering_booking_payments", bookingId)];

  test("refund after partial payment: the refunded $300 gets a request, the customer can pay the full $1,800, and nothing is stranded", async () => {
    const { bookingId, invoiceId } = await billed("1000.00");
    const before = await frozen(bookingId);
    const recorded = await adjust(bookingId, { kind: "refund", amountCents: 30000, reason: "Returned by bank transfer" });
    assert.equal(recorded.status, 201);
    const view = (await billing(bookingId)).body;
    assert.deepEqual([view.summary.obligationCents, view.summary.netReceivedCents, view.summary.balanceDueCents], [250000, 70000, 180000]);
    assert.deepEqual([view.issuable, view.issuablePreview], [["adjustment"], [{ kind: "adjustment", amountCents: 30000 }]]);
    assert.equal(dueOf(view), 150000, "the original request still asks only for its own 1,500");
    const issued = await issue(bookingId, "adjustment");
    assert.equal(issued.status, 200, issued.text);
    assert.deepEqual(issued.body.invoices.map((row: { kind: string; amountCents: number }) => [row.kind, row.amountCents]), [["balance", 250000], ["adjustment", 30000]]);
    assert.equal(issued.body.summary.outstandingInvoicedCents, 180000, "the requests now ask for exactly what is owed");
    assert.deepEqual(issued.body.issuable, [], "and the same receivable cannot be requested twice");
    assert.equal((await issue(bookingId, "adjustment")).status, 409);
    const further = issued.body.invoices[1];
    assert.equal(further.kind, "adjustment");
    assert.equal(capOf(issued.body, invoiceId).maxPaymentCents, 150000);
    assert.equal(further.maxPaymentCents, 30000);
    assert.equal((await pay(bookingId, invoiceId, "1500.00")).status, 200);
    assert.equal((await pay(bookingId, further.id, "300.00")).status, 200);
    const done = (await billing(bookingId)).body.summary;
    assert.deepEqual([done.balanceDueCents, done.netReceivedCents, done.paidTotalCents, done.refundsRecordedCents, done.status], [0, 250000, 280000, 30000, "settled"]);
    // Immutability: the original invoice and payment rows are byte-for-byte what they were; only new rows appeared.
    const [invoicesAfter, paymentsAfter] = await frozen(bookingId);
    assert.deepEqual(invoicesAfter.find((row: { id: string }) => row.id === invoiceId), before[0].find((row: { id: string }) => row.id === invoiceId));
    assert.deepEqual(paymentsAfter.find((row: { id: string }) => row.id === before[1][0].id), before[1][0]);
    const entries = await ledger(bookingId);
    assert.deepEqual(entries.map((row: { entry_kind: string; amount_cents: string }) => [row.entry_kind, Number(row.amount_cents)]), [["refund", 30000]], "still one refund record, no fabricated charge");
  });

  test("refund after full payment: the booking is not settled, the $300 is requestable and then payable", async () => {
    const { bookingId } = await billed("2500.00");
    assert.equal((await billing(bookingId)).body.summary.status, "settled");
    await adjust(bookingId, { kind: "refund", amountCents: 30000 });
    const view = (await billing(bookingId)).body;
    assert.deepEqual([view.summary.status, view.summary.balanceDueCents, view.summary.refundPotentiallyDueCents, view.issuable], ["balance_not_requested", 30000, 0, ["adjustment"]]);
    const issued = await issue(bookingId, "adjustment");
    assert.equal(issued.body.invoices[1].amountCents, 30000);
    assert.equal((await pay(bookingId, issued.body.invoices[1].id, "300.00")).status, 200);
    assert.deepEqual([(await billing(bookingId)).body.summary.balanceDueCents, (await billing(bookingId)).body.summary.status], [0, "settled"]);
  });

  test("multiple refunds, a reversed refund, and refund + credit / charge each count exactly once", async () => {
    const { bookingId } = await billed("2500.00");
    const one = await adjust(bookingId, { kind: "refund", amountCents: 30000 });
    await adjust(bookingId, { kind: "refund", amountCents: 20000 });
    assert.deepEqual((await billing(bookingId)).body.issuablePreview, [{ kind: "adjustment", amountCents: 50000 }]);
    const issued = await issue(bookingId, "adjustment");
    assert.equal(issued.body.invoices[1].amountCents, 50000);
    // A later refund is requested for itself alone.
    await adjust(bookingId, { kind: "refund", amountCents: 10000 });
    assert.deepEqual((await billing(bookingId)).body.issuablePreview, [{ kind: "adjustment", amountCents: 10000 }]);
    // Reversing the first refund while a request that includes it is unpaid is refused, then allowed once that request is withdrawn.
    const refused = await reverse(bookingId, one.body.adjustments[0].id);
    assert.deepEqual([refused.status, refused.body.code], [409, "catering_billing_state"]);
    assert.match(refused.body.message, /Withdraw that request first/);
    const version = (await billing(bookingId)).body.invoices[1].updatedAt as string;
    const withdrawn = await call("POST", `/bookings/${bookingId}/billing/invoices/${issued.body.invoices[1].id}/void`, tok(PROVIDER), { expectedUpdatedAt: version });
    assert.equal(withdrawn.status, 200, withdrawn.text);
    assert.equal((await reverse(bookingId, one.body.adjustments[0].id)).status, 200);
    const after = (await billing(bookingId)).body;
    assert.deepEqual([after.summary.refundsRecordedCents, after.summary.balanceDueCents, after.issuablePreview], [30000, 30000, [{ kind: "adjustment", amountCents: 30000 }]], "20,000 + 10,000 live, exactly once");
  });

  test("refund + credit lowers the collectible amount; refund + charge adds each in its own place without double counting", async () => {
    const credited = await billed("2500.00");
    await adjust(credited.bookingId, { kind: "refund", amountCents: 30000 });
    await adjust(credited.bookingId, { kind: "credit", amountCents: 20000 });
    const a = (await billing(credited.bookingId)).body;
    assert.deepEqual([a.summary.obligationCents, a.summary.netReceivedCents, a.summary.balanceDueCents, a.issuablePreview], [230000, 220000, 10000, [{ kind: "adjustment", amountCents: 10000 }]]);
    const charged = await billed("2500.00");
    await adjust(charged.bookingId, { kind: "refund", amountCents: 30000 });
    await adjust(charged.bookingId, { kind: "charge", amountCents: 40000 });
    const b = (await billing(charged.bookingId)).body;
    assert.deepEqual([b.summary.obligationCents, b.summary.refundsRecordedCents, b.summary.balanceDueCents, b.issuablePreview], [290000, 30000, 70000, [{ kind: "adjustment", amountCents: 70000 }]]);
    const issued = await issue(charged.bookingId, "adjustment");
    assert.equal((await pay(charged.bookingId, issued.body.invoices[1].id, "700.00")).status, 200);
    assert.equal((await billing(charged.bookingId)).body.summary.balanceDueCents, 0);
  });

  test("a refund after completion is collectible too, and after cancellation Phase 2L's closed billing is unchanged", async () => {
    const done = await billed("2500.00");
    await adjust(done.bookingId, { kind: "refund", amountCents: 30000 });
    await setStatus(done.bookingId, "completed");
    assert.equal((await issue(done.bookingId, "adjustment")).status, 200, "late reconciliation, no lifecycle change");
    assert.equal((await bookingRow(done.bookingId)).status, "completed");
    const cancelled = await billed("2500.00");
    await setStatus(cancelled.bookingId, "cancelled");
    assert.equal((await adjust(cancelled.bookingId, { kind: "refund", amountCents: 30000 })).status, 201, "a refund record after cancellation stays legitimate");
    assert.equal((await issue(cancelled.bookingId, "adjustment")).status, 409, "and billing writes stay closed by cancellation, exactly as before");
    assert.equal((await billing(cancelled.bookingId, CUSTOMER_A)).body.adjustments.length, 1);
  });

  test("concurrent requests for the same refunded receivable create one request, and a refund racing a request stays coherent", async () => {
    const { bookingId } = await billed("2500.00");
    await adjust(bookingId, { kind: "refund", amountCents: 30000 });
    const results = await Promise.all([issue(bookingId, "adjustment"), issue(bookingId, "adjustment"), issue(bookingId, "adjustment")]);
    assert.deepEqual(results.map((response) => response.status).sort(), [200, 409, 409]);
    const view = (await billing(bookingId)).body;
    assert.deepEqual(view.invoices.filter((row: { kind: string }) => row.kind === "adjustment").map((row: { amountCents: number }) => row.amountCents), [30000]);
    const other = await billed("2500.00");
    await adjust(other.bookingId, { kind: "refund", amountCents: 30000 });
    const [request, more] = await Promise.all([issue(other.bookingId, "adjustment"), adjust(other.bookingId, { kind: "refund", amountCents: 20000 })]);
    assert.equal(more.status, 201);
    assert.ok([200, 409].includes(request.status));
    const settled = (await billing(other.bookingId)).body;
    const asked = settled.invoices.filter((row: { kind: string }) => row.kind === "adjustment").reduce((sum: number, row: { amountCents: number }) => sum + row.amountCents, 0);
    const requestable = (settled.issuablePreview as { amountCents: number }[]).reduce((sum, row) => sum + row.amountCents, 0);
    assert.equal(asked + requestable, 50000, "whichever committed first, every refunded cent has exactly one request or one request still to issue");
    assert.equal(settled.summary.balanceDueCents, 50000);
  });

  test("a refund racing a payment: the balance and the requests stay consistent", async () => {
    const { bookingId, invoiceId } = await billed("1000.00");
    const [refund, payment] = await Promise.all([adjust(bookingId, { kind: "refund", amountCents: 30000 }), pay(bookingId, invoiceId, "500.00")]);
    assert.equal(refund.status, 201);
    assert.equal(payment.status, 200);
    const view = (await billing(bookingId)).body;
    assert.deepEqual([view.summary.paidTotalCents, view.summary.netReceivedCents, view.summary.balanceDueCents, view.issuablePreview], [150000, 120000, 130000, [{ kind: "adjustment", amountCents: 30000 }]]);
  });

  // ------------------------------------------------------------------------------------------------ overdue (Codex 5)
  const PAST = "2020-01-01";
  const billedDue = async (paid = "0", dueOn: string | null = PAST) => {
    const bookingId = await confirmed();
    const invoice = await call("POST", `/bookings/${bookingId}/billing/invoices`, tok(PROVIDER), { kind: "balance", dueOn });
    assert.equal(invoice.status, 200, invoice.text);
    const invoiceId = invoice.body.invoices[0].id as string;
    if (paid !== "0") assert.equal((await pay(bookingId, invoiceId, paid)).status, 200);
    return { bookingId, invoiceId };
  };

  test("overdue: a past-due request whose balance a credit took to zero is not overdue, in the summary or on the invoice, and the invoice is untouched", async () => {
    const { bookingId, invoiceId } = await billedDue();
    const before = (await billing(bookingId, CUSTOMER_A)).body;
    assert.deepEqual([before.summary.hasOverdue, before.summary.nextDueIsOverdue, before.invoices[0].overdue], [true, true, true]);
    const invoiceRow = (await rows("catering_booking_invoices", bookingId))[0];
    const credit = await adjust(bookingId, { kind: "credit", amountCents: 250000 });
    assert.equal(credit.status, 201);
    for (const who of [PROVIDER, CUSTOMER_A]) {
      const { summary, invoices } = (await billing(bookingId, who)).body;
      assert.deepEqual([summary.balanceDueCents, summary.nextAmountDueCents, summary.nextDueOn, summary.nextDueIsOverdue, summary.hasOverdue, summary.status], [0, null, null, false, false, "no_payment_required"], who);
      assert.deepEqual([invoices[0].overdue, invoices[0].amountCents, invoices[0].status, invoices[0].remainingCents], [false, 250000, "issued", 250000], "the historical request is untouched and still visible");
    }
    assert.deepEqual((await rows("catering_booking_invoices", bookingId))[0], invoiceRow);
    // Reversing the credit restores the overdue state.
    await reverse(bookingId, credit.body.adjustments[0].id);
    const restored = (await billing(bookingId)).body;
    assert.deepEqual([restored.summary.hasOverdue, restored.summary.nextAmountDueCents, restored.invoices[0].overdue], [true, 250000, true]);
    assert.equal(invoiceId, restored.invoices[0].id);
  });

  test("overdue: a partial credit keeps it overdue for exactly the effective positive amount", async () => {
    const { bookingId } = await billedDue();
    await adjust(bookingId, { kind: "credit", amountCents: 240000 });
    const { summary, invoices } = (await billing(bookingId)).body;
    assert.deepEqual([summary.balanceDueCents, summary.nextAmountDueCents, summary.hasOverdue, summary.status, invoices[0].overdue], [10000, 10000, true, "balance_due", true]);
  });

  test("overdue: a future-due request is not overdue, and settled / no-payment-required never carry an overdue flag", async () => {
    const future = await billedDue("0", "2999-01-01");
    assert.deepEqual([(await billing(future.bookingId)).body.summary.hasOverdue, (await billing(future.bookingId)).body.invoices[0].overdue], [false, false]);
    const settled = await billedDue("2500.00");
    const a = (await billing(settled.bookingId)).body;
    assert.deepEqual([a.summary.status, a.summary.hasOverdue, a.invoices[0].overdue], ["settled", false, false]);
    const credited = await billedDue("1000.00");
    await adjust(credited.bookingId, { kind: "credit", amountCents: 150000 });
    const b = (await billing(credited.bookingId)).body;
    assert.deepEqual([b.summary.status, b.summary.balanceDueCents, b.summary.hasOverdue, b.invoices[0].overdue], ["settled", 0, false, false]);
    assert.equal(b.summary.refundPotentiallyDueCents, 0);
  });

  test("overdue: a refund-created request is overdue by its own date, not by the earlier paid request's", async () => {
    const { bookingId } = await billedDue("2500.00");
    await adjust(bookingId, { kind: "refund", amountCents: 30000 });
    const owed = (await billing(bookingId)).body;
    assert.deepEqual([owed.summary.status, owed.summary.balanceDueCents, owed.summary.hasOverdue, owed.invoices[0].overdue], ["balance_not_requested", 30000, false, false], "owed, not yet requested, not settled and not overdue");
    const requested = await call("POST", `/bookings/${bookingId}/billing/invoices`, tok(PROVIDER), { kind: "adjustment", dueOn: PAST });
    assert.equal(requested.status, 200, requested.text);
    const view = requested.body;
    assert.deepEqual([view.summary.nextAmountDueCents, view.summary.nextDueOn, view.summary.hasOverdue, view.invoices[0].overdue, view.invoices[1].overdue], [30000, PAST, true, false, true]);
  });

  // ------------------------------------------------------------------------------------------------ per-payment refunds (Codex 6)
  /** Two $100 payments against one request: A and B. */
  async function twoPayments() {
    const { bookingId, invoiceId } = await billed("0");
    assert.equal((await pay(bookingId, invoiceId, "100.00")).status, 200);
    assert.equal((await pay(bookingId, invoiceId, "100.00")).status, 200);
    const payments = (await billing(bookingId)).body.payments as { id: string; refundableCents?: number }[];
    return { bookingId, invoiceId, a: payments[0].id, b: payments[1].id };
  }
  const refundable = async (bookingId: string, id: string, who = PROVIDER) => ((await billing(bookingId, who)).body.payments as { id: string; refundableCents?: number }[]).find((row) => row.id === id)!.refundableCents;

  test("per-payment refund: the server sends each payment's own refundable remainder, to the provider only", async () => {
    const { bookingId, a, b } = await twoPayments();
    assert.deepEqual([await refundable(bookingId, a), await refundable(bookingId, b)], [10000, 10000]);
    assert.equal((await adjust(bookingId, { kind: "refund", amountCents: 8000, paymentId: a })).status, 201);
    const view = (await billing(bookingId)).body;
    assert.deepEqual([await refundable(bookingId, a), await refundable(bookingId, b), view.adjustmentActions.maxRefundCents], [2000, 10000, 12000], "booking-wide 120, A 20, B 100");
    const customer = (await billing(bookingId, CUSTOMER_A)).body;
    assert.equal(customer.payments.every((row: { refundableCents?: number }) => !("refundableCents" in row)), true, "never given to a customer");
    assert.equal(customer.adjustmentActions, undefined);
  });

  test("per-payment refund: $20 against A is accepted, $21 is rejected, B is unaffected, and other payments' refunds do not reduce A", async () => {
    const { bookingId, a, b } = await twoPayments();
    await adjust(bookingId, { kind: "refund", amountCents: 8000, paymentId: a });
    const over = await adjust(bookingId, { kind: "refund", amountCents: 2100, paymentId: a });
    assert.deepEqual([over.status, over.body.code], [409, "catering_billing_state"]);
    assert.match(over.body.message, /cannot be more than that payment/);
    assert.equal((await adjust(bookingId, { kind: "refund", amountCents: 5000, paymentId: a })).status, 409, "$50 against A fails even though $120 remains booking-wide");
    assert.equal((await adjust(bookingId, { kind: "refund", amountCents: 7000, paymentId: b })).status, 201, "B has its own $100");
    assert.equal(await refundable(bookingId, a), 2000, "a refund against B never touched A");
    assert.equal((await adjust(bookingId, { kind: "refund", amountCents: 2000, paymentId: a })).status, 201);
    assert.equal(await refundable(bookingId, a), 0);
    assert.equal((await adjust(bookingId, { kind: "refund", amountCents: 1, paymentId: a })).status, 409, "zero left");
    assert.equal((await adjust(bookingId, { kind: "refund", amountCents: 1000 })).status, 201, "a refund naming no payment is bounded booking-wide only");
  });

  test("per-payment refund: multiple refunds decrement once each and a reversed refund restores the capacity", async () => {
    const { bookingId, a } = await twoPayments();
    const first = await adjust(bookingId, { kind: "refund", amountCents: 3000, paymentId: a });
    await adjust(bookingId, { kind: "refund", amountCents: 2000, paymentId: a });
    assert.equal(await refundable(bookingId, a), 5000);
    assert.equal((await reverse(bookingId, first.body.adjustments[0].id)).status, 200);
    assert.equal(await refundable(bookingId, a), 8000, "only the reversed 30 comes back");
    assert.equal((await adjust(bookingId, { kind: "refund", amountCents: 8000, paymentId: a })).status, 201);
  });

  test("per-payment refund: a form that was valid when it opened is rejected by the server once another refund commits", async () => {
    const { bookingId, a } = await twoPayments();
    const staleLimit = await refundable(bookingId, a);
    assert.equal(staleLimit, 10000);
    await adjust(bookingId, { kind: "refund", amountCents: 8000, paymentId: a });
    const stale = await adjust(bookingId, { kind: "refund", amountCents: 5000, paymentId: a });
    assert.equal(stale.status, 409, stale.text);
    assert.equal((await ledger(bookingId)).length, 1);
  });

  test("per-payment refund: two simultaneous refunds against one payment's remaining capacity cannot over-refund it", async () => {
    const { bookingId, a } = await twoPayments();
    const results = await Promise.all([adjust(bookingId, { kind: "refund", amountCents: 6000, paymentId: a }), adjust(bookingId, { kind: "refund", amountCents: 6000, paymentId: a }), adjust(bookingId, { kind: "refund", amountCents: 6000, paymentId: a })]);
    assert.deepEqual(results.map((response) => response.status).sort(), [201, 409, 409]);
    assert.equal(await refundable(bookingId, a), 4000);
    const total = (await ledger(bookingId)).reduce((sum: number, row: { amount_cents: string }) => sum + Number(row.amount_cents), 0);
    assert.equal(total, 6000);
  });

  // ------------------------------------------------------------------------------------------------ obligation ceiling (Codex 7)
  const CEILING = 9_999_999_999;
  const bigBooking = (priceCents = 6_000_000_000) => confirmed({ priceCents, guestCount: 10, note: "Very large" });
  const notificationCount = async () => Number((await local.query(`SELECT count(*) FROM notifications WHERE type = 'catering_booking_adjustment_posted'`)).rows[0].count);

  test("charge ceiling: a small charge, a charge exactly to the ceiling, and a charge one cent over", async () => {
    const small = await bigBooking();
    assert.equal((await adjust(small, { kind: "charge", amountCents: 1000 })).status, 201);
    const exact = await bigBooking();
    const room = (await billing(exact)).body.adjustmentActions.maxChargeCents as number;
    assert.equal(room, CEILING - 6_000_000_000);
    const at = await adjust(exact, { kind: "charge", amountCents: room });
    assert.equal(at.status, 201, at.text);
    assert.equal(at.body.summary.obligationCents, CEILING);
    assert.equal(at.body.adjustmentActions.maxChargeCents, 0);
    const over = await bigBooking();
    const refused = await adjust(over, { kind: "charge", amountCents: room + 1 });
    assert.deepEqual([refused.status, refused.body.code], [409, "catering_billing_state"]);
    assert.match(refused.body.message, /largest amount ChefSire can request/);
  });

  test("charge ceiling: a very large booking plus an individually valid charge is refused cleanly, with no side effect, and a retry is refused the same way", async () => {
    const bookingId = await bigBooking(6_000_000_000);
    const before = { booking: await bookingRow(bookingId), invoices: await rows("catering_booking_invoices", bookingId), notes: await notificationCount() };
    const body = { kind: "charge", amountCents: 5_000_000_000, reason: "Huge", idempotencyKey: "over-ceiling-key-1" };
    const first = await adjust(bookingId, body);
    const retry = await adjust(bookingId, body);
    for (const response of [first, retry]) assert.deepEqual([response.status, response.body.code], [409, "catering_billing_state"]);
    assert.equal(first.text, retry.text, "an exact retry is refused identically");
    assert.equal((await ledger(bookingId)).length, 0, "no ledger row");
    assert.equal(await notificationCount(), before.notes, "no notification");
    assert.deepEqual(await bookingRow(bookingId), before.booking, "no booking mutation");
    assert.deepEqual(await rows("catering_booking_invoices", bookingId), before.invoices, "no invoice mutation");
    // And no later 500: whatever was accepted can still be requested.
    const issued = await issue(bookingId, "balance");
    assert.equal(issued.status, 200, issued.text);
    assert.equal(issued.body.invoices[0].amountCents, 6_000_000_000);
  });

  test("charge ceiling: an accepted charge at the ceiling can always be requested, with no 500 and no amount above the invoice maximum", async () => {
    const bookingId = await bigBooking();
    await adjust(bookingId, { kind: "charge", amountCents: CEILING - 6_000_000_000 });
    const preview = (await billing(bookingId)).body.issuablePreview as { kind: string; amountCents: number }[];
    assert.ok(preview.every((row) => row.amountCents <= CEILING), JSON.stringify(preview));
    const issued = await issue(bookingId, "balance");
    assert.equal(issued.status, 200, issued.text);
    assert.equal(issued.body.invoices[0].amountCents, CEILING);
  });

  test("charge ceiling: credits make room, a reversed credit takes it back, a reversed charge frees it", async () => {
    const bookingId = await bigBooking();
    const room = async () => (await billing(bookingId)).body.adjustmentActions.maxChargeCents as number;
    assert.equal(await room(), 3_999_999_999);
    const credit = await adjust(bookingId, { kind: "credit", amountCents: 1_000_000_000 });
    assert.equal(await room(), 4_999_999_999);
    const charge = await adjust(bookingId, { kind: "charge", amountCents: 4_999_999_999 });
    assert.equal(charge.status, 201);
    assert.equal(await room(), 0);
    const refusedReverse = await reverse(bookingId, credit.body.adjustments[0].id);
    assert.deepEqual([refusedReverse.status, refusedReverse.body.code], [409, "catering_billing_state"], "reversing the credit would put the obligation past the ceiling");
    assert.match(refusedReverse.body.message, /largest amount ChefSire can request/);
    assert.equal((await reverse(bookingId, charge.body.adjustments[1].id)).status, 200);
    assert.equal(await room(), 4_999_999_999, "the reversed charge freed its room");
    assert.equal((await reverse(bookingId, credit.body.adjustments[0].id)).status, 200);
    assert.equal(await room(), 3_999_999_999, "and a reversed credit took its room back");
  });

  test("charge ceiling: two simultaneous charges near the ceiling cannot both land", async () => {
    const bookingId = await bigBooking();
    const results = await Promise.all([adjust(bookingId, { kind: "charge", amountCents: 3_000_000_000 }), adjust(bookingId, { kind: "charge", amountCents: 3_000_000_000 })]);
    assert.deepEqual(results.map((response) => response.status).sort(), [201, 409]);
    const { summary } = (await billing(bookingId)).body;
    assert.equal(summary.obligationCents, 9_000_000_000);
    assert.ok(summary.obligationCents <= CEILING);
  });

  test("charge ceiling: a price amendment that would take the obligation past it is refused whole and stays pending; within it, one entry", async () => {
    const bookingId = await bigBooking(6_000_000_000);
    await adjust(bookingId, { kind: "charge", amountCents: 3_000_000_000 });
    const tooBig = await propose(bookingId, { priceCents: 7_000_000_000 }, PROVIDER);
    assert.equal(tooBig.status, 201, tooBig.text);
    const refused = await respond(bookingId, tooBig.body.amendments.pending.id, "accept", CUSTOMER_A);
    assert.deepEqual([refused.status, refused.body.code], [409, "billing_reconciliation_blocked"]);
    assert.match(refused.body.message, /largest amount ChefSire can request/);
    assert.equal((await bookingRow(bookingId)).agreed_price, "60000000.00", "the price did not move");
    assert.equal((await ledger(bookingId)).length, 1, "only the manual charge: nothing half-written");
    assert.equal((await local.query(`SELECT status FROM catering_booking_amendments WHERE id = $1`, [tooBig.body.amendments.pending.id])).rows[0].status, "pending");
    assert.equal((await respond(bookingId, tooBig.body.amendments.pending.id, "decline", CUSTOMER_A)).status, 200);
    const fits = await propose(bookingId, { priceCents: 6_999_999_999 }, PROVIDER);
    assert.equal((await respond(bookingId, fits.body.amendments.pending.id, "accept", CUSTOMER_A)).status, 200);
    assert.deepEqual((await ledger(bookingId)).map((row: { source: string }) => row.source), ["provider_recorded", "amendment"]);
    assert.equal((await billing(bookingId)).body.summary.obligationCents, CEILING, "exactly at the ceiling");
  });

  test("charge ceiling: an amendment-generated charge racing a manual charge near the ceiling cannot take the obligation past it", async () => {
    for (let round = 0; round < 4; round += 1) {
      const bookingId = await bigBooking(6_000_000_000);
      await adjust(bookingId, { kind: "charge", amountCents: 2_000_000_000 });
      const created = await propose(bookingId, { priceCents: 7_500_000_000 }, PROVIDER);
      const [accepted, manual] = await Promise.all([respond(bookingId, created.body.amendments.pending.id, "accept", CUSTOMER_A), adjust(bookingId, { kind: "charge", amountCents: 1_500_000_000 })]);
      const wins = [accepted.status === 200, manual.status === 201].filter(Boolean).length;
      assert.equal(wins, 1, `exactly one fits: ${accepted.status}/${manual.status}`);
      assert.equal([409].includes(accepted.status) || [409].includes(manual.status), true);
      const obligation = (await billing(bookingId)).body.summary.obligationCents as number;
      assert.ok(obligation <= CEILING, `obligation ${obligation}`);
      const entries = await ledger(bookingId);
      assert.equal(entries.length, 2, "the first manual charge plus exactly one of the contenders");
      if (accepted.status === 200) assert.equal((await bookingRow(bookingId)).agreed_price, "75000000.00");
      else assert.equal((await bookingRow(bookingId)).agreed_price, "60000000.00", "a refused acceptance leaves the price alone");
    }
  });

  test("charge ceiling: an exact idempotent retry of an accepted charge near the ceiling stays a duplicate, not a second charge", async () => {
    const bookingId = await bigBooking();
    const body = { kind: "charge", amountCents: 3_999_999_999, reason: "To the ceiling", idempotencyKey: "retry-at-ceiling-1" };
    assert.equal((await adjust(bookingId, body)).status, 201);
    const retry = await adjust(bookingId, body);
    assert.deepEqual([retry.status, retry.body.duplicate], [200, true], "answered from what happened, not re-judged against a ceiling it now sits at");
    assert.equal((await ledger(bookingId)).length, 1);
  });

  // ------------------------------------------------------------------------------------------------ fixed deposit basis (Codex 8)
  const saveTerms = (bookingId: string, body: Record<string, unknown>) => call("PUT", `/bookings/${bookingId}/billing/deposit-terms`, tok(PROVIDER), body);
  const termsVersion = async (bookingId: string) => (await billing(bookingId)).body.terms.updatedAt as string | null;

  test("fixed deposit: validated against the CURRENT obligation, so a charge makes a larger deposit valid and one cent past it is refused", async () => {
    const bookingId = await confirmed({ priceCents: 100000, guestCount: 10, note: "x" });
    assert.equal((await adjust(bookingId, { kind: "charge", amountCents: 20000 })).status, 201);
    assert.equal((await billing(bookingId)).body.summary.obligationCents, 120000);
    const ok = await saveTerms(bookingId, { mode: "fixed", amount: "1100" });
    assert.equal(ok.status, 200, ok.text);
    assert.equal(ok.body.terms.requiredCents, 110000);
    const exact = await saveTerms(bookingId, { mode: "fixed", amount: "1200", expectedUpdatedAt: ok.body.terms.updatedAt });
    assert.equal(exact.status, 200, "equal to the obligation is allowed");
    const over = await saveTerms(bookingId, { mode: "fixed", amount: "1201", expectedUpdatedAt: exact.body.terms.updatedAt });
    assert.deepEqual([over.status, over.body.code], [409, "catering_billing_state"]);
    assert.match(over.body.message, /cannot be more than what your customer owes/);
    const kept = (await billing(bookingId)).body;
    assert.deepEqual([kept.terms.amountCents, kept.terms.requiredCents], [120000, 120000], "the refused save changed nothing");
  });

  test("fixed deposit: preview, validation, serialization and the issued invoice share one basis", async () => {
    const bookingId = await confirmed({ priceCents: 100000, guestCount: 10, note: "x" });
    await adjust(bookingId, { kind: "charge", amountCents: 20000 });
    const saved = await saveTerms(bookingId, { mode: "fixed", amount: "1100" });
    const view = (await billing(bookingId)).body;
    assert.deepEqual([saved.body.terms.requiredCents, view.terms.requiredCents, view.summary.depositRequiredCents, view.issuablePreview.find((row: { kind: string }) => row.kind === "deposit").amountCents], [110000, 110000, 110000, 110000]);
    const issued = await issue(bookingId, "deposit");
    assert.equal(issued.status, 200, issued.text);
    assert.equal(issued.body.invoices[0].amountCents, 110000);
  });

  test("fixed deposit: a credit lowers the ceiling, and reversals move it back exactly", async () => {
    const credited = await confirmed({ priceCents: 100000, guestCount: 10, note: "x" });
    const credit = await adjust(credited, { kind: "credit", amountCents: 20000 });
    assert.equal((await saveTerms(credited, { mode: "fixed", amount: "900" })).status, 409, "obligation is 800");
    assert.equal((await saveTerms(credited, { mode: "fixed", amount: "800" })).status, 200, "equal to the obligation");
    assert.equal((await saveTerms(credited, { mode: "fixed", amount: "800.01", expectedUpdatedAt: await termsVersion(credited) })).status, 409);
    await reverse(credited, credit.body.adjustments[0].id);
    assert.equal((await saveTerms(credited, { mode: "fixed", amount: "900", expectedUpdatedAt: await termsVersion(credited) })).status, 200, "a reversed credit restores the room");
    const charged = await confirmed({ priceCents: 100000, guestCount: 10, note: "x" }, { customer: CUSTOMER_B });
    const charge = await adjust(charged, { kind: "charge", amountCents: 20000 });
    await reverse(charged, charge.body.adjustments[0].id);
    assert.equal((await saveTerms(charged, { mode: "fixed", amount: "1100" })).status, 409, "a reversed charge no longer raises the ceiling");
    assert.equal((await saveTerms(charged, { mode: "fixed", amount: "1000" })).status, 200);
  });

  test("fixed deposit: a legacy booking with no adjustments behaves exactly as before, and a percentage stays coherent with the same basis", async () => {
    const bookingId = await confirmed({ priceCents: 100000, guestCount: 10, note: "x" });
    assert.equal((await saveTerms(bookingId, { mode: "fixed", amount: "1000" })).status, 200);
    assert.equal((await saveTerms(bookingId, { mode: "fixed", amount: "1000.01", expectedUpdatedAt: await termsVersion(bookingId) })).status, 409);
    await adjust(bookingId, { kind: "charge", amountCents: 20000 });
    const pct = await saveTerms(bookingId, { mode: "percentage", percent: "50", expectedUpdatedAt: await termsVersion(bookingId) });
    assert.equal(pct.body.terms.requiredCents, 60000, "50% of 1,200");
    assert.equal((await billing(bookingId)).body.issuablePreview.find((row: { kind: string }) => row.kind === "deposit").amountCents, 60000);
    assert.equal((await issue(bookingId, "deposit")).body.invoices[0].amountCents, 60000);
  });

  // ------------------------------------------------------------------------------------------------ per-entry reversibility (Codex 9)
  const entryView = async (bookingId: string, id: string, who = PROVIDER) => ((await billing(bookingId, who)).body.adjustments as { id: string; reversible?: boolean; reversalBlockedReason?: string | null; status: string }[]).find((row) => row.id === id)!;
  const sideEffects = async (bookingId: string) => JSON.stringify([await ledger(bookingId), await bookingRow(bookingId), await rows("catering_booking_invoices", bookingId), await rows("catering_booking_payments", bookingId), await notificationCount()]);

  test("reversibility: a simple live charge is reversible, and the customer is never given the flag", async () => {
    const { bookingId } = await billed();
    const charge = await adjust(bookingId, { kind: "charge", amountCents: 1000 });
    const id = charge.body.adjustments[0].id as string;
    assert.deepEqual([(await entryView(bookingId, id)).reversible, (await entryView(bookingId, id)).reversalBlockedReason], [true, null]);
    const customer = await entryView(bookingId, id, CUSTOMER_A);
    assert.equal("reversible" in customer || "reversalBlockedReason" in customer, false, "no provider authority is offered to a customer");
    assert.equal((await reverse(bookingId, id, CUSTOMER_A)).status, 403, "and a customer's POST is refused whatever the flag says");
  });

  test("reversibility: a charge an unpaid request depends on is NOT reversible in the view and the POST agrees, with zero side effects", async () => {
    const { bookingId } = await billed("2500.00");
    const charge = await adjust(bookingId, { kind: "charge", amountCents: 40000 });
    const id = charge.body.adjustments[0].id as string;
    assert.equal((await entryView(bookingId, id)).reversible, true, "before any request depends on it");
    assert.equal((await issue(bookingId, "adjustment")).status, 200);
    const blocked = await entryView(bookingId, id);
    assert.equal(blocked.reversible, false);
    assert.match(blocked.reversalBlockedReason ?? "", /Withdraw that request first/);
    const before = await sideEffects(bookingId);
    const post = await reverse(bookingId, id);
    assert.deepEqual([post.status, post.body.code], [409, "catering_billing_state"], "view and endpoint agree");
    assert.equal(await sideEffects(bookingId), before, "no ledger, booking, invoice, payment or notification change");
  });

  test("reversibility: a stale view that showed a charge as reversible is re-judged under the lock by the POST", async () => {
    const { bookingId } = await billed("2500.00");
    const charge = await adjust(bookingId, { kind: "charge", amountCents: 40000 });
    const id = charge.body.adjustments[0].id as string;
    const stale = await entryView(bookingId, id);
    assert.equal(stale.reversible, true, "what the screen was holding");
    await issue(bookingId, "adjustment");
    const before = await sideEffects(bookingId);
    const post = await reverse(bookingId, id);
    assert.equal(post.status, 409, post.text);
    assert.equal(await sideEffects(bookingId), before);
    assert.equal((await entryView(bookingId, id)).reversible, false, "the refreshed view now tells the truth");
  });

  test("reversibility: a credit is reversible while the ceiling holds and not when it would not; a refund likewise follows the dependent request", async () => {
    const bookingId = await bigBooking();
    const credit = await adjust(bookingId, { kind: "credit", amountCents: 1_000_000_000 });
    const creditId = credit.body.adjustments[0].id as string;
    assert.equal((await entryView(bookingId, creditId)).reversible, true);
    const charge = await adjust(bookingId, { kind: "charge", amountCents: 4_999_999_999 });
    const blocked = await entryView(bookingId, creditId);
    assert.deepEqual([blocked.reversible, /largest amount ChefSire can request/.test(blocked.reversalBlockedReason ?? "")], [false, true]);
    assert.equal((await reverse(bookingId, creditId)).status, 409, "parity with the view");
    assert.equal((await entryView(bookingId, charge.body.adjustments[1].id)).reversible, true, "the charge beside it is still reversible");
    const refunds = await billed("2500.00");
    const refund = await adjust(refunds.bookingId, { kind: "refund", amountCents: 30000 });
    const refundId = refund.body.adjustments[0].id as string;
    assert.equal((await entryView(refunds.bookingId, refundId)).reversible, true);
    await issue(refunds.bookingId, "adjustment");
    assert.equal((await entryView(refunds.bookingId, refundId)).reversible, false, "the request that covers the refund depends on it");
    assert.equal((await reverse(refunds.bookingId, refundId)).status, 409);
  });

  test("reversibility: a reversed entry, an amendment-generated entry, and entries the booking's status forbids are not reversible, with a reason where one helps", async () => {
    const { bookingId } = await billed();
    const charge = await adjust(bookingId, { kind: "charge", amountCents: 1000 });
    const id = charge.body.adjustments[0].id as string;
    await reverse(bookingId, id);
    assert.deepEqual([(await entryView(bookingId, id)).reversible, (await entryView(bookingId, id)).reversalBlockedReason], [false, null], "a reversed entry is history");
    const created = await propose(bookingId, { priceCents: 290000 }, PROVIDER);
    await respond(bookingId, created.body.amendments.pending.id, "accept", CUSTOMER_A);
    const fromAmendment = ((await billing(bookingId)).body.adjustments as { source: string; id: string }[]).find((row) => row.source === "amendment")!;
    const amendmentView = await entryView(bookingId, fromAmendment.id);
    assert.equal(amendmentView.reversible, false);
    assert.match(amendmentView.reversalBlockedReason ?? "", /Propose another amendment/);
    const completed = await billed("2500.00");
    const credit = await adjust(completed.bookingId, { kind: "credit", amountCents: 1000 });
    const completedCharge = await adjust(completed.bookingId, { kind: "charge", amountCents: 1000 });
    await setStatus(completed.bookingId, "completed");
    assert.equal((await entryView(completed.bookingId, credit.body.adjustments[0].id)).reversible, false, "after completion a credit cannot be undone");
    assert.equal((await entryView(completed.bookingId, completedCharge.body.adjustments[1].id)).reversible, true, "but a charge can");
    await setStatus(completed.bookingId, "cancelled");
    assert.equal((await entryView(completed.bookingId, completedCharge.body.adjustments[1].id)).reversible, false);
  });

  test("reversibility: whatever the view says, the POST agrees across a sweep of states, and a successful reversal appends nothing and deletes nothing", async () => {
    const { bookingId } = await billed("2500.00");
    await adjust(bookingId, { kind: "charge", amountCents: 10000 });
    await adjust(bookingId, { kind: "credit", amountCents: 5000 });
    await adjust(bookingId, { kind: "refund", amountCents: 3000 });
    let reversedOnce = false;
    for (const stage of ["before request", "after request"]) {
      const entries = (await billing(bookingId)).body.adjustments as { id: string; reversible: boolean; status: string }[];
      for (const entry of entries.filter((row) => row.status === "posted")) {
        const before = await sideEffects(bookingId);
        const countBefore = (await ledger(bookingId)).length;
        const flagged = (await entryView(bookingId, entry.id)).reversible;
        const post = await reverse(bookingId, entry.id);
        assert.equal(post.status, flagged ? 200 : 409, `${stage}: ${entry.id} flagged ${flagged}`);
        if (flagged) {
          reversedOnce = true;
          assert.equal((await ledger(bookingId)).length, countBefore, "history is append-only: a reversal adds and removes no row");
          assert.equal((await entryView(bookingId, entry.id)).status, "reversed", "still visible");
        } else assert.equal(await sideEffects(bookingId), before, "a blocked reversal changes nothing");
      }
      if (stage === "before request") {
        const requestable = (await billing(bookingId)).body.issuable as string[];
        if (requestable.includes("adjustment")) await issue(bookingId, "adjustment");
      }
    }
    assert.equal(reversedOnce, true);
  });

  // ------------------------------------------------------------------------------------------------ request coverage (Codex 10)
  test("coverage: a credit already inside the balance request does not cancel a later charge ($1,000, -$200, $800 balance, +$200 => a $200 request)", async () => {
    const bookingId = await confirmed({ priceCents: 100000, guestCount: 10, note: "x" });
    assert.equal((await adjust(bookingId, { kind: "credit", amountCents: 20000 })).status, 201);
    const balance = await issue(bookingId, "balance");
    assert.equal(balance.status, 200, balance.text);
    assert.equal(balance.body.invoices[0].amountCents, 80000, "the balance request incorporates the credit");
    assert.deepEqual(balance.body.issuable, [], "nothing uncovered yet");
    const invoiceRow = (await rows("catering_booking_invoices", bookingId)).find((row: { id: string }) => row.id === balance.body.invoices[0].id);
    await adjust(bookingId, { kind: "charge", amountCents: 20000 });
    const view = (await billing(bookingId)).body;
    assert.deepEqual([view.summary.obligationCents, view.summary.balanceDueCents, view.issuable, view.issuablePreview], [100000, 100000, ["adjustment"], [{ kind: "adjustment", amountCents: 20000 }]]);
    const requested = await issue(bookingId, "adjustment");
    assert.equal(requested.status, 200, requested.text);
    assert.deepEqual(requested.body.invoices.map((row: { kind: string; amountCents: number }) => [row.kind, row.amountCents]), [["balance", 80000], ["adjustment", 20000]]);
    assert.equal(requested.body.summary.outstandingInvoicedCents, 100000);
    assert.deepEqual((await rows("catering_booking_invoices", bookingId)).find((row: { id: string }) => row.id === balance.body.invoices[0].id), invoiceRow, "no historical invoice mutation");
    assert.equal((await issue(bookingId, "adjustment")).status, 409, "a retry cannot request the same amount twice");
    assert.equal((await pay(bookingId, requested.body.invoices[1].id, "200.00")).status, 200);
    assert.equal((await pay(bookingId, requested.body.invoices[0].id, "800.00")).status, 200);
    assert.deepEqual([(await billing(bookingId)).body.summary.balanceDueCents, (await billing(bookingId)).body.summary.status], [0, "settled"]);
  });

  test("coverage: a charge inside the balance then a later credit needs no request; credits and reversals move the uncovered amount exactly", async () => {
    const included = await confirmed({ priceCents: 100000, guestCount: 10, note: "x" });
    await adjust(included, { kind: "charge", amountCents: 20000 });
    assert.equal((await issue(included, "balance")).body.invoices[0].amountCents, 120000);
    await adjust(included, { kind: "credit", amountCents: 20000 });
    assert.deepEqual((await billing(included)).body.issuable, []);
    const later = await confirmed({ priceCents: 100000, guestCount: 10, note: "x" }, { customer: CUSTOMER_B });
    const laterBalance = await issue(later, "balance");
    assert.equal((await pay(later, laterBalance.body.invoices[0].id, "1000.00")).status, 200, "paid, so no unpaid request depends on the obligation");
    const charge = await adjust(later, { kind: "charge", amountCents: 20000 });
    await adjust(later, { kind: "credit", amountCents: 5000 });
    assert.deepEqual((await billing(later)).body.issuablePreview, [{ kind: "adjustment", amountCents: 15000 }], "a later credit reduces it");
    assert.equal((await reverse(later, charge.body.adjustments[0].id)).status, 200);
    assert.deepEqual((await billing(later)).body.issuable, [], "a reversed later charge removes it");
  });

  test("coverage: a refund after the balance request remains requestable through the same rule, once", async () => {
    const { bookingId } = await billed("2500.00");
    await adjust(bookingId, { kind: "refund", amountCents: 30000 });
    assert.deepEqual((await billing(bookingId)).body.issuablePreview, [{ kind: "adjustment", amountCents: 30000 }]);
    await adjust(bookingId, { kind: "charge", amountCents: 20000 });
    assert.deepEqual((await billing(bookingId)).body.issuablePreview, [{ kind: "adjustment", amountCents: 50000 }], "each counted once");
    const issued = await issue(bookingId, "adjustment");
    assert.equal(issued.body.invoices[1].amountCents, 50000);
    assert.deepEqual(issued.body.issuable, []);
  });

  test("coverage: concurrent requests, a charge racing a request, and a reversal racing a request all end with every cent covered exactly once", async () => {
    const make = async () => {
      const bookingId = await confirmed({ priceCents: 100000, guestCount: 10, note: "x" });
      await adjust(bookingId, { kind: "credit", amountCents: 20000 });
      await issue(bookingId, "balance");
      return bookingId;
    };
    const covered = async (bookingId: string) => {
      const view = (await billing(bookingId)).body;
      const asked = view.invoices.filter((row: { status: string }) => row.status === "issued").reduce((sum: number, row: { amountCents: number }) => sum + row.amountCents, 0);
      const requestable = (view.issuablePreview as { amountCents: number }[]).reduce((sum, row) => sum + row.amountCents, 0);
      return { asked, requestable, obligation: view.summary.obligationCents as number, view };
    };
    const first = await make();
    await adjust(first, { kind: "charge", amountCents: 20000 });
    const many = await Promise.all([issue(first, "adjustment"), issue(first, "adjustment"), issue(first, "adjustment")]);
    assert.deepEqual(many.map((response) => response.status).sort(), [200, 409, 409]);
    assert.equal((await covered(first)).asked, 100000);
    const second = await make();
    const [raced, charged] = await Promise.all([issue(second, "adjustment"), adjust(second, { kind: "charge", amountCents: 20000 })]);
    assert.equal(charged.status, 201);
    assert.ok([200, 409].includes(raced.status));
    const afterRace = await covered(second);
    assert.equal(afterRace.asked + afterRace.requestable, afterRace.obligation, "whichever committed first, the obligation is covered exactly once");
    const third = await make();
    const charge = await adjust(third, { kind: "charge", amountCents: 20000 });
    const [revert, request] = await Promise.all([reverse(third, charge.body.adjustments[0].id), issue(third, "adjustment")]);
    assert.ok([revert.status, request.status].filter((status) => status === 200).length >= 1);
    const settled = await covered(third);
    const reversed = (await ledger(third))[1].status === "reversed";
    assert.equal(reversed && settled.asked > settled.obligation, false, "never a live request for a reversed charge");
    assert.ok(settled.asked <= settled.obligation + 0);
  });

  // ------------------------------------------------------------------------------------------------ agreed vs adjusted (Codex 11)
  test("agreed remainder and adjusted amount due are different figures, over HTTP, for both participants", async () => {
    const bookingId = await confirmed({ priceCents: 100000, guestCount: 10, note: "x" });
    await issue(bookingId, "balance");
    const plain = (await billing(bookingId, CUSTOMER_A)).body.summary;
    assert.deepEqual([plain.remainingOfAgreedCents, plain.balanceDueCents], [100000, 100000]);
    await adjust(bookingId, { kind: "charge", amountCents: 20000 });
    const invoiceId = (await billing(bookingId)).body.invoices[0].id as string;
    assert.equal((await pay(bookingId, invoiceId, "300.00")).status, 200);
    for (const who of [PROVIDER, CUSTOMER_A]) {
      const { summary } = (await billing(bookingId, who)).body;
      assert.deepEqual([summary.agreedTotalCents, summary.remainingOfAgreedCents, summary.obligationCents, summary.balanceDueCents], [100000, 70000, 120000, 90000], who);
      assert.ok(summary.remainingOfAgreedCents <= summary.agreedTotalCents);
    }
  });

  // ------------------------------------------------------------------------------------------------ payment take-back (Codex 12)
  const payView = async (bookingId: string, id: string, who = PROVIDER) => ((await billing(bookingId, who)).body.payments as { id: string; voidable?: boolean; voidBlockedReason?: string | null; status: string }[]).find((row) => row.id === id)!;
  const takeBack = (bookingId: string, id: string, who = PROVIDER) => call("POST", `/bookings/${bookingId}/billing/payments/${id}/void`, tok(who), {});

  test("take-back: a simple payment is voidable and the customer is never given the flag or the control", async () => {
    const { bookingId, a } = await twoPayments();
    assert.deepEqual([(await payView(bookingId, a)).voidable, (await payView(bookingId, a)).voidBlockedReason], [true, null]);
    const customer = await payView(bookingId, a, CUSTOMER_A);
    assert.equal("voidable" in customer || "voidBlockedReason" in customer, false);
    assert.equal((await takeBack(bookingId, a, CUSTOMER_A)).status, 403);
  });

  test("take-back: a payment a refund names is blocked in the view and by the endpoint, with no side effects; a reversed refund frees it", async () => {
    const { bookingId, a, b } = await twoPayments();
    const refund = await adjust(bookingId, { kind: "refund", amountCents: 5000, paymentId: a });
    const blocked = await payView(bookingId, a);
    assert.equal(blocked.voidable, false);
    assert.match(blocked.voidBlockedReason ?? "", /refund has been recorded against this payment/i);
    assert.equal((await payView(bookingId, b)).voidable, true, "the other payment is safe");
    const before = await sideEffects(bookingId);
    assert.equal((await takeBack(bookingId, a)).status, 409);
    assert.equal(await sideEffects(bookingId), before, "no payment, ledger, booking or notification change");
    await reverse(bookingId, refund.body.adjustments[0].id);
    assert.equal((await payView(bookingId, a)).voidable, true, "a reversed refund no longer blocks");
    assert.equal((await takeBack(bookingId, a)).status, 200);
    assert.deepEqual([(await payView(bookingId, a)).voidable, (await payView(bookingId, a)).status], [false, "voided"], "a voided payment is not actionable");
  });

  test("take-back: aggregate refunds that need the money block every payment that would leave them uncovered, and only the safe ones stay voidable", async () => {
    const { bookingId, a, b } = await twoPayments();
    await adjust(bookingId, { kind: "refund", amountCents: 15000 });
    assert.deepEqual([(await payView(bookingId, a)).voidable, (await payView(bookingId, b)).voidable], [false, false], "each leaves only $100 to cover a $150 refund");
    assert.match((await payView(bookingId, a)).voidBlockedReason ?? "", /Refunds are recorded against money received/);
    assert.equal((await takeBack(bookingId, a)).status, 409);
    const small = await twoPayments();
    await adjust(small.bookingId, { kind: "refund", amountCents: 5000 });
    assert.deepEqual([(await payView(small.bookingId, small.a)).voidable, (await payView(small.bookingId, small.b)).voidable], [true, true], "$100 still covers a $50 refund");
    assert.equal((await takeBack(small.bookingId, small.a)).status, 200);
    assert.equal((await payView(small.bookingId, small.b)).voidable, false, "now B is the money the refund relies on");
    assert.equal((await takeBack(small.bookingId, small.b)).status, 409, "so voiding both can never leave refunds exceeding what was received");
  });

  test("take-back: a view that showed a payment voidable is re-judged by the endpoint after a refund commits, with no side effects", async () => {
    const { bookingId, a } = await twoPayments();
    assert.equal((await payView(bookingId, a)).voidable, true, "the stale screen");
    await adjust(bookingId, { kind: "refund", amountCents: 5000, paymentId: a });
    const before = await sideEffects(bookingId);
    const post = await takeBack(bookingId, a);
    assert.deepEqual([post.status, post.body.code], [409, "catering_billing_state"]);
    assert.equal(await sideEffects(bookingId), before);
  });

  test("take-back: a take-back racing a refund that names the payment, and two take-backs racing an aggregate refund, never leave refunds uncovered", async () => {
    const one = await twoPayments();
    const [voided, refunded] = await Promise.all([takeBack(one.bookingId, one.a), adjust(one.bookingId, { kind: "refund", amountCents: 5000, paymentId: one.a })]);
    assert.equal([voided.status === 200, refunded.status === 201].filter(Boolean).length, 1, `exactly one wins: ${voided.status}/${refunded.status}`);
    const named = (await ledger(one.bookingId)).filter((row: { payment_id: string | null; status: string }) => row.payment_id === one.a && row.status === "posted").length;
    const aVoided = (await payView(one.bookingId, one.a)).status === "voided";
    assert.equal(aVoided && named > 0, false, "never a voided payment with a live refund naming it");
    const two = await twoPayments();
    await adjust(two.bookingId, { kind: "refund", amountCents: 5000 });
    const results = await Promise.all([takeBack(two.bookingId, two.a), takeBack(two.bookingId, two.b)]);
    assert.deepEqual(results.map((response) => response.status).sort(), [200, 409]);
    const view = (await billing(two.bookingId)).body;
    assert.ok(view.summary.paidTotalCents >= view.summary.refundsRecordedCents, "recorded payments still cover recorded refunds");
  });

  test("take-back: a cancelled booking's payments are not offered for take-back, and the endpoint agrees", async () => {
    const { bookingId, a } = await twoPayments();
    await setStatus(bookingId, "cancelled");
    const view = await payView(bookingId, a);
    assert.deepEqual([view.voidable, /cancelled/.test(view.voidBlockedReason ?? "")], [false, true]);
    assert.equal((await takeBack(bookingId, a)).status, 409);
  });

  // ------------------------------------------------------------------------------------------------ the formula
  test("the derived position is exact: original + charges - credits = obligation, payments - refunds = net received, obligation - net = balance", async () => {
    const { bookingId } = await billed();
    await adjust(bookingId, { kind: "charge", amountCents: 40000 });
    await adjust(bookingId, { kind: "credit", amountCents: 20000 });
    await adjust(bookingId, { kind: "refund", amountCents: 30000 });
    const { summary } = (await billing(bookingId)).body;
    assert.deepEqual(
      [summary.originalAgreedCents, summary.adjustmentChargesCents, summary.adjustmentCreditsCents, summary.obligationCents, summary.paidTotalCents, summary.refundsRecordedCents, summary.netReceivedCents, summary.balanceDueCents, summary.refundPotentiallyDueCents],
      [250000, 40000, 20000, 270000, 100000, 30000, 70000, 200000, 0]);
    assert.equal(summary.originalAgreedCents + summary.adjustmentChargesCents - summary.adjustmentCreditsCents, summary.obligationCents);
    assert.equal(summary.paidTotalCents - summary.refundsRecordedCents, summary.netReceivedCents);
    assert.equal(summary.obligationCents - summary.netReceivedCents, summary.balanceDueCents);
  });

  test("a payment may not take the customer past what they now owe after a credit", async () => {
    const { bookingId, invoiceId } = await billed("0");
    await adjust(bookingId, { kind: "credit", amountCents: 20000 });
    const view = (await billing(bookingId)).body;
    assert.equal(view.summary.outstandingInvoicedCents, 230000, "an old request never asks for more than is owed");
    assert.equal(view.summary.nextAmountDueCents, 230000);
    const over = await pay(bookingId, invoiceId, "2400.00");
    assert.equal(over.status, 409, over.text);
    assert.equal((await pay(bookingId, invoiceId, "2300.00")).status, 200);
  });

  // ------------------------------------------------------------------------------------------------ the database
  test("migration: additive and idempotent, fabricates nothing, and the database itself refuses rewritten, deleted or malformed entries", async () => {
    const { bookingId } = await billed();
    const before = [await rows("catering_booking_invoices", bookingId), await rows("catering_booking_payments", bookingId)];
    await local.query(adjustmentMigration);
    await local.query(adjustmentMigration);
    assert.deepEqual([await rows("catering_booking_invoices", bookingId), await rows("catering_booking_payments", bookingId)], before);
    assert.equal((await ledger(bookingId)).length, 0);
    const created = await adjust(bookingId, { kind: "charge", amountCents: 1000 });
    const id = created.body.adjustments[0].id;
    await assert.rejects(local.query(`DELETE FROM catering_booking_adjustments WHERE id = $1`, [id]), /never deleted/);
    for (const column of ["amount_cents = 2", "reason = 'x'", "currency = 'EUR'", "entry_kind = 'credit'", "booking_id = booking_id", "recorded_by = 'customer-a'", "idempotency_key = 'x-key-12345'"]) {
      if (column === "booking_id = booking_id") continue;
      await assert.rejects(local.query(`UPDATE catering_booking_adjustments SET ${column} WHERE id = $1`, [id]), /immutable|violates/, column);
    }
    await local.query(`UPDATE catering_booking_adjustments SET status = 'reversed', reversed_at = now(), reversed_by = $2, reversal_reason = 'ok' WHERE id = $1`, [id, PROVIDER]);
    await assert.rejects(local.query(`UPDATE catering_booking_adjustments SET status = 'posted', reversed_at = NULL, reversed_by = NULL, reversal_reason = NULL WHERE id = $1`, [id]), /immutable/, "a reversed entry cannot be revived");
    await assert.rejects(local.query(`UPDATE catering_booking_adjustments SET reversal_reason = 'rewritten' WHERE id = $1`, [id]), /immutable/);
    const insert = (columns: string, values: string) => local.query(`INSERT INTO catering_booking_adjustments (booking_id, amount_cents, currency, reason, recorded_by, ${columns}) VALUES ($1, 100, 'USD', 'r', $2, ${values})`, [bookingId, PROVIDER]);
    await assert.rejects(insert("entry_kind, source", `'charge', 'provider_recorded'`), /provenance/, "a provider entry needs its key");
    await assert.rejects(insert("entry_kind, source, idempotency_key", `'refund', 'amendment', 'k-0000001'`), /provenance/, "an amendment entry carries no key and is never a refund");
    await assert.rejects(insert("entry_kind, source, idempotency_key, reference", `'charge', 'provider_recorded', 'k-0000002', 'ref'`), /refund_columns/, "only a refund carries a reference");
    await assert.rejects(insert("entry_kind, source, idempotency_key", `'bonus', 'provider_recorded', 'k-0000003'`), /kind_check/);
    await assert.rejects(local.query(`INSERT INTO catering_booking_adjustments (booking_id, entry_kind, amount_cents, currency, reason, recorded_by, idempotency_key) VALUES ($1, 'charge', 0, 'USD', 'r', $2, 'k-0000004')`, [bookingId, PROVIDER]), /amount_check/);
    await assert.rejects(local.query(`INSERT INTO catering_booking_adjustments (booking_id, entry_kind, amount_cents, currency, reason, recorded_by, idempotency_key) VALUES ($1, 'charge', 100, 'usd', 'r', $2, 'k-0000005')`, [bookingId, PROVIDER]), /currency_check/);
    await assert.rejects(local.query(`INSERT INTO catering_booking_adjustments (booking_id, entry_kind, amount_cents, currency, reason, recorded_by, idempotency_key, status) VALUES ($1, 'charge', 100, 'USD', 'r', $2, 'k-0000006', 'reversed')`, [bookingId, PROVIDER]), /reversal_check/);
    await assert.rejects(local.query(`INSERT INTO catering_booking_adjustments (booking_id, entry_kind, amount_cents, currency, reason, recorded_by, idempotency_key) VALUES ($1, 'charge', 100, 'USD', 'r', $2, $3)`, [bookingId, PROVIDER, (await ledger(bookingId))[0].idempotency_key]), /idempotency_uidx/, "one row per attempt key");
    const columns = (await local.query(`SELECT column_name FROM information_schema.columns WHERE table_schema = current_schema() AND table_name = 'catering_booking_adjustments'`)).rows.map((row: { column_name: string }) => row.column_name);
    assert.equal(columns.some((name: string) => /processor|transaction|external_id/.test(name)), false, "nothing implies ChefSire verified or sent money");
  });

  test("the invoice kind check accepts `adjustment`, several may be live together, and a second balance still cannot be", async () => {
    const bookingId = await confirmed();
    const insert = (kind: string, number: number) => local.query(`INSERT INTO catering_booking_invoices (booking_id, invoice_number, invoice_kind, amount_cents, currency, status, issued_at) VALUES ($1, $2, $3, 100, 'USD', 'issued', now())`, [bookingId, number, kind]);
    await insert("balance", 1);
    await insert("adjustment", 2);
    await insert("adjustment", 3);
    await assert.rejects(insert("balance", 4), /catering_invoices_live_kind_uidx/);
    await assert.rejects(insert("surcharge", 5), /catering_invoice_kind_check/);
  });
}
