// server/routes/leaderboard.ts
import { Router } from "express";
import { desc, sql, and, gte, eq } from "drizzle-orm";
import { db } from "../db";
import {
  users,
  userDrinkStats,
  questProgress,
  posts,
  follows
} from "../../shared/schema";
import { requireAuth } from "../middleware";

const router = Router();

/**
 * GET /api/leaderboard/xp
 * Get top users by XP points
 */
router.get("/xp", async (req, res) => {
  try {
    const limit = parseInt(req.query.limit as string) || 50;
    const offset = parseInt(req.query.offset as string) || 0;

    const leaderboard = await db
      .select({
        user: {
          id: users.id,
          username: users.username,
          displayName: users.displayName,
          avatar: users.avatar,
          royalTitle: users.royalTitle,
        },
        stats: {
          totalPoints: userDrinkStats.totalPoints,
          level: userDrinkStats.level,
          currentStreak: userDrinkStats.currentStreak,
          totalDrinksMade: userDrinkStats.totalDrinksMade,
        },
      })
      .from(userDrinkStats)
      .innerJoin(users, eq(userDrinkStats.userId, users.id))
      .orderBy(desc(userDrinkStats.totalPoints))
      .limit(limit)
      .offset(offset);

    return res.json({
      leaderboard,
      count: leaderboard.length,
      limit,
      offset
    });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/leaderboard/quests
 * Get top users by completed quests this week
 */
router.get("/quests", async (req, res) => {
  try {
    const limit = parseInt(req.query.limit as string) || 50;

    // Get start of current week
    const weekStart = new Date();
    weekStart.setDate(weekStart.getDate() - weekStart.getDay());
    weekStart.setHours(0, 0, 0, 0);

    // Get quest completions for the week
    const questLeaders = await db
      .select({
        userId: questProgress.userId,
        completedQuests: sql<number>`count(*)`.as('completed_quests'),
        totalXP: sql<number>`sum(${questProgress.xpEarned})`.as('total_xp'),
      })
      .from(questProgress)
      .where(
        and(
          eq(questProgress.status, "completed"),
          gte(questProgress.date, weekStart)
        )
      )
      .groupBy(questProgress.userId)
      .orderBy(desc(sql`count(*)`))
      .limit(limit);

    // Get user details for the leaders
    const userIds = questLeaders.map(l => l.userId);
    const userDetails = await db
      .select({
        id: users.id,
        username: users.username,
        displayName: users.displayName,
        avatar: users.avatar,
        royalTitle: users.royalTitle,
      })
      .from(users)
      .where(sql`${users.id} IN ${userIds}`);

    // Combine data
    const leaderboard = questLeaders.map(leader => {
      const user = userDetails.find(u => u.id === leader.userId);
      return {
        user,
        completedQuests: Number(leader.completedQuests),
        totalXP: Number(leader.totalXP),
      };
    });

    return res.json({ leaderboard, weekStart });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/leaderboard/streaks
 * Get top users by current streak
 */
router.get("/streaks", async (req, res) => {
  try {
    const limit = parseInt(req.query.limit as string) || 50;

    const leaderboard = await db
      .select({
        user: {
          id: users.id,
          username: users.username,
          displayName: users.displayName,
          avatar: users.avatar,
          royalTitle: users.royalTitle,
        },
        stats: {
          currentStreak: userDrinkStats.currentStreak,
          longestStreak: userDrinkStats.longestStreak,
          totalDrinksMade: userDrinkStats.totalDrinksMade,
          level: userDrinkStats.level,
        },
      })
      .from(userDrinkStats)
      .innerJoin(users, eq(userDrinkStats.userId, users.id))
      .where(sql`${userDrinkStats.currentStreak} > 0`)
      .orderBy(desc(userDrinkStats.currentStreak))
      .limit(limit);

    return res.json({ leaderboard });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/leaderboard/social
 * Get top users by social engagement (posts, followers)
 */
router.get("/social", async (req, res) => {
  try {
    const limit = parseInt(req.query.limit as string) || 50;

    // Get post counts
    const postCounts = await db
      .select({
        userId: posts.userId,
        postCount: sql<number>`count(*)`.as('post_count'),
      })
      .from(posts)
      .groupBy(posts.userId)
      .orderBy(desc(sql`count(*)`))
      .limit(limit * 2); // Get more to have options after joining with followers

    const userIds = postCounts.map(p => p.userId);

    // Get user details with follower counts
    const userDetails = await db
      .select({
        id: users.id,
        username: users.username,
        displayName: users.displayName,
        avatar: users.avatar,
        royalTitle: users.royalTitle,
        followersCount: users.followersCount,
        followingCount: users.followingCount,
      })
      .from(users)
      .where(sql`${users.id} IN ${userIds}`);

    // Combine and calculate engagement score
    const leaderboard = userDetails
      .map(user => {
        const postCount = postCounts.find(p => p.userId === user.id)?.postCount || 0;
        const engagementScore = (user.followersCount || 0) * 2 + Number(postCount);

        return {
          user: {
            id: user.id,
            username: user.username,
            displayName: user.displayName,
            avatar: user.avatar,
            royalTitle: user.royalTitle,
          },
          stats: {
            followersCount: user.followersCount || 0,
            postCount: Number(postCount),
            engagementScore,
          },
        };
      })
      .sort((a, b) => b.stats.engagementScore - a.stats.engagementScore)
      .slice(0, limit);

    return res.json({ leaderboard });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/leaderboard/my-rank
 * Get current user's rank across different leaderboards
 */
router.get("/my-rank", requireAuth, async (req, res) => {
  try {
    const userId = req.user!.id;

    // Get XP rank
    const xpRankResult = await db.execute(sql`
      SELECT rank
      FROM (
        SELECT
          user_id,
          ROW_NUMBER() OVER (ORDER BY total_points DESC) as rank
        FROM user_drink_stats
      ) ranked
      WHERE user_id = ${userId}
    `);
    const xpRank = xpRankResult.rows[0]?.rank || null;

    // Get quest rank (this week)
    const weekStart = new Date();
    weekStart.setDate(weekStart.getDate() - weekStart.getDay());
    weekStart.setHours(0, 0, 0, 0);

    const questRankResult = await db.execute(sql`
      SELECT rank
      FROM (
        SELECT
          user_id,
          ROW_NUMBER() OVER (ORDER BY COUNT(*) DESC) as rank
        FROM quest_progress
        WHERE status = 'completed' AND date >= ${weekStart}
        GROUP BY user_id
      ) ranked
      WHERE user_id = ${userId}
    `);
    const questRank = questRankResult.rows[0]?.rank || null;

    // Get streak rank
    const streakRankResult = await db.execute(sql`
      SELECT rank
      FROM (
        SELECT
          user_id,
          ROW_NUMBER() OVER (ORDER BY current_streak DESC) as rank
        FROM user_drink_stats
        WHERE current_streak > 0
      ) ranked
      WHERE user_id = ${userId}
    `);
    const streakRank = streakRankResult.rows[0]?.rank || null;

    return res.json({
      ranks: {
        xp: xpRank ? Number(xpRank) : null,
        quests: questRank ? Number(questRank) : null,
        streak: streakRank ? Number(streakRank) : null,
      },
    });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

export default router;
