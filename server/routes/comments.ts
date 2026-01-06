// server/routes/comments.ts
import { Router } from "express";
import { storage } from "../storage";
import { sendCommentNotification, sendReplyNotification } from "../services/notification-service";

const r = Router();

// GET /api/comments/post/:postId
r.get("/post/:postId", async (req, res, next) => {
  try {
    const items = await storage.getPostComments(req.params.postId);
    res.json(items);
  } catch (error) { next(e); }
});

// POST /api/comments
r.post("/", async (req, res, next) => {
  try {
    const created = await storage.createComment(req.body);

    // Send notification
    const post = await storage.getPostById(created.postId);
    const commenter = await storage.getUserById(created.userId);

    if (post && commenter) {
      if (created.parentId) {
        // This is a reply to another comment
        const parentComment = await storage.getCommentById(created.parentId);
        if (parentComment && parentComment.userId !== created.userId) {
          sendReplyNotification(
            parentComment.userId,
            created.userId,
            commenter.username || commenter.displayName || 'Someone',
            commenter.avatar,
            post.id,
            created.text
          );
        }
      } else {
        // This is a comment on the post
        if (post.userId !== created.userId) {
          sendCommentNotification(
            post.userId,
            created.userId,
            commenter.username || commenter.displayName || 'Someone',
            commenter.avatar,
            post.id,
            created.text
          );
        }
      }
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
  } catch (error) { next(e); }
});

export default r;
