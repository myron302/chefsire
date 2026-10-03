/**
 * Phase 2M: the customer inquiry lifecycle as real HTTP against the real catering routers, with every rendered SQL
 * statement executed by a REAL PostgreSQL. The tables are built from the repository's own catering migrations, so the
 * additive contact-column migration is exercised too.
 *
 * Set CATERING_TEST_PG_URL to a loopback database whose name contains "test"; the suite is skipped otherwise. The
 * database is reset (its public schema is dropped) on every run, which is why the loopback guard exists.
 */
import "../test-support/accept-test-sessions";
import "../test-support/auth-test-env";
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import express from "express";
import pg from "pg";
import type { AddressInfo } from "node:net";
import { signAuthToken } from "../lib/jwt-config";
import { parseLocalTestDatabaseUrl } from "../test-support/local-test-database";

process.env.DATABASE_URL ||= "postgres://u:p@catering-inquiry-tests.invalid/none";
const PG_URL = process.env.CATERING_TEST_PG_URL;
const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(here, "..", "..");

const CUSTOMER_A = "customer-a";
const CUSTOMER_B = "customer-b";
const PROVIDER = "provider-1";
const OTHER_PROVIDER = "provider-2";
const tok = (id: string) => ({ authorization: `Bearer ${signAuthToken({ id, av: 1 } as never)}` });

