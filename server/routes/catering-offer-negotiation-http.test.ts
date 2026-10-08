/**
 * Phase 2N: quote / offer negotiation as real HTTP against the real catering routers, every rendered SQL statement
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

process.env.DATABASE_URL ||= "postgres://u:p@catering-offer-tests.invalid/none";
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
  const SCHEMA = "catering_offer_tests";
  const local = new pg.Pool({ ...parseLocalTestDatabaseUrl(PG_URL), options: `-c search_path=${SCHEMA}` });
  const { pool } = await import("../db/index");
  (pool as never as { connect: unknown }).connect = () => local.connect();
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
  const offerMigration = sqlFile("server/migrations/20261004_catering_offer_negotiation.sql");
  // The billing read joins the Phase 2P adjustment ledger, which itself references the Phase 2O amendment table.
  await local.query(sqlFile("server/migrations/20261005_catering_booking_amendments.sql"));
  await local.query(sqlFile("server/migrations/20261006_catering_billing_adjustments.sql"));
  // The billing read also lists Square checkout attempts (Phase 2Q), so its table must exist.
  await local.query(sqlFile("server/migrations/20261014_catering_square_payments.sql"));
  await local.query(sqlFile("server/migrations/20261015_catering_square_refund_review.sql"));

  const { default: cateringRouter } = await import("./catering");
  const { default: bookingsRouter } = await import("./catering-bookings");
  const { default: offersRouter } = await import("./catering-booking-offers");
  const { default: billingRouter } = await import("./catering-booking-billing");
  const app = express();
  app.use(express.json());
  app.use("/api/catering", cateringRouter);
  app.use("/api/catering", bookingsRouter);
  app.use("/api/catering", offersRouter);
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
    await local.query(`TRUNCATE notifications, catering_booking_payments, catering_booking_invoices, catering_booking_billing, catering_booking_activity, catering_booking_details, catering_bookings, catering_inquiries, users CASCADE`);
    await local.query(`INSERT INTO users (id, username, display_name) VALUES ($1, 'ann', 'Ann A'), ($2, 'bob', 'Bob B'), ($3, 'chef1', 'Chef One'), ($4, 'chef2', NULL)`, [CUSTOMER_A, CUSTOMER_B, PROVIDER, OTHER_PROVIDER]);
  });

  // ------------------------------------------------------------------------------------------------ migration
  test("migration: additive and idempotent, and applying it before any offer exists changes no booking", async () => {
    const legacy = await legacyOffer();
    const before = await bookingRow(legacy.bookingId);
    await local.query(offerMigration);
    await local.query(offerMigration);
    assert.deepEqual(await bookingRow(legacy.bookingId), before);
    assert.equal((await revisionRows(legacy.bookingId)).length, 0, "no revision is fabricated for an offer that predates the table");
    const columns = await local.query(`SELECT column_name FROM information_schema.columns WHERE table_schema = current_schema() AND table_name = 'catering_offer_revisions' AND column_name IN ('price_cents', 'guest_count', 'note', 'accepted_at', 'revision_number')`);
    assert.equal(columns.rows.length, 5);
    assert.equal((await local.query(`SELECT data_type FROM information_schema.columns WHERE table_schema = current_schema() AND table_name = 'catering_offer_revisions' AND column_name = 'price_cents'`)).rows[0].data_type, "bigint");
  });

  test("migration: the database itself refuses a malformed negotiation row", async () => {
    const { bookingId } = await offered();
    const insert = (kind: string, role: string, extras = "price_cents, note", values = "100, 'x'") => local.query(
      `INSERT INTO catering_offer_revisions (booking_id, revision_number, kind, proposed_by_user_id, proposed_by_role, client_request_id, ${extras}) VALUES ($1, $2, $3, $4, $5, $6, ${values})`,
      [bookingId, 10 + (sequence += 1), kind, PROVIDER, role, randomUUID()]);
    await assert.rejects(insert("offer", "customer"), /role_check/);
    await assert.rejects(insert("change_request", "customer", "price_cents, note", "100, 'x'"), /change_request_check/);
    await assert.rejects(insert("change_request", "customer", "note", "'   '"), /change_request_check/);
    await assert.rejects(insert("offer", "provider", "price_cents", "-1"), /price_check/);
    await assert.rejects(insert("offer", "provider", "price_cents", "10000000000"), /price_check/);
    await assert.rejects(insert("offer", "provider", "guest_count", "0"), /guest_check/);
    await assert.rejects(insert("bogus", "provider"), /kind_check/);
    await assert.rejects(local.query(`INSERT INTO catering_offer_revisions (booking_id, revision_number, kind, proposed_by_user_id, proposed_by_role, client_request_id) VALUES ($1, 1, 'offer', $2, 'provider', $3)`, [bookingId, PROVIDER, randomUUID()]), /booking_number_uidx/);
  });

  test("migration: a revision's terms can never be rewritten or deleted, and only one revision per booking can be accepted", async () => {
    const { bookingId, revisionId } = await offered();
    await assert.rejects(local.query(`UPDATE catering_offer_revisions SET price_cents = 1 WHERE id = $1`, [revisionId]), /immutable/);
    await assert.rejects(local.query(`UPDATE catering_offer_revisions SET note = 'edited' WHERE id = $1`, [revisionId]), /immutable/);
    await assert.rejects(local.query(`DELETE FROM catering_offer_revisions WHERE id = $1`, [revisionId]), /never deleted/);
    await local.query(`UPDATE catering_offer_revisions SET accepted_at = now() WHERE id = $1`, [revisionId]);
    await assert.rejects(local.query(`UPDATE catering_offer_revisions SET accepted_at = NULL WHERE id = $1`, [revisionId]), /immutable/);
    const second = await revise(bookingId, revisionId);
    assert.equal(second.status, 201);
    await assert.rejects(local.query(`UPDATE catering_offer_revisions SET accepted_at = now() WHERE booking_id = $1 AND revision_number = 2`, [bookingId]), /accepted_uidx/);
  });

  // ------------------------------------------------------------------------------------- first offer / create
  test("1. a provider creates the first offer for their own accepted inquiry: booking and revision 1 in one transaction", async () => {
    const inquiryId = await inquiry();
    const response = await call("POST", `/inquiries/${inquiryId}/provider-confirm`, tok(PROVIDER), { priceCents: 150000, note: "Buffet for 40", guestCount: 45 });
    assert.equal(response.status, 201, response.text);
    const booking = await bookingRow(response.body.booking.id);
    assert.equal(booking.status, "pending_confirmation");
    assert.equal(booking.agreed_price, "1500.00");
    assert.equal(booking.guest_count, 45);
    const rows = await revisionRows(booking.id);
    assert.equal(rows.length, 1);
    assert.deepEqual({ n: rows[0].revision_number, kind: rows[0].kind, cents: Number(rows[0].price_cents), guests: rows[0].guest_count, note: rows[0].note, role: rows[0].proposed_by_role }, { n: 1, kind: "offer", cents: 150000, guests: 45, note: "Buffet for 40", role: "provider" });
  });

  test("1b. an offer without terms defaults the guest count to the inquiry's and keeps the booking's own guest count", async () => {
    const { bookingId } = await offered({});
    const booking = await bookingRow(bookingId);
    assert.equal(booking.guest_count, 40);
    assert.equal(booking.agreed_price, null);
    assert.equal((await revisionRows(bookingId))[0].price_cents, null);
  });

  test("2. an unrelated provider cannot offer, revise or read; nothing is written", async () => {
    const inquiryId = await inquiry();
    assert.equal((await call("POST", `/inquiries/${inquiryId}/provider-confirm`, tok(OTHER_PROVIDER), { priceCents: 1 })).status, 404);
    assert.equal(await bookingCount(), 0);
    const { bookingId, revisionId } = await offered();
    assert.equal((await revise(bookingId, revisionId, { priceCents: 1 }, {}, OTHER_PROVIDER)).status, 404);
    assert.equal((await view(bookingId, OTHER_PROVIDER)).status, 404);
    assert.equal((await revisionRows(bookingId)).length, 1);
  });

  test("3. the customer reads their own current offer, newest first, with the actions the server allows", async () => {
    const { bookingId, revisionId } = await offered();
    const response = await view(bookingId);
    assert.equal(response.status, 200);
    const negotiation = response.body.negotiation;
    assert.equal(negotiation.role, "customer");
    assert.equal(negotiation.state, "open");
    assert.equal(negotiation.legacy, false);
    assert.equal(negotiation.currentRevisionId, revisionId);
    assert.deepEqual(negotiation.actions, { canRevise: false, canAccept: true, canRequestChanges: true, canDecline: true });
    assert.equal(negotiation.revisions[0].priceCents, 150000);
    const asProvider = (await view(bookingId, PROVIDER)).body.negotiation;
    assert.deepEqual(asProvider.actions, { canRevise: true, canAccept: false, canRequestChanges: false, canDecline: false });
  });

  test("4. an unrelated customer cannot read a negotiation, and it looks exactly like one that does not exist", async () => {
    const { bookingId } = await offered();
    const other = await view(bookingId, CUSTOMER_B);
    const missing = await view(randomUUID(), CUSTOMER_B);
    const malformed = await call("GET", `/bookings/not-a-uuid/offer`, tok(CUSTOMER_B));
    assert.equal(other.status, 404);
    assert.deepEqual([other.status, other.text], [missing.status, missing.text]);
    assert.deepEqual([other.status, other.text], [malformed.status, malformed.text]);
    assert.equal((await call("GET", `/bookings/${bookingId}/offer`)).status, 401);
  });

  test("5. nothing provider-private, internal or contact-bearing is in the negotiation", async () => {
    const { bookingId } = await offered();
    await local.query(`INSERT INTO catering_booking_details (booking_id, provider_notes, customer_notes) VALUES ($1, 'PRIVATE-PROVIDER-NOTE', 'shared-note')`, [bookingId]);
    await local.query(`UPDATE catering_bookings SET cancellation_reason = 'INTERNAL-REASON' WHERE id = $1`, [bookingId]);
    for (const who of [CUSTOMER_A, PROVIDER]) {
      const response = await view(bookingId, who);
      assert.doesNotMatch(response.text, /PRIVATE-PROVIDER-NOTE|INTERNAL-REASON|customer-a|provider-1|ann@example\.com|555 123 4567|clientRequestId|client_request_id|proposedByUserId/);
      for (const row of response.body.negotiation.revisions) assert.deepEqual(Object.keys(row).sort(), ["acceptedAt", "createdAt", "currency", "guestCount", "id", "isCurrent", "kind", "note", "priceCents", "proposedBy", "respondsToRevisionNumber", "revisionNumber"]);
    }
  });

  // ------------------------------------------------------------------------------------------- history / revise
  test("6. a revision adds history and never rewrites the earlier one; exactly one revision is current", async () => {
    const { bookingId, revisionId } = await offered();
    const first = (await revisionRows(bookingId))[0];
    const second = await revise(bookingId, revisionId, { priceCents: 175000, guestCount: 50, note: "Now with dessert" });
    assert.equal(second.status, 201, second.text);
    const third = await revise(bookingId, second.body.negotiation.currentRevisionId, { priceCents: 170000 });
    assert.equal(third.status, 201, third.text);
    const rows = await revisionRows(bookingId);
    assert.deepEqual(rows.map((row) => [row.revision_number, Number(row.price_cents)]), [[1, 150000], [2, 175000], [3, 170000]]);
    assert.deepEqual({ ...rows[0], accepted_at: null }, { ...first, accepted_at: null }, "revision 1 is byte-for-byte what it was");
    const shown = (await view(bookingId)).body.negotiation;
    assert.deepEqual(shown.revisions.map((row: { revisionNumber: number }) => row.revisionNumber), [3, 2, 1], "newest first");
    assert.equal(shown.revisions.filter((row: { isCurrent: boolean }) => row.isCurrent).length, 1);
    assert.equal(shown.revisions.find((row: { isCurrent: boolean }) => row.isCurrent).revisionNumber, 3);
    assert.equal(shown.currentRevisionId, third.body.negotiation.currentRevisionId);
  });

  test("7. the booking mirrors the current revision's terms in the same transaction, and the customer sees the newest one", async () => {
    const { bookingId, revisionId } = await offered();
    await revise(bookingId, revisionId, { priceCents: 123456, guestCount: 55 });
    const booking = await bookingRow(bookingId);
    assert.equal(booking.agreed_price, "1234.56");
    assert.equal(booking.guest_count, 55);
    assert.equal(booking.status, "pending_confirmation");
    const shown = (await view(bookingId)).body.negotiation;
    assert.equal(shown.revisions[0].priceCents, 123456);
    assert.equal(shown.revisions[0].isCurrent, true);
    assert.equal(shown.revisions[1].isCurrent, false);
  });

  test("8. only the provider can revise; a customer, or a body naming someone else, cannot", async () => {
    const { bookingId, revisionId } = await offered();
    assert.equal((await revise(bookingId, revisionId, { priceCents: 1 }, {}, CUSTOMER_A)).status, 404);
    assert.equal((await revise(bookingId, revisionId, { priceCents: 1 }, { providerId: PROVIDER })).status, 400);
    assert.equal((await revise(bookingId, revisionId, { priceCents: 1 }, { userId: PROVIDER, actorRole: "provider" })).status, 400);
    assert.equal((await revise(bookingId, revisionId, { priceCents: 1 }, { proposedBy: "customer" }, OTHER_PROVIDER)).status, 400);
    assert.equal((await revisionRows(bookingId)).length, 1);
  });

  test("9. a provider retry of the same submission is one revision; a stale provider is told so", async () => {
    const { bookingId, revisionId } = await offered();
    const clientRequestId = randomUUID();
    const sent = await revise(bookingId, revisionId, { priceCents: 160000 }, { clientRequestId });
    const retried = await revise(bookingId, revisionId, { priceCents: 160000 }, { clientRequestId });
    assert.deepEqual([sent.status, retried.status], [201, 200]);
    assert.equal(retried.body.negotiation.currentRevisionId, sent.body.negotiation.currentRevisionId);
    assert.equal((await revisionRows(bookingId)).length, 2);
    const stale = await revise(bookingId, revisionId, { priceCents: 999 });
    assert.equal(stale.status, 409);
    assert.equal(stale.body.code, "stale_revision");
    assert.equal((await revisionRows(bookingId)).length, 2);
  });

  // --------------------------------------------------------------------------------------------------- accept
  test("10. the customer accepts the current revision: booking confirmed with exactly those terms, revision stamped", async () => {
    const { bookingId, revisionId } = await offered();
    const second = await revise(bookingId, revisionId, { priceCents: 180000, guestCount: 48, note: "Final" });
    const currentId = second.body.negotiation.currentRevisionId;
    const response = await accept(bookingId, currentId);
    assert.equal(response.status, 200, response.text);
    const booking = await bookingRow(bookingId);
    const rows = await revisionRows(bookingId);
    assert.equal(booking.status, "confirmed");
    assert.ok(booking.customer_confirmed_at && booking.confirmed_at);
    assert.deepEqual(rows.map((row) => row.accepted_at !== null), [false, true]);
    assert.equal(booking.agreed_price, "1800.00");
    assert.equal(booking.guest_count, 48);
    assert.equal(Number(rows[1].price_cents), Math.round(Number(booking.agreed_price) * 100), "accepted revision and booking agree to the cent");
    const shown = (await view(bookingId)).body.negotiation;
    assert.equal(shown.state, "accepted");
    assert.deepEqual(shown.actions, { canRevise: false, canAccept: false, canRequestChanges: false, canDecline: false });
  });

  test("11. a superseded revision cannot be accepted, whatever tab it was open in", async () => {
    const { bookingId, revisionId } = await offered();
    await revise(bookingId, revisionId, { priceCents: 190000 });
    const stale = await accept(bookingId, revisionId);
    assert.equal(stale.status, 409);
    assert.equal(stale.body.code, "stale_revision");
    const booking = await bookingRow(bookingId);
    assert.equal(booking.status, "pending_confirmation");
    assert.equal(booking.customer_confirmed_at, null);
    assert.equal((await revisionRows(bookingId)).filter((row) => row.accepted_at).length, 0);
  });

  test("12. a booking with revisions cannot be accepted without naming one; a guessed or foreign revision id is the same 409", async () => {
    const mine = await offered();
    const theirs = await offered({ priceCents: 5 }, { customer: CUSTOMER_B });
    const missing = await accept(mine.bookingId, undefined);
    assert.equal(missing.status, 409);
    assert.equal(missing.body.code, "offer_revision_required");
    const foreign = await accept(mine.bookingId, theirs.revisionId);
    const guessed = await accept(mine.bookingId, randomUUID());
    assert.deepEqual([foreign.status, foreign.text], [guessed.status, guessed.text], "a real revision of another booking is indistinguishable from a random id");
    assert.equal(foreign.body.code, "stale_revision");
    assert.equal((await accept(mine.bookingId, "not-a-uuid")).status, 400);
    assert.equal((await bookingRow(mine.bookingId)).status, "pending_confirmation");
    assert.equal((await bookingRow(theirs.bookingId)).status, "pending_confirmation");
  });

  test("13. retrying an acceptance is safe: still one acceptance, one notification, same terms", async () => {
    const { bookingId, revisionId } = await offered();
    const one = await accept(bookingId, revisionId);
    const two = await accept(bookingId, revisionId);
    assert.deepEqual([one.status, two.status], [200, 200]);
    assert.equal((await revisionRows(bookingId)).filter((row) => row.accepted_at).length, 1);
    assert.equal((await notificationsFor(PROVIDER, "catering_booking_confirmed")).length, 1);
    const lateStale = await accept(bookingId, randomUUID());
    assert.equal(lateStale.status, 409, "naming something other than what was accepted is refused, not silently succeeded");
    assert.equal((await bookingRow(bookingId)).status, "confirmed");
  });

  test("14. another customer, or a body naming one, cannot accept", async () => {
    const { bookingId, revisionId } = await offered();
    assert.equal((await accept(bookingId, revisionId, CUSTOMER_B)).status, 404);
    assert.equal((await accept(bookingId, revisionId, PROVIDER)).status, 404);
    const forged = await call("POST", `/bookings/${bookingId}/customer-confirm`, tok(CUSTOMER_A), { revisionId, customerId: CUSTOMER_A, status: "confirmed" });
    assert.equal(forged.status, 400);
    assert.equal((await bookingRow(bookingId)).status, "pending_confirmation");
  });

  // -------------------------------------------------------------------------------------------- change requests
  test("15. a change request persists as negotiation data and does not touch the booking's terms", async () => {
    const { bookingId, revisionId } = await offered();
    const before = await bookingRow(bookingId);
    const response = await changeRequest(bookingId, revisionId, "Could you do $1,200 and add vegan options?");
    assert.equal(response.status, 201, response.text);
    assert.deepEqual(await bookingRow(bookingId), before, "the booking row is unchanged, updated_at included");
    const rows = await revisionRows(bookingId);
    assert.deepEqual(rows.map((row) => [row.revision_number, row.kind, row.proposed_by_role]), [[1, "offer", "provider"], [2, "change_request", "customer"]]);
    assert.equal(rows[1].price_cents, null);
    assert.equal(rows[1].guest_count, null);
    const shown = (await view(bookingId, PROVIDER)).body.negotiation;
    assert.equal(shown.changeRequestPending, true);
    assert.equal(shown.currentRevisionId, revisionId, "a change request does not become the current offer");
    assert.equal(shown.revisions[0].respondsToRevisionNumber, 1);
    assert.equal(shown.revisions[0].proposedBy, "customer");
  });

  test("16. the provider answers a change request with a new revision, which clears the pending request", async () => {
    const { bookingId, revisionId } = await offered();
    await changeRequest(bookingId, revisionId);
    assert.equal((await changeRequest(bookingId, revisionId, "again")).body.code, "change_request_pending");
    const answered = await revise(bookingId, revisionId, { priceCents: 140000 });
    assert.equal(answered.status, 201, answered.text);
    assert.equal(answered.body.negotiation.changeRequestPending, false);
    assert.equal((await revisionRows(bookingId)).length, 3);
    const again = await changeRequest(bookingId, answered.body.negotiation.currentRevisionId, "one more thing");
    assert.equal(again.status, 201);
  });

  test("17. a change request must name the current revision, needs a message, and is customer-only with no actor in the body", async () => {
    const { bookingId, revisionId } = await offered();
    const second = await revise(bookingId, revisionId, { priceCents: 140000 });
    const stale = await changeRequest(bookingId, revisionId);
    assert.deepEqual([stale.status, stale.body.code], [409, "stale_revision"]);
    const current = second.body.negotiation.currentRevisionId;
    assert.equal((await changeRequest(bookingId, current, "   ")).status, 400);
    assert.equal((await changeRequest(bookingId, current, "x".repeat(2001))).status, 400);
    assert.equal((await changeRequest(bookingId, current, "ok", { clientRequestId: "nope" })).status, 400);
    assert.equal((await changeRequest(bookingId, current, "ok", { customerId: CUSTOMER_A })).status, 400);
    assert.equal((await changeRequest(bookingId, current, "ok", {}, CUSTOMER_B)).status, 404);
    assert.equal((await changeRequest(bookingId, current, "ok", {}, PROVIDER)).status, 404);
    assert.equal((await revisionRows(bookingId)).length, 2);
  });

  test("18. a retried change request is one row and one notification", async () => {
    const { bookingId, revisionId } = await offered();
    const clientRequestId = randomUUID();
    const one = await changeRequest(bookingId, revisionId, "secret-customer-wording", { clientRequestId });
    const two = await changeRequest(bookingId, revisionId, "secret-customer-wording", { clientRequestId });
    assert.deepEqual([one.status, two.status], [201, 200]);
    assert.equal((await revisionRows(bookingId)).length, 2);
    const sent = await notificationsFor(PROVIDER, "catering_offer_change_requested");
    assert.equal(sent.length, 1);
    assert.doesNotMatch(JSON.stringify(sent), /secret-customer-wording|ann@example|555|1500/);
  });

  // -------------------------------------------------------------------------------------- decline / terminal
  test("19. declining uses the existing booking cancellation, and a cancelled negotiation can be neither revised nor revived", async () => {
    const { bookingId, revisionId } = await offered();
    const cancelled = await call("POST", `/bookings/${bookingId}/cancel`, tok(CUSTOMER_A), {});
    assert.equal(cancelled.status, 200);
    const booking = await bookingRow(bookingId);
    assert.deepEqual([booking.status, booking.cancelled_by], ["cancelled", "customer"]);
    const attempts = [
      await revise(bookingId, revisionId, { priceCents: 1 }),
      await accept(bookingId, revisionId),
      await changeRequest(bookingId, revisionId),
    ];
    assert.deepEqual(attempts.map((a) => a.status), [409, 409, 409]);
    assert.deepEqual(attempts.map((a) => a.body.code), ["negotiation_closed", "negotiation_closed", "negotiation_closed"]);
    assert.equal((await bookingRow(bookingId)).status, "cancelled");
    assert.equal((await revisionRows(bookingId)).length, 1);
    const shown = (await view(bookingId)).body.negotiation;
    assert.deepEqual([shown.state, shown.actions.canRevise, shown.actions.canAccept], ["closed", false, false]);
    assert.equal((await notificationsFor(PROVIDER, "catering_booking_cancelled")).length, 1);
  });

  test("20. a confirmed booking receives no pre-confirmation revision or request", async () => {
    const { bookingId, revisionId } = await offered();
    await accept(bookingId, revisionId);
    const frozen = await bookingRow(bookingId);
    assert.deepEqual([(await revise(bookingId, revisionId, { priceCents: 1 })).body.code, (await changeRequest(bookingId, revisionId)).body.code], ["negotiation_closed", "negotiation_closed"]);
    assert.deepEqual(await bookingRow(bookingId), frozen);
    assert.equal((await revisionRows(bookingId)).length, 1);
  });

  // ----------------------------------------------------------------------------------------------------- races
  test("21. provider revision vs customer acceptance of the previous revision: one coherent outcome, never a stale acceptance", async () => {
    for (let round = 0; round < 12; round += 1) {
      const { bookingId, revisionId } = await offered({ priceCents: 100000 + round });
      const [revised, accepted] = await Promise.all([revise(bookingId, revisionId, { priceCents: 200000 + round }), accept(bookingId, revisionId)]);
      const booking = await bookingRow(bookingId);
      const rows = await revisionRows(bookingId);
      const acceptedRows = rows.filter((row) => row.accepted_at);
      assert.ok(acceptedRows.length <= 1);
      if (accepted.status === 200) {
        assert.equal(booking.status, "confirmed");
        assert.equal(acceptedRows.length, 1);
        assert.equal(acceptedRows[0].id, revisionId, "the accepted revision is the one the customer named");
        assert.equal(Math.round(Number(booking.agreed_price) * 100), Number(acceptedRows[0].price_cents), "confirmed with the accepted terms");
        assert.equal(rows.length, revised.status === 201 ? 2 : 1);
        if (revised.status === 201) assert.fail("a revision committed before acceptance cannot leave the older revision acceptable");
        assert.equal(revised.body.code, "negotiation_closed");
      } else {
        assert.equal(accepted.status, 409);
        assert.equal(accepted.body.code, "stale_revision");
        assert.equal(revised.status, 201);
        assert.equal(booking.status, "pending_confirmation");
        assert.equal(acceptedRows.length, 0);
        assert.equal(Math.round(Number(booking.agreed_price) * 100), 200000 + round, "booking carries the newer revision, which nobody accepted yet");
      }
    }
  });

  test("22. two simultaneous provider revisions from the same revision: exactly one wins, one current revision remains", async () => {
    for (let round = 0; round < 6; round += 1) {
      const { bookingId, revisionId } = await offered();
      const results = await Promise.all([revise(bookingId, revisionId, { priceCents: 111 }), revise(bookingId, revisionId, { priceCents: 222 }), revise(bookingId, revisionId, { priceCents: 333 })]);
      assert.deepEqual(results.map((r) => r.status).sort(), [201, 409, 409]);
      assert.ok(results.filter((r) => r.status === 409).every((r) => r.body.code === "stale_revision"));
      const rows = await revisionRows(bookingId);
      assert.deepEqual(rows.map((row) => row.revision_number), [1, 2]);
      const shown = (await view(bookingId)).body.negotiation;
      assert.equal(shown.revisions.filter((row: { isCurrent: boolean }) => row.isCurrent).length, 1);
      assert.equal(Math.round(Number((await bookingRow(bookingId)).agreed_price) * 100), Number(rows[1].price_cents));
    }
  });

  test("23. the same revision submission sent simultaneously is one revision", async () => {
    const { bookingId, revisionId } = await offered();
    const clientRequestId = randomUUID();
    const results = await Promise.all([1, 2, 3].map(() => revise(bookingId, revisionId, { priceCents: 160000 }, { clientRequestId })));
    assert.deepEqual(results.map((r) => r.status).sort(), [200, 200, 201]);
    assert.equal((await revisionRows(bookingId)).length, 2);
    assert.equal((await notificationsFor(CUSTOMER_A, "catering_offer_revised")).length, 1);
  });

  test("24. simultaneous acceptances: one confirmation, one stamp, one notification", async () => {
    const { bookingId, revisionId } = await offered();
    const results = await Promise.all([1, 2, 3, 4].map(() => accept(bookingId, revisionId)));
    assert.ok(results.every((r) => r.status === 200), JSON.stringify(results.map((r) => r.text)));
    assert.equal((await revisionRows(bookingId)).filter((row) => row.accepted_at).length, 1);
    assert.equal((await notificationsFor(PROVIDER, "catering_booking_confirmed")).length, 1);
    assert.equal((await bookingRow(bookingId)).status, "confirmed");
  });

  test("25. a change request racing a provider revision ends in one coherent state", async () => {
    for (let round = 0; round < 8; round += 1) {
      const { bookingId, revisionId } = await offered();
      const [revised, requested] = await Promise.all([revise(bookingId, revisionId, { priceCents: 130000 }), changeRequest(bookingId, revisionId)]);
      const rows = await revisionRows(bookingId);
      assert.equal(revised.status, 201);
      const shown = (await view(bookingId)).body.negotiation;
      assert.equal(shown.revisions.filter((row: { isCurrent: boolean }) => row.isCurrent).length, 1);
      if (requested.status === 201) {
        // The request landed on revision 1 before the revision, so the revision answered it.
        assert.deepEqual(rows.map((row) => row.kind), ["offer", "change_request", "offer"]);
        assert.equal(shown.changeRequestPending, false);
      } else {
        assert.deepEqual([requested.status, requested.body.code], [409, "stale_revision"]);
        assert.deepEqual(rows.map((row) => row.kind), ["offer", "offer"]);
      }
    }
  });

  test("26. a cancellation racing a revision can never be revived by it", async () => {
    for (let round = 0; round < 10; round += 1) {
      const { bookingId, revisionId } = await offered();
      const [revised, cancelled] = await Promise.all([revise(bookingId, revisionId, { priceCents: 130000 }), call("POST", `/bookings/${bookingId}/cancel`, tok(CUSTOMER_A), {})]);
      assert.equal(cancelled.status, 200);
      assert.equal((await bookingRow(bookingId)).status, "cancelled", "whichever order they ran in, the booking ends cancelled");
      if (revised.status !== 201) assert.deepEqual([revised.status, revised.body.code], [409, "negotiation_closed"]);
      const after = (await revisionRows(bookingId)).length;
      assert.equal((await revise(bookingId, null, { priceCents: 5 })).status, 409);
      assert.equal((await revisionRows(bookingId)).length, after);
    }
  });

  test("27. a cancellation racing an acceptance: the booking is either confirmed-then-cancelled or cancelled and never confirmed", async () => {
    for (let round = 0; round < 8; round += 1) {
      const { bookingId, revisionId } = await offered();
      const [accepted, cancelled] = await Promise.all([accept(bookingId, revisionId), call("POST", `/bookings/${bookingId}/cancel`, tok(CUSTOMER_A), {})]);
      assert.equal(cancelled.status, 200);
      const booking = await bookingRow(bookingId);
      assert.equal(booking.status, "cancelled");
      if (accepted.status !== 200) assert.equal(accepted.body.code, "negotiation_closed");
      assert.ok((await revisionRows(bookingId)).filter((row) => row.accepted_at).length <= 1);
    }
  });

  test("28. no path ever produces a second booking for one inquiry", async () => {
    const inquiryId = await inquiry();
    const results = await Promise.all([1, 2, 3, 4].map(() => call("POST", `/inquiries/${inquiryId}/provider-confirm`, tok(PROVIDER), { priceCents: 150000 })));
    assert.deepEqual(results.map((r) => r.status).sort(), [200, 200, 200, 201]);
    assert.equal(await bookingCount(), 1);
    const bookingId = results[0].body.booking.id;
    assert.equal((await revisionRows(bookingId)).length, 1, "retries of the first offer write no second revision");
    assert.equal((await notificationsFor(CUSTOMER_A, "catering_booking_confirmation")).length, 1);
  });

  // ------------------------------------------------------------------------------------------------ legacy
  test("29. a legacy pending offer still renders its real terms, with no fabricated history", async () => {
    const { bookingId } = await legacyOffer();
    for (const who of [CUSTOMER_A, PROVIDER]) {
      const negotiation = (await view(bookingId, who)).body.negotiation;
      assert.equal(negotiation.legacy, true);
      assert.equal(negotiation.currentRevisionId, null);
      assert.deepEqual(negotiation.revisions, []);
      assert.deepEqual({ ...negotiation.legacyTerms, offeredAt: null }, { priceCents: 120000, currency: "USD", guestCount: 40, offeredAt: null });
      assert.ok(negotiation.legacyTerms.offeredAt);
    }
    assert.equal((await revisionRows(bookingId)).length, 0, "reading never writes");
  });

  test("30. a legacy offer is still accepted by a client that names no revision, with its own stored terms", async () => {
    const { bookingId } = await legacyOffer();
    const response = await accept(bookingId, undefined);
    assert.equal(response.status, 200, response.text);
    const booking = await bookingRow(bookingId);
    assert.deepEqual([booking.status, booking.agreed_price, booking.guest_count], ["confirmed", "1200.00", 40]);
    assert.equal((await revisionRows(bookingId)).length, 0);
    const explicit = await legacyOffer();
    assert.equal((await accept(explicit.bookingId, null)).status, 200);
    const stale = await legacyOffer();
    const guessed = await accept(stale.bookingId, randomUUID());
    assert.deepEqual([guessed.status, guessed.body.code], [409, "stale_revision"]);
  });

  test("31. a provider revising a legacy offer writes its first real revision; a stale legacy tab can no longer accept", async () => {
    const { bookingId } = await legacyOffer();
    const revised = await revise(bookingId, null, { priceCents: 130000, guestCount: 42, note: "Revised after we spoke" });
    assert.equal(revised.status, 201, revised.text);
    const rows = await revisionRows(bookingId);
    assert.deepEqual(rows.map((row) => [row.revision_number, Number(row.price_cents)]), [[1, 130000]], "the legacy terms are not back-filled as a revision that never existed");
    assert.equal((await bookingRow(bookingId)).agreed_price, "1300.00");
    const staleLegacyAccept = await accept(bookingId, undefined);
    assert.deepEqual([staleLegacyAccept.status, staleLegacyAccept.body.code], [409, "offer_revision_required"]);
    assert.equal((await bookingRow(bookingId)).status, "pending_confirmation");
    const second = await revise(bookingId, null, { priceCents: 1 });
    assert.deepEqual([second.status, second.body.code], [409, "stale_revision"], "expecting 'no revision' is stale once one exists");
    const current = revised.body.negotiation.currentRevisionId;
    assert.equal((await accept(bookingId, current)).status, 200);
    assert.equal((await bookingRow(bookingId)).agreed_price, "1300.00");
  });

  test("32. a customer change request on a legacy offer persists without a revision to point at", async () => {
    const { bookingId } = await legacyOffer();
    const before = await bookingRow(bookingId);
    const response = await changeRequest(bookingId, null, "Can you drop the price?");
    assert.equal(response.status, 201, response.text);
    const rows = await revisionRows(bookingId);
    assert.deepEqual(rows.map((row) => [row.kind, row.responds_to_revision_id]), [["change_request", null]]);
    assert.deepEqual(await bookingRow(bookingId), before);
    const shown = response.body.negotiation;
    assert.equal(shown.legacy, true, "a change request is not an offer: the legacy terms are still the ones on offer");
    assert.equal(shown.changeRequestPending, true);
    assert.equal((await accept(bookingId, undefined)).status, 200, "the customer may still accept the legacy terms");
  });

  // ----------------------------------------------------------------------------------------------- money
  test("33. money is validated and stored as integer cents, never as a float", async () => {
    const inquiryId = await inquiry();
    const post = (body: unknown) => call("POST", `/inquiries/${inquiryId}/provider-confirm`, tok(PROVIDER), body);
    for (const bad of [{ priceCents: 12.5 }, { priceCents: -1 }, { priceCents: 10_000_000_000 }, { priceCents: "100" }, { agreedPrice: -5 }, { agreedPrice: 0.1 + 0.2 }, { agreedPrice: 1.005 }, { agreedPrice: 100_000_000 }, { priceCents: 100, agreedPrice: 1 }, { guestCount: 0 }, { guestCount: 2.5 }, { guestCount: 100_001 }, { currency: "usd" }, { note: "n".repeat(2001) }, { totalCents: 1 }]) {
      const response = await post(bad);
      assert.equal(response.status, 400, JSON.stringify(bad));
    }
    assert.equal(await bookingCount(), 0, "no refused offer wrote anything");
    const legacyShape = await post({ agreedPrice: "1250.50", currency: "USD" });
    assert.equal(legacyShape.status, 201, legacyShape.text);
    const rows = await revisionRows(legacyShape.body.booking.id);
    assert.equal(Number(rows[0].price_cents), 125050);
    assert.equal((await bookingRow(legacyShape.body.booking.id)).agreed_price, "1250.50");
  });

  test("34. the largest legal price round-trips exactly and zero is a real price, distinct from none", async () => {
    const { bookingId, revisionId } = await offered({ priceCents: 9_999_999_999 });
    assert.equal((await bookingRow(bookingId)).agreed_price, "99999999.99");
    assert.equal((await view(bookingId)).body.negotiation.revisions[0].priceCents, 9_999_999_999);
    const zero = await revise(bookingId, revisionId, { priceCents: 0 });
    assert.equal(zero.status, 201);
    assert.equal((await bookingRow(bookingId)).agreed_price, "0.00");
    const none = await revise(bookingId, zero.body.negotiation.currentRevisionId, {});
    assert.equal(none.status, 201);
    assert.equal((await bookingRow(bookingId)).agreed_price, null);
    assert.equal(none.body.negotiation.revisions[0].priceCents, null);
  });

  // ------------------------------------------------------------------------------------------- notifications
  test("35. notifications fire once per real transition, link to participant surfaces, and carry no terms or contact data", async () => {
    const { bookingId, revisionId } = await offered({ priceCents: 987654, note: "private-terms-text" });
    assert.equal((await notificationsFor(CUSTOMER_A, "catering_booking_confirmation")).length, 1, "the existing first-offer notification");
    assert.equal((await notificationsFor(CUSTOMER_A, "catering_offer_revised")).length, 0, "the first offer is not also a 'revised' notice");
    const second = await revise(bookingId, revisionId, { priceCents: 987000, note: "private-terms-text-2" });
    await changeRequest(bookingId, second.body.negotiation.currentRevisionId, "private-customer-words");
    await accept(bookingId, second.body.negotiation.currentRevisionId);
    const revised = await notificationsFor(CUSTOMER_A, "catering_offer_revised");
    const requested = await notificationsFor(PROVIDER, "catering_offer_change_requested");
    const confirmed = await notificationsFor(PROVIDER, "catering_booking_confirmed");
    assert.deepEqual([revised.length, requested.length, confirmed.length], [1, 1, 1]);
    assert.equal(revised[0].link_url, "/services/catering#my-bookings");
    assert.equal(requested[0].link_url, "/services/catering/provider#bookings");
    assert.doesNotMatch(JSON.stringify([revised, requested, confirmed]), /private-|9876|987000|ann@example|555/);
    assert.equal((await notificationsFor(CUSTOMER_A, "catering_offer_change_requested")).length, 0);
    assert.equal((await notificationsFor(PROVIDER, "catering_offer_revised")).length, 0);
  });

  test("36. a refused or stale action notifies nobody", async () => {
    const { bookingId, revisionId } = await offered();
    await revise(bookingId, revisionId, { priceCents: 5 });
    const before = Number((await local.query(`SELECT count(*) FROM notifications`)).rows[0].count);
    await revise(bookingId, revisionId, { priceCents: 6 });
    await accept(bookingId, revisionId);
    await changeRequest(bookingId, revisionId);
    assert.equal(Number((await local.query(`SELECT count(*) FROM notifications`)).rows[0].count), before);
  });

  test("37. a notification failure does not undo or falsify a persisted transition", async () => {
    const { bookingId, revisionId } = await offered();
    await local.query(`ALTER TABLE notifications RENAME TO notifications_offline`);
    try {
      const revised = await revise(bookingId, revisionId, { priceCents: 170000 });
      assert.equal(revised.status, 201, revised.text);
      const requested = await changeRequest(bookingId, revised.body.negotiation.currentRevisionId, "hello");
      assert.equal(requested.status, 201, requested.text);
      const accepted = await accept(bookingId, revised.body.negotiation.currentRevisionId);
      assert.equal(accepted.status, 200, accepted.text);
    } finally {
      await local.query(`ALTER TABLE notifications_offline RENAME TO notifications`);
    }
    assert.equal((await bookingRow(bookingId)).status, "confirmed");
    assert.equal((await revisionRows(bookingId)).length, 3);
  });

  // ---------------------------------------------------------------------------------------------- bounds
  test("38. history is bounded: the negotiation stops accepting rows at the limit and a read never returns more", async () => {
    let { bookingId, revisionId } = await offered();
    for (let n = 2; n <= 50; n += 1) {
      const response = await revise(bookingId, revisionId, { priceCents: 1000 + n });
      assert.equal(response.status, 201, `${n}: ${response.text}`);
      revisionId = response.body.negotiation.currentRevisionId;
    }
    const over = await revise(bookingId, revisionId, { priceCents: 1 });
    assert.deepEqual([over.status, over.body.code], [409, "revision_limit"]);
    const shown = (await view(bookingId)).body.negotiation;
    assert.equal(shown.revisions.length, 50);
    assert.equal(shown.revisions[0].revisionNumber, 50);
    assert.equal(shown.actions.canRevise, false, "the server does not offer an action it would refuse");
    assert.equal((await accept(bookingId, revisionId)).status, 200, "a full negotiation can still be accepted");
  });

  // ------------------------------------------------------------------------- Codex repair pass: stale gestures
  test("42. guest count on the first offer: omitted falls back to the request's, explicit null stays null, a number is stored, in booking and revision 1 alike", async () => {
    const guests = async (terms: Record<string, unknown>) => {
      const { bookingId } = await offered(terms);
      return { booking: (await bookingRow(bookingId)).guest_count, revision: (await revisionRows(bookingId))[0].guest_count };
    };
    assert.deepEqual(await guests({ priceCents: 100 }), { booking: 40, revision: 40 }, "omitted: the inquiry's 40");
    assert.deepEqual(await guests({ agreedPrice: "10.00" }), { booking: 40, revision: 40 }, "legacy dollar-only body: the inquiry's 40");
    assert.deepEqual(await guests({ priceCents: 100, guestCount: null }), { booking: null, revision: null }, "explicit null: the provider cleared it");
    assert.deepEqual(await guests({ priceCents: 100, guestCount: 25 }), { booking: 25, revision: 25 }, "explicit number");
    const cleared = await offered({ guestCount: null });
    assert.equal((await view(cleared.bookingId)).body.negotiation.revisions[0].guestCount, null);
  });

  test("43. a provider editor opened on revision N that submits after another tab published N+1 is refused, and its stale fields never become revision N+2", async () => {
    const { bookingId, revisionId: n } = await offered({ priceCents: 150000, note: "N" });
    const tabAEditorBoundTo = n; // what the editor captured when it opened
    const tabB = await revise(bookingId, n, { priceCents: 160000, guestCount: 40, note: "N+1 from the other tab" });
    assert.equal(tabB.status, 201);
    const stale = await revise(bookingId, tabAEditorBoundTo, { priceCents: 1, guestCount: 3, note: "stale local edit" });
    assert.deepEqual([stale.status, stale.body.code], [409, "stale_revision"]);
    const rows = await revisionRows(bookingId);
    assert.deepEqual(rows.map((row) => [row.revision_number, Number(row.price_cents)]), [[1, 150000], [2, 160000]]);
    assert.doesNotMatch(JSON.stringify(rows), /stale local edit/);
    const booking = await bookingRow(bookingId);
    assert.deepEqual([booking.agreed_price, booking.guest_count], ["1600.00", 40]);
  });

  test("44. an acceptance for the revision the dialog showed is refused once a newer one exists, nothing is confirmed, and the newer one needs its own confirmation", async () => {
    const { bookingId, revisionId: n } = await offered({ priceCents: 150000 });
    const second = await revise(bookingId, n, { priceCents: 190000, guestCount: 80 });
    const newer = second.body.negotiation.currentRevisionId;
    const refused = await accept(bookingId, n);
    assert.deepEqual([refused.status, refused.body.code], [409, "stale_revision"]);
    const afterRefusal = await bookingRow(bookingId);
    assert.deepEqual([afterRefusal.status, afterRefusal.customer_confirmed_at], ["pending_confirmation", null]);
    assert.equal((await revisionRows(bookingId)).filter((row) => row.accepted_at).length, 0);
    const confirmedNewer = await accept(bookingId, newer);
    assert.equal(confirmedNewer.status, 200);
    assert.deepEqual([(await bookingRow(bookingId)).agreed_price, (await bookingRow(bookingId)).guest_count], ["1900.00", 80]);
  });

  test("45. a change request written against the revision the customer was reading is refused if it has since been replaced", async () => {
    const { bookingId, revisionId: n } = await offered();
    await revise(bookingId, n, { priceCents: 140000 });
    const stale = await changeRequest(bookingId, n, "about the old terms");
    assert.deepEqual([stale.status, stale.body.code], [409, "stale_revision"]);
    assert.equal((await revisionRows(bookingId)).filter((row) => row.kind === "change_request").length, 0);
  });

  test("46. a retry with the same request id returns what was already saved; an edited retry under a new id is judged on its own and is not reported as saved", async () => {
    const { bookingId, revisionId: n } = await offered({ priceCents: 150000 });
    const requestId = randomUUID();
    const first = await revise(bookingId, n, { priceCents: 160000 }, { clientRequestId: requestId });
    assert.equal(first.status, 201);
    // Same id, same payload: the true network retry collapses onto the committed revision.
    const sameRetry = await revise(bookingId, n, { priceCents: 160000 }, { clientRequestId: requestId });
    assert.deepEqual([sameRetry.status, sameRetry.body.negotiation.revisions.length], [200, 2]);
    // The same id with edited terms would be answered with the OLD revision as if the edit were saved: this is why the client must rotate the id.
    const staleIdEdited = await revise(bookingId, n, { priceCents: 175000 }, { clientRequestId: requestId });
    assert.equal(staleIdEdited.status, 200);
    assert.equal(staleIdEdited.body.negotiation.revisions[0].priceCents, 160000, "the edit was NOT stored");
    // A rotated id for the edited payload is a new submission and is refused as stale rather than silently dropped.
    const rotated = await revise(bookingId, n, { priceCents: 175000 }, { clientRequestId: randomUUID() });
    assert.deepEqual([rotated.status, rotated.body.code], [409, "stale_revision"]);
    assert.deepEqual((await revisionRows(bookingId)).map((row) => Number(row.price_cents)), [150000, 160000]);
  });

  // ------------------------------------------------------------------ Final repair: first-offer retries
  const firstOffer = (inquiryId: string, body: Record<string, unknown>, who = PROVIDER) => call("POST", `/inquiries/${inquiryId}/provider-confirm`, tok(who), body);

  test("47. an exact retry of the first offer after a lost response is idempotent: still one booking, one revision 1, one notification", async () => {
    const inquiryId = await inquiry();
    const terms = { priceCents: 150000, guestCount: 45, note: "Buffet for 45" };
    const first = await firstOffer(inquiryId, terms);
    assert.equal(first.status, 201);
    assert.equal(await bookingCount(), 1);
    assert.equal((await revisionRows(first.body.booking.id)).length, 1);
    for (const retry of [{ ...terms }, { note: "Buffet for 45", guestCount: 45, priceCents: 150000 }, { ...terms, note: "  Buffet for 45  " }]) {
      const again = await firstOffer(inquiryId, retry);
      assert.equal(again.status, 200, again.text);
      assert.equal(again.body.booking.id, first.body.booking.id);
    }
    assert.equal(await bookingCount(), 1);
    assert.equal((await revisionRows(first.body.booking.id)).length, 1);
    assert.equal((await notificationsFor(CUSTOMER_A, "catering_booking_confirmation")).length, 1);
  });

  test("48. an edited retry of the first offer is refused with a conflict, writes nothing and is never reported as saved", async () => {
    const inquiryId = await inquiry();
    const first = await firstOffer(inquiryId, { priceCents: 150000, guestCount: 45, note: "A" });
    const bookingId = first.body.booking.id as string;
    const bookingBefore = await bookingRow(bookingId);
    const revisionBefore = await revisionRows(bookingId);
    const notificationsBefore = Number((await local.query(`SELECT count(*) FROM notifications`)).rows[0].count);
    for (const edited of [{ priceCents: 175000, guestCount: 45, note: "A" }, { priceCents: 150000, guestCount: 50, note: "A" }, { priceCents: 150000, guestCount: 45, note: "B" }, { priceCents: 150000, guestCount: 45 }, { priceCents: 150000, guestCount: 45, note: "A", currency: "EUR" }, { guestCount: 45, note: "A" }, { priceCents: 150000, guestCount: null, note: "A" }, { priceCents: 150000, note: "A" }, {}]) {
      const response = await firstOffer(inquiryId, edited);
      assert.deepEqual([response.status, response.body.code], [409, "offer_already_exists"], JSON.stringify(edited));
      assert.equal(response.body.booking, undefined, "no booking is returned as though it were the result");
    }
    assert.deepEqual(await bookingRow(bookingId), bookingBefore, "booking terms and timestamps are untouched");
    assert.deepEqual(await revisionRows(bookingId), revisionBefore, "revision 1 is untouched and no revision was added");
    assert.equal(await bookingCount(), 1);
    assert.equal(Number((await local.query(`SELECT count(*) FROM notifications`)).rows[0].count), notificationsBefore);
  });

  test("49. after an edited first-offer retry is refused, the normal revise path saves the edited terms", async () => {
    const inquiryId = await inquiry();
    const first = await firstOffer(inquiryId, { priceCents: 150000, guestCount: 45, note: "A" });
    const bookingId = first.body.booking.id as string;
    assert.equal((await firstOffer(inquiryId, { priceCents: 175000, guestCount: 45, note: "B" })).status, 409);
    const rev1 = (await revisionRows(bookingId))[0].id as string;
    const revised = await revise(bookingId, rev1, { priceCents: 175000, guestCount: 45, note: "B" });
    assert.equal(revised.status, 201, revised.text);
    assert.deepEqual([(await bookingRow(bookingId)).agreed_price, (await revisionRows(bookingId)).length], ["1750.00", 2]);
    // Retrying the ORIGINAL first request is still recognised as that offer's retry, even after it was revised.
    assert.equal((await firstOffer(inquiryId, { priceCents: 150000, guestCount: 45, note: "A" })).status, 200);
    assert.equal((await revisionRows(bookingId)).length, 2);
  });

  test("50. an explicit guestCount of null is compared as null: only a retry that also clears it is idempotent", async () => {
    const inquiryId = await inquiry();
    const first = await firstOffer(inquiryId, { priceCents: 100, guestCount: null });
    assert.equal(first.status, 201);
    assert.equal((await bookingRow(first.body.booking.id)).guest_count, null);
    assert.equal((await firstOffer(inquiryId, { priceCents: 100, guestCount: null })).status, 200);
    for (const different of [{ priceCents: 100 }, { priceCents: 100, guestCount: 40 }, { priceCents: 100, guestCount: 25 }]) {
      assert.equal((await firstOffer(inquiryId, different)).body.code, "offer_already_exists", JSON.stringify(different));
    }
    assert.equal((await bookingRow(first.body.booking.id)).guest_count, null);
  });

  test("51. a first-offer retry that omits the guest count matches an offer that took the request's own count, and a blank note equals none", async () => {
    const inquiryId = await inquiry();
    assert.equal((await firstOffer(inquiryId, { priceCents: 100 })).status, 201);
    assert.equal((await firstOffer(inquiryId, { priceCents: 100, guestCount: 40, note: "   " })).status, 200);
    assert.equal((await firstOffer(inquiryId, { priceCents: 100, guestCount: 41 })).body.code, "offer_already_exists");
  });

  test("52. a pre-2N offer with no revision rows: a retry of its own terms succeeds and a different one is refused, and nothing is back-filled", async () => {
    const { inquiryId, bookingId } = await legacyOffer();
    assert.equal((await firstOffer(inquiryId, {})).body.code, "offer_already_exists", "a body with no price is not the offer that was priced at 1200");
    assert.equal((await firstOffer(inquiryId, { agreedPrice: "1200.00" })).status, 200);
    assert.equal((await firstOffer(inquiryId, { priceCents: 120000, guestCount: 40 })).status, 200);
    assert.equal((await firstOffer(inquiryId, { agreedPrice: "1300.00" })).body.code, "offer_already_exists");
    assert.equal((await firstOffer(inquiryId, { note: "new terms" })).body.code, "offer_already_exists");
    assert.equal((await revisionRows(bookingId)).length, 0);
    assert.equal((await bookingRow(bookingId)).agreed_price, "1200.00");
  });

  test("53. concurrent exact first offers stay one booking and one revision; a concurrent edited one is refused or loses to the winner, never both saved", async () => {
    const inquiryId = await inquiry();
    const results = await Promise.all([firstOffer(inquiryId, { priceCents: 111 }), firstOffer(inquiryId, { priceCents: 111 }), firstOffer(inquiryId, { priceCents: 222 })]);
    assert.equal(await bookingCount(), 1);
    const bookingId = (await local.query(`SELECT id FROM catering_bookings`)).rows[0].id as string;
    const rows = await revisionRows(bookingId);
    assert.equal(rows.length, 1);
    const winner = Number(rows[0].price_cents);
    for (const [index, response] of results.entries()) {
      const price = [111, 111, 222][index];
      if (price === winner) assert.ok(response.status === 200 || response.status === 201, response.text);
      else assert.deepEqual([response.status, response.body.code], [409, "offer_already_exists"]);
    }
  });

  // ------------------------------------------------------------------ Billing invariant repair
  const issue = (bookingId: string, kind = "balance", who = PROVIDER) => call("POST", `/bookings/${bookingId}/billing/invoices`, tok(who), { kind });
  const invoiceRows = async (bookingId: string) => (await local.query(`SELECT * FROM catering_booking_invoices WHERE booking_id = $1 ORDER BY invoice_number`, [bookingId])).rows;
  const recordPayment = (bookingId: string, invoiceId: string, amount = "100.00") =>
    call("POST", `/bookings/${bookingId}/billing/payments`, tok(PROVIDER), { invoiceId, amount, method: "cash", receivedOn: "2026-01-01", idempotencyKey: randomUUID() });

  test("54. with no billing, price and currency can be revised freely", async () => {
    const { bookingId, revisionId } = await offered({ priceCents: 50000 });
    const priced = await revise(bookingId, revisionId, { priceCents: 40000 });
    assert.equal(priced.status, 201, priced.text);
    const euro = await revise(bookingId, priced.body.negotiation.currentRevisionId, { priceCents: 40000, currency: "EUR" });
    assert.equal(euro.status, 201, euro.text);
    assert.deepEqual([(await bookingRow(bookingId)).agreed_price, (await bookingRow(bookingId)).currency], ["400.00", "EUR"]);
  });

  test("55. an inert deposit-terms row does not lock the offer; it is planning, not ledger activity", async () => {
    const { bookingId, revisionId } = await offered({ priceCents: 50000 });
    await local.query(`INSERT INTO catering_booking_billing (booking_id, deposit_mode) VALUES ($1, 'none')`, [bookingId]);
    assert.equal((await revise(bookingId, revisionId, { priceCents: 45000 })).status, 201);
  });

  test("56. once an invoice exists, a price or currency revision is refused and nothing at all changes", async () => {
    const { bookingId, revisionId } = await offered({ priceCents: 50000 });
    const invoice = await issue(bookingId);
    assert.equal(invoice.status, 200, invoice.text);
    const bookingBefore = await bookingRow(bookingId);
    const revisionsBefore = await revisionRows(bookingId);
    const invoicesBefore = await invoiceRows(bookingId);
    const notificationsBefore = Number((await local.query(`SELECT count(*) FROM notifications`)).rows[0].count);
    for (const changed of [{ priceCents: 40000 }, { priceCents: 50000, currency: "EUR" }, { priceCents: null }, { priceCents: 60000, currency: "GBP" }]) {
      const response = await revise(bookingId, revisionId, changed);
      assert.deepEqual([response.status, response.body.code], [409, "billing_terms_locked"], JSON.stringify(changed));
      assert.match(response.body.message, /price and currency can no longer change/);
    }
    assert.deepEqual(await bookingRow(bookingId), bookingBefore);
    assert.deepEqual(await revisionRows(bookingId), revisionsBefore);
    assert.deepEqual(await invoiceRows(bookingId), invoicesBefore);
    assert.equal(Number((await local.query(`SELECT count(*) FROM notifications`)).rows[0].count), notificationsBefore, "no 'offer revised' notice for a refused revision");
  });

  test("57. after billing, a revision that keeps price and currency is still legal, so guests and the terms note can change", async () => {
    const { bookingId, revisionId } = await offered({ priceCents: 50000, guestCount: 40, note: "old" });
    await issue(bookingId);
    const response = await revise(bookingId, revisionId, { priceCents: 50000, guestCount: 55, note: "new menu" });
    assert.equal(response.status, 201, response.text);
    const booking = await bookingRow(bookingId);
    assert.deepEqual([booking.agreed_price, booking.guest_count, booking.currency], ["500.00", 55, "USD"]);
    assert.equal((await invoiceRows(bookingId))[0].amount_cents, "50000");
  });

  test("58. payments alone also lock the commercial terms, and recording a payment stays compatible with the locked currency", async () => {
    const { bookingId, revisionId } = await offered({ priceCents: 50000 });
    const invoice = await issue(bookingId);
    const invoiceId = invoice.body.billing?.invoices?.[0]?.id ?? (await invoiceRows(bookingId))[0].id;
    const paid = await recordPayment(bookingId, invoiceId);
    assert.equal(paid.status, 200, paid.text);
    assert.equal((await local.query(`SELECT currency FROM catering_booking_payments WHERE booking_id = $1`, [bookingId])).rows[0].currency, "USD");
    assert.equal((await revise(bookingId, revisionId, { priceCents: 50000, currency: "EUR" })).body.code, "billing_terms_locked");
    assert.equal((await bookingRow(bookingId)).currency, "USD");
  });

  test("59. a voided invoice with no payments is not live ledger activity, so terms may change again", async () => {
    const { bookingId, revisionId } = await offered({ priceCents: 50000 });
    await issue(bookingId);
    const row = (await invoiceRows(bookingId))[0];
    const voided = await call("POST", `/bookings/${bookingId}/billing/invoices/${row.id}/void`, tok(PROVIDER), { reason: "mistake", expectedUpdatedAt: new Date(row.updated_at).toISOString() });
    assert.equal(voided.status, 200, voided.text);
    assert.equal((await revise(bookingId, revisionId, { priceCents: 40000 })).status, 201);
  });

  test("60. a legacy pending offer with an existing invoice cannot enter the revision history with a changed price or currency", async () => {
    const { bookingId } = await legacyOffer();
    const invoice = await issue(bookingId);
    assert.equal(invoice.status, 200, invoice.text);
    assert.equal((await revise(bookingId, null, { priceCents: 40000, guestCount: 40 })).body.code, "billing_terms_locked");
    assert.equal((await revise(bookingId, null, { priceCents: 120000, guestCount: 40, currency: "EUR" })).body.code, "billing_terms_locked");
    assert.equal((await revisionRows(bookingId)).length, 0, "no first revision was written");
    assert.equal((await bookingRow(bookingId)).agreed_price, "1200.00");
    const same = await revise(bookingId, null, { priceCents: 120000, guestCount: 42, note: "same money, new detail" });
    assert.equal(same.status, 201, same.text);
    assert.equal((await bookingRow(bookingId)).agreed_price, "1200.00");
  });

  test("61. revision first, then invoice: the invoice is issued on the revised terms; invoice first, then revision: the changed terms are refused", async () => {
    const a = await offered({ priceCents: 50000 });
    assert.equal((await revise(a.bookingId, a.revisionId, { priceCents: 40000 })).status, 201);
    await issue(a.bookingId);
    assert.equal((await invoiceRows(a.bookingId))[0].amount_cents, "40000");
    const b = await offered({ priceCents: 50000 });
    await issue(b.bookingId);
    assert.equal((await revise(b.bookingId, b.revisionId, { priceCents: 40000 })).body.code, "billing_terms_locked");
    assert.equal((await invoiceRows(b.bookingId))[0].amount_cents, "50000");
    assert.equal((await bookingRow(b.bookingId)).agreed_price, "500.00");
  });

  test("62. a revision racing invoice creation can never leave an invoice and a booking that disagree", async () => {
    let revisionWon = 0;
    let invoiceWon = 0;
    for (let round = 0; round < 24; round += 1) {
      const { bookingId, revisionId } = await offered({ priceCents: 50000 });
      // Staggered starts in both directions, so both orders (and the true overlap) are exercised across rounds.
      const lead = [0, 4, 8, 12][round % 4];
      const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
      const [revised, invoiced] = await Promise.all([
        round % 2 === 0 ? wait(lead).then(() => revise(bookingId, revisionId, { priceCents: 40000 })) : revise(bookingId, revisionId, { priceCents: 40000 }),
        round % 2 === 0 ? issue(bookingId) : wait(lead).then(() => issue(bookingId)),
      ]);
      assert.equal(invoiced.status, 200, invoiced.text);
      const booking = await bookingRow(bookingId);
      const invoices = await invoiceRows(bookingId);
      assert.equal(invoices.length, 1);
      assert.equal(invoices[0].amount_cents, String(Math.round(Number(booking.agreed_price) * 100)), "the invoice is always for exactly what the booking now says");
      assert.equal(invoices[0].currency, booking.currency);
      if (revised.status === 201) { revisionWon += 1; assert.equal(invoices[0].amount_cents, "40000"); }
      else { invoiceWon += 1; assert.deepEqual([revised.status, revised.body.code], [409, "billing_terms_locked"]); assert.equal(invoices[0].amount_cents, "50000"); }
      assert.equal((await revisionRows(bookingId)).length, revised.status === 201 ? 2 : 1);
    }
    assert.equal(revisionWon + invoiceWon, 24);
    assert.ok(revisionWon > 0 && invoiceWon > 0, `both orders occurred (revision first ${revisionWon}, invoice first ${invoiceWon})`);
  });

  test("63. accepting terms that would contradict a live ledger is refused, and nothing is confirmed", async () => {
    const { bookingId } = await offered({ priceCents: 50000 });
    await issue(bookingId);
    // A state the routes cannot produce (a newer revision whose price the booking does not carry), forced directly.
    const { rows } = await local.query(
      `INSERT INTO catering_offer_revisions (booking_id, revision_number, kind, proposed_by_user_id, proposed_by_role, client_request_id, price_cents, currency, guest_count) VALUES ($1, 2, 'offer', $2, 'provider', $3, 40000, 'USD', 40) RETURNING id`,
      [bookingId, PROVIDER, randomUUID()]);
    const refused = await accept(bookingId, rows[0].id);
    assert.deepEqual([refused.status, refused.body.code], [409, "billing_terms_locked"]);
    const booking = await bookingRow(bookingId);
    assert.deepEqual([booking.status, booking.agreed_price, booking.customer_confirmed_at], ["pending_confirmation", "500.00", null]);
    assert.equal((await revisionRows(bookingId)).filter((row) => row.accepted_at).length, 0);
  });

  test("64. a normal acceptance still works with billing present when the terms agree", async () => {
    const { bookingId, revisionId } = await offered({ priceCents: 50000 });
    await issue(bookingId);
    assert.equal((await accept(bookingId, revisionId)).status, 200);
    assert.equal((await bookingRow(bookingId)).status, "confirmed");
    assert.equal((await invoiceRows(bookingId))[0].amount_cents, "50000");
  });

  // ---------------------------------------------------------------------- Phase 2M rules stay intact
  test("39. inquiry withdrawal semantics are unchanged: refused once a booking exists, and never mutates it", async () => {
    const { inquiryId, bookingId } = await offered();
    const before = await bookingRow(bookingId);
    const refused = await call("POST", `/inquiries/${inquiryId}/withdraw`, tok(CUSTOMER_A), {});
    assert.deepEqual([refused.status, refused.body.code], [409, "inquiry_has_booking"]);
    assert.deepEqual(await bookingRow(bookingId), before);
    assert.equal((await revisionRows(bookingId)).length, 1);
    const free = await inquiry({ status: "pending" });
    assert.equal((await call("POST", `/inquiries/${free}/withdraw`, tok(CUSTOMER_A), {})).status, 200);
  });

  test("40. the customer's request list shows the revised terms the booking mirrors, and only the customer's own", async () => {
    const { bookingId, revisionId } = await offered({ priceCents: 150000 });
    await revise(bookingId, revisionId, { priceCents: 141500 });
    const list = await call("GET", "/inquiries/mine", tok(CUSTOMER_A));
    assert.equal(list.body.inquiries[0].stage, "offered");
    assert.equal(list.body.inquiries[0].booking.agreedPrice, "1415.00");
    const other = await call("GET", "/inquiries/mine", tok(CUSTOMER_B));
    assert.deepEqual(other.body.inquiries, []);
  });

  test("41. unauthenticated callers are refused on every negotiation route", async () => {
    const { bookingId, revisionId } = await offered();
    for (const [method, route, body] of [["POST", `/bookings/${bookingId}/offer/revisions`, { expectedRevisionId: revisionId, clientRequestId: randomUUID() }], ["POST", `/bookings/${bookingId}/offer/change-requests`, { revisionId, message: "x", clientRequestId: randomUUID() }], ["POST", `/bookings/${bookingId}/customer-confirm`, { revisionId }]] as const) {
      assert.equal((await call(method, route, {}, body)).status, 401, route);
    }
    assert.equal((await revisionRows(bookingId)).length, 1);
  });
}
