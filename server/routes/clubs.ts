// server/routes/clubs.ts
import express, { type Request, type Response } from "express";
import { db } from "../db/index.js";
import { eq, and, desc, sql, inArray } from "drizzle-orm";
import {
  clubs,
  clubMemberships,
  clubPosts,
  clubJoinRequests,
  clubPostLikes,
  challenges,
  challengeProgress,
  badges,
  userBadges,
  users,
} from "../../shared/schema.js";
import { requireAuth } from "../middleware/index";
import {
  sendClubJoinRequestNotification,
  sendClubJoinApprovedNotification,
  sendClubMemberJoinedNotification,
  sendClubPostLikeNotification,
} from "../services/notification-service";

const router = express.Router();

// ============================================================
// CLUBS MANAGEMENT
// ============================================================

// IMPORTANT: keep static routes ABOVE "/:id" so Express doesn't treat "my-clubs", "challenges", "badges", etc as a club id.

// Get user's clubs (membership list)
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

// Browse public clubs
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
      filtered = filtered.filter((c: any) => c.club.category === category);
    }

    if (search) {
      const searchLower = String(search).toLowerCase();
      filtered = filtered.filter((c: any) =>
        c.club.name.toLowerCase().includes(searchLower) ||
        c.club.description?.toLowerCase().includes(searchLower)
      );
    }

    if (sort === "members") {
      filtered.sort((a: any, b: any) => Number(b.memberCount) - Number(a.memberCount));
    } else if (sort === "activity") {
      filtered.sort((a: any, b: any) => Number(b.postCount) - Number(a.postCount));
    } else {
      filtered.sort((a: any, b: any) => new Date(b.club.createdAt).getTime() - new Date(a.club.createdAt).getTime());
    }

    res.json({ clubs: filtered });
  } catch (error) {
    console.error("Error browsing clubs:", error);
    res.status(500).json({ message: "Failed to browse clubs" });
  }
});

// Create club
router.post("/", requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const { name, description, category, rules, isPublic } = req.body;

    if (!name || !String(name).trim()) {
      return res.status(400).json({ message: "Club name is required" });
    }

    const [club] = await db
      .insert(clubs)
      .values({
        creatorId: userId,
        name: String(name).trim(),
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

// Join club (public = instant join; private = create join request)
router.post("/:id/join", requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const clubId = req.params.id;

    const [club] = await db.select().from(clubs).where(eq(clubs.id, clubId)).limit(1);
    if (!club) return res.status(404).json({ message: "Club not found" });

    const [existingMembership] = await db
      .select()
      .from(clubMemberships)
      .where(and(eq(clubMemberships.clubId, clubId), eq(clubMemberships.userId, userId)))
      .limit(1);

    if (existingMembership) {
      return res.status(400).json({ message: "You are already a member" });
    }

    // Private club → create join request
    if (!club.isPublic) {
      const [existingReq] = await db
        .select()
        .from(clubJoinRequests)
        .where(and(eq(clubJoinRequests.clubId, clubId), eq(clubJoinRequests.userId, userId)))
        .limit(1);

      if (existingReq && existingReq.status === "pending") {
        return res.status(400).json({ message: "Join request already pending" });
      }

      // Upsert behavior: if declined/approved previously, create a new request row
      const [requester] = await db
        .select({
          username: users.username,
          displayName: users.displayName,
          avatar: users.avatar,
        })
        .from(users)
        .where(eq(users.id, userId))
        .limit(1);

      const requesterName = requester?.displayName || requester?.username || "Someone";

      const [joinRequest] = await db
        .insert(clubJoinRequests)
        .values({
          clubId,
          userId,
          status: "pending",
        })
        .returning();

      await sendClubJoinRequestNotification(
        club.creatorId,
        userId,
        requesterName,
        requester?.avatar || null,
        clubId,
        club.name
      );

      return res.json({ status: "pending", joinRequest });
    }

    // Public club → join immediately
    const [membership] = await db
      .insert(clubMemberships)
      .values({
        clubId,
        userId,
        role: "member",
      })
      .returning();

    const [member] = await db
      .select({
        username: users.username,
        displayName: users.displayName,
        avatar: users.avatar,
      })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    const memberName = member?.displayName || member?.username || "Someone";
    await sendClubMemberJoinedNotification(club.creatorId, userId, memberName, member?.avatar || null, clubId, club.name);

    return res.json({ membership, status: "joined" });
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
      .where(and(eq(clubMemberships.clubId, clubId), eq(clubMemberships.userId, userId)))
      .limit(1);

    if (!membership) {
      return res.status(404).json({ message: "You are not a member of this club" });
    }

    if (membership.role === "owner") {
      return res.status(400).json({ message: "Club owner cannot leave. Transfer ownership or delete the club." });
    }

    await db.delete(clubMemberships).where(and(eq(clubMemberships.clubId, clubId), eq(clubMemberships.userId, userId)));

    res.json({ message: "Left club successfully" });
  } catch (error) {
    console.error("Error leaving club:", error);
    res.status(500).json({ message: "Failed to leave club" });
  }
});

// Current user's join request status (for private clubs)
router.get("/:id/my-join-request", requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const clubId = req.params.id;

    const [reqRow] = await db
      .select()
      .from(clubJoinRequests)
      .where(and(eq(clubJoinRequests.clubId, clubId), eq(clubJoinRequests.userId, userId)))
      .orderBy(desc(clubJoinRequests.createdAt))
      .limit(1);

    res.json({ request: reqRow || null });
  } catch (error) {
    console.error("Error fetching join request:", error);
    res.status(500).json({ message: "Failed to fetch join request" });
  }
});

