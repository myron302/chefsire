// server/routes/analytics.ts
import { Router } from "express";
import { storage } from "../storage";
import { db } from "../db";
import {
  customDrinks,
  drinkLikes,
  likes,
  follows,
  userDrinkStats,
  posts,
  comments
} from "../../shared/schema";
import { eq, count, sql, and, desc } from "drizzle-orm";
import { requireAuth } from "../middleware/auth";

const router = Router();

// Get comprehensive analytics for a user
router.get("/user/:userId", async (req, res) => {
  try {
    const { userId } = req.params;
    const { timeframe = "all" } = req.query; // all, month, week, day

    // Calculate date filter based on timeframe
    let dateFilter: Date | null = null;
    if (timeframe === "month") {
      dateFilter = new Date();
      dateFilter.setMonth(dateFilter.getMonth() - 1);
    } else if (timeframe === "week") {
      dateFilter = new Date();
      dateFilter.setDate(dateFilter.getDate() - 7);
    } else if (timeframe === "day") {
      dateFilter = new Date();
      dateFilter.setDate(dateFilter.getDate() - 1);
    }

    // User drink stats (overall progress)
    const [drinkStats] = await db
      .select()
      .from(userDrinkStats)
      .where(eq(userDrinkStats.userId, userId))
      .limit(1);

    // Custom drinks created
    const [customDrinksCount] = await db
      .select({ count: count() })
      .from(customDrinks)
      .where(
        dateFilter
          ? and(
              eq(customDrinks.userId, userId),
              sql`${customDrinks.createdAt} >= ${dateFilter}`
            )
          : eq(customDrinks.userId, userId)
      );

    // Total likes received on custom drinks
    const [likesReceived] = await db
      .select({ count: count() })
      .from(drinkLikes)
      .innerJoin(customDrinks, eq(drinkLikes.drinkId, customDrinks.id))
      .where(
        dateFilter
          ? and(
              eq(customDrinks.userId, userId),
              sql`${drinkLikes.createdAt} >= ${dateFilter}`
            )
          : eq(customDrinks.userId, userId)
      );

    // Total likes given
    const [likesGiven] = await db
      .select({ count: count() })
      .from(drinkLikes)
      .where(
        dateFilter
          ? and(
              eq(drinkLikes.userId, userId),
              sql`${drinkLikes.createdAt} >= ${dateFilter}`
            )
          : eq(drinkLikes.userId, userId)
      );

    // Recipe reviews written
    const [reviewsCount] = await db
      .select({ count: count() })
      .from(recipeReviews)
      .where(
        dateFilter
          ? and(
              eq(recipeReviews.userId, userId),
              sql`${recipeReviews.createdAt} >= ${dateFilter}`
            )
          : eq(recipeReviews.userId, userId)
      );

    // Follower/Following counts
    const [followerCount] = await db
      .select({ count: count() })
      .from(follows)
      .where(eq(follows.followingId, userId));

    const [followingCount] = await db
      .select({ count: count() })
      .from(follows)
      .where(eq(follows.followerId, userId));

    // Competition stats
    const [competitionsJoined] = await db
      .select({ count: count() })
      .from(competitionParticipants)
      .where(
        dateFilter
          ? and(
              eq(competitionParticipants.userId, userId),
              sql`${competitionParticipants.createdAt} >= ${dateFilter}`
            )
          : eq(competitionParticipants.userId, userId)
      );

    const [competitionsWon] = await db
      .select({ count: count() })
      .from(competitions)
      .innerJoin(
        competitionParticipants,
        eq(competitions.winnerParticipantId, competitionParticipants.id)
      )
      .where(
        and(
          eq(competitionParticipants.userId, userId),
          eq(competitions.status, "completed")
        )
      );

    // Quest completion stats
    const [questsCompleted] = await db
      .select({ count: count() })
      .from(questProgress)
      .where(
        and(
          eq(questProgress.userId, userId),
          eq(questProgress.completed, true)
        )
      );

    // Social posts
    const [postsCount] = await db
      .select({ count: count() })
      .from(posts)
      .where(
        dateFilter
          ? and(
              eq(posts.userId, userId),
              sql`${posts.createdAt} >= ${dateFilter}`
            )
          : eq(posts.userId, userId)
      );

    const [postLikesReceived] = await db
      .select({ count: count() })
      .from(postLikes)
      .innerJoin(posts, eq(postLikes.postId, posts.id))
      .where(
        dateFilter
          ? and(
              eq(posts.userId, userId),
              sql`${postLikes.createdAt} >= ${dateFilter}`
            )
          : eq(posts.userId, userId)
      );

    const [commentsReceived] = await db
      .select({ count: count() })
      .from(comments)
      .innerJoin(posts, eq(comments.postId, posts.id))
      .where(
        dateFilter
          ? and(
              eq(posts.userId, userId),
              sql`${comments.createdAt} >= ${dateFilter}`
            )
          : eq(posts.userId, userId)
      );

    // Most popular drink category
    const categoryBreakdown = drinkStats
      ? {
          smoothies: drinkStats.smoothiesMade || 0,
          proteinShakes: drinkStats.proteinShakesMade || 0,
          detoxes: drinkStats.detoxesMade || 0,
          cocktails: drinkStats.cocktailsMade || 0,
        }
      : { smoothies: 0, proteinShakes: 0, detoxes: 0, cocktails: 0 };

    const mostPopularCategory = Object.entries(categoryBreakdown).reduce(
      (max, [category, count]) => (count > max.count ? { category, count } : max),
      { category: "none", count: 0 }
    );

    // Get recent activity highlights
    const recentDrinks = await db
      .select({
        id: customDrinks.id,
        name: customDrinks.name,
        category: customDrinks.category,
        imageUrl: customDrinks.imageUrl,
        createdAt: customDrinks.createdAt,
      })
      .from(customDrinks)
      .where(eq(customDrinks.userId, userId))
      .orderBy(desc(customDrinks.createdAt))
      .limit(5);

    const analytics = {
      userId,
      timeframe,

      // Overall progress
      progress: {
        level: drinkStats?.level || 1,
        totalPoints: drinkStats?.totalPoints || 0,
        totalDrinksMade: drinkStats?.totalDrinksMade || 0,
        currentStreak: drinkStats?.currentStreak || 0,
        longestStreak: drinkStats?.longestStreak || 0,
        badges: drinkStats?.badges || [],
        achievements: drinkStats?.achievements || [],
      },

      // Creation stats
      creation: {
        customDrinksCreated: customDrinksCount.count,
        categoryBreakdown,
        mostPopularCategory: mostPopularCategory.category,
        recentDrinks,
      },

      // Engagement stats
      engagement: {
        likesReceived: likesReceived.count,
        likesGiven: likesGiven.count,
        reviewsWritten: reviewsCount.count,
        postsCreated: postsCount.count,
        postLikesReceived: postLikesReceived.count,
        commentsReceived: commentsReceived.count,
      },

      // Social stats
      social: {
        followers: followerCount.count,
        following: followingCount.count,
        followRatio:
          followingCount.count > 0
            ? (followerCount.count / followingCount.count).toFixed(2)
            : "0.00",
      },

      // Competition stats
      competitions: {
        joined: competitionsJoined.count,
        won: competitionsWon.count,
        winRate:
          competitionsJoined.count > 0
            ? ((competitionsWon.count / competitionsJoined.count) * 100).toFixed(1) + "%"
            : "0%",
      },

      // Quest stats
      quests: {
        completed: questsCompleted.count,
      },
    };

    res.json(analytics);
  } catch (error: any) {
    console.error("Error fetching analytics:", error);
    res.status(500).json({ error: "Failed to fetch analytics" });
  }
});

