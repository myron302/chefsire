// server/routes/likes.ts
import { Router } from "express";
import { storage } from "../storage";
import { sendNotification } from "../services/notifications";

const r = Router();

// POST /api/likes  { userId, postId }
r.post("/", async (req, res, next) => {
  try {
    const like = await storage.likePost(req.body.userId, req.body.postId);

    // Send notification to post author (non-blocking)
    setImmediate(async () => {
      try {
        const post = await storage.getPost(req.body.postId);
        const liker = await storage.getUser(req.body.userId);

        // Don't notify if user likes their own post
        if (post && liker && post.userId !== req.body.userId) {
          await sendNotification(post.userId, {
            type: "like",
            title: "New Like",
            message: `${liker.displayName || liker.username} liked your post`,
            imageUrl: liker.avatar,
            linkUrl: `/post/${post.id}`,
            priority: "normal",
          });
        }
      } catch (notifError) {
        console.error("Failed to send like notification:", notifError);
      }
    });

    res.status(201).json(like);
  } catch (error) { next(error); }
});

// DELETE /api/likes/:userId/:postId
r.delete("/:userId/:postId", async (req, res, next) => {
  try {
    const ok = await storage.unlikePost(req.params.userId, req.params.postId);
    if (!ok) return res.status(404).json({ message: "Like not found" });
    res.json({ message: "Post unliked successfully" });
  } catch (error) { next(error); }
});

// GET /api/likes/:userId/:postId
r.get("/:userId/:postId", async (req, res, next) => {
  try {
    const isLiked = await storage.isPostLiked(req.params.userId, req.params.postId);
    res.json({ isLiked });
  } catch (error) { next(error); }
});

export default r;
