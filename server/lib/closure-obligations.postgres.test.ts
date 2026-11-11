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
      "catering_booking_invoices", "catering_booking_payment_attempts", "catering_bookings",
      "creator_membership_sales_ledger", "creator_membership_checkout_sessions", "creator_memberships",
      "drink_gifts", "drink_collection_purchases", "drink_collection_sales_ledger",
      "drink_collection_checkout_sessions", "drink_collections",
      "meal_plan_purchases", "meal_plan_blueprints", "drink_bundle_purchases", "drink_bundles",
      "wedding_square_enrollment_attempts", "wedding_square_subscriptions",
      "wedding_square_card_setup_attempts", "wedding_square_card_updates",
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
        CREATE TABLE wedding_square_card_setup_attempts (id varchar PRIMARY KEY, user_id varchar, status text);
        CREATE TABLE wedding_square_card_updates (id varchar PRIMARY KEY, user_id varchar, status text);
        CREATE TABLE catering_bookings (id varchar PRIMARY KEY, customer_id varchar, provider_id varchar, status text);
        CREATE TABLE catering_booking_invoices (id varchar PRIMARY KEY, booking_id varchar, status text, amount_cents bigint);
        CREATE TABLE catering_booking_payments (id varchar PRIMARY KEY, invoice_id varchar, status text, amount_cents bigint);
        CREATE TABLE catering_booking_payment_attempts (
          id varchar PRIMARY KEY, customer_id varchar, provider_id varchar, state text,
          square_create_started_at timestamptz, square_create_resolved_at timestamptz,
          square_create_uncertain_at timestamptz, closure_verified_at timestamptz,
          refund_review_at timestamptz
        );
        CREATE TABLE drink_bundle_checkout_sessions (id varchar PRIMARY KEY, user_id varchar, status text);
        CREATE TABLE subscription_history (id varchar PRIMARY KEY, user_id varchar, status text);
        CREATE TABLE creator_memberships (id varchar PRIMARY KEY, user_id varchar, creator_user_id varchar, status text);
        CREATE TABLE creator_membership_checkout_sessions (id varchar PRIMARY KEY, user_id varchar, creator_user_id varchar, status text);
        CREATE TABLE creator_membership_sales_ledger (id varchar PRIMARY KEY, user_id varchar, creator_user_id varchar, status text);
        CREATE TABLE drink_collections (id varchar PRIMARY KEY, user_id varchar);
        CREATE TABLE drink_collection_checkout_sessions (id varchar PRIMARY KEY, user_id varchar, collection_id varchar, status text);
        CREATE TABLE drink_collection_sales_ledger (id varchar PRIMARY KEY, user_id varchar, collection_id varchar, status text);
        CREATE TABLE drink_collection_purchases (id varchar PRIMARY KEY, user_id varchar, collection_id varchar, status text);
        CREATE TABLE drink_gifts (id varchar PRIMARY KEY, purchaser_user_id varchar, recipient_user_id varchar, status text);
        CREATE TABLE meal_plan_blueprints (id varchar PRIMARY KEY, creator_id varchar);
        CREATE TABLE meal_plan_purchases (id varchar PRIMARY KEY, user_id varchar, blueprint_id varchar, payment_status text);
        CREATE TABLE drink_bundles (id varchar PRIMARY KEY, user_id varchar);
        CREATE TABLE drink_bundle_purchases (id varchar PRIMARY KEY, user_id varchar, bundle_id varchar,
          status text, access_revoked_at timestamptz);
        ALTER TABLE drink_collection_purchases ADD COLUMN access_revoked_at timestamptz;
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
      await local.query("INSERT INTO creator_memberships VALUES ('membership-1','other',$1,'active')", [id]);
      await local.query("INSERT INTO creator_membership_checkout_sessions VALUES ('member-checkout-1','other',$1,'pending')", [id]);
      await local.query("INSERT INTO creator_membership_sales_ledger VALUES ('member-sale-1','other',$1,'pending')", [id]);
      await local.query("INSERT INTO drink_collections VALUES ('collection-1',$1)", [id]);
      await local.query("INSERT INTO drink_collection_checkout_sessions VALUES ('collection-checkout','other','collection-1','pending')");
      await local.query("INSERT INTO drink_collection_sales_ledger VALUES ('collection-sale','other','collection-1','refunded_pending')");
      await local.query("INSERT INTO drink_collection_purchases VALUES ('collection-purchase','other','collection-1','refunded_pending')");
      await local.query("INSERT INTO drink_gifts VALUES ('gift-1',$1,'other','pending')", [id]);
      const blockers = await inspect();
      assert.deepEqual(blockers.map(x => x.code), [
        "MARKETPLACE_ORDERS", "SELLER_PAYOUTS", "WEDDING_SUBSCRIPTIONS", "DRINK_BUNDLE_CHECKOUTS",
        "DRINK_COLLECTION_PAYMENTS", "DRINK_COLLECTION_PURCHASES", "DRINK_GIFTS",
        "CREATOR_MEMBERSHIPS", "CREATOR_MEMBERSHIP_CHECKOUTS", "CREATOR_MEMBERSHIP_SALES",
      ]);
      assert.ok(blockers.every(x => x.count === (x.code === "DRINK_COLLECTION_PAYMENTS" ? 2 : 1) && x.message.length > 10));
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
      await local.query("INSERT INTO wedding_square_card_setup_attempts VALUES ('setup-1',$1,'card_submitting')", [id]);
      await local.query("INSERT INTO wedding_square_card_updates VALUES ('update-1',$1,'needs_reconciliation')", [id]);
      assert.equal((await inspect()).find(x => x.code === "WEDDING_CARD_OPERATIONS")?.count, 2,
        "incomplete enrollment and replacement operations independently block closure");
      await local.query("UPDATE wedding_square_card_setup_attempts SET status='aborted'");
      await local.query("UPDATE wedding_square_card_updates SET status='confirmed'");
      assert.ok(!(await inspect()).some(x => x.code === "WEDDING_CARD_OPERATIONS"),
        "terminal history remains in the ledger, separate provider reconciliation is still required");
      await local.query("INSERT INTO catering_booking_payment_attempts VALUES ('attempt-1',$1,'provider','expired',now(),null,now(),null,null)", [id]);
      assert.equal((await inspect()).find(x => x.code === "CATERING_PAYMENT_ATTEMPTS")?.count, 1,
        "even expired local checkout can conceal a Square link-creation outcome");
      await local.query("UPDATE catering_booking_payment_attempts SET square_create_resolved_at=now(), closure_verified_at=now() WHERE id='attempt-1'");
      assert.ok(!(await inspect()).some(x => x.code === "CATERING_PAYMENT_ATTEMPTS"),
        "verified terminal create/link state may proceed to the separate provider reconciliation gate");
      await local.query("UPDATE catering_booking_payment_attempts SET refund_review_at=now() WHERE id='attempt-1'");
      assert.ok((await inspect()).some(x => x.code === "CATERING_PAYMENT_ATTEMPTS"),
        "durable refund-review marker is a hard stop until manually reconciled");
      // A historical completed refund may keep its immutable idempotency key for evidence.
      await local.query("UPDATE orders SET payment_status='refunded', refund_idempotency_key='refund-id', capture_request_snapshot=NULL, inventory_status='sold' WHERE id='order-1'");
      assert.ok(!(await inspect()).some(x => x.code === "MARKETPLACE_PAYMENTS"),
        "a completed refund must not be treated as permanently unsettled");
      await local.query("UPDATE drink_collection_checkout_sessions SET status='completed'");
      await local.query("UPDATE drink_collection_sales_ledger SET status='refunded'");
      await local.query("UPDATE drink_collection_purchases SET status='refunded'");
      await local.query("UPDATE drink_gifts SET status='revoked'");
      assert.ok(!(await inspect()).some(x => x.code.startsWith("DRINK_COLLECTION_") || x.code === "DRINK_GIFTS"),
        "resolved collection transactions and gifts stay in their retained ledgers");
      // Creator revenue/membership rows are retained; closed or refunded state
      // removes the unresolved-obligation blocker, not the ledger evidence.
      await local.query("UPDATE creator_memberships SET status='cancelled'");
      await local.query("UPDATE creator_membership_checkout_sessions SET status='completed'");
      await local.query("UPDATE creator_membership_sales_ledger SET status='completed'");
      assert.ok(!(await inspect()).some(x => x.code.startsWith("CREATOR_")));
      // Seller closure must not destroy paid digital entitlements that belong
      // to another user, even when every Square payment is already completed.
      await local.query("INSERT INTO meal_plan_blueprints VALUES ('blueprint-1',$1)", [id]);
      await local.query("INSERT INTO drink_bundles VALUES ('bundle-created-1',$1)", [id]);
      await local.query("INSERT INTO meal_plan_purchases VALUES ('meal-buyer-1','another','blueprint-1','verified_paid')");
      await local.query("INSERT INTO drink_bundle_purchases VALUES ('bundle-buyer-1','another','bundle-created-1','completed',null)");
      await local.query("INSERT INTO drink_collection_purchases VALUES ('collection-buyer-1','another','collection-1','completed',null)");
      await local.query("INSERT INTO meal_plan_purchases VALUES ('meal-unverified-1',$1,'blueprint-1','unverified')", [id]);
      let paid = await inspect();
      assert.equal(paid.find(x => x.code === "CREATOR_PAID_DIGITAL_ACCESS")?.count, 3,
        "three completed sales to other buyers remain obligations to preserve paid content");
      assert.equal(paid.find(x => x.code === "MEAL_PLAN_PAYMENT_EVIDENCE")?.count, 1,
        "an unverified buyer charge cannot be mistaken for an eligible payment");
      await local.query("UPDATE meal_plan_purchases SET payment_status = 'refunded' WHERE id IN ('meal-buyer-1','meal-unverified-1')");
      await local.query("UPDATE drink_bundle_purchases SET status='refunded' WHERE id='bundle-buyer-1'");
      await local.query("UPDATE drink_collection_purchases SET status='refunded' WHERE id='collection-buyer-1'");
      paid = await inspect();
      assert.ok(!paid.some(x => x.code === "CREATOR_PAID_DIGITAL_ACCESS" || x.code === "MEAL_PLAN_PAYMENT_EVIDENCE"),
        "resolved buyer charges and revoked creator obligations are retained, not erased");

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
