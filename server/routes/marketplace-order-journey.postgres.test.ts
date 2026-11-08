import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import express from "express";
import type { AddressInfo } from "node:net";
import { PG_URL, connectLocalPg, ddl, makeCaller } from "../test-support/authz-pg-harness";

if (!PG_URL) {
  test("Marketplace order journey (requires CS_TEST_PG_URL)", { skip: true }, () => {});
} else {
  test("buyer checkout, seller fulfillment, and capture-gated private download", async () => {
    const local = await connectLocalPg();
    const uploadDir = await mkdtemp(path.join(os.tmpdir(), "chefsire-order-journey-"));
    process.env.UPLOADS_DIR = uploadDir;
    const schema = await import("../../shared/schema");
    const { storeMarketplaceDigitalFile } = await import("../lib/marketplace-digital-file");
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
      for (const name of ["buyer", "seller", "other"]) {
        ids[name] = (await local.query(
          "INSERT INTO users (username, email, display_name, password, auth_version) VALUES ($1, $2, $1, 'fixture', 1) RETURNING id",
          [name, `${name}@example.test`],
        )).rows[0].id;
      }
      const call = makeCaller(() => `http://127.0.0.1:${(server.address() as AddressInfo).port}`, (who) => ids[who]);
      const staged = path.join(uploadDir, "staged");
      await writeFile(staged, "private order fixture");
      const file = await storeMarketplaceDigitalFile(ids.seller, staged);
      const [digital, pickup, inStore] = (await local.query(`
        INSERT INTO products (seller_id,name,price,category,inventory,shipping_enabled,local_pickup_enabled,is_digital,digital_file_url,in_store_only)
        VALUES ($1,'Book',10,'general',5,false,false,true,$2,false),
               ($1,'Pickup',20,'general',5,false,true,false,null,false),
               ($1,'Counter',20,'general',5,true,false,false,null,true)
        RETURNING id
      `, [ids.seller, file])).rows;
      const checkout = (productId: string, checkoutIdempotencyKey = randomUUID()) => ({
        productId, quantity: 1, fulfillmentMethod: "local_pickup", checkoutIdempotencyKey,
      });
      const base = "/api/orders";
      const digitalRequest = checkout(digital.id);
      assert.equal((await call("POST", `${base}/checkout`, "anon", digitalRequest)).status, 401);
      const first = await call("POST", `${base}/checkout`, "buyer", digitalRequest);
      assert.equal(first.status, 200, first.text);
      const digitalOrder = first.json.order;
      assert.equal(digitalOrder.deliveryMethod, "digital");
      assert.equal((await call("POST", `${base}/checkout`, "buyer", digitalRequest)).json.order.id, digitalOrder.id);
      assert.equal((await call("POST", `${base}/checkout`, "buyer", checkout(inStore.id))).status, 400);
      const pickupResult = await call("POST", `${base}/checkout`, "buyer", checkout(pickup.id));
      assert.equal(pickupResult.status, 200, pickupResult.text);
      const pickupOrder = pickupResult.json.order;
      assert.equal(pickupOrder.deliveryMethod, "pickup");
      const downloads = `${base}/${digitalOrder.id}/download`;
      const status = `${base}/${pickupOrder.id}/status`;
      assert.equal((await call("GET", downloads, "buyer")).status, 404);
      assert.equal((await call("PATCH", status, "seller", { status: "processing" })).status, 409);
      assert.equal((await call("GET", `${base}/my-sales?paidOnly=true`, "seller")).json.count, 0);
      const before = await call("GET", `${base}/my-purchases`, "buyer");
      assert.equal(before.json.orders.length, 2);
      const firstPurchasePage = await call("GET", `${base}/my-purchases?limit=1`, "buyer");
      const secondPurchasePage = await call("GET", `${base}/my-purchases?limit=1&offset=1`, "buyer");
      assert.equal(firstPurchasePage.json.hasMore, true);
      assert.equal(secondPurchasePage.json.hasMore, false);
      assert.notEqual(firstPurchasePage.json.orders[0].order.id, secondPurchasePage.json.orders[0].order.id);
      assert.ok(before.json.orders.every((entry: { verifiedPaid: boolean }) => !entry.verifiedPaid));
      assert.ok(!before.text.includes(file));
      assert.deepEqual((await call("GET", `${base}/my-purchases`, "other")).json.orders, []);

      // Seed verified-capture ledger state for the route integration test. No Square requests.
      await local.query(`
        UPDATE orders SET payment_status='captured', payment_provider='square',
          provider_payment_status='COMPLETED', square_payment_id='test-' || id,
          payment_captured_at=now(), seller_revenue_status='credited'
        WHERE id IN ($1,$2)
      `, [digitalOrder.id, pickupOrder.id]);
      assert.equal((await call("GET", downloads, "buyer")).text, "private order fixture");
      assert.equal((await call("GET", downloads, "other")).status, 404);
      assert.equal((await call("GET", downloads, "seller")).status, 404);
      const sales = await call("GET", `${base}/my-sales`, "seller");
      assert.equal(sales.json.summary.verifiedPaidOrders, 2);
      const page1 = await call("GET", `${base}/my-sales?paidOnly=true&limit=1`, "seller");
      const page2 = await call("GET", `${base}/my-sales?paidOnly=true&limit=1&offset=1`, "seller");
      assert.equal(page1.json.hasMore, true);
      assert.equal(page2.json.hasMore, false);
      assert.notEqual(page1.json.sales[0].order.id, page2.json.sales[0].order.id);
      assert.ok(!sales.text.includes(file));
      assert.equal((await call("PATCH", status, "other", { status: "processing" })).status, 403);
      assert.equal((await call("PATCH", status, "seller", { status: "processing" })).status, 200);
      assert.equal((await call("PATCH", status, "seller", { status: "delivered" })).status, 200);
      const after = await call("GET", `${base}/my-purchases`, "buyer");
      assert.equal(after.json.orders.find((entry: typeof first.json) => entry.order.id === pickupOrder.id).order.status, "delivered");
      await local.query("UPDATE orders SET payment_status='refunded', seller_revenue_status='reversed' WHERE id=$1", [digitalOrder.id]);
      assert.equal((await call("GET", downloads, "buyer")).status, 404);
    } finally {
      await new Promise<void>((resolve) => server.close(() => resolve()));
      await local.query("DROP TABLE IF EXISTS orders, products, stores, notifications, users CASCADE");
      await local.end();
      await rm(uploadDir, { recursive: true, force: true });
    }
  });
}
