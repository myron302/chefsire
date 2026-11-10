/** Part 3b: conservative local eligibility reads on isolated PostgreSQL. No account closure. */
import test from "node:test";
import assert from "node:assert/strict";
import { PG_URL, connectLocalPg, ddl } from "../test-support/authz-pg-harness";
import { inspectLocalClosureObligations, ClosureObligationsUnavailableError } from "./closure-obligations";
import { sql } from "drizzle-orm";

if (!PG_URL) {
  test("Part 3b obligation inventory needs CS_TEST_PG_URL", { skip: true }, () => {});
} else {
  test("local obligations are read-only, block unresolved financial ledgers, and fail closed on schema gaps", async () => {
    const local = await connectLocalPg();
    const { db } = await import("../db");
    const { users } = await import("../../shared/schema");
    const tables = [
      "subscription_history", "drink_bundle_checkout_sessions", "catering_booking_payments",
      "catering_booking_invoices", "catering_bookings",
      "wedding_square_enrollment_attempts", "wedding_square_subscriptions",
      "payouts", "commissions", "orders", "users",
    ];
    try {
      await local.query(`
        DROP TABLE IF EXISTS ${tables.join(", ")} CASCADE;
        ${ddl(users, "users")};
        CREATE TABLE orders (id varchar PRIMARY KEY, buyer_id varchar, seller_id varchar,
          status text, payment_status text, inventory_status text, refund_idempotency_key text,
          capture_request_snapshot jsonb);
        CREATE TABLE commissions (id varchar PRIMARY KEY, seller_id varchar, status text);
        CREATE TABLE payouts (id varchar PRIMARY KEY, seller_id varchar, status text);
        CREATE TABLE wedding_square_subscriptions (id varchar PRIMARY KEY, user_id varchar, provider_status text);
        CREATE TABLE wedding_square_enrollment_attempts (id varchar PRIMARY KEY, user_id varchar, status text);
        CREATE TABLE catering_bookings (id varchar PRIMARY KEY, customer_id varchar, provider_id varchar, status text);
        CREATE TABLE catering_booking_invoices (id varchar PRIMARY KEY, booking_id varchar, status text, amount_cents bigint);
        CREATE TABLE catering_booking_payments (id varchar PRIMARY KEY, invoice_id varchar, status text, amount_cents bigint);
        CREATE TABLE drink_bundle_checkout_sessions (id varchar PRIMARY KEY, user_id varchar, status text);
        CREATE TABLE subscription_history (id varchar PRIMARY KEY, user_id varchar, status text);
      `);
      const [user] = (await local.query(
        "INSERT INTO users(username, email, display_name) VALUES('closure-test', 'closure-test@example.test', 'Test') RETURNING id",
      )).rows;
      const id = user.id as string;
      const inspect = () => db.transaction(async (tx: any) => {
        await tx.execute(sql`SELECT id FROM users WHERE id = ${id} FOR UPDATE`);
        return inspectLocalClosureObligations(tx, id);
      });
      assert.deepEqual(await inspect(), [], "known empty ledgers are not blockers");
      await local.query("INSERT INTO orders VALUES ('order-1',$1,'another','pending','unverified','unreserved',null,null)", [id]);
      await local.query("INSERT INTO payouts VALUES ('payout-1',$1,'processing')", [id]);
      await local.query("INSERT INTO wedding_square_subscriptions VALUES ('wedding-1',$1,'ACTIVE')", [id]);
      await local.query("INSERT INTO drink_bundle_checkout_sessions VALUES ('bundle-1',$1,'pending')", [id]);
      const blockers = await inspect();
      assert.deepEqual(blockers.map(x => x.code), [
        "MARKETPLACE_ORDERS", "SELLER_PAYOUTS", "WEDDING_SUBSCRIPTIONS", "DRINK_BUNDLE_CHECKOUTS",
      ]);
      assert.ok(blockers.every(x => x.count === 1 && x.message.length > 10));
      assert.equal((await local.query("SELECT status FROM payouts WHERE id='payout-1'")).rows[0].status, "processing",
        "eligibility checks never mutate financial records");

      // A closed-looking order is STILL blocked when its immutable capture request is pending.
      await local.query("UPDATE orders SET status='delivered', capture_request_snapshot='{}'::jsonb WHERE id='order-1'");
      const paymentBlocked = await inspect();
      assert.ok(paymentBlocked.some(x => x.code === "MARKETPLACE_PAYMENTS"));
      assert.ok(!paymentBlocked.some(x => x.code === "MARKETPLACE_ORDERS"));

      // Completed/closed bookings do not themselves block, but an unpaid issued invoice does.
      await local.query("INSERT INTO catering_bookings VALUES ('booking-1',$1,'other','completed')", [id]);
      await local.query("INSERT INTO catering_booking_invoices VALUES ('invoice-1','booking-1','issued',1000)");
      assert.ok((await inspect()).some(x => x.code === "CATERING_INVOICES"));
      await local.query("INSERT INTO catering_booking_payments VALUES ('payment-1','invoice-1','recorded',1000)");
      assert.ok(!(await inspect()).some(x => x.code === "CATERING_INVOICES"),
        "the local invoice calculation is settled; the independent provider verification gate remains mandatory");
      // A historical completed refund may keep its immutable idempotency key for evidence.
      await local.query("UPDATE orders SET payment_status='refunded', refund_idempotency_key='refund-id', capture_request_snapshot=NULL, inventory_status='sold' WHERE id='order-1'");
      assert.ok(!(await inspect()).some(x => x.code === "MARKETPLACE_PAYMENTS"),
        "a completed refund must not be treated as permanently unsettled");
      await local.query("DROP TABLE subscription_history");
      await assert.rejects(inspect(), (err: any) =>
        err instanceof ClosureObligationsUnavailableError && err.check === "SUBSCRIPTION_HISTORY");
      const still = await local.query("SELECT count(*)::int n FROM orders WHERE id='order-1'");
      assert.equal(still.rows[0].n, 1, "a missing ledger must not erase or modify anything");
    } finally {
      await local.query(`DROP TABLE IF EXISTS ${tables.join(", ")} CASCADE`);
      await local.end();
    }
  });
}
