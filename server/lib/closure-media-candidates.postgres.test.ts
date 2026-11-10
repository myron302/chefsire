import "../test-support/auth-test-env";
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { PG_URL, connectLocalPg } from "../test-support/authz-pg-harness";
import {
  validateClosureMediaKey, enqueueClosureMediaCandidate, closureMediaDeletionEnabled,
} from "./closure-media-candidates";

test("media candidates reject URL, traversal, encoded key and control-character attacks", () => {
  for (const key of [
    "", "/etc/passwd", "../secret", "posts/../outside", "a/./b",
    "https://storage.example/item", "//host/file", "C:\\temp\\file",
    "user/%2e%2e/file", "user/%2F/file", "a//b", "a\u0000b",
  ]) assert.throws(() => validateClosureMediaKey("local", key), undefined, key);
  assert.doesNotThrow(() => validateClosureMediaKey("local", "safe-file-name.jpg"));
  assert.doesNotThrow(() => validateClosureMediaKey("r2", "media/2026/asset.png"));
  assert.equal(closureMediaDeletionEnabled(), false, "no live object deletion worker can be enabled in this stage");
});

if (!PG_URL) {
  test("media queue idempotency needs CS_TEST_PG_URL", { skip: true }, () => {});
} else {
  test("candidate queue persists safely and retries do not duplicate rows or delete bytes", async () => {
    const local = await connectLocalPg();
    const migration = readFileSync(
      new URL("../../docs/ops/2026-11-10-closure-media-candidates.sql", import.meta.url), "utf8",
    );
    try {
      await local.query(`
        DROP TABLE IF EXISTS closure_media_candidates, users CASCADE;
        CREATE TABLE users(id varchar PRIMARY KEY);
        INSERT INTO users VALUES('closed-id');
        ${migration}
      `);
      const { db } = await import("../db");
      const candidate = {
        closedUserId: "closed-id", provider: "local" as const,
        storageKey: "closed/assets/avatar.jpg", kind: "profile_avatar" as const,
      };
      await db.transaction(async (tx: any) => {
        await enqueueClosureMediaCandidate(tx, candidate);
        await enqueueClosureMediaCandidate(tx, candidate);
      });
      const rows = await local.query("SELECT storage_key,state,attempts FROM closure_media_candidates");
      assert.deepEqual(rows.rows, [{ storage_key: candidate.storageKey, state: "candidate", attempts: 0 }]);
      await assert.rejects(db.transaction((tx: any) =>
        enqueueClosureMediaCandidate(tx, { ...candidate, storageKey: "../outside.jpg" })), /Unsafe media path/);
      assert.equal((await local.query("SELECT count(*)::int AS n FROM closure_media_candidates")).rows[0].n, 1);
    } finally {
      await local.query("DROP TABLE IF EXISTS closure_media_candidates, users CASCADE");
      await local.end();
    }
  });
}