// Owner: list pending join requests
router.get("/:id/join-requests", requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const clubId = req.params.id;

    const [club] = await db.select().from(clubs).where(eq(clubs.id, clubId)).limit(1);
    if (!club) return res.status(404).json({ message: "Club not found" });

    if (club.creatorId !== userId) {
      return res.status(403).json({ message: "Only the club owner can view join requests" });
    }

    const requests = await db
      .select({
        request: clubJoinRequests,
        requester: {
          id: users.id,
          username: users.username,
          displayName: users.displayName,
          avatar: users.avatar,
        },
      })
      .from(clubJoinRequests)
      .innerJoin(users, eq(clubJoinRequests.userId, users.id))
      .where(and(eq(clubJoinRequests.clubId, clubId), eq(clubJoinRequests.status, "pending")))
      .orderBy(desc(clubJoinRequests.createdAt));

    res.json({ requests });
  } catch (error) {
    console.error("Error fetching join requests:", error);
    res.status(500).json({ message: "Failed to fetch join requests" });
  }
});

// Owner: approve join request
router.post("/:id/join-requests/:requestId/approve", requireAuth, async (req: Request, res: Response) => {
  try {
    const ownerId = req.user!.id;
    const clubId = req.params.id;
    const requestId = req.params.requestId;

    const [club] = await db.select().from(clubs).where(eq(clubs.id, clubId)).limit(1);
    if (!club) return res.status(404).json({ message: "Club not found" });
    if (club.creatorId !== ownerId) return res.status(403).json({ message: "Only the club owner can approve requests" });

    const [jr] = await db
      .select()
      .from(clubJoinRequests)
      .where(and(eq(clubJoinRequests.id, requestId), eq(clubJoinRequests.clubId, clubId)))
      .limit(1);

    if (!jr) return res.status(404).json({ message: "Join request not found" });
    if (jr.status !== "pending") return res.status(400).json({ message: "This request is not pending" });

    // Create membership if missing
    const [existingMembership] = await db
      .select()
      .from(clubMemberships)
      .where(and(eq(clubMemberships.clubId, clubId), eq(clubMemberships.userId, jr.userId)))
      .limit(1);

    if (!existingMembership) {
      await db.insert(clubMemberships).values({
        clubId,
        userId: jr.userId,
        role: "member",
      });
    }

    const [updated] = await db
      .update(clubJoinRequests)
      .set({ status: "approved" })
      .where(eq(clubJoinRequests.id, requestId))
      .returning();

    const [member] = await db
      .select({
        username: users.username,
        displayName: users.displayName,
        avatar: users.avatar,
      })
      .from(users)
      .where(eq(users.id, jr.userId))
      .limit(1);

    const memberName = member?.displayName || member?.username || "Someone";

    await sendClubJoinApprovedNotification(jr.userId, clubId, club.name);
    await sendClubMemberJoinedNotification(ownerId, jr.userId, memberName, member?.avatar || null, clubId, club.name);

    res.json({ request: updated });
  } catch (error) {
    console.error("Error approving join request:", error);
    res.status(500).json({ message: "Failed to approve join request" });
  }
});

