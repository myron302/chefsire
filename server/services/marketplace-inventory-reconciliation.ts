import { sql } from "drizzle-orm";
import { db } from "../db";

/**
 * Releases abandoned, never-submitted checkout reservations in bounded batches.
 * capture_pending is intentionally excluded: once Square may have received a
 * request, inventory stays reserved until authoritative reconciliation.
 */
export async function releaseExpiredMarketplaceInventoryReservations(limit = 100) {
  const boundedLimit = Math.max(1, Math.min(Math.trunc(limit), 500));
  const result = await db.execute(sql`
    WITH expired AS (
      SELECT id, product_id, quantity
      FROM orders
      WHERE inventory_status = 'reserved'
        AND payment_status = 'unverified'
        AND inventory_reservation_expires_at <= now()
      ORDER BY inventory_reservation_expires_at
      FOR UPDATE SKIP LOCKED
      LIMIT ${boundedLimit}
    ), released AS (
      UPDATE orders AS o
      SET inventory_status = 'released', status = 'cancelled', updated_at = now()
      FROM expired AS e
      WHERE o.id = e.id
        AND o.inventory_status = 'reserved'
        AND o.payment_status = 'unverified'
      RETURNING e.product_id, e.quantity
    ), totals AS (
      SELECT product_id, sum(quantity)::integer AS quantity
      FROM released
      GROUP BY product_id
    )
    UPDATE products AS p
    SET inventory = p.inventory + totals.quantity
    FROM totals
    WHERE p.id = totals.product_id AND p.inventory IS NOT NULL
    RETURNING p.id
  `);
  return { productGroupsRestocked: result.rowCount ?? 0 };
}
