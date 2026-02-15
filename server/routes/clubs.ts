// server/routes/clubs.ts
import express, { type Request, type Response } from "express";
import { db } from "../db/index.js";
import { eq, and, desc, sql, inArray } from "drizzle-orm";
import {
  clubs,
  clubMemberships,
  clubPosts,
  challenges,
  challengeProgress,
  badges,
  userBadges,
  users,
  notifications,
} from "../../shared/schema.js";
import { requireAuth } from "../middleware/index";

const router = express.Router();

// ============================================================
// CLUBS MANAGEMENT
// ============================================================

// Browse clubs (public only)
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
      const searchLower = String(search).toLowerCase();
      filtered = filtered.filter(
        (c) =>
          c.club.name.toLowerCase().includes(searchLower) ||
          c.club.description?.toLowerCase().includes(searchLower)
      );
    }

    if (sort === "members") {
      filtered.sort((a, b) => Number(b.memberCount) - Number(a.memberCount));
    } else if (sort === "activity") {
      filtered.sort((a, b) => Number(b.postCount) - Number(a.postCount));
    } else {
      filtered.sort(
        (a, b) =>
          new Date(String(b.club.createdAt)).getTime() - new Date(String(a.club.createdAt)).getTime()
      );
    }

    res.json({ clubs: filtered });
  } catch (error) {
    console.error("Error browsing clubs:", error);
    res.status(500).json({ message: "Failed to browse clubs" });
  }
});

// User clubs (MUST come before /:id to avoid route collisions like /my-clubs being treated as an id)
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

// ============================================================
// CHALLENGES & BADGES (these are mounted under /api/clubs/* so they must also be before /:id)
// ============================================================

router.get("/challenges", async (_req: Request, res: Response) => {
  try {
    const list = await db.select().from(challenges).orderBy(desc(challenges.createdAt));
    res.json({ challenges: list });
  } catch (error) {
    console.error("Error fetching challenges:", error);
    res.status(500).json({ message: "Failed to fetch challenges" });
  }
});

router.get("/challenges/:id", async (req: Request, res: Response) => {
  try {
    const challengeId = req.params.id;

    const [challenge] = await db.select().from(challenges).where(eq(challenges.id, challengeId)).limit(1);

    if (!challenge) return res.status(404).json({ message: "Challenge not found" });

    const participants = await db
      .select({
        progress: challengeProgress,
        user: { id: users.id, username: users.username, displayName: users.displayName },
      })
      .from(challengeProgress)
      .innerJoin(users, eq(challengeProgress.userId, users.id))
      .where(eq(challengeProgress.challengeId, challengeId))
      .orderBy(desc(challengeProgress.progress));

    res.json({ challenge, participants });
  } catch (error) {
    console.error("Error fetching challenge:", error);
    res.status(500).json({ message: "Failed to fetch challenge" });
  }
});

router.post("/challenges/:id/join", requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const challengeId = req.params.id;

    const [existing] = await db
      .select()
      .from(challengeProgress)
      .where(and(eq(challengeProgress.userId, userId), eq(challengeProgress.challengeId, challengeId)))
      .limit(1);

    if (existing) {
      return res.status(400).json({ message: "Already joined" });
    }

    const [progress] = await db
      .insert(challengeProgress)
      .values({ userId, challengeId, progress: 0 })
      .returning();

    res.json({ progress });
  } catch (error) {
    console.error("Error joining challenge:", error);
    res.status(500).json({ message: "Failed to join challenge" });
  }
});

router.post("/challenges/:id/progress", requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const challengeId = req.params.id;
    const { progress } = req.body;

    const [updated] = await db
      .update(challengeProgress)
      .set({ progress: Number(progress) || 0 })
      .where(and(eq(challengeProgress.userId, userId), eq(challengeProgress.challengeId, challengeId)))
      .returning();

    res.json({ progress: updated });
  } catch (error) {
    console.error("Error updating challenge progress:", error);
    res.status(500).json({ message: "Failed to update progress" });
  }
});

router.get("/my-challenges", requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;

    const mine = await db
      .select()
      .from(challengeProgress)
      .where(eq(challengeProgress.userId, userId))
      .orderBy(desc(challengeProgress.createdAt));

    const challengeIds = mine.map((m) => m.challengeId).filter(Boolean) as string[];
    const challengeList = challengeIds.length
      ? await db.select().from(challenges).where(inArray(challenges.id, challengeIds))
      : [];

    res.json({ progress: mine, challenges: challengeList });
  } catch (error) {
    console.error("Error fetching user challenges:", error);
    res.status(500).json({ message: "Failed to fetch challenges" });
  }
});

router.get("/badges", async (_req: Request, res: Response) => {
  try {
    const list = await db.select().from(badges).orderBy(desc(badges.createdAt));
    res.json({ badges: list });
  } catch (error) {
    console.error("Error fetching badges:", error);
    res.status(500).json({ message: "Failed to fetch badges" });
  }
});

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

// ============================================================
// CLUB DETAIL & MEMBER ACTIONS
// ============================================================