// Owner: decline join request
router.post("/:id/join-requests/:requestId/decline", requireAuth, async (req: Request, res: Response) => {
  try {
    const ownerId = req.user!.id;
    const clubId = req.params.id;
    const requestId = req.params.requestId;

    const [club] = await db.select().from(clubs).where(eq(clubs.id, clubId)).limit(1);
    if (!club) return res.status(404).json({ message: "Club not found" });
    if (club.creatorId !== ownerId) return res.status(403).json({ message: "Only the club owner can decline requests" });

    const [jr] = await db
      .select()
      .from(clubJoinRequests)
      .where(and(eq(clubJoinRequests.id, requestId), eq(clubJoinRequests.clubId, clubId)))
      .limit(1);

    if (!jr) return res.status(404).json({ message: "Join request not found" });
    if (jr.status !== "pending") return res.status(400).json({ message: "This request is not pending" });

    const [updated] = await db
      .update(clubJoinRequests)
      .set({ status: "declined" })
      .where(eq(clubJoinRequests.id, requestId))
      .returning();

    res.json({ request: updated });
  } catch (error) {
    console.error("Error declining join request:", error);
    res.status(500).json({ message: "Failed to decline join request" });
  }
});

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
      })
      .from(clubPosts)
      .innerJoin(users, eq(clubPosts.userId, users.id))
      .where(eq(clubPosts.clubId, clubId))
      .orderBy(desc(clubPosts.createdAt))
      .limit(parseInt(limit as string))
      .offset(parseInt(offset as string));

    // If requester is authenticated, add likedByMe flags
    const userId = (req as any).user?.id as string | undefined;
    if (userId && posts.length) {
      const postIds = posts.map((p: any) => p.post.id);
      const likedRows = await db
        .select({ postId: clubPostLikes.postId })
        .from(clubPostLikes)
        .where(and(eq(clubPostLikes.userId, userId), inArray(clubPostLikes.postId, postIds)));

      const likedSet = new Set(likedRows.map((r: any) => r.postId));
      const enriched = posts.map((p: any) => ({ ...p, likedByMe: likedSet.has(p.post.id) }));
      return res.json({ posts: enriched });
    }

    res.json({ posts });
  } catch (error) {
    console.error("Error fetching club posts:", error);
    res.status(500).json({ message: "Failed to fetch posts" });
  }
});

// Create club post
router.post("/:id/posts", requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const clubId = req.params.id;
    const { content, recipeId } = req.body;

    if (!content || !String(content).trim()) {
      return res.status(400).json({ message: "Post content is required" });
    }

    const [membership] = await db
      .select()
      .from(clubMemberships)
      .where(and(eq(clubMemberships.clubId, clubId), eq(clubMemberships.userId, userId)))
      .limit(1);

    if (!membership) {
      return res.status(403).json({ message: "You must be a member to post" });
    }

    const [post] = await db
      .insert(clubPosts)
      .values({
        clubId,
        userId,
        content: String(content).trim(),
        recipeId: recipeId || null,
      })
      .returning();

    res.json({ post });
  } catch (error) {
    console.error("Error creating post:", error);
    res.status(500).json({ message: "Failed to create post" });
  }
});

// Update club post (author only)
router.patch("/:id/posts/:postId", requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const clubId = req.params.id;
    const postId = req.params.postId;
    const { content } = req.body;

    if (!content || !String(content).trim()) {
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
      .set({ content: String(content).trim() })
      .where(and(eq(clubPosts.id, postId), eq(clubPosts.clubId, clubId)))
      .returning();

    return res.json({ post });
  } catch (error) {
    console.error("Error updating post:", error);
    return res.status(500).json({ message: "Failed to update post" });
  }
});

// Delete club post (author OR club owner)
router.delete("/:id/posts/:postId", requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const clubId = req.params.id;
    const postId = req.params.postId;

    const [club] = await db.select().from(clubs).where(eq(clubs.id, clubId)).limit(1);
    if (!club) return res.status(404).json({ message: "Club not found" });

    const [existingPost] = await db
      .select()
      .from(clubPosts)
      .where(and(eq(clubPosts.id, postId), eq(clubPosts.clubId, clubId)))
      .limit(1);

    if (!existingPost) return res.status(404).json({ message: "Post not found" });

    const isOwner = club.creatorId === userId;
    const isAuthor = existingPost.userId === userId;

    if (!isOwner && !isAuthor) {
      return res.status(403).json({ message: "You don't have permission to delete this post" });
    }

    await db.delete(clubPosts).where(eq(clubPosts.id, postId));
    // Clean up likes
    await db.delete(clubPostLikes).where(eq(clubPostLikes.postId, postId));
    res.json({ message: "Post deleted" });
  } catch (error) {
    console.error("Error deleting post:", error);
    res.status(500).json({ message: "Failed to delete post" });
  }
});

