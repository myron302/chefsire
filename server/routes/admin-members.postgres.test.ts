/**
 * Back office part 2: member account status (active / restricted / suspended), enforced across the site, and the
 * staff member record (search, transaction history, audit history). Real routers on a real local PostgreSQL with the
 * production DDL (docs/ops/2026-11-09-staff-groups.sql + 2026-11-10-account-status.sql).
 */
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import express from "express";
import cookieParser from "cookie-parser";
import type { AddressInfo } from "node:net";
import { PG_URL, connectLocalPg, ddl, makeCaller } from "../test-support/authz-pg-harness";

if (!PG_URL) {
  test("Back office members (requires CS_TEST_PG_URL)", { skip: true }, () => {});
} else {
  process.env.INTERNAL_ADMIN_EMAILS = "owner@chefsire.test";

  test("restrict and suspend are enforced everywhere, reversible, audited, and transaction records are always kept", async () => {
    const local = await connectLocalPg();
    const schema = await import("../../shared/schema");
    const { default: adminStaff } = await import("./admin-staff");
    const { default: adminMembers } = await import("./admin-members");
    const { default: auth } = await import("./auth");
    const { default: users } = await import("./users");
    const { default: marketplace } = await import("./marketplace");
    const { default: orders } = await import("./orders");
    const { default: bcryptjs } = await import("bcryptjs");
    const app = express();
    app.set("trust proxy", true);
    app.use(express.json());
    app.use(cookieParser());
    app.use("/api", auth);
    app.use("/api/admin", adminStaff);
    app.use("/api/admin", adminMembers);
    app.use("/api/users", users);
    app.use("/api/marketplace", marketplace);
    app.use("/api/orders", orders);
    const server = app.listen(0, "127.0.0.1");
    try {
      await local.query(`
        DROP TABLE IF EXISTS account_status, admin_audit_log, staff_group_members, staff_group_permissions, staff_groups,
          orders, products, stores, notifications, users CASCADE;
        DROP FUNCTION IF EXISTS admin_audit_log_append_only CASCADE;
        ${ddl(schema.users, "users")};
        ${ddl(schema.products, "products")};
        ${ddl(schema.notifications, "notifications")};
        ${ddl(schema.stores, "stores")};
        ${ddl(schema.orders, "orders", ", UNIQUE (buyer_id, checkout_idempotency_key)")};
        ${readFileSync(new URL("../../docs/ops/2026-11-09-staff-groups.sql", import.meta.url), "utf8")}
        ${readFileSync(new URL("../../docs/ops/2026-11-10-account-status.sql", import.meta.url), "utf8")}
      `);
      const ids: Record<string, string> = {};
      const mk = async (name: string, email: string) => {
        ids[name] = (await local.query(
          `INSERT INTO users (username, email, display_name, password, auth_version, email_verified_at, email_verified_via, phone)
           VALUES ($1, $2, $1, $3, 1, now(), 'email_link', $4) RETURNING id`,
          [name, email, await bcryptjs.hash("member-password", 4), name === "seller" ? "+18605550123" : null],
        )).rows[0].id;
      };
      for (const [n, e] of [["owner", "owner@chefsire.test"], ["helper", "helper@example.test"], ["marketer", "marketer@example.test"], ["seller", "seller@example.test"], ["buyer", "buyer@example.test"]]) await mk(n, e);
      await local.query("INSERT INTO staff_group_members (group_id, user_id) VALUES ('grp-support', $1), ('grp-marketing', $2)", [ids.helper, ids.marketer]);
      const product = (await local.query(`
        INSERT INTO products (seller_id, name, price, category, inventory, shipping_enabled, local_pickup_enabled, is_digital, in_store_only)
        VALUES ($1, 'cookies', 10.99, 'general', 10, false, true, false, false) RETURNING id`, [ids.seller])).rows[0];
      // A paid order between buyer and seller: the transaction record that must survive every status.
      // Created through the real checkout, then marked captured as the payment route leaves it (no Square).
      const placed = await makeCaller(() => `http://127.0.0.1:${(server.address() as AddressInfo).port}`, (who) => ids[who])(
        "POST", "/api/orders/checkout", "buyer", { productId: product.id, quantity: 1, fulfillmentMethod: "local_pickup", checkoutIdempotencyKey: randomUUID() });
      assert.equal(placed.status, 200, placed.text);
      const order = placed.json.order;
      await local.query(`UPDATE orders SET payment_status='captured', payment_provider='square', provider_payment_status='COMPLETED',
        square_payment_id='test-' || id, payment_captured_at=now(), seller_revenue_status='credited', status='delivered' WHERE id = $1`, [order.id]);

      const call = makeCaller(() => `http://127.0.0.1:${(server.address() as AddressInfo).port}`, (who) => ids[who]);
      const login = (email: string) => call("POST", "/api/auth/login", "anon", { email, password: "member-password" });
      const setStatus = (who: string, target: string, status: string, reason = "Policy review") =>
        call("POST", `/api/admin/members/${ids[target]}/status`, who, { status, reason });
      const productVisible = async () => (await call("GET", "/api/marketplace/products", "anon")).json.products.some((p: any) => p.id === product.id);

      // Search: staff with members.view only; by name, email, partial phone.
      assert.equal((await call("GET", "/api/admin/members?q=sell", "buyer")).status, 403);
      assert.deepEqual((await call("GET", "/api/admin/members?q=SELL", "marketer")).json.members.map((m: any) => m.username), ["seller"]);
      assert.deepEqual((await call("GET", "/api/admin/members?q=555-0123", "helper")).json.members.map((m: any) => m.username), ["seller"]);
      assert.deepEqual((await call("GET", "/api/admin/members?q=%25", "helper")).json.members, [], "LIKE wildcards are literal");

      // Member record: transactions visible to orders.view holders.
      const record = (await call("GET", `/api/admin/members/${ids.seller}`, "marketer")).json;
      assert.equal(record.status.status, "active");
      const selling = record.records.find((s: any) => s.name === "Marketplace orders (selling)");
      assert.deepEqual(selling.rows.map((o: any) => [o.id, o.counterparty, o.paymentStatus]), [[order.id, "buyer", "captured"]]);
      assert.deepEqual(record.canChangeStatus, { restrict: false, suspend: false });

      // Marketing can't change status; nobody can change an Owner's or their own; a reason is required.
      assert.equal((await setStatus("marketer", "seller", "restricted")).status, 403);
      assert.equal((await setStatus("helper", "owner", "suspended")).status, 400);
      assert.equal((await setStatus("helper", "helper", "restricted")).status, 400);
      assert.equal((await call("POST", `/api/admin/members/${ids.seller}/status`, "helper", { status: "restricted", reason: "" })).status, 400);

      // RESTRICTED: can sign in and browse; every write is refused (except sign-out); content stays visible.
      assert.equal((await setStatus("helper", "seller", "restricted", "Spam reports")).status, 200);
      assert.equal((await login("seller@example.test")).status, 200, "restricted members can still sign in");
      assert.equal((await call("GET", "/api/orders/my-sales", "seller")).status, 200, "and read");
      const write = await call("POST", "/api/orders/checkout", "seller", { productId: product.id, quantity: 1, fulfillmentMethod: "local_pickup", checkoutIdempotencyKey: randomUUID() });
      assert.equal(write.status, 403);
      assert.equal(write.json.code, "ACCOUNT_RESTRICTED");
      assert.equal((await call("PUT", `/api/users/${ids.seller}`, "seller", { bio: "hi" })).status, 403);
      assert.equal(await productVisible(), true, "restriction doesn't hide content");

      // SUSPENDED: sessions end at once, no sign-in, content hidden, can't be bought from; the order record stays.
      assert.equal((await setStatus("helper", "seller", "suspended", "Fraud investigation")).status, 200);
      assert.equal((await call("GET", "/api/orders/my-sales", "seller")).status, 401, "the existing session ended");
      const blocked = await login("seller@example.test");
      assert.equal(blocked.status, 403);
      assert.equal(blocked.json.code, "ACCOUNT_SUSPENDED");
      assert.equal(await productVisible(), false);
      assert.equal((await call("GET", `/api/marketplace/products/${product.id}`, "anon")).status, 404);
      assert.equal((await call("GET", "/api/marketplace/storefront/seller", "anon")).status, 404);
      assert.equal((await call("GET", "/api/users/seller", "anon")).status, 404);
      assert.equal((await call("POST", "/api/orders/checkout", "buyer", { productId: product.id, quantity: 1, fulfillmentMethod: "local_pickup", checkoutIdempotencyKey: randomUUID() })).status, 400);
      const buyerHistory = await call("GET", "/api/orders/my-purchases", "buyer");
      assert.ok(buyerHistory.json.orders.some((o: any) => o.order.id === order.id), "the buyer still has their purchase record");
      const suspendedRecord = (await call("GET", `/api/admin/members/${ids.seller}`, "helper")).json;
      assert.equal(suspendedRecord.status.status, "suspended");
      assert.equal(suspendedRecord.status.reason, "Fraud investigation");
      assert.equal(suspendedRecord.records.find((s: any) => s.name === "Marketplace orders (selling)").rows.length, 1, "staff still see the seller's transactions");

      // Only members.suspend holders can lift a suspension; Marketing can't.
      assert.equal((await setStatus("marketer", "seller", "active", "Appeal")).status, 403);
      assert.equal((await setStatus("helper", "seller", "active", "Appeal accepted")).status, 200);
      assert.equal((await login("seller@example.test")).status, 200, "reinstated: signs in again");
      assert.equal(await productVisible(), true, "and everything is back exactly as it was");
      assert.equal((await local.query("SELECT count(*)::int n FROM orders")).rows[0].n, 1);

      // The member's history shows every change with who, why, and from/to; the log can't be edited or deleted.
      const history = (await call("GET", `/api/admin/members/${ids.seller}`, "owner")).json.history;
      assert.deepEqual(history.map((h: any) => [h.action, h.actorLabel, h.reason]), [
        ["member.status.active", "helper", "Appeal accepted"],
        ["member.status.suspended", "helper", "Fraud investigation"],
        ["member.status.restricted", "helper", "Spam reports"],
      ]);
      await assert.rejects(local.query("UPDATE admin_audit_log SET reason = 'edited'"), /append-only/);
      await assert.rejects(local.query("DELETE FROM admin_audit_log"), /append-only/);
    } finally {
      await new Promise<void>((resolve) => server.close(() => resolve()));
      await local.query(`DROP TABLE IF EXISTS account_status, admin_audit_log, staff_group_members, staff_group_permissions, staff_groups,
        orders, products, stores, notifications, users CASCADE; DROP FUNCTION IF EXISTS admin_audit_log_append_only CASCADE;`);
      await local.end();
    }
  });
}
