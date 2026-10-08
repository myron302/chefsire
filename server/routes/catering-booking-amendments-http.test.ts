/**
 * Phase 2O: post-confirmation booking amendments as real HTTP against the real catering routers, every rendered SQL statement
 * executed by a REAL PostgreSQL. Tables are built from the repository's own catering migrations, so the additive
 * negotiation migration (table, constraints, partial unique index and the immutability trigger) is exercised too.
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
  test("catering offer negotiation over HTTP (skipped: CATERING_TEST_PG_URL not set)", { skip: true }, () => {});
} else {
  // Its own schema, so this file can run beside the other real-Postgres catering suites that reset `public` in the same database.
  const SCHEMA = "catering_amendment_tests";
  const local = new pg.Pool({ ...parseLocalTestDatabaseUrl(PG_URL), options: `-c search_path=${SCHEMA}` });
  const { pool } = await import("../db/index");
  // A one-shot gate on the amendment-history read, applied to the connection itself so the production code carries no test hook:
  // when armed, the next SELECT from catering_booking_amendments announces that it has been reached and waits to be released.
  // That holds a GET between its booking read and its amendment read while a real writer commits on another connection.
  const gate: { armed: boolean; reached: () => void; release: Promise<void> | null } = { armed: false, reached: () => undefined, release: null };
  (pool as never as { connect: unknown }).connect = async () => {
    const client = await local.connect();
    const query = client.query.bind(client) as (...args: unknown[]) => unknown;
    (client as unknown as { query: unknown }).query = async (...args: unknown[]) => {
      const text = typeof args[0] === "string" ? args[0] : (args[0] as { text?: string })?.text ?? "";
      if (gate.armed && /^\s*select\b[\s\S]*\bfrom "catering_booking_amendments"/i.test(text)) {
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
  await local.query(sqlFile("server/migrations/20261006_catering_billing_adjustments.sql"));
  // Cancelling a booking now also closes its open Square checkouts (Phase 2Q), so that table must exist.
  await local.query(sqlFile("server/migrations/20261014_catering_square_payments.sql"));
  await local.query(sqlFile("server/migrations/20261015_catering_square_refund_review.sql"));

  const { default: cateringRouter } = await import("./catering");
  const { default: bookingsRouter } = await import("./catering-bookings");
  const { default: offersRouter } = await import("./catering-booking-offers");
  const { default: amendmentsRouter } = await import("./catering-booking-amendments");
  const { default: billingRouter } = await import("./catering-booking-billing");
  const app = express();
  app.use(express.json());
  app.use("/api/catering", cateringRouter);
  app.use("/api/catering", bookingsRouter);
  app.use("/api/catering", offersRouter);
  app.use("/api/catering", amendmentsRouter);
  app.use("/api/catering", billingRouter);
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
    await local.query(`TRUNCATE notifications, catering_booking_adjustments, catering_booking_amendments, catering_offer_revisions, catering_availability_exceptions, catering_booking_payments, catering_booking_invoices, catering_booking_billing, catering_booking_activity, catering_booking_details, catering_bookings, catering_inquiries, users CASCADE`);
    await local.query(`INSERT INTO users (id, username, display_name) VALUES ($1, 'ann', 'Ann A'), ($2, 'bob', 'Bob B'), ($3, 'chef1', 'Chef One'), ($4, 'chef2', NULL)`, [CUSTOMER_A, CUSTOMER_B, PROVIDER, OTHER_PROVIDER]);
  });


  // ------------------------------------------------------------------------------------------------ helpers
  /** A real confirmed booking: offer (revision 1) accepted by the customer through the real routes. */
  async function confirmed(terms: Record<string, unknown> = { priceCents: 250000, guestCount: 100, note: "Buffet for 100" }) {
    const made = await offered(terms);
    const accepted = await accept(made.bookingId, made.revisionId);
    assert.equal(accepted.status, 200, accepted.text);
    return made.bookingId;
  }
  const propose = (bookingId: string, changes: Record<string, unknown>, who = CUSTOMER_A, extra: Record<string, unknown> = {}) =>
    call("POST", `/bookings/${bookingId}/amendments`, tok(who), { expectedBaseAmendmentId: null, clientRequestId: randomUUID(), ...changes, ...extra });
  const respond = (bookingId: string, amendmentId: string, action: "accept" | "decline" | "withdraw", who: string, body: unknown = {}) =>
    call("POST", `/bookings/${bookingId}/amendments/${amendmentId}/${action}`, tok(who), body);
  const amendmentsView = async (bookingId: string, who = CUSTOMER_A) => (await call("GET", `/bookings/${bookingId}/amendments`, tok(who)));
  const amendmentRows = async (bookingId: string) => (await local.query(`SELECT * FROM catering_booking_amendments WHERE booking_id = $1 ORDER BY amendment_number`, [bookingId])).rows;
  const issueInvoice = (bookingId: string, status = "issued", amount = 50000) => local.query(
    `INSERT INTO catering_booking_invoices (booking_id, invoice_number, invoice_kind, amount_cents, currency, status, issued_at, voided_at, voided_by)
     VALUES ($1::varchar, (SELECT COALESCE(MAX(invoice_number), 0) + 1 FROM catering_booking_invoices WHERE booking_id = $1::varchar), 'deposit', $2, 'USD', $3::varchar, now(), ${status === "void" ? "now()" : "NULL"}, ${status === "void" ? `'${PROVIDER}'` : "NULL"})`, [bookingId, amount, status]);
  const blockDate = (date: string) => local.query(`INSERT INTO catering_availability_exceptions (provider_id, start_date, end_date, type) VALUES ($1, $2, $2, 'blocked')`, [PROVIDER, date]);

  // ------------------------------------------------------------------------------------------------ migration
  test("migration: additive and idempotent, fabricates no amendment, and the database refuses malformed or rewritten rows", async () => {
    const bookingId = await confirmed();
    const before = await bookingRow(bookingId);
    await local.query(amendmentMigration);
    await local.query(amendmentMigration);
    assert.deepEqual(await bookingRow(bookingId), before);
    assert.equal((await amendmentRows(bookingId)).length, 0, "no amendment is fabricated for a booking that predates the table");
    const insert = (fields: string, columns = "", values = "", status = "pending", extra = "") => local.query(
      `INSERT INTO catering_booking_amendments (booking_id, amendment_number, proposed_by_user_id, proposed_by_role, client_request_id, status, changed_fields, base_event_date, base_currency${columns}${extra ? `, ${extra.split("=")[0]}` : ""})
       VALUES ($1, $2, $3, 'customer', $4, '${status}', ARRAY[${fields}]::text[], '2099-05-20', 'USD'${values}${extra ? `, ${extra.split("=")[1]}` : ""})`, [bookingId, 10 + (sequence += 1), CUSTOMER_A, randomUUID()]);
    await assert.rejects(insert(""), /fields_check/);
    await assert.rejects(insert("'price_cents', 'bogus'", ", price_cents", ", 1"), /fields_check/);
    await assert.rejects(insert("'event_date'"), /event_date_check/);
    await assert.rejects(insert("'guest_count'", ", event_date", ", '2099-06-01'"), /event_date_check/);
    await assert.rejects(insert("'guest_count'", ", price_cents", ", 5"), /price_unlisted_check/);
    await assert.rejects(insert("'guest_count'", ", guest_count", ", 0"), /guest_check/);
    await assert.rejects(insert("'price_cents'", ", price_cents", ", -1"), /price_check/);
    await assert.rejects(insert("'currency'", ", currency", ", 'usd'"), /currency_check/);
    await assert.rejects(insert("'guest_count'", "", "", "accepted"), /response_check/);
    await insert("'guest_count'", ", guest_count", ", NULL"); // clearing a nullable term is a legal listed field with NULL
    await assert.rejects(insert("'guest_count'", "", ""), /pending_uidx/);
  });

  test("migration: a proposal is immutable, never deleted, and may be closed exactly once", async () => {
    const bookingId = await confirmed();
    const created = await propose(bookingId, { guestCount: 120 });
    assert.equal(created.status, 201, created.text);
    const [row] = await amendmentRows(bookingId);
    await assert.rejects(local.query(`UPDATE catering_booking_amendments SET guest_count = 999 WHERE id = $1`, [row.id]), /immutable/);
    await assert.rejects(local.query(`UPDATE catering_booking_amendments SET message = 'edited' WHERE id = $1`, [row.id]), /immutable/);
    await assert.rejects(local.query(`DELETE FROM catering_booking_amendments WHERE id = $1`, [row.id]), /never deleted/);
    await assert.rejects(local.query(`UPDATE catering_booking_amendments SET status = 'accepted', responded_by_user_id = $2, responded_at = now() WHERE id = $1`, [row.id, CUSTOMER_A]), /response_check/);
    await respond(bookingId, row.id, "decline", PROVIDER);
    await assert.rejects(local.query(`UPDATE catering_booking_amendments SET status = 'accepted' WHERE id = $1`, [row.id]), /immutable/);
  });

  // ---------------------------------------------------------------------------------------------- lifecycle
  test("a customer proposes: the booking is NOT changed, the provider sees a pending OLD -> NEW amendment, the proposer may withdraw but not accept", async () => {
    const bookingId = await confirmed();
    const before = await bookingRow(bookingId);
    const response = await propose(bookingId, { guestCount: 125, eventDate: "2099-06-02", message: "Family is bigger" });
    assert.equal(response.status, 201, response.text);
    assert.deepEqual(await bookingRow(bookingId), before, "a proposal never overwrites the authoritative terms");
    const mine = response.body.amendments;
    assert.equal(mine.pending.proposedBy, "customer");
    assert.deepEqual(mine.pending.changedFields, ["event_date", "guest_count"]);
    assert.equal(mine.pending.before.guestCount, 100);
    assert.equal(mine.pending.after.guestCount, 125);
    assert.equal(mine.pending.after.priceCents, 250000, "unchanged terms carry through unchanged");
    assert.deepEqual(mine.actions, { canPropose: false, canAccept: false, canDecline: false, canWithdraw: true });
    const theirs = (await amendmentsView(bookingId, PROVIDER)).body.amendments;
    assert.deepEqual(theirs.actions, { canPropose: false, canAccept: true, canDecline: true, canWithdraw: false });
    assert.equal(theirs.currentTerms.guestCount, 100);
    assert.equal(theirs.currentTerms.termsNote, "Buffet for 100", "the accepted offer's terms description is the starting point");
    const serialized = JSON.stringify(theirs);
    for (const secret of [CUSTOMER_A, PROVIDER, "client_request", "clientRequestId", "proposedByUserId", "respondedBy"]) assert.equal(serialized.includes(secret), false, `${secret} must not reach a client`);
    assert.equal((await notificationsFor(PROVIDER, "catering_amendment_proposed")).length, 1);
    const note = (await notificationsFor(PROVIDER, "catering_amendment_proposed"))[0];
    assert.equal(/125|2099|Family/.test(note.message + note.title), false, "a notification says that something happened, never what");
    assert.equal((await respond(bookingId, theirs.pending.id, "accept", CUSTOMER_A)).status, 403, "a proposer cannot approve their own amendment");
    assert.equal((await respond(bookingId, theirs.pending.id, "decline", CUSTOMER_A)).status, 403);
    assert.equal((await respond(bookingId, theirs.pending.id, "withdraw", PROVIDER)).status, 403, "only the proposer withdraws");
    assert.equal((await bookingRow(bookingId)).guest_count, 100);
  });

  test("the counterparty accepts: terms are applied to the booking atomically, history is kept, a retry is a no-op, and operational data is untouched", async () => {
    const bookingId = await confirmed();
    await local.query(`INSERT INTO catering_booking_details (booking_id, venue_name) VALUES ($1, 'The Barn')`, [bookingId]);
    const details = (await local.query(`SELECT * FROM catering_booking_details WHERE booking_id = $1`, [bookingId])).rows;
    const created = await propose(bookingId, { guestCount: 125, eventDate: "2099-06-02", priceCents: 290000, termsNote: "Buffet for 125, plus dessert" }, PROVIDER);
    assert.equal(created.status, 201, created.text);
    const id = created.body.amendments.pending.id;
    const accepted = await respond(bookingId, id, "accept", CUSTOMER_A);
    assert.equal(accepted.status, 200, accepted.text);
    const row = await bookingRow(bookingId);
    assert.deepEqual([row.event_date.toISOString?.().slice(0, 10) ?? row.event_date, row.guest_count, row.agreed_price, row.currency, row.status], ["2099-06-02", 125, "2900.00", "USD", "confirmed"]);
    assert.equal(accepted.body.amendments.currentTerms.termsNote, "Buffet for 125, plus dessert");
    assert.equal(accepted.body.amendments.pending, null);
    assert.equal(accepted.body.amendments.latestAcceptedAmendmentId, id);
    assert.equal(accepted.body.amendments.originalTerms.guestCount, 100, "the original confirmed terms stay visible");
    assert.deepEqual((await local.query(`SELECT * FROM catering_booking_details WHERE booking_id = $1`, [bookingId])).rows, details);
    const revisions = await revisionRows(bookingId);
    assert.equal(revisions.length, 1, "the Phase 2N history is not rewritten");
    assert.equal(revisions[0].price_cents, "250000");
    const stored = (await amendmentRows(bookingId))[0];
    assert.deepEqual([stored.status, stored.responded_by_user_id], ["accepted", CUSTOMER_A]);
    assert.equal(stored.base_event_date.toISOString?.().slice(0, 10) ?? stored.base_event_date, "2099-05-20");
    const again = await respond(bookingId, id, "accept", CUSTOMER_A);
    assert.equal(again.status, 200);
    assert.equal((await notificationsFor(PROVIDER, "catering_amendment_accepted")).length, 1, "the proposer is told once; the retry sends nothing");
    assert.equal((await notificationsFor(CUSTOMER_A, "catering_amendment_proposed")).length, 1);
    assert.equal((await notificationsFor(PROVIDER, "catering_amendment_declined")).length, 0);
    assert.equal((await respond(bookingId, id, "decline", CUSTOMER_A)).status, 409, "an answered amendment cannot be answered the other way");
    assert.equal((await respond(bookingId, id, "withdraw", PROVIDER)).status, 409, "an accepted amendment cannot be withdrawn");
  });

  test("decline and withdraw close the amendment without touching the booking, and the proposer is told", async () => {
    const bookingId = await confirmed();
    const before = await bookingRow(bookingId);
    const first = await propose(bookingId, { guestCount: 130 }, PROVIDER);
    assert.equal((await respond(bookingId, first.body.amendments.pending.id, "decline", CUSTOMER_A)).status, 200);
    assert.deepEqual(await bookingRow(bookingId), before);
    assert.equal((await notificationsFor(PROVIDER, "catering_amendment_declined")).length, 1);
    const second = await propose(bookingId, { guestCount: 140 }, CUSTOMER_A);
    assert.equal(second.status, 201, "a declined amendment frees the single pending slot");
    assert.equal((await respond(bookingId, second.body.amendments.pending.id, "withdraw", CUSTOMER_A)).status, 200);
    assert.equal((await notificationsFor(PROVIDER, "catering_amendment_withdrawn")).length, 1);
    assert.deepEqual(await bookingRow(bookingId), before);
    const history = (await amendmentsView(bookingId)).body.amendments.amendments;
    assert.deepEqual(history.map((a: { status: string }) => a.status), ["withdrawn", "declined"], "newest first, nothing deleted");
    assert.equal((await respond(bookingId, second.body.amendments.pending.id, "accept", PROVIDER)).status, 409);
    assert.equal((await bookingRow(bookingId)).guest_count, 100);
  });

  test("a retried proposal is one amendment and one notification", async () => {
    const bookingId = await confirmed();
    const clientRequestId = randomUUID();
    const one = await propose(bookingId, { guestCount: 120 }, CUSTOMER_A, { clientRequestId });
    const two = await propose(bookingId, { guestCount: 120 }, CUSTOMER_A, { clientRequestId });
    assert.deepEqual([one.status, two.status], [201, 200]);
    assert.equal((await amendmentRows(bookingId)).length, 1);
    assert.equal((await notificationsFor(PROVIDER, "catering_amendment_proposed")).length, 1);
  });

  // ------------------------------------------------------------------------------- one pending, staleness
  test("two simultaneous proposals: exactly one wins, the other gets a truthful conflict, and only one can ever be accepted", async () => {
    const bookingId = await confirmed();
    const results = await Promise.all([propose(bookingId, { guestCount: 110 }, CUSTOMER_A), propose(bookingId, { guestCount: 90 }, PROVIDER), propose(bookingId, { guestCount: 80 }, CUSTOMER_A)]);
    assert.deepEqual(results.map((r) => r.status).sort(), [201, 409, 409]);
    for (const loser of results.filter((r) => r.status === 409)) assert.equal(loser.body.code, "amendment_pending");
    const rows = await amendmentRows(bookingId);
    assert.equal(rows.length, 1);
    assert.equal(rows.filter((r: { status: string }) => r.status === "pending").length, 1);
  });

  test("a proposal made against terms that have since changed is refused as stale", async () => {
    const bookingId = await confirmed();
    const first = await propose(bookingId, { guestCount: 120 }, PROVIDER);
    await respond(bookingId, first.body.amendments.pending.id, "accept", CUSTOMER_A);
    const stale = await propose(bookingId, { guestCount: 150 }, CUSTOMER_A, { expectedBaseAmendmentId: null });
    assert.equal(stale.status, 409);
    assert.equal(stale.body.code, "stale_terms");
    const current = await propose(bookingId, { guestCount: 90 }, CUSTOMER_A, { expectedBaseAmendmentId: first.body.amendments.pending.id });
    assert.equal(current.status, 201, current.text);
    assert.equal(current.body.amendments.pending.before.guestCount, 120);
  });

  test("an acceptance is refused and the amendment closed when the booking's terms moved under it; the booking is never silently overwritten", async () => {
    const bookingId = await confirmed();
    const created = await propose(bookingId, { guestCount: 120 }, PROVIDER);
    await local.query(`UPDATE catering_bookings SET guest_count = 90 WHERE id = $1`, [bookingId]);
    const accepted = await respond(bookingId, created.body.amendments.pending.id, "accept", CUSTOMER_A);
    assert.equal(accepted.status, 409);
    assert.equal(accepted.body.code, "stale_terms");
    assert.equal((await bookingRow(bookingId)).guest_count, 90);
    assert.equal((await amendmentRows(bookingId))[0].status, "superseded");
    assert.equal((await propose(bookingId, { guestCount: 95 }, CUSTOMER_A)).status, 201, "the slot is free again");
  });

  test("a proposal that changes nothing is refused, and null versus absent is honoured for guest count, price and terms", async () => {
    const bookingId = await confirmed();
    const same = await propose(bookingId, { guestCount: 100, priceCents: 250000, currency: "USD", eventDate: "2099-05-20", termsNote: "Buffet for 100" }, PROVIDER);
    assert.deepEqual([same.status, same.body.code], [409, "no_change"]);
    const cleared = await propose(bookingId, { guestCount: null }, PROVIDER);
    assert.equal(cleared.status, 201, cleared.text);
    assert.deepEqual(cleared.body.amendments.pending.changedFields, ["guest_count"]);
    assert.equal(cleared.body.amendments.pending.after.guestCount, null);
    assert.equal(cleared.body.amendments.pending.after.priceCents, 250000, "absent keys never clear or restore anything");
    await respond(bookingId, cleared.body.amendments.pending.id, "accept", CUSTOMER_A);
    const row = await bookingRow(bookingId);
    assert.deepEqual([row.guest_count, row.agreed_price], [null, "2500.00"]);
    const next = await propose(bookingId, { termsNote: "" }, CUSTOMER_A, { expectedBaseAmendmentId: cleared.body.amendments.pending.id });
    assert.equal(next.status, 201, next.text);
    assert.equal(next.body.amendments.pending.after.termsNote, null, "a blank terms description clears it");
    assert.equal(next.body.amendments.pending.after.guestCount, null, "an explicit cleared guest count is not restored");
  });

  // --------------------------------------------------------------------------------------------- eligibility
  test("only a confirmed booking is amendable; pending offers stay Phase 2N, and completed or cancelled bookings are read-only", async () => {
    const open = await offered();
    const onOffer = await propose(open.bookingId, { guestCount: 120 });
    assert.deepEqual([onOffer.status, onOffer.body.code], [409, "amendment_closed"]);
    assert.equal((await amendmentRows(open.bookingId)).length, 0);

    const cancelledId = await confirmed();
    const pending = await propose(cancelledId, { guestCount: 120 });
    assert.equal((await call("POST", `/bookings/${cancelledId}/cancel`, tok(CUSTOMER_A), {})).status, 200);
    const afterCancel = await respond(cancelledId, pending.body.amendments.pending.id, "accept", PROVIDER);
    assert.deepEqual([afterCancel.status, afterCancel.body.code], [409, "amendment_closed"]);
    assert.equal((await bookingRow(cancelledId)).guest_count, 100);
    const cancelledView = (await amendmentsView(cancelledId, PROVIDER)).body.amendments;
    assert.deepEqual([cancelledView.pending, cancelledView.amendments[0].status, cancelledView.actions], [null, "superseded", { canPropose: false, canAccept: false, canDecline: false, canWithdraw: false }]);
    assert.equal((await propose(cancelledId, { guestCount: 5 })).body.code, "amendment_closed");

    const doneId = await confirmed();
    await local.query(`UPDATE catering_bookings SET event_date = '2020-01-01' WHERE id = $1`, [doneId]);
    await local.query(`UPDATE catering_bookings SET status = 'completed', completed_at = now() WHERE id = $1`, [doneId]);
    assert.equal((await propose(doneId, { guestCount: 5 }, PROVIDER)).body.code, "amendment_closed");
    assert.equal((await amendmentsView(doneId)).body.amendments.actions.canPropose, false);
  });

  test("only booking participants can see or act; a stranger, a wrong provider and a forged id all get the same 404", async () => {
    const bookingId = await confirmed();
    const created = await propose(bookingId, { guestCount: 120 });
    const id = created.body.amendments.pending.id;
    for (const who of [CUSTOMER_B, OTHER_PROVIDER]) {
      assert.equal((await amendmentsView(bookingId, who)).status, 404);
      assert.equal((await propose(bookingId, { guestCount: 7 }, who)).status, 404);
      assert.equal((await respond(bookingId, id, "accept", who)).status, 404);
      assert.equal((await respond(bookingId, id, "withdraw", who)).status, 404);
    }
    assert.equal((await call("GET", `/bookings/${bookingId}/amendments`)).status, 401);
    assert.equal((await respond(bookingId, randomUUID(), "accept", PROVIDER)).status, 404);
    assert.equal((await respond(bookingId, "not-a-uuid", "accept", PROVIDER)).status, 404);
    const other = await confirmed();
    assert.equal((await respond(other, id, "accept", PROVIDER)).status, 404, "an amendment id from another booking never resolves");
    assert.equal((await bookingRow(bookingId)).guest_count, 100);
  });

  test("the server allowlist: identity, ownership, lifecycle and package fields cannot be named, and nothing is written for a rejected body", async () => {
    const bookingId = await confirmed();
    for (const forged of [{ providerId: OTHER_PROVIDER }, { customerId: CUSTOMER_B }, { status: "cancelled" }, { id: randomUUID() }, { packageTitleSnapshot: "x" }, { packageId: randomUUID() }, { agreedPrice: 1 }, { confirmedAt: "2000-01-01" }, { proposedByUserId: PROVIDER }, { proposedByRole: "provider" }, { changedFields: ["status"] }]) {
      const response = await propose(bookingId, { guestCount: 120, ...forged });
      assert.equal(response.status, 400, JSON.stringify(forged));
    }
    for (const bad of [{}, { guestCount: 0 }, { guestCount: 1.5 }, { guestCount: 100001 }, { priceCents: -1 }, { priceCents: 12.5 }, { priceCents: 10_000_000_000 }, { eventDate: "2099-02-30" }, { eventDate: "tomorrow" }, { currency: "usd" }, { termsNote: "x".repeat(2001) }]) {
      assert.equal((await propose(bookingId, bad)).status, 400, JSON.stringify(bad));
    }
    assert.equal((await call("POST", `/bookings/${bookingId}/amendments`, tok(CUSTOMER_A), { guestCount: 120 })).status, 400, "a request id and a base are required");
    assert.equal((await respond(bookingId, randomUUID(), "accept", PROVIDER, { status: "accepted" })).status, 400, "a response carries no body");
    assert.equal((await amendmentRows(bookingId)).length, 0);
  });

  // ------------------------------------------------------------------------------------------------ billing
  test("billing: once the ledger is live, currency amendments and clearing the price fail closed at proposal; other terms stay legal", async () => {
    const bookingId = await confirmed();
    await issueInvoice(bookingId);
    const before = await bookingRow(bookingId);
    // Phase 2P: a price change between two stated amounts is no longer refused -- it is reconciled into the adjustment ledger
    // when it is accepted. A currency change (no conversion exists) and a price that is cleared (no stated difference to record)
    // still are.
    for (const change of [{ currency: "EUR" }, { priceCents: null }, { priceCents: 300000, currency: "EUR" }]) {
      const refused = await propose(bookingId, change, PROVIDER);
      assert.deepEqual([refused.status, refused.body.code], [409, "billing_terms_locked"], JSON.stringify(change));
    }
    assert.equal((await amendmentsView(bookingId)).body.amendments.billingTermsLocked, true);
    const allowed = await propose(bookingId, { guestCount: 130, termsNote: "Plus a cheese course", eventDate: "2099-07-01" }, PROVIDER);
    assert.equal(allowed.status, 201, allowed.text);
    assert.equal((await respond(bookingId, allowed.body.amendments.pending.id, "accept", CUSTOMER_A)).status, 200);
    const row = await bookingRow(bookingId);
    assert.deepEqual([row.guest_count, row.agreed_price, row.currency], [130, before.agreed_price, before.currency]);
    assert.equal(Number((await local.query(`SELECT count(*) FROM catering_booking_invoices WHERE booking_id = $1 AND amount_cents = 50000 AND status = 'issued'`, [bookingId])).rows[0].count), 1, "the invoice is untouched");
  });

  test("billing: a price amendment proposed BEFORE billing started is reconciled when accepted AFTER it; the invoice is untouched and one charge is recorded", async () => {
    const bookingId = await confirmed();
    const created = await propose(bookingId, { priceCents: 290000 }, PROVIDER);
    assert.equal(created.status, 201, created.text);
    await issueInvoice(bookingId);
    const accepted = await respond(bookingId, created.body.amendments.pending.id, "accept", CUSTOMER_A);
    assert.equal(accepted.status, 200, accepted.text);
    assert.equal((await bookingRow(bookingId)).agreed_price, "2900.00");
    assert.equal((await amendmentRows(bookingId))[0].status, "accepted");
    const entries = (await local.query(`SELECT entry_kind, source, amount_cents, amendment_id FROM catering_booking_adjustments WHERE booking_id = $1`, [bookingId])).rows;
    assert.deepEqual(entries.map((row: { entry_kind: string; source: string; amount_cents: string }) => [row.entry_kind, row.source, Number(row.amount_cents)]), [["charge", "amendment", 40000]]);
    assert.equal(Number((await local.query(`SELECT count(*) FROM catering_booking_invoices WHERE booking_id = $1 AND amount_cents = 50000 AND status = 'issued'`, [bookingId])).rows[0].count), 1, "the invoice is untouched");
  });

  test("billing: a voided invoice is not live ledger activity, and a price amendment converts cents to the booking's decimal exactly", async () => {
    const bookingId = await confirmed();
    await issueInvoice(bookingId, "void");
    const created = await propose(bookingId, { priceCents: 123457, currency: "EUR" }, PROVIDER);
    assert.equal(created.status, 201, created.text);
    await respond(bookingId, created.body.amendments.pending.id, "accept", CUSTOMER_A);
    const row = await bookingRow(bookingId);
    assert.deepEqual([row.agreed_price, row.currency], ["1234.57", "EUR"]);
    assert.equal((await amendmentsView(bookingId)).body.amendments.currentTerms.priceCents, 123457);
  });

  // -------------------------------------------------------------------------------------- availability
  test("event date: a past or explicitly blocked date is refused at proposal, and a block that appears later is honoured at acceptance", async () => {
    const bookingId = await confirmed();
    await blockDate("2099-08-01");
    for (const eventDate of ["2099-08-01", "2000-01-01"]) {
      const refused = await propose(bookingId, { eventDate }, PROVIDER);
      assert.deepEqual([refused.status, refused.body.code], [409, "date_unavailable"], eventDate);
    }
    const created = await propose(bookingId, { eventDate: "2099-09-01" }, CUSTOMER_A);
    assert.equal(created.status, 201, created.text);
    await blockDate("2099-09-01");
    const accepted = await respond(bookingId, created.body.amendments.pending.id, "accept", PROVIDER);
    assert.deepEqual([accepted.status, accepted.body.code], [409, "date_unavailable"]);
    const row = await bookingRow(bookingId);
    assert.equal((row.event_date.toISOString?.().slice(0, 10) ?? row.event_date), "2099-05-20");
    assert.equal((await respond(bookingId, created.body.amendments.pending.id, "decline", PROVIDER)).status, 200);
  });

  test("a non-date amendment is not blocked by the date, even if the booking's own date was blocked after confirmation", async () => {
    const bookingId = await confirmed();
    await blockDate("2099-05-20");
    const created = await propose(bookingId, { guestCount: 110 }, CUSTOMER_A);
    assert.equal(created.status, 201, created.text);
    assert.equal((await respond(bookingId, created.body.amendments.pending.id, "accept", PROVIDER)).status, 200);
    assert.equal((await bookingRow(bookingId)).guest_count, 110);
  });

  // ----------------------------------------------------------------------------- acceptance vs cancellation
  test("a cancellation racing an acceptance: the booking is either amended-then-cancelled or cancelled-and-unamended, never amended after cancellation", async () => {
    for (let round = 0; round < 6; round += 1) {
      const bookingId = await confirmed();
      const created = await propose(bookingId, { guestCount: 120 }, PROVIDER);
      const [accepted, cancelled] = await Promise.all([respond(bookingId, created.body.amendments.pending.id, "accept", CUSTOMER_A), call("POST", `/bookings/${bookingId}/cancel`, tok(CUSTOMER_A), {})]);
      const row = await bookingRow(bookingId);
      assert.equal(row.status, "cancelled", `round ${round}: ${accepted.text} / ${cancelled.text}`);
      if (accepted.status === 200) assert.equal(row.guest_count, 120);
      else { assert.equal(accepted.body.code, "amendment_closed"); assert.equal(row.guest_count, 100); }
    }
  });

  test("a response racing a withdrawal resolves to exactly one outcome", async () => {
    for (let round = 0; round < 6; round += 1) {
      const bookingId = await confirmed();
      const created = await propose(bookingId, { guestCount: 120 }, PROVIDER);
      const id = created.body.amendments.pending.id;
      const [accepted, withdrawn] = await Promise.all([respond(bookingId, id, "accept", CUSTOMER_A), respond(bookingId, id, "withdraw", PROVIDER)]);
      const [stored] = await amendmentRows(bookingId);
      assert.deepEqual([accepted.status, withdrawn.status].sort(), [200, 409]);
      assert.equal((await bookingRow(bookingId)).guest_count, stored.status === "accepted" ? 120 : 100);
    }
  });

  test("an amendment cannot be accepted twice by concurrent retries: the booking is written once", async () => {
    const bookingId = await confirmed();
    const created = await propose(bookingId, { guestCount: 120, priceCents: 260000 }, PROVIDER);
    const id = created.body.amendments.pending.id;
    const results = await Promise.all([1, 2, 3].map(() => respond(bookingId, id, "accept", CUSTOMER_A)));
    assert.deepEqual(results.map((r) => r.status), [200, 200, 200]);
    assert.equal(Number((await local.query(`SELECT count(*) FROM catering_booking_amendments WHERE booking_id = $1 AND status = 'accepted'`, [bookingId])).rows[0].count), 1);
    assert.equal((await bookingRow(bookingId)).agreed_price, "2600.00");
  });

  test("a later amendment shows the earlier accepted terms as OLD and keeps the whole history", async () => {
    const bookingId = await confirmed();
    const one = await propose(bookingId, { guestCount: 120 }, PROVIDER);
    await respond(bookingId, one.body.amendments.pending.id, "accept", CUSTOMER_A);
    const two = await propose(bookingId, { guestCount: 140, termsNote: "Updated" }, CUSTOMER_A, { expectedBaseAmendmentId: one.body.amendments.pending.id });
    await respond(bookingId, two.body.amendments.pending.id, "accept", PROVIDER);
    const history = (await amendmentsView(bookingId, PROVIDER)).body.amendments;
    assert.deepEqual(history.amendments.map((a: { amendmentNumber: number; status: string; before: { guestCount: number }; after: { guestCount: number } }) => [a.amendmentNumber, a.status, a.before.guestCount, a.after.guestCount]), [[2, "accepted", 120, 140], [1, "accepted", 100, 120]]);
    assert.equal(history.originalTerms.guestCount, 100);
    assert.equal(history.currentTerms.guestCount, 140);
    assert.equal(history.currentTerms.termsNote, "Updated");
  });


  // ------------------------------------------------------------------------------------------------ currency
  test("currency: either party can propose a legal currency change before billing; the counterparty sees USD -> EUR, accepting updates the booking atomically, and history keeps it", async () => {
    for (const [proposer, responder] of [[PROVIDER, CUSTOMER_A], [CUSTOMER_A, PROVIDER]] as const) {
      const bookingId = await confirmed();
      const created = await propose(bookingId, { currency: "EUR" }, proposer);
      assert.equal(created.status, 201, created.text);
      const seen = (await amendmentsView(bookingId, responder)).body.amendments.pending;
      assert.deepEqual([seen.changedFields, seen.before.currency, seen.after.currency, seen.after.priceCents], [["currency"], "USD", "EUR", 250000], "the receiving party is shown current -> proposed");
      assert.equal((await bookingRow(bookingId)).currency, "USD", "a proposal never changes the booking");
      assert.equal((await respond(bookingId, seen.id, "accept", responder)).status, 200);
      const row = await bookingRow(bookingId);
      assert.deepEqual([row.currency, row.agreed_price], ["EUR", "2500.00"]);
      const history = (await amendmentsView(bookingId, proposer)).body.amendments;
      assert.deepEqual([history.amendments[0].status, history.amendments[0].before.currency, history.amendments[0].after.currency, history.currentTerms.currency], ["accepted", "USD", "EUR", "EUR"]);
      const [stored] = await amendmentRows(bookingId);
      await assert.rejects(local.query(`UPDATE catering_booking_amendments SET currency = 'GBP' WHERE id = $1`, [stored.id]), /immutable/, "an accepted amendment's currency can never be rewritten");
    }
  });

  test("currency: price-only, currency-only, price+currency, and a currency change on an unpriced booking", async () => {
    const priced = await confirmed();
    const both = await propose(priced, { priceCents: 300000, currency: "EUR" }, PROVIDER);
    assert.deepEqual(both.body.amendments.pending.changedFields, ["price_cents", "currency"]);
    await respond(priced, both.body.amendments.pending.id, "accept", CUSTOMER_A);
    assert.deepEqual([(await bookingRow(priced)).agreed_price, (await bookingRow(priced)).currency], ["3000.00", "EUR"]);
    const priceOnly = await propose(priced, { priceCents: 310000 }, CUSTOMER_A, { expectedBaseAmendmentId: both.body.amendments.pending.id });
    assert.deepEqual(priceOnly.body.amendments.pending.changedFields, ["price_cents"], "the unchanged currency is not a change");

    const unpricedId = await confirmed({ guestCount: 100 });
    assert.equal((await bookingRow(unpricedId)).agreed_price, null);
    const currencyOnly = await propose(unpricedId, { currency: "EUR" }, PROVIDER);
    assert.equal(currencyOnly.status, 201, currencyOnly.text);
    assert.deepEqual([currencyOnly.body.amendments.pending.before.priceCents, currencyOnly.body.amendments.pending.after.priceCents], [null, null]);
    await respond(unpricedId, currencyOnly.body.amendments.pending.id, "accept", CUSTOMER_A);
    assert.deepEqual([(await bookingRow(unpricedId)).currency, (await bookingRow(unpricedId)).agreed_price], ["EUR", null]);
    const same = await propose(unpricedId, { currency: "EUR" }, PROVIDER, { expectedBaseAmendmentId: currencyOnly.body.amendments.pending.id });
    assert.deepEqual([same.status, same.body.code], [409, "no_change"], "unchanged null price and unchanged currency are no change");
  });

  test("currency: a declined currency amendment leaves the booking alone, and a stale one cannot overwrite newer terms", async () => {
    const declined = await confirmed();
    const one = await propose(declined, { currency: "EUR" }, CUSTOMER_A);
    assert.equal((await respond(declined, one.body.amendments.pending.id, "decline", PROVIDER)).status, 200);
    assert.equal((await bookingRow(declined)).currency, "USD");
    const kept = (await amendmentsView(declined)).body.amendments.amendments[0];
    assert.deepEqual([kept.status, kept.before.currency, kept.after.currency], ["declined", "USD", "EUR"]);

    const stale = await confirmed();
    const two = await propose(stale, { currency: "EUR" }, PROVIDER);
    await local.query(`UPDATE catering_bookings SET currency = 'GBP' WHERE id = $1`, [stale]);
    const accepted = await respond(stale, two.body.amendments.pending.id, "accept", CUSTOMER_A);
    assert.deepEqual([accepted.status, accepted.body.code, (await bookingRow(stale)).currency], [409, "stale_terms", "GBP"]);
  });

  test("currency: billing fails it closed at the API for both parties, at proposal and at acceptance, and a bad code is a 400", async () => {
    const bookingId = await confirmed();
    const pending = await propose(bookingId, { currency: "EUR" }, PROVIDER);
    await issueInvoice(bookingId);
    const lateAccept = await respond(bookingId, pending.body.amendments.pending.id, "accept", CUSTOMER_A);
    assert.deepEqual([lateAccept.status, lateAccept.body.code, (await bookingRow(bookingId)).currency], [409, "billing_terms_locked", "USD"]);
    await respond(bookingId, pending.body.amendments.pending.id, "withdraw", PROVIDER);
    for (const who of [PROVIDER, CUSTOMER_A]) {
      const refused = await propose(bookingId, { currency: "GBP" }, who);
      assert.deepEqual([refused.status, refused.body.code], [409, "billing_terms_locked"], who);
    }
    assert.equal((await amendmentsView(bookingId)).body.amendments.billingTermsLocked, true);
    for (const bad of ["eur", "EURO", ""]) assert.equal((await propose(bookingId, { currency: bad })).status, 400, bad);
    assert.equal((await bookingRow(bookingId)).currency, "USD");
  });

  // ------------------------------------------------------------------------------- consistent read snapshot
  /** Starts a GET, holds it between its booking read and its amendment read, runs `during` (a committed transition), then lets the GET finish. */
  async function readDuring(bookingId: string, who: string, during: () => Promise<unknown>) {
    let reached!: () => void;
    const arrived = new Promise<void>((resolve) => { reached = resolve; });
    let release!: () => void;
    gate.release = new Promise<void>((resolve) => { release = resolve; });
    gate.reached = reached;
    gate.armed = true;
    const pendingRead = amendmentsView(bookingId, who);
    await arrived;
    try { await during(); } finally { release(); }
    const read = await pendingRead;
    gate.armed = false;
    return read;
  }

  test("snapshot: authorized customer and provider reads work, and strangers keep the non-enumerating 404", async () => {
    const bookingId = await confirmed();
    for (const who of [CUSTOMER_A, PROVIDER]) {
      const read = await amendmentsView(bookingId, who);
      assert.equal(read.status, 200, read.text);
      assert.equal(read.body.amendments.role, who === PROVIDER ? "provider" : "customer");
    }
    const strangers = [(await amendmentsView(bookingId, CUSTOMER_B)), (await amendmentsView(bookingId, OTHER_PROVIDER)), (await call("GET", `/bookings/${randomUUID()}/amendments`, tok(CUSTOMER_A))), (await call("GET", `/bookings/not-a-uuid/amendments`, tok(CUSTOMER_A)))];
    assert.deepEqual(strangers.map((r) => r.status), [404, 404, 404, 404]);
    assert.equal(new Set(strangers.map((r) => r.text)).size, 1, "a foreign booking, a missing one and a malformed id are indistinguishable");
  });

  test("snapshot: before acceptance the view is wholly before, after acceptance it is wholly after", async () => {
    const bookingId = await confirmed();
    const created = await propose(bookingId, { guestCount: 125 }, PROVIDER);
    const before = (await amendmentsView(bookingId)).body.amendments;
    assert.deepEqual([before.pending.status, before.currentTerms.guestCount, before.actions.canAccept], ["pending", 100, true]);
    await respond(bookingId, created.body.amendments.pending.id, "accept", CUSTOMER_A);
    const after = (await amendmentsView(bookingId)).body.amendments;
    assert.deepEqual([after.pending, after.amendments[0].status, after.currentTerms.guestCount, after.latestAcceptedAmendmentId], [null, "accepted", 125, created.body.amendments.pending.id]);
  });

  test("snapshot: an acceptance committing between the booking read and the amendment read cannot produce accepted-amendment + old terms", async () => {
    for (const reader of [CUSTOMER_A, PROVIDER]) {
      const bookingId = await confirmed();
      const created = await propose(bookingId, { guestCount: 125, priceCents: 260000, termsNote: "New terms" }, PROVIDER);
      const id = created.body.amendments.pending.id;
      let accepted: Awaited<ReturnType<typeof respond>> | undefined;
      const read = await readDuring(bookingId, reader, async () => { accepted = await respond(bookingId, id, "accept", CUSTOMER_A); });
      assert.equal(accepted?.status, 200, "the writer really committed inside the GET's window");
      assert.equal((await bookingRow(bookingId)).guest_count, 125);
      const view = read.body.amendments;
      // The GET's snapshot predates the commit, so everything in it must be from before: never a mix.
      assert.deepEqual([view.pending?.status, view.amendments[0].status, view.currentTerms.guestCount, view.currentTerms.priceCents, view.currentTerms.termsNote, view.latestAcceptedAmendmentId, view.originalTerms?.guestCount],
        ["pending", "pending", 100, 250000, "Buffet for 100", null, 100]);
      assert.equal(view.actions.canAccept, reader === CUSTOMER_A);
      const next = (await amendmentsView(bookingId, reader)).body.amendments;
      assert.deepEqual([next.pending, next.amendments[0].status, next.currentTerms.guestCount, next.currentTerms.priceCents, next.currentTerms.termsNote], [null, "accepted", 125, 260000, "New terms"]);
    }
  });

  test("snapshot: a decline or a withdrawal committing mid-read leaves the view wholly pending", async () => {
    for (const [action, actor] of [["decline", CUSTOMER_A], ["withdraw", PROVIDER]] as const) {
      const bookingId = await confirmed();
      const created = await propose(bookingId, { guestCount: 125 }, PROVIDER);
      const id = created.body.amendments.pending.id;
      const read = await readDuring(bookingId, PROVIDER, async () => { assert.equal((await respond(bookingId, id, action, actor)).status, 200); });
      const view = read.body.amendments;
      assert.deepEqual([view.pending?.status, view.amendments.map((a: { status: string }) => a.status), view.currentTerms.guestCount, view.actions.canWithdraw, view.actions.canPropose], ["pending", ["pending"], 100, true, false], action);
      const next = (await amendmentsView(bookingId, PROVIDER)).body.amendments;
      assert.deepEqual([next.pending, next.amendments[0].status, next.currentTerms.guestCount, next.actions.canPropose], [null, action === "decline" ? "declined" : "withdrawn", 100, true], action);
    }
  });

  test("snapshot: a cancellation committing mid-read gives a wholly-confirmed view, and a view taken after it is wholly closed", async () => {
    const bookingId = await confirmed();
    const created = await propose(bookingId, { guestCount: 125 }, PROVIDER);
    const read = await readDuring(bookingId, CUSTOMER_A, async () => { assert.equal((await call("POST", `/bookings/${bookingId}/cancel`, tok(CUSTOMER_A), {})).status, 200); });
    const view = read.body.amendments;
    assert.deepEqual([view.bookingStatus, view.pending?.status, view.amendments[0].status, view.actions], ["confirmed", "pending", "pending", { canPropose: false, canAccept: true, canDecline: true, canWithdraw: false }]);
    const after = (await amendmentsView(bookingId, CUSTOMER_A)).body.amendments;
    assert.deepEqual([after.bookingStatus, after.pending, after.amendments[0].status, after.actions], ["cancelled", null, "superseded", { canPropose: false, canAccept: false, canDecline: false, canWithdraw: false }]);
    assert.equal(created.status, 201);
  });

  test("snapshot: a completion committing mid-read gives a wholly-confirmed view, and a view taken after it is wholly closed", async () => {
    const bookingId = await confirmed();
    await propose(bookingId, { guestCount: 125 }, CUSTOMER_A);
    // Completion is committed with the same row change the complete route makes; that route also writes review tables this schema does not build.
    const read = await readDuring(bookingId, PROVIDER, async () => { await local.query(`UPDATE catering_bookings SET status = 'completed', completed_at = now() WHERE id = $1`, [bookingId]); });
    const view = read.body.amendments;
    assert.deepEqual([view.bookingStatus, view.pending?.status, view.actions.canAccept], ["confirmed", "pending", true]);
    const after = (await amendmentsView(bookingId, PROVIDER)).body.amendments;
    assert.deepEqual([after.bookingStatus, after.pending, after.amendments[0].status, after.actions.canAccept], ["completed", null, "superseded", false]);
  });

  test("snapshot: a billing ledger appearing mid-read is not half-seen either", async () => {
    const bookingId = await confirmed();
    const read = await readDuring(bookingId, PROVIDER, async () => { await issueInvoice(bookingId); });
    assert.equal(read.body.amendments.billingTermsLocked, false, "the whole view is from before the invoice");
    assert.equal((await amendmentsView(bookingId, PROVIDER)).body.amendments.billingTermsLocked, true);
  });

  test("snapshot: the read takes no lock, so it neither waits for nor blocks a writer", async () => {
    const bookingId = await confirmed();
    const created = await propose(bookingId, { guestCount: 125 }, PROVIDER);
    const lockHeld = await local.query(`SELECT count(*)::int AS n FROM pg_locks WHERE locktype = 'transactionid' AND NOT granted`);
    assert.equal(lockHeld.rows[0].n, 0);
    // The accept inside readDuring only completes if the paused GET is not holding the booking row.
    const read = await readDuring(bookingId, CUSTOMER_A, async () => { assert.equal((await respond(bookingId, created.body.amendments.pending.id, "accept", CUSTOMER_A)).status, 200); });
    assert.equal(read.status, 200);
  });
}
