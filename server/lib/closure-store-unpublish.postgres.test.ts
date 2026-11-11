import "../test-support/auth-test-env";
import test from "node:test";
import assert from "node:assert/strict";
import { PG_URL, connectLocalPg } from "../test-support/authz-pg-harness";
import { unpublishClosingSellerWithinTransaction } from "./closure-store-unpublish";

if (!PG_URL) {
  test("Seller closure unpublish requires CS_TEST_PG_URL", { skip: true }, () => {});
} else {
  test("seller stores and products unpublish without destroying paid products and downloads", async () => {
    const local = await connectLocalPg();
    const { db } = await import("../db");
    try {
      await local.query(`
        DROP TABLE IF EXISTS store_drops, orders, stores, products, users CASCADE;
        CREATE TABLE users(id varchar PRIMARY KEY);
        CREATE TABLE products(id varchar PRIMARY KEY, seller_id varchar REFERENCES users(id),
          is_active boolean, is_digital boolean, digital_file_url text, name text);
        CREATE TABLE stores(id varchar PRIMARY KEY, user_id varchar REFERENCES users(id),
          published boolean, bio text, handle text);
        CREATE TABLE store_drops(id varchar PRIMARY KEY, owner_id varchar REFERENCES users(id));
        CREATE TABLE orders(id varchar PRIMARY KEY, buyer_id varchar REFERENCES users(id),
          product_id varchar REFERENCES products(id), total_amount numeric);
        INSERT INTO users VALUES ('closing'), ('other'), ('buyer');
        INSERT INTO products VALUES ('sold','closing',true,true,'/uploads/paid.zip','Digital'),
          ('unsold','closing',true,false,null,'Draft'), ('unrelated','other',true,false,null,'Other');
        INSERT INTO stores VALUES ('closed-store','closing',true,'personal bio','keep-reserved'),
          ('other-store','other',true,'other bio','keep-other');
        INSERT INTO store_drops VALUES ('drop','closing'), ('other-drop','other');
        INSERT INTO orders VALUES ('sale','buyer','sold',25.00);
      `);
      const result = await db.transaction((tx: any) => unpublishClosingSellerWithinTransaction(tx, "closing"));
      assert.deepEqual(result, { productsUnpublished: 2, storesUnpublished: 1, marketingDropsDeleted: 1 });
      assert.deepEqual((await local.query("SELECT id,is_active,digital_file_url FROM products ORDER BY id")).rows, [
        { id: "sold", is_active: false, digital_file_url: "/uploads/paid.zip" },
        { id: "unrelated", is_active: true, digital_file_url: null },
        { id: "unsold", is_active: false, digital_file_url: null },
      ]);
      assert.deepEqual((await local.query("SELECT id,published,bio,handle FROM stores ORDER BY id")).rows, [
        { id: "closed-store", published: false, bio: null, handle: "keep-reserved" },
        { id: "other-store", published: true, bio: "other bio", handle: "keep-other" },
      ]);
      assert.equal((await local.query("SELECT count(*)::int n FROM orders")).rows[0].n, 1);
      assert.deepEqual((await local.query("SELECT id FROM store_drops ORDER BY id")).rows,
        [{id:"other-drop"}]);
      assert.deepEqual(await db.transaction((tx: any) => unpublishClosingSellerWithinTransaction(tx, "closing")),
        { productsUnpublished: 0, storesUnpublished: 0, marketingDropsDeleted: 0 });
    } finally {
      await local.query("DROP TABLE IF EXISTS store_drops, orders, stores, products, users CASCADE");
      await local.end();
    }
  });
}
