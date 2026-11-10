import test from "node:test";
import assert from "node:assert/strict";
import { PG_URL, connectLocalPg } from "../test-support/authz-pg-harness";
import { validateClosureAudit, writeMemberClosureAuditWithinTransaction } from "./closure-audit";

const counts = { personalContentRows: 42, messagesRedacted: 3, productsUnpublished: 1, mediaCandidatesQueued: 5 };

test("closure audit refuses spoofed member, missing staff reason and invalid counts", () => {
  assert.throws(() => validateClosureAudit({
    memberId: "target", actor: {kind:"member", memberId:"different"},counts,
  }),/only close own/);
  assert.throws(() => validateClosureAudit({
    memberId: "target", actor: {kind:"staff",staffId:"staff",reason:""},counts,
  }),/reason/);
  assert.throws(() => validateClosureAudit({
    memberId: "target", actor: {kind:"member",memberId:"target"},
    counts:{...counts,messagesRedacted:-1},
  }),/count/);
});
if (!PG_URL) {
  test("Closure audit PostgreSQL tests require CS_TEST_PG_URL", {skip:true},()=>{});
} else {
  test("closure audit stores only safe counts, and rolls back with failed closure",async()=>{
    const local = await connectLocalPg();
    const { db } = await import("../db");
    try {
      await local.query(`
        DROP TABLE IF EXISTS admin_audit_log, staff_users CASCADE;
        CREATE TABLE staff_users(id varchar PRIMARY KEY,login varchar,display_name varchar);
        CREATE TABLE admin_audit_log(
          id bigserial PRIMARY KEY,actor_type text,actor_id varchar,actor_label text,
          action text,target_type text,target_id varchar,reason text,details jsonb
        );
        INSERT INTO staff_users VALUES('staff-1','operator','Support');
      `);
      await db.transaction(async(tx:any)=>{
        await writeMemberClosureAuditWithinTransaction(tx, {
          memberId:"member-1",actor:{kind:"member",memberId:"member-1"},counts,
        });
        await writeMemberClosureAuditWithinTransaction(tx, {
          memberId:"member-2",actor:{kind:"staff",staffId:"staff-1",reason:"Privacy request"},counts,
        });
      });
      const rows=(await local.query("SELECT * FROM admin_audit_log ORDER BY id")).rows;
      assert.equal(rows.length,2);
      assert.deepEqual(rows.map((r:any)=>r.action),["member.closed","member.closed"]);
      assert.equal(rows[0].actor_label,"Deleted user");
      assert.equal(rows[1].actor_label,"Support (operator)");
      assert.equal(rows[1].reason,"Privacy request");
      assert.deepEqual(rows[0].details,{...counts,actorKind:"member"});
      assert.ok(!JSON.stringify(rows).includes("old@example.test"));
      await assert.rejects(db.transaction(async(tx:any)=>{
        await writeMemberClosureAuditWithinTransaction(tx,{
          memberId:"member-3",actor:{kind:"member",memberId:"member-3"},counts,
        });
        throw new Error("other closure operation failed");
      }),/other closure operation failed/);
      assert.equal((await local.query("SELECT count(*)::int n FROM admin_audit_log")).rows[0].n,2);
    } finally {
      await local.query("DROP TABLE IF EXISTS admin_audit_log, staff_users CASCADE");
      await local.end();
    }
  });
}
