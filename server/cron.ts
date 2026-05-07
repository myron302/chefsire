// server/cron.ts
// Cron job scheduler for periodic tasks

import cron from "node-cron";
import {
  checkExpiringPantryItems,
  checkLowStockItems,
} from "./services/pantry-cron.service";

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

  console.log("✅ Cron jobs initialized:");
  console.log("   - Pantry expiring items: Daily at 9 AM & 6 PM");
  console.log("   - Low stock items: Daily at 10 AM");
}

/**
 * Run all checks immediately (for testing/manual trigger)
 */
export async function runAllChecksNow() {
  await checkExpiringPantryItems();
  await checkLowStockItems();
}
