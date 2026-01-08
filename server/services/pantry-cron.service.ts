// server/services/pantry-cron.service.ts
// Cron job service for pantry-related notifications

import { db } from "../db";
import { sql } from "drizzle-orm";
import { sendPantryExpiringNotification, sendPantryLowStockNotification } from "./notification-service";

/**
 * Check for items expiring soon and send notifications
 * Should run daily (e.g., at 9 AM)
 */
export async function checkExpiringPantryItems() {
  try {
    console.log("🔔 Running pantry expiring items check...");

    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const threeDaysFromNow = new Date(today);
    threeDaysFromNow.setDate(threeDaysFromNow.getDate() + 3);

    // Get items expiring in next 3 days (0, 1, 2, or 3 days)
    const expiringItems = await db.execute(sql`
      SELECT
        pi.id,
        pi.name,
        pi.user_id,
        pi.household_id,
        pi.expiry_date,
        EXTRACT(DAY FROM (pi.expiry_date - CURRENT_DATE)) as days_until_expiry
      FROM pantry_items pi
      WHERE pi.expiry_date IS NOT NULL
        AND pi.expiry_date >= CURRENT_DATE
        AND pi.expiry_date <= ${threeDaysFromNow.toISOString().split('T')[0]}
      ORDER BY pi.expiry_date ASC
    `);

    const items = (expiringItems as any)?.rows || [];
    console.log(`📦 Found ${items.length} items expiring soon`);

    // Track which users we've already notified today (to avoid spam)
    const notifiedToday = new Set<string>();

    for (const item of items) {
      const daysUntil = Math.floor(Number(item.days_until_expiry));
      const userId = String(item.user_id);

      // Only notify on specific days (0, 1, 3 days before expiry)
      if (![0, 1, 3].includes(daysUntil)) continue;

      // Check if we already sent a notification for this item today
      const notificationKey = `${userId}-${item.id}-${daysUntil}`;
      if (notifiedToday.has(notificationKey)) continue;

      // Check if notification was already sent for this item at this urgency level
      const existingNotification = await db.execute(sql`
        SELECT id FROM notifications
        WHERE user_id = ${userId}
          AND type = 'pantry'
          AND title = 'Item Expiring Soon'
          AND message LIKE ${`%${item.name}%`}
          AND created_at > CURRENT_DATE
        LIMIT 1
      `);

      if ((existingNotification as any)?.rows?.length > 0) {
        console.log(`⏭️  Skipping ${item.name} - already notified today`);
        continue;
      }

      // Send notification
      await sendPantryExpiringNotification(userId, item.name, daysUntil);
      notifiedToday.add(notificationKey);

      console.log(`✅ Notified user ${userId}: ${item.name} expires in ${daysUntil} day(s)`);

      // If it's a household item, notify all household members
      if (item.household_id) {
        const householdMembers = await db.execute(sql`
          SELECT user_id FROM pantry_household_members
          WHERE household_id = ${item.household_id}
            AND user_id != ${userId}
        `);

        const members = (householdMembers as any)?.rows || [];
        for (const member of members) {
          const memberKey = `${member.user_id}-${item.id}-${daysUntil}`;
          if (!notifiedToday.has(memberKey)) {
            await sendPantryExpiringNotification(
              String(member.user_id),
              item.name,
              daysUntil
            );
            notifiedToday.add(memberKey);
            console.log(`✅ Notified household member ${member.user_id}`);
          }
        }
      }
    }

    console.log(`🔔 Pantry expiring check complete. Sent ${notifiedToday.size} notifications`);
    return { success: true, notificationsSent: notifiedToday.size };
  } catch (error) {
    console.error("❌ Error checking expiring pantry items:", error);
    return { success: false, error: String(error) };
  }
}

/**
 * Check for low stock items and send notifications
 * Should run daily or when items are updated
 */
export async function checkLowStockItems() {
  try {
    console.log("🔔 Running pantry low stock check...");

    // Get items with low quantity (less than 2 units)
    const lowStockItems = await db.execute(sql`
      SELECT
        pi.id,
        pi.name,
        pi.user_id,
        pi.household_id,
        pi.quantity,
        pi.unit
      FROM pantry_items pi
      WHERE pi.quantity IS NOT NULL
        AND CAST(pi.quantity AS DECIMAL) > 0
        AND CAST(pi.quantity AS DECIMAL) < 2
    `);

    const items = (lowStockItems as any)?.rows || [];
    console.log(`📦 Found ${items.length} low stock items`);

    const notifiedToday = new Set<string>();

    for (const item of items) {
      const userId = String(item.user_id);
      const notificationKey = `${userId}-${item.id}-lowstock`;

      // Check if we already notified about this item being low today
      const existingNotification = await db.execute(sql`
        SELECT id FROM notifications
        WHERE user_id = ${userId}
          AND type = 'pantry'
          AND title = 'Low Stock Alert'
          AND message LIKE ${`%${item.name}%`}
          AND created_at > CURRENT_DATE - INTERVAL '7 days'
        LIMIT 1
      `);

      // Only notify once per week for low stock
      if ((existingNotification as any)?.rows?.length > 0) {
        continue;
      }

      await sendPantryLowStockNotification(
        userId,
        item.name,
        Math.floor(Number(item.quantity))
      );
      notifiedToday.add(notificationKey);

      console.log(`✅ Notified user ${userId}: ${item.name} is low (${item.quantity})`);

      // Notify household members
      if (item.household_id) {
        const householdMembers = await db.execute(sql`
          SELECT user_id FROM pantry_household_members
          WHERE household_id = ${item.household_id}
            AND user_id != ${userId}
        `);

        const members = (householdMembers as any)?.rows || [];
        for (const member of members) {
          const memberKey = `${member.user_id}-${item.id}-lowstock`;
          if (!notifiedToday.has(memberKey)) {
            await sendPantryLowStockNotification(
              String(member.user_id),
              item.name,
              Math.floor(Number(item.quantity))
            );
            notifiedToday.add(memberKey);
          }
        }
      }
    }

    console.log(`🔔 Low stock check complete. Sent ${notifiedToday.size} notifications`);
    return { success: true, notificationsSent: notifiedToday.size };
  } catch (error) {
    console.error("❌ Error checking low stock items:", error);
    return { success: false, error: String(error) };
  }
}
