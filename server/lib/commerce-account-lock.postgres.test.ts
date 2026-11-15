/** Regression for Part 3b: an order and account closure must share the same row lock. */
import test from "node:test";
import assert from "node:assert/strict";
import { PG_URL, connectLocalPg, ddl } from "../test-support/authz-pg-harness";
import { BACK_OFFICE_SQL, CLEAN_UP_BACK_OFFICE, DROP_BACK_OFFICE } from "../test-support/staff-portal-harness";
import { CommerceAccountUnavailableError, lockActiveCommerceAccounts } from "../lib/commerce-account-lock";
import { sql } from "drizzle-orm";
import { readFileSync } from "node:fs";

const CLOSURE_SQL = readFileSync(new URL("../../docs/ops/2026-11-10-account-closure-preparation.sql", import.meta.url), "utf8");

async function waitForBlockedLock(local: any, phrase: string) {
  const deadline = Date.now() + 10000;
  while (Date.now() < deadline) {
    const result = await local.query(
      "SELECT count(*)::int AS n FROM pg_stat_activity WHERE wait_event_type = 'Lock' AND query ILIKE $1",
      [`%${phrase}%`],
    );
    if (Number(result.rows[0]?.n) > 0) return;
    await new Promise((resolve) => setTimeout(resolve, 25));
  }
  throw new Error(`Expected concurrent transaction to wait on account lock: ${phrase}`);
}


