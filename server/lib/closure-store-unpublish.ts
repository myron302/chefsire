import { sql } from "drizzle-orm";
import { assertInternalClosureMutationAllowed } from "./closure-feature";

/**
 * Part 3b internal: unpublish seller assets while keeping immutable product
 * identities used by order history and preserving all digital deliverables.
 * This cannot by itself satisfy eventual erasure of unsold listings; cleanup
 * and media-reference analysis are separate prerequisites.
 *
 * Test-only until the guarded account closure coordinator is reviewed.
 */
const rowsOf = (r: any): any[] => r?.rows ?? (Array.isArray(r) ? r : []);
export type ClosureStoreUnpublishCounts = {
  productsUnpublished: number;
  storesUnpublished: number;
  marketingDropsDeleted: number;
};

export async function unpublishClosingSellerWithinTransaction(tx: any, userId: string):
  Promise<ClosureStoreUnpublishCounts> {
  assertInternalClosureMutationAllowed();
  // No DELETE from products or stores. Products may be referenced by orders,
  // buyers' purchased digital access, wishlists and marketplace history.
  const products = rowsOf(await tx.execute(sql`
    UPDATE products SET is_active = false
    WHERE seller_id = ${userId} AND is_active IS DISTINCT FROM false
    RETURNING id
  `));
  const stores = rowsOf(await tx.execute(sql`
    UPDATE stores SET published = false, bio = NULL
    WHERE user_id = ${userId}
      AND (published IS DISTINCT FROM false OR bio IS NOT NULL)
    RETURNING id
  `));
  // Store drops are marketing-only; a drop's counters do not establish
  // payment evidence. Delete them without touching order or product rows.
  const drops = rowsOf(await tx.execute(sql`
    DELETE FROM store_drops WHERE owner_id = ${userId} RETURNING id
  `));
  return {
    productsUnpublished: products.length,
    storesUnpublished: stores.length,
    marketingDropsDeleted: drops.length,
  };
}