// Get leaderboard position for user
router.get("/user/:userId/leaderboard", async (req, res) => {
  try {
    const { userId } = req.params;
    const db = getDb();

    // Get user's rank by total points
    const allUsers = await db
      .select({
        userId: userDrinkStats.userId,
        totalPoints: userDrinkStats.totalPoints,
      })
      .from(userDrinkStats)
      .orderBy(desc(userDrinkStats.totalPoints));

    const userRank = allUsers.findIndex((u) => u.userId === userId) + 1;
    const userStats = allUsers.find((u) => u.userId === userId);

    res.json({
      rank: userRank || null,
      totalUsers: allUsers.length,
      points: userStats?.totalPoints || 0,
      percentile:
        userRank > 0
          ? (((allUsers.length - userRank + 1) / allUsers.length) * 100).toFixed(1) + "%"
          : "0%",
    });
  } catch (error: any) {
    console.error("Error fetching leaderboard position:", error);
    res.status(500).json({ error: "Failed to fetch leaderboard position" });
  }
});

// Get activity timeline (last 30 days)
router.get("/user/:userId/timeline", async (req, res) => {
  try {
    const { userId } = req.params;
    const db = getDb();
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    // Get daily activity counts for the last 30 days
    const dailyActivity = await db
      .select({
        date: sql<string>`DATE(${customDrinks.createdAt})`,
        count: count(),
      })
      .from(customDrinks)
      .where(
        and(
          eq(customDrinks.userId, userId),
          sql`${customDrinks.createdAt} >= ${thirtyDaysAgo}`
        )
      )
      .groupBy(sql`DATE(${customDrinks.createdAt})`)
      .orderBy(sql`DATE(${customDrinks.createdAt})`);

    // Fill in missing days with 0 count
    const timeline = [];
    for (let i = 0; i < 30; i++) {
      const date = new Date();
      date.setDate(date.getDate() - (29 - i));
      const dateStr = date.toISOString().split("T")[0];
      const activity = dailyActivity.find((a) => a.date === dateStr);
      timeline.push({
        date: dateStr,
        count: activity?.count || 0,
      });
    }

    res.json(timeline);
  } catch (error: any) {
    console.error("Error fetching timeline:", error);
    res.status(500).json({ error: "Failed to fetch timeline" });
  }
});

export default router;
