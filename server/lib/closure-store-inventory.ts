import { sql } from "drizzle-orm";

/** Read-only Part 3b storefront retention inventory. No product, store, or media writes. */
export type ClosureStoreInventory = {
  purchasedProductRowsToRetain: number;
  unpurchasedProductRowsToReview: number;
  purchasedDigitalFilesToPreserve: number;
  candidateProductImageReferences: number;
  storeRowsToUnpublish: number;
};
const rowsOf = (result: any): any[] => result?.rows ?? (Array.isArray(result) ? result : []);

export async function inspectClosureStoreInventory(tx: any, userId: string): Promise<ClosureStoreInventory> {
  // Respect the ACTUAL orders.product_id FK. sales_count is just an aggregate
  // counter and must never be used to prove a transaction exists.
  const [products] = rowsOf(await tx.execute(sql`
    SELECT
      count(*) FILTER (WHERE EXISTS (
        SELECT 1 FROM orders o WHERE o.product_id = p.id
      ))::int AS "purchasedProductRowsToRetain",
      count(*) FILTER (WHERE NOT EXISTS (
        SELECT 1 FROM orders o WHERE o.product_id = p.id
      ))::int AS "unpurchasedProductRowsToReview",
      count(*) FILTER (
        WHERE p.is_digital IS TRUE AND p.digital_file_url IS NOT NULL
          AND EXISTS (SELECT 1 FROM orders o WHERE o.product_id = p.id)
      )::int AS "purchasedDigitalFilesToPreserve",
      coalesce(sum(CASE WHEN jsonb_typeof(p.images) = 'array'
        THEN jsonb_array_length(p.images) ELSE 0 END), 0)::int AS "candidateProductImageReferences"
    FROM products p
    WHERE p.seller_id = ${userId}
  `));
  const [stores] = rowsOf(await tx.execute(sql`
    SELECT count(*)::int AS n FROM stores WHERE user_id = ${userId}
  `));
  const values = [
    Number(products?.purchasedProductRowsToRetain),
    Number(products?.unpurchasedProductRowsToReview),
    Number(products?.purchasedDigitalFilesToPreserve),
    Number(products?.candidateProductImageReferences),
    Number(stores?.n),
  ];
  if (values.some((v) => !Number.isSafeInteger(v) || v < 0)) {
    throw new Error("Store retention inventory unavailable; refuse irreversible closure");
  }
  return {
    purchasedProductRowsToRetain: values[0],
    unpurchasedProductRowsToReview: values[1],
    purchasedDigitalFilesToPreserve: values[2],
    candidateProductImageReferences: values[3],
    storeRowsToUnpublish: values[4],
  };
}
