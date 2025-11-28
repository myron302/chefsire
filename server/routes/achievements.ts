// server/routes/achievements.ts
import { Router } from "express";
import { eq, and, sql } from "drizzle-orm";
import { db } from "../db";
import { users, userDrinkStats, questProgress, posts, notifications } from "../../shared/schema";
import { requireAuth } from "../middleware";

const router = Router();

// Define achievement criteria
export const ACHIEVEMENTS = {
  // XP Achievements
  first_steps: {
    id: "first_steps",
    name: "First Steps",
    description: "Earn your first 100 XP",
    icon: "⭐",
    category: "xp",
    requirement: (stats: any) => stats.totalPoints >= 100,
    xpReward: 50,
  },
  rising_star: {
    id: "rising_star",
    name: "Rising Star",
    description: "Reach 1,000 XP",
    icon: "🌟",
    category: "xp",
    requirement: (stats: any) => stats.totalPoints >= 1000,
    xpReward: 200,
  },
  master_chef: {
    id: "master_chef",
    name: "Master Chef",
    description: "Reach 10,000 XP",
    icon: "👨‍🍳",
    category: "xp",
    requirement: (stats: any) => stats.totalPoints >= 10000,
    xpReward: 1000,
  },

  // Quest Achievements
  quest_beginner: {
    id: "quest_beginner",
    name: "Quest Beginner",
    description: "Complete 5 quests",
    icon: "🎯",
    category: "quests",
    requirement: (stats: any) => stats.questsCompleted >= 5,
    xpReward: 100,
  },
  quest_master: {
    id: "quest_master",
    name: "Quest Master",
    description: "Complete 50 quests",
    icon: "🏆",
    category: "quests",
    requirement: (stats: any) => stats.questsCompleted >= 50,
    xpReward: 500,
  },
  quest_legend: {
    id: "quest_legend",
    name: "Quest Legend",
    description: "Complete 200 quests",
    icon: "⚡",
    category: "quests",
    requirement: (stats: any) => stats.questsCompleted >= 200,
    xpReward: 2000,
  },

  // Streak Achievements
  streak_starter: {
    id: "streak_starter",
    name: "Streak Starter",
    description: "Maintain a 7-day streak",
    icon: "🔥",
    category: "streaks",
    requirement: (stats: any) => stats.currentStreak >= 7 || stats.longestStreak >= 7,
    xpReward: 150,
  },
  streak_warrior: {
    id: "streak_warrior",
    name: "Streak Warrior",
    description: "Maintain a 30-day streak",
    icon: "💥",
    category: "streaks",
    requirement: (stats: any) => stats.currentStreak >= 30 || stats.longestStreak >= 30,
    xpReward: 500,
  },
  streak_legend: {
    id: "streak_legend",
    name: "Streak Legend",
    description: "Maintain a 100-day streak",
    icon: "🌟",
    category: "streaks",
    requirement: (stats: any) => stats.currentStreak >= 100 || stats.longestStreak >= 100,
    xpReward: 2000,
  },

  // Social Achievements
  social_butterfly: {
    id: "social_butterfly",
    name: "Social Butterfly",
    description: "Create 10 posts",
    icon: "🦋",
    category: "social",
    requirement: (stats: any) => stats.postsCount >= 10,
    xpReward: 100,
  },
  content_creator: {
    id: "content_creator",
    name: "Content Creator",
    description: "Create 50 posts",
    icon: "📸",
    category: "social",
    requirement: (stats: any) => stats.postsCount >= 50,
    xpReward: 500,
  },
  influencer: {
    id: "influencer",
    name: "Influencer",
    description: "Gain 100 followers",
    icon: "👥",
    category: "social",
    requirement: (stats: any) => stats.followersCount >= 100,
    xpReward: 1000,
  },

  // Recipe Achievements
  recipe_explorer: {
    id: "recipe_explorer",
    name: "Recipe Explorer",
    description: "Make 10 different recipes",
    icon: "🍳",
    category: "recipes",
    requirement: (stats: any) => stats.totalDrinksMade >= 10,
    xpReward: 150,
  },
  recipe_master: {
    id: "recipe_master",
    name: "Recipe Master",
    description: "Make 50 different recipes",
    icon: "👨‍🍳",
    category: "recipes",
    requirement: (stats: any) => stats.totalDrinksMade >= 50,
    xpReward: 750,
  },
};

/**
 * GET /api/achievements
 * Get all available achievements with user's unlock status
 */
