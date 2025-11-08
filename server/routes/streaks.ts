// server/routes/streaks.ts
import { Router } from "express";
import { eq, and, gte, sql } from "drizzle-orm";
import { db } from "../db";
import { userDrinkStats, notifications } from "../../shared/schema";
import { requireAuth } from "../middleware";

const router = Router();

// Streak rewards based on milestone days
const STREAK_REWARDS = {
  7: { xp: 100, title: "Week Warrior" },
  14: { xp: 200, title: "Two Week Champion" },
  30: { xp: 500, title: "Month Master" },
  60: { xp: 1000, title: "Two Month Legend" },
  100: { xp: 2000, title: "Century Achiever" },
  365: { xp: 10000, title: "Year of Dedication" },
};

/**
 * POST /api/streaks/checkin
 * Record daily check-in and update streak
 */
router.post("/checkin", requireAuth, async (req, res) => {
  try {
    const userId = req.user!.id;

    // Get user stats
    const [stats] = await db
      .select()
      .from(userDrinkStats)
      .where(eq(userDrinkStats.userId, userId))
      .limit(1);

    if (!stats) {
      return res.status(404).json({ error: "User stats not found" });
    }

    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const lastCheckin = stats.lastStreakDate ? new Date(stats.lastStreakDate) : null;

    // If already checked in today, return current streak
    if (lastCheckin) {
      const lastCheckinDate = new Date(
        lastCheckin.getFullYear(),
        lastCheckin.getMonth(),
        lastCheckin.getDate()
      );

      if (lastCheckinDate.getTime() === today.getTime()) {
        return res.json({
          alreadyCheckedIn: true,
          currentStreak: stats.currentStreak,
          message: "Already checked in today!",
        });
      }
    }

    let newStreak = 1;
    let streakBroken = false;

    if (lastCheckin) {
      const yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 1);
      const lastCheckinDate = new Date(
        lastCheckin.getFullYear(),
        lastCheckin.getMonth(),
        lastCheckin.getDate()
      );

      // Check if checked in yesterday (continue streak)
      if (lastCheckinDate.getTime() === yesterday.getTime()) {
        newStreak = (stats.currentStreak || 0) + 1;
      } else {
        // Streak broken
        streakBroken = true;
        newStreak = 1;
      }
    }

    // Update longest streak if necessary
    const longestStreak = Math.max(stats.longestStreak || 0, newStreak);

    // Calculate base daily reward
    const baseReward = 10;
    const streakBonus = Math.min(newStreak * 2, 100); // Up to +100 XP for long streaks
    const totalReward = baseReward + streakBonus;

    // Check for milestone rewards
    let milestoneReward = 0;
    let milestoneTitle = "";
    if (STREAK_REWARDS[newStreak as keyof typeof STREAK_REWARDS]) {
      const milestone = STREAK_REWARDS[newStreak as keyof typeof STREAK_REWARDS];
      milestoneReward = milestone.xp;
      milestoneTitle = milestone.title;

      // Send milestone notification
      await db.insert(notifications).values({
        userId,
        type: "streak_milestone",
        title: `🔥 ${newStreak}-Day Streak Milestone!`,
        message: `${milestoneTitle}! You earned ${milestoneReward} bonus XP!`,
        linkUrl: "/leaderboard",
        metadata: {
          streak: newStreak,
          xpReward: milestoneReward,
        },
        priority: "high",
      });
    }

    // Update user stats
    await db
      .update(userDrinkStats)
      .set({
        currentStreak: newStreak,
        longestStreak,
        lastStreakDate: now,
        totalPoints: sql`${userDrinkStats.totalPoints} + ${totalReward + milestoneReward}`,
        updatedAt: now,
      })
      .where(eq(userDrinkStats.userId, userId));

    // Send daily check-in notification
    if (!streakBroken) {
      await db.insert(notifications).values({
        userId,
        type: "daily_checkin",
        title: `Day ${newStreak} - Daily Check-in Bonus!`,
        message: `🔥 ${newStreak}-day streak! Earned ${totalReward} XP (+${streakBonus} streak bonus)`,
        linkUrl: "/leaderboard",
        metadata: {
          streak: newStreak,
          xpEarned: totalReward,
        },
      });
    } else {
      // Streak broken notification
      await db.insert(notifications).values({
        userId,
        type: "streak_broken",
        title: "Streak Reset",
        message: `Your ${stats.currentStreak}-day streak ended. Starting fresh today!`,
        linkUrl: "/leaderboard",
      });
    }

    return res.json({
      success: true,
      currentStreak: newStreak,
      longestStreak,
      xpEarned: totalReward + milestoneReward,
      baseReward,
      streakBonus,
      milestoneReward,
      milestoneTitle: milestoneTitle || null,
      streakBroken,
    });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/streaks/status
 * Get current streak status for authenticated user
 */
router.get("/status", requireAuth, async (req, res) => {
  try {
    const userId = req.user!.id;

    const [stats] = await db
      .select()
      .from(userDrinkStats)
      .where(eq(userDrinkStats.userId, userId))
      .limit(1);

    if (!stats) {
      return res.json({
        currentStreak: 0,
        longestStreak: 0,
        checkedInToday: false,
        nextMilestone: 7,
      });
    }

    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const lastCheckin = stats.lastStreakDate ? new Date(stats.lastStreakDate) : null;

    let checkedInToday = false;
    if (lastCheckin) {
      const lastCheckinDate = new Date(
        lastCheckin.getFullYear(),
        lastCheckin.getMonth(),
        lastCheckin.getDate()
      );
      checkedInToday = lastCheckinDate.getTime() === today.getTime();
    }

    // Find next milestone
    const currentStreak = stats.currentStreak || 0;
    let nextMilestone = null;
    for (const milestone of Object.keys(STREAK_REWARDS).map(Number).sort((a, b) => a - b)) {
      if (milestone > currentStreak) {
        nextMilestone = milestone;
        break;
      }
    }

    return res.json({
      currentStreak: stats.currentStreak || 0,
      longestStreak: stats.longestStreak || 0,
      checkedInToday,
      lastCheckinDate: stats.lastStreakDate,
      nextMilestone,
      nextMilestoneReward: nextMilestone ? STREAK_REWARDS[nextMilestone as keyof typeof STREAK_REWARDS] : null,
    });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/streaks/rewards
 * Get list of all streak milestone rewards
 */
router.get("/rewards", async (_req, res) => {
  try {
    const rewards = Object.entries(STREAK_REWARDS).map(([days, reward]) => ({
      days: Number(days),
      ...reward,
    }));

    return res.json({ rewards });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

export default router;
