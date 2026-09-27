// server/cron.ts
// Cron job scheduler for periodic tasks

import cron from "node-cron";
import {
  checkExpiringPantryItems,
  checkLowStockItems,
} from "./services/pantry-cron.service";
import { reconcileCateringStorageCleanup } from "./services/catering-booking-storage-cleanup";
import { reconcileAbandonedCheckoutReservations } from "./services/marketplace-checkout-reconciliation";

/**
 * Initialize all cron jobs
 */
export function initializeCronJobs() {
  console.log("⏰ Initializing cron jobs...");

  // Run pantry expiring check daily at 9 AM
  cron.schedule("0 9 * * *", async () => {
    await checkExpiringPantryItems();
  });

  // Run low stock check daily at 10 AM
  cron.schedule("0 10 * * *", async () => {
    await checkLowStockItems();
  });

  // Run pantry checks again in evening at 6 PM (for items added during the day)
  cron.schedule("0 18 * * *", async () => {
    await checkExpiringPantryItems();
  });

  // Retry storage deletions for catering booking objects that were tombstoned (or orphaned) but whose object
  // removal failed. The work is bounded per run and every key comes from a persisted row, so this drains a backlog
  // steadily without ever acting on caller-supplied input. Hourly is frequent enough for a queue that only grows on
  // a storage outage, and light enough to be harmless when the queue is empty.
  cron.schedule("30 * * * *", async () => {
    try {
      const outcome = await reconcileCateringStorageCleanup();
      if (outcome.scanned > 0) console.log(`🧹 Catering storage cleanup: scanned ${outcome.scanned}, removed ${outcome.removed}, failed ${outcome.failed}`);
    } catch (error) {
      console.error("Catering storage cleanup failed", error);
    }
  });

  // Recover abandoned marketplace checkout reservations by replaying each
  // order's immutable Square request under its original idempotency key, and
  // release stock only on a definitive provider failure -- never on a bare
  // timeout or a search no-match. Bounded, rotating batches so rows that stay
  // ambiguous cannot starve the rest of the backlog.
  cron.schedule("*/5 * * * *", async () => {
    try {
      const outcome = await reconcileAbandonedCheckoutReservations();
      if (outcome.scanned > 0) {
        console.log(
          `🧾 Marketplace checkout reconciliation: scanned ${outcome.scanned}, finalized ${outcome.finalized}, ` +
          `declined ${outcome.declined}, ambiguous ${outcome.ambiguous}, ` +
          `skipped ${outcome.skipped}, errors ${outcome.errors}`
        );
      }
    } catch (error) {
      console.error("Marketplace checkout reconciliation failed", error);
    }
  });

  console.log("✅ Cron jobs initialized:");
  console.log("   - Pantry expiring items: Daily at 9 AM & 6 PM");
  console.log("   - Low stock items: Daily at 10 AM");
  console.log("   - Catering storage cleanup: Hourly at :30");
  console.log("   - Marketplace checkout reconciliation: Every 5 minutes");
}

/**
 * Run all checks immediately (for testing/manual trigger)
 */
export async function runAllChecksNow() {
  await checkExpiringPantryItems();
  await checkLowStockItems();
  await reconcileCateringStorageCleanup();
}
