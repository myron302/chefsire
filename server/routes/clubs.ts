// server/routes/clubs.ts
import express, { type Request, type Response } from "express";
import { db } from "../db/index.js";
import { eq, and, desc, sql, inArray } from "drizzle-orm";
import {
  clubs,
  clubMemberships,
  clubPosts,
  clubPostLikes,
  clubJoinRequests,
  challenges,
  challengeProgress,
  badges,
  userBadges,
  users
} from "../../shared/schema.js";
import { requireAuth, optionalAuth } from "../middleware/index";

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
      filtered = filtered.filter(c => c.club.category === category);
    }

    if (search) {
      const searchLower = (search as string).toLowerCase();
      filtered = filtered.filter(c =>
        c.club.name.toLowerCase().includes(searchLower) ||
        c.club.description?.toLowerCase().includes(searchLower)
      );
    }

    if (sort === "members") {
      filtered.sort((a, b) => b.memberCount - a.memberCount);
    } else if (sort === "activity") {
      filtered.sort((a, b) => b.postCount - a.postCount);
    } else {
      filtered.sort((a, b) => new Date(b.club.createdAt).getTime() - new Date(a.club.createdAt).getTime());
    }

    res.json({ clubs: filtered });
  } catch (error) {
    console.error("Error browsing clubs:", error);
    res.status(500).json({ message: "Failed to browse clubs" });
  }
});


// Get user's clubs (must be before /:id route)
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

// Delete club (owner only)
router.delete("/:id", requireAuth, async (req: Request, res: Response) => {
  try {
    const clubId = req.params.id;
    const userId = req.user!.id;

    const [club] = await db.select().from(clubs).where(eq(clubs.id, clubId)).limit(1);
    if (!club) return res.status(404).json({ message: "Club not found" });

    if (club.creatorId !== userId) {
      return res.status(403).json({ message: "Only the club owner can delete this club" });
    }

    await db.delete(clubs).where(eq(clubs.id, clubId));

    res.json({ ok: true });
  } catch (error) {
    console.error("Error deleting club:", error);
    res.status(500).json({ message: "Failed to delete club" });
  }
});



// Join club (public = immediate join, private = join request)
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

    // Private clubs: create a join request instead of joining immediately
    if (!club.isPublic) {
      const [existingRequest] = await db
        .select()
        .from(clubJoinRequests)
        .where(and(eq(clubJoinRequests.clubId, clubId), eq(clubJoinRequests.userId, userId), eq(clubJoinRequests.status, "pending")))
        .limit(1);

      if (existingRequest) {
        return res.json({ status: "pending", request: existingRequest });
      }

      const [request] = await db
        .insert(clubJoinRequests)
        .values({ clubId, userId, status: "pending" })
        .returning();

      // Notify owner about join request
      const [requester] = await db
        .select({ displayName: users.displayName, username: users.username, avatarUrl: users.avatarUrl })
        .from(users)
        .where(eq(users.id, userId))
        .limit(1);

      await sendClubJoinRequestNotification(
        club.creatorId,
        requester?.displayName || requester?.username || "Someone",
        requester?.avatarUrl || null,
        clubId,
        club.name
      );

      return res.json({ status: "pending", request });
    }

    // Public clubs: join immediately
    const [membership] = await db
      .insert(clubMemberships)
      .values({ clubId, userId, role: "member" })
      .returning();

    const [memberUser] = await db
      .select({ displayName: users.displayName, username: users.username, avatarUrl: users.avatarUrl })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    await sendClubNewMemberNotification(
      club.creatorId,
      memberUser?.displayName || memberUser?.username || "Someone",
      memberUser?.avatarUrl || null,
      clubId,
      club.name
    );

    res.json({ status: "joined", membership });
  } catch (error) {
    console.error("Error joining club:", error);
    res.status(500).json({ message: "Failed to join club" });
  }
});





// Membership/join status for current user (member | pending | none)
router.get("/:id/join-status", requireAuth, async (req: Request, res: Response) => {
  try {
    const clubId = req.params.id;
    const userId = req.user!.id;

    const [membership] = await db
      .select()
      .from(clubMemberships)
      .where(and(eq(clubMemberships.clubId, clubId), eq(clubMemberships.userId, userId)))
      .limit(1);

    if (membership) {
      return res.json({ status: "member" });
    }

    const [pending] = await db
      .select()
      .from(clubJoinRequests)
      .where(and(eq(clubJoinRequests.clubId, clubId), eq(clubJoinRequests.userId, userId), eq(clubJoinRequests.status, "pending")))
      .limit(1);

    if (pending) {
      return res.json({ status: "pending" });
    }

    return res.json({ status: "none" });
  } catch (error) {
    console.error("Error fetching join status:", error);
    res.status(500).json({ message: "Failed to fetch join status" });
  }
});