if (!PG_URL) {
  test("Commerce/closure lock integration requires CS_TEST_PG_URL", { skip: true }, () => {});
} else {
  test("closure wins the account lock: checkout refuses without creating an order", async () => {
    const local = await connectLocalPg();
    const schema = await import("../../shared/schema");
    const { db } = await import("../db");
    try {
      await local.query(`${DROP_BACK_OFFICE} DROP TABLE IF EXISTS orders, products, users CASCADE;
        ${ddl(schema.users, "users")};
        ${ddl(schema.products, "products")};
        ${ddl(schema.orders, "orders")};
        ${BACK_OFFICE_SQL}
        ${CLOSURE_SQL}
      `);
      const [buyer] = (await local.query("INSERT INTO users(username, email, display_name) VALUES('close-buyer','b@example.test','Buyer') RETURNING id")).rows;
      const [seller] = (await local.query("INSERT INTO users(username, email, display_name) VALUES('close-seller','s@example.test','Seller') RETURNING id")).rows;
      const holder = await local.connect();
      try {
        await holder.query("BEGIN");
        await holder.query("SELECT id FROM users WHERE id=$1 FOR UPDATE", [buyer.id]);
        await holder.query("INSERT INTO account_status(user_id, status, reason) VALUES($1,'closed','Close won')", [buyer.id]);
        const checkout = db.transaction(async (tx: any) => {
          await lockActiveCommerceAccounts(tx, buyer.id, seller.id);
          await tx.execute(sql`INSERT INTO orders(buyer_id, seller_id, product_id, quantity, total_amount, platform_fee, seller_amount, fulfillment_method)
            VALUES (${buyer.id}, ${seller.id}, 'none', 1, 10, 1, 9, 'local_pickup')`);
        });
        // Confirm checkout is actually waiting on the account row before staff closes.
        await waitForBlockedLock(local, "FROM users WHERE id IN");
        await holder.query("COMMIT");
        await assert.rejects(checkout, CommerceAccountUnavailableError);
      } finally {
        await holder.query("ROLLBACK").catch(() => {});
        holder.release();
      }
      assert.equal((await local.query("SELECT count(*)::int n FROM orders")).rows[0].n, 0);
    } finally {
      await local.query(`${CLEAN_UP_BACK_OFFICE} DROP TABLE IF EXISTS orders, products, users CASCADE;`);
      await local.end();
    }
  });

  test("order wins the account lock: closure sees it and cannot proceed", async () => {
    const local = await connectLocalPg();
    const schema = await import("../../shared/schema");
    const { db } = await import("../db");
    try {
      await local.query(`${DROP_BACK_OFFICE} DROP TABLE IF EXISTS orders, products, users CASCADE;
        ${ddl(schema.users, "users")};
        ${ddl(schema.products, "products")};
        ${ddl(schema.orders, "orders")};
        ${BACK_OFFICE_SQL}
        ${CLOSURE_SQL}
      `);
      const [buyer] = (await local.query("INSERT INTO users(username, email, display_name) VALUES('buy-first','buyer@example.test','Buyer') RETURNING id")).rows;
      const [seller] = (await local.query("INSERT INTO users(username, email, display_name) VALUES('sell-first','seller@example.test','Seller') RETURNING id")).rows;
      const [product] = (await local.query("INSERT INTO products(seller_id, name, price, category, inventory) VALUES($1,'Item',10,'general',1) RETURNING id", [seller.id])).rows;
      let release!: () => void;
      let acquired!: () => void;
      const holding = new Promise<void>((r) => { release = r; });
      const lockTaken = new Promise<void>((r) => { acquired = r; });
      const checkout = db.transaction(async (tx: any) => {
        await lockActiveCommerceAccounts(tx, buyer.id, seller.id);
        acquired();
        await holding;
        await tx.execute(sql`INSERT INTO orders(buyer_id, seller_id, product_id, quantity, total_amount, platform_fee, seller_amount, fulfillment_method)
          VALUES (${buyer.id}, ${seller.id}, ${product.id}, 1, 10, 1, 9, 'local_pickup')`);
      });
      await lockTaken;
      // Future closure must take the same user lock before checking open obligations.
      const close = db.transaction(async (tx: any) => {
        await tx.execute(sql`SELECT id FROM users WHERE id = ${buyer.id} FOR UPDATE`);
        const rows: any = await tx.execute(sql`SELECT count(*)::int AS n FROM orders WHERE buyer_id = ${buyer.id}`);
        const list = rows?.rows ?? rows;
        if (Number(list[0]?.n) !== 0) return false;
        await tx.execute(sql`INSERT INTO account_status (user_id, status) VALUES (${buyer.id}, 'closed')`);
        return true;
      });
      await waitForBlockedLock(local, "FROM users WHERE id =");
      release();
      await checkout;
      assert.equal(await close, false, "closure sees the committed order and must refuse");
      assert.equal((await local.query("SELECT count(*)::int n FROM orders")).rows[0].n, 1);
      assert.equal((await local.query("SELECT count(*)::int n FROM account_status WHERE status='closed'")).rows[0].n, 0);
    } finally {
      await local.query(`${CLEAN_UP_BACK_OFFICE} DROP TABLE IF EXISTS orders, products, users CASCADE;`);
      await local.end();
    }
  });

  test("the two account rows are locked in id order, so opposite-direction purchases cannot deadlock", async () => {
    const local = await connectLocalPg();
    const schema = await import("../../shared/schema");
    const { db } = await import("../db");
    try {
      await local.query(`
        ${DROP_BACK_OFFICE}
        DROP TABLE IF EXISTS orders, products, users CASCADE;
        ${ddl(schema.users, "users")};
        ${BACK_OFFICE_SQL}
        ${CLOSURE_SQL}
      `);
      const mk = async (name: string) => (await local.query(
        "INSERT INTO users (username, email, display_name, password, auth_version) VALUES ($1, $2, $1, 'x', 1) RETURNING id",
        [name, `${name}@example.test`],
      )).rows[0].id;
      const ids = [await mk("one"), await mk("two")].sort();
      const [lowerId, higherId] = ids;

      // Hold the LOWER id, then ask the helper for a purchase whose BUYER is the higher id. Locking in buyer order
      // would take the higher row first and then wait; locking in id order waits on the lower row and never touches
      // the higher one. A third connection settles which happened.
      const holder = await local.connect();
      let settled = false;
      try {
        await holder.query("BEGIN");
        await holder.query("SELECT id FROM users WHERE id = $1 FOR UPDATE", [lowerId]);

        const attempt = db.transaction(async (tx: any) => {
          await lockActiveCommerceAccounts(tx, higherId, lowerId);
        });
        await waitForBlockedLock(local, "FROM users WHERE id IN");

        const prober = await local.connect();
        try {
          await prober.query("BEGIN");
          await prober.query("SELECT id FROM users WHERE id = $1 FOR UPDATE NOWAIT", [higherId]);
          await prober.query("ROLLBACK");
        } catch (error: any) {
          await prober.query("ROLLBACK").catch(() => {});
          assert.fail(`the higher id was already locked, so the lock order is not by id: ${error?.message}`);
        } finally {
          prober.release();
        }

        await holder.query("COMMIT");
        settled = true;
        await attempt;
      } finally {
        if (!settled) await holder.query("ROLLBACK").catch(() => {});
        holder.release();
      }
    } finally {
      await local.query(`${CLEAN_UP_BACK_OFFICE} DROP TABLE IF EXISTS orders, products, users CASCADE;`);
      await local.end();
    }
  });
}
