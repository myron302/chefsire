import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import express from "express";
import type { AddressInfo } from "node:net";
import { PG_URL, connectLocalPg, ddl, makeCaller } from "../test-support/authz-pg-harness";

if (!PG_URL) {
  test("Marketplace order detail access (requires CS_TEST_PG_URL)", { skip: true }, () => {});
} else {
  test("an order's detail is visible only to its buyer and seller, and never exposes server-only fields", async () => {
    const local = await connectLocalPg();
    const schema = await import("../../shared/schema");
    const { default: ordersRouter } = await import("./orders");
    const app = express();
    app.use(express.json());
    app.use("/api/orders", ordersRouter);
    const server = app.listen(0, "127.0.0.1");
    try {
      await local.query(`
        DROP TABLE IF EXISTS orders, products, stores, notifications, users CASCADE;
        ${ddl(schema.users, "users")};
        ${ddl(schema.products, "products")};
        ${ddl(schema.notifications, "notifications")};
        ${ddl(schema.stores, "stores")};
        ${ddl(schema.orders, "orders", ", UNIQUE (buyer_id, checkout_idempotency_key)")};
      `);
      const ids: Record<string, string> = {};
      for (const name of ["buyer", "seller", "otherBuyer", "otherSeller"]) {
        ids[name] = (await local.query(
          "INSERT INTO users (username, email, display_name, password, auth_version) VALUES ($1, $2, $1, 'fixture', 1) RETURNING id",
          [name.toLowerCase(), `${name.toLowerCase()}@example.test`],
        )).rows[0].id;
      }
      const product = (await local.query(`
        INSERT INTO products (seller_id, name, price, category, inventory, shipping_enabled, local_pickup_enabled, is_digital, in_store_only, digital_file_url)
        VALUES ($1, 'cookies', 10.99, 'general', 10, false, true, false, false, 'private/secret-file-path')
        RETURNING id
      `, [ids.seller])).rows[0];
      const call = makeCaller(() => `http://127.0.0.1:${(server.address() as AddressInfo).port}`, (who) => ids[who]);
      const order = (await call("POST", "/api/orders/checkout", "buyer", {
        productId: product.id, quantity: 1, fulfillmentMethod: "local_pickup", checkoutIdempotencyKey: randomUUID(),
      })).json.order;
      // A stored capture request (single-use payment token, buyer email) as the payment route leaves it.
      await local.query(`
        UPDATE orders SET payment_status='captured', payment_provider='square', provider_payment_status='COMPLETED',
          square_payment_id='test-' || id, payment_captured_at=now(), seller_revenue_status='credited',
          capture_request_snapshot='{"sourceId":"cnon:secret-token","buyerEmailAddress":"buyer@example.test"}'::jsonb
        WHERE id = $1
      `, [order.id]);

      const detail = (who: string, id = order.id) => call("GET", `/api/orders/${id}`, who);
      for (const who of ["buyer", "seller"]) {
        const r = await detail(who);
        assert.equal(r.status, 200, `${who}: ${r.text}`);
        assert.equal(r.json.order.order.id, order.id);
        assert.equal(r.json.verifiedPaid, true);
        assert.equal(r.json.order.product.name, "cookies");
        assert.ok(!r.text.includes("secret-token"), "payment token never leaves the server");
        assert.ok(!r.text.includes("captureRequestSnapshot"));
        assert.ok(!r.text.includes("secret-file-path"), "private download location never leaves the server");
        assert.ok(!r.text.includes("buyer@example.test"));
      }
      assert.equal((await detail("anon")).status, 401);
      assert.equal((await detail("otherBuyer")).status, 403);
      assert.equal((await detail("otherSeller")).status, 403);
      assert.equal((await detail("buyer", randomUUID())).status, 404);
    } finally {
      await new Promise<void>((resolve) => server.close(() => resolve()));
      await local.query("DROP TABLE IF EXISTS orders, products, stores, notifications, users CASCADE");
      await local.end();
    }
  });
}
