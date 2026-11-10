import test from "node:test";
import assert from "node:assert/strict";
import { PG_URL, connectLocalPg } from "../test-support/authz-pg-harness";
import { CLOSED_MEMBER_DM_PLACEHOLDER, redactOrdinaryMemberMessagesWithinTransaction } from "./closure-dm-redaction";

if (!PG_URL) {
  test("Part 3b sender-only redaction needs CS_TEST_PG_URL", { skip: true }, () => {});
} else {
  test("redact only sender's ordinary DMs; preserve booking evidence and remaining member's messages", async () => {
    const local = await connectLocalPg();
    const { db } = await import("../db");
    try {
      await local.query(`
        DROP TABLE IF EXISTS catering_booking_conversations, dm_messages CASCADE;
        CREATE TABLE dm_messages (
          id varchar PRIMARY KEY, thread_id varchar NOT NULL, sender_id varchar NOT NULL,
          body text NOT NULL, attachments jsonb NOT NULL DEFAULT '[]'::jsonb,
          created_at timestamp NOT NULL DEFAULT now()
        );
        CREATE TABLE catering_booking_conversations (thread_id varchar PRIMARY KEY);
        INSERT INTO dm_messages(id, thread_id, sender_id, body, attachments) VALUES
          ('ordinary-authored','ordinary','closing','personal text','[{"url":"/uploads/asset"}]'),
          ('ordinary-other','ordinary','recipient','recipient owns this','[]'),
          ('booking-authored','catering','closing','offer terms','[{"url":"/private/evidence"}]');
        INSERT INTO catering_booking_conversations VALUES('catering');
      `);
      const result = await db.transaction((tx: any) => redactOrdinaryMemberMessagesWithinTransaction(tx, "closing"));
      assert.equal(result, 1);
      assert.equal(await db.transaction((tx: any) => redactOrdinaryMemberMessagesWithinTransaction(tx, "closing")), 0);
      const rows = (await local.query("SELECT id,body,attachments FROM dm_messages ORDER BY id")).rows;
      assert.deepEqual(rows, [
        { id: "booking-authored", body: "offer terms", attachments: [{ url: "/private/evidence" }] },
        { id: "ordinary-authored", body: CLOSED_MEMBER_DM_PLACEHOLDER, attachments: [] },
        { id: "ordinary-other", body: "recipient owns this", attachments: [] },
      ]);
      await local.query("DROP TABLE catering_booking_conversations");
      await assert.rejects(db.transaction((tx: any) =>
        redactOrdinaryMemberMessagesWithinTransaction(tx, "closing")), /catering_booking_conversations/);
      assert.equal((await local.query("SELECT body FROM dm_messages WHERE id='booking-authored'")).rows[0].body, "offer terms");
    } finally {
      await local.query("DROP TABLE IF EXISTS catering_booking_conversations, dm_messages CASCADE");
      await local.end();
    }
  });
}
