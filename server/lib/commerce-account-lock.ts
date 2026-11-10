import { sql } from "drizzle-orm";

/**
 * Locks both marketplace participants before creating new financial obligations.
 * Every future permanent-closure transaction must acquire the same users-row lock
 * and verify obligations under that lock. Sorting avoids deadlocks for opposite-side buyers.
 * Run exclusively inside the caller's PostgreSQL transaction, never before it.
 */
export class CommerceAccountUnavailableError extends Error {
  readonly code = "COMMERCE_ACCOUNT_UNAVAILABLE";
  constructor() {
    super("The buyer or seller account is no longer available for a new purchase.");
  }
}

const rowsOf = (result: any): any[] => result?.rows ?? (Array.isArray(result) ? result : []);

export async function lockActiveCommerceAccounts(tx: any, buyerId: string, sellerId: string): Promise<void> {
  // The read and lock happen in one query; a concurrent member close/suspension
  // either commits first and is observed, or waits until this transaction commits.
  const locked = rowsOf(await tx.execute(sql`
    SELECT u.id, COALESCE(st.status, 'active') AS status
    FROM users u LEFT JOIN account_status st ON st.user_id = u.id
    WHERE u.id IN (${buyerId}, ${sellerId})
    ORDER BY u.id
    FOR UPDATE OF u
  `));
  const statuses = new Map(locked.map((r) => [r.id, r.status]));
  if (statuses.get(buyerId) !== "active" || statuses.get(sellerId) !== "active") {
    throw new CommerceAccountUnavailableError();
  }
}
