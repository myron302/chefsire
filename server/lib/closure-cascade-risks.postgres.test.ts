import test from "node:test";
import assert from "node:assert/strict";
import { PG_URL, connectLocalPg } from "../test-support/authz-pg-harness";
import { inspectPrivateErasureCascadeRisks } from "./closure-cascade-risks";

if (!PG_URL) {
  test("Closure FK cascade audit needs CS_TEST_PG_URL", {skip:true},()=>{});
} else {
  test("private deletes cannot silently cascade into ledger, shared content or unknown dependencies",async()=>{
    const local = await connectLocalPg();
    const { db } = await import("../db");
    try {
      await local.query(`
        DROP TABLE IF EXISTS unknown_post_copy, dm_messages, orders, likes, posts CASCADE;
        CREATE TABLE posts(id varchar PRIMARY KEY);
        CREATE TABLE likes(id varchar PRIMARY KEY, post_id varchar REFERENCES posts(id) ON DELETE CASCADE);
        CREATE TABLE orders(id varchar PRIMARY KEY, post_id varchar REFERENCES posts(id) ON DELETE CASCADE);
        CREATE TABLE dm_messages(id varchar PRIMARY KEY, post_id varchar REFERENCES posts(id) ON DELETE SET NULL);
        CREATE TABLE unknown_post_copy(id varchar PRIMARY KEY, like_id varchar REFERENCES likes(id) ON DELETE RESTRICT);
      `);
      const risks = await db.transaction((tx:any) => inspectPrivateErasureCascadeRisks(tx));
      const byChild = new Map(risks.map(r=>[r.childTable,r]));
      assert.equal(byChild.get("orders")?.childClass,"retain_ledger");
      assert.equal(byChild.get("orders")?.deleteAction,"CASCADE");
      assert.equal(byChild.get("dm_messages")?.childClass,"retain_shared");
      assert.equal(byChild.get("dm_messages")?.deleteAction,"SET NULL");
      assert.equal(byChild.get("unknown_post_copy")?.childClass,"unclassified");
      assert.equal(byChild.get("unknown_post_copy")?.deleteAction,"RESTRICT");
      assert.equal(byChild.has("likes"),false,"an erase-private descendant is classified but not a cross-domain blocker");
      assert.equal((await local.query("SELECT count(*)::int n FROM posts")).rows[0].n,0,
        "audit never inserts, deletes, or changes content");
      await local.query("DROP TABLE unknown_post_copy");
      const after = await db.transaction((tx:any)=>inspectPrivateErasureCascadeRisks(tx));
      assert.ok(!after.some(r=>r.childTable==="unknown_post_copy"));
    } finally {
      await local.query("DROP TABLE IF EXISTS unknown_post_copy, dm_messages, orders, likes, posts CASCADE");
      await local.end();
    }
  });
}
