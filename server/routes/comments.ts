// server/routes/comments.ts
import { Router } from "express";
import { storage } from "../storage";

const r = Router();

// GET /api/comments/post/:postId
r.get("/post/:postId", async (req, res, next) => {
  try {
    const items = await storage.getPostComments(req.params.postId);
    res.json(items);
  } catch (error) { next(error); }
});

// POST /api/comments
r.post("/", async (req, res, next) => {
  try {
    const created = await storage.createComment(req.body);

    // Send notification to post author
    try {
      const post = await storage.getPost(req.body.postId);
      const commenter = await storage.getUser(req.body.userId);

      // Don't notify if user comments on their own post
      if (post && commenter && post.userId !== req.body.userId) {
        const { notificationHelper } = await import("../index");
        await notificationHelper.notifyUser(post.userId, {
          type: "comment",
          title: "New Comment",
          message: `${commenter.displayName || commenter.username} commented: "${created.text.substring(0, 50)}${created.text.length > 50 ? '...' : ''}"`,
          imageUrl: commenter.avatar,
          linkUrl: `/post/${post.id}`,
          priority: "normal",
        });
      }

      // If this is a reply to another comment, notify the parent comment author
      if (req.body.parentId) {
        const parentComment = await storage.getComment(req.body.parentId);
        if (parentComment && parentComment.userId !== req.body.userId) {
          const { notificationHelper } = await import("../index");
          await notificationHelper.notifyUser(parentComment.userId, {
            type: "comment",
            title: "New Reply",
            message: `${commenter.displayName || commenter.username} replied: "${created.text.substring(0, 50)}${created.text.length > 50 ? '...' : ''}"`,
            imageUrl: commenter.avatar,
            linkUrl: `/post/${post.id}`,
            priority: "normal",
          });
        }
      }
    } catch (notifError) {
      console.error("Failed to send comment notification:", notifError);
      // Don't fail the comment operation if notification fails
    }

    res.status(201).json(created);
  } catch (error) { next(error); }
});

// DELETE /api/comments/:id
r.delete("/:id", async (req, res, next) => {
  try {
    const ok = await storage.deleteComment(req.params.id);
    if (!ok) return res.status(404).json({ message: "Comment not found" });
    res.json({ message: "Comment deleted" });
  } catch (error) { next(error); }
});

export default r;
