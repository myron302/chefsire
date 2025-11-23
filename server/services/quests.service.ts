// server/services/quests.service.ts
import { and, eq, gte } from "drizzle-orm";
import { db } from "../db";
import {
  dailyQuests,
  questProgress,
  notifications,
  users,
} from "../../shared/schema";

/**
 * Assign today's 3 daily quests to a specific user (idempotent).
 * - If the user already has quests for today, it returns without duplicating.
 * - Filters by recurringPattern (daily / weekend_only / weekday_only).
 */
export async function assignDailyQuestsToUser(userId: string) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // If they already have today's quests, do nothing (idempotent)
  const existing = await db
    .select()
    .from(questProgress)
    .where(and(eq(questProgress.userId, userId), gte(questProgress.date, today)));

  if (existing.length > 0) return { assigned: 0, alreadyHad: true };

  // Pull all active quests
  const allActive = await db.select().from(dailyQuests).where(eq(dailyQuests.isActive, true));

  // Filter by day pattern
  const dow = today.getDay(); // 0 = Sun, 6 = Sat
  const isWeekend = dow === 0 || dow === 6;
  const todaysQuests = allActive.filter((q) => {
    if (!q.recurringPattern) return true;
    if (q.recurringPattern === "daily") return true;
    if (q.recurringPattern === "weekend_only" && isWeekend) return true;
    if (q.recurringPattern === "weekday_only" && !isWeekend) return true;
    return false;
  });

  // Pick up to 3 at random
  const selected = [...todaysQuests].sort(() => Math.random() - 0.5).slice(0, 3);

  if (selected.length === 0) return { assigned: 0, alreadyHad: false };

  // Create progress rows
  const rows = selected.map((q) => ({
    userId,
    questId: q.id,
    date: today,
    currentProgress: 0,
    targetProgress: q.targetValue || 1,
    status: "active" as const,
    xpEarned: q.xpReward || 50,
  }));

  await db.insert(questProgress).values(rows);

  // Drop a notification
  await db.insert(notifications).values({
    userId,
    type: "daily_quests",
    title: "New Daily Quests Available! 🎯",
    message: `${selected.length} new quest${selected.length > 1 ? "s are" : " is"} waiting for you!`,
    linkUrl: "/quests",
    metadata: {
      questCount: selected.length,
      questIds: selected.map((q) => q.id),
    },
  });

  return { assigned: selected.length, alreadyHad: false };
}

/**
 * Assign today's quests to all users.
 * Returns the number of users processed.
 */
export async function assignDailyQuestsToAllUsers() {
  const allUsers = await db.select({ id: users.id }).from(users);
  for (const u of allUsers) {
    await assignDailyQuestsToUser(u.id);
  }
  return allUsers.length;
}
