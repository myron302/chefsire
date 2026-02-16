// server/routes/clubs.ts
import express, { type Request, type Response } from "express";
import { db } from "../db/index.js";
import { eq, and, desc, sql } from "drizzle-orm";
import {
  clubs,
  clubMemberships,
  clubPosts,
  challenges,
  challengeProgress,
  badges,
  userBadges,
  users,
  recipes,
} from "../../shared/schema.js";
import { requireAuth } from "../middleware/index";

const router = express.Router();

// ============================================================
// CLUBS MANAGEMENT
// ============================================================

// Browse clubs
router.get("/", async (req: Request, res: Response) => {
  try {
    const { category, search, sort } = req.query;

    const allClubs = await db
      .select({
        club: clubs,
        memberCount: sql`count(distinct ${clubMemberships.id})`,
        postCount: sql`count(distinct ${clubPosts.id})`,
      })
      .from(clubs)
      .leftJoin(clubMemberships, eq(clubs.id, clubMemberships.clubId))
      .leftJoin(clubPosts, eq(clubs.id, clubPosts.clubId))
      .where(eq(clubs.isPublic, true))
      .groupBy(clubs.id)
      .$dynamic();

    let filtered = await allClubs;

    if (category && category !== "all") {
      filtered = filtered.filter((c) => c.club.category === category);
    }

    if (search) {
      const searchLower = (search as string).toLowerCase();
      filtered = filtered.filter(
        (c) =>
          c.club.name.toLowerCase().includes(searchLower) ||
          c.club.description?.toLowerCase().includes(searchLower)
      );
    }

    if (sort === "members") {
      filtered.sort((a, b) => b.memberCount - a.memberCount);
    } else if (sort === "activity") {
      filtered.sort((a, b) => b.postCount - a.postCount);
    } else {
      filtered.sort(
        (a, b) =>
          new Date(b.club.createdAt).getTime() -
          new Date(a.club.createdAt).getTime()
      );
    }

    res.json({ clubs: filtered });
  } catch (error) {
    console.error("Error browsing clubs:", error);
    res.status(500).json({ message: "Failed to browse clubs" });
  }
});

// Get club details
router.get("/:id", async (req: Request, res: Response) => {
  try {
    const clubId = req.params.id;

    const [club] = await db
      .select({
        club: clubs,
        creator: {
          id: users.id,
          username: users.username,
          displayName: users.displayName,
        },
      })
      .from(clubs)
      .innerJoin(users, eq(clubs.creatorId, users.id))
      .where(eq(clubs.id, clubId))
      .limit(1);

    if (!club) {
      return res.status(404).json({ message: "Club not found" });
    }

    const [stats] = await db
      .select({
        memberCount: sql`count(distinct ${clubMemberships.id})`,
        postCount: sql`count(distinct ${clubPosts.id})`,
      })
      .from(clubs)
      .leftJoin(clubMemberships, eq(clubs.id, clubMemberships.clubId))
      .leftJoin(clubPosts, eq(clubs.id, clubPosts.clubId))
      .where(eq(clubs.id, clubId))
      .groupBy(clubs.id);

    res.json({ club, stats });
  } catch (error) {
    console.error("Error fetching club details:", error);
    res.status(500).json({ message: "Failed to fetch club details" });
  }
});

// Create club
router.post("/", requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const { name, description, category, rules, isPublic } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({ message: "Club name is required" });
    }

    const [club] = await db
      .insert(clubs)
      .values({
        creatorId: userId,
        name: name.trim(),
        description: description || null,
        category: category || "general",
        rules: rules || null,
        isPublic: isPublic !== false,
      })
      .returning();

    await db.insert(clubMemberships).values({
      clubId: club.id,
      userId,
      role: "owner",
    });

    res.json({ club });
  } catch (error) {
    console.error("Error creating club:", error);
    res.status(500).json({ message: "Failed to create club" });
  }
});

