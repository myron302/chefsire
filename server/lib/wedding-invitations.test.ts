import "../test-support/auth-test-env";
import test from "node:test";
import assert from "node:assert/strict";
import { PgDialect } from "drizzle-orm/pg-core";
process.env.DATABASE_URL ||= "postgresql://unused:unused@localhost/unused_test";
const { db } = await import("../db");
const { createWeddingInvitation } = await import("./wedding-invitations");

test("new invitation writes enforce current Wedding tier and cap without trimming existing guests", async (t) => {
  let tier = "premium";
  let active = true;
  const guests = Array.from({ length: 149 }, (_, id) => ({ id, userId: "owner" }));
  let locked = false;
  const tx = {
    execute: async (statement: any) => {
      const query = new PgDialect().sqlToQuery(statement);
      assert.equal(query.params[0], "owner");
      if (query.sql.includes("FOR UPDATE")) { locked = true; return { rows: [{ id: "owner" }] }; }
      assert.equal(locked, true, "lock precedes entitlement, count and insert");
      if (query.sql.includes("wedding_intro_trials")) return { rows: [{ tier, active, revokedAt: null, activatedAt: new Date(), expiresAt: new Date(Date.now() + 1000), remainingDays: 1 }] };
      return { rows: [{ count: guests.length }] };
    },
    insert: () => ({ values: (row: any) => ({ returning: async () => { guests.push({ ...row, id: guests.length }); return [guests.at(-1)]; } }) }),
  };
  t.mock.method(db, "transaction", async (fn: any) => { locked = false; return fn(tx); });
  const input = { userId: "forged", guestName: "Guest", guestEmail: "guest@example.test", tokenHash: "hash" };
  const created = await createWeddingInvitation("owner", input);
  assert.equal(created.userId, "owner");
  assert.equal(guests.length, 150);
  await assert.rejects(createWeddingInvitation("owner", input), /150 guests/);
  assert.equal(guests.length, 150);
  tier = "elite";
  await createWeddingInvitation("owner", input);
  assert.equal(guests.length, 151);
  active = false;
  await assert.rejects(createWeddingInvitation("owner", input), /Wedding access required/);
  assert.equal(guests.length, 151);
});
