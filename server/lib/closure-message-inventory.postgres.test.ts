/** Part 3b DM retention classification; never deletes or redacts content. */
import test from "node:test";
import assert from "node:assert/strict";
import { PG_URL, connectLocalPg } from "../test-support/authz-pg-harness";
import { inspectClosureDmInventory } from "./closure-message-inventory";

if (!PG_URL) {
  test("DM closure classification requires CS_TEST_PG_URL", { skip: true }, () => {});
} else {
  test("ordinary DMs are counted for future redaction; booking evidence and other member threads are preserved", async () => {
    const local = await connectLocalPg();
    const { db } = await import("../db");
    const tableNames = "catering_booking_conversations, dm_messages, dm_participants, dm_threads";
    try {
      await local.query(`
        DROP TABLE IF EXISTS ${tableNames} CASCADE;
        CREATE TABLE dm_threads (id varchar PRIMARY KEY);
        CREATE TABLE dm_participants (id varchar PRIMARY KEY, thread_id varchar, user_id varchar);
        CREATE TABLE dm_messages (id varchar PRIMARY KEY, thread_id varchar, sender_id varchar, body text, attachments jsonb NOT NULL DEFAULT '[]'::jsonb);
        CREATE TABLE catering_booking_conversations (id varchar PRIMARY KEY, thread_id varchar UNIQUE);
        INSERT INTO dm_threads VALUES ('ordinary'), ('booking');
        INSERT INTO dm_participants VALUES
          ('p1', 'ordinary', 'closing'), ('p2', 'ordinary', 'friend'),
          ('p3', 'booking', 'closing'), ('p4', 'booking', 'vendor');
        INSERT INTO dm_messages VALUES
          ('m1', 'ordinary', 'closing', 'erase later', '[{"url":"/uploads/x"},{"url":"/uploads/y"}]'),
          ('m2', 'ordinary', 'friend', 'keep counterparty message', '[]'),
          ('m3', 'booking', 'closing', 'required contract evidence', '[]');
        INSERT INTO catering_booking_conversations VALUES ('c1', 'booking');
      `);
      const found = await db.transaction((tx: any) => inspectClosureDmInventory(tx, "closing"));
      assert.deepEqual(found, {
        ordinaryMessagesToRedact: 1,
        ordinaryAttachmentReferences: 2,
        bookingEvidenceMessages: 1,
        otherParticipantThreadsToPreserve: 2,
      });
      const rows = await local.query("SELECT id, body, attachments FROM dm_messages ORDER BY id");
      assert.deepEqual(rows.rows.map((r: any) => [r.id, r.body]), [
        ["m1", "erase later"], ["m2", "keep counterparty message"], ["m3", "required contract evidence"],
      ], "dry-run classification must never mutate messages");
      await local.query("DROP TABLE catering_booking_conversations");
      await assert.rejects(db.transaction((tx: any) => inspectClosureDmInventory(tx, "closing")),
        /catering_booking_conversations/, "missing booking linkage cannot be treated as ordinary DMs");
    } finally {
      await local.query(`DROP TABLE IF EXISTS ${tableNames} CASCADE`);
      await local.end();
    }
  });
}