// Join club
router.post("/:id/join", requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const clubId = req.params.id;

    const [club] = await db
      .select()
      .from(clubs)
      .where(eq(clubs.id, clubId))
      .limit(1);

    if (!club) {
      return res.status(404).json({ message: "Club not found" });
    }

    if (!club.isPublic) {
      return res.status(403).json({ message: "This club is private" });
    }

    const [existingMembership] = await db
      .select()
      .from(clubMemberships)
      .where(
        and(
          eq(clubMemberships.clubId, clubId),
          eq(clubMemberships.userId, userId)
        )
      )
      .limit(1);

    if (existingMembership) {
      return res.status(400).json({ message: "You are already a member" });
    }

    const [membership] = await db
      .insert(clubMemberships)
      .values({
        clubId,
        userId,
        role: "member",
      })
      .returning();

    res.json({ membership });
  } catch (error) {
    console.error("Error joining club:", error);
    res.status(500).json({ message: "Failed to join club" });
  }
});

// Leave club
router.post("/:id/leave", requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const clubId = req.params.id;

    const [membership] = await db
      .select()
      .from(clubMemberships)
      .where(
        and(
          eq(clubMemberships.clubId, clubId),
          eq(clubMemberships.userId, userId)
        )
      )
      .limit(1);

    if (!membership) {
      return res
        .status(404)
        .json({ message: "You are not a member of this club" });
    }

    if (membership.role === "owner") {
      return res.status(400).json({
        message: "Club owner cannot leave. Transfer ownership or delete the club.",
      });
    }

    await db
      .delete(clubMemberships)
      .where(
        and(
          eq(clubMemberships.clubId, clubId),
          eq(clubMemberships.userId, userId)
        )
      );

    res.json({ message: "Left club successfully" });
  } catch (error) {
    console.error("Error leaving club:", error);
    res.status(500).json({ message: "Failed to leave club" });
  }
});

// Get user's clubs
router.get("/my-clubs", requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;

    const userClubs = await db
      .select({
        club: clubs,
        membership: clubMemberships,
        memberCount: sql`count(distinct m.id)`,
      })
      .from(clubMemberships)
      .innerJoin(clubs, eq(clubMemberships.clubId, clubs.id))
      .leftJoin(clubMemberships.as("m"), eq(clubs.id, sql`m.club_id`))
      .where(eq(clubMemberships.userId, userId))
      .groupBy(clubs.id, clubMemberships.id)
      .orderBy(desc(clubMemberships.joinedAt));

    res.json({ clubs: userClubs });
  } catch (error) {
    console.error("Error fetching user clubs:", error);
    res.status(500).json({ message: "Failed to fetch clubs" });
  }
});

// ============================================================
// CLUB POSTS
// ============================================================

// Get club posts
router.get("/:id/posts", async (req: Request, res: Response) => {
  try {
    const clubId = req.params.id;
    const { limit = 20, offset = 0 } = req.query;

    const posts = await db
      .select({
        post: clubPosts,
        author: {
          id: users.id,
          username: users.username,
          displayName: users.displayName,
        },
        recipe: recipes,
      })
      .from(clubPosts)
      .innerJoin(users, eq(clubPosts.userId, users.id))
      .leftJoin(recipes, eq(clubPosts.recipeId, recipes.id))
      .where(eq(clubPosts.clubId, clubId))
      .orderBy(desc(clubPosts.createdAt))
      .limit(parseInt(limit as string))
      .offset(parseInt(offset as string));

    const normalized = posts.map((row: any) => ({
      ...row,
      recipe: row.recipe && row.recipe.id ? row.recipe : null,
    }));

    res.json({ posts: normalized });
  } catch (error) {
    console.error("Error fetching club posts:", error);
    res.status(500).json({ message: "Failed to fetch club posts" });
  }
});

