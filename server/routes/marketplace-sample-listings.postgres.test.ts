import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import express from "express";
import type { AddressInfo } from "node:net";
import { PG_URL, connectLocalPg, ddl, makeCaller } from "../test-support/authz-pg-harness";

if (!PG_URL) {
  test("Marketplace sample listings (requires CS_TEST_PG_URL)", { skip: true }, () => {});
} else {
  test("seeded sample listings stay browsable but never become payable orders; real listings still check out", async () => {
    const local = await connectLocalPg();
    const schema = await import("../../shared/schema");
    const { default: ordersRouter } = await import("./orders");
    const { default: paymentsRouter } = await import("./payments");
    const { default: marketplaceRouter } = await import("./marketplace");
    const app = express();
    app.use(express.json());
    app.use("/api/orders", ordersRouter);
    app.use("/api/payments", paymentsRouter);
    app.use("/api/marketplace", marketplaceRouter);
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
      // The seeded demo seller keeps its seed id; the buyer and the real seller get generated ids.
      await local.query(
        "INSERT INTO users (id, username, email, display_name, password, auth_version) VALUES ('user-1', 'chef_alexandra', 'demo@example.test', 'Demo', 'fixture', 1)",
      );
      const ids: Record<string, string> = { demo: "user-1" };
      for (const name of ["buyer", "seller"]) {
        ids[name] = (await local.query(
          "INSERT INTO users (username, email, display_name, password, auth_version) VALUES ($1, $2, $1, 'fixture', 1) RETURNING id",
          [name, `${name}@example.test`],
        )).rows[0].id;
      }
      await local.query(`
        INSERT INTO products (id, seller_id, name, price, category, inventory, shipping_enabled, local_pickup_enabled, is_digital, in_store_only)
        VALUES ('prod-1', 'user-1', 'Italian Pasta Making Kit', 45, 'general', 20, true, true, false, false)
      `);
      const real = (await local.query(`
        INSERT INTO products (seller_id, name, price, category, inventory, shipping_enabled, local_pickup_enabled, is_digital, in_store_only)
        VALUES ($1, 'cookies', 10.99, 'general', 10, true, true, false, false) RETURNING id
      `, [ids.seller])).rows[0];
      // A real seller's product that happens to reuse a seed-style id is not a sample: the marker is the id pair.
      await local.query(`
        INSERT INTO products (id, seller_id, name, price, category, inventory, shipping_enabled, local_pickup_enabled, is_digital, in_store_only)
        VALUES ('prod-2', $1, 'Real Bread', 8, 'general', 5, false, true, false, false)
      `, [ids.seller]);

      const call = makeCaller(() => `http://127.0.0.1:${(server.address() as AddressInfo).port}`, (who) => ids[who]);
      const checkout = (productId: string, quantity = 1) => ({
        productId, quantity, fulfillmentMethod: "local_pickup", checkoutIdempotencyKey: randomUUID(),
      });

      // Browsable, and flagged for the UI.
      const sampleView = await call("GET", "/api/marketplace/products/prod-1", "anon");
      assert.equal(sampleView.status, 200, sampleView.text);
      assert.equal(sampleView.json.isSample, true);
      assert.equal((await call("GET", `/api/marketplace/products/${real.id}`, "anon")).json.isSample, false);
      assert.equal((await call("GET", "/api/marketplace/products/prod-2", "anon")).json.isSample, false);
      const listing = await call("GET", "/api/marketplace/products", "anon");
      assert.equal(listing.status, 200, listing.text);
      assert.deepEqual(
        listing.json.products.filter((p: { isSample: boolean }) => p.isSample).map((p: { id: string }) => p.id),
        ["prod-1"],
      );

      // Direct API checkout of a sample listing is refused at any quantity, and nothing is written.
      for (const quantity of [1, 3]) {
        const refused = await call("POST", "/api/orders/checkout", "buyer", checkout("prod-1", quantity));
        assert.equal(refused.status, 409, refused.text);
        assert.equal(refused.json.code, "SAMPLE_LISTING");
      }
      assert.equal((await local.query("SELECT count(*)::int AS n FROM orders")).rows[0].n, 0);

      // The real listing still goes through checkout normally.
      const ok = await call("POST", "/api/orders/checkout", "buyer", checkout(real.id, 2));
      assert.equal(ok.status, 200, ok.text);
      assert.equal(ok.json.order.productId, real.id);
      assert.equal(ok.json.order.sellerId, ids.seller);
      const seedStyle = await call("POST", "/api/orders/checkout", "buyer", checkout("prod-2"));
      assert.equal(seedStyle.status, 200, seedStyle.text);

      // An unpaid sample order created before this guard existed can never be charged.
      // Simulated by creating an ordinary unpaid order and pointing it at the sample listing.
      const legacyOrder = await call("POST", "/api/orders/checkout", "buyer", checkout(real.id));
      assert.equal(legacyOrder.status, 200, legacyOrder.text);
      const legacy = (await local.query(
        "UPDATE orders SET product_id = 'prod-1', seller_id = 'user-1' WHERE id = $1 RETURNING id, payment_status",
        [legacyOrder.json.order.id],
      )).rows[0];
      assert.equal(legacy.payment_status, "unverified");
      const pay = await call("POST", "/api/payments/create-payment", "buyer", { orderId: legacy.id, sourceId: "cnon:card-nonce-ok" });
      assert.equal(pay.status, 409, pay.text);
      assert.equal(pay.json.code, "SAMPLE_LISTING");
      const after = (await local.query("SELECT payment_status, inventory_status FROM orders WHERE id = $1", [legacy.id])).rows[0];
      assert.equal(after.payment_status, "unverified");
      assert.equal((await local.query("SELECT inventory FROM products WHERE id = 'prod-1'")).rows[0].inventory, 20);
    } finally {
      await new Promise<void>((resolve) => server.close(() => resolve()));
      await local.query("DROP TABLE IF EXISTS orders, products, stores, notifications, users CASCADE");
      await local.end();
    }
  });
}