// Like/unlike club post (member only; toggles)
router.post("/:id/posts/:postId/like", requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const clubId = req.params.id;
    const postId = req.params.postId;

    const [membership] = await db
      .select()
      .from(clubMemberships)
      .where(and(eq(clubMemberships.clubId, clubId), eq(clubMemberships.userId, userId)))
      .limit(1);

    if (!membership) {
      return res.status(403).json({ message: "You must be a member to like posts" });
    }

    const [postRow] = await db
      .select()
      .from(clubPosts)
      .where(and(eq(clubPosts.id, postId), eq(clubPosts.clubId, clubId)))
      .limit(1);

    if (!postRow) return res.status(404).json({ message: "Post not found" });

    const [existing] = await db
      .select()
      .from(clubPostLikes)
      .where(and(eq(clubPostLikes.postId, postId), eq(clubPostLikes.userId, userId)))
      .limit(1);

    if (existing) {
      await db.delete(clubPostLikes).where(eq(clubPostLikes.id, existing.id));
      const newCount = Math.max(0, Number(postRow.likesCount || 0) - 1);
      await db.update(clubPosts).set({ likesCount: newCount }).where(eq(clubPosts.id, postId));
      return res.json({ liked: false, likesCount: newCount });
    }

    await db.insert(clubPostLikes).values({
      clubId,
      postId,
      userId,
    });

    const newCount = Number(postRow.likesCount || 0) + 1;
    await db.update(clubPosts).set({ likesCount: newCount }).where(eq(clubPosts.id, postId));

    const [liker] = await db
      .select({
        username: users.username,
        displayName: users.displayName,
        avatar: users.avatar,
      })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    const likerName = liker?.displayName || liker?.username || "Someone";
    await sendClubPostLikeNotification(postRow.userId, userId, likerName, liker?.avatar || null, clubId, postId);

    return res.json({ liked: true, likesCount: newCount });
  } catch (error) {
    console.error("Error liking club post:", error);
    res.status(500).json({ message: "Failed to like post" });
  }
});

// ============================================================
// CHALLENGES
// ============================================================

// Browse challenges
router.get("/challenges", async (req: Request, res: Response) => {
  try {
    const { status, category } = req.query;

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
      filtered = filtered.filter(c => {
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

    const [challenge] = await db.select().from(challenges).where(eq(challenges.id, challengeId)).limit(1);
    const requirements = challenge?.requirements || [];
    const totalRequired = requirements.reduce((sum, req: any) => sum + (req.target || 1), 0);
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
          await db.insert(userBadges).values({
            userId,
            badgeId: reward.value,
          }).onConflictDoNothing();
        }
      }
    }

    res.json({ progress: updated });
  } catch (error) {
    console.error("Error updating challenge progress:", error);
    res.status(500).json({ message: "Failed to update progress" });
  }
});

// Get user's challenge progress
router.get("/my-challenges", requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;

    const userChallenges = await db
      .select({
        challenge: challenges,
        progress: challengeProgress,
      })
      .from(challengeProgress)
      .innerJoin(challenges, eq(challengeProgress.challengeId, challenges.id))
      .where(eq(challengeProgress.userId, userId))
      .orderBy(desc(challengeProgress.startedAt));

    res.json({ challenges: userChallenges });
  } catch (error) {
    console.error("Error fetching user challenges:", error);
    res.status(500).json({ message: "Failed to fetch challenges" });
  }
});

// ============================================================
// BADGES
// ============================================================

// Get all badges
router.get("/badges", async (_req: Request, res: Response) => {
  try {
    const allBadges = await db
      .select()
      .from(badges)
      .orderBy(badges.tier, badges.name);

    res.json({ badges: allBadges });
  } catch (error) {
    console.error("Error fetching badges:", error);
    res.status(500).json({ message: "Failed to fetch badges" });
  }
});

// Get user's badges
router.get("/my-badges", requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;

    const userBadgesList = await db
      .select({
        userBadge: userBadges,
        badge: badges,
      })
      .from(userBadges)
      .innerJoin(badges, eq(userBadges.badgeId, badges.id))
      .where(eq(userBadges.userId, userId))
      .orderBy(desc(userBadges.earnedAt));

    res.json({ badges: userBadgesList });
  } catch (error) {
    console.error("Error fetching user badges:", error);
    res.status(500).json({ message: "Failed to fetch badges" });
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


export default router;