// Create club post (supports post / recipe / review templates)
router.post("/:id/posts", requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const clubId = req.params.id;

    const { postType, content, imageUrl, recipeId, recipe } = req.body as {
      postType?: "post" | "recipe" | "review";
      content?: string;
      imageUrl?: string | null;
      recipeId?: string | null;
      recipe?: {
        title: string;
        imageUrl?: string | null;
        ingredients: string[];
        instructions: string[];
        cookTime?: number | null;
        servings?: number | null;
        difficulty?: string | null;
      };
    };

    if (!content || !content.trim()) {
      return res.status(400).json({ message: "Post content is required" });
    }

    const [membership] = await db
      .select()
      .from(clubMemberships)
      .where(
        and(
          eq(clubMemberships.clubId, clubId),
          eq(clubMemberships.userId, userId)
        )
      )
      .limit(1);

    if (!membership) {
      return res.status(403).json({ message: "You must be a member to post" });
    }

    // If this is a recipe template post, create a recipe record and link it.
    let linkedRecipeId: string | null = recipeId || null;

    const isRecipeTemplate =
      postType === "recipe" ||
      (!!recipe &&
        typeof recipe.title === "string" &&
        Array.isArray(recipe.ingredients) &&
        Array.isArray(recipe.instructions));

    if (!linkedRecipeId && isRecipeTemplate && recipe) {
      const [createdRecipe] = await db
        .insert(recipes)
        .values({
          postId: null, // club recipes are not linked to a social post row
          title: recipe.title,
          imageUrl: recipe.imageUrl ?? null,
          ingredients: recipe.ingredients,
          instructions: recipe.instructions,
          cookTime: recipe.cookTime ?? null,
          servings: recipe.servings ?? null,
          difficulty: recipe.difficulty ?? null,
        } as any)
        .returning();

      linkedRecipeId = createdRecipe?.id ?? null;
    }

    const [post] = await db
      .insert(clubPosts)
      .values({
        clubId,
        userId,
        content: content.trim(),
        imageUrl: imageUrl ?? null,
        recipeId: linkedRecipeId,
      })
      .returning();

    res.json({ post });
  } catch (error) {
    console.error("Error creating club post:", error);
    res.status(500).json({ message: "Failed to create post" });
  }
});

// Update club post
router.patch("/:id/posts/:postId", requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const clubId = req.params.id;
    const postId = req.params.postId;
    const { content } = req.body;

    if (!content || !content.trim()) {
      return res.status(400).json({ message: "Post content is required" });
    }

    const [existingPost] = await db
      .select()
      .from(clubPosts)
      .where(and(eq(clubPosts.id, postId), eq(clubPosts.clubId, clubId)))
      .limit(1);

    if (!existingPost) {
      return res.status(404).json({ message: "Post not found" });
    }

    if (existingPost.userId !== userId) {
      return res.status(403).json({ message: "You can only edit your own posts" });
    }

    const [post] = await db
      .update(clubPosts)
      .set({ content: content.trim() })
      .where(and(eq(clubPosts.id, postId), eq(clubPosts.clubId, clubId)))
      .returning();

    return res.json({ post });
  } catch (error) {
    console.error("Error updating post:", error);
    return res.status(500).json({ message: "Failed to update post" });
  }
});

// ============================================================
// CHALLENGES
// ============================================================

// Browse challenges
router.get("/challenges", async (req: Request, res: Response) => {
  try {
    const { status } = req.query;

    const allChallenges = await db
      .select({
        challenge: challenges,
        participantCount: sql`count(distinct ${challengeProgress.userId})`,
      })
      .from(challenges)
      .leftJoin(challengeProgress, eq(challenges.id, challengeProgress.challengeId))
      .groupBy(challenges.id)
      .orderBy(desc(challenges.startDate))
      .$dynamic();

    let filtered = await allChallenges;

    if (status) {
      const now = new Date();
      filtered = filtered.filter((c) => {
        const start = new Date(c.challenge.startDate);
        const end = new Date(c.challenge.endDate);
        if (status === "active") return start <= now && end >= now;
        if (status === "upcoming") return start > now;
        if (status === "completed") return end < now;
        return true;
      });
    }

    res.json({ challenges: filtered });
  } catch (error) {
    console.error("Error browsing challenges:", error);
    res.status(500).json({ message: "Failed to browse challenges" });
  }
});

