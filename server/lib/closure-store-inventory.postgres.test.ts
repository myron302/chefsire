/** Read-only product/media classification under real PostgreSQL. */
import test from "node:test";
import assert from "node:assert/strict";
import { PG_URL, connectLocalPg } from "../test-support/authz-pg-harness";
import { inspectClosureStoreInventory } from "./closure-store-inventory";

if (!PG_URL) {
  test("store closure inventory requires CS_TEST_PG_URL", { skip: true }, () => {});
} else {
  test("ordered products and digital file evidence are retained regardless of sales_count", async () => {
    const local = await connectLocalPg();
    const { db } = await import("../db");
    try {
      await local.query(`
        DROP TABLE IF EXISTS orders, products, stores CASCADE;
        CREATE TABLE products (
          id text PRIMARY KEY, seller_id text, sales_count int, is_digital boolean,
          digital_file_url text, images jsonb
        );
        CREATE TABLE orders (id text PRIMARY KEY, product_id text);
        CREATE TABLE stores (id text PRIMARY KEY, user_id text, published boolean);
        INSERT INTO products VALUES
          ('ordered','closing',0,false,null,'["/uploads/a","/uploads/b"]'),
          ('unsold','closing',100,false,null,'["/uploads/c"]'),
          ('digital','closing',0,true,'/uploads/paid.zip','["/uploads/d"]'),
          ('other','someone-else',2,true,'/uploads/other.zip','["/uploads/e"]');
        INSERT INTO orders VALUES ('order1','ordered'), ('order2','digital'), ('order3','other');
        INSERT INTO stores VALUES ('store1','closing',true),('store2','someone-else',true);
      `);
      const inventory = await db.transaction((tx: any) => inspectClosureStoreInventory(tx, "closing"));
      assert.deepEqual(inventory, {
        purchasedProductRowsToRetain: 2,
        unpurchasedProductRowsToReview: 1,
        purchasedDigitalFilesToPreserve: 1,
        candidateProductImageReferences: 4,
        storeRowsToUnpublish: 1,
      });
      const contents = await local.query("SELECT id,sales_count FROM products ORDER BY id");
      assert.equal(contents.rows.length, 4, "classification never changes seller or counterparty assets");
      assert.equal(contents.rows.find((r: any) => r.id === "unsold")?.sales_count, 100,
        "a mutable aggregate counter must not override the absence of order evidence");

      await local.query("DROP TABLE orders");
      await assert.rejects(db.transaction((tx: any) => inspectClosureStoreInventory(tx, "closing")),
        /orders/, "missing transaction history cannot be read as no sales");
    } finally {
      await local.query("DROP TABLE IF EXISTS orders, products, stores CASCADE");
      await local.end();
    }
  });
}
