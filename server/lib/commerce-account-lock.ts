import { sql } from "drizzle-orm";

/**
 * Serializes creation of a new financial obligation with account closure.
 * Future closure takes the same users FOR UPDATE row lock before checking
 * obligations. Sort users to prevent opposite-side purchase deadlocks.
 */
export class CommerceAccountUnavailableError extends Error {
  readonly code = "COMMERCE_ACCOUNT_UNAVAILABLE";
  constructor() {
    super("The buyer or seller account is no longer available for a new purchase.");
  }
}

const rowsOf = (result: any): any[] => result?.rows ?? (Array.isArray(result) ? result : []);

export async function lockActiveCommerceAccounts(tx: any, buyerId: string, sellerId: string): Promise<void> {
  // FIRST take both users-row locks. Critically, do not join account_status here:
  // under READ COMMITTED a join evaluated before waiting for a lock can see an
  // older status snapshot. The status SELECT below must start AFTER lock acquisition.
  const people = rowsOf(await tx.execute(sql`
    SELECT id FROM users WHERE id IN (${buyerId}, ${sellerId}) ORDER BY id FOR UPDATE
  `));
  const expected = new Set([buyerId, sellerId]);
  if (people.length !== expected.size || people.some((p) => !expected.has(p.id))) {
    throw new CommerceAccountUnavailableError();
  }

  // Fresh statement snapshot, under the users-row lock: if closure committed
  // first, its terminal status is visible; otherwise closure waits for commit.
  const statuses = rowsOf(await tx.execute(sql`
    SELECT user_id AS id, status FROM account_status WHERE user_id IN (${buyerId}, ${sellerId})
  `));
  if (statuses.some((row) => row.status !== "active")) {
    // The table stores only non-active rows today. Explicit active is harmless.
    throw new CommerceAccountUnavailableError();
  }
}