router.get("/", requireAuth, async (req, res) => {
  try {
    const userId = req.user!.id;

    // Get user stats
    const [userStats] = await db
      .select()
      .from(userDrinkStats)
      .where(eq(userDrinkStats.userId, userId))
      .limit(1);

    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    // Get quest completion count
    const questCountResult = await db.execute(sql`
      SELECT COUNT(*) as count
      FROM quest_progress
      WHERE user_id = ${userId} AND status = 'completed'
    `);

    // Get post count
    const postCountResult = await db.execute(sql`
      SELECT COUNT(*) as count
      FROM posts
      WHERE user_id = ${userId}
    `);

    const stats = {
      totalPoints: userStats?.totalPoints || 0,
      questsCompleted: Number(questCountResult.rows[0]?.count || 0),
      currentStreak: userStats?.currentStreak || 0,
      longestStreak: userStats?.longestStreak || 0,
      totalDrinksMade: userStats?.totalDrinksMade || 0,
      postsCount: Number(postCountResult.rows[0]?.count || 0),
      followersCount: user?.followersCount || 0,
    };

    // Check which achievements are unlocked
    const achievements = Object.values(ACHIEVEMENTS).map(achievement => ({
      id: achievement.id,
      name: achievement.name,
      description: achievement.description,
      icon: achievement.icon,
      category: achievement.category,
      xpReward: achievement.xpReward,
      unlocked: achievement.requirement(stats),
      progress: getProgress(achievement, stats),
    }));

    // Calculate total unlocked and XP earned
    const totalUnlocked = achievements.filter(a => a.unlocked).length;
    const totalXpEarned = achievements
      .filter(a => a.unlocked)
      .reduce((sum, a) => sum + a.xpReward, 0);

    return res.json({
      achievements,
      stats: {
        totalUnlocked,
        totalXpEarned,
      },
    });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/achievements/check
 * Check if user has unlocked new achievements and send notifications
 */
router.post("/check", requireAuth, async (req, res) => {
  try {
    const userId = req.user!.id;

    // Get user stats (same as above)
    const [userStats] = await db
      .select()
      .from(userDrinkStats)
      .where(eq(userDrinkStats.userId, userId))
      .limit(1);

    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    const questCountResult = await db.execute(sql`
      SELECT COUNT(*) as count
      FROM quest_progress
      WHERE user_id = ${userId} AND status = 'completed'
    `);

    const postCountResult = await db.execute(sql`
      SELECT COUNT(*) as count
      FROM posts
      WHERE user_id = ${userId}
    `);

    const stats = {
      totalPoints: userStats?.totalPoints || 0,
      questsCompleted: Number(questCountResult.rows[0]?.count || 0),
      currentStreak: userStats?.currentStreak || 0,
      longestStreak: userStats?.longestStreak || 0,
      totalDrinksMade: userStats?.totalDrinksMade || 0,
      postsCount: Number(postCountResult.rows[0]?.count || 0),
      followersCount: user?.followersCount || 0,
    };

    // Check for newly unlocked achievements
    const newlyUnlocked = [];

    for (const achievement of Object.values(ACHIEVEMENTS)) {
      if (achievement.requirement(stats)) {
        // Check if user already has notification for this achievement
        const existing = await db.execute(sql`
          SELECT id FROM notifications
          WHERE user_id = ${userId}
            AND type = 'achievement'
            AND metadata->>'achievementId' = ${achievement.id}
          LIMIT 1
        `);

        if (existing.rows.length === 0) {
          // New achievement unlocked!
          newlyUnlocked.push(achievement);

          // Create notification
          await db.insert(notifications).values({
            userId,
            type: "achievement",
            title: `Achievement Unlocked: ${achievement.name}! ${achievement.icon}`,
            message: `${achievement.description} (+${achievement.xpReward} XP)`,
            linkUrl: "/leaderboard",
            metadata: {
              achievementId: achievement.id,
              xpReward: achievement.xpReward,
            },
            priority: "high",
          });

          // Award XP
          if (achievement.xpReward > 0) {
            await db
              .update(userDrinkStats)
              .set({
                totalPoints: sql`${userDrinkStats.totalPoints} + ${achievement.xpReward}`,
              })
              .where(eq(userDrinkStats.userId, userId));
          }
        }
      }
    }

    return res.json({
      newlyUnlocked,
      count: newlyUnlocked.length,
    });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

// Helper function to calculate progress towards an achievement
function getProgress(achievement: any, stats: any): number {
  const id = achievement.id;

  // XP achievements
  if (id === "first_steps") return Math.min((stats.totalPoints / 100) * 100, 100);
  if (id === "rising_star") return Math.min((stats.totalPoints / 1000) * 100, 100);
  if (id === "master_chef") return Math.min((stats.totalPoints / 10000) * 100, 100);

  // Quest achievements
  if (id === "quest_beginner") return Math.min((stats.questsCompleted / 5) * 100, 100);
  if (id === "quest_master") return Math.min((stats.questsCompleted / 50) * 100, 100);
  if (id === "quest_legend") return Math.min((stats.questsCompleted / 200) * 100, 100);

  // Streak achievements
  const streakValue = Math.max(stats.currentStreak, stats.longestStreak);
  if (id === "streak_starter") return Math.min((streakValue / 7) * 100, 100);
  if (id === "streak_warrior") return Math.min((streakValue / 30) * 100, 100);
  if (id === "streak_legend") return Math.min((streakValue / 100) * 100, 100);

  // Social achievements
  if (id === "social_butterfly") return Math.min((stats.postsCount / 10) * 100, 100);
  if (id === "content_creator") return Math.min((stats.postsCount / 50) * 100, 100);
  if (id === "influencer") return Math.min((stats.followersCount / 100) * 100, 100);

  // Recipe achievements
  if (id === "recipe_explorer") return Math.min((stats.totalDrinksMade / 10) * 100, 100);
  if (id === "recipe_master") return Math.min((stats.totalDrinksMade / 50) * 100, 100);

  return 0;
}

export default router;