// Owner: list join requests
router.get("/:id/join-requests", requireAuth, async (req: Request, res: Response) => {
  try {
    const clubId = req.params.id;
    const userId = req.user!.id;

    const [club] = await db.select().from(clubs).where(eq(clubs.id, clubId)).limit(1);
    if (!club) return res.status(404).json({ message: "Club not found" });
    if (club.creatorId !== userId) return res.status(403).json({ message: "Only the club owner can view join requests" });

    const requests = await db
      .select({
        request: clubJoinRequests,
        user: {
          id: users.id,
          username: users.username,
          displayName: users.displayName,
          avatarUrl: users.avatarUrl,
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
    const clubId = req.params.id;
    const requestId = req.params.requestId;
    const ownerId = req.user!.id;

    const [club] = await db.select().from(clubs).where(eq(clubs.id, clubId)).limit(1);
    if (!club) return res.status(404).json({ message: "Club not found" });
    if (club.creatorId !== ownerId) return res.status(403).json({ message: "Only the club owner can approve requests" });

    const [request] = await db
      .select()
      .from(clubJoinRequests)
      .where(and(eq(clubJoinRequests.id, requestId), eq(clubJoinRequests.clubId, clubId)))
      .limit(1);

    if (!request || request.status !== "pending") {
      return res.status(404).json({ message: "Join request not found" });
    }

    // Create membership if it doesn't already exist
    const [existingMembership] = await db
      .select()
      .from(clubMemberships)
      .where(and(eq(clubMemberships.clubId, clubId), eq(clubMemberships.userId, request.userId)))
      .limit(1);

    const membership = existingMembership
      ? existingMembership
      : (
          await db
            .insert(clubMemberships)
            .values({ clubId, userId: request.userId, role: "member" })
            .returning()
        )[0];

    await db
      .update(clubJoinRequests)
      .set({ status: "approved", decidedAt: new Date(), decidedBy: ownerId })
      .where(eq(clubJoinRequests.id, requestId));

    await sendClubJoinApprovedNotification(request.userId, clubId, club.name);

    const [memberUser] = await db
      .select({ displayName: users.displayName, username: users.username, avatarUrl: users.avatarUrl })
      .from(users)
      .where(eq(users.id, request.userId))
      .limit(1);

    await sendClubNewMemberNotification(
      club.creatorId,
      memberUser?.displayName || memberUser?.username || "Someone",
      memberUser?.avatarUrl || null,
      clubId,
      club.name
    );

    res.json({ membership });
  } catch (error) {
    console.error("Error approving join request:", error);
    res.status(500).json({ message: "Failed to approve request" });
  }
});

// Owner: decline join request
router.post("/:id/join-requests/:requestId/decline", requireAuth, async (req: Request, res: Response) => {
  try {
    const clubId = req.params.id;
    const requestId = req.params.requestId;
    const ownerId = req.user!.id;

    const [club] = await db.select().from(clubs).where(eq(clubs.id, clubId)).limit(1);
    if (!club) return res.status(404).json({ message: "Club not found" });
    if (club.creatorId !== ownerId) return res.status(403).json({ message: "Only the club owner can decline requests" });

    const [request] = await db
      .select()
      .from(clubJoinRequests)
      .where(and(eq(clubJoinRequests.id, requestId), eq(clubJoinRequests.clubId, clubId)))
      .limit(1);

    if (!request || request.status !== "pending") {
      return res.status(404).json({ message: "Join request not found" });
    }

    await db
      .update(clubJoinRequests)
      .set({ status: "declined", decidedAt: new Date(), decidedBy: ownerId })
      .where(eq(clubJoinRequests.id, requestId));

    res.json({ ok: true });
  } catch (error) {
    console.error("Error declining join request:", error);
    res.status(500).json({ message: "Failed to decline request" });
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

    await db
      .delete(clubMemberships)
      .where(and(eq(clubMemberships.clubId, clubId), eq(clubMemberships.userId, userId)));

    res.json({ message: "Left club successfully" });
  } catch (error) {
    console.error("Error leaving club:", error);
    res.status(500).json({ message: "Failed to leave club" });
  }
});

// Get user's clubs

// Get club posts
router.get("/:id/posts", optionalAuth, async (req: Request, res: Response) => {
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
          avatarUrl: users.avatarUrl,
        },
      })
      .from(clubPosts)
      .innerJoin(users, eq(clubPosts.userId, users.id))
      .where(eq(clubPosts.clubId, clubId))
      .orderBy(desc(clubPosts.createdAt))
      .limit(parseInt(limit as string, 10))
      .offset(parseInt(offset as string, 10));

    const me = req.user?.id;
    if (!me || posts.length === 0) {
      return res.json({
        posts: posts.map((p) => ({ ...p, likedByMe: false })),
      });
    }

    const postIds = posts.map((p) => p.post.id);
    const liked = await db
      .select({ clubPostId: clubPostLikes.clubPostId })
      .from(clubPostLikes)
      .where(and(eq(clubPostLikes.userId, me), inArray(clubPostLikes.clubPostId, postIds)));

    const likedSet = new Set(liked.map((l) => l.clubPostId));

    res.json({
      posts: posts.map((p) => ({ ...p, likedByMe: likedSet.has(p.post.id) })),
    });
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

    if (!content || !content.trim()) {
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
        content: content.trim(),
        recipeId: recipeId || null,
      })
      .returning();

    res.json({ post });
  } catch (error) {
    console.error("Error creating post:", error);
    res.status(500).json({ message: "Failed to create post" });
  }
});

