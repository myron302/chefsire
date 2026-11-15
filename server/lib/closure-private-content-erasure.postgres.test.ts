import test from "node:test";
import assert from "node:assert/strict";
import { PG_URL, connectLocalPg } from "../test-support/authz-pg-harness";
import { eraseDirectMemberPrivateContentWithinClosure, ClosureContentDependencyError } from "./closure-private-content-erasure";

if (!PG_URL) {
  test("Private erasure requires CS_TEST_PG_URL", {skip:true},()=>{});
} else {
  test("FK-directed erasure deletes only owned private rows, orders child first and refuses ledger cascades",async()=>{
    const local = await connectLocalPg();
    const { db } = await import("../db");
    try {
      await local.query(`
        DROP TABLE IF EXISTS orders, likes, posts, users CASCADE;
        CREATE TABLE users(id varchar PRIMARY KEY);
        CREATE TABLE posts(id varchar PRIMARY KEY, user_id varchar NOT NULL REFERENCES users(id));
        CREATE TABLE likes(id varchar PRIMARY KEY, user_id varchar NOT NULL REFERENCES users(id),
          post_id varchar NOT NULL REFERENCES posts(id) ON DELETE RESTRICT);
        INSERT INTO users VALUES('closing'),('other');
        INSERT INTO posts VALUES('my-post','closing'),('their-post','other');
        INSERT INTO likes VALUES('my-like','closing','my-post'),('their-like','other','their-post');
      `);
      const cleared = await db.transaction((tx:any)=>eraseDirectMemberPrivateContentWithinClosure(tx,"closing"));
      assert.equal(cleared.totalDeleted,2);
      assert.deepEqual(cleared.counts.filter(x=>x.deleted>0).map(x=>x.table),["likes","posts"],
        "children are deleted before their parents when FK is RESTRICT");
      assert.deepEqual((await local.query("SELECT id FROM posts")).rows,[{id:"their-post"}]);
      assert.deepEqual((await local.query("SELECT id FROM likes")).rows,[{id:"their-like"}]);
      assert.equal((await local.query("SELECT count(*)::int n FROM users")).rows[0].n,2,
        "no user PK was removed");

      await local.query("INSERT INTO posts VALUES('my-second','closing')");
      await local.query("CREATE TABLE orders(id varchar PRIMARY KEY,post_id varchar REFERENCES posts(id) ON DELETE CASCADE)");
      await local.query("INSERT INTO orders VALUES('sale','my-second')");
      await assert.rejects(db.transaction((tx:any)=>eraseDirectMemberPrivateContentWithinClosure(tx,"closing")),
        (e:any)=> e instanceof ClosureContentDependencyError && e.code==="CLOSURE_CONTENT_DEPENDENCY_REVIEW_REQUIRED");
      assert.equal((await local.query("SELECT count(*)::int n FROM orders")).rows[0].n,1);
      assert.equal((await local.query("SELECT count(*)::int n FROM posts WHERE id='my-second'")).rows[0].n,1);
      await local.query("DROP TABLE orders");
      await assert.rejects(db.transaction(async(tx:any)=>{
        const result = await eraseDirectMemberPrivateContentWithinClosure(tx,"closing");
        assert.equal(result.totalDeleted,1);
        throw new Error("later closure operation failed");
      }),/later closure operation failed/);
      assert.equal((await local.query("SELECT count(*)::int n FROM posts WHERE id='my-second'")).rows[0].n,1,
        "later failure rolls back the private deletion");
    } finally {
      await local.query("DROP TABLE IF EXISTS orders, likes, posts, users CASCADE");
      await local.end();
    }
  });
}
