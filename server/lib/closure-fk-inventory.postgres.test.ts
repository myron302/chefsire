import test from "node:test";
import assert from "node:assert/strict";
import { PG_URL, connectLocalPg } from "../test-support/authz-pg-harness";
import {
  inspectClosureUserForeignKeys, closureForeignKeyInventoryClear, CLOSURE_FK_CLASSES,
} from "./closure-fk-inventory";

test("no FK policy table is duplicated across retention classes", () => {
  const all = Object.values(CLOSURE_FK_CLASSES).flat();
  assert.equal(all.length, new Set(all).size);
  assert.ok(CLOSURE_FK_CLASSES.retain_ledger.includes("creator_membership_sales_ledger"));
  assert.ok(CLOSURE_FK_CLASSES.retain_ledger.includes("catering_booking_payments"));
});

if (!PG_URL) {
  test("FK inventory requires CS_TEST_PG_URL", { skip: true }, () => {});
} else {
  test("unknown user FK blocks closure even when its table contains zero rows", async () => {
    const local = await connectLocalPg();
    try {
      await local.query(`
        DROP TABLE IF EXISTS unexpected_account_link, orders, users CASCADE;
        CREATE TABLE users(id varchar PRIMARY KEY);
        CREATE TABLE orders (id varchar PRIMARY KEY, buyer_id varchar REFERENCES users(id));
      `);
      const { db } = await import("../db");
      const before = await db.transaction((tx: any) => inspectClosureUserForeignKeys(tx));
      assert.deepEqual(before.unknownTables, []);
      assert.ok(before.dependencies.some(x => x.table === "orders" && x.category === "retain_ledger"));
      assert.equal(closureForeignKeyInventoryClear(before), true);

      await local.query(`
        CREATE TABLE unexpected_account_link(
          id varchar PRIMARY KEY, user_id varchar REFERENCES users(id) ON DELETE CASCADE
        );
      `);
      const after = await db.transaction((tx: any) => inspectClosureUserForeignKeys(tx));
      assert.deepEqual(after.unknownTables, ["unexpected_account_link"]);
      assert.equal(closureForeignKeyInventoryClear(after), false);
      assert.equal(after.dependencies.find(x => x.table === "unexpected_account_link")?.onDelete, "CASCADE");
    } finally {
      await local.query("DROP TABLE IF EXISTS unexpected_account_link, orders, users CASCADE");
      await local.end();
    }
  });
}