// Club detail (public or private; private still visible, but actions restricted)
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

// Membership status for current user (prevents client relying on /my-clubs and fixes "no post box" issues)
router.get("/:id/membership", requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const clubId = req.params.id;

    const [club] = await db.select().from(clubs).where(eq(clubs.id, clubId)).limit(1);
    if (!club) return res.status(404).json({ message: "Club not found" });

    const [membership] = await db
      .select()
      .from(clubMemberships)
      .where(and(eq(clubMemberships.clubId, clubId), eq(clubMemberships.userId, userId)))
      .limit(1);

    res.json({
      membership: membership || null,
      isOwner: club.creatorId === userId || membership?.role === "owner",
      isPublic: !!club.isPublic,
    });
  } catch (error) {
    console.error("Error fetching membership:", error);
    res.status(500).json({ message: "Failed to fetch membership" });
  }
});

// Edit club (owner only)
router.patch("/:id", requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const clubId = req.params.id;
    const { name, description, rules, isPublic, category } = req.body;

    const [club] = await db.select().from(clubs).where(eq(clubs.id, clubId)).limit(1);
    if (!club) return res.status(404).json({ message: "Club not found" });
    if (club.creatorId !== userId) return res.status(403).json({ message: "Only the creator can edit this club" });

    const updates: any = {};
    if (typeof name === "string") updates.name = name.trim();
    if (typeof description === "string") updates.description = description || null;
    if (typeof rules === "string") updates.rules = rules || null;
    if (typeof category === "string") updates.category = category || "general";
    if (typeof isPublic === "boolean") updates.isPublic = isPublic;

    const [updated] = await db.update(clubs).set(updates).where(eq(clubs.id, clubId)).returning();
    res.json({ club: updated });
  } catch (error) {
    console.error("Error updating club:", error);
    res.status(500).json({ message: "Failed to update club" });
  }
});

// Delete club (owner only)
router.delete("/:id", requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const clubId = req.params.id;

    const [club] = await db.select().from(clubs).where(eq(clubs.id, clubId)).limit(1);
    if (!club) return res.status(404).json({ message: "Club not found" });
    if (club.creatorId !== userId) return res.status(403).json({ message: "Only the creator can delete this club" });

    await db.delete(clubs).where(eq(clubs.id, clubId));
    res.json({ ok: true });
  } catch (error) {
    console.error("Error deleting club:", error);
    res.status(500).json({ message: "Failed to delete club" });
  }
});

// Join club (public => immediate; private => request stored as membership.role='pending')
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
      return res.json({ membership: existingMembership });
    }

    const roleToSet = club.isPublic ? "member" : "pending";

    const [membership] = await db
      .insert(clubMemberships)
      .values({ clubId, userId, role: roleToSet })
      .returning();

    // Notifications
    const displayName = req.user?.displayName || req.user?.username || "Someone";
    if (club.creatorId && club.creatorId !== userId) {
      if (club.isPublic) {
        await db.insert(notifications).values({
          userId: club.creatorId,
          type: "club_member_joined",
          title: "New Club Member",
          message: `${displayName} joined your club “${club.name}”.`,
          linkUrl: `/clubs/${clubId}`,
          metadata: { clubId, memberId: userId },
          priority: "normal",
        });
      } else {
        await db.insert(notifications).values({
          userId: club.creatorId,
          type: "club_join_request",
          title: "Join Request",
          message: `${displayName} requested to join your private club “${club.name}”.`,
          linkUrl: `/clubs/${clubId}`,
          metadata: { clubId, requesterId: userId, membershipId: membership.id },
          priority: "high",
        });
      }
    }

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

    const [club] = await db.select().from(clubs).where(eq(clubs.id, clubId)).limit(1);
    if (!club) return res.status(404).json({ message: "Club not found" });

    if (club.creatorId === userId) {
      return res.status(400).json({ message: "Club creator cannot leave. Delete the club instead." });
    }

    await db
      .delete(clubMemberships)
      .where(and(eq(clubMemberships.clubId, clubId), eq(clubMemberships.userId, userId)));

    res.json({ ok: true });
  } catch (error) {
    console.error("Error leaving club:", error);
    res.status(500).json({ message: "Failed to leave club" });
  }
});

// Pending join requests (owner only)
router.get("/:id/join-requests", requireAuth, async (req: Request, res: Response) => {
  try {
    const clubId = req.params.id;
    const userId = req.user!.id;

    const [club] = await db.select().from(clubs).where(eq(clubs.id, clubId)).limit(1);
    if (!club) return res.status(404).json({ message: "Club not found" });
    if (club.creatorId !== userId) return res.status(403).json({ message: "Not allowed" });

    const pending = await db
      .select({
        membership: clubMemberships,
        user: { id: users.id, username: users.username, displayName: users.displayName },
      })
      .from(clubMemberships)
      .innerJoin(users, eq(clubMemberships.userId, users.id))
      .where(and(eq(clubMemberships.clubId, clubId), eq(clubMemberships.role, "pending" as any)))
      .orderBy(desc(clubMemberships.joinedAt));

    res.json({ requests: pending });
  } catch (error) {
    console.error("Error fetching join requests:", error);
    res.status(500).json({ message: "Failed to fetch requests" });
  }
});

