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
  } catch (error) { next(error); }
});

// POST /api/comments
r.post("/", async (req, res, next) => {
  try {
    const created = await storage.createComment(req.body);

    // Send notifications (non-blocking)
    setImmediate(async () => {
      try {
        const post = await storage.getPost(req.body.postId);
        const commenter = await storage.getUser(req.body.userId);

        if (post && commenter) {
          // Notify post author
          await sendCommentNotification(
            post.userId,
            commenter.id,
            commenter.displayName || commenter.username,
            commenter.avatar,
            post.id,
            created.text
          );

          // If reply, notify parent comment author
          if (req.body.parentId) {
            const parentComment = await storage.getComment(req.body.parentId);
            if (parentComment) {
              await sendReplyNotification(
                parentComment.userId,
                commenter.id,
                commenter.displayName || commenter.username,
                commenter.avatar,
                post.id,
                created.text
              );
            }
          }
        }
      } catch (err) {
        console.error("Notification error:", err);
      }
    });

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