// Edit club post (author or owner)
router.patch("/:id/posts/:postId", requireAuth, async (req: Request, res: Response) => {
  try {
    const clubId = req.params.id;
    const postId = req.params.postId;
    const userId = req.user!.id;
    const { content } = req.body;

    if (!content || !content.trim()) {
      return res.status(400).json({ message: "Post content is required" });
    }

    const [club] = await db.select().from(clubs).where(eq(clubs.id, clubId)).limit(1);
    if (!club) return res.status(404).json({ message: "Club not found" });

    const [post] = await db.select().from(clubPosts).where(and(eq(clubPosts.id, postId), eq(clubPosts.clubId, clubId))).limit(1);
    if (!post) return res.status(404).json({ message: "Post not found" });

    // Author OR club owner can edit
    if (post.userId !== userId && club.creatorId !== userId) {
      return res.status(403).json({ message: "Not allowed to edit this post" });
    }

    const [updated] = await db
      .update(clubPosts)
      .set({ content: content.trim() })
      .where(eq(clubPosts.id, postId))
      .returning();

    res.json({ post: updated });
  } catch (error) {
    console.error("Error editing club post:", error);
    res.status(500).json({ message: "Failed to edit post" });
  }
});

// Delete club post (author or owner)
router.delete("/:id/posts/:postId", requireAuth, async (req: Request, res: Response) => {
  try {
    const clubId = req.params.id;
    const postId = req.params.postId;
    const userId = req.user!.id;

    const [club] = await db.select().from(clubs).where(eq(clubs.id, clubId)).limit(1);
    if (!club) return res.status(404).json({ message: "Club not found" });

    const [post] = await db.select().from(clubPosts).where(and(eq(clubPosts.id, postId), eq(clubPosts.clubId, clubId))).limit(1);
    if (!post) return res.status(404).json({ message: "Post not found" });

    // Author OR club owner can delete
    if (post.userId !== userId && club.creatorId !== userId) {
      return res.status(403).json({ message: "Not allowed to delete this post" });
    }

    await db.delete(clubPosts).where(eq(clubPosts.id, postId));

    res.json({ ok: true });
  } catch (error) {
    console.error("Error deleting club post:", error);
    res.status(500).json({ message: "Failed to delete post" });
  }
});

// Like/unlike a club post (toggle)
router.post("/:id/posts/:postId/like", requireAuth, async (req: Request, res: Response) => {
  try {
    const clubId = req.params.id;
    const postId = req.params.postId;
    const userId = req.user!.id;

    const [post] = await db
      .select()
      .from(clubPosts)
      .where(and(eq(clubPosts.id, postId), eq(clubPosts.clubId, clubId)))
      .limit(1);

    if (!post) return res.status(404).json({ message: "Post not found" });

    const [existing] = await db
      .select()
      .from(clubPostLikes)
      .where(and(eq(clubPostLikes.clubPostId, postId), eq(clubPostLikes.userId, userId)))
      .limit(1);

    if (existing) {
      await db.delete(clubPostLikes).where(eq(clubPostLikes.id, existing.id));
      await db.update(clubPosts).set({ likesCount: sql`${clubPosts.likesCount} - 1` }).where(eq(clubPosts.id, postId));
      return res.json({ liked: false });
    }

    await db.insert(clubPostLikes).values({ clubPostId: postId, userId });
    await db.update(clubPosts).set({ likesCount: sql`${clubPosts.likesCount} + 1` }).where(eq(clubPosts.id, postId));

    const [liker] = await db
      .select({ displayName: users.displayName, username: users.username, avatarUrl: users.avatarUrl })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    await sendClubPostLikeNotification(
      post.userId,
      userId,
      liker?.displayName || liker?.username || "Someone",
      liker?.avatarUrl || null,
      clubId,
      postId
    );

    res.json({ liked: true });
  } catch (error) {
    console.error("Error toggling like:", error);
    res.status(500).json({ message: "Failed to like post" });
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

export default router;