router.post("/:id/join-requests/:membershipId/approve", requireAuth, async (req: Request, res: Response) => {
  try {
    const clubId = req.params.id;
    const membershipId = req.params.membershipId;
    const ownerId = req.user!.id;

    const [club] = await db.select().from(clubs).where(eq(clubs.id, clubId)).limit(1);
    if (!club) return res.status(404).json({ message: "Club not found" });
    if (club.creatorId !== ownerId) return res.status(403).json({ message: "Not allowed" });

    const [membership] = await db
      .select()
      .from(clubMemberships)
      .where(and(eq(clubMemberships.id, membershipId), eq(clubMemberships.clubId, clubId)))
      .limit(1);

    if (!membership) return res.status(404).json({ message: "Request not found" });

    const [updated] = await db
      .update(clubMemberships)
      .set({ role: "member" })
      .where(eq(clubMemberships.id, membershipId))
      .returning();

    // Notify requester
    if (membership.userId && membership.userId !== ownerId) {
      await db.insert(notifications).values({
        userId: membership.userId,
        type: "club_join_approved",
        title: "Request Approved",
        message: `You’ve been approved to join “${club.name}”.`,
        linkUrl: `/clubs/${clubId}`,
        metadata: { clubId },
        priority: "high",
      });
    }

    res.json({ membership: updated });
  } catch (error) {
    console.error("Error approving join request:", error);
    res.status(500).json({ message: "Failed to approve request" });
  }
});

router.delete("/:id/join-requests/:membershipId", requireAuth, async (req: Request, res: Response) => {
  try {
    const clubId = req.params.id;
    const membershipId = req.params.membershipId;
    const ownerId = req.user!.id;

    const [club] = await db.select().from(clubs).where(eq(clubs.id, clubId)).limit(1);
    if (!club) return res.status(404).json({ message: "Club not found" });
    if (club.creatorId !== ownerId) return res.status(403).json({ message: "Not allowed" });

    await db.delete(clubMemberships).where(and(eq(clubMemberships.id, membershipId), eq(clubMemberships.clubId, clubId)));
    res.json({ ok: true });
  } catch (error) {
    console.error("Error denying join request:", error);
    res.status(500).json({ message: "Failed to deny request" });
  }
});

// ============================================================
// POSTS
// ============================================================

// Fetch club posts
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

    res.json({ posts });
  } catch (error) {
    console.error("Error fetching club posts:", error);
    res.status(500).json({ message: "Failed to fetch posts" });
  }
});

// Create post (must be member, not pending)
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

    if (!membership) return res.status(403).json({ message: "You must be a member to post" });
    if (membership.role === "pending") return res.status(403).json({ message: "Your join request is pending approval" });

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

// Update post (author OR club owner)
router.patch("/:id/posts/:postId", requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const clubId = req.params.id;
    const postId = req.params.postId;
    const { content } = req.body;

    if (!content || !String(content).trim()) {
      return res.status(400).json({ message: "Content is required" });
    }

    const [post] = await db.select().from(clubPosts).where(eq(clubPosts.id, postId)).limit(1);
    if (!post || post.clubId !== clubId) return res.status(404).json({ message: "Post not found" });

    const [club] = await db.select().from(clubs).where(eq(clubs.id, clubId)).limit(1);
    if (!club) return res.status(404).json({ message: "Club not found" });

    const isOwner = club.creatorId === userId;
    const isAuthor = post.userId === userId;

    if (!isOwner && !isAuthor) return res.status(403).json({ message: "Not allowed" });

    const [updated] = await db
      .update(clubPosts)
      .set({ content: String(content).trim() })
      .where(eq(clubPosts.id, postId))
      .returning();

    res.json({ post: updated });
  } catch (error) {
    console.error("Error updating post:", error);
    res.status(500).json({ message: "Failed to update post" });
  }
});

// Delete post (author OR club owner)
router.delete("/:id/posts/:postId", requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const clubId = req.params.id;
    const postId = req.params.postId;

    const [post] = await db.select().from(clubPosts).where(eq(clubPosts.id, postId)).limit(1);
    if (!post || post.clubId !== clubId) return res.status(404).json({ message: "Post not found" });

    const [club] = await db.select().from(clubs).where(eq(clubs.id, clubId)).limit(1);
    if (!club) return res.status(404).json({ message: "Club not found" });

    const isOwner = club.creatorId === userId;
    const isAuthor = post.userId === userId;

    if (!isOwner && !isAuthor) return res.status(403).json({ message: "Not allowed" });

    await db.delete(clubPosts).where(eq(clubPosts.id, postId));
    res.json({ ok: true });
  } catch (error) {
    console.error("Error deleting post:", error);
    res.status(500).json({ message: "Failed to delete post" });
  }
});

export default router;
