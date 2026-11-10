import test from "node:test";
import assert from "node:assert/strict";
import { PG_URL, connectLocalPg } from "../test-support/authz-pg-harness";
import { inspectClosurePrivateContent } from "./closure-private-content-inventory";

if (!PG_URL) {
  test("Private content inventory needs CS_TEST_PG_URL", { skip: true }, () => {});
} else {
  test("read-only private content preview handles multi-column user FKs and retains ledgers", async () => {
    const local = await connectLocalPg();
    const { db } = await import("../db");
    try {
      await local.query(`
        DROP TABLE IF EXISTS posts, follows, orders, users CASCADE;
        CREATE TABLE users(id varchar PRIMARY KEY);
        CREATE TABLE posts(id varchar PRIMARY KEY, user_id varchar REFERENCES users(id), caption text);
        CREATE TABLE follows(id varchar PRIMARY KEY,
          follower_id varchar REFERENCES users(id),
          following_id varchar REFERENCES users(id));
        CREATE TABLE orders(id varchar PRIMARY KEY, buyer_id varchar REFERENCES users(id), amount_cents integer);
        INSERT INTO users VALUES ('closing'), ('friend');
        INSERT INTO posts VALUES ('post','closing','private text');
        INSERT INTO follows VALUES ('a','closing','friend'), ('b','friend','closing'), ('c','friend','friend');
        INSERT INTO orders VALUES ('order','closing',1200);
      `);
      const preview = await db.transaction((tx: any) => inspectClosurePrivateContent(tx, "closing"));
      assert.deepEqual(preview.tables, [
        { table: "follows", candidateRows: 2 },
        { table: "posts", candidateRows: 1 },
      ]);
      assert.equal(preview.totalCandidates, 3);
      assert.equal((await local.query("SELECT count(*)::int n FROM orders")).rows[0].n, 1);
      assert.equal((await local.query("SELECT caption FROM posts WHERE id='post'")).rows[0].caption, "private text");
      assert.equal((await local.query("SELECT count(*)::int n FROM follows")).rows[0].n, 3);
      // Unknown private tables do not enter the erase list, and the separate
      // FK whitelist must still reject them before any closure can be enabled.
      await local.query("CREATE TABLE unexpected_data(id varchar PRIMARY KEY, user_id varchar REFERENCES users(id))");
      const unchanged = await db.transaction((tx: any) => inspectClosurePrivateContent(tx, "closing"));
      assert.deepEqual(unchanged, preview);
    } finally {
      await local.query("DROP TABLE IF EXISTS unexpected_data, posts, follows, orders, users CASCADE");
      await local.end();
    }
  });
}
