// server/services/quests.service.ts
import { and, eq, gte, sql } from "drizzle-orm";
import { db } from "../db";
import {
  dailyQuests,
  questProgress,
  notifications,
  users,
  userDrinkStats,
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

/**
 * Track quest progress for a user action (e.g., creating a drink, posting, etc.)
 * Automatically finds relevant active quests and increments their progress.
 */
export async function trackQuestProgress(userId: string, actionType: string, metadata?: any) {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Get user's active quests for today
    const activeProgress = await db
      .select({ progress: questProgress, quest: dailyQuests })
      .from(questProgress)
      .innerJoin(dailyQuests, eq(questProgress.questId, dailyQuests.id))
      .where(
        and(
          eq(questProgress.userId, userId),
          gte(questProgress.date, today),
          eq(questProgress.status, "active")
        )
      );

    if (activeProgress.length === 0) return { updated: 0 };

    const completedQuests: string[] = [];
    let totalXpEarned = 0;

    // Check each quest to see if it matches the action
    for (const { progress, quest } of activeProgress) {
      let shouldIncrement = false;

      // Match quest action type with the user's action
      if (quest.actionType === actionType) {
        shouldIncrement = true;
      }

      // Additional filtering based on metadata (e.g., drink category)
      if (shouldIncrement && quest.category && metadata?.category) {
        shouldIncrement = quest.category === metadata.category;
      }

      if (shouldIncrement) {
        const newProgress = progress.currentProgress + 1;
        const isComplete = newProgress >= progress.targetProgress;

        await db
          .update(questProgress)
          .set({
            currentProgress: newProgress,
            status: isComplete ? "completed" : "active",
            completedAt: isComplete ? new Date() : null,
          })
          .where(eq(questProgress.id, progress.id));

        if (isComplete) {
          completedQuests.push(quest.id);
          totalXpEarned += progress.xpEarned;

          // Send completion notification
          await db.insert(notifications).values({
            userId,
            type: "quest_completed",
            title: "Quest Completed! 🎯",
            message: `You completed "${quest.title}" and earned ${progress.xpEarned} XP!`,
            linkUrl: "/quests",
            metadata: {
              questId: quest.id,
              xpEarned: progress.xpEarned,
            },
          });
        }
      }
    }

    // Award XP for completed quests
    if (totalXpEarned > 0) {
      await db
        .update(userDrinkStats)
        .set({
          totalPoints: sql`${userDrinkStats.totalPoints} + ${totalXpEarned}`,
          updatedAt: new Date(),
        })
        .where(eq(userDrinkStats.userId, userId));
    }

    return {
      updated: completedQuests.length,
      completedQuestIds: completedQuests,
      xpEarned: totalXpEarned,
    };
  } catch (error) {
    console.error("[Quests] Error tracking progress:", error);
    return { updated: 0, error: true };
  }
}