if (!PG_URL) {
  test("catering customer inquiry lifecycle over HTTP (skipped: CATERING_TEST_PG_URL not set)", { skip: true }, () => {});
} else {
  const local = new pg.Pool(parseLocalTestDatabaseUrl(PG_URL));
  const { pool } = await import("../db/index");
  (pool as never as { connect: unknown }).connect = () => local.connect();
  (pool as never as { query: unknown }).query = (q: unknown, params?: unknown[]) =>
    typeof q === "string" ? local.query(q, params) : local.query(params ? { ...(q as object), values: params } as never : q as never);

  const sqlFile = (relative: string) => fs.readFileSync(path.join(root, relative), "utf8");
  await local.query(`DROP SCHEMA public CASCADE; CREATE SCHEMA public;`);
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
  for (const file of ["migrations/010_create_catering_packages.sql", "server/migrations/20260812_catering_availability.sql", "server/migrations/20260827_catering_bookings.sql", "server/migrations/20260829_catering_booking_operations.sql", "server/migrations/20261004_catering_offer_negotiation.sql"]) {
    await local.query(sqlFile(file));
  }
  const contactMigration = sqlFile("server/migrations/20261003_catering_inquiry_contact.sql");
  await local.query(contactMigration);

  const { default: cateringRouter } = await import("./catering");
  const { default: bookingsRouter } = await import("./catering-bookings");
  const app = express();
  app.use(express.json());
  app.use("/api/catering", cateringRouter);
  app.use("/api/catering", bookingsRouter);
  const server = app.listen(0);
  test.after(async () => { server.close(); await local.end(); });
  const base = () => `http://127.0.0.1:${(server.address() as AddressInfo).port}/api/catering`;
  const call = async (method: string, route: string, headers: Record<string, string> = {}, body?: unknown) => {
    const response = await fetch(`${base()}${route}`, { method, headers: { ...headers, ...(body === undefined ? {} : { "content-type": "application/json" }) }, body: body === undefined ? undefined : JSON.stringify(body) });
    const text = await response.text();
    return { status: response.status, text, body: text ? JSON.parse(text) : null };
  };

  let sequence = 0;
  async function inquiry(input: { customer?: string; provider?: string; status?: string; createdAt?: string; id?: string; email?: string | null; phone?: string | null; message?: string } = {}) {
    const id = input.id ?? `00000000-0000-4000-8000-${String(++sequence).padStart(12, "0")}`;
    await local.query(
      `INSERT INTO catering_inquiries (id, customer_id, chef_id, event_date, guest_count, event_type, message, status, created_at, customer_email, customer_phone)
       VALUES ($1, $2, $3, '2027-05-20', 40, 'wedding', $4, $5, COALESCE($6::timestamp, now()), $7, $8)`,
      [id, input.customer ?? CUSTOMER_A, input.provider ?? PROVIDER, input.message ?? "customer note", input.status ?? "pending", input.createdAt ?? null, input.email ?? null, input.phone ?? null]);
    return id;
  }
  async function booking(inquiryId: string, status = "pending_confirmation", customer = CUSTOMER_A, provider = PROVIDER) {
    const confirmed = status === "pending_confirmation" ? "NULL" : "now()";
    const { rows } = await local.query(
      `INSERT INTO catering_bookings (inquiry_id, provider_id, customer_id, event_date, agreed_price, currency, status, provider_confirmed_at, customer_confirmed_at, confirmed_at)
       VALUES ($1, $2, $3, '2027-05-20', 1200.00, 'USD', $4, now(), ${confirmed}, ${confirmed}) RETURNING id`, [inquiryId, provider, customer, status]);
    return rows[0].id as string;
  }
  const statusOf = async (id: string) => (await local.query(`SELECT status FROM catering_inquiries WHERE id = $1`, [id])).rows[0]?.status as string | undefined;
  const bookingRows = async (id: string) => (await local.query(`SELECT id, status, cancelled_at FROM catering_bookings WHERE inquiry_id = $1`, [id])).rows;
  const notificationsFor = async (userId: string, type: string) => (await local.query(`SELECT title, message, link_url FROM notifications WHERE user_id = $1 AND type = $2`, [userId, type])).rows;

  test.beforeEach(async () => {
    await local.query(`TRUNCATE notifications, catering_booking_activity, catering_bookings, catering_inquiries, users CASCADE`);
    await local.query(`INSERT INTO users (id, username, display_name) VALUES ($1, 'ann', 'Ann A'), ($2, 'bob', 'Bob B'), ($3, 'chef1', 'Chef One'), ($4, 'chef2', NULL)`, [CUSTOMER_A, CUSTOMER_B, PROVIDER, OTHER_PROVIDER]);
  });

  // ---------------------------------------------------------------------------------------------------- migration
  test("the contact migration is additive, idempotent, and leaves existing rows with NULL contact", async () => {
    const id = await inquiry();
    await local.query(contactMigration);
    await local.query(contactMigration);
    const { rows } = await local.query(`SELECT customer_email, customer_phone, message FROM catering_inquiries WHERE id = $1`, [id]);
    assert.deepEqual(rows[0], { customer_email: null, customer_phone: null, message: "customer note" });
    const columns = await local.query(`SELECT column_name, is_nullable, character_maximum_length FROM information_schema.columns WHERE table_schema = current_schema() AND table_name = 'catering_inquiries' AND column_name IN ('customer_email', 'customer_phone') ORDER BY column_name`);
    assert.deepEqual(columns.rows, [
      { column_name: "customer_email", is_nullable: "YES", character_maximum_length: 254 },
      { column_name: "customer_phone", is_nullable: "YES", character_maximum_length: 32 },
    ]);
  });

  // ---------------------------------------------------------------------------------------------------- list
  test("unauthenticated list and withdraw are refused", async () => {
    const id = await inquiry();
    assert.equal((await call("GET", "/inquiries/mine")).status, 401);
    assert.equal((await call("POST", `/inquiries/${id}/withdraw`)).status, 401);
    assert.equal(await statusOf(id), "pending");
  });

  test("a customer lists only their own inquiries, with the provider, and nothing from another customer", async () => {
    const mine = await inquiry({ customer: CUSTOMER_A, provider: PROVIDER, message: "mine-secret-text" });
    await inquiry({ customer: CUSTOMER_B, provider: PROVIDER, message: "bobs-private-request" });
    const asA = await call("GET", "/inquiries/mine", tok(CUSTOMER_A));
    assert.equal(asA.status, 200);
    assert.deepEqual(asA.body.inquiries.map((item: { id: string }) => item.id), [mine]);
    assert.equal(asA.body.inquiries[0].provider.displayName, "Chef One");
    assert.doesNotMatch(asA.text, /bobs-private-request|customer-b|bob@/);
    const asB = await call("GET", "/inquiries/mine", tok(CUSTOMER_B));
    assert.doesNotMatch(asB.text, /mine-secret-text/);
    assert.equal(asB.body.pagination.total, 1);
  });

  test("a customerId in the query, body or path cannot change whose inquiries are listed", async () => {
    await inquiry({ customer: CUSTOMER_B, message: "bobs-private-request" });
    const spoofed = await call("GET", `/inquiries/mine?customerId=${CUSTOMER_B}&userId=${CUSTOMER_B}`, tok(CUSTOMER_A));
    assert.equal(spoofed.status, 200);
    assert.deepEqual(spoofed.body.inquiries, []);
    assert.equal(spoofed.body.pagination.total, 0);
    assert.doesNotMatch(spoofed.text, /bobs-private-request/);
  });

  test("a provider using the customer endpoint sees only inquiries they themselves sent as a customer", async () => {
    await inquiry({ customer: CUSTOMER_A, provider: PROVIDER, message: "received-by-provider" });
    const asProvider = await call("GET", "/inquiries/mine", tok(PROVIDER));
    assert.equal(asProvider.status, 200);
    assert.deepEqual(asProvider.body.inquiries, []);
    assert.doesNotMatch(asProvider.text, /received-by-provider/);
  });

  test("empty history is an honest empty page, not mock data", async () => {
    const response = await call("GET", "/inquiries/mine", tok(CUSTOMER_A));
    assert.deepEqual(response.body, { inquiries: [], pagination: { page: 1, limit: 20, total: 0, totalPages: 0 } });
  });

  test("declined, withdrawn and booked inquiries all stay in the customer's history with the right stage", async () => {
    const declined = await inquiry({ status: "declined", createdAt: "2027-01-05" });
    const withdrawn = await inquiry({ status: "cancelled", createdAt: "2027-01-04" });
    const offered = await inquiry({ status: "accepted", createdAt: "2027-01-03" });
    const bookedInquiry = await inquiry({ status: "accepted", createdAt: "2027-01-02" });
    const accepted = await inquiry({ status: "accepted", createdAt: "2027-01-01" });
    const offeredBooking = await booking(offered, "pending_confirmation");
    const confirmedBooking = await booking(bookedInquiry, "confirmed");
    const { body } = await call("GET", "/inquiries/mine", tok(CUSTOMER_A));
    const byId = Object.fromEntries(body.inquiries.map((item: { id: string }) => [item.id, item]));
    assert.equal(body.inquiries.length, 5);
    assert.equal(byId[declined].stage, "declined");
    assert.equal(byId[declined].canWithdraw, false);
    assert.equal(byId[withdrawn].stage, "withdrawn");
    assert.equal(byId[withdrawn].canWithdraw, false);
    assert.equal(byId[accepted].stage, "accepted_awaiting_offer");
    assert.equal(byId[accepted].canWithdraw, true);
    assert.equal(byId[accepted].booking, null);
    assert.equal(byId[offered].stage, "offered");
    assert.equal(byId[offered].canWithdraw, false);
    assert.equal(byId[offered].booking.id, offeredBooking);
    assert.equal(byId[offered].booking.agreedPrice, "1200.00");
    assert.equal(byId[bookedInquiry].stage, "booked");
    assert.equal(byId[bookedInquiry].booking.id, confirmedBooking);
  });

  test("a customer response carries no provider-private or internal fields", async () => {
    const id = await inquiry({ status: "accepted", email: "ann@example.com", phone: "+1 555 010 2030" });
    await booking(id);
    const { body, text } = await call("GET", "/inquiries/mine", tok(CUSTOMER_A));
    const item = body.inquiries[0];
    assert.deepEqual(Object.keys(item).sort(), ["booking", "budget", "canWithdraw", "contactEmail", "contactPhone", "cuisinePreferences", "eventDate", "eventType", "guestCount", "id", "message", "packageTitle", "provider", "stage", "status", "submittedAt"]);
    assert.deepEqual(Object.keys(item.provider).sort(), ["displayName", "id"]);
    assert.deepEqual(Object.keys(item.booking).sort(), ["agreedPrice", "currency", "customerConfirmedAt", "id", "providerConfirmedAt", "status"]);
    assert.doesNotMatch(text, /chefId|customerId|cancellationReason|cancelledBy|password|email":"chef/);
    assert.equal(item.contactEmail, "ann@example.com");
    assert.equal(item.contactPhone, "+1 555 010 2030");
  });

  test("legacy inquiries without structured contact serialize with null contact and their original message intact", async () => {
    await inquiry({ message: "Please call.\nEmail: old@example.com", email: null, phone: null });
    const { body } = await call("GET", "/inquiries/mine", tok(CUSTOMER_A));
    assert.equal(body.inquiries[0].contactEmail, null);
    assert.equal(body.inquiries[0].contactPhone, null);
    assert.equal(body.inquiries[0].message, "Please call.\nEmail: old@example.com");
  });

  test("a caterer with no display name falls back to a username, never to an empty string", async () => {
    await inquiry({ provider: OTHER_PROVIDER });
    const { body } = await call("GET", "/inquiries/mine", tok(CUSTOMER_A));
    assert.equal(body.inquiries[0].provider.displayName, "chef2");
  });

  test("pagination is bounded, deterministic across equal timestamps, and never crosses ownership", async () => {
    const stamp = "2027-02-01 10:00:00";
    const ids: string[] = [];
    for (let index = 0; index < 5; index++) ids.push(await inquiry({ createdAt: stamp }));
    for (let index = 0; index < 4; index++) await inquiry({ customer: CUSTOMER_B, createdAt: stamp });
    const expected = [...ids].sort().reverse();
    const first = await call("GET", "/inquiries/mine?page=1&limit=2", tok(CUSTOMER_A));
    const second = await call("GET", "/inquiries/mine?page=2&limit=2", tok(CUSTOMER_A));
    const third = await call("GET", "/inquiries/mine?page=3&limit=2", tok(CUSTOMER_A));
    const walked = [...first.body.inquiries, ...second.body.inquiries, ...third.body.inquiries].map((item: { id: string }) => item.id);
    assert.deepEqual(walked, expected);
    assert.equal(new Set(walked).size, 5);
    assert.deepEqual(first.body.pagination, { page: 1, limit: 2, total: 5, totalPages: 3 });
    assert.equal((await call("GET", "/inquiries/mine?page=4&limit=2", tok(CUSTOMER_A))).body.inquiries.length, 0);
    assert.equal((await call("GET", "/inquiries/mine?limit=51", tok(CUSTOMER_A))).status, 400);
    assert.equal((await call("GET", "/inquiries/mine?limit=0", tok(CUSTOMER_A))).status, 400);
    assert.equal((await call("GET", "/inquiries/mine?page=0", tok(CUSTOMER_A))).status, 400);
    assert.equal((await call("GET", "/inquiries/mine", tok(CUSTOMER_A))).body.pagination.limit, 20);
  });

  // ---------------------------------------------------------------------------------------------------- withdraw
  test("a pending inquiry can be withdrawn; the provider is told once", async () => {
    const id = await inquiry();
    const response = await call("POST", `/inquiries/${id}/withdraw`, tok(CUSTOMER_A));
    assert.equal(response.status, 200);
    assert.deepEqual(response.body.inquiry, { id, status: "cancelled" });
    assert.equal(await statusOf(id), "cancelled");
    const sent = await notificationsFor(PROVIDER, "catering_inquiry_withdrawn");
    assert.equal(sent.length, 1);
    assert.equal(sent[0].link_url, "/services/catering/provider#inquiries");
    assert.doesNotMatch(JSON.stringify(sent), /ann|@|555/i);
  });

  test("an accepted inquiry with no booking yet can still be withdrawn", async () => {
    const id = await inquiry({ status: "accepted" });
    assert.equal((await call("POST", `/inquiries/${id}/withdraw`, tok(CUSTOMER_A))).status, 200);
    assert.equal(await statusOf(id), "cancelled");
  });

  test("withdrawal is idempotent: a retry answers the same, writes nothing new and notifies nobody again", async () => {
    const id = await inquiry();
    const first = await call("POST", `/inquiries/${id}/withdraw`, tok(CUSTOMER_A));
    const retry = await call("POST", `/inquiries/${id}/withdraw`, tok(CUSTOMER_A));
    assert.equal(first.status, 200);
    assert.equal(retry.status, 200);
    assert.deepEqual(retry.body.inquiry, first.body.inquiry);
    assert.equal((await notificationsFor(PROVIDER, "catering_inquiry_withdrawn")).length, 1);
  });

  test("an inquiry that has produced a booking cannot be withdrawn, and the booking is left exactly as it was", async () => {
    for (const bookingStatus of ["pending_confirmation", "confirmed", "completed", "cancelled"]) {
      const id = await inquiry({ status: "accepted" });
      const bookingId = await booking(id, bookingStatus);
      const before = await bookingRows(id);
      const response = await call("POST", `/inquiries/${id}/withdraw`, tok(CUSTOMER_A));
      assert.equal(response.status, 409, bookingStatus);
      assert.equal(response.body.code, "inquiry_has_booking");
      assert.equal(await statusOf(id), "accepted");
      assert.deepEqual(await bookingRows(id), before);
      assert.equal(before[0].id, bookingId);
    }
    assert.equal((await notificationsFor(PROVIDER, "catering_inquiry_withdrawn")).length, 0);
    assert.equal((await local.query(`SELECT count(*)::int AS n FROM catering_booking_activity`)).rows[0].n, 0);
  });

  test("a legacy inquiry whose status column is NULL is an open inquiry and can be withdrawn", async () => {
    const id = await inquiry();
    await local.query(`UPDATE catering_inquiries SET status = NULL WHERE id = $1`, [id]);
    const listed = await call("GET", "/inquiries/mine", tok(CUSTOMER_A));
    assert.equal(listed.body.inquiries[0].stage, "awaiting_provider");
    assert.equal(listed.body.inquiries[0].canWithdraw, true);
    assert.equal((await call("POST", `/inquiries/${id}/withdraw`, tok(CUSTOMER_A))).status, 200);
    assert.equal(await statusOf(id), "cancelled");
  });

  test("a declined inquiry cannot be withdrawn", async () => {
    const id = await inquiry({ status: "declined" });
    const response = await call("POST", `/inquiries/${id}/withdraw`, tok(CUSTOMER_A));
    assert.equal(response.status, 409);
    assert.equal(response.body.code, "inquiry_not_withdrawable");
    assert.equal(await statusOf(id), "declined");
  });

  test("another customer, the provider and a stranger all get the same 404 as a nonexistent inquiry, and nothing changes", async () => {
    const id = await inquiry();
    const missing = await call("POST", `/inquiries/00000000-0000-4000-8000-0000000000ff/withdraw`, tok(CUSTOMER_B));
    const malformed = await call("POST", `/inquiries/not-a-uuid/withdraw`, tok(CUSTOMER_B));
    assert.equal(missing.status, 404);
    for (const actor of [CUSTOMER_B, PROVIDER, OTHER_PROVIDER]) {
      const response = await call("POST", `/inquiries/${id}/withdraw`, tok(actor));
      assert.equal(response.status, 404, actor);
      assert.deepEqual(response.body, missing.body);
    }
    assert.deepEqual(malformed.body, missing.body);
    assert.equal(await statusOf(id), "pending");
    assert.equal((await notificationsFor(PROVIDER, "catering_inquiry_withdrawn")).length, 0);
  });

  test("a body naming a customer or status cannot give anyone else authority or change the outcome", async () => {
    const id = await inquiry();
    const forged = await call("POST", `/inquiries/${id}/withdraw`, tok(CUSTOMER_B), { customerId: CUSTOMER_A, status: "accepted", actor: "customer" });
    assert.equal(forged.status, 404);
    assert.equal(await statusOf(id), "pending");
    const own = await call("POST", `/inquiries/${id}/withdraw`, tok(CUSTOMER_A), { customerId: CUSTOMER_B, status: "accepted" });
    assert.equal(own.status, 200);
    assert.equal(await statusOf(id), "cancelled");
  });

  test("a notification failure never falsifies the withdrawal", async () => {
    const id = await inquiry();
    await local.query(`ALTER TABLE notifications RENAME TO notifications_off`);
    try {
      const response = await call("POST", `/inquiries/${id}/withdraw`, tok(CUSTOMER_A));
      assert.equal(response.status, 200);
      assert.equal(await statusOf(id), "cancelled");
    } finally {
      await local.query(`ALTER TABLE notifications_off RENAME TO notifications`);
    }
  });

  // ---------------------------------------------------------------------------------------------------- PUT transitions
  test("a provider decline notifies the customer once, truthfully, with a valid link", async () => {
    const id = await inquiry();
    assert.equal((await call("PUT", `/inquiries/${id}`, tok(PROVIDER), { status: "declined" })).status, 200);
    assert.equal(await statusOf(id), "declined");
    const sent = await notificationsFor(CUSTOMER_A, "catering_inquiry_declined");
    assert.equal(sent.length, 1);
    assert.equal(sent[0].link_url, "/services/catering#my-requests");
    assert.doesNotMatch(JSON.stringify(sent), /@|555/);
    // A repeated decline is refused as a transition and so cannot notify again.
    assert.equal((await call("PUT", `/inquiries/${id}`, tok(PROVIDER), { status: "declined" })).status, 409);
    assert.equal((await notificationsFor(CUSTOMER_A, "catering_inquiry_declined")).length, 1);
  });

  test("accepting an inquiry sends no new notification, and a provider cannot cancel one", async () => {
    const id = await inquiry();
    assert.equal((await call("PUT", `/inquiries/${id}`, tok(PROVIDER), { status: "cancelled" })).status, 409);
    assert.equal((await call("PUT", `/inquiries/${id}`, tok(PROVIDER), { status: "accepted" })).status, 200);
    assert.equal((await local.query(`SELECT count(*)::int AS n FROM notifications`)).rows[0].n, 0);
  });

  test("the legacy status PUT withdraws through the same rule, and refuses once a booking exists", async () => {
    const free = await inquiry({ status: "accepted" });
    assert.equal((await call("PUT", `/inquiries/${free}`, tok(CUSTOMER_A), { status: "cancelled" })).status, 200);
    assert.equal(await statusOf(free), "cancelled");
    const booked = await inquiry({ status: "accepted" });
    await booking(booked);
    assert.equal((await call("PUT", `/inquiries/${booked}`, tok(CUSTOMER_A), { status: "cancelled" })).status, 409);
    assert.equal(await statusOf(booked), "accepted");
    assert.equal((await call("PUT", `/inquiries/${booked}`, tok(CUSTOMER_A), { status: "accepted" })).status, 409);
  });

  // ---------------------------------------------------------------------------------------------------- race
  test("a withdrawal in flight holds the row, so the provider's offer waits and is then refused", async () => {
    const id = await inquiry({ status: "accepted" });
    const holder = await local.connect();
    try {
      await holder.query("BEGIN");
      await holder.query(`SELECT 1 FROM catering_inquiries WHERE id = $1 FOR UPDATE`, [id]);
      const offer = call("POST", `/inquiries/${id}/provider-confirm`, tok(PROVIDER), {});
      const settledEarly = await Promise.race([offer.then(() => "settled"), new Promise((resolve) => setTimeout(() => resolve("waiting"), 400))]);
      assert.equal(settledEarly, "waiting", "the offer must queue behind the lock rather than read a stale status");
      await holder.query(`UPDATE catering_inquiries SET status = 'cancelled' WHERE id = $1`, [id]);
      await holder.query("COMMIT");
      const answered = await offer;
      assert.equal(answered.status, 409);
      assert.deepEqual(await bookingRows(id), []);
      assert.equal(await statusOf(id), "cancelled");
    } finally {
      holder.release();
    }
  });

  test("an offer in flight holds the row, so the customer's withdrawal waits and is then refused", async () => {
    const id = await inquiry({ status: "accepted" });
    const holder = await local.connect();
    let bookingId = "";
    try {
      await holder.query("BEGIN");
      await holder.query(`SELECT 1 FROM catering_inquiries WHERE id = $1 FOR UPDATE`, [id]);
      const withdrawal = call("POST", `/inquiries/${id}/withdraw`, tok(CUSTOMER_A));
      const settledEarly = await Promise.race([withdrawal.then(() => "settled"), new Promise((resolve) => setTimeout(() => resolve("waiting"), 400))]);
      assert.equal(settledEarly, "waiting", "the withdrawal must queue behind the lock rather than read a stale booking list");
      const inserted = await holder.query(`INSERT INTO catering_bookings (inquiry_id, provider_id, customer_id, event_date, currency, provider_confirmed_at) VALUES ($1, $2, $3, '2027-05-20', 'USD', now()) RETURNING id`, [id, PROVIDER, CUSTOMER_A]);
      bookingId = inserted.rows[0].id;
      await holder.query("COMMIT");
      const answered = await withdrawal;
      assert.equal(answered.status, 409);
      assert.equal(answered.body.code, "inquiry_has_booking");
      assert.equal(await statusOf(id), "accepted");
      assert.deepEqual((await bookingRows(id)).map((row: { id: string; status: string }) => [row.id, row.status]), [[bookingId, "pending_confirmation"]]);
    } finally {
      holder.release();
    }
  });

  test("withdrawing and offering at the same instant always ends in one coherent state", async () => {
    const outcomes = new Set<string>();
    for (let round = 0; round < 30; round++) {
      const id = await inquiry({ status: "accepted" });
      const [withdrawal, offer] = await Promise.all([
        call("POST", `/inquiries/${id}/withdraw`, tok(CUSTOMER_A)),
        call("POST", `/inquiries/${id}/provider-confirm`, tok(PROVIDER), {}),
      ]);
      const status = await statusOf(id);
      const bookings = await bookingRows(id);
      assert.ok(bookings.length <= 1, "never a duplicate booking");
      if (bookings.length === 1) {
        assert.equal(status, "accepted", "a booked inquiry is never also withdrawn");
        assert.equal(withdrawal.status, 409);
        assert.ok(offer.status === 201 || offer.status === 200);
        assert.equal(bookings[0].status, "pending_confirmation");
        assert.equal(bookings[0].cancelled_at, null, "withdrawal never cancels a booking");
        outcomes.add("booked");
      } else {
        assert.equal(status, "cancelled");
        assert.equal(withdrawal.status, 200);
        assert.equal(offer.status, 409);
        outcomes.add("withdrawn");
      }
    }
    assert.ok(outcomes.size >= 1);
  });

  test("two simultaneous withdrawals write one transition and send one notification", async () => {
    const id = await inquiry();
    const results = await Promise.all([1, 2, 3].map(() => call("POST", `/inquiries/${id}/withdraw`, tok(CUSTOMER_A))));
    assert.deepEqual(results.map((result) => result.status), [200, 200, 200]);
    assert.equal(await statusOf(id), "cancelled");
    assert.equal((await notificationsFor(PROVIDER, "catering_inquiry_withdrawn")).length, 1);
  });
}
