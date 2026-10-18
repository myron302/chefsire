// The authentication lookup: the account row for a verified token's id, read through a bounded, read-only connection.
import { drizzle } from "drizzle-orm/neon-serverless";
import { eq } from "drizzle-orm";
import * as schema from "../../shared/schema";
import { runBoundedRead } from "./bounded-read";

export async function readSessionUserBounded(id: string, timeoutMs: number) {
  const { pool } = await import("../db");
  if (!pool) {
    throw Object.assign(new Error("Database not configured (set DATABASE_URL)."), { status: 503 });
  }
  return runBoundedRead(
    pool,
    async (client) => {
      const rows = await drizzle(client as never, { schema }).select().from(schema.users).where(eq(schema.users.id, id)).limit(1);
      return rows[0];
    },
    { timeoutMs, label: "session lookup" },
  );
}
