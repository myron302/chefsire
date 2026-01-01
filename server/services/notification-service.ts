// server/services/notification-service.ts
// Notification service to send notifications without circular dependencies

import { db } from "../db";
import { notifications } from "../../shared/schema";

export async function sendLikeNotification(
  postAuthorId: string,
  likerId: string,
  likerName: string,
  likerAvatar: string | null,
  postId: string
) {
  try {
    // Don't notify if user likes their own post
    if (postAuthorId === likerId) return;

    await db.insert(notifications).values({
      userId: postAuthorId,
      type: "like",
      title: "New Like",
      message: `${likerName} liked your post`,
      imageUrl: likerAvatar,
      linkUrl: `/post/${postId}`,
      priority: "normal",
    });
  } catch (error) {
    console.error("Failed to send like notification:", error);
  }
}

export async function sendCommentNotification(
  postAuthorId: string,
  commenterId: string,
  commenterName: string,
  commenterAvatar: string | null,
  postId: string,
  commentText: string
) {
  try {
    // Don't notify if user comments on their own post
    if (postAuthorId === commenterId) return;

    await db.insert(notifications).values({
      userId: postAuthorId,
      type: "comment",
      title: "New Comment",
      message: `${commenterName} commented: "${commentText.substring(0, 50)}${commentText.length > 50 ? '...' : ''}"`,
      imageUrl: commenterAvatar,
      linkUrl: `/post/${postId}`,
      priority: "normal",
    });
  } catch (error) {
    console.error("Failed to send comment notification:", error);
  }
}

export async function sendReplyNotification(
  parentCommentAuthorId: string,
  replierId: string,
  replierName: string,
  replierAvatar: string | null,
  postId: string,
  replyText: string
) {
  try {
    // Don't notify if user replies to their own comment
    if (parentCommentAuthorId === replierId) return;

    await db.insert(notifications).values({
      userId: parentCommentAuthorId,
      type: "comment",
      title: "New Reply",
      message: `${replierName} replied: "${replyText.substring(0, 50)}${replyText.length > 50 ? '...' : ''}"`,
      imageUrl: replierAvatar,
      linkUrl: `/post/${postId}`,
      priority: "normal",
    });
  } catch (error) {
    console.error("Failed to send reply notification:", error);
  }
}
