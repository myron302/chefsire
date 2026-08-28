import { sql } from "drizzle-orm";
import { db } from "../db";

export function cateringReviewRelationshipLockIds(customerId: string, providerId: string): readonly [string, string] {
  return [customerId, providerId];
}

/**
 * Both review creation and booking completion take this transaction-scoped lock.
 * PostgreSQL hashes each parameter independently into the two-int advisory namespace;
 * a rare hash collision can only add contention and cannot weaken serialization.
 */
export async function lockCateringReviewRelationship(tx: typeof db, customerId: string, providerId: string): Promise<void> {
  const [customerKey, providerKey] = cateringReviewRelationshipLockIds(customerId, providerId);
  await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${customerKey}), hashtext(${providerKey}))`);
}