// Get challenge details
router.get("/challenges/:id", async (req: Request, res: Response) => {
  try {
    const challengeId = req.params.id;

    const [challenge] = await db
      .select()
      .from(challenges)
      .where(eq(challenges.id, challengeId))
      .limit(1);

    if (!challenge) {
      return res.status(404).json({ message: "Challenge not found" });
    }

    const [stats] = await db
      .select({
        participantCount: sql`count(distinct ${challengeProgress.userId})`,
        completedCount: sql`count(*) filter (where ${challengeProgress.isCompleted} = true)`,
      })
      .from(challengeProgress)
      .where(eq(challengeProgress.challengeId, challengeId));

    res.json({ challenge, stats });
  } catch (error) {
    console.error("Error fetching challenge details:", error);
    res.status(500).json({ message: "Failed to fetch challenge details" });
  }
});

// Join challenge
router.post("/challenges/:id/join", requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const challengeId = req.params.id;

    const [challenge] = await db
      .select()
      .from(challenges)
      .where(eq(challenges.id, challengeId))
      .limit(1);

    if (!challenge) {
      return res.status(404).json({ message: "Challenge not found" });
    }

    const [existingProgress] = await db
      .select()
      .from(challengeProgress)
      .where(and(eq(challengeProgress.challengeId, challengeId), eq(challengeProgress.userId, userId)))
      .limit(1);

    if (existingProgress) {
      return res.status(400).json({ message: "You are already participating in this challenge" });
    }

    const [progress] = await db
      .insert(challengeProgress)
      .values({
        challengeId,
        userId,
        currentProgress: 0,
        currentStreak: 0,
        completedSteps: [],
        isCompleted: false,
      })
      .returning();

    res.json({ progress });
  } catch (error) {
    console.error("Error joining challenge:", error);
    res.status(500).json({ message: "Failed to join challenge" });
  }
});

// Update challenge progress
router.post("/challenges/:id/progress", requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const challengeId = req.params.id;
    const { step, recipeId } = req.body;

    const [progress] = await db
      .select()
      .from(challengeProgress)
      .where(and(eq(challengeProgress.challengeId, challengeId), eq(challengeProgress.userId, userId)))
      .limit(1);

    if (!progress) {
      return res.status(404).json({ message: "You are not participating in this challenge" });
    }

    const completedSteps = progress.completedSteps || [];
    completedSteps.push({
      step,
      completedAt: new Date().toISOString(),
      recipeId: recipeId || null,
    });

    const newProgress = progress.currentProgress + 1;

    const [challenge] = await db
      .select()
      .from(challenges)
      .where(eq(challenges.id, challengeId))
      .limit(1);

    const requirements = challenge?.requirements || [];
    const totalRequired = requirements.reduce((sum: number, req: any) => sum + (req.target || 1), 0);
    const isCompleted = newProgress >= totalRequired;

    const [updated] = await db
      .update(challengeProgress)
      .set({
        currentProgress: newProgress,
        completedSteps,
        isCompleted,
        completedAt: isCompleted ? new Date().toISOString() : null,
      })
      .where(eq(challengeProgress.id, progress.id))
      .returning();

    if (isCompleted && challenge?.rewards) {
      for (const reward of challenge.rewards as any[]) {
        if (reward.type === "badge") {
          await db
            .insert(userBadges)
            .values({
              userId,
              badgeId: reward.value,
            })
            .onConflictDoNothing();
        }
      }
    }

    res.json({ progress: updated, isCompleted });
  } catch (error) {
    console.error("Error updating challenge progress:", error);
    res.status(500).json({ message: "Failed to update progress" });
  }
});

export default router;
