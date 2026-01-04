// server/routes/follows.ts
import { Router } from "express";
import { storage } from "../storage";

const r = Router();

/**
 * POST /api/follows
 * Body: { followerId, followingId }
 */
r.post("/", async (req, res, next) => {
  try {
    const { followerId, followingId } = req.body || {};
    if (!followerId || !followingId) {
      return res.status(400).json({ message: "followerId and followingId are required" });
    }
    const follow = await storage.followUser(followerId, followingId);
    res.status(201).json(follow);
  } catch (error) { next(e); }
});

/**
 * DELETE /api/follows/:followerId/:followingId
 */
r.delete("/:followerId/:followingId", async (req, res, next) => {
  try {
    const ok = await storage.unfollowUser(req.params.followerId, req.params.followingId);
    if (!ok) return res.status(404).json({ message: "Follow relationship not found" });
    res.json({ message: "User unfollowed successfully" });
  } catch (error) { next(e); }
});

/**
 * GET /api/follows/:followerId/:followingId
 * Returns { isFollowing: boolean }
 */
r.get("/:followerId/:followingId", async (req, res, next) => {
  try {
    const isFollowing = await storage.isFollowing(req.params.followerId, req.params.followingId);
    res.json({ isFollowing });
  } catch (error) { next(e); }
});

/**
 * GET /api/follows/user/:userId/followers?offset=0&limit=25
 * Lists users who follow :userId
 */
r.get("/user/:userId/followers", async (req, res, next) => {
  try {
    const offset = Number(req.query.offset ?? 0);
    const limit  = Number(req.query.limit ?? 25);

    const all = await storage.getFollowers(req.params.userId);
    const items = all.slice(offset, offset + limit);

    res.json({
      items,
      total: all.length,
      offset,
      limit,
    });
  } catch (error) { next(e); }
});

/**
 * GET /api/follows/user/:userId/following?offset=0&limit=25
 * Lists users that :userId is following
 */
r.get("/user/:userId/following", async (req, res, next) => {
  try {
    const offset = Number(req.query.offset ?? 0);
    const limit  = Number(req.query.limit ?? 25);

    const all = await storage.getFollowing(req.params.userId);
    const items = all.slice(offset, offset + limit);

    res.json({
      items,
      total: all.length,
      offset,
      limit,
    });
  } catch (error) { next(e); }
});

/**
 * GET /api/follows/user/:userId/stats
 * Returns follower/following counts (uses columns if present, otherwise derives)
 */
r.get("/user/:userId/stats", async (req, res, next) => {
  try {
    const user = await storage.getUser(req.params.userId);
    if (!user) return res.status(404).json({ message: "User not found" });

    let followersCount = (user as any).followersCount;
    let followingCount = (user as any).followingCount;

    if (followersCount == null || followingCount == null) {
      // derive if counts aren't stored
      const [followers, following] = await Promise.all([
        storage.getFollowers(req.params.userId),
        storage.getFollowing(req.params.userId),
      ]);
      followersCount = followers.length;
      followingCount = following.length;
    }

    res.json({ followersCount, followingCount });
  } catch (error) { next(e); }
});

export default r;
