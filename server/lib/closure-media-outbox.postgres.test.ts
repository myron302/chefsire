import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { PG_URL, connectLocalPg } from "../test-support/authz-pg-harness";
import { enqueueClosureMediaCandidate, validateClosureMediaCandidate } from "./closure-media-outbox";

const OUTBOX_SQL = readFileSync(new URL("../../docs/ops/2026-11-10-account-closure-media-outbox.sql", import.meta.url), "utf8");

test("media candidates never accept absolute, traversing or URL-like keys", () => {
  const base = { memberId: "test-user", provider: "local" as const, sourceKind: "dm" as const };
  for (const objectKey of ["../secret", "/etc/passwd", "https://example.com/x", "a/../../secret",
    "a\\..\\secret", "a//b", ".", "..", "dir/.", "dir/..", "a?token=secret", ""]) {
    assert.throws(() => validateClosureMediaCandidate({ ...base, objectKey }), /Unsafe/);
  }
  assert.doesNotThrow(() => validateClosureMediaCandidate({ ...base, objectKey: "avatars/generated/avatar.webp" }));
});

if (!PG_URL) {
  test("media cleanup outbox needs CS_TEST_PG_URL", { skip: true }, () => {});
} else {
  test("outbox candidates are committed atomically, deduplicated, and never invoke file deletion", async () => {
    const local = await connectLocalPg();
    const { db } = await import("../db");
    try {
      await local.query(`
        DROP TABLE IF EXISTS account_closure_media_cleanup, users CASCADE;
        CREATE TABLE users(id varchar PRIMARY KEY);
        ${OUTBOX_SQL}
        INSERT INTO users(id) VALUES ('closing');
      `);
      const candidate = { memberId: "closing", provider: "local" as const, objectKey: "avatars/photo.webp", sourceKind: "avatar" as const };
      const added = await db.transaction(async (tx: any) => {
        assert.equal(await enqueueClosureMediaCandidate(tx, candidate), true);
        assert.equal(await enqueueClosureMediaCandidate(tx, candidate), false);
        return true;
      });
      assert.equal(added,true);
      assert.equal((await local.query("SELECT count(*)::int n FROM account_closure_media_cleanup")).rows[0].n,1);
      await local.query("UPDATE account_closure_media_cleanup SET status='complete',completed_at=now() WHERE object_key='avatars/photo.webp'");
      assert.equal(await db.transaction((tx: any) => enqueueClosureMediaCandidate(tx,candidate)),false);
      assert.equal((await local.query("SELECT status FROM account_closure_media_cleanup")).rows[0].status,"complete",
        "repeated closure never reenqueues a completed object");

      await assert.rejects(db.transaction(async (tx: any) => {
        await enqueueClosureMediaCandidate(tx, { ...candidate, objectKey: "media/new.webp" });
        throw new Error("closure rollback");
      }),/closure rollback/);
      assert.equal((await local.query("SELECT count(*)::int n FROM account_closure_media_cleanup")).rows[0].n,1);
      const [row] = (await local.query("SELECT storage_provider, object_key, attempt_count, status FROM account_closure_media_cleanup")).rows;
      assert.deepEqual(row,{storage_provider:"local",object_key:"avatars/photo.webp",attempt_count:0,status:"complete"});
    } finally {
      await local.query("DROP TABLE IF EXISTS account_closure_media_cleanup, users CASCADE");
      await local.end();
    }
  });
}
