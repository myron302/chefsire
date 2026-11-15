/**
 * The local half of the provider evidence, against a real PostgreSQL with the REAL column names
 * built from the Drizzle schema. The point of using the real schema here rather than stand-in
 * tables: if one of these queries names a column that production does not have, the query throws,
 * and this suite is what catches that before the coordinator ever relies on it.
 *
 * Nothing here touches Square: the only port in the tree refuses every call.
 */
import "../test-support/auth-test-env";
import test from "node:test";
import assert from "node:assert/strict";
import { PG_URL, connectLocalPg, ddl } from "../test-support/authz-pg-harness";
import {
  ClosureProviderEvidenceUnavailableError,
  PROVIDER_EVIDENCE_FRESHNESS_MS,
  collectLocalProviderReferences,
  assertProviderEvidenceUsable,
  reconcileProviderEvidence,
  type ProviderEvidenceManifest,
} from "./closure-provider-evidence";

const LEDGER_TABLES = [
  "creator_membership_checkout_sessions",
  "creator_memberships",
  "drink_collection_checkout_sessions",
  "catering_booking_payment_attempts",
  "catering_bookings",
  "wedding_square_invoice_evidence",
  "wedding_square_subscriptions",
  "orders",
  "users",
];

async function buildLedgers(local: any): Promise<void> {
  const schema = await import("../../shared/schema");
  await local.query(`
    DROP TABLE IF EXISTS ${LEDGER_TABLES.join(", ")} CASCADE;
    ${ddl(schema.users, "users")};
    ${ddl(schema.orders, "orders")};
    ${ddl(schema.weddingSquareSubscriptions, "wedding_square_subscriptions")};
    ${ddl(schema.weddingSquareInvoiceEvidence, "wedding_square_invoice_evidence")};
    ${ddl(schema.cateringBookings, "catering_bookings")};
    ${ddl(schema.cateringBookingPaymentAttempts, "catering_booking_payment_attempts")};
    ${ddl(schema.drinkCollectionCheckoutSessions, "drink_collection_checkout_sessions")};
    ${ddl(schema.creatorMemberships, "creator_memberships")};
    ${ddl(schema.creatorMembershipCheckoutSessions, "creator_membership_checkout_sessions")};
  `);
}

const dropLedgers = (local: any) => local.query(`DROP TABLE IF EXISTS ${LEDGER_TABLES.join(", ")} CASCADE`);

