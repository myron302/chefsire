import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import express from "express";
import type { AddressInfo } from "node:net";
import { PG_URL, connectLocalPg, ddl, makeCaller } from "../test-support/authz-pg-harness";

if (!PG_URL) {
  test("Marketplace fulfillment status (requires CS_TEST_PG_URL)", { skip: true }, () => {});
} else {
  test("pickup and shipped orders move through honest, idempotent fulfillment states", async () => {
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
      for (const name of ["buyer", "seller", "other"]) {
        ids[name] = (await local.query(
          "INSERT INTO users (username, email, display_name, password, auth_version) VALUES ($1, $2, $1, 'fixture', 1) RETURNING id",
          [name, `${name}@example.test`],
        )).rows[0].id;
      }
      const [cookies, jam] = (await local.query(`
        INSERT INTO products (seller_id, name, price, category, inventory, shipping_enabled, local_pickup_enabled, is_digital, in_store_only)
        VALUES ($1, 'cookies', 10.99, 'general', 10, true, true, false, false),
               ($1, 'jam', 8, 'general', 10, true, false, false, false)
        RETURNING id
      `, [ids.seller])).rows;
      const call = makeCaller(() => `http://127.0.0.1:${(server.address() as AddressInfo).port}`, (who) => ids[who]);
      const pickupOrder = (await call("POST", "/api/orders/checkout", "buyer", {
        productId: cookies.id, quantity: 1, fulfillmentMethod: "local_pickup", checkoutIdempotencyKey: randomUUID(),
      })).json.order;
      const shippedOrder = (await call("POST", "/api/orders/checkout", "buyer", {
        productId: jam.id, quantity: 1, fulfillmentMethod: "shipping", checkoutIdempotencyKey: randomUUID(),
        shippingAddress: { street: "1 Main St", city: "Hartford", state: "CT", zipCode: "06103", country: "USA" },
      })).json.order;
      assert.equal(pickupOrder.deliveryMethod, "pickup");
      assert.equal(shippedOrder.deliveryMethod, "shipped");
      // Verified capture, as the payment route leaves it. No Square requests.
      await local.query(`
        UPDATE orders SET payment_status='captured', payment_provider='square', provider_payment_status='COMPLETED',
          square_payment_id='test-' || id, payment_captured_at=now(), seller_revenue_status='credited'
      `);

      const patch = (id: string, who: string, body: Record<string, unknown>) => call("PATCH", `/api/orders/${id}/status`, who, body);
      // Notifications are written just after the response, so wait (up to 10 s) until at least `expected` exist, then
      // settle briefly and read again so an unexpected extra (duplicate) notification is still caught.
      const readNotes = async () => (await local.query(
        "SELECT message FROM notifications WHERE user_id = $1 ORDER BY created_at, id", [ids.buyer],
      )).rows.map((r: { message: string }) => r.message);
      const buyerNotes = async (expected: number) => {
        for (let waited = 0; (await readNotes()).length < expected && waited < 10_000; waited += 50) {
          await new Promise((r) => setTimeout(r, 50));
        }
        await new Promise((r) => setTimeout(r, 300));
        return readNotes();
      };

      // Only the seller may move an order.
      assert.equal((await patch(pickupOrder.id, "other", { status: "processing" })).status, 403);
      assert.equal((await patch(pickupOrder.id, "buyer", { status: "processing" })).status, 403);

      // Pickup: never "shipped".
      const wrong = await patch(pickupOrder.id, "seller", { status: "shipped" });
      assert.equal(wrong.status, 409, wrong.text);
      assert.equal(wrong.json.code, "INVALID_FULFILLMENT_TRANSITION");
      assert.equal((await patch(pickupOrder.id, "seller", { status: "processing" })).status, 200);
      assert.equal((await patch(pickupOrder.id, "seller", { status: "shipped" })).status, 409);
      // A repeated click changes nothing and doesn't notify twice.
      const repeat = await patch(pickupOrder.id, "seller", { status: "processing" });
      assert.equal(repeat.status, 200, repeat.text);
      assert.equal(repeat.json.order.status, "processing");
      assert.equal((await patch(pickupOrder.id, "seller", { status: "delivered" })).status, 200);
      assert.equal((await patch(pickupOrder.id, "seller", { status: "delivered" })).status, 200);
      assert.equal((await patch(pickupOrder.id, "seller", { status: "processing" })).status, 409, "no going backwards");
      assert.equal((await patch(pickupOrder.id, "seller", { status: "cancelled" })).status, 409, "a paid order isn't cancelled without a refund");
      assert.deepEqual(await buyerNotes(2), [
        "Your order for cookies is being prepared for pickup",
        "Your order for cookies has been picked up",
      ]);

      // Shipped: processing -> shipped (tracking) -> delivered; adding tracking later still updates it.
      assert.equal((await patch(shippedOrder.id, "seller", { status: "processing" })).status, 200);
      assert.equal((await patch(shippedOrder.id, "seller", { status: "shipped" })).status, 200);
      const tracked = await patch(shippedOrder.id, "seller", { status: "shipped", trackingNumber: "1Z999" });
      assert.equal(tracked.status, 200, tracked.text);
      assert.equal(tracked.json.order.trackingNumber, "1Z999");
      // The same tracking number again, or blank, is a no-op; a tracking number on a non-shipping step is refused.
      assert.equal((await patch(shippedOrder.id, "seller", { status: "shipped", trackingNumber: " 1Z999 " })).json.message, "Order status unchanged");
      assert.equal((await patch(shippedOrder.id, "seller", { status: "shipped", trackingNumber: "  " })).json.message, "Order status unchanged");
      const misplaced = await patch(shippedOrder.id, "seller", { status: "delivered", trackingNumber: "1Z000" });
      assert.equal(misplaced.status, 400, misplaced.text);
      assert.equal(misplaced.json.code, "TRACKING_NOT_APPLICABLE");
      assert.equal((await patch(pickupOrder.id, "seller", { status: "delivered", trackingNumber: "1Z000" })).status, 400);
      // An older pickup order wrongly left in "shipped" still can't take a tracking number.
      await local.query("UPDATE orders SET status = 'shipped' WHERE id = $1", [pickupOrder.id]);
      const legacy = await patch(pickupOrder.id, "seller", { status: "shipped", trackingNumber: "1ZLEGACY" });
      assert.equal(legacy.status, 400, legacy.text);
      assert.equal(legacy.json.code, "TRACKING_NOT_APPLICABLE");
      await local.query("UPDATE orders SET status = 'delivered' WHERE id = $1", [pickupOrder.id]);
      // 100 characters plus surrounding spaces is accepted (trimmed first); 101 is not.
      const padded = await patch(shippedOrder.id, "seller", { status: "shipped", trackingNumber: `  ${"T".repeat(100)}  ` });
      assert.equal(padded.status, 200, padded.text);
      assert.equal(padded.json.order.trackingNumber, "T".repeat(100));
      assert.equal((await patch(shippedOrder.id, "seller", { status: "shipped", trackingNumber: "T".repeat(101) })).status, 400);
      // Two concurrent tracking edits: exactly one wins, the other is told to reload.
      // Hold the row lock so both requests read the same tracking number before either can write.
      const holder = await local.connect();
      await holder.query("BEGIN");
      await holder.query("SELECT id FROM orders WHERE id = $1 FOR UPDATE", [shippedOrder.id]);
      const racing = Promise.all([
        patch(shippedOrder.id, "seller", { status: "shipped", trackingNumber: "1ZAAA" }),
        patch(shippedOrder.id, "seller", { status: "shipped", trackingNumber: "1ZBBB" }),
      ]);
      // Barrier: wait until both requests have read the order and are blocked on the row lock, so both read the
      // same tracking number before either can write. On any failure the lock is rolled back and the connection
      // released, so a broken barrier fails the test instead of hanging CI.
      let committed = false;
      try {
        for (let waited = 0; ; waited += 25) {
          const blocked = (await local.query(
            "SELECT count(*)::int AS n FROM pg_stat_activity WHERE wait_event_type = 'Lock' AND query ILIKE 'update \"orders\"%'",
          )).rows[0].n;
          if (blocked >= 2) break;
          if (waited > 10_000) throw new Error(`only ${blocked} request(s) reached the row lock`);
          await new Promise((r) => setTimeout(r, 25));
        }
        await holder.query("COMMIT");
        committed = true;
      } finally {
        if (!committed) await holder.query("ROLLBACK").catch(() => {});
        holder.release();
        if (!committed) await racing.catch(() => {});
      }
      const [a, b] = await racing;
      assert.deepEqual([a.status, b.status].sort(), [200, 409]);
      const winner = a.status === 200 ? "1ZAAA" : "1ZBBB";
      assert.equal((await local.query("SELECT tracking_number FROM orders WHERE id = $1", [shippedOrder.id])).rows[0].tracking_number, winner);
      assert.equal((await patch(shippedOrder.id, "seller", { status: "delivered" })).status, 200);
      const notes = await buyerNotes(8);
      assert.deepEqual(notes.slice(2), [
        "Your order for jam is being prepared",
        "Your order for jam has shipped",
        "Your order for jam has updated tracking information",
        "Your order for jam has updated tracking information",
        "Your order for jam has updated tracking information",
        "Your order for jam has been delivered",
      ]);

      // Buyer history reflects the final state.
      const history = await call("GET", "/api/orders/my-purchases", "buyer");
      const byId = Object.fromEntries(history.json.orders.map((e: { order: { id: string; status: string } }) => [e.order.id, e.order.status]));
      assert.equal(byId[pickupOrder.id], "delivered");
      assert.equal(byId[shippedOrder.id], "delivered");
      assert.equal((await local.query("SELECT inventory FROM products WHERE id = $1", [cookies.id])).rows[0].inventory, 10,
        "fulfillment never touches stock (capture reserved it; this fixture bypassed capture)");
    } finally {
      await new Promise<void>((resolve) => server.close(() => resolve()));
      await local.query("DROP TABLE IF EXISTS orders, products, stores, notifications, users CASCADE");
      await local.end();
    }
  });
}
