/**
 * Phase 3C: seller revenue/analytics authorization.
 *
 * Real HTTP, real router, real storage and SQL on a local PostgreSQL (CS_TEST_PG_URL; skipped otherwise).
 * Invariant: GET /sellers/:sellerId/analytics returns revenue only to that seller or a current administrator
 * (INTERNAL_ADMIN_EMAILS, evaluated against the stored account), and answers non-owners identically whether or not
 * the seller exists. Public storefront/product reads are unchanged.
 */
import test from "node:test";
import assert from "node:assert/strict";
import express from "express";
import type { AddressInfo } from "node:net";
import { PG_URL, connectLocalPg, ddl, makeCaller } from "../test-support/authz-pg-harness";

if (!PG_URL) {
  test("seller analytics (skipped: CS_TEST_PG_URL not set)", { skip: true }, () => {});
} else {
  process.env.INTERNAL_ADMIN_EMAILS = "ops@chefsire.test";
  const local = await connectLocalPg();
  const schema = await import("../../shared/schema");
  await local.query(`
    DROP TABLE IF EXISTS users, products CASCADE;
    ${ddl(schema.users, "users", ", UNIQUE (username), UNIQUE (email)")};
    ${ddl(schema.products, "products")};
  `);
  const { default: marketplaceRouter } = await import("./marketplace");
  const app = express();
  app.use(express.json());
  app.use("/api/marketplace", marketplaceRouter);
  const server = app.listen(0);
  test.after(async () => { server.close(); await local.end(); });

  const ids: Record<string, string> = {};
  const call = makeCaller(() => `http://127.0.0.1:${(server.address() as AddressInfo).port}`, (who) => ids[who]);
  const REVENUE = "4321.5";

  test.beforeEach(async () => {
    await local.query(`TRUNCATE users, products CASCADE`);
    const mk = async (name: string, email: string, revenue: string) => {
      ids[name] = (await local.query(
        `INSERT INTO users (username, email, display_name, password, monthly_revenue, email_verified_at, email_verified_via) VALUES ($1, $2, $1, 'HASH-SECRET', $3, now(), 'email_link') RETURNING id`,
        [name, email, revenue],
      )).rows[0].id;
    };
    await mk("seller", "seller@example.com", REVENUE);
    await mk("otherseller", "other@example.com", "99");
    await mk("buyer", "buyer@example.com", "0");
    await mk("admin", "ops@chefsire.test", "0");
    await local.query(`INSERT INTO products (seller_id, name, price, category, is_active, sales_count, views_count, is_digital, digital_file_url) VALUES ($1, 'cake', '5.00', 'baked', true, 7, 31337, true, 'https://files.example/PAID-DOWNLOAD.pdf')`, [ids.seller]);
  });

  const analytics = (sellerKey: string, as: string) => call("GET", `/api/marketplace/sellers/${ids[sellerKey] ?? sellerKey}/analytics`, as);

  test("anonymous callers are refused and learn nothing", async () => {
    const r = await analytics("seller", "anon");
    assert.equal(r.status, 401);
    assert.ok(!r.text.includes("4321.5"));
  });

  test("buyers and other sellers cannot read someone else's revenue", async () => {
    for (const who of ["buyer", "otherseller"]) {
      const r = await analytics("seller", who);
      assert.equal(r.status, 403, who);
      assert.ok(!r.text.includes("4321.5") && !r.text.includes("monthlyRevenue"), who);
    }
  });

  test("a non-owner gets the same answer for an existing and a non-existent seller", async () => {
    const real = await analytics("seller", "buyer");
    const ghost = await analytics("no-such-seller", "buyer");
    assert.equal(ghost.status, real.status);
    assert.deepEqual(ghost.json, real.json);
  });

  test("the seller reads their own analytics, ignoring any client-supplied identity", async () => {
    const r = await analytics("seller", "seller");
    assert.equal(r.status, 200);
    assert.equal(r.json.monthlyRevenue, 4321.5);
    assert.equal(r.json.totalProducts, 1);
    assert.equal(r.json.totalSales, 7);
    // Spoofed identity hints do not substitute for the verified session.
    const spoof = await fetch(`http://127.0.0.1:${(server.address() as AddressInfo).port}/api/marketplace/sellers/${ids.seller}/analytics?userId=${ids.seller}`, { headers: { "x-user-id": ids.seller } });
    assert.equal(spoof.status, 401);
  });

  test("a current administrator may read any seller's analytics; a missing seller is a 404 only for them", async () => {
    assert.equal((await analytics("seller", "admin")).json.monthlyRevenue, 4321.5);
    assert.equal((await analytics("no-such-seller", "admin")).status, 404);
  });

  test("an account that merely claims the admin address without proving it is not an administrator", async () => {
    await local.query(`UPDATE users SET email = 'retired@example.com' WHERE id = $1`, [ids.admin]);
    await local.query(`UPDATE users SET email = 'ops@chefsire.test', email_verified_at = NULL, email_verified_via = NULL WHERE id = $1`, [ids.buyer]);
    assert.equal((await analytics("seller", "buyer")).status, 403);
  });

  test("public storefront and product reads stay public but never embed the seller's private account row", async () => {
    const base = `/api/marketplace`;
    const productId = (await local.query(`SELECT id FROM products LIMIT 1`)).rows[0].id;
    const reads = [
      await call("GET", `${base}/storefront/seller`, "anon"),
      await call("GET", `${base}/sellers/${ids.seller}/products`, "anon"),
      await call("GET", `${base}/products`, "anon"),
      await call("GET", `${base}/products/${productId}`, "anon"),
    ];
    for (const r of reads) {
      assert.equal(r.status, 200);
      assert.ok(r.text.includes("cake"), "product data is still served");
      for (const secret of ["4321.5", "HASH-SECRET", "seller@example.com", "monthlyRevenue", "password"]) {
        assert.ok(!r.text.includes(secret), `public read leaked ${secret}`);
      }
    }
    assert.equal((await call("GET", `${base}/products/${productId}`, "anon")).json.seller.username, "seller");
    // Paid download links and the protected sales/view counters are not public product data...
    for (const r of reads) {
      for (const hidden of ["PAID-DOWNLOAD", "digitalFileUrl", "salesCount", "viewsCount", "31337"]) assert.ok(!r.text.includes(hidden), `public read leaked ${hidden}`);
    }
    // ...but the seller still sees them on their own listing (edit form, dashboard); other users do not.
    const own = await call("GET", `${base}/sellers/${ids.seller}/products`, "seller");
    assert.equal(own.json.products[0].digitalFileUrl, "https://files.example/PAID-DOWNLOAD.pdf");
    assert.equal(own.json.products[0].salesCount, 7);
    assert.ok(!(await call("GET", `${base}/sellers/${ids.seller}/products`, "buyer")).text.includes("PAID-DOWNLOAD"));
  });
}