if (!PG_URL) {
  test("Provider evidence collection requires CS_TEST_PG_URL", { skip: true }, () => {});
} else {
  test("every declared source query runs against the real schema and finds nothing for a clean member", async () => {
    const local = await connectLocalPg();
    const { db } = await import("../db");
    try {
      await buildLedgers(local);
      const [member] = (await local.query(
        "INSERT INTO users(username,email,display_name) VALUES ('clean','clean@example.test','Clean') RETURNING id",
      )).rows;

      // The decisive assertion is not the empty array -- it is that none of the eight queries threw.
      // A query naming a column production does not have would fail here, loudly.
      const references = await db.transaction((tx: any) => collectLocalProviderReferences(tx, String(member.id)));
      assert.deepEqual(references, []);
    } finally {
      await dropLedgers(local);
      await local.end();
    }
  });

  test("a missing ledger table refuses rather than reading as 'this member has no payments there'", async () => {
    const local = await connectLocalPg();
    const { db } = await import("../db");
    try {
      await buildLedgers(local);
      const [member] = (await local.query(
        "INSERT INTO users(username,email,display_name) VALUES ('missing','missing@example.test','Missing') RETURNING id",
      )).rows;

      // The single most dangerous way to get a clear verdict wrong: a ledger that cannot be read
      // produces no rows, and no rows looks exactly like a settled member.
      await local.query("DROP TABLE wedding_square_subscriptions CASCADE");
      await assert.rejects(
        () => db.transaction((tx: any) => collectLocalProviderReferences(tx, String(member.id))),
        (error: any) =>
          error instanceof ClosureProviderEvidenceUnavailableError &&
          error.family === "WEDDING_SUBSCRIPTIONS" &&
          /wedding_square_subscriptions/.test(error.message),
      );
    } finally {
      await dropLedgers(local);
      await local.end();
    }
  });

  test("references are collected across families, as buyer and as seller, and carry the real ids", async () => {
    const local = await connectLocalPg();
    const { db } = await import("../db");
    try {
      await buildLedgers(local);
      const [member, counterparty] = (await local.query(`
        INSERT INTO users(username,email,display_name) VALUES
          ('ledger-member','ledger-member@example.test','Member'),
          ('ledger-other','ledger-other@example.test','Other')
        RETURNING id
      `)).rows;
      const me = String(member.id);
      const them = String(counterparty.id);

      await local.query(
        `INSERT INTO orders(id,buyer_id,seller_id,product_id,quantity,total_amount,platform_fee,seller_amount,fulfillment_method,payment_status,square_payment_id)
         VALUES ('order-bought',$1,$2,'p1',1,'25.00','2.50','22.50','shipping','captured','sqpmt_bought')`, [me, them]);
      await local.query(
        `INSERT INTO orders(id,buyer_id,seller_id,product_id,quantity,total_amount,platform_fee,seller_amount,fulfillment_method,payment_status,square_payment_id,square_refund_id)
         VALUES ('order-sold',$1,$2,'p2',1,'40.00','4.00','36.00','shipping','refunded','sqpmt_sold','sqrfd_sold')`, [them, me]);
      const [subscription] = (await local.query(
        `INSERT INTO wedding_square_subscriptions(user_id,tier,square_environment,square_merchant_id,square_location_id,
             square_customer_id,square_plan_variation_id,square_subscription_id,billing_consent_at,
             billing_consent_terms_version,agreed_monthly_amount_cents,agreed_currency,provider_status)
         VALUES ($1,'premium','production','MERCHANT_1','LOC_1','cust_1','plan_1','sqsub_1',now(),'v1',4900,'USD','CANCELED')
         RETURNING id`, [me])).rows;
      await local.query(
        `INSERT INTO wedding_square_invoice_evidence(id,wedding_subscription_id,square_environment,square_merchant_id,
             square_invoice_id,square_payment_id,square_subscription_id,verified_amount_cents,verified_currency,
             provider_paid_at,period_starts_at,period_ends_at)
         VALUES (gen_random_uuid(),$1,'production','MERCHANT_1','sqinv_1','sqpmt_inv','sqsub_1',4900,'USD',
             now(), now() - interval '30 days', now())`, [String(subscription.id)]);
      await local.query(
        `INSERT INTO creator_memberships(id,user_id,creator_user_id,plan_id,status,square_subscription_id)
         VALUES ('mem-1',$1,$2,'plan-1','active','sqsub_mem')`, [me, them]);

      const references = await db.transaction((tx: any) => collectLocalProviderReferences(tx, me));
      const seen = references.map((r) => `${r.family}:${r.kind}:${r.providerId}`).sort();
      assert.deepEqual(seen, [
        "CREATOR_MEMBERSHIPS:subscription:sqsub_mem",
        "MARKETPLACE_ORDERS:payment:sqpmt_bought",
        "MARKETPLACE_ORDERS:payment:sqpmt_sold",
        "MARKETPLACE_ORDERS:refund:sqrfd_sold",
        "WEDDING_INVOICES:invoice:sqinv_1",
        "WEDDING_INVOICES:payment:sqpmt_inv",
        "WEDDING_SUBSCRIPTIONS:subscription:sqsub_1",
      ], "both sides of a trade are the member's own obligations");

      const collected = references.find((r) => r.family === "WEDDING_SUBSCRIPTIONS");
      assert.equal(collected?.environment, "production");
      assert.equal(collected?.merchantId, "MERCHANT_1");
      assert.equal(collected?.localStatus, "CANCELED");
    } finally {
      await dropLedgers(local);
      await local.end();
    }
  });

  test("a captured order with no provider id is collected as unmapped, and blocks", async () => {
    const local = await connectLocalPg();
    const { db } = await import("../db");
    try {
      await buildLedgers(local);
      const [member, other] = (await local.query(`
        INSERT INTO users(username,email,display_name) VALUES
          ('unmapped','unmapped@example.test','Unmapped'),
          ('unmapped-other','unmapped-other@example.test','Other')
        RETURNING id
      `)).rows;
      // Captured locally, but the row names no Square payment. That is not "no payment" -- it is a
      // payment we cannot verify, so it has to reach the decision model rather than be filtered out.
      await local.query(
        `INSERT INTO orders(id,buyer_id,seller_id,product_id,quantity,total_amount,platform_fee,seller_amount,fulfillment_method,payment_status)
         VALUES ('order-unmapped',$1,$2,'p1',1,'25.00','2.50','22.50','shipping','captured')`, [String(member.id), String(other.id)]);

      const references = await db.transaction((tx: any) => collectLocalProviderReferences(tx, String(member.id)));
      assert.equal(references.length, 1);
      assert.equal(references[0].providerId, null);

      const manifest = await reconcileProviderEvidence(String(member.id), references, undefined, Date.now());
      assert.equal(manifest.verdict, "BLOCKED");
      assert.deepEqual(manifest.exceptions.map((item) => item.code), ["UNMAPPED_PROVIDER_REFERENCE"]);
    } finally {
      await dropLedgers(local);
      await local.end();
    }
  });

  test("evidence is void if the member's provider-linked records changed after the readback", async () => {
    const local = await connectLocalPg();
    const { db } = await import("../db");
    try {
      await buildLedgers(local);
      const [member, other] = (await local.query(`
        INSERT INTO users(username,email,display_name) VALUES
          ('revalidate','revalidate@example.test','Revalidate'),
          ('revalidate-other','revalidate-other@example.test','Other')
        RETURNING id
      `)).rows;
      const me = String(member.id);
      const now = Date.now();
      const clear = (references: ProviderEvidenceManifest["references"]): ProviderEvidenceManifest => ({
        verdict: "RECONCILED_LOCAL_AND_PROVIDER",
        userId: me,
        readbackAt: now,
        expiresAt: now + PROVIDER_EVIDENCE_FRESHNESS_MS,
        references,
        exceptions: [],
      });

      // Evidence gathered when the member had nothing provider-linked.
      const before = await db.transaction((tx: any) => collectLocalProviderReferences(tx, me));
      await db.transaction((tx: any) => assertProviderEvidenceUsable(tx, me, clear(before), now));

      // Then they buy something. The decision was made against a world that no longer exists.
      await local.query(
        `INSERT INTO orders(id,buyer_id,seller_id,product_id,quantity,total_amount,platform_fee,seller_amount,fulfillment_method,payment_status,square_payment_id)
         VALUES ('order-late',$1,$2,'p1',1,'25.00','2.50','22.50','shipping','captured','sqpmt_late')`, [me, String(other.id)]);

      await assert.rejects(
        () => db.transaction((tx: any) => assertProviderEvidenceUsable(tx, me, clear(before), now)),
        (error: any) =>
          error instanceof ClosureProviderEvidenceUnavailableError && /changed after the readback/.test(error.message),
      );

      // Re-gathered evidence matches again. (Still BLOCKED on its own merits once reconciled -- this
      // gate only checks that the evidence describes the member as they are now.)
      const after = await db.transaction((tx: any) => collectLocalProviderReferences(tx, me));
      await db.transaction((tx: any) => assertProviderEvidenceUsable(tx, me, clear(after), now));
    } finally {
      await dropLedgers(local);
      await local.end();
    }
  });
}
