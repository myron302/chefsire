/**
 * Back office part 2: member account status (active / restricted / suspended), enforced across the site, and the
 * staff member record (search, transaction history, audit history). Real routers on a real local PostgreSQL with the
 * production DDL (docs/ops back office files). Staff act through the staff portal API (/api/ops/admin).
 */
import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import express from "express";
import cookieParser from "cookie-parser";
import type { AddressInfo } from "node:net";
import { PG_URL, connectLocalPg, ddl, makeCaller } from "../test-support/authz-pg-harness";
import { BACK_OFFICE_SQL, DROP_BACK_OFFICE, makeStaff, makeStaffCaller } from "../test-support/staff-portal-harness";

if (!PG_URL) {
  test("Back office members (requires CS_TEST_PG_URL)", { skip: true }, () => {});
} else {
  process.env.INTERNAL_ADMIN_EMAILS = "owner@chefsire.test";

  test("a suspended author's posts, comments and likers are hidden on every path, and come back on reinstatement", async () => {
    const local = await connectLocalPg();
    const schema = await import("../../shared/schema");
    const { default: posts } = await import("./posts");
    const { createOpsRouter } = await import("./ops");
    const app = express();
    app.use(express.json());
    app.use("/api/posts", posts);
    app.use("/api/ops", createOpsRouter());
    const server = app.listen(0, "127.0.0.1");
    try {
      await local.query(`
        ${DROP_BACK_OFFICE}
        DROP TABLE IF EXISTS comment_likes, likes, comments, follows, recipes, posts, users CASCADE;
        ${ddl(schema.users, "users")};
        ${ddl(schema.posts, "posts")};
        ${ddl(schema.recipes, "recipes")};
        ${ddl(schema.comments, "comments")};
        ${ddl(schema.likes, "likes")};
        ${ddl(schema.commentLikes, "comment_likes")};
        ${ddl(schema.follows, "follows")};
        ${BACK_OFFICE_SQL}
      `);
      const ids: Record<string, string> = {};
      for (const name of ["author", "fan"]) {
        ids[name] = (await local.query(
          `INSERT INTO users (username, email, display_name, password, auth_version, is_private) VALUES ($1, $2, $1, 'fixture', 1, false) RETURNING id`,
          [name, `${name}@example.test`],
        )).rows[0].id;
      }
      const helper = await makeStaff(local, "helper", { groups: ["grp-support"] });
      const call = makeCaller(() => `http://127.0.0.1:${(server.address() as AddressInfo).port}`, (who) => ids[who]);
      const staffCall = makeStaffCaller(() => `http://127.0.0.1:${(server.address() as AddressInfo).port}`, (who) => (who === "helper" ? helper.cookie : undefined));

      const created = await call("POST", "/api/posts", "author", { caption: "public dinner", imageUrl: "https://images.example.test/d.jpg", additionalImages: [] });
      assert.equal(created.status, 201, created.text);
      const postId = created.json.id;
      assert.equal((await call("POST", "/api/posts/comments", "fan", { postId, text: "looks great" })).status, 201);
      assert.equal((await call("POST", "/api/posts/likes", "fan", { postId })).status, 201);

      const paths = [`/api/posts/${postId}`, `/api/posts/${postId}/comments`, `/api/posts/${postId}/likes`];
      const visibleTo = async (who: string) => {
        const out: Record<string, number> = {};
        for (const p of paths) out[p] = (await call("GET", p, who)).status;
        const byUser = await call("GET", `/api/posts/user/${ids.author}`, who);
        out.byUser = byUser.status === 200 && JSON.stringify(byUser.json).includes(postId) ? 200 : 404;
        const explore = await call("GET", "/api/posts/explore", who);
        out.explore = JSON.stringify(explore.json ?? "").includes(postId) ? 200 : 404;
        return out;
      };
      const all = (status: number) => Object.fromEntries([...paths, "byUser", "explore"].map((p) => [p, status]));
      assert.deepEqual(await visibleTo("anon"), all(200));
      assert.deepEqual(await visibleTo("fan"), all(200));

      assert.equal((await staffCall("POST", `/api/ops/admin/members/${ids.author}/status`, "helper", { status: "suspended", reason: "Investigation" })).status, 200);
      assert.deepEqual(await visibleTo("anon"), all(404), "hidden from anonymous visitors on every path");
      assert.deepEqual(await visibleTo("fan"), all(404), "hidden from other members on every path, including the one who commented and liked");

      assert.equal((await staffCall("POST", `/api/ops/admin/members/${ids.author}/status`, "helper", { status: "active", reason: "Cleared" })).status, 200);
      assert.deepEqual(await visibleTo("fan"), all(200), "reinstated: everything is back");
      const counts = (await local.query("SELECT (SELECT count(*) FROM posts)::int p, (SELECT count(*) FROM comments)::int c, (SELECT count(*) FROM likes)::int l")).rows[0];
      assert.deepEqual(counts, { p: 1, c: 1, l: 1 }, "nothing was deleted");
    } finally {
      await new Promise<void>((resolve) => server.close(() => resolve()));
      await local.query(`${DROP_BACK_OFFICE} DROP TABLE IF EXISTS comment_likes, likes, comments, follows, recipes, posts, users CASCADE;`);
      await local.end();
    }
  });

  test("restrict and suspend are enforced everywhere, reversible, audited, and transaction records are always kept", async () => {
    const local = await connectLocalPg();
    const schema = await import("../../shared/schema");
    const { createOpsRouter } = await import("./ops");
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
    app.use("/api/ops", createOpsRouter());
    app.use("/api/users", users);
    app.use("/api/marketplace", marketplace);
    app.use("/api/orders", orders);
    const server = app.listen(0, "127.0.0.1");
    try {
      await local.query(`
        ${DROP_BACK_OFFICE}
        DROP TABLE IF EXISTS orders, products, stores, notifications, users CASCADE;
        ${ddl(schema.users, "users")};
        ${ddl(schema.products, "products")};
        ${ddl(schema.notifications, "notifications")};
        ${ddl(schema.stores, "stores")};
        ${ddl(schema.orders, "orders", ", UNIQUE (buyer_id, checkout_idempotency_key)")};
        ${BACK_OFFICE_SQL}
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
      const staff: Record<string, { id: string; cookie: string }> = {
        owner: await makeStaff(local, "owner", { isOwner: true }),
        helper: await makeStaff(local, "helper", { groups: ["grp-support"] }),
        marketer: await makeStaff(local, "marketer", { groups: ["grp-marketing"] }),
      };
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
      const staffCall = makeStaffCaller(() => `http://127.0.0.1:${(server.address() as AddressInfo).port}`, (who) => staff[who]?.cookie);
      const login = (email: string) => call("POST", "/api/auth/login", "anon", { email, password: "member-password" });
      const setStatus = (who: string, target: string, status: string, reason = "Policy review") =>
        staffCall("POST", `/api/ops/admin/members/${ids[target]}/status`, who, { status, reason });
      const productVisible = async () => (await call("GET", "/api/marketplace/products", "anon")).json.products.some((p: any) => p.id === product.id);

      // Search: staff with members.view only (a member's sign-in is not a staff session); by name, email, partial phone.
      assert.equal((await call("GET", "/api/ops/admin/members?q=sell", "buyer")).status, 401);
      assert.deepEqual((await staffCall("GET", "/api/ops/admin/members?q=SELL", "marketer")).json.members.map((m: any) => m.username), ["seller"]);
      assert.deepEqual((await staffCall("GET", "/api/ops/admin/members?q=555-0123", "helper")).json.members.map((m: any) => m.username), ["seller"]);
      assert.deepEqual((await staffCall("GET", "/api/ops/admin/members?q=%25", "helper")).json.members, [], "LIKE wildcards are literal");

      // Member record: transactions visible to orders.view holders.
      const record = (await staffCall("GET", `/api/ops/admin/members/${ids.seller}`, "marketer")).json;
      assert.equal(record.status.status, "active");
      const selling = record.records.find((s: any) => s.name === "Marketplace orders (selling)");
      assert.deepEqual(selling.rows.map((o: any) => [o.id, o.counterparty, o.paymentStatus]), [[order.id, "buyer", "captured"]]);
      assert.deepEqual(record.canChangeStatus, { restrict: false, suspend: false });

      // Marketing can't change status; accounts on the server's admin list can't be changed; a reason is required.
      assert.equal((await setStatus("marketer", "seller", "restricted")).status, 403);
      assert.equal((await setStatus("helper", "owner", "suspended")).status, 400);
      assert.equal((await staffCall("POST", `/api/ops/admin/members/${ids.seller}/status`, "helper", { status: "restricted", reason: "" })).status, 400);

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
      const suspendedRecord = (await staffCall("GET", `/api/ops/admin/members/${ids.seller}`, "helper")).json;
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
      const history = (await staffCall("GET", `/api/ops/admin/members/${ids.seller}`, "owner")).json.history;
      assert.deepEqual(history.map((h: any) => [h.action, h.actorLabel, h.reason]), [
        ["member.status.active", "Helper (helper)", "Appeal accepted"],
        ["member.status.suspended", "Helper (helper)", "Fraud investigation"],
        ["member.status.restricted", "Helper (helper)", "Spam reports"],
      ]);
      await assert.rejects(local.query("UPDATE admin_audit_log SET reason = 'edited'"), /append-only/);
      await assert.rejects(local.query("DELETE FROM admin_audit_log"), /append-only/);
    } finally {
      await new Promise<void>((resolve) => server.close(() => resolve()));
      await local.query(`${DROP_BACK_OFFICE} DROP TABLE IF EXISTS orders, products, stores, notifications, users CASCADE;`);
      await local.end();
    }
  });
}
